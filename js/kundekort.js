import { supabase } from './supabase-client.js';
import { session } from './session.js';
import { showView } from './view.js';
import {
  state, statusLabel, tempIcon, fmtDate, fmtDateTime, fmtKr, escapeHtml,
  showToast, logActivity, refreshAll, openCompanyModal, primaryContact,
  SOURCE_LABELS, ACTIVITY_LABELS,
} from './app.js';
import { lenkeTilSalg } from './tilsalg.js';

const $ = (sel) => document.querySelector(sel);

const PRESENTASJON_URL = 'https://insiqt-presentasjon.vercel.app';

let currentId = null;

export async function openKundekort(companyId) {
  currentId = companyId;
  showView('kundekort');
  await render();
}

async function render() {
  const el = $('#kundekort');
  const c = state.companies.find((x) => x.id === currentId);
  if (!c) { el.innerHTML = '<p>Fant ikke selskapet.</p>'; return; }

  el.innerHTML = '<p class="muted">Henter kundekort…</p>';

  const [kontakt, tilbudRes, aktiviteterRes] = await Promise.all([
    primaryContact(c.id),
    supabase.from('offers').select('*').eq('company_id', c.id).order('created_at', { ascending: false }),
    supabase.from('company_activities').select('*').eq('company_id', c.id).order('created_at', { ascending: false }),
  ]);
  const tilbud = tilbudRes.data || [];
  const aktiviteter = aktiviteterRes.data || [];
  const sisteTilbud = tilbud[0] || null;

  // E-postaktivitet: webhooks i email_events + tilbudsstatus som grunnlag
  let epost = [];
  if (tilbud.length) {
    const r = await supabase.from('email_events').select('*')
      .in('offer_id', tilbud.map((t) => t.id))
      .order('created_at', { ascending: true });
    epost = r.data || [];
  }

  const kanMarkereSalg = !['won', 'onboarding', 'aktiv_kunde'].includes(c.status);
  const kanSendeOnboarding = c.status === 'won';

  // Sender med bedriftsinfo og siste regnskapsår — selgeren slipper å taste
  // det inn på nytt i salgsverktøyet.
  const salgLenke = lenkeTilSalg({
    navn: c.name, org_no: c.org_no, place: c.place,
    contact_name: kontakt?.name, contact_role: kontakt?.role, contact_email: kontakt?.email,
    vehicle_count: c.vehicle_count, financials: c.financials,
  });

  el.innerHTML = `
    <div class="kort-head">
      <div>
        <button class="btn ghost" id="kortTilbake">← Tilbake</button>
      </div>
      <div class="kort-actions">
        ${c.meeting_url ? `<a class="btn" href="${escapeHtml(c.meeting_url)}" target="_blank" rel="noopener noreferrer">🎥 Bli med i møte</a>` : ''}
        <a class="btn ghost" href="${PRESENTASJON_URL}" target="_blank" rel="noopener">🎤 Presentasjon</a>
        <a class="btn ghost" href="${salgLenke}" target="_blank" rel="noopener">💼 Åpne i Insiqt Salg</a>
        <button class="btn ghost" id="kortRediger">Rediger</button>
        ${kanMarkereSalg ? '<button class="btn" id="kortMarkerSalg">Marker som salg</button>' : ''}
        ${kanSendeOnboarding ? '<button class="btn" id="kortSendOnboarding">Send til onboarding</button>' : ''}
      </div>
    </div>

    <h1 class="view-title">${tempIcon(c)} ${escapeHtml(c.name)}</h1>
    <div class="pill-row">
      <span class="pill status-${c.status}">${statusLabel(c.status)}</span>
      ${c.lead_source ? `<span class="pill">${SOURCE_LABELS[c.lead_source] || escapeHtml(c.lead_source)}</span>` : ''}
      ${c.onboarding_status ? `<span class="pill">Onboarding: ${escapeHtml(c.onboarding_status)}</span>` : ''}
      ${c.meeting_start_time ? `<span class="pill action">📅 Demo ${fmtDateTime(c.meeting_start_time)}</span>` : ''}
    </div>

    ${c.next_activity ? `
    <div class="next-activity-banner">
      <div><b>Neste aktivitet:</b> ${escapeHtml(c.next_activity)}
        ${c.next_activity_at ? `<span class="muted"> · ${fmtDateTime(c.next_activity_at)}</span>` : ''}</div>
      <button class="btn ghost" id="kortFerdigAktivitet">✓ Utført</button>
    </div>` : ''}

    <div class="kort-grid">
      <div class="panel">
        <h2 class="panel-title">Company</h2>
        <table class="kv">
          <tr><td>Organisasjonsnummer</td><td>${escapeHtml(c.org_no || '–')}</td></tr>
          <tr><td>Sted</td><td>${escapeHtml(c.address || c.place || '–')}</td></tr>
          <tr><td>Antall kjøretøy</td><td>${c.vehicle_count ?? '–'}</td></tr>
          <tr><td>Bransje</td><td>${escapeHtml(c.bransje || c.industry || '–')}</td></tr>
          ${c.selskapsform ? `<tr><td>Selskapsform</td><td>${escapeHtml(c.selskapsform)}</td></tr>` : ''}
          ${c.etablert ? `<tr><td>Etablert</td><td>${escapeHtml(c.etablert)}</td></tr>` : ''}
          ${c.styreleder ? `<tr><td>Styreleder</td><td>${escapeHtml(c.styreleder)}</td></tr>` : ''}
          ${c.eier ? `<tr><td>Eier</td><td>${escapeHtml(c.eier)}</td></tr>` : ''}
          <tr><td>Ansvarlig</td><td>${escapeHtml(c.assigned_to || '–')}</td></tr>
        </table>
      </div>

      <div class="panel">
        <h2 class="panel-title">Contact</h2>
        <table class="kv">
          <tr><td>Navn</td><td>${escapeHtml(kontakt?.name || '–')}</td></tr>
          <tr><td>Rolle</td><td>${escapeHtml(kontakt?.role || '–')}</td></tr>
          <tr><td>E-post</td><td>${kontakt?.email ? `<a href="mailto:${escapeHtml(kontakt.email)}">${escapeHtml(kontakt.email)}</a>` : '–'}</td></tr>
          <tr><td>Telefon</td><td>${kontakt?.phone ? `<a href="tel:${escapeHtml(kontakt.phone)}">${escapeHtml(kontakt.phone)}</a>` : '–'}</td></tr>
        </table>
      </div>

      <div class="panel">
        <h2 class="panel-title">Deal</h2>
        ${sisteTilbud ? `
        <table class="kv">
          <tr><td>Tilbud</td><td>${escapeHtml(sisteTilbud.ref)} <span class="pill status-offer-${sisteTilbud.status}">${escapeHtml(sisteTilbud.status)}</span></td></tr>
          <tr><td>MRR</td><td>${fmtKr(sisteTilbud.price_month)}/mnd</td></tr>
          <tr><td>Per år</td><td>${fmtKr(sisteTilbud.price_year)}</td></tr>
          <tr><td>Moduler</td><td>${(Array.isArray(sisteTilbud.modules) ? sisteTilbud.modules : []).map((m) => escapeHtml(m.name)).join(', ') || 'Grunnpakke'}</td></tr>
          <tr><td>Sendt</td><td>${sisteTilbud.sent_at ? fmtDateTime(sisteTilbud.sent_at) : '–'}</td></tr>
          <tr><td>Gyldig til</td><td>${fmtDate(sisteTilbud.valid_until)}</td></tr>
          ${sisteTilbud.accepted_at ? `<tr><td>Akseptert</td><td>${fmtDateTime(sisteTilbud.accepted_at)}</td></tr>` : ''}
          ${c.mrr ? `<tr><td>Registrert MRR</td><td>${fmtKr(c.mrr)}/mnd</td></tr>` : ''}
        </table>
        ${tilbud.length > 1 ? `<p class="muted" style="margin-top:8px">${tilbud.length - 1} eldre tilbud finnes også.</p>` : ''}
        ` : '<p class="muted">Ingen tilbud sendt ennå.</p>'}
      </div>

      <div class="panel">
        <h2 class="panel-title">Email activity</h2>
        ${renderEpost(tilbud, epost)}
      </div>

      <div class="panel">
        <h2 class="panel-title">Regnskap</h2>
        ${renderRegnskap(c)}
      </div>
    </div>

    <div class="panel" style="margin-top:14px">
      <h2 class="panel-title">Timeline</h2>
      <div class="add-activity-row">
        <select id="kortAktType">
          <option value="call">Samtale</option>
          <option value="email">E-post</option>
          <option value="meeting">Møte</option>
          <option value="demo_gjennomfort">Demo gjennomført</option>
          <option value="note">Notat</option>
        </select>
        <input type="text" id="kortAktNote" placeholder="F.eks. «Ringte, ikke svar»">
        <button type="button" class="btn" id="kortAktLegg">Legg til</button>
      </div>
      <div class="activity-log" style="margin-top:12px">
        ${aktiviteter.length ? aktiviteter.map((a) => `
          <div class="activity-item">
            <span class="a-type">${ACTIVITY_LABELS[a.type] || escapeHtml(a.type)}</span>
            <span class="a-time">${fmtDateTime(a.created_at)}${a.actor ? ' · ' + escapeHtml(a.actor) : ''}</span>
            <div class="a-note">${escapeHtml(a.note || '')}</div>
          </div>`).join('') : '<div class="empty-col">Ingen aktivitet enda</div>'}
      </div>
    </div>
  `;

  $('#kortTilbake').addEventListener('click', () => history.length > 1 ? history.back() : showView('pipeline'));
  $('#kortRediger').addEventListener('click', () => openCompanyModal(c.id));

  $('#kortFerdigAktivitet')?.addEventListener('click', async () => {
    await logActivity(c.id, 'note', `Utført: ${c.next_activity}`);
    await supabase.from('companies').update({ next_activity: null, next_activity_at: null }).eq('id', c.id);
    await refreshAll();
    await render();
  });

  $('#kortAktLegg').addEventListener('click', async () => {
    const note = $('#kortAktNote').value.trim();
    if (!note) { showToast('Skriv en notat-tekst', true); return; }
    const type = $('#kortAktType').value;
    await logActivity(c.id, type, note);
    if (type === 'demo_gjennomfort' && ['lead', 'kontaktet', 'demo_avtalt'].includes(c.status)) {
      await supabase.from('companies').update({ status: 'demo_gjennomfort' }).eq('id', c.id);
      await refreshAll();
    }
    await render();
  });

  $('#kortMarkerSalg')?.addEventListener('click', async () => {
    const grunnlag = tilbud.find((t) => t.status === 'accepted') || sisteTilbud;
    const mrr = grunnlag?.price_month ?? null;
    if (!confirm(`Marker ${c.name} som salg${mrr ? ` med MRR ${Math.round(mrr).toLocaleString('nb-NO')} kr` : ''}?`)) return;
    const { error } = await supabase.from('companies').update({
      status: 'won',
      mrr,
      won_at: new Date().toISOString(),
      next_activity: 'Send til onboarding',
      next_activity_at: new Date().toISOString(),
    }).eq('id', c.id);
    if (error) { showToast('Kunne ikke markere: ' + error.message, true); return; }
    await logActivity(c.id, 'markert_som_salg',
      `Markert som salg${mrr ? ` — ${Math.round(mrr).toLocaleString('nb-NO')} kr MRR` : ''}${grunnlag ? ` (tilbud ${grunnlag.ref})` : ''}`,
      grunnlag?.id ?? null);
    showToast('Markert som salg 🏆');
    await refreshAll();
    await render();
  });

  $('#kortSendOnboarding')?.addEventListener('click', async () => {
    if (!confirm(`Send ${c.name} til onboarding? Ove får automatisk e-post med salgsinformasjonen.`)) return;
    const btn = $('#kortSendOnboarding');
    btn.disabled = true; btn.textContent = 'Sender…';
    const { data, error } = await supabase.functions.invoke('send-onboarding', {
      body: { company_id: c.id },
    });
    btn.disabled = false; btn.textContent = 'Send til onboarding';
    if (error || data?.error) {
      showToast('Kunne ikke sende: ' + (error?.message || data?.error), true);
      return;
    }
    showToast(data?.mailed ? 'Sendt til onboarding — Ove er varslet 🚀' : 'Sendt til onboarding (e-post til Ove feilet — gi beskjed manuelt)');
    await refreshAll();
    await render();
  });
}

function renderEpost(tilbud, epost) {
  if (!tilbud.length) return '<p class="muted">Ingen e-poster sendt.</p>';
  const t = tilbud[0];

  // Grunnlinje fra tilbudsstatusen (fungerer uten webhooks)
  const rader = [];
  if (t.sent_at) rader.push(['✉️ Tilbud sendt', fmtDateTime(t.sent_at)]);

  const forOffer = epost.filter((e) => e.offer_id === t.id);
  const delivered = forOffer.find((e) => e.event === 'delivered');
  const opens = forOffer.filter((e) => e.event === 'opened');
  const clicks = forOffer.filter((e) => e.event === 'clicked');
  const bounced = forOffer.find((e) => e.event === 'bounced');

  if (delivered) rader.push(['✓ Levert', fmtDateTime(delivered.created_at)]);
  if (bounced) rader.push(['⚠️ Avvist (bounce)', fmtDateTime(bounced.created_at)]);
  if (opens.length) {
    rader.push(['👁 Første åpning', fmtDateTime(opens[0].created_at)]);
    rader.push(['👁 Sist åpnet', fmtDateTime(opens[opens.length - 1].created_at)]);
    rader.push(['Antall åpninger', String(opens.length)]);
  }
  if (clicks.length) rader.push(['🔗 Lenke klikket', fmtDateTime(clicks[0].created_at)]);
  if (['viewed', 'accepted', 'declined'].includes(t.status)) {
    rader.push(['🔗 Tilbudssiden åpnet', 'Ja']);
  }
  if (t.status === 'accepted') rader.push(['✅ Akseptert', t.accepted_at ? fmtDateTime(t.accepted_at) : 'Ja']);
  if (t.status === 'declined') rader.push(['↩ Avslått via lenken', 'Ja']);

  return `<table class="kv">${rader.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    <p class="muted" style="margin-top:8px">Åpning er et signal, ikke bevis på at e-posten er lest.</p>`;
}

// Fra CSV-import av Brønnøysund-uttrekk (samme kilde som salgsverktøyets
// prospektliste). Viser siste tilgjengelige regnskapsår + nøkkeltall.
function renderRegnskap(c) {
  const finans = c.financials || {};
  const ar = Object.keys(finans).sort().reverse();
  const harNokkeltall = c.soliditet != null || c.likviditet != null || c.lonnsomhet != null;
  if (!ar.length && !harNokkeltall) {
    return '<p class="muted">Ingen regnskapstall importert. Kommer inn via CSV-import i Ringeliste.</p>';
  }

  const rader = [];
  if (ar.length) {
    const f = finans[ar[0]];
    rader.push([`Omsetning ${ar[0]}`, fmtKr(f.driftsinntekter)]);
    rader.push(['Driftsresultat', fmtKr(f.driftsresultat)]);
    if (f.margin != null) rader.push(['Margin', fmtPct(f.margin)]);
    if (f.lonn != null) rader.push(['Lønnskostnad', fmtKr(f.lonn)]);
    if (f.lonnsandel != null) rader.push(['Lønnsandel', fmtPct(f.lonnsandel, 0)]);
  }
  if (c.ansatte != null) rader.push(['Ansatte', c.ansatte]);
  if (c.soliditet != null) rader.push(['Soliditet', fmtPct(c.soliditet, 2)]);
  if (c.likviditet != null) rader.push(['Likviditetsgrad', c.likviditet.toFixed(2)]);
  if (c.lonnsomhet != null) rader.push(['Lønnsomhet', fmtPct(c.lonnsomhet, 2)]);
  if (c.revisor) rader.push(['Revisor', escapeHtml(c.revisor)]);
  if (c.regnskapsforer) rader.push(['Regnskapsfører', escapeHtml(c.regnskapsforer)]);

  const historikk = ar.length > 1
    ? `<p class="muted" style="margin-top:8px">Tall finnes også for ${ar.slice(1).join(', ')}.</p>`
    : '';
  return `<table class="kv">${rader.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>${historikk}`;
}

function fmtPct(v, dec = 1) {
  if (v == null) return '–';
  return Number(v).toLocaleString('nb-NO', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' %';
}

export function initKundekort() {
  window.addEventListener('open-kundekort', (e) => openKundekort(e.detail.companyId));
}
