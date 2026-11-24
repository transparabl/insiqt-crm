// Salg-, Onboarding- og Kunder-modulene. Alle leser state fra app.js og
// åpner kundekortet ved klikk.
import { supabase } from './supabase-client.js';
import {
  state, onCompaniesChanged, fmtDate, fmtKr, escapeHtml, tempIcon,
  showToast, logActivity, refreshAll,
} from './app.js';

const $ = (sel) => document.querySelector(sel);

const ONBOARDING_STEG = [
  ['ny', 'Ny onboarding'],
  ['kontaktet', 'Kontaktet'],
  ['mote_avtalt', 'Onboarding-møte avtalt'],
  ['oppsett', 'Integrasjoner og oppsett'],
  ['opplaering', 'Opplæring'],
  ['ferdig', 'Ferdig'],
];

function apneKort(id) {
  window.dispatchEvent(new CustomEvent('open-kundekort', { detail: { companyId: id } }));
}

// ─── Salg ──────────────────────────────────────────────────────
function renderSalg() {
  const won = state.companies
    .filter((c) => c.status === 'won')
    .sort((a, b) => new Date(b.won_at || 0) - new Date(a.won_at || 0));

  const el = $('#salgList');
  if (!won.length) {
    el.innerHTML = '<div class="empty-col">Ingen vunne salg som venter på onboarding. De som er sendt videre ligger under Onboarding.</div>';
    return;
  }

  el.innerHTML = won.map((c) => `
    <div class="list-card" data-id="${c.id}">
      <div class="list-main">
        <div class="list-title">${tempIcon(c)} ${escapeHtml(c.name)}</div>
        <div class="list-sub">
          ${c.mrr ? `<b>${fmtKr(c.mrr)} MRR</b> · ` : ''}
          ${c.vehicle_count != null ? `${c.vehicle_count} kjøretøy · ` : ''}
          Solgt av: ${escapeHtml((c.assigned_to || '–').split('@')[0])} ·
          Salgsdato: ${c.won_at ? fmtDate(c.won_at) : '–'}
        </div>
      </div>
      <div class="list-side">
        <span class="pill status-won">Klar for onboarding</span>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.list-card').forEach((card) => {
    card.addEventListener('click', () => apneKort(card.dataset.id));
  });
}

// ─── Onboarding ────────────────────────────────────────────────
function renderOnboarding() {
  const inne = state.companies
    .filter((c) => c.status === 'onboarding')
    .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));

  const el = $('#onboardingList');
  if (!inne.length) {
    el.innerHTML = '<div class="empty-col">Ingen kunder i onboarding.</div>';
    return;
  }

  el.innerHTML = inne.map((c) => {
    const stegIdx = Math.max(0, ONBOARDING_STEG.findIndex(([k]) => k === (c.onboarding_status || 'ny')));
    return `
    <div class="list-card block" data-id="${c.id}">
      <div class="list-main" data-open="${c.id}">
        <div class="list-title">${escapeHtml(c.name)}</div>
        <div class="list-sub">
          Ansvarlig: ${escapeHtml((c.onboarding_owner || 'Ove').split('@')[0])}
          ${c.next_activity ? ` · Neste: ${escapeHtml(c.next_activity)}${c.next_activity_at ? ' ' + fmtDate(c.next_activity_at) : ''}` : ''}
        </div>
      </div>
      <div class="stepper">
        ${ONBOARDING_STEG.map(([key, label], i) => `
          <button class="step ${i < stegIdx ? 'done' : ''} ${i === stegIdx ? 'active' : ''}"
                  data-company="${c.id}" data-steg="${key}" title="${label}">
            ${i < stegIdx ? '✓' : i + 1}<span class="step-label">${label}</span>
          </button>`).join('')}
      </div>
      ${c.onboarding_status === 'ferdig'
        ? `<button class="btn" style="margin-top:10px" data-aktiver="${c.id}">Gjør til aktiv kunde</button>`
        : ''}
    </div>`;
  }).join('');

  el.querySelectorAll('[data-open]').forEach((n) => {
    n.addEventListener('click', () => apneKort(n.dataset.open));
  });

  el.querySelectorAll('.step').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.company;
      const steg = btn.dataset.steg;
      const c = state.companies.find((x) => x.id === id);
      if (!c || c.onboarding_status === steg) return;
      const label = ONBOARDING_STEG.find(([k]) => k === steg)?.[1] || steg;
      const { error } = await supabase.from('companies').update({ onboarding_status: steg }).eq('id', id);
      if (error) { showToast('Kunne ikke oppdatere: ' + error.message, true); return; }
      await logActivity(id, 'onboarding_status', `Onboarding: ${label}`);
      await refreshAll();
    });
  });

  el.querySelectorAll('[data-aktiver]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.aktiver;
      const { error } = await supabase.from('companies').update({
        status: 'aktiv_kunde',
        next_activity: null,
        next_activity_at: null,
      }).eq('id', id);
      if (error) { showToast('Kunne ikke oppdatere: ' + error.message, true); return; }
      await logActivity(id, 'status_change', 'Onboarding ferdig — aktiv kunde 🎉');
      showToast('Aktiv kunde 🎉');
      await refreshAll();
    });
  });
}

// ─── Kunder ────────────────────────────────────────────────────
function renderKunder() {
  const sok = ($('#kundeSok').value || '').toLowerCase().trim();
  const filter = $('#kundeFilter').value;

  let liste = state.companies;
  if (filter === 'aktiv_kunde') liste = liste.filter((c) => c.status === 'aktiv_kunde');
  if (sok) {
    liste = liste.filter((c) =>
      c.name.toLowerCase().includes(sok) ||
      (c.org_no || '').includes(sok) ||
      (c.place || '').toLowerCase().includes(sok));
  }

  const el = $('#kunderList');
  if (!liste.length) {
    el.innerHTML = `<div class="empty-col">${filter === 'aktiv_kunde' ? 'Ingen aktive kunder ennå.' : 'Ingen treff.'}</div>`;
    return;
  }

  el.innerHTML = [...liste]
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
    .map((c) => `
    <div class="list-card" data-id="${c.id}">
      <div class="list-main">
        <div class="list-title">${tempIcon(c)} ${escapeHtml(c.name)}</div>
        <div class="list-sub">
          ${escapeHtml(c.place || '')}${c.org_no ? ` · ${escapeHtml(c.org_no)}` : ''}
          ${c.vehicle_count != null ? ` · ${c.vehicle_count} kjøretøy` : ''}
          ${c.mrr ? ` · ${fmtKr(c.mrr)} MRR` : ''}
        </div>
      </div>
      <div class="list-side"><span class="pill status-${c.status}">${escapeHtml(
        c.status === 'aktiv_kunde' ? 'Aktiv kunde' : c.status,
      )}</span></div>
    </div>
  `).join('');

  el.querySelectorAll('.list-card').forEach((card) => {
    card.addEventListener('click', () => apneKort(card.dataset.id));
  });
}

export function initModuler() {
  $('#kundeSok').addEventListener('input', renderKunder);
  $('#kundeFilter').addEventListener('change', renderKunder);
  onCompaniesChanged(() => {
    renderSalg();
    renderOnboarding();
    renderKunder();
  });
}
