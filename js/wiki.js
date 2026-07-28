import { marked } from 'https://esm.sh/marked@12';
import { supabase } from './supabase-client.js';
import { session } from './session.js';
import { showView } from './view.js';
import { showToast } from './app.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  pages: [],
  expanded: new Set(),
  currentPageId: null,
  editing: false,
};

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
  showView('wiki');
  renderSidebarTree();
  renderWikiPage();
}

function renderWikiPage() {
  const page = pageById(state.currentPageId);
  const container = $('#wikiPage');
  if (!page) { container.innerHTML = ''; return; }

  const crumbs = breadcrumbFor(page)
    .map((p) => `<span>${escapeHtml(p.icon || '📄')} ${escapeHtml(p.title)}</span>`)
    .join('<span class="crumb-sep">/</span>');

  const kids = childrenOf(page.id);
  const childrenHtml = kids.length
    ? `<div class="wiki-children">
        <div class="wiki-children-label">Undersider</div>
        ${kids.map((k) => `<div class="wiki-child-link" data-id="${k.id}">${escapeHtml(k.icon || '📄')} ${escapeHtml(k.title)}</div>`).join('')}
      </div>`
    : '';

  if (state.editing) {
    container.innerHTML = `
      <div class="wiki-breadcrumb">${crumbs}</div>
      <div class="wiki-edit-head">
        <input type="text" id="wikiIconInput" class="wiki-icon-input" value="${escapeHtml(page.icon || '📄')}" maxlength="4">
        <input type="text" id="wikiTitleInput" class="wiki-title-input" value="${escapeHtml(page.title)}">
      </div>
      <textarea id="wikiContentInput" class="wiki-content-input" placeholder="Skriv i markdown …">${escapeHtml(page.content || '')}</textarea>
      <div class="modal-actions">
        <button class="btn" id="wikiSaveBtn">Lagre</button>
        <button class="btn ghost" id="wikiCancelBtn">Avbryt</button>
      </div>
    `;
    $('#wikiSaveBtn').addEventListener('click', savePage);
    $('#wikiCancelBtn').addEventListener('click', () => { state.editing = false; renderWikiPage(); });
    return;
  }

  container.innerHTML = `
    <div class="wiki-breadcrumb">${crumbs}</div>
    <div class="wiki-header">
      <h1><span>${escapeHtml(page.icon || '📄')}</span> ${escapeHtml(page.title)}</h1>
      <div class="wiki-actions">
        <button class="btn ghost" id="wikiEditBtn">Rediger</button>
        <button class="btn ghost" id="wikiNewChildBtn">+ Ny underside</button>
        ${page.is_teamspace_root ? '' : '<button class="btn danger" id="wikiDeleteBtn">Slett</button>'}
      </div>
    </div>
    <div class="markdown-body" id="wikiContent">${marked.parse(page.content || '*Ingen innhold enda.*')}</div>
    ${childrenHtml}
  `;

  $('#wikiEditBtn').addEventListener('click', () => { state.editing = true; renderWikiPage(); });
  $('#wikiNewChildBtn').addEventListener('click', createChildPage);
  const deleteBtn = $('#wikiDeleteBtn');
  if (deleteBtn) deleteBtn.addEventListener('click', deletePage);

  container.querySelectorAll('.wiki-child-link').forEach((el) => {
    el.addEventListener('click', () => openPage(el.dataset.id));
  });

  // Internal `page:<uuid>` links navigate within the wiki; external links open in a new tab.
  container.querySelectorAll('#wikiContent a').forEach((a) => {
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

async function savePage() {
  const page = pageById(state.currentPageId);
  if (!page) return;

  const title = $('#wikiTitleInput').value.trim();
  if (!title) { showToast('Tittel er påkrevd', true); return; }

  const payload = {
    title,
    icon: $('#wikiIconInput').value.trim() || '📄',
    content: $('#wikiContentInput').value,
  };

  const { error } = await supabase.from('wiki_pages').update(payload).eq('id', page.id);
  if (error) { showToast('Kunne ikke lagre: ' + error.message, true); return; }

  showToast('Side lagret');
  state.editing = false;
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
