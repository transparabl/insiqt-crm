import { supabase } from './supabase-client.js';
import { session } from './session.js';

const COLUMNS = [
  { key: 'ny', label: 'Ny lead' },
  { key: 'kontaktet', label: 'Kontaktet' },
  { key: 'demo_booket', label: 'Demo booket' },
  { key: 'tilbud_sendt', label: 'Tilbud sendt' },
  { key: 'kunde', label: 'Kunde' },
  { key: 'tapt', label: 'Tapt' },
];

const SOURCE_LABELS = {
  kald_kontakt: 'Kald kontakt',
  linkedin: 'LinkedIn',
  demo_forespørsel: 'Demo-forespørsel',
  referanse: 'Referanse',
  annet: 'Annet',
};

const ACTIVITY_LABELS = {
  call: 'Samtale',
  email: 'E-post',
  meeting: 'Møte',
  demo: 'Demo',
  note: 'Notat',
  status_change: 'Statusendring',
};

const state = {
  leads: [],
  activeLeadId: null, // null = new lead
};

const $ = (sel) => document.querySelector(sel);

function statusLabel(key) {
  return COLUMNS.find((c) => c.key === key)?.label || key;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(d) {
  return new Date(d).toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function showToast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── Data loading ──────────────────────────────────────────────
export async function refreshAll() {
  await loadLeads();
  await loadDashboard();
}

async function loadLeads() {
  const { data, error } = await supabase
    .from('crm_leads')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    showToast('Kunne ikke hente leads: ' + error.message, true);
    return;
  }
  state.leads = data || [];
  renderBoard();
}

async function loadDashboard() {
  const counts = Object.fromEntries(COLUMNS.map((c) => [c.key, 0]));
  state.leads.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });

  $('#dashboard').innerHTML = COLUMNS.map((c) => `
    <div class="stat-card ${c.key === 'kunde' ? 'success' : ''}">
      <div class="n">${counts[c.key] || 0}</div>
      <div class="l">${c.label}</div>
    </div>
  `).join('') + `
    <div class="stat-card accent">
      <div class="n" id="demosThisMonthN">…</div>
      <div class="l">Demoer booket denne måneden</div>
    </div>
  `;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('crm_activities')
    .select('id', { count: 'exact', head: true })
    .eq('activity_type', 'status_change')
    .ilike('note', '%Demo booket%')
    .gte('created_at', startOfMonth.toISOString());

  $('#demosThisMonthN').textContent = error ? '–' : count;
}

// ─── Board rendering ───────────────────────────────────────────
function renderBoard() {
  const board = $('#board');
  board.innerHTML = COLUMNS.map((col) => `
    <div class="column">
      <div class="column-head">
        <h3>${col.label}</h3>
        <span class="column-count" id="count-${col.key}">0</span>
      </div>
      <div class="column-body" data-status="${col.key}" id="col-${col.key}"></div>
    </div>
  `).join('');

  COLUMNS.forEach((col) => {
    const body = $(`#col-${col.key}`);
    const leads = state.leads.filter((l) => l.status === col.key);
    $(`#count-${col.key}`).textContent = leads.length;

    if (leads.length === 0) {
      body.innerHTML = '<div class="empty-col">Ingen leads</div>';
    } else {
      leads.forEach((lead) => body.appendChild(buildCard(lead)));
    }

    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      body.classList.add('drag-over');
    });
    body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
    body.addEventListener('drop', async (e) => {
      e.preventDefault();
      body.classList.remove('drag-over');
      const leadId = e.dataTransfer.getData('text/plain');
      await moveLead(leadId, col.key);
    });
  });
}

function followupBadge(lead) {
  if (!lead.next_followup_date) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(lead.next_followup_date + 'T00:00:00');
  const diffDays = Math.round((due - today) / 86400000);
  let cls = '';
  if (diffDays < 0) cls = 'overdue';
  else if (diffDays <= 3) cls = 'soon';
  return `<span class="badge ${cls}">${fmtDate(lead.next_followup_date)}</span>`;
}

function buildCard(lead) {
  const card = document.createElement('div');
  card.className = 'lead-card';
  card.draggable = true;
  card.innerHTML = `
    <div class="company">${escapeHtml(lead.company_name)}</div>
    <div class="contact">${escapeHtml(lead.contact_name || 'Ingen kontaktperson')}</div>
    <div class="meta-row">
      <span class="badge">${lead.vehicle_count != null ? lead.vehicle_count + ' kjøretøy' : '–'}</span>
      ${followupBadge(lead)}
    </div>
  `;
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', lead.id);
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
  card.addEventListener('click', () => openLeadModal(lead.id));
  return card;
}

async function moveLead(leadId, newStatus) {
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead || lead.status === newStatus) return;
  const oldStatus = lead.status;

  const { error } = await supabase.from('crm_leads').update({ status: newStatus }).eq('id', leadId);
  if (error) { showToast('Kunne ikke flytte lead: ' + error.message, true); return; }

  await supabase.from('crm_activities').insert({
    lead_id: leadId,
    activity_type: 'status_change',
    note: `Flyttet fra ${statusLabel(oldStatus)} til ${statusLabel(newStatus)}`,
    created_by: session.email,
  });

  await refreshAll();
}

// ─── Modal: lead details / new lead ─────────────────────────────
function emptyLead() {
  return { id: null, company_name: '', contact_name: '', contact_email: '', contact_phone: '', vehicle_count: '', status: 'ny', source: '', next_followup_date: '' };
}

async function openLeadModal(leadId) {
  state.activeLeadId = leadId;
  const lead = leadId ? state.leads.find((l) => l.id === leadId) : emptyLead();

  $('#modalTitle').textContent = leadId ? 'Rediger lead' : 'Ny lead';
  $('#companyName').value = lead.company_name || '';
  $('#contactName').value = lead.contact_name || '';
  $('#contactEmail').value = lead.contact_email || '';
  $('#contactPhone').value = lead.contact_phone || '';
  $('#vehicleCount').value = lead.vehicle_count ?? '';
  $('#leadStatus').value = lead.status || 'ny';
  $('#leadSource').value = lead.source || '';
  $('#followupDate').value = lead.next_followup_date || '';

  $('#deleteLeadBtn').style.display = leadId ? 'inline-flex' : 'none';
  $('#activitySection').style.display = leadId ? 'block' : 'none';

  if (leadId) await loadActivities(leadId);

  $('#modalOverlay').classList.add('active');
}

function closeModal() {
  $('#modalOverlay').classList.remove('active');
  state.activeLeadId = null;
}

// ─── Activity log ────────────────────────────────────────────
async function loadActivities(leadId) {
  const { data, error } = await supabase
    .from('crm_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  const list = $('#activityList');
  if (error) { list.innerHTML = '<div class="empty-col">Kunne ikke hente logg</div>'; return; }
  if (!data || data.length === 0) { list.innerHTML = '<div class="empty-col">Ingen aktivitet enda</div>'; return; }

  list.innerHTML = data.map((a) => `
    <div class="activity-item">
      <span class="a-type">${ACTIVITY_LABELS[a.activity_type] || a.activity_type}</span>
      <span class="a-time">${fmtDateTime(a.created_at)}</span>
      <div class="a-note">${escapeHtml(a.note || '')}</div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Wiring (called once by shell.js after login) ────────────────
export function initPipeline() {
  $('#closeModalBtn').addEventListener('click', closeModal);
  $('#modalOverlay').addEventListener('click', (e) => { if (e.target.id === 'modalOverlay') closeModal(); });
  $('#newLeadBtn').addEventListener('click', () => openLeadModal(null));

  $('#leadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      company_name: $('#companyName').value.trim(),
      contact_name: $('#contactName').value.trim() || null,
      contact_email: $('#contactEmail').value.trim() || null,
      contact_phone: $('#contactPhone').value.trim() || null,
      vehicle_count: $('#vehicleCount').value ? parseInt($('#vehicleCount').value, 10) : null,
      status: $('#leadStatus').value,
      source: $('#leadSource').value || null,
      next_followup_date: $('#followupDate').value || null,
    };

    if (!payload.company_name) { showToast('Firmanavn er påkrevd', true); return; }

    if (state.activeLeadId) {
      const oldLead = state.leads.find((l) => l.id === state.activeLeadId);
      const { error } = await supabase.from('crm_leads').update(payload).eq('id', state.activeLeadId);
      if (error) { showToast('Kunne ikke lagre: ' + error.message, true); return; }

      if (oldLead && oldLead.status !== payload.status) {
        await supabase.from('crm_activities').insert({
          lead_id: state.activeLeadId,
          activity_type: 'status_change',
          note: `Flyttet fra ${statusLabel(oldLead.status)} til ${statusLabel(payload.status)}`,
          created_by: session.email,
        });
      }
      showToast('Lead oppdatert');
    } else {
      const { error } = await supabase.from('crm_leads').insert(payload);
      if (error) { showToast('Kunne ikke opprette: ' + error.message, true); return; }
      showToast('Lead opprettet');
    }

    closeModal();
    await refreshAll();
  });

  $('#deleteLeadBtn').addEventListener('click', async () => {
    if (!state.activeLeadId) return;
    if (!confirm('Slette denne leaden permanent?')) return;
    const { error } = await supabase.from('crm_leads').delete().eq('id', state.activeLeadId);
    if (error) { showToast('Kunne ikke slette: ' + error.message, true); return; }
    showToast('Lead slettet');
    closeModal();
    await refreshAll();
  });

  $('#addActivityBtn').addEventListener('click', async () => {
    if (!state.activeLeadId) return;
    const type = $('#activityType').value;
    const note = $('#activityNote').value.trim();
    if (!note) { showToast('Skriv en notat-tekst', true); return; }

    const { error } = await supabase.from('crm_activities').insert({
      lead_id: state.activeLeadId,
      activity_type: type,
      note,
      created_by: session.email,
    });
    if (error) { showToast('Kunne ikke legge til: ' + error.message, true); return; }

    $('#activityNote').value = '';
    await loadActivities(state.activeLeadId);
  });

  refreshAll();
}
