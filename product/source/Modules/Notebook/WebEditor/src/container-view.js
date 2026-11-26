import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { ContainerGeometry } from './container-geometry.js';
import { ContainerVisual } from './container-visual.js';
import { ContainerInteractions } from './container-interactions.js';
import { collapseRows, moveBlock } from './block-movement.js';
import { containerTypes, getContainerType } from './container-types.js';
import { targetElement } from './dom-target.js';

export class ContainerView extends ContainerGeometry {
  constructor(inner, props, options) {
    super();
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
  stopEvent(event) { return !!targetElement(event.target)?.closest('.container-type-tools,.container-tools,.container-add-tools,.container-title,.container-caption,.container-resize,.container-resize-edge,.container-select-edge,.container-pair-resize,.container-gap-boundary') || !!this.inner.stopEvent?.(event); }
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

