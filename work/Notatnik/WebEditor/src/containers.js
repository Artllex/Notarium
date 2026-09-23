import { Extension, Node } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { RichLabelView, richAttribute } from './rich-label.js';
import { collapseRows, moveBlock } from './block-movement.js';

const types = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList', 'codeBlock', 'codeCell', 'image', 'blockMath', 'table', 'blockGroup'];
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
    this.dom = document.createElement('section'); this.dom.className = 'object-container';
    this.dom.dataset.containerType = this.node.type.name;
    this.dom.containerView = this;
    this.contentDOM = inner.contentDOM;
    this.header = document.createElement('div'); this.header.className = 'container-title';
    this.footer = document.createElement('div'); this.footer.className = 'container-caption';
    this.tools = document.createElement('div'); this.tools.className = 'container-tools';
    this.tools.contentEditable = this.header.contentEditable = this.footer.contentEditable = 'false';
    const settings = document.createElement('button'); settings.type = 'button'; settings.title = 'Tytuł, stopka i wymiary';
    settings.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); options.editContainer(this); });
    const typeLabel = document.createElement('span'); typeLabel.className = 'container-type-label';
    typeLabel.dataset.label = ({ blockMath: 'Math', codeCell: 'Code', codeBlock: 'Code', image: 'Picture', table: 'Table' })[this.node.type.name] || 'Text';
    typeLabel.setAttribute('aria-label', typeLabel.dataset.label);
    typeLabel.title = 'Przeciągnij kontener';
    this.tools.append(typeLabel, settings);
    this.addTools = document.createElement('div'); this.addTools.className = 'container-add-tools'; this.addTools.contentEditable = 'false';
    for (const [label, title, action] of [
      ['↑', 'Przenieś kontener w górę', () => this.move(-1)],
      ['↓', 'Przenieś kontener w dół', () => this.move(1)],
      ['×', 'Usuń kontener', () => this.remove()]
    ]) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.label = label; button.className = 'container-action-button';
      button.setAttribute('aria-label', title); button.title = title;
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); action(); });
      this.addTools.append(button);
    }
    for (const [label, title, type] of [
      ['+ text', 'Add text container', 'paragraph'],
      ['+ code block', 'Add code block', 'codeBlock'],
      ['+ code cell', 'Add code cell', 'codeCell'],
      ['+ math', 'Add math container', 'blockMath']
    ]) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.label = label; button.dataset.action = type;
      button.setAttribute('aria-label', label); button.title = title;
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); this.insertAfter(type); });
      this.addTools.append(button);
    }
    this.resize = document.createElement('span'); this.resize.className = 'container-resize container-resize-corner container-resize-bottom-right'; this.resize.contentEditable = 'false';
    this.resize.title = 'Zmień szerokość i wysokość';
    this.resizeRight = document.createElement('span'); this.resizeRight.className = 'container-resize-edge container-resize-right';
    this.resizeLeft = document.createElement('span'); this.resizeLeft.className = 'container-resize-edge container-resize-left';
    this.resizeBottom = document.createElement('span'); this.resizeBottom.className = 'container-resize-edge container-resize-bottom';
    this.selectTop = document.createElement('span'); this.selectTop.className = 'container-select-edge container-select-top';
    this.pairResize = document.createElement('span'); this.pairResize.className = 'container-pair-resize';
    this.gapBoundary = document.createElement('span'); this.gapBoundary.className = 'container-gap-boundary';
    this.resizeBottomLeft = document.createElement('span'); this.resizeBottomLeft.className = 'container-resize container-resize-corner container-resize-bottom-left';
    this.resizeRight.contentEditable = this.resizeLeft.contentEditable = this.resizeBottom.contentEditable = this.resizeBottomLeft.contentEditable = this.selectTop.contentEditable = this.pairResize.contentEditable = this.gapBoundary.contentEditable = 'false';
    this.resizeRight.title = this.resizeLeft.title = 'Zmień szerokość'; this.resizeBottom.title = this.resizeBottomLeft.title = 'Zmień wysokość i szerokość';
    this.dom.append(this.tools, this.header, inner.dom, this.footer, this.addTools, this.resize);
    this.dom.append(this.resizeRight, this.resizeLeft, this.resizeBottom, this.resizeBottomLeft, this.selectTop, this.pairResize, this.gapBoundary);
    this.selectTop.title = 'Zaznacz kontener';
    this.selectTop.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); event.stopPropagation(); this.select(); } });
    this.selectTop.addEventListener('mousedown', event => { if (event.button === 0) { event.preventDefault(); event.stopPropagation(); this.select(); } });
    this.selectTop.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); this.select(); });
    this.pairResize.title = 'Przeciągnij: zmień szerokości; kliknij: wyrównaj i wybierz miejsce wklejenia';
    this.pairResize.addEventListener('pointerdown', event => this.resizePair(event));
    this.gapBoundary.title = this.pairResize.title;
    this.gapBoundary.addEventListener('pointerdown', event => {
      const previous = this.dom.previousElementSibling?.containerView;
      if (previous?.dom.parentElement === this.dom.parentElement) previous.resizePair(event);
    });
    for (const [handle, axis] of [[this.resize, 'both'], [this.resizeRight, 'width'], [this.resizeLeft, 'width'], [this.resizeBottom, 'height'], [this.resizeBottomLeft, 'both']]) handle.addEventListener('dblclick', event => {
      event.preventDefault(); event.stopPropagation();
      if (performance.now() - (this.lastEdgeReset || 0) < 300) return;
      this.resetDimensions(axis, handle);
    });
    this.dom.addEventListener('mousedown', event => {
      if (event.target === this.dom || event.target === typeLabel) this.select();
    });
    this.dom.addEventListener('dblclick', event => {
      if (event.target.closest('.object-container') !== this.dom) return;
      if (event.target.closest('input,button,.container-title,.container-caption,.image-title,figcaption,.cm-editor')) return;
      const pos = this.props.getPos(); if (typeof pos !== 'number') return;
      if (this.node.type.name === 'image' && !options.imageDialogOpen()) { event.preventDefault(); options.editImage(this.node, pos); }
      else if (this.node.type.name === 'blockMath') { event.preventDefault(); options.openMath(this.node, pos); }
      else if (event.target === this.dom || event.target === typeLabel || this.node.type.name === 'table' &&
        (!event.target.closest('td,th') || event.clientX < this.dom.getBoundingClientRect().left + 5 || event.clientX > this.dom.getBoundingClientRect().right - 5)) {
        event.preventDefault(); options.editContainer(this);
      }
    });
    this.labels = [new RichLabelView(this.header, props.editor, props.getPos, 'boxTitle', 'Tytuł kontenera'),
      new RichLabelView(this.footer, props.editor, props.getPos, 'boxCaption', 'Stopka kontenera')];
    for (const [handle, axis] of [[this.resize, 'both'], [this.resizeRight, 'width'], [this.resizeLeft, 'width'], [this.resizeBottom, 'height'], [this.resizeBottomLeft, 'both']])
      handle.addEventListener('pointerdown', event => this.resizeEdge(event, handle, axis));
    this.onPointerMove = event => {
      const rect = this.dom.getBoundingClientRect(), nearBottom = event.clientY >= rect.bottom - 18;
      this.dom.classList.toggle('corner-near-left', nearBottom && event.clientX <= rect.left + 18);
      this.dom.classList.toggle('corner-near-right', nearBottom && event.clientX >= rect.right - 18);
    };
    this.onPointerLeave = () => this.dom.classList.remove('corner-near-left', 'corner-near-right');
    this.dom.addEventListener('pointermove', this.onPointerMove);
    this.dom.addEventListener('pointerleave', this.onPointerLeave);
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
  previewRow(snapshot, boxes) {
    const { entries, gap, left } = snapshot;
    for (let i = 0; i < entries.length; i++) {
      const { view } = entries[i], box = boxes[i];
      view.dom.dataset.align = 'left';
      view.dom.style.width = box.width + 'px';
      view.dom.style.marginLeft = (box.left - (i ? boxes[i - 1].right + gap : left)) + 'px';
      view.previewImageWidth(box.width);
    }
    for (const entry of entries) entry.view.positionPair();
  }
  commitRow(snapshot, boxes, height = null) {
    const { editor } = this.props;
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
    if (changed) { editor.view.dispatch(tr); editor.view.dispatch(closeHistory(editor.state.tr)); }
    else this.restoreRow(snapshot);
  }
  restoreRow(snapshot) {
    if (snapshot) for (const entry of snapshot.entries) entry.view.paint();
    else this.paint();
  }
  previewHeight(height) {
    this.dom.style.minHeight = height + 'px';
    if (this.node.type.name === 'codeCell' || this.node.type.name === 'codeBlock') {
      this.dom.style.height = height + 'px';
      this.inner.dom.style.minHeight = height + 'px';
      this.inner.dom.style.height = height + 'px';
    }
  }
  previewImageWidth(width) {
    if (this.node.type.name !== 'image') return;
    this.inner.dom.style.width = width + 'px';
    const image = this.inner.dom.querySelector('img');
    if (image) image.width = width;
  }
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
    const calculate = current => {
      let width, left = bounds.left;
      if (axis !== 'height') {
        const minLeft = Math.max(row?.left ?? baseLeft, prior ? prior.right + row.gap : -Infinity);
        const maxRight = Math.min(row?.right ?? baseRight, next ? next.left - row.gap : Infinity);
        if (fromLeft) {
          left = Math.min(bounds.right - minimum, Math.max(minLeft, bounds.left + current.clientX - event.clientX));
          width = Math.round(bounds.right - left);
        } else width = Math.round(Math.max(minimum, Math.min(maxRight - bounds.left, bounds.width + current.clientX - event.clientX)));
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
        this.dom.dataset.align = 'left';
        this.dom.style.width = result.width + 'px';
        this.dom.style.marginLeft = (result.left - baseLeft) + 'px';
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
  positionPair() {
    let next = this.dom.nextElementSibling;
    while (next && !next.matches?.('.object-container')) next = next.nextElementSibling;
    if (!next) { this.pairResize.style.right = ''; return; }
    const rect = this.dom.getBoundingClientRect(), nextRect = next.getBoundingClientRect();
    const gap = Math.max(0, nextRect.left - rect.right);
    const standardGap = Number.parseFloat(getComputedStyle(this.dom.parentElement).columnGap) || 22;
    const inset = Math.min(gap / 2, standardGap / 2);
    this.pairResize.style.right = -(inset + this.pairResize.offsetWidth / 2) + 'px';
    const otherBoundary = next.containerView?.gapBoundary;
    if (otherBoundary) {
      otherBoundary.style.left = -(inset + 5) + 'px';
      otherBoundary.style.display = gap > standardGap + 2 ? 'block' : '';
    }
  }
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
  codeMinimumWidth() {
    if (!['codeCell', 'codeBlock'].includes(this.node.type.name)) return 80;
    if (this.node.attrs.codeAllowNarrow) return 164;
    const content = this.inner.dom.querySelector('.cm-content');
    const context = document.createElement('canvas').getContext('2d');
    if (!context || !content) return 164;
    context.font = getComputedStyle(content).font;
    const widest = Math.max(0, ...this.node.textContent.split('\n').map(line => context.measureText(line).width));
    return Math.ceil(Math.max(164, widest + (this.node.type.name === 'codeCell' ? 70 : 32)));
  }
  codeMinimumHeight() {
    if (!['codeCell', 'codeBlock'].includes(this.node.type.name) || this.node.attrs.codeAllowNarrow) return 32;
    const content = this.inner.dom.querySelector('.cm-content');
    const tools = this.inner.dom.querySelector('.cell-tools');
    if (!content) return 32;
    const style = getComputedStyle(content);
    const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.4 || 20;
    const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
    const lines = Math.max(1, this.node.textContent.split('\n').length);
    return Math.ceil((tools?.getBoundingClientRect().height || 30) + lines * lineHeight + padding + 2);
  }
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
    const content = type === 'blockGroup' ? editor.schema.nodes.paragraph.create() : null;
    const attrs = type === 'codeCell' ? { language: 'python' } : null;
    const inserted = nodeType.createAndFill(attrs, content);
    if (!inserted) return;
    const tr = closeHistory(editor.state.tr).insert(boundary, inserted);
    const offset = type === 'blockGroup' ? 2 : 1;
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
    if (attrs.boxWidth != null && ['codeCell', 'codeBlock'].includes(this.node.type.name)) attrs = { ...attrs, boxWidth: Math.max(this.codeMinimumWidth(), attrs.boxWidth) };
    if (attrs.boxWidth != null && this.node.type.name === 'image') attrs = { ...attrs, width: attrs.boxWidth };
    if (attrs.boxHeight != null && ['codeCell', 'codeBlock'].includes(this.node.type.name)) attrs = { ...attrs, boxHeight: Math.max(this.codeMinimumHeight(), attrs.boxHeight) };
    const { editor, getPos } = this.props, pos = getPos();
    const current = typeof pos === 'number' && editor.state.doc.nodeAt(pos);
    if (!current || current.type !== this.node.type) return;
    if (Object.entries(attrs).every(([key, value]) => current.attrs[key] === value)) return;
    editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, { ...current.attrs, ...attrs }));
    editor.view.dispatch(closeHistory(editor.state.tr));
  }
  paint() {
    const a = this.node.attrs;
    const codeContainer = this.node.type.name === 'codeCell' || this.node.type.name === 'codeBlock';
    const visibleHeight = codeContainer && a.boxHeight && !a.codeAllowNarrow ?
      Math.max(a.boxHeight, this.codeMinimumHeight()) : a.boxHeight;
    this.dom.style.backgroundColor = backgroundColor(a.boxBackground) || '';
    this.dom.style.width = a.boxWidth ? a.boxWidth + 'px' : this.node.type.name === 'image' ? (a.width || 200) + 'px' : '';
    if (this.node.type.name === 'image') this.previewImageWidth(a.boxWidth || a.width || 200);
    this.dom.style.marginLeft = a.boxOffsetX ? a.boxOffsetX + 'px' : '';
    this.dom.style.minHeight = visibleHeight ? visibleHeight + 'px' : '';
    this.dom.style.height = codeContainer && visibleHeight ? visibleHeight + 'px' : '';
    this.inner.dom.style.minHeight = codeContainer && visibleHeight ? visibleHeight + 'px' : '';
    this.inner.dom.style.height = codeContainer && visibleHeight ? visibleHeight + 'px' : '';
    this.dom.dataset.align = a.boxWidth && this.dom.parentElement?.matches('.layout-row') ? 'left' :
      a.boxAlign || (a.placement === 'block-center' ? 'center' : a.placement === 'block-right' ? 'right' : 'left');
    requestAnimationFrame(() => { if (this.dom.isConnected) this.positionAdjacentPairs(); });
    this.labels.forEach(label => label.update(this.node));
  }
  update(node, ...args) {
    if (node.type !== this.node.type) return false;
    const engineAttrs = value => Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('box')));
    if (!this.inner.update && JSON.stringify(engineAttrs(node.attrs)) !== JSON.stringify(engineAttrs(this.node.attrs))) return false;
    if (this.inner.update && !this.inner.update(node, ...args)) return false;
    this.node = node; this.paint(); return true;
  }
  stopEvent(event) { return !!event.target.closest('.container-tools,.container-add-tools,.container-title,.container-caption,.container-resize,.container-resize-edge,.container-select-edge,.container-pair-resize,.container-gap-boundary') || !!this.inner.stopEvent?.(event); }
  ignoreMutation(mutation) {
    const target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
    if (target?.closest('.rich-label')) return true;
    if (mutation.type === 'selection') return false;
    if (!this.inner.dom.contains(mutation.target)) return true;
    return this.inner.ignoreMutation?.(mutation) ?? !this.contentDOM;
  }
  selectNode() { this.dom.classList.add('container-selected'); this.inner.selectNode?.(); }
  deselectNode() { this.dom.classList.remove('container-selected'); this.inner.deselectNode?.(); }
  destroy() {
    this.activeGesture?.();
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    this.dom.removeEventListener('pointerleave', this.onPointerLeave);
    this.labels.forEach(label => label.destroy()); this.inner.destroy?.();
  }
}

export function setupContainers(editor, options) {
  let boundaryTarget = null;
  const setBoundaryTarget = target => {
    boundaryTarget = { ...target, doc: editor.state.doc, note: options.noteId?.() };
    editor.view.focus();
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
    event.clipboardData.setData(containerFormat, JSON.stringify(selection.node.toJSON()));
    event.clipboardData.setData('text/plain', selection.node.textContent || '');
    event.preventDefault();
  };
  const activeBoundary = () => boundaryTarget?.doc === editor.state.doc &&
    boundaryTarget.note === options.noteId?.() ? boundaryTarget : null;
  const insertAtBoundary = (target, node, caretOffset = null) => {
    const pos = target.before, $pos = editor.state.doc.resolve(pos);
    if (target.kind === 'vertical' && $pos.parent.type.name !== 'layoutRow') return false;
    if (target.kind === 'horizontal' && $pos.parent.type.name === 'layoutRow') return false;
    const inserted = target.kind === 'vertical' ? node.type.create(
      { ...node.attrs, boxWidth: null, boxOffsetX: null, boxAlign: 'left' }, node.content, node.marks) : node;
    const tr = closeHistory(editor.state.tr).insert(pos, inserted);
    if (target.kind === 'vertical') {
      const $inserted = tr.doc.resolve(pos), row = $inserted.parent;
      let offset = $inserted.start();
      row.forEach(child => {
        if (child.attrs.boxWidth || child.attrs.boxOffsetX) tr.setNodeMarkup(offset, undefined,
          { ...child.attrs, boxWidth: null, boxOffsetX: null, boxAlign: 'left' });
        offset += child.nodeSize;
      });
    }
    tr.setSelection(caretOffset == null ? NodeSelection.create(tr.doc, pos) :
      TextSelection.create(tr.doc, pos + caretOffset));
    boundaryTarget = null;
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
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (insertBoundaryText(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  const onBoundaryBeforeInput = event => {
    if (event.inputType !== 'insertText' || !event.data) return;
    if (insertBoundaryText(event.data)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  const onBoundaryComposition = () => { insertBoundaryText(''); };
  const containerKeys = event => {
    const selection = selectedContainer();
    if (selection && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault(); event.stopImmediatePropagation();
      const tr = closeHistory(editor.state.tr).delete(selection.from, selection.to);
      collapseRows(tr);
      editor.view.dispatch(tr.scrollIntoView());
      editor.view.dispatch(closeHistory(editor.state.tr)); editor.view.focus();
    }
  };
  editor.view.dom.addEventListener('keydown', containerKeys, true);
  editor.view.dom.addEventListener('keydown', onBoundaryKeydown, true);
  editor.view.dom.addEventListener('beforeinput', onBoundaryBeforeInput, true);
  editor.view.dom.addEventListener('compositionstart', onBoundaryComposition, true);
  editor.view.dom.addEventListener('copy', onCopy, true);
  editor.view.dom.addEventListener('paste', onPaste, true);
  const onClickBelowLast = event => {
    if (event.button !== 0 || !editor.isEditable || !options.noteId?.()) return;
    if (event.target.closest?.('.object-container,.layout-row,.container-add-tools,.container-horizontal-layer')) return;
    const blocks = [...editor.view.dom.children].filter(child => child.matches?.('.object-container,.layout-row'));
    const lastDom = blocks.at(-1);
    if (!lastDom || event.clientY <= lastDom.getBoundingClientRect().bottom + 6) return;
    const last = editor.state.doc.lastChild;
    if (!last) return;
    const position = editor.state.doc.content.size;
    if (last.type.name === 'paragraph' && !last.content.size) {
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, position - 1)));
    } else {
      const tr = closeHistory(editor.state.tr).insert(position, editor.schema.nodes.paragraph.create());
      tr.setSelection(TextSelection.create(tr.doc, position + 1));
      editor.view.dispatch(tr.scrollIntoView());
      editor.view.dispatch(closeHistory(editor.state.tr));
    }
    editor.view.focus();
    event.preventDefault(); event.stopPropagation();
  };
  editor.view.dom.parentElement.addEventListener('mousedown', onClickBelowLast, true);
  const clearBoundaryOnOtherClick = event => {
    if (!event.target.closest?.('.container-pair-resize,.container-gap-boundary,.container-between-horizontal')) boundaryTarget = null;
  };
  document.addEventListener('pointerdown', clearBoundaryOnOtherClick, true);
  // Dividers are outside ProseMirror's content DOM: a line never becomes an editable node.
  const horizontalLayer = document.createElement('div');
  horizontalLayer.className = 'container-horizontal-layer';
  document.body.append(horizontalLayer);
  let horizontalFrame = 0;
  let watchedHorizontal = new Set();
  const drawHorizontal = () => {
    horizontalFrame = 0;
    horizontalLayer.replaceChildren();
    const nextWatched = new Set();
    for (const parent of [editor.view.dom, ...editor.view.dom.querySelectorAll('.block-group-content')]) {
      const children = [...parent.children].filter(child => child.matches?.('.object-container,.layout-row'));
      for (const child of children) {
        if (!watchedHorizontal.has(child)) horizontalObserver.observe(child);
        nextWatched.add(child);
      }
      for (let i = 0; i < children.length - 1; i++) {
        const upper = children[i].getBoundingClientRect(), lower = children[i + 1].getBoundingClientRect();
        const host = parent.getBoundingClientRect();
        const gap = lower.top - upper.bottom;
        if (gap < 12 || host.width <= 0) continue;
        const line = document.createElement('span');
        line.className = 'container-between-horizontal';
        line.style.left = host.left + 'px';
        line.style.top = upper.bottom + 10 + 'px';
        line.style.height = Math.min(10, gap - 10) + 'px';
        line.style.width = host.width + 'px';
        line.title = 'Miejsce wklejenia kontenera';
        line.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          event.preventDefault(); event.stopPropagation();
          const before = editor.view.posAtDOM(parent, [...parent.childNodes].indexOf(children[i + 1]));
          setBoundaryTarget({ kind: 'horizontal', before });
        });
        horizontalLayer.append(line);
      }
    }
    for (const element of watchedHorizontal) if (!nextWatched.has(element)) horizontalObserver.unobserve(element);
    watchedHorizontal = nextWatched;
  };
  const scheduleHorizontal = () => {
    horizontalLayer.replaceChildren();
    if (!horizontalFrame) horizontalFrame = requestAnimationFrame(drawHorizontal);
  };
  const horizontalObserver = new ResizeObserver(scheduleHorizontal);
  horizontalObserver.observe(editor.view.dom);
  const horizontalMutations = new MutationObserver(scheduleHorizontal);
  horizontalMutations.observe(editor.view.dom, { childList: true, subtree: true });
  editor.on('transaction', scheduleHorizontal);
  window.addEventListener('resize', scheduleHorizontal);
  document.addEventListener('scroll', scheduleHorizontal, true);
  scheduleHorizontal();
  let rowHover = null;
  const setRowHover = next => {
    if (next === rowHover) return;
    rowHover?.classList.remove('container-row-hover');
    rowHover = next;
    rowHover?.classList.add('container-row-hover');
    const type = rowHover?.dataset.containerType;
    const label = ({ codeCell: 'Code Cell', codeBlock: 'Code Block', blockMath: 'Math', image: 'Picture', table: 'Table',
      bulletList: 'List', orderedList: 'List', taskList: 'Task List', blockGroup: 'Container' })[type] || (type ? 'Text' : '');
    window.chrome?.webview?.postMessage({ type: 'containerHover', label });
  };
  document.addEventListener('pointermove', event => {
    const direct = event.target.closest?.('.object-container');
    if (direct) { setRowHover(direct); return; }
    const editorRect = editor.view.dom.parentElement.getBoundingClientRect();
    if (event.clientX < editorRect.left || event.clientX > editorRect.right || event.clientY < editorRect.top || event.clientY > editorRect.bottom) {
      setRowHover(null); return;
    }
    const candidates = [...editor.view.dom.querySelectorAll('.object-container')].map(dom => ({ dom, rect: dom.getBoundingClientRect() }))
      .filter(({ rect }) => event.clientY >= rect.top && event.clientY <= rect.bottom);
    candidates.sort((a, b) => {
      const distance = rect => event.clientX < rect.left ? rect.left - event.clientX : event.clientX > rect.right ? event.clientX - rect.right : 0;
      return distance(a.rect) - distance(b.rect) || a.rect.width * a.rect.height - b.rect.width * b.rect.height;
    });
    setRowHover(candidates[0]?.dom || null);
  }, true);
  editor.on('destroy', () => {
    cancelAnimationFrame(horizontalFrame);
    horizontalObserver.disconnect();
    horizontalMutations.disconnect();
    horizontalLayer.remove();
    editor.off('transaction', scheduleHorizontal);
    window.removeEventListener('resize', scheduleHorizontal);
    document.removeEventListener('scroll', scheduleHorizontal, true);
    document.removeEventListener('pointerdown', clearBoundaryOnOtherClick, true);
    setRowHover(null);
    editor.view.dom.removeEventListener('keydown', containerKeys, true);
    editor.view.dom.removeEventListener('keydown', onBoundaryKeydown, true);
    editor.view.dom.removeEventListener('beforeinput', onBoundaryBeforeInput, true);
    editor.view.dom.removeEventListener('compositionstart', onBoundaryComposition, true);
    editor.view.dom.removeEventListener('copy', onCopy, true);
    editor.view.dom.removeEventListener('paste', onPaste, true);
    editor.view.dom.parentElement.removeEventListener('mousedown', onClickBelowLast, true);
  });
}
export function alignContainer(editor, alignment) {
  const selection = editor.state.selection;
  if (!(selection instanceof NodeSelection)) return false;
  const node = selection.node;
  if (!types.includes(node.type.name)) return false;
  const attrs = { ...node.attrs, boxAlign: alignment, ...(alignment === 'justify' ? { boxWidth: null, boxOffsetX: null } : {}) };
  if (node.type.name === 'image') attrs.placement = 'block-left';
  editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(selection.from, undefined, attrs));
  return true;
}
