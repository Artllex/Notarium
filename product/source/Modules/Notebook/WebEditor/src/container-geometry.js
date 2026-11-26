import { closeHistory } from '@tiptap/pm/history';
import { ContainerVisual } from './container-visual.js';

// Geometry previews and their document transactions share one gesture owner.
export class ContainerGeometry {
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
}
