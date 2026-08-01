import { supabase } from './supabase-client.js';
import { session } from './session.js';
import { showView } from './view.js';
import { showToast } from './app.js';
import { renderBlocksReadOnly, mountBlocksEditor } from './blocks.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  pages: [],
  expanded: new Set(),
  currentPageId: null,
  editing: false,
  tableDraftRows: null,
};

let blocksEditor = null;

function discardBlocksEditor() {
  if (blocksEditor) blocksEditor.destroy();
  blocksEditor = null;
}

function childrenOf(id) {
  return state.pages
    .filter((p) => p.parent_id === id)
    .sort((a, b) => a.position - b.position);
}

function roots() {
  return state.pages
    .filter((p) => p.is_teamspace_root)
    .sort((a, b) => a.position - b.position);
}

function pageById(id) {
  return state.pages.find((p) => p.id === id);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Data loading ──────────────────────────────────────────────
async function loadPages() {
  const { data, error } = await supabase
    .from('wiki_pages')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    showToast('Kunne ikke hente wiki-sider: ' + error.message, true);
    return;
  }
  state.pages = data || [];
  renderSidebarTree();
}

// ─── Sidebar tree ──────────────────────────────────────────────
function renderSidebarTree() {
  const container = $('#sidebarTree');
  container.innerHTML = '';
  roots().forEach((root) => container.appendChild(renderTreeNode(root, 0)));
}

function renderTreeNode(page, depth) {
  const kids = childrenOf(page.id);
  const isExpanded = state.expanded.has(page.id);

  const wrap = document.createElement('div');

  const row = document.createElement('div');
  row.className = 'tree-item' + (page.id === state.currentPageId ? ' active' : '');
  row.style.paddingLeft = `${8 + depth * 16}px`;

  const arrow = document.createElement('span');
  arrow.className = 'tree-arrow';
  arrow.textContent = kids.length ? (isExpanded ? '▾' : '▸') : '';
  if (kids.length) {
    arrow.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.expanded.has(page.id)) state.expanded.delete(page.id);
      else state.expanded.add(page.id);
      renderSidebarTree();
    });
  }

  const label = document.createElement('span');
  label.className = 'tree-label';
  label.textContent = `${page.icon || '📄'} ${page.title}`;
  label.addEventListener('click', () => openPage(page.id));

  row.appendChild(arrow);
  row.appendChild(label);
  wrap.appendChild(row);

  if (kids.length && isExpanded) {
    const childWrap = document.createElement('div');
    kids.forEach((kid) => childWrap.appendChild(renderTreeNode(kid, depth + 1)));
    wrap.appendChild(childWrap);
  }

  return wrap;
}

// ─── Breadcrumb ────────────────────────────────────────────────
function breadcrumbFor(page) {
  const chain = [];
  let p = page;
  while (p) {
    chain.unshift(p);
    p = p.parent_id ? pageById(p.parent_id) : null;
  }
  return chain;
}

// ─── Page view / edit rendering ──────────────────────────────────
function openPage(id) {
  const page = pageById(id);
  if (!page) return;
  state.currentPageId = id;
  state.editing = false;
  state.tableDraftRows = null;
  discardBlocksEditor();
  showView('wiki');
  renderSidebarTree();
  renderWikiPage();
}

function headerHtml(page) {
  const crumbs = breadcrumbFor(page)
    .map((p) => `<span>${escapeHtml(p.icon || '📄')} ${escapeHtml(p.title)}</span>`)
    .join('<span class="crumb-sep">/</span>');

  const titleHtml = state.editing
    ? `<div class="wiki-edit-head">
        <input type="text" id="wikiIconInput" class="wiki-icon-input" value="${escapeHtml(page.icon || '📄')}" maxlength="4">
        <input type="text" id="wikiTitleInput" class="wiki-title-input" value="${escapeHtml(page.title)}">
      </div>`
    : `<h1><span>${escapeHtml(page.icon || '📄')}</span> ${escapeHtml(page.title)}</h1>`;

  return `
    <div class="wiki-breadcrumb">${crumbs}</div>
    <div class="wiki-header">
      ${titleHtml}
      <div class="wiki-actions">
        <button class="btn ghost" id="wikiEditBtn">${state.editing ? 'Avbryt' : 'Rediger'}</button>
        ${state.editing ? '<button class="btn" id="wikiSaveBtn">Lagre</button>' : ''}
        <button class="btn ghost" id="wikiNewChildBtn">+ Ny underside</button>
        ${page.is_teamspace_root ? '' : '<button class="btn danger" id="wikiDeleteBtn">Slett</button>'}
      </div>
    </div>
  `;
}

function childrenHtml(page) {
  const kids = childrenOf(page.id);
  if (!kids.length) return '';
  return `<div class="wiki-children">
    <div class="wiki-children-label">Undersider</div>
    ${kids.map((k) => `<div class="wiki-child-link" data-id="${k.id}">${escapeHtml(k.icon || '📄')} ${escapeHtml(k.title)}</div>`).join('')}
  </div>`;
}

function renderWikiPage() {
  const page = pageById(state.currentPageId);
  const container = $('#wikiPage');
  if (!page) { container.innerHTML = ''; return; }

  container.innerHTML = headerHtml(page)
    + (page.page_type === 'table' ? renderTableBody(page) : renderDocBody(page))
    + (state.editing ? '' : childrenHtml(page));

  wireHeaderActions(page);
  if (page.page_type === 'table') wireTableActions(page);
  else wireDocActions(page);
}

// ─── Doc (block) pages ─────────────────────────────────────────
function renderDocBody(page) {
  if (state.editing) {
    return `<div id="wikiBlocksEditRoot" class="block-list-wrap"></div>`;
  }
  return `<div class="markdown-body" id="wikiContent">${renderBlocksReadOnly(page.blocks)}</div>`;
}

function wireDocActions(page) {
  if (state.editing) {
    const root = $('#wikiBlocksEditRoot');
    if (root) blocksEditor = mountBlocksEditor(root, page);
    return;
  }

  const contentEl = $('#wikiContent');
  if (!contentEl) return;
  contentEl.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('page:')) {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openPage(href.slice('page:'.length));
      });
    } else {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

// ─── Table (tracker) pages ─────────────────────────────────────────
function cellInputHtml(col, value) {
  if (col.type === 'select') {
    const opts = (col.options || []).map((o) => `<option ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`);
    return `<select data-key="${col.key}"><option value=""></option>${opts.join('')}</select>`;
  }
  const type = col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text';
  return `<input type="${type}" data-key="${col.key}" value="${escapeHtml(value ?? '')}">`;
}

function formatCellValue(col, value) {
  if (value === null || value === undefined || value === '') return '–';
  if (col.type === 'date') return fmtDate(value);
  return escapeHtml(String(value));
}

function renderTableBody(page) {
  const cols = page.table_columns || [];

  if (state.editing) {
    const rows = state.tableDraftRows || (page.table_rows || []).map((r) => ({ ...r }));
    state.tableDraftRows = rows;

    return `
      <div class="wiki-table-wrap">
        <table class="wiki-table">
          <thead><tr>${cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}<th></th></tr></thead>
          <tbody id="wikiTableBody">
            ${rows.map((row, i) => `<tr data-row="${i}">${cols.map((c) => `<td>${cellInputHtml(c, row[c.key])}</td>`).join('')}<td><button type="button" class="row-del" data-row="${i}">×</button></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <button type="button" class="btn ghost" id="wikiAddRowBtn" style="margin-top:10px">+ Ny rad</button>
    `;
  }

  const rows = page.table_rows || [];
  return `
    <div class="wiki-table-wrap">
      <table class="wiki-table">
        <thead><tr>${cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.length
            ? rows.map((row) => `<tr>${cols.map((c) => `<td>${formatCellValue(c, row[c.key])}</td>`).join('')}</tr>`).join('')
            : `<tr><td colspan="${cols.length}" class="wiki-table-empty">Ingen rader enda.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function syncDraftFromDom(page) {
  const body = $('#wikiTableBody');
  if (!body) return;
  const cols = page.table_columns || [];
  state.tableDraftRows = Array.from(body.querySelectorAll('tr')).map((tr) => {
    const row = {};
    cols.forEach((c) => {
      const el = tr.querySelector(`[data-key="${c.key}"]`);
      let v = el ? el.value : '';
      if (c.type === 'number') v = v === '' ? null : Number(v);
      row[c.key] = v;
    });
    return row;
  });
}

function wireTableActions(page) {
  if (!state.editing) return;

  $('#wikiAddRowBtn').addEventListener('click', () => {
    syncDraftFromDom(page);
    state.tableDraftRows.push({});
    renderWikiPage();
  });

  document.querySelectorAll('.row-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      syncDraftFromDom(page);
      const idx = parseInt(btn.dataset.row, 10);
      state.tableDraftRows.splice(idx, 1);
      renderWikiPage();
    });
  });
}

// ─── Shared header actions ────────────────────────────────────────
function wireHeaderActions(page) {
  $('#wikiEditBtn').addEventListener('click', () => {
    state.editing = !state.editing;
    if (!state.editing) { state.tableDraftRows = null; discardBlocksEditor(); }
    renderWikiPage();
  });

  const saveBtn = $('#wikiSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => savePage(page));

  $('#wikiNewChildBtn').addEventListener('click', createChildPage);

  const deleteBtn = $('#wikiDeleteBtn');
  if (deleteBtn) deleteBtn.addEventListener('click', deletePage);

  $('#wikiPage').querySelectorAll('.wiki-child-link').forEach((el) => {
    el.addEventListener('click', () => openPage(el.dataset.id));
  });
}

async function savePage(page) {
  const title = $('#wikiTitleInput').value.trim();
  if (!title) { showToast('Tittel er påkrevd', true); return; }

  const payload = {
    title,
    icon: $('#wikiIconInput').value.trim() || '📄',
  };

  if (page.page_type === 'table') {
    syncDraftFromDom(page);
    payload.table_rows = state.tableDraftRows;
  } else {
    payload.blocks = blocksEditor ? blocksEditor.getBlocks() : page.blocks;
  }

  const { error } = await supabase.from('wiki_pages').update(payload).eq('id', page.id);
  if (error) { showToast('Kunne ikke lagre: ' + error.message, true); return; }

  showToast('Side lagret');
  state.editing = false;
  state.tableDraftRows = null;
  discardBlocksEditor();
  await loadPages();
  renderWikiPage();
}

async function createChildPage() {
  const parent = pageById(state.currentPageId);
  if (!parent) return;

  const title = prompt('Tittel på ny side:');
  if (!title || !title.trim()) return;

  const { data, error } = await supabase
    .from('wiki_pages')
    .insert({
      parent_id: parent.id,
      teamspace: parent.teamspace,
      title: title.trim(),
      icon: '📄',
      content: '',
      position: childrenOf(parent.id).length + 1,
      created_by: session.email,
    })
    .select()
    .single();

  if (error) { showToast('Kunne ikke opprette side: ' + error.message, true); return; }

  showToast('Side opprettet');
  state.expanded.add(parent.id);
  await loadPages();
  openPage(data.id);
}

async function deletePage() {
  const page = pageById(state.currentPageId);
  if (!page || page.is_teamspace_root) return;
  if (!confirm(`Slette «${page.title}»? Undersider slettes også.`)) return;

  const parentId = page.parent_id;
  const { error } = await supabase.from('wiki_pages').delete().eq('id', page.id);
  if (error) { showToast('Kunne ikke slette: ' + error.message, true); return; }

  showToast('Side slettet');
  await loadPages();
  openPage(parentId);
}

// ─── Wiring (called once by shell.js after login) ────────────────
export function initWiki() {
  loadPages();
}
