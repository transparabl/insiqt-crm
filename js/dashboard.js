// Dashboard: månedstall, konvertering, kilder og «Krever oppfølging».
import { supabase } from './supabase-client.js';
import {
  state, onCompaniesChanged, fmtDate, fmtKr, escapeHtml, tempIcon,
  SOURCE_LABELS, statusLabel,
} from './app.js';

const $ = (sel) => document.querySelector(sel);

function apneKort(id) {
  window.dispatchEvent(new CustomEvent('open-kundekort', { detail: { companyId: id } }));
}

async function render() {
  const naa = new Date();
  const mndStart = new Date(naa.getFullYear(), naa.getMonth(), 1).toISOString();
  const alle = state.companies;

  // Tilbudstall hentes fra offers direkte — de er sannheten om utsending
  const { data: tilbudMnd } = await supabase
    .from('offers')
    .select('id, status, sent_at, company_id')
    .gte('sent_at', mndStart);
  const tilbud = tilbudMnd || [];

  const varmeMnd = alle.filter((c) => c.lead_temp === 'varm' && c.created_at >= mndStart).length;
  const demoerMnd = await antallAktiviteter('demo_gjennomfort', mndStart);
  const tilbudSendtMnd = tilbud.length;
  const tilbudApnetMnd = tilbud.filter((t) => ['viewed', 'accepted', 'declined'].includes(t.status)).length;
  const salgMnd = alle.filter((c) => c.won_at && c.won_at >= mndStart);
  const nyMrr = salgMnd.reduce((s, c) => s + (Number(c.mrr) || 0), 0);

  $('#dashStats').innerHTML = `
    <div class="stat-card"><div class="n">${varmeMnd}</div><div class="l">Varme leads</div></div>
    <div class="stat-card"><div class="n">${demoerMnd}</div><div class="l">Demoer</div></div>
    <div class="stat-card"><div class="n">${tilbudSendtMnd}</div><div class="l">Tilbud sendt</div></div>
    <div class="stat-card"><div class="n">${tilbudApnetMnd}</div><div class="l">Tilbud åpnet</div></div>
    <div class="stat-card success"><div class="n">${salgMnd.length}</div><div class="l">Salg</div></div>
    <div class="stat-card accent"><div class="n">${Math.round(nyMrr).toLocaleString('nb-NO')}</div><div class="l">Ny MRR (NOK)</div></div>
  `;

  renderKreverOppfolging(alle);
  renderKonvertering(alle);
  renderKilder(alle);
}

async function antallAktiviteter(type, siden) {
  const { count } = await supabase
    .from('company_activities')
    .select('id', { count: 'exact', head: true })
    .eq('type', type)
    .gte('created_at', siden);
  return count ?? 0;
}

function renderKreverOppfolging(alle) {
  const naa = Date.now();
  const aktive = alle.filter((c) => !['aktiv_kunde', 'lost'].includes(c.status));
  const rader = [];

  // 1. Akseptert tilbud som ikke er markert som salg
  aktive
    .filter((c) => c.status === 'oppfolging' && (c.next_activity || '').startsWith('Marker som salg'))
    .forEach((c) => rader.push({ c, grunn: 'Tilbudet er akseptert', tiltak: 'Marker som salg', vekt: 0 }));

  // 2. Forfalt neste aktivitet
  aktive
    .filter((c) => c.next_activity && c.next_activity_at && new Date(c.next_activity_at).getTime() < naa)
    .filter((c) => !rader.some((r) => r.c.id === c.id))
    .forEach((c) => rader.push({
      c,
      grunn: `Forfalt ${fmtDate(c.next_activity_at)}`,
      tiltak: c.next_activity,
      vekt: 1,
    }));

  // 3. Aktive leads uten neste aktivitet
  aktive
    .filter((c) => c.status !== 'won' && !c.next_activity)
    .filter((c) => !rader.some((r) => r.c.id === c.id))
    .forEach((c) => rader.push({
      c,
      grunn: `${statusLabel(c.status)} uten neste aktivitet`,
      tiltak: 'Sett neste aktivitet',
      vekt: 2,
    }));

  // 4. Vunnet, men ikke sendt til onboarding
  alle
    .filter((c) => c.status === 'won')
    .filter((c) => !rader.some((r) => r.c.id === c.id))
    .forEach((c) => rader.push({ c, grunn: 'Salg registrert', tiltak: 'Send til onboarding', vekt: 1 }));

  rader.sort((a, b) => a.vekt - b.vekt);

  const el = $('#dashFollowup');
  if (!rader.length) {
    el.innerHTML = '<div class="empty-col">Alt er fulgt opp 👌</div>';
    return;
  }
  el.innerHTML = rader.slice(0, 10).map(({ c, grunn, tiltak }) => `
    <div class="list-card" data-id="${c.id}">
      <div class="list-main">
        <div class="list-title">${tempIcon(c)} ${escapeHtml(c.name)}</div>
        <div class="list-sub">${escapeHtml(grunn)}</div>
      </div>
      <div class="list-side"><span class="pill action">→ ${escapeHtml(tiltak)}</span></div>
    </div>
  `).join('');
  el.querySelectorAll('.list-card').forEach((card) => {
    card.addEventListener('click', () => apneKort(card.dataset.id));
  });
}

function renderKonvertering(alle) {
  // Livssyklusen er lineær: alle som har nådd et steg, har vært innom de forrige.
  const naadd = (steg) => alle.filter((c) => {
    const rekke = ['lead', 'kontaktet', 'demo_avtalt', 'demo_gjennomfort', 'tilbud_sendt', 'oppfolging', 'won', 'onboarding', 'aktiv_kunde'];
    const i = rekke.indexOf(c.status);
    return i >= rekke.indexOf(steg) || (steg !== 'won' && ['won', 'onboarding', 'aktiv_kunde'].includes(c.status));
  }).length;

  const leads = alle.length;
  const demoer = naadd('demo_gjennomfort');
  const tilbud = naadd('tilbud_sendt');
  const salg = alle.filter((c) => ['won', 'onboarding', 'aktiv_kunde'].includes(c.status)).length;

  const pct = (a, b) => (b ? Math.round((a / b) * 100) + ' %' : '–');
  $('#dashConversion').innerHTML = `
    <table class="kv">
      <tr><td>Lead → Demo</td><td>${demoer}/${leads} · ${pct(demoer, leads)}</td></tr>
      <tr><td>Demo → Tilbud</td><td>${tilbud}/${demoer} · ${pct(tilbud, demoer)}</td></tr>
      <tr><td>Tilbud → Salg</td><td>${salg}/${tilbud} · ${pct(salg, tilbud)}</td></tr>
    </table>`;
}

function renderKilder(alle) {
  const per = {};
  alle.forEach((c) => {
    const k = c.lead_source || 'ukjent';
    per[k] = per[k] || { antall: 0, salg: 0 };
    per[k].antall++;
    if (['won', 'onboarding', 'aktiv_kunde'].includes(c.status)) per[k].salg++;
  });
  const rader = Object.entries(per).sort((a, b) => b[1].antall - a[1].antall);
  $('#dashSources').innerHTML = rader.length
    ? `<table class="kv">${rader.map(([k, v]) =>
        `<tr><td>${escapeHtml(SOURCE_LABELS[k] || k)}</td><td>${v.antall} leads · ${v.salg} salg</td></tr>`,
      ).join('')}</table>`
    : '<p class="muted">Ingen leads registrert.</p>';
}

export function initDashboard() {
  onCompaniesChanged(() => { render().catch(() => {}); });
}
