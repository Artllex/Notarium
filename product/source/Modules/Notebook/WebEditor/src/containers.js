import { Extension, Node } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { richAttribute } from './rich-label.js';
import { ContainerInteractions } from './container-interactions.js';
import { collapseRows, moveBlock } from './block-movement.js';
import { ContainerVisual } from './container-visual.js';
import { containerTypes, getContainerType } from './container-types.js';

const types = Object.keys(containerTypes);
export const BlockGroup = Node.create({
  name: 'blockGroup', group: 'block', content: 'block+', defining: true, isolating: true,
  parseHTML: () => [{ tag: 'section[data-block-group]' }],
  renderHTML: ({ HTMLAttributes }) => ['section', { ...HTMLAttributes, 'data-block-group': 'true', class: 'block-group-content' }, 0]
});
const backgroundColor = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : null;
export const LayoutRow = Node.create({
  name: 'layoutRow', group: 'block', content: 'block+', isolating: true,
  parseHTML: () => [{ tag: 'section[data-layout-row]' }],
  renderHTML: () => ['section', { 'data-layout-row': 'true', class: 'layout-row' }, 0]
});
export const ContainerAttributes = Extension.create({
  name: 'containerAttributes',
  addGlobalAttributes() {
    return [{ types, attributes: { boxBackground: { default: null,
      parseHTML: el => backgroundColor(el.getAttribute('data-boxbackground')),
      renderHTML: attrs => backgroundColor(attrs.boxBackground) ? { 'data-boxbackground': attrs.boxBackground } : {} },
      codeAllowNarrow: { default: false, parseHTML: el => el.getAttribute('data-codeallownarrow') === 'true', renderHTML: attrs => attrs.codeAllowNarrow ? { 'data-codeallownarrow': 'true' } : {} },
      boxEmpty: { default: false, parseHTML: el => el.getAttribute('data-boxempty') === 'true', renderHTML: attrs => attrs.boxEmpty ? { 'data-boxempty': 'true' } : {} },
      boxTextExplicit: { default: false, parseHTML: el => el.getAttribute('data-boxtextexplicit') === 'true', renderHTML: attrs => attrs.boxTextExplicit ? { 'data-boxtextexplicit': 'true' } : {} },
      boxTitleRich: richAttribute('boxTitleRich'), boxCaptionRich: richAttribute('boxCaptionRich'), ...Object.fromEntries(['boxWidth', 'boxHeight', 'boxOffsetX', 'boxAlign', 'boxTitle', 'boxCaption'].map(name => [name, {
      default: null,
      parseHTML: el => {
        const value = el.getAttribute('data-' + name.toLowerCase());
        return ['boxWidth', 'boxHeight', 'boxOffsetX'].includes(name) ? Number(value) || null : value;
      },
      renderHTML: attrs => attrs[name] == null ? {} : { ['data-' + name.toLowerCase()]: attrs[name] }
    }])) } }];
  }
});

// Common capabilities surround each engine's own node view; editing stays with that engine.
export class ContainerView {
  constructor(inner, props, options) {
    this.inner = inner; this.props = props; this.node = props.node;
    ContainerVisual.mount(this, inner, props, options);
    this.interactions = new ContainerInteractions(this, props, options);
    this.paint();
  }
  select() {
    const pos = this.props.getPos(); if (typeof pos !== 'number') return;
    this.props.editor.view.focus();
    this.props.editor.view.dispatch(this.props.editor.state.tr.setSelection(NodeSelection.create(this.props.editor.state.doc, pos)));
  }
  // A gesture owns its preview until it commits or restores the captured document.
  beginGesture(event, preview, commit, restore, onClick = () => {}) {
    const doc = this.props.editor.state.doc, note = this.props.noteId?.();
    const startX = event.clientX, startY = event.clientY, pointerId = event.pointerId;
    let moved = false, ended = false;
    const valid = () => this.dom.isConnected && this.props.editor.state.doc === doc && this.props.noteId?.() === note;
    const cleanup = () => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', pointerCancel, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('blur', cancel);
      this.props.editor.off('transaction', changed);
      if (this.activeGesture === cancel) this.activeGesture = null;
    };
    const end = (shouldCommit, current) => {
      if (ended) return;
      ended = true; cleanup();
      if (shouldCommit && valid()) {
        if (moved) commit(current);
        else { restore(); onClick(current); }
      } else restore();
    };
    const move = current => {
      if (current.pointerId !== pointerId) return;
      if (!valid()) { end(false); return; }
      if (!moved && Math.hypot(current.clientX - startX, current.clientY - startY) < 3) return;
      moved = true; preview(current);
    };
    const up = current => { if (current.pointerId === pointerId) end(true, current); };
    const cancel = () => end(false);
    const pointerCancel = current => { if (current.pointerId === pointerId) cancel(); };
    const keydown = current => { if (current.key === 'Escape') { current.preventDefault(); current.stopPropagation(); cancel(); } };
    const changed = () => { if (!valid()) cancel(); };
    this.activeGesture?.();
    this.activeGesture = cancel;
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', pointerCancel, true);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('blur', cancel);
    this.props.editor.on('transaction', changed);
  }
  rowSnapshot() {
    const row = this.dom.parentElement;
    if (!row?.matches('.layout-row')) return null;
    const style = getComputedStyle(row), bounds = row.getBoundingClientRect();
    const gap = Number.parseFloat(style.columnGap) || 0;
    const left = bounds.left + (Number.parseFloat(style.borderLeftWidth) || 0) + (Number.parseFloat(style.paddingLeft) || 0);
    const right = bounds.right - (Number.parseFloat(style.borderRightWidth) || 0) - (Number.parseFloat(style.paddingRight) || 0);
    const entries = [...row.children].filter(dom => dom.matches?.('.object-container') && dom.containerView)
      .map(dom => { const rect = dom.getBoundingClientRect(); return { view: dom.containerView, left: rect.left, right: rect.right, width: rect.width }; });
    return { entries, gap, left, right };
  }
  previewRow(snapshot, boxes) { ContainerVisual.previewRow(this, snapshot, boxes); }
  commitRow(snapshot, boxes, height = null) {
    const { editor } = this.props;
    boxes = boxes.map(box => ({ ...box }));
    for (let i = 0; i < boxes.length - 1; i++) {
      const openWidth = Math.round(boxes[i + 1].left - boxes[i].right - (2 * snapshot.gap));
      const leftEmpty = snapshot.entries[i].view.node.attrs.boxEmpty && !snapshot.entries[i].view.node.textContent;
      const rightEmpty = snapshot.entries[i + 1].view.node.attrs.boxEmpty && !snapshot.entries[i + 1].view.node.textContent;
      if (openWidth > 0 && leftEmpty) {
        boxes[i].right = boxes[i + 1].left - snapshot.gap;
        boxes[i].width = boxes[i].right - boxes[i].left;
        continue;
      }
      if (openWidth > 0 && rightEmpty) {
        boxes[i + 1].left = boxes[i].right + snapshot.gap;
        boxes[i + 1].width = boxes[i + 1].right - boxes[i + 1].left;
        continue;
      }
    }
    let tr = closeHistory(editor.state.tr), changed = false;
    for (let i = 0; i < snapshot.entries.length; i++) {
      const { view } = snapshot.entries[i], pos = view.props.getPos(), current = typeof pos === 'number' && tr.doc.nodeAt(pos);
      if (!current) continue;
      const box = boxes[i], previous = boxes[i - 1];
      const offset = Math.round(box.left - (previous ? previous.right + snapshot.gap : snapshot.left));
      const next = { ...current.attrs, boxWidth: Math.round(box.width), boxOffsetX: offset || null, boxAlign: 'left',
        ...(current.type.name === 'image' && Math.abs(box.width - snapshot.entries[i].width) > 1 ? { width: Math.round(box.width) } : {}),
        ...(view === this && height != null ? { boxHeight: height } : {}) };
      if (Object.keys(next).some(key => current.attrs[key] !== next[key])) {
        tr = tr.setNodeMarkup(pos, undefined, next); changed = true;
      }
    }
    const insertions = [];
    for (let i = 0; i < boxes.length - 1; i++) {
      const openWidth = Math.round(boxes[i + 1].left - boxes[i].right - (2 * snapshot.gap));
      if (openWidth < 1) continue;
      const nextView = snapshot.entries[i + 1].view, nextPos = nextView.props.getPos();
      const nextNode = typeof nextPos === 'number' && tr.doc.nodeAt(nextPos);
      if (nextNode) insertions.push({ nextPos, nextNode, openWidth });
    }
    for (const { nextPos, nextNode, openWidth } of insertions.sort((a, b) => b.nextPos - a.nextPos)) {
      tr = tr.setNodeMarkup(nextPos, undefined, { ...nextNode.attrs, boxOffsetX: null });
      const filler = editor.schema.nodes.paragraph.create({ boxWidth: openWidth, boxOffsetX: null, boxAlign: 'left', boxEmpty: true });
      tr = tr.insert(nextPos, filler); changed = true;
    }
    if (changed) { editor.view.dispatch(tr); editor.view.dispatch(closeHistory(editor.state.tr)); }
    else this.restoreRow(snapshot);
  }
  restoreRow(snapshot) {
    if (snapshot) for (const entry of snapshot.entries) entry.view.paint();
    else this.paint();
  }
  previewHeight(height) { ContainerVisual.previewHeight(this, height); }
  previewImageWidth(width) { ContainerVisual.previewImageWidth(this, width); }
  resizeEdge(event, handle, axis) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); this.select();
    const rect = this.dom.getBoundingClientRect(), row = axis !== 'height' ? this.rowSnapshot() : null;
    const index = row?.entries.findIndex(entry => entry.view === this) ?? -1;
    const fromLeft = handle === this.resizeLeft || handle === this.resizeBottomLeft;
    const parent = this.dom.parentElement?.getBoundingClientRect();
    const baseLeft = parent?.left ?? rect.left, baseRight = parent?.right ?? rect.right;
    const bounds = row ? row.entries[index] : { left: rect.left, right: rect.right, width: rect.width };
    const prior = row && index > 0 ? row.entries[index - 1] : null;
    const next = row && index < row.entries.length - 1 ? row.entries[index + 1] : null;
    const minimum = this.codeMinimumWidth();
    const snapEdge = (edgePosition, side) => {
      if (axis === 'height') return edgePosition;
      const own = this.dom.getBoundingClientRect();
      const candidates = [...this.props.editor.view.dom.querySelectorAll('.object-container')]
        .filter(dom => dom !== this.dom && dom.parentElement !== this.dom.parentElement)
        .map(dom => dom.getBoundingClientRect())
        .filter(other => other.bottom <= own.top || other.top >= own.bottom)
        .map(other => side === 'left' ? other.left : other.right)
        .map(edge => ({ edge, distance: Math.abs(edge - edgePosition) }))
        .filter(candidate => candidate.distance <= 10)
        .sort((a, b) => a.distance - b.distance);
      return candidates[0]?.edge ?? edgePosition;
    };
    const calculate = current => {
      let width, left = bounds.left;
      if (axis !== 'height') {
        const minLeft = Math.max(row?.left ?? baseLeft, prior ? prior.right + row.gap : -Infinity);
        const maxRight = Math.min(row?.right ?? baseRight, next ? next.left - row.gap : Infinity);
        if (fromLeft) {
          const rawLeft = bounds.left + current.clientX - event.clientX;
          left = Math.min(bounds.right - minimum, Math.max(minLeft, snapEdge(rawLeft, 'left')));
          width = Math.round(bounds.right - left);
        } else {
          const rawRight = bounds.left + bounds.width + current.clientX - event.clientX;
          const right = Math.max(bounds.left + minimum, Math.min(maxRight, snapEdge(rawRight, 'right')));
          width = Math.round(right - bounds.left);
        }
        if (width < minimum || !Number.isFinite(width)) return null;
      }
      const height = axis !== 'width' ? Math.round(Math.max(this.codeMinimumHeight(), Math.min(4000, rect.height + current.clientY - event.clientY))) : null;
      const boxes = row?.entries.map(entry => ({ left: entry.left, right: entry.right, width: entry.width }));
      if (boxes) { boxes[index] = { left, right: left + width, width }; }
      return { width, left, height, boxes };
    };
    this.beginGesture(event, current => {
      const result = calculate(current); if (!result) return;
      if (row) this.previewRow(row, result.boxes);
      else if (result.width != null) {
        ContainerVisual.previewSingle(this, result.width, result.left - baseLeft);
      }
      if (result.width != null) this.previewImageWidth(result.width);
      if (result.height != null) this.previewHeight(result.height);
      this.positionAdjacentPairs();
    }, current => {
      const result = calculate(current);
      if (!result) { this.restoreRow(row); return; }
      this.lastEdgeClick = null;
      if (row) this.commitRow(row, result.boxes, result.height);
      else this.updateAttrs({ ...(result.width != null ? { boxWidth: result.width, boxAlign: 'left',
        boxOffsetX: Math.round(result.left - baseLeft) || null } : {}), ...(result.height != null ? { boxHeight: result.height } : {}) });
    }, () => this.restoreRow(row), current => {
      const last = this.lastEdgeClick, now = performance.now();
      if (last?.handle === handle && now - last.time < 500 && Math.hypot(current.clientX - last.x, current.clientY - last.y) < 5) {
        this.lastEdgeClick = null; this.lastEdgeReset = now; this.resetDimensions(axis, handle);
      } else this.lastEdgeClick = { handle, time: now, x: current.clientX, y: current.clientY };
    });
  }
  positionPair() { ContainerVisual.positionPair(this); }
  positionAdjacentPairs() {
    this.positionPair();
    let previous = this.dom.previousElementSibling;
    while (previous && !previous.matches?.('.object-container')) previous = previous.previousElementSibling;
    previous?.containerView?.positionPair();
  }
  resizePair(event) {
    if (event.button !== 0) return;
    let next = this.dom.nextElementSibling;
    while (next && !next.matches?.('.object-container')) next = next.nextElementSibling;
    const other = next?.containerView;
    if (!other || this.dom.parentElement !== other.dom.parentElement) return;
    event.preventDefault(); event.stopPropagation(); this.select();
    const row = this.rowSnapshot(); if (!row) return;
    const index = row.entries.findIndex(entry => entry.view === this);
    if (index < 0 || row.entries[index + 1]?.view !== other) return;
    const left = row.entries[index], right = row.entries[index + 1], total = left.width + right.width;
    const minLeft = this.codeMinimumWidth(), minRight = other.codeMinimumWidth();
    const calculate = current => {
      if (minLeft + minRight > total) return null;
      const width = Math.round(Math.max(minLeft, Math.min(total - minRight, left.width + current.clientX - event.clientX)));
      const boxes = row.entries.map(entry => ({ left: entry.left, right: entry.right, width: entry.width }));
      boxes[index] = { left: left.left, right: left.left + width, width };
      boxes[index + 1] = { left: right.right - (total - width), right: right.right, width: total - width };
      return boxes;
    };
    this.beginGesture(event, current => {
      const boxes = calculate(current); if (boxes) this.previewRow(row, boxes);
    }, current => {
      const boxes = calculate(current);
      if (boxes) this.commitRow(row, boxes); else this.restoreRow(row);
    }, () => this.restoreRow(row), () => {
      if (minLeft + minRight <= total) {
        const width = Math.round(Math.max(minLeft, Math.min(total - minRight, total / 2)));
        const boxes = row.entries.map(entry => ({ left: entry.left, right: entry.right, width: entry.width }));
        boxes[index] = { left: left.left, right: left.left + width, width };
        boxes[index + 1] = { left: right.right - (total - width), right: right.right, width: total - width };
        this.commitRow(row, boxes);
      }
      this.props.editor.view.focus();
      this.props.setBoundaryTarget?.({ kind: 'vertical', before: other.props.getPos() });
    });
  }
  codeMinimumWidth() { return getContainerType(this.node).minimumWidth(this); }
  codeMinimumHeight() { return getContainerType(this.node).minimumHeight(this); }
  remove() {
    const { editor, getPos } = this.props, pos = getPos();
    const current = typeof pos === 'number' && editor.state.doc.nodeAt(pos);
    if (!current) return;
    const tr = closeHistory(editor.state.tr).delete(pos, pos + current.nodeSize);
    collapseRows(tr);
    editor.view.dispatch(tr);
    editor.commands.focus();
  }
  move(direction) {
    const { editor, getPos } = this.props, pos = getPos();
    if (typeof pos !== 'number') return;
    const $pos = editor.state.doc.resolve(pos);
    if ($pos.parent.type.name === 'layoutRow') {
      moveBlock(editor, pos, direction < 0 ? $pos.before() : $pos.after()); return;
    }
    const blocks = [], start = $pos.start();
    $pos.parent.forEach((child, offset) => blocks.push({ child, offset: start + offset }));
    const index = blocks.findIndex(block => block.offset === pos), target = blocks[index + direction];
    if (!target) return;
    moveBlock(editor, pos, direction < 0 ? target.offset : target.offset + target.child.nodeSize);
  }
  insertAfter(type) {
    const { editor, getPos } = this.props, pos = getPos();
    const current = typeof pos === 'number' && editor.state.doc.nodeAt(pos), nodeType = editor.schema.nodes[type];
    if (!current || !nodeType) return;
    const $pos = editor.state.doc.resolve(pos);
    const boundary = $pos.parent.type.name === 'layoutRow' ? $pos.after() : pos + current.nodeSize;
    const policy = containerTypes[type];
    const content = policy.initialContent(editor.schema);
    const attrs = policy.initialAttrs();
    const inserted = nodeType.createAndFill(attrs, content);
    if (!inserted) return;
    const tr = closeHistory(editor.state.tr).insert(boundary, inserted);
    const offset = policy.selectionOffset;
    tr.setSelection(NodeSelection.isSelectable(inserted) && inserted.isAtom ? NodeSelection.create(tr.doc, boundary) :
      TextSelection.create(tr.doc, boundary + offset));
    editor.view.dispatch(tr.scrollIntoView()); editor.view.dispatch(closeHistory(editor.state.tr)); editor.view.focus();
  }
  resetDimensions(axis, handle = null) {
    const row = this.rowSnapshot(), index = row?.entries.findIndex(entry => entry.view === this) ?? -1;
    const isCorner = handle?.classList.contains('container-resize-corner');
    if (axis === 'width' && row && index >= 0) {
      const boxes = row.entries.map(entry => ({ left: entry.left, right: entry.right, width: entry.width }));
      const current = boxes[index], previous = boxes[index - 1], next = boxes[index + 1];
      const fromLeft = handle === this.resizeLeft;
      const boundary = fromLeft ? (previous?.right ?? row.left) + (previous ? row.gap : 0) :
        (next?.left ?? row.right) - (next ? row.gap : 0);
      const width = fromLeft ? current.right - boundary : boundary - current.left;
      if (width >= this.codeMinimumWidth()) {
        boxes[index] = fromLeft ? { left: boundary, right: current.right, width } : { left: current.left, right: boundary, width };
        this.commitRow(row, boxes);
      }
      return;
    }
    const attrs = { ...(axis === 'width' || axis === 'both' && (!isCorner || !row) ? { boxWidth: null, boxOffsetX: null, boxAlign: 'justify' } : {}),
      ...(axis !== 'width' ? { boxHeight: null } : {}) };
    if (axis !== 'width') {
      const rect = this.dom.getBoundingClientRect();
      const left = row?.entries[index - 1], right = row?.entries[index + 1];
      const candidates = handle === this.resizeBottomLeft ? [left] : handle === this.resize ? [right] : [left, right];
      const chosen = candidates.filter(Boolean).sort((a, b) =>
        Math.abs(a.view.dom.getBoundingClientRect().bottom - rect.bottom) -
        Math.abs(b.view.dom.getBoundingClientRect().bottom - rect.bottom))[0];
      if (chosen) attrs.boxHeight = Math.round(rect.height + chosen.view.dom.getBoundingClientRect().bottom - rect.bottom);
    }
    this.updateAttrs(attrs);
  }
  updateAttrs(attrs) {
    attrs = getContainerType(this.node).normalizeAttrs(attrs, this);
    const { editor, getPos } = this.props, pos = getPos();
    const current = typeof pos === 'number' && editor.state.doc.nodeAt(pos);
    if (!current || current.type !== this.node.type) return;
    if (Object.entries(attrs).every(([key, value]) => current.attrs[key] === value)) return;
    editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, { ...current.attrs, ...attrs }));
    editor.view.dispatch(closeHistory(editor.state.tr));
  }
  paint() { ContainerVisual.paint(this); }
  update(node, ...args) {
    if (node.type !== this.node.type) return false;
    const engineAttrs = value => Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('box')));
    if (!this.inner.update && JSON.stringify(engineAttrs(node.attrs)) !== JSON.stringify(engineAttrs(this.node.attrs))) return false;
    if (this.inner.update && !this.inner.update(node, ...args)) return false;
    this.node = node; this.paint(); return true;
  }
  stopEvent(event) { return !!event.target.closest('.container-type-tools,.container-tools,.container-add-tools,.container-title,.container-caption,.container-resize,.container-resize-edge,.container-select-edge,.container-pair-resize,.container-gap-boundary') || !!this.inner.stopEvent?.(event); }
  ignoreMutation(mutation) {
    const target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
    if (target?.closest('.rich-label')) return true;
    if (mutation.type === 'selection') return false;
    if (!this.inner.dom.contains(mutation.target)) return true;
    return this.inner.ignoreMutation?.(mutation) ?? !this.contentDOM;
  }
  selectNode() { ContainerVisual.select(this, true); this.inner.selectNode?.(); }
  deselectNode() { ContainerVisual.select(this, false); this.inner.deselectNode?.(); }
  destroy() {
    this.activeGesture?.();
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    this.dom.removeEventListener('pointerleave', this.onPointerLeave);
    this.labels.forEach(label => label.destroy()); this.inner.destroy?.();
  }
}

export function setupContainers(editor, options) {
  let boundaryTarget = null;
  const boundaryFocus = document.createElement('span');
  boundaryFocus.tabIndex = -1;
  boundaryFocus.className = 'container-boundary-focus';
  boundaryFocus.setAttribute('aria-label', 'Miejsce między kontenerami');
  document.body.append(boundaryFocus);
  const endCaret = document.createElement('span');
  endCaret.className = 'container-end-caret';
  endCaret.setAttribute('aria-hidden', 'true');
  endCaret.hidden = true;
  document.body.append(endCaret);
  let endCaretAnchor = null;
  const hideEndCaret = () => {
    endCaret.hidden = true;
    endCaretAnchor = null;
    ContainerVisual.state(editor.view.dom, 'container-end-insertion', false);
  };
  const setBoundaryTarget = target => {
    boundaryTarget = { ...target, doc: editor.state.doc, note: options.noteId?.() };
    if (target.kind !== 'end') hideEndCaret();
    ContainerVisual.state(editor.view.dom, 'container-boundary-selected', target.kind !== 'end');
    if (target.kind !== 'end') boundaryFocus.focus();
    else editor.view.focus();
  };
  const viewOptions = { ...options, setBoundaryTarget };
  const original = { ...editor.view.nodeViews };
  const views = { ...original };
  for (const type of types) {
    views[type] = (node, view, getPos, decorations, innerDecorations) => {
      const $pos = view.state.doc.resolve(getPos());
      const inner = original[type]?.(node, view, getPos, decorations, innerDecorations) ||
        DOMSerializer.renderSpec(document, node.type.spec.toDOM(node));
      if (!['doc', 'layoutRow', 'blockGroup'].includes($pos.parent.type.name)) return inner;
      return new ContainerView(inner, { node, editor, getPos, noteId: options.noteId, setBoundaryTarget }, viewOptions);
    };
  }
  editor.view.setProps({ nodeViews: views });
  const containerFormat = 'application/x-notarium-container+json';
  const selectedContainer = () => {
    const selection = editor.state.selection;
    return selection instanceof NodeSelection && types.includes(selection.node.type.name) ? selection : null;
  };
  const onCopy = event => {
    const selection = selectedContainer();
    if (!selection || !event.clipboardData) return;
    const wrapper = [...editor.view.dom.querySelectorAll('.object-container')]
      .find(dom => dom.containerView?.props.getPos() === selection.from);
    const rect = wrapper?.getBoundingClientRect();
    const json = selection.node.toJSON();
    if (rect) json.attrs = { ...json.attrs, boxWidth: Math.round(rect.width), boxHeight: Math.round(rect.height), boxAlign: 'left' };
    event.clipboardData.setData(containerFormat, JSON.stringify(json));
    event.clipboardData.setData('text/plain', selection.node.textContent || '');
    event.preventDefault();
  };
  const activeBoundary = () => boundaryTarget?.doc === editor.state.doc &&
    boundaryTarget.note === options.noteId?.() ? boundaryTarget : null;
  const positionEndCaret = () => {
    if (activeBoundary()?.kind !== 'end' || !endCaretAnchor) { hideEndCaret(); return; }
    const last = [...editor.view.dom.children].filter(child => child.matches?.('.object-container,.layout-row')).at(-1);
    if (!last) { hideEndCaret(); return; }
    const editorRect = editor.view.dom.getBoundingClientRect(), lastRect = last.getBoundingClientRect();
    // This is the start of a new document line, never a free-position caret.
    ContainerVisual.placeCaret(endCaret, editorRect, lastRect);
    ContainerVisual.state(editor.view.dom, 'container-end-insertion', true);
  };
  const insertAtBoundary = (target, node, caretOffset = null) => {
    const pos = target.before, $pos = editor.state.doc.resolve(pos);
    if (target.kind === 'vertical' && $pos.parent.type.name !== 'layoutRow') return false;
    const inserted = target.kind === 'vertical' ? node.type.create(
      { ...node.attrs, boxOffsetX: null, boxAlign: 'left' }, node.content, node.marks) : node;
    let tr = closeHistory(editor.state.tr), insertionPos = pos;
    if (target.kind === 'vertical' && inserted.attrs.boxWidth) {
      const required = Math.round(inserted.attrs.boxWidth) + 22;
      const right = tr.doc.nodeAt(pos), left = $pos.nodeBefore;
      if (right?.attrs.boxEmpty && right.attrs.boxWidth) {
        const remaining = Math.round(right.attrs.boxWidth) - required;
        if (remaining > 0) tr = tr.setNodeMarkup(pos, undefined, { ...right.attrs, boxWidth: remaining });
        else tr = tr.delete(pos, pos + right.nodeSize);
      } else if (left?.attrs.boxEmpty && left.attrs.boxWidth) {
        const leftPos = pos - left.nodeSize, remaining = Math.round(left.attrs.boxWidth) - required;
        if (remaining > 0) tr = tr.setNodeMarkup(leftPos, undefined, { ...left.attrs, boxWidth: remaining });
        else { tr = tr.delete(leftPos, pos); insertionPos = leftPos; }
      }
    }
    tr = tr.insert(insertionPos, inserted);
    tr.setSelection(caretOffset == null ? NodeSelection.create(tr.doc, insertionPos) :
      TextSelection.create(tr.doc, insertionPos + caretOffset));
    boundaryTarget = null;
    hideEndCaret();
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.dispatch(closeHistory(editor.state.tr));
    editor.view.focus();
    return true;
  };
  const onPaste = event => {
    const selection = selectedContainer(), data = event.clipboardData?.getData(containerFormat);
    const target = activeBoundary();
    if ((!selection && !target) || !data) return;
    let clone;
    try { clone = editor.schema.nodeFromJSON(JSON.parse(data)); } catch { return; }
    if (!types.includes(clone.type.name)) return;
    if (target) {
      if (insertAtBoundary(target, clone)) { event.preventDefault(); event.stopImmediatePropagation(); }
      return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    const pos = selection.to, tr = closeHistory(editor.state.tr).insert(pos, clone);
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    editor.view.dispatch(tr.scrollIntoView()); editor.view.dispatch(closeHistory(editor.state.tr)); editor.view.focus();
  };
  const insertBoundaryText = value => {
    const target = activeBoundary();
    if (!target || !editor.isEditable) return false;
    const content = value ? editor.schema.text(value) : null;
    return insertAtBoundary(target, editor.schema.nodes.paragraph.create(null, content), 1 + value.length);
  };
  const onBoundaryKeydown = event => {
    if (activeBoundary()?.kind === 'end' && ['Backspace', 'Delete', 'Escape'].includes(event.key)) {
      if (event.key === 'Escape') { boundaryTarget = null; hideEndCaret(); }
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (insertBoundaryText(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  const onBoundaryBeforeInput = event => {
    if (event.inputType !== 'insertText' || !event.data) return;
    if (insertBoundaryText(event.data)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  const onBoundaryComposition = () => { insertBoundaryText(''); };
  const emptyContainerSelection = event => {
    const selection = editor.state.selection;
    if (selection instanceof NodeSelection && types.includes(selection.node.type.name)) return { from: selection.from, to: selection.to };
    if (!selection.empty) return null;
    const $from = selection.$from;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth), parent = $from.node(depth - 1);
      if (['doc', 'layoutRow', 'blockGroup'].includes(parent.type.name) && types.includes(node.type.name) && !node.textContent)
        return { from: $from.before(depth), to: $from.after(depth) };
    }
    const host = event.target.closest?.('.object-container');
    if (host && !host.textContent) {
      const from = editor.view.posAtDOM(host, 0), node = editor.state.doc.nodeAt(from);
      if (node && types.includes(node.type.name)) return { from, to: from + node.nodeSize };
    }
    return null;
  };
  const containerKeys = event => {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'a') {
      ContainerVisual.state(editor.view.dom, 'containers-all-selected', false);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
      event.preventDefault(); event.stopImmediatePropagation();
      boundaryTarget = null; hideEndCaret();
      ContainerVisual.state(editor.view.dom, 'container-boundary-selected', false);
      ContainerVisual.state(editor.view.dom, 'containers-all-selected', true);
      return;
    }
    const modifierOnly = ['Control', 'Shift', 'Meta', 'Alt'].includes(event.key);
    const preservedShortcut = (event.ctrlKey || event.metaKey) && ['c', 'x'].includes(event.key.toLowerCase());
    if (!modifierOnly && !preservedShortcut) ContainerVisual.state(editor.view.dom, 'containers-all-selected', false);
    if (activeBoundary()?.kind === 'end') return;
    const selection = selectedContainer();
    if (selection && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault(); event.stopImmediatePropagation();
      const tr = closeHistory(editor.state.tr).delete(selection.from, selection.to);
      collapseRows(tr);
      editor.view.dispatch(tr.scrollIntoView());
      editor.view.dispatch(closeHistory(editor.state.tr)); editor.view.focus();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const empty = emptyContainerSelection(event);
      if (!empty) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const tr = closeHistory(editor.state.tr).delete(empty.from, empty.to);
      collapseRows(tr);
      tr.setSelection(TextSelection.create(tr.doc, Math.min(empty.from, tr.doc.content.size)));
      editor.view.dispatch(tr.scrollIntoView());
      editor.view.dispatch(closeHistory(editor.state.tr)); editor.view.focus();
    }
  };
  editor.view.dom.addEventListener('keydown', containerKeys, true);
  editor.view.dom.addEventListener('keydown', onBoundaryKeydown, true);
  boundaryFocus.addEventListener('keydown', onBoundaryKeydown, true);
  editor.view.dom.addEventListener('beforeinput', onBoundaryBeforeInput, true);
  editor.view.dom.addEventListener('compositionstart', onBoundaryComposition, true);
  editor.view.dom.addEventListener('copy', onCopy, true);
  editor.view.dom.addEventListener('paste', onPaste, true);
  boundaryFocus.addEventListener('paste', onPaste, true);
  const onClickBelowLast = event => {
    if (event.button !== 0 || !editor.isEditable || !options.noteId?.()) return;
    if (event.target.closest?.('.object-container,.layout-row,.container-add-tools')) return;
    const blocks = [...editor.view.dom.children].filter(child => child.matches?.('.object-container,.layout-row'));
    const lastDom = blocks.at(-1);
    if (!lastDom) return;
    const lastRect = lastDom.getBoundingClientRect();
    if (event.clientY <= lastRect.bottom + 6) return;
    const last = editor.state.doc.lastChild;
    if (!last) return;
    const position = editor.state.doc.content.size;
    if (last.type.name === 'paragraph' && !last.content.size) {
      boundaryTarget = null;
      hideEndCaret();
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, position - 1)));
    } else {
      setBoundaryTarget({ kind: 'end', before: position });
      endCaretAnchor = {};
      positionEndCaret();
    }
    editor.view.focus();
    event.preventDefault(); event.stopPropagation();
  };
  editor.view.dom.parentElement.addEventListener('mousedown', onClickBelowLast, true);
  const clearBoundaryOnOtherClick = event => {
    if (!event.target.closest?.('.container-pair-resize,.container-gap-boundary')) {
      boundaryTarget = null;
      hideEndCaret();
      ContainerVisual.state(editor.view.dom, 'container-boundary-selected', false);
    }
  };
  document.addEventListener('pointerdown', clearBoundaryOnOtherClick, true);
  let rowHover = [];
  const gapAtPoint = (x, y) => {
    const rows = [...editor.view.dom.querySelectorAll('.layout-row')];
    for (const row of rows) {
      const rowRect = row.getBoundingClientRect();
      if (y < rowRect.top || y > rowRect.bottom) continue;
      const entries = [...row.children].filter(dom => dom.matches?.('.object-container'))
        .map(dom => ({ dom, rect: dom.getBoundingClientRect() })).sort((a, b) => a.rect.left - b.rect.left);
      for (let index = 0; index < entries.length - 1; index++) {
        const left = entries[index], right = entries[index + 1];
        if (x >= left.rect.right && x <= right.rect.left) return { left, right };
      }
    }
    return null;
  };
  const rowBoundaryAtPoint = (x, y) => {
    const blocks = [...editor.view.dom.children].filter(dom => dom.matches?.('.object-container,.layout-row'));
    for (let index = 0; index < blocks.length - 1; index++) {
      const current = blocks[index], next = blocks[index + 1];
      const currentRect = current.getBoundingClientRect(), nextRect = next.getBoundingClientRect();
      if (y >= currentRect.bottom && y < nextRect.top) return next;
      if (current.matches('.layout-row') && y >= currentRect.top && y <= currentRect.bottom &&
          x >= currentRect.left && x <= currentRect.right &&
          ![...current.querySelectorAll(':scope > .object-container')].some(dom => {
            const rect = dom.getBoundingClientRect();
            return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
          })) return next;
    }
    return null;
  };
  const setRowHover = next => {
    const items = (Array.isArray(next) ? next : next ? [next] : []).filter(Boolean);
    if (items.length === rowHover.length && items.every((item, index) => item === rowHover[index])) return;
    ContainerVisual.hover(rowHover, false);
    rowHover = items;
    ContainerVisual.hover(rowHover, true);
    const type = rowHover[0]?.dataset.containerType;
    const label = ({ codeCell: 'Code Cell', codeBlock: 'Code Block', blockMath: 'Math', image: 'Picture', table: 'Table',
      bulletList: 'List', orderedList: 'List', taskList: 'Task List', blockGroup: 'Container' })[type] || (type ? 'Text' : '');
    window.chrome?.webview?.postMessage({ type: 'containerHover', label });
  };
  document.addEventListener('pointermove', event => {
    const pairLine = event.target.closest?.('.container-pair-resize');
    if (pairLine) {
      const left = pairLine.parentElement;
      let right = left?.nextElementSibling;
      while (right && !right.matches?.('.object-container')) right = right.nextElementSibling;
      setRowHover([left, right]); return;
    }
    const gapLine = event.target.closest?.('.container-gap-boundary');
    if (gapLine) {
      const right = gapLine.parentElement;
      let left = right?.previousElementSibling;
      while (left && !left.matches?.('.object-container')) left = left.previousElementSibling;
      setRowHover([left, right]); return;
    }
    const direct = event.target.closest?.('.object-container');
    if (direct) { setRowHover(direct); return; }
    const editorRect = editor.view.dom.parentElement.getBoundingClientRect();
    if (event.clientX < editorRect.left || event.clientX > editorRect.right || event.clientY < editorRect.top || event.clientY > editorRect.bottom) {
      setRowHover(null); return;
    }
    const gap = gapAtPoint(event.clientX, event.clientY);
    if (gap) { setRowHover([gap.left.dom, gap.right.dom]); return; }
    const candidates = [...editor.view.dom.querySelectorAll('.object-container')].map(dom => ({ dom, rect: dom.getBoundingClientRect() }))
      .filter(({ rect }) => event.clientY >= rect.top && event.clientY <= rect.bottom);
    const ordered = candidates.slice().sort((a, b) => a.rect.left - b.rect.left);
    for (let index = 0; index < ordered.length - 1; index++) {
      const left = ordered[index], right = ordered[index + 1];
      if (event.clientX > left.rect.right && event.clientX < right.rect.left) {
        setRowHover([left.dom, right.dom]); return;
      }
    }
    candidates.sort((a, b) => {
      const distance = rect => event.clientX < rect.left ? rect.left - event.clientX : event.clientX > rect.right ? event.clientX - rect.right : 0;
      return distance(a.rect) - distance(b.rect) || a.rect.width * a.rect.height - b.rect.width * b.rect.height;
    });
    setRowHover(candidates[0]?.dom || null);
  }, true);
  const selectGap = event => {
    if (event.button !== 0 || event.target.closest?.('.container-pair-resize,.container-gap-boundary,.container-type-tools,.container-tools,.container-resize,.container-resize-edge,.container-add-tools')) return;
    const horizontal = rowBoundaryAtPoint(event.clientX, event.clientY);
    const empty = event.target.closest?.('.object-container.container-empty');
    const row = empty?.parentElement;
    const hasNeighbors = row?.matches('.layout-row') && empty.previousElementSibling?.matches('.object-container') && empty.nextElementSibling?.matches('.object-container');
    if (event.target.closest?.('.object-container') && !hasNeighbors && !horizontal) return;
    const gap = hasNeighbors || horizontal ? null : gapAtPoint(event.clientX, event.clientY);
    const before = horizontal ? editor.view.posAtDOM(horizontal, 0) :
      (hasNeighbors ? empty : gap?.right.dom)?.containerView?.props.getPos();
    if (typeof before !== 'number') return;
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(before), -1)));
    setBoundaryTarget({ kind: horizontal ? 'horizontal' : 'vertical', before });
    ContainerVisual.state(editor.view.dom, 'containers-all-selected', false);
    event.preventDefault(); event.stopImmediatePropagation();
  };
  editor.view.dom.parentElement.addEventListener('pointerdown', selectGap, true);
  editor.view.dom.parentElement.addEventListener('mousedown', selectGap, true);
  const preventBoundaryClick = event => {
    if (ContainerInteractions.isControl(event.target)) return;
    if (!rowBoundaryAtPoint(event.clientX, event.clientY)) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  editor.view.dom.parentElement.addEventListener('click', preventBoundaryClick, true);
  const preventRowDoubleClick = event => {
    if (ContainerInteractions.isControl(event.target)) return;
    if (rowBoundaryAtPoint(event.clientX, event.clientY)) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (event.target.closest?.('.object-container,.container-resize,.container-resize-edge,.container-pair-resize,.container-gap-boundary')) return;
    if (!editor.view.dom.parentElement.contains(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  editor.view.dom.parentElement.addEventListener('dblclick', preventRowDoubleClick, true);
  editor.on('destroy', () => {
    endCaret.remove();
    boundaryFocus.remove();
    document.removeEventListener('pointerdown', clearBoundaryOnOtherClick, true);
    setRowHover(null);
    editor.view.dom.removeEventListener('keydown', containerKeys, true);
    editor.view.dom.removeEventListener('keydown', onBoundaryKeydown, true);
    boundaryFocus.removeEventListener('keydown', onBoundaryKeydown, true);
    editor.view.dom.removeEventListener('beforeinput', onBoundaryBeforeInput, true);
    editor.view.dom.removeEventListener('compositionstart', onBoundaryComposition, true);
    editor.view.dom.removeEventListener('copy', onCopy, true);
    editor.view.dom.removeEventListener('paste', onPaste, true);
    boundaryFocus.removeEventListener('paste', onPaste, true);
    editor.view.dom.parentElement.removeEventListener('mousedown', onClickBelowLast, true);
    editor.view.dom.parentElement.removeEventListener('pointerdown', selectGap, true);
    editor.view.dom.parentElement.removeEventListener('mousedown', selectGap, true);
    editor.view.dom.parentElement.removeEventListener('click', preventBoundaryClick, true);
    editor.view.dom.parentElement.removeEventListener('dblclick', preventRowDoubleClick, true);
  });
}
export function alignContainer(editor, alignment) {
  const selection = editor.state.selection;
  if (!(selection instanceof NodeSelection)) return false;
  const node = selection.node;
  if (!types.includes(node.type.name)) return false;
  const attrs = { ...node.attrs, boxAlign: alignment, ...(alignment === 'justify' ? { boxWidth: null, boxOffsetX: null } : {}) };
  editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(selection.from, undefined, getContainerType(node).copyAttrs(attrs)));
  return true;
}
