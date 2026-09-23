import { NodeSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';

// All top-level document nodes use the same move operation, including CodeMirror cells.
export function moveBlock(editor, from, boundary) {
  const node = editor.state.doc.nodeAt(from);
  if (!node || boundary >= from && boundary <= from + node.nodeSize) return false;
  const fromRow = editor.state.doc.resolve(from).parent.type.name === 'layoutRow';
  const tr = closeHistory(editor.state.tr).delete(from, from + node.nodeSize);
  const to = tr.mapping.map(boundary);
  const moving = fromRow && tr.doc.resolve(to).parent.type.name !== 'layoutRow' ?
    node.type.create({ ...node.attrs, boxOffsetX: null }, node.content, node.marks) : node;
  tr.insert(to, moving).setSelection(NodeSelection.create(tr.doc, to));
  collapseRows(tr);
  editor.view.dispatch(tr);
  editor.view.dispatch(closeHistory(editor.state.tr));
  return true;
}

export function collapseRows(tr) {
  const rows = [];
  tr.doc.descendants((node, pos) => { if (node.type.name === 'layoutRow' && node.childCount < 2) rows.push(pos); });
  for (const pos of rows.reverse()) {
    const node = tr.doc.nodeAt(pos);
    if (node?.type.name === 'layoutRow') {
      const child = node.firstChild;
      const replacement = child && child.attrs.boxOffsetX ?
        child.type.create({ ...child.attrs, boxOffsetX: null }, child.content, child.marks) : child;
      tr.replaceWith(pos, pos + node.nodeSize, replacement || []);
    }
  }
}
export function moveBeside(editor, from, targetPos, side) {
  const node = editor.state.doc.nodeAt(from), target = editor.state.doc.nodeAt(targetPos);
  if (!node || !target || targetPos >= from && targetPos < from + node.nodeSize || from >= targetPos && from < targetPos + target.nodeSize) return false;
  const tr = closeHistory(editor.state.tr).delete(from, from + node.nodeSize);
  const to = tr.mapping.map(targetPos), $to = tr.doc.resolve(to);
  const reset = value => value.type.create({ ...value.attrs, boxWidth: null, boxOffsetX: null,
    boxAlign: value.attrs.boxAlign === 'justify' ? 'left' : value.attrs.boxAlign, placement: 'block-left' }, value.content, value.marks);
  if ($to.parent.type.name === 'layoutRow') tr.insert(side === 'left' ? to : to + target.nodeSize, reset(node));
  else {
    const children = side === 'left' ? [reset(node), reset(target)] : [reset(target), reset(node)];
    tr.replaceWith(to, to + target.nodeSize, editor.schema.nodes.layoutRow.create(null, children));
  }
  collapseRows(tr);
  editor.view.dispatch(tr); editor.view.dispatch(closeHistory(editor.state.tr));
  return true;
}
export function setupBlockMovement(editor, noteId) {
  const root = editor.view.dom;
  const marker = document.createElement('div'); marker.className = 'block-drop-marker';
  document.body.append(marker);
  let drag, frame, lastY = 0, lastX = 0, suppressClick = false, releaseTimer;
  const blocks = () => {
    const result = [];
    editor.state.doc.descendants((node, pos, parent) => {
      if (!['doc', 'layoutRow', 'blockGroup'].includes(parent.type.name) || node.type.name === 'layoutRow') return true;
      const dom = editor.view.nodeDOM(pos);
      if (dom instanceof HTMLElement) result.push({ node, pos, dom, rect: dom.getBoundingClientRect() });
      return node.type.name === 'blockGroup';
    });
    return result;
  };
  const locate = target => blocks().reverse().find(block => block.dom === target || block.dom.contains(target));
  const valid = () => drag && drag.noteId === noteId() && drag.doc === editor.state.doc;
  function finish(commit = false) {
    if (!drag) return;
    const moving = drag; const allowed = valid();
    cancelAnimationFrame(frame); drag = null; marker.style.display = 'none';
    if (moving?.dom) { moving.dom.classList.remove('container-lifted'); moving.dom.style.removeProperty('--drag-x'); moving.dom.style.removeProperty('--drag-y'); }
    document.body.classList.remove('moving-block');
    if (moving.active) {
      document.body.classList.add('moving-block-releasing');
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => document.body.classList.remove('moving-block-releasing'), 720);
    }
    if (commit && allowed && !moving.active) {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, moving.pos)));
    }
    if (commit && allowed && moving.active) {
      if (moving.inside) moveInto(editor, moving.pos, moving.targetPos);
      else if (moving.side) moveBeside(editor, moving.pos, moving.targetPos, moving.side);
      else if (moving.boundary != null) moveBlock(editor, moving.pos, moving.boundary);
    }
  }
  function target(y) {
    if (!valid()) { finish(); return; }
    const editorRect = root.getBoundingClientRect();
    const dropMargin = 32;
    if (lastX < editorRect.left - dropMargin || lastX > editorRect.right + dropMargin ||
      y < editorRect.top - dropMargin || y > editorRect.bottom + dropMargin) {
      drag.side = null; drag.inside = false; drag.boundary = null;
      marker.style.display = 'none'; return;
    }
    const source = editor.state.doc.nodeAt(drag.pos);
    let candidates = blocks().filter(block => block.pos < drag.pos || block.pos >= drag.pos + source.nodeSize);
    drag.side = null; drag.inside = false; drag.boundary = null; marker.dataset.inside = 'false';
    if (!candidates.length) return;
    const inside = candidates.slice().reverse().find(block => block.node.type.name === 'blockGroup' &&
      y > block.rect.top + 12 && y < block.rect.bottom - 12 && lastX > block.rect.left + 12 && lastX < block.rect.right - 12);
    const sourceParent = editor.state.doc.resolve(drag.pos);
    if (inside && sourceParent.parent === inside.node) {
      candidates = candidates.filter(block => block.pos > inside.pos && block.pos < inside.pos + inside.node.nodeSize);
      if (!candidates.length) { marker.style.display = 'none'; return; }
    } else if (inside) {
      drag.inside = true; drag.targetPos = inside.pos; marker.dataset.inside = 'true';
      Object.assign(marker.style, { display: 'block', left: inside.rect.left + 'px', top: inside.rect.top + 'px', width: inside.rect.width + 'px', height: inside.rect.height + 'px' });
      return;
    }
    const beside = candidates.find(block => y > block.rect.top + Math.min(12, block.rect.height * .2) && y < block.rect.bottom - Math.min(12, block.rect.height * .2) &&
      lastX >= block.rect.left - 20 && lastX <= block.rect.right + 20 &&
      (lastX < block.rect.left + block.rect.width * .22 || lastX > block.rect.right - block.rect.width * .22));
    drag.side = null;
    if (beside) {
      drag.side = lastX < beside.rect.left + beside.rect.width / 2 ? 'left' : 'right';
      drag.targetPos = beside.pos;
      Object.assign(marker.style, { display: 'block', left: (drag.side === 'left' ? beside.rect.left : beside.rect.right) + 'px',
        top: beside.rect.top + 'px', width: '3px', height: beside.rect.height + 'px' });
      return;
    }
    marker.style.height = '3px';
    let chosen = candidates.find(block => y < block.rect.top + block.rect.height / 2);
    const before = Boolean(chosen); chosen ||= candidates.at(-1);
    drag.boundary = before ? chosen.pos : chosen.pos + chosen.node.nodeSize;
    const $chosen = editor.state.doc.resolve(chosen.pos);
    if ($chosen.parent.type.name === 'layoutRow') drag.boundary = before ? $chosen.before() : $chosen.after();
    const rect = root.getBoundingClientRect();
    Object.assign(marker.style, { display: 'block', left: `${rect.left}px`, width: `${rect.width}px`,
      top: `${before ? chosen.rect.top : chosen.rect.bottom}px` });
  }
  function scroll() {
    if (!drag?.active) return;
    const delta = lastY < 55 ? -14 : lastY > innerHeight - 55 ? 14 : 0;
    if (delta) { window.scrollBy(0, delta); target(lastY); }
    frame = requestAnimationFrame(scroll);
  }
  function begin(block, event) {
    if (!block || !editor.isEditable || !noteId()) return;
    if (drag) finish();
    clearTimeout(releaseTimer); document.body.classList.remove('moving-block-releasing');
    drag = { pos: block.pos, dom: block.dom, doc: editor.state.doc, noteId: noteId(), startX: event.clientX, startY: event.clientY, active: false };
    lastY = event.clientY; lastX = event.clientX;
  }
  function pointerDown(event) {
    if (event.button !== 0 || event.target.closest('button,input,select,.inline-crop,.inline-crop-tools,.image-title,figcaption,.container-title,.container-caption,.container-resize,.container-resize-edge,.container-select-edge,.container-pair-resize,.container-gap-boundary,.image-resize,.column-resize-handle')) return;
    const block = locate(event.target);
    if (!block) return;
    const edge =
      (event.clientX < block.rect.left + 7 || event.clientX > block.rect.right - 7 || event.clientY < block.rect.top + 7 || event.clientY > block.rect.bottom - 7);
    if (!edge && !event.target.closest('.image-drag,.image-viewport,.container-type-label,[data-type=block-math] .katex') && !event.target.matches('.cell-tools')) return;
    event.preventDefault(); event.stopImmediatePropagation(); begin(block, event);
  }
  document.addEventListener('pointerdown', pointerDown, true);
  document.addEventListener('pointermove', event => {
    if (drag) {
      event.preventDefault(); lastY = event.clientY; lastX = event.clientX;
      if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) {
        drag.active = true; drag.dom.classList.add('container-lifted'); document.body.classList.add('moving-block'); scroll();
      }
      if (drag.active) { drag.dom.style.setProperty('--drag-x', `${event.clientX - drag.startX}px`); drag.dom.style.setProperty('--drag-y', `${event.clientY - drag.startY}px`); target(lastY); }
      return;
    }
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    suppressClick = drag.active; finish(true);
  }, true);
  document.addEventListener('pointercancel', () => { if (drag) finish(); }, true);
  document.addEventListener('click', event => {
    if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; }
  }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && drag) { event.preventDefault(); finish(); } }, true);
  window.addEventListener('blur', event => { if (event.target === window) finish(); });
  editor.on('transaction', () => { if (drag && !valid()) finish(); });
  return { cancel: () => finish() };
}

export function moveInto(editor, from, targetPos) {
  const source = editor.state.doc.nodeAt(from), target = editor.state.doc.nodeAt(targetPos);
  if (!source || target?.type.name !== 'blockGroup' || targetPos >= from && targetPos < from + source.nodeSize) return false;
  const tr = closeHistory(editor.state.tr).delete(from, from + source.nodeSize);
  const mapped = tr.mapping.map(targetPos), group = tr.doc.nodeAt(mapped);
  if (group?.type.name !== 'blockGroup') return false;
  const to = mapped + group.nodeSize - 1;
  const moving = source.attrs.boxOffsetX ?
    source.type.create({ ...source.attrs, boxOffsetX: null }, source.content, source.marks) : source;
  tr.insert(to, moving).setSelection(NodeSelection.create(tr.doc, to));
  collapseRows(tr);
  editor.view.dispatch(tr); editor.view.dispatch(closeHistory(editor.state.tr));
  return true;
}
