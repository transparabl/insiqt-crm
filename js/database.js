import { supabase } from './supabase-client.js';
import { showToast } from './app.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function getViews(page) {
  return (page.table_views && page.table_views.length) ? page.table_views : [{ id: 'table', name: 'Tabell', type: 'table' }];
}

export function renderViewTabs(views, activeViewId) {
  return `<div class="view-tabs">
    ${views.map((v) => `<button type="button" class="view-tab ${v.id === activeViewId ? 'active' : ''}" data-view="${v.id}">${escapeHtml(v.name)}</button>`).join('')}
    <button type="button" class="view-tab-add" id="addViewBtn">+ Visning</button>
  </div>`;
}

export function renderBoardView(page, view) {
  const cols = page.table_columns || [];
  const groupCol = cols.find((c) => c.key === view.group_by);
  const previewCols = cols.filter((c) => c.key !== view.group_by).slice(0, 2);
  const groupValues = (groupCol && groupCol.options) || [];
  const rows = (page.table_rows || []).map((r, i) => ({ ...r, __i: i }));

  const buckets = {};
  groupValues.forEach((v) => { buckets[v] = []; });
  buckets.__none__ = [];
  rows.forEach((r) => {
    const v = r[view.group_by];
    (buckets[v] ? buckets[v] : buckets.__none__).push(r);
  });

  const columnKeys = [...groupValues, '__none__'];

  return `<div class="board-wrap-inline"><div class="board">
    ${columnKeys.map((key) => `
      <div class="column">
        <div class="column-head">
          <h3>${key === '__none__' ? 'Ingen verdi' : escapeHtml(key)}</h3>
          <span class="column-count">${buckets[key].length}</span>
        </div>
        <div class="column-body" data-group="${escapeHtml(key)}">
          ${buckets[key].length
            ? buckets[key].map((r) => `
              <div class="lead-card db-card" draggable="true" data-row="${r.__i}">
                ${previewCols.map((c) => `<div class="contact">${escapeHtml(String(r[c.key] ?? '') || '–')}</div>`).join('')}
              </div>`).join('')
            : '<div class="empty-col">Ingen rader</div>'}
        </div>
      </div>`).join('')}
  </div></div>`;
}

export function wireBoardView(container, page, view, onChanged) {
  container.querySelectorAll('.db-card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.row);
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  container.querySelectorAll('.column-body').forEach((body) => {
    body.addEventListener('dragover', (e) => { e.preventDefault(); body.classList.add('drag-over'); });
    body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
    body.addEventListener('drop', async (e) => {
      e.preventDefault();
      body.classList.remove('drag-over');
      const rowIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const groupKey = body.dataset.group;
      const rows = (page.table_rows || []).map((r) => ({ ...r }));
      if (!rows[rowIndex]) return;
      rows[rowIndex][view.group_by] = groupKey === '__none__' ? null : groupKey;

      const { error } = await supabase.from('wiki_pages').update({ table_rows: rows }).eq('id', page.id);
      if (error) { showToast('Kunne ikke flytte rad: ' + error.message, true); return; }
      await onChanged();
    });
  });
}

export async function addBoardView(page, onChanged) {
  const selectCols = (page.table_columns || []).filter((c) => c.type === 'select');
  if (!selectCols.length) { showToast('Ingen kolonner egnet for tavlevisning (må være type «select»)', true); return; }

  const colList = selectCols.map((c) => c.label).join(', ');
  const chosen = prompt(`Grupper etter hvilken kolonne?\n${colList}`);
  if (!chosen) return;
  const col = selectCols.find((c) => c.label.toLowerCase() === chosen.trim().toLowerCase());
  if (!col) { showToast('Fant ikke den kolonnen', true); return; }

  const name = prompt('Navn på visningen:', 'Tavle');
  if (!name) return;

  const views = getViews(page);
  const newViews = [...views, { id: crypto.randomUUID(), name: name.trim(), type: 'board', group_by: col.key }];

  const { error } = await supabase.from('wiki_pages').update({ table_views: newViews }).eq('id', page.id);
  if (error) { showToast('Kunne ikke legge til visning: ' + error.message, true); return; }
  showToast('Visning lagt til');
  await onChanged(newViews[newViews.length - 1].id);
}
