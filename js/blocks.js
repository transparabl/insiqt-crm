const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'CODE', 'A', 'BR']);

const SLASH_MENU_ITEMS = [
  { type: 'heading1', label: 'Overskrift 1' },
  { type: 'heading2', label: 'Overskrift 2' },
  { type: 'heading3', label: 'Overskrift 3' },
  { type: 'bulleted_list_item', label: 'Punktliste' },
  { type: 'numbered_list_item', label: 'Nummerert liste' },
  { type: 'to_do', label: 'Sjekkliste' },
  { type: 'quote', label: 'Sitat' },
  { type: 'code', label: 'Kode' },
  { type: 'divider', label: 'Skillelinje' },
];

function sanitizeInlineHtml(html) {
  const container = document.createElement('div');
  container.innerHTML = html;

  function walk(node) {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!ALLOWED_TAGS.has(child.tagName)) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          return;
        }
        Array.from(child.attributes).forEach((attr) => {
          if (!(child.tagName === 'A' && attr.name === 'href')) child.removeAttribute(attr.name);
        });
        walk(child);
      }
    });
  }
  walk(container);
  return container.innerHTML;
}

function newBlock(type) {
  return { id: crypto.randomUUID(), type, html: '', checked: false };
}

function tagFor(type) {
  return { heading1: 'h1', heading2: 'h2', heading3: 'h3', quote: 'blockquote', code: 'pre', paragraph: 'p' }[type] || 'div';
}

function isListLike(type) {
  return type === 'bulleted_list_item' || type === 'numbered_list_item' || type === 'to_do';
}

function listNumber(blocks, index) {
  let n = 1;
  for (let i = index - 1; i >= 0 && blocks[i].type === 'numbered_list_item'; i--) n++;
  return n;
}

function renderBlockInner(block, blocks, index) {
  if (block.type === 'divider') return '<hr>';
  if (block.type === 'to_do') {
    return `<div class="todo-row">
      <input type="checkbox" class="todo-check" data-id="${block.id}" ${block.checked ? 'checked' : ''}>
      <span class="block-content" contenteditable="true" data-id="${block.id}">${block.html}</span>
    </div>`;
  }
  if (block.type === 'bulleted_list_item') {
    return `<div class="li-row"><span class="li-bullet">•</span><span class="block-content" contenteditable="true" data-id="${block.id}">${block.html}</span></div>`;
  }
  if (block.type === 'numbered_list_item') {
    return `<div class="li-row"><span class="li-bullet">${listNumber(blocks, index)}.</span><span class="block-content" contenteditable="true" data-id="${block.id}">${block.html}</span></div>`;
  }
  if (block.type === 'code') {
    return `<pre><code class="block-content" contenteditable="true" data-id="${block.id}">${block.html}</code></pre>`;
  }
  const tag = tagFor(block.type);
  return `<${tag} class="block-content" contenteditable="true" data-id="${block.id}">${block.html}</${tag}>`;
}

function renderRow(block, blocks, index, editable) {
  const inner = editable
    ? renderBlockInner(block, blocks, index)
    : renderBlockInner({ ...block }, blocks, index).replace(/contenteditable="true"/g, '');
  const handle = editable ? '<span class="block-handle" draggable="true" data-id="' + block.id + '">⠿</span>' : '';
  return `<div class="block-row" data-id="${block.id}" data-type="${block.type}">${handle}${inner}</div>`;
}

export function renderBlocksReadOnly(blocks) {
  if (!blocks || !blocks.length) return '<p class="block-empty">Ingen innhold enda.</p>';
  return `<div class="block-list">${blocks.map((b, i) => renderRow(b, blocks, i, false)).join('')}</div>`;
}

export function mountBlocksEditor(container, page) {
  let draftBlocks = (page.blocks || []).map((b) => ({ ...b }));
  if (!draftBlocks.length) draftBlocks = [newBlock('paragraph')];

  let menuState = null; // { blockId }
  let menuEl = null;

  function render() {
    container.innerHTML = `<div class="block-list" id="blockList">${draftBlocks.map((b, i) => renderRow(b, draftBlocks, i, true)).join('')}</div>`;
    wire();
  }

  function blockIndex(id) {
    return draftBlocks.findIndex((b) => b.id === id);
  }

  function focusBlock(id, atEnd = true) {
    requestAnimationFrame(() => {
      const el = container.querySelector(`.block-content[data-id="${id}"]`);
      if (!el) return;
      el.focus();
      if (atEnd) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  }

  function closeMenu() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    menuState = null;
  }

  function openMenu(blockEl) {
    closeMenu();
    const id = blockEl.dataset.id;
    menuState = { blockId: id };
    const menu = document.createElement('div');
    menuEl = menu;
    menu.className = 'slash-menu';
    menu.innerHTML = SLASH_MENU_ITEMS.map((it) => `<button type="button" class="slash-menu-item" data-type="${it.type}">${it.label}</button>`).join('');
    document.body.appendChild(menu);
    const rect = blockEl.getBoundingClientRect();
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.top = `${rect.bottom + window.scrollY + 4}px`;

    menu.querySelectorAll('.slash-menu-item').forEach((btn) => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = blockIndex(id);
        if (idx === -1) return;
        draftBlocks[idx].type = btn.dataset.type;
        draftBlocks[idx].html = '';
        closeMenu();
        render();
        focusBlock(id);
      });
    });
  }

  function splitAtCaret(blockEl) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return { before: blockEl.innerHTML, after: '' };
    const range = sel.getRangeAt(0);
    const afterRange = range.cloneRange();
    afterRange.selectNodeContents(blockEl);
    afterRange.setStart(range.endContainer, range.endOffset);
    const afterFrag = afterRange.extractContents();
    const afterDiv = document.createElement('div');
    afterDiv.appendChild(afterFrag);
    return { before: blockEl.innerHTML, after: afterDiv.innerHTML };
  }

  function caretAtStart(blockEl) {
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(blockEl);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length === 0;
  }

  function wire() {
    container.querySelectorAll('.block-content').forEach((el) => {
      el.addEventListener('input', () => {
        const idx = blockIndex(el.dataset.id);
        if (idx === -1) return;
        draftBlocks[idx].html = sanitizeInlineHtml(el.innerHTML);

        if (el.textContent === '/') {
          openMenu(el.closest('.block-row'));
        } else if (menuState && menuState.blockId === el.dataset.id) {
          closeMenu();
        }
      });

      el.addEventListener('keydown', (e) => {
        const idx = blockIndex(el.dataset.id);
        if (idx === -1) return;
        const block = draftBlocks[idx];

        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
          e.preventDefault();
          document.execCommand('bold');
          return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
          e.preventDefault();
          document.execCommand('italic');
          return;
        }
        if (e.key === 'Escape' && menuState) {
          closeMenu();
          return;
        }

        if (e.key === 'Enter') {
          if (block.type === 'code') return; // allow literal newline
          e.preventDefault();
          closeMenu();

          if (isListLike(block.type) && el.textContent.trim() === '') {
            block.type = 'paragraph';
            render();
            focusBlock(block.id);
            return;
          }

          const { before, after } = splitAtCaret(el);
          block.html = sanitizeInlineHtml(before);
          const nextType = block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3'
            ? 'paragraph'
            : block.type;
          const next = newBlock(nextType);
          next.html = sanitizeInlineHtml(after);
          draftBlocks.splice(idx + 1, 0, next);
          render();
          focusBlock(next.id, false);
          return;
        }

        if (e.key === 'Backspace' && caretAtStart(el) && idx > 0) {
          e.preventDefault();
          const prev = draftBlocks[idx - 1];
          if (prev.type === 'divider') { draftBlocks.splice(idx - 1, 1); render(); focusBlock(block.id, false); return; }
          prev.html = prev.html + block.html;
          draftBlocks.splice(idx, 1);
          render();
          focusBlock(prev.id);
        }
      });
    });

    container.querySelectorAll('.todo-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const idx = blockIndex(cb.dataset.id);
        if (idx !== -1) draftBlocks[idx].checked = cb.checked;
      });
    });

    container.querySelectorAll('.block-handle').forEach((handle) => {
      handle.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', handle.dataset.id);
      });
    });

    container.querySelectorAll('.block-row').forEach((row) => {
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.classList.add('block-drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('block-drag-over'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('block-drag-over');
        const draggedId = e.dataTransfer.getData('text/plain');
        const fromIdx = blockIndex(draggedId);
        let toIdx = blockIndex(row.dataset.id);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
        const rect = row.getBoundingClientRect();
        const insertAfter = e.clientY > rect.top + rect.height / 2;
        const [moved] = draftBlocks.splice(fromIdx, 1);
        toIdx = blockIndex(row.dataset.id);
        draftBlocks.splice(insertAfter ? toIdx + 1 : toIdx, 0, moved);
        render();
      });
    });
  }

  function onDocumentMousedown(e) {
    if (menuEl && !menuEl.contains(e.target)) closeMenu();
  }
  document.addEventListener('mousedown', onDocumentMousedown);

  render();

  return {
    getBlocks: () => draftBlocks.map((b) => ({ ...b, html: sanitizeInlineHtml(b.html) })),
    destroy: () => { closeMenu(); document.removeEventListener('mousedown', onDocumentMousedown); },
  };
}
