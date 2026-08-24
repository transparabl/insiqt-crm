import { supabase } from './supabase-client.js';
import { session } from './session.js';

// Kanban viser løpet frem til salg. Won/onboarding/aktiv/tapt bor i egne moduler.
export const PIPELINE_COLUMNS = [
  { key: 'lead', label: 'Lead' },
  { key: 'kontaktet', label: 'Kontaktet' },
  { key: 'demo_avtalt', label: 'Demo avtalt' },
  { key: 'demo_gjennomfort', label: 'Demo gjennomført' },
  { key: 'tilbud_sendt', label: 'Tilbud sendt' },
  { key: 'oppfolging', label: 'Oppfølging' },
];

export const STATUS_LABELS = {
  lead: 'Lead',
  kontaktet: 'Kontaktet',
  demo_avtalt: 'Demo avtalt',
  demo_gjennomfort: 'Demo gjennomført',
  tilbud_sendt: 'Tilbud sendt',
  oppfolging: 'Oppfølging',
  won: 'Won',
  onboarding: 'Onboarding',
  aktiv_kunde: 'Aktiv kunde',
  lost: 'Tapt',
};

export const SOURCE_LABELS = {
  website_demo: 'Website Demo',
  'cal.com': 'Demo booket (Cal.com)',
  manual: 'Manuell',
  field_visit: 'Bedriftsbesøk',
  cold_call: 'Kald oppringing',
  referral: 'Referanse',
  salgsverktoy: 'Salgsverktøyet',
  other: 'Annet',
};

export const ACTIVITY_LABELS = {
  lead_opprettet: 'Lead opprettet',
  kontaktet: 'Kontaktet',
  demo_booket: 'Demo booket',
  demo_gjennomfort: 'Demo gjennomført',
  tilbud_sendt: 'Tilbud sendt',
  tilbud_apnet: 'Tilbud åpnet',
  akseptert: 'Tilbud akseptert',
  avslatt: 'Tilbud avslått',
  markert_som_salg: 'Markert som salg',
  sendt_til_onboarding: 'Sendt til onboarding',
  onboarding_status: 'Onboarding',
  status_change: 'Statusendring',
  call: 'Samtale',
  email: 'E-post',
  meeting: 'Møte',
  demo: 'Demo',
  note: 'Notat',
};

export const state = {
  companies: [],
  contacts: {},        // company_id -> [contacts]
  activeCompanyId: null,
};

const $ = (sel) => document.querySelector(sel);

export function statusLabel(key) {
  return STATUS_LABELS[key] || key;
}

export function tempIcon(c) {
  return c.lead_temp === 'varm' ? '🔥' : c.lead_temp === 'kald' ? '❄️' : '';
}

export function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(d) {
  return new Date(d).toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtKr(v) {
  if (v == null) return '–';
  return Math.round(Number(v)).toLocaleString('nb-NO') + ' kr';
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

export function showToast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

export async function logActivity(companyId, type, note, offerId = null) {
  await supabase.from('company_activities').insert({
    company_id: companyId,
    offer_id: offerId,
    type,
    note,
    actor: session.email,
  });
}

// ─── Data loading ──────────────────────────────────────────────
const listeners = [];
export function onCompaniesChanged(fn) { listeners.push(fn); }

export async function refreshAll() {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    showToast('Kunne ikke hente selskaper: ' + error.message, true);
    return;
  }
  state.companies = data || [];
  renderBoard();
  listeners.forEach((fn) => { try { fn(); } catch (_) { /* modulfeil skal ikke rive resten */ } });
}

export async function primaryContact(companyId) {
  if (!state.contacts[companyId]) {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    state.contacts[companyId] = data || [];
  }
  return state.contacts[companyId][0] || null;
}

// ─── Board rendering ───────────────────────────────────────────
function renderBoard() {
  const board = $('#board');
  board.innerHTML = PIPELINE_COLUMNS.map((col) => `
    <div class="column">
      <div class="column-head">
        <h3>${col.label}</h3>
        <span class="column-count" id="count-${col.key}">0</span>
      </div>
      <div class="column-body" data-status="${col.key}" id="col-${col.key}"></div>
    </div>
  `).join('');

  PIPELINE_COLUMNS.forEach((col) => {
    const body = $(`#col-${col.key}`);
    const companies = state.companies.filter((c) => c.status === col.key);
    $(`#count-${col.key}`).textContent = companies.length;

    if (companies.length === 0) {
      body.innerHTML = '<div class="empty-col">Ingen selskaper</div>';
    } else {
      companies.forEach((c) => body.appendChild(buildCard(c)));
    }

    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      body.classList.add('drag-over');
    });
    body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
    body.addEventListener('drop', async (e) => {
      e.preventDefault();
      body.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      await moveCompany(id, col.key);
    });
  });
}

function followupBadge(c) {
  if (!c.next_activity_at) return '';
  const due = new Date(c.next_activity_at);
  const diffDays = Math.round((due - Date.now()) / 86400000);
  let cls = '';
  if (diffDays < 0) cls = 'overdue';
  else if (diffDays <= 3) cls = 'soon';
  return `<span class="badge ${cls}">${fmtDate(c.next_activity_at)}</span>`;
}

function buildCard(c) {
  const card = document.createElement('div');
  card.className = 'lead-card';
  card.draggable = true;
  card.innerHTML = `
    <div class="company">${tempIcon(c)} ${escapeHtml(c.name)}</div>
    <div class="contact">${escapeHtml(c.next_activity || SOURCE_LABELS[c.lead_source] || '')}</div>
    <div class="meta-row">
      <span class="badge">${c.vehicle_count != null ? c.vehicle_count + ' kjøretøy' : '–'}</span>
      ${followupBadge(c)}
    </div>
  `;
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', c.id);
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
  card.addEventListener('click', () => window.dispatchEvent(
    new CustomEvent('open-kundekort', { detail: { companyId: c.id } }),
  ));
  return card;
}

export async function moveCompany(id, newStatus) {
  const c = state.companies.find((x) => x.id === id);
  if (!c || c.status === newStatus) return;
  const oldStatus = c.status;

  const { error } = await supabase.from('companies').update({ status: newStatus }).eq('id', id);
  if (error) { showToast('Kunne ikke flytte: ' + error.message, true); return; }

  await logActivity(id, 'status_change', `Flyttet fra ${statusLabel(oldStatus)} til ${statusLabel(newStatus)}`);
  await refreshAll();
}

// ─── Modal: nytt/rediger selskap ───────────────────────────────
function emptyCompany() {
  return {
    id: null, name: '', org_no: '', place: '', vehicle_count: '',
    lead_temp: 'kald', lead_source: '', status: 'lead',
    next_activity: '', next_activity_at: null,
  };
}

export async function openCompanyModal(companyId) {
  state.activeCompanyId = companyId;
  const c = companyId ? state.companies.find((x) => x.id === companyId) : emptyCompany();
  const kontakt = companyId ? await primaryContact(companyId) : null;

  $('#modalTitle').textContent = companyId ? 'Rediger selskap' : 'Legg til lead';
  $('#companyName').value = c.name || '';
  $('#orgNo').value = c.org_no || '';
  $('#companyPlace').value = c.place || '';
  $('#vehicleCount').value = c.vehicle_count ?? '';
  $('#contactName').value = kontakt?.name || '';
  $('#contactRole').value = kontakt?.role || '';
  $('#contactEmail').value = kontakt?.email || '';
  $('#contactPhone').value = kontakt?.phone || '';
  $('#leadTemp').value = c.lead_temp || 'kald';
  $('#leadSource').value = c.lead_source || '';
  $('#leadStatus').value = c.status || 'lead';
  $('#nextActivity').value = c.next_activity || '';
  $('#nextActivityAt').value = c.next_activity_at
    ? new Date(new Date(c.next_activity_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';

  $('#deleteLeadBtn').style.display = companyId ? 'inline-flex' : 'none';
  $('#modalOverlay').classList.add('active');
}

function closeModal() {
  $('#modalOverlay').classList.remove('active');
  state.activeCompanyId = null;
}

// ─── Wiring (kalles én gang av shell.js etter innlogging) ──────
export function initPipeline() {
  $('#closeModalBtn').addEventListener('click', closeModal);
  $('#modalOverlay').addEventListener('click', (e) => { if (e.target.id === 'modalOverlay') closeModal(); });
  $('#newLeadBtn').addEventListener('click', () => openCompanyModal(null));

  $('#leadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: $('#companyName').value.trim(),
      org_no: $('#orgNo').value.replace(/\D/g, '') || null,
      place: $('#companyPlace').value.trim() || null,
      vehicle_count: $('#vehicleCount').value ? parseInt($('#vehicleCount').value, 10) : null,
      lead_temp: $('#leadTemp').value || null,
      lead_source: $('#leadSource').value || null,
      status: $('#leadStatus').value,
      next_activity: $('#nextActivity').value.trim() || null,
      next_activity_at: $('#nextActivityAt').value ? new Date($('#nextActivityAt').value).toISOString() : null,
      assigned_to: session.email,
    };
    if (!payload.name) { showToast('Firmanavn er påkrevd', true); return; }

    const kontakt = {
      name: $('#contactName').value.trim() || null,
      role: $('#contactRole').value.trim() || null,
      email: $('#contactEmail').value.trim() || null,
      phone: $('#contactPhone').value.trim() || null,
    };
    const harKontakt = kontakt.name || kontakt.email || kontakt.phone;

    if (state.activeCompanyId) {
      const old = state.companies.find((x) => x.id === state.activeCompanyId);
      const { error } = await supabase.from('companies').update(payload).eq('id', state.activeCompanyId);
      if (error) { showToast('Kunne ikke lagre: ' + error.message, true); return; }

      if (harKontakt) {
        const eksisterende = await primaryContact(state.activeCompanyId);
        if (eksisterende) {
          await supabase.from('contacts').update(kontakt).eq('id', eksisterende.id);
        } else {
          await supabase.from('contacts').insert({ ...kontakt, company_id: state.activeCompanyId, is_primary: true });
        }
        delete state.contacts[state.activeCompanyId];
      }

      if (old && old.status !== payload.status) {
        await logActivity(state.activeCompanyId, 'status_change',
          `Flyttet fra ${statusLabel(old.status)} til ${statusLabel(payload.status)}`);
      }
      showToast('Selskap oppdatert');
    } else {
      const { data, error } = await supabase.from('companies').insert(payload).select('id').single();
      if (error) { showToast('Kunne ikke opprette: ' + error.message, true); return; }
      if (harKontakt) {
        await supabase.from('contacts').insert({ ...kontakt, company_id: data.id, is_primary: true });
      }
      await logActivity(data.id, 'lead_opprettet',
        `${payload.lead_temp === 'varm' ? 'Varm' : 'Kald'} lead opprettet (${SOURCE_LABELS[payload.lead_source] || 'ukjent kilde'})`);
      showToast('Lead opprettet');
    }

    closeModal();
    await refreshAll();
  });

  $('#deleteLeadBtn').addEventListener('click', async () => {
    if (!state.activeCompanyId) return;
    if (!confirm('Slette dette selskapet permanent? Historikken slettes også.')) return;
    const { error } = await supabase.from('companies').delete().eq('id', state.activeCompanyId);
    if (error) { showToast('Kunne ikke slette: ' + error.message, true); return; }
    showToast('Selskap slettet');
    closeModal();
    await refreshAll();
  });

  refreshAll();
}
