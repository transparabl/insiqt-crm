// Planlagt jobb for kontrollsenteret. Kalles av pg_cron hvert 15. minutt med en hemmelig header.
// Lager varsler (frister, personvernavvik, nedetid, signering, nye Pocket-samtaler) og sender dem som push.
// Sender aldri e-post eller meldinger til andre enn John og Ove sine egne enheter.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const UPTIME: [string, string][] = [
  ["Insiqt-plattformen (Azure)", "https://ca-insiqt-web-prod.ashyisland-4121c7a0.norwayeast.azurecontainerapps.io/"],
  ["Nettsiden insiqt.ai", "https://insiqt.ai/"],
  ["CRM og kontrollsenter", "https://insiqt-crm.vercel.app/"],
];
const APP = "/kontroll.html";
const DAY = 864e5;
type Msg = { kind: string; key: string; title: string; body?: string; url?: string };

async function config(names: string[]) {
  const { data } = await admin.from("kontroll_config").select("name,value").in("name", names);
  return Object.fromEntries((data || []).map((r: any) => [r.name, r.value])) as Record<string, string>;
}
async function vapid() {
  const m = await config(["VAPID_PUBLIC", "VAPID_PRIVATE"]);
  if (m.VAPID_PUBLIC && m.VAPID_PRIVATE) return { pub: m.VAPID_PUBLIC, priv: m.VAPID_PRIVATE };
  const k = webpush.generateVAPIDKeys();
  await admin.from("kontroll_config").upsert([{ name: "VAPID_PUBLIC", value: k.publicKey }, { name: "VAPID_PRIVATE", value: k.privateKey }]);
  return { pub: k.publicKey, priv: k.privateKey };
}

// ---------- frister ----------
async function deadlines(out: Msg[]) {
  const { data } = await admin.from("deadlines").select("id,title,due_date").is("done_at", null).not("due_date", "is", null);
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  for (const d of data || []) {
    const left = Math.round((new Date(d.due_date).getTime() - today) / DAY);
    const b = left < 0 ? "forfalt" : left === 0 ? "i dag" : left <= 1 ? "1" : left <= 7 ? "7" : left <= 14 ? "14" : null;
    if (!b) continue;
    const when = b === "forfalt" ? `forfalt for ${-left} dag${left === -1 ? "" : "er"} siden` : b === "i dag" ? "har frist i dag" : `har frist om ${left} dag${left === 1 ? "" : "er"}`;
    out.push({ kind: "frister", key: `frist:${d.id}:${d.due_date}:${b}`, title: `${d.title} ${when}`, body: `Frist ${new Date(d.due_date).toLocaleDateString("nb-NO", { day: "numeric", month: "long" })}.`, url: `${APP}#drift` });
  }
}
// ---------- personvernavvik (72-timersfristen) ----------
async function incidents(out: Msg[]) {
  const { data } = await admin.from("incidents").select("id,title,discovered_at,notify_required,notified_at,status");
  for (const i of data || []) {
    if (i.notified_at || i.notify_required === false || ["lukket", "avsluttet"].includes(String(i.status))) continue;
    const h = (Date.now() - new Date(i.discovered_at).getTime()) / 36e5;
    const b = h >= 72 ? "72" : h >= 60 ? "60" : h >= 48 ? "48" : h >= 24 ? "24" : h >= 0 ? "0" : null;
    if (!b) continue;
    const left = Math.max(0, Math.round(72 - h));
    out.push({ kind: "avvik", key: `avvik:${i.id}:${b}`, title: b === "72" ? `Personvernavvik: 72-timersfristen er passert` : `Personvernavvik: ${left} timer igjen av 72`, body: `${i.title}. Vurder om det skal meldes til Datatilsynet – det gjøres manuelt.`, url: `${APP}#drift` });
  }
}
// ---------- nedetid ----------
async function uptime(out: Msg[]) {
  const { data: prev } = await admin.from("uptime_state").select("*");
  const was = new Map((prev || []).map((r: any) => [r.name, r]));
  for (const [name, url] of UPTIME) {
    let ok = false, code = 0;
    try { const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Insiqt-kontrollsenter/1.0" } }); await r.body?.cancel(); code = r.status; ok = r.status < 500; } catch { ok = false; }
    const p: any = was.get(name); const changed = !p || p.ok !== ok;
    await admin.from("uptime_state").upsert({ name, ok, code, checked_at: new Date().toISOString(), ...(changed ? { changed_at: new Date().toISOString() } : {}) });
    if (p && changed) out.push({ kind: "nede", key: `nede:${name}:${ok ? "opp" : "nede"}:${new Date().toISOString().slice(0, 13)}`, title: ok ? `${name} er oppe igjen` : `${name} svarer ikke`, body: ok ? `Svarer med HTTP ${code}.` : code ? `Svarer med HTTP ${code}.` : "Fikk ikke kontakt.", url: `${APP}#drift` });
  }
}
// ---------- signering ----------
async function signing(out: Msg[]) {
  const { data } = await admin.from("signatures").select("id,company_name,doc_type,sent_at").eq("status", "sendt").not("sent_at", "is", null);
  const names: Record<string, string> = { pilotavtale: "Pilotavtalen", dpa: "Databehandleravtalen", kundeavtale: "Kundeavtalen", sla: "SLA-en", annet: "Avtalen" };
  for (const s of data || []) {
    const d = Math.floor((Date.now() - new Date(s.sent_at).getTime()) / DAY);
    const b = d >= 14 ? "14" : d >= 7 ? "7" : null;
    if (b) out.push({ kind: "signering", key: `sign:${s.id}:${b}`, title: `${names[s.doc_type] || "Avtalen"} til ${s.company_name} er ikke signert`, body: `Sendt for ${d} dager siden. Følg opp.`, url: `${APP}#signering` });
  }
}
// ---------- Pocket (bare mappen «Insiqt.ai Project») ----------
const POCKET = "https://public.heypocketai.com/api/v1", FOLDER = "insiqt.ai project";
const flat = (a: any[]): any[] => a.flatMap((f: any) => [f, ...flat(f.children || [])]);
function sumText(x: any, depth = 0): string {
  if (x == null || depth > 6) return "";
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(v => sumText(v, depth + 1)).filter(Boolean).join("\n\n");
  if (typeof x === "object") {
    for (const k of ["markdown", "content", "summary", "text", "body", "notes", "value"]) if (typeof x[k] === "string" && x[k].trim().length > 20) return (x.title || x.name ? `## ${x.title || x.name}\n` : "") + x[k];
    return Object.entries(x).filter(([k]) => !/(^id$|_id$|_at$|^id_|color|status|language|type|kind|model|version|error)/i.test(k)).map(([, v]) => sumText(v, depth + 1)).filter(t => t.trim().length > 2).join("\n");
  }
  return "";
}
async function pocket(out: Msg[]) {
  const { data: key } = await admin.from("kontroll_secrets").select("value").eq("name", "POCKET_API_KEY").maybeSingle();
  if (!key?.value) return;
  const { data: log } = await admin.from("sync_log").select("synced_at").eq("source", "pocket").maybeSingle();
  if (log?.synced_at && Date.now() - new Date(log.synced_at).getTime() < 3 * 36e5) return;
  const get = async (p: string) => { const r = await fetch(POCKET + p, { headers: { Authorization: `Bearer ${key.value}` }, signal: AbortSignal.timeout(20000) }); const d = await r.json().catch(() => ({})); if (!r.ok || d?.success === false) throw new Error(`Pocket ${r.status}`); return d; };
  const root = flat((await get("/public/folders")).data || []).find((f: any) => String(f.name || "").trim().toLowerCase() === FOLDER);
  if (!root) return;
  const ids = new Set(flat([root]).map((f: any) => f.id));
  const { data: last } = await admin.from("conversations").select("recorded_at").order("recorded_at", { ascending: false }).limit(1);
  const since = last?.[0]?.recorded_at ? new Date(new Date(last[0].recorded_at).getTime() - 3 * DAY) : new Date(Date.now() - 180 * DAY);
  const recs: any[] = [];
  for (let page = 1; page <= 5; page++) { const d = await get(`/public/recordings?start_date=${since.toISOString().slice(0, 10)}&page=${page}&limit=100`); recs.push(...(d.data || [])); if (!d.pagination?.has_more) break; }
  const mine = recs.filter((r: any) => ids.has(r.folder_id));
  const { data: have } = await admin.from("conversations").select("id,summary_kind").in("id", mine.map((r: any) => r.id).concat(["-"]));
  const known = new Map((have || []).map((r: any) => [r.id, r.summary_kind]));
  let added = 0;
  for (const r of mine) {
    if (known.has(r.id) && known.get(r.id) !== "transkripsjon") continue;
    const g = (await get(`/public/recordings/${r.id}?include_transcript=true&include_summarizations=true`)).data || {};
    let notes = sumText(g.summarizations).trim(), kind = "oppsummering";
    if (!notes) {
      if ((Date.now() - new Date(g.recording_at || r.recording_at).getTime()) / 36e5 < 3) continue;
      notes = (g.transcript?.segments || []).map((s: any) => `${s.speakerName || s.speaker || "?"}: ${s.text || ""}`).join("\n").trim(); kind = "transkripsjon";
      if (!notes || known.has(r.id)) continue;
    }
    await admin.from("conversations").upsert({ id: r.id, title: g.title || r.title || "Uten tittel", recorded_at: g.recording_at || r.recording_at, folder: "Insiqt.ai Project", notes: notes.slice(0, 20000), source: "pocket-api", summary_kind: kind, synced_at: new Date().toISOString() }, { onConflict: "id" });
    if (!known.has(r.id)) { added++; out.push({ kind: "pocket", key: `pocket:${r.id}`, title: `Ny samtale fra Pocket: ${g.title || r.title || "Uten tittel"}`, body: "Trykk for å lage oppfølging.", url: `${APP}#moter` }); }
  }
  await admin.from("sync_log").upsert({ source: "pocket", synced_at: new Date().toISOString(), note: `${added} nye · automatisk` }, { onConflict: "source" });
}

// ---------- send ----------
async function deliver(msgs: Msg[]) {
  if (!msgs.length) return { created: 0, sent: 0 };
  const { data: seen } = await admin.from("notifications").select("dedupe_key").in("dedupe_key", msgs.map(m => m.key));
  const old = new Set((seen || []).map((r: any) => r.dedupe_key));
  const fresh = msgs.filter(m => !old.has(m.key));
  if (!fresh.length) return { created: 0, sent: 0 };
  const { data: subs } = await admin.from("push_subscriptions").select("*");
  const k = await vapid(); webpush.setVapidDetails("mailto:john@insiqt.ai", k.pub, k.priv);
  let sent = 0;
  for (const m of fresh) {
    let n = 0;
    for (const s of subs || []) {
      if (s.prefs && s.prefs[m.kind] === false) continue;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.key }), { TTL: 86400 });
        n++; await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString(), last_error: null }).eq("id", s.id);
      } catch (e: any) {
        const code = e?.statusCode || 0;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else await admin.from("push_subscriptions").update({ last_error: String(e?.message || e).slice(0, 200) }).eq("id", s.id);
      }
    }
    await admin.from("notifications").insert({ kind: m.kind, dedupe_key: m.key, title: m.title, body: m.body, url: m.url, sent_to: n });
    sent += n;
  }
  return { created: fresh.length, sent };
}

Deno.serve(async (req) => {
  const { CRON_SECRET } = await config(["CRON_SECRET"]);
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return new Response("Ingen tilgang", { status: 401 });
  const out: Msg[] = [], errors: string[] = [];
  for (const [name, fn] of [["frister", deadlines], ["avvik", incidents], ["nede", uptime], ["signering", signing], ["pocket", pocket]] as [string, (o: Msg[]) => Promise<void>][]) {
    try { await fn(out); } catch (e) { errors.push(`${name}: ${String((e as Error).message || e).slice(0, 160)}`); }
  }
  const r = await deliver(out);
  return new Response(JSON.stringify({ ...r, candidates: out.length, errors }), { headers: { "Content-Type": "application/json" } });
});
