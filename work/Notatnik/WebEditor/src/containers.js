import { Extension, Node } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { RichLabelView, richAttribute } from './rich-label.js';
import { moveBlock } from './block-movement.js';

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
    this.resizeBottomLeft = document.createElement('span'); this.resizeBottomLeft.className = 'container-resize container-resize-corner container-resize-bottom-left';
    this.resizeRight.contentEditable = this.resizeLeft.contentEditable = this.resizeBottom.contentEditable = this.resizeBottomLeft.contentEditable = this.selectTop.contentEditable = this.pairResize.contentEditable = 'false';
    this.resizeRight.title = this.resizeLeft.title = 'Zmień szerokość'; this.resizeBottom.title = this.resizeBottomLeft.title = 'Zmień wysokość i szerokość';
    this.dom.append(this.tools, this.header, inner.dom, this.footer, this.addTools, this.resize);
    this.dom.append(this.resizeRight, this.resizeLeft, this.resizeBottom, this.resizeBottomLeft, this.selectTop, this.pairResize);
    this.selectTop.title = 'Zaznacz kontener';
    this.selectTop.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); event.stopPropagation(); this.select(); } });
    this.selectTop.addEventListener('mousedown', event => { if (event.button === 0) { event.preventDefault(); event.stopPropagation(); this.select(); } });
    this.selectTop.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); this.select(); });
    this.pairResize.title = 'Zmień jednocześnie szerokość sąsiednich kontenerów';
    this.pairResize.addEventListener('pointerdown', event => this.resizePair(event));
    for (const [handle, axis] of [[this.resize, 'both'], [this.resizeRight, 'width'], [this.resizeLeft, 'width'], [this.resizeBottom, 'height'], [this.resizeBottomLeft, 'both']]) handle.addEventListener('dblclick', event => {
      event.preventDefault(); event.stopPropagation();
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
    for (const [handle, axis] of [[this.resize, 'both'], [this.resizeRight, 'width'], [this.resizeLeft, 'width'], [this.resizeBottom, 'height'], [this.resizeBottomLeft, 'both']]) handle.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      this.select();
      const rect = this.dom.getBoundingClientRect(), x = event.clientX, y = event.clientY;
      const doc = props.editor.state.doc;
      let moved = false;
      const fromLeft = handle === this.resizeLeft || handle === this.resizeBottomLeft;
      const frozen = axis !== 'height' ? this.freezeRowWidths() : null;
      const size = e => {
        const result = {};
        if (axis !== 'height') {
          const width = Math.round(Math.max(this.codeMinimumWidth(), Math.min(4000, rect.width + (fromLeft ? x - e.clientX : e.clientX - x))));
          result.boxWidth = width;
          if (this.node.attrs.boxAlign === 'justify' || fromLeft && frozen) result.boxAlign = 'left';
          if (fromLeft && frozen) result.boxOffsetX = Math.round((this.node.attrs.boxOffsetX || 0) + rect.width - width);
        }
        if (axis !== 'width') result.boxHeight = Math.round(Math.max(this.codeMinimumHeight(), Math.min(4000, rect.height + e.clientY - y)));
        return result;
      };
      const move = e => {
        if (Math.hypot(e.clientX - x, e.clientY - y) < 3 && !moved) return;
        moved = true; const s = size(e);
        if (s.boxAlign) this.dom.dataset.align = s.boxAlign;
        if (s.boxWidth != null) this.dom.style.width = s.boxWidth + 'px';
        if (s.boxOffsetX != null) this.dom.style.marginLeft = s.boxOffsetX + 'px';
        this.positionAdjacentPairs();
        if (s.boxHeight != null) {
          this.dom.style.minHeight = s.boxHeight + 'px';
          if (this.node.type.name === 'codeCell' || this.node.type.name === 'codeBlock') { this.dom.style.height = s.boxHeight + 'px'; this.inner.dom.style.minHeight = s.boxHeight + 'px'; this.inner.dom.style.height = s.boxHeight + 'px'; }
        }
      };
      const finish = e => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel);
        if (moved && doc === props.editor.state.doc) { this.lastEdgeClick = null; this.commitResize(size(e), frozen); }
        else if (!moved && doc === props.editor.state.doc) {
          this.restoreFrozen(frozen);
          this.select();
          const last = this.lastEdgeClick, now = performance.now();
          if (last?.axis === axis && now - last.time < 500 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 5) {
            this.lastEdgeClick = null; this.resetDimensions(axis);
          } else this.lastEdgeClick = { axis, time: now, x: e.clientX, y: e.clientY };
          this.paint();
        } else { this.restoreFrozen(frozen); this.paint(); } };
      const cancel = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); this.restoreFrozen(frozen); this.paint(); };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', cancel);
    });
    this.paint();
  }
  select() {
    const pos = this.props.getPos(); if (typeof pos !== 'number') return;
    this.props.editor.view.focus();
    this.props.editor.view.dispatch(this.props.editor.state.tr.setSelection(NodeSelection.create(this.props.editor.state.doc, pos)));
  }
  freezeRowWidths() {
    const row = this.dom.parentElement;
    if (!row?.matches('.layout-row')) return null;
    const entries = [...row.children].filter(dom => dom.matches?.('.object-container') && dom.containerView).map(dom => ({
      view: dom.containerView, width: dom.getBoundingClientRect().width
    }));
    for (const entry of entries) entry.view.dom.style.width = Math.round(entry.width) + 'px';
    return entries;
  }
  restoreFrozen(entries) { entries?.forEach(entry => entry.view.paint()); }
  positionPair() {
    let next = this.dom.nextElementSibling;
    while (next && !next.matches?.('.object-container')) next = next.nextElementSibling;
    if (!next) { this.pairResize.style.right = ''; return; }
    const rect = this.dom.getBoundingClientRect(), nextRect = next.getBoundingClientRect();
    const gap = Math.max(0, nextRect.left - rect.right);
    this.pairResize.style.right = -(gap / 2 + this.pairResize.offsetWidth / 2) + 'px';
  }
  positionAdjacentPairs() {
    this.positionPair();
    let previous = this.dom.previousElementSibling;
    while (previous && !previous.matches?.('.object-container')) previous = previous.previousElementSibling;
    previous?.containerView?.positionPair();
  }
  commitResize(attrs, frozen, overrides = null) {
    if (!frozen) { this.updateAttrs(attrs); return; }
    const { editor } = this.props; let tr = closeHistory(editor.state.tr), changed = false;
    for (const entry of frozen) {
      const pos = entry.view.props.getPos(), current = typeof pos === 'number' && tr.doc.nodeAt(pos);
      if (!current) continue;
      const patch = entry.view === this ? attrs : {};
      const width = overrides?.get(entry.view) ?? patch.boxWidth ?? Math.round(entry.width);
      const next = { ...current.attrs, boxWidth: width, ...(current.attrs.boxAlign === 'justify' ? { boxAlign: 'left' } : {}), ...patch };
      tr = tr.setNodeMarkup(pos, undefined, next); changed = true;
    }
    if (changed) { editor.view.dispatch(tr); editor.view.dispatch(closeHistory(editor.state.tr)); }
  }
  resizePair(event) {
    if (event.button !== 0) return;
    let next = this.dom.nextElementSibling;
    while (next && !next.matches?.('.object-container')) next = next.nextElementSibling;
    const other = next?.containerView;
    if (!other || this.dom.parentElement !== other.dom.parentElement) return;
    event.preventDefault(); event.stopPropagation(); this.select();
    const frozen = this.freezeRowWidths(); if (!frozen) return;
    const leftWidth = this.dom.getBoundingClientRect().width, rightWidth = other.dom.getBoundingClientRect().width;
    const total = leftWidth + rightWidth, startX = event.clientX;
    let moved = false, widths = [leftWidth, rightWidth];
    const calculate = e => {
      const left = Math.max(this.codeMinimumWidth(), Math.min(total - other.codeMinimumWidth(), leftWidth + e.clientX - startX));
      return [Math.round(left), Math.round(total - left)];
    };
    const move = e => {
      if (!moved && Math.abs(e.clientX - startX) < 3) return;
      moved = true; widths = calculate(e);
      this.dom.style.width = widths[0] + 'px'; other.dom.style.width = widths[1] + 'px';
      this.positionPair(); other.positionPair();
    };
    const finish = e => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel);
      if (moved) { widths = calculate(e); this.commitResize({}, frozen, new Map([[this, widths[0]], [other, widths[1]]])); }
      else this.restoreFrozen(frozen);
    };
    const cancel = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); this.restoreFrozen(frozen); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', cancel);
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
    editor.view.dispatch(closeHistory(editor.state.tr).delete(pos, pos + current.nodeSize));
    editor.commands.focus();
  }
  move(direction) {
    const { editor, getPos } = this.props, pos = getPos();
    if (typeof pos !== 'number') return;
    const $pos = editor.state.doc.resolve(pos);
    if ($pos.parent.type.name === 'layoutRow') {
      moveBlock(editor, pos, direction < 0 ? $pos.before() : $pos.after()); return;
    }
    const blocks = []; editor.state.doc.forEach((child, offset) => blocks.push({ child, offset }));
    const index = blocks.findIndex(block => block.offset === pos), target = blocks[index + direction];
    if (!target) return;
    moveBlock(editor, pos, direction < 0 ? target.offset : target.offset + target.child.nodeSize);
  }
  insertAfter(type) {
    const { editor, getPos } = this.props, pos = getPos();
    const current = typeof pos === 'number' && editor.state.doc.nodeAt(pos), nodeType = editor.schema.nodes[type];
    if (!current || !nodeType) return;
    const boundary = pos + current.nodeSize;
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
    const attrs = { ...(axis !== 'height' ? { boxWidth: null, boxOffsetX: null, boxAlign: 'justify' } : {}), ...(axis !== 'width' ? { boxHeight: null } : {}) };
    if (axis !== 'width') {
      const parent = this.dom.parentElement;
      const siblings = parent ? [...parent.children].filter(element => element !== this.dom && element.matches?.('.object-container')) : [];
      const rect = this.dom.getBoundingClientRect();
      const candidates = siblings.map(dom => ({ dom, rect: dom.getBoundingClientRect() }));
      let chosen;
      if (handle?.classList.contains('container-resize-bottom-right')) chosen = candidates.filter(item => item.rect.left >= rect.right - 8).sort((a, b) => a.rect.left - b.rect.left)[0];
      else if (handle?.classList.contains('container-resize-bottom-left')) chosen = candidates.filter(item => item.rect.right <= rect.left + 8).sort((a, b) => b.rect.right - a.rect.right)[0];
      else chosen = candidates.sort((a, b) => Math.abs(a.rect.bottom - rect.bottom) - Math.abs(b.rect.bottom - rect.bottom))[0];
      if (chosen) attrs.boxHeight = Math.round(chosen.rect.height);
    }
    this.updateAttrs(attrs);
  }
  updateAttrs(attrs) {
    if (attrs.boxWidth != null && ['codeCell', 'codeBlock'].includes(this.node.type.name)) attrs = { ...attrs, boxWidth: Math.max(this.codeMinimumWidth(), attrs.boxWidth) };
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
    this.dom.style.backgroundColor = backgroundColor(a.boxBackground) || '';
    this.dom.style.width = a.boxWidth ? a.boxWidth + 'px' : this.node.type.name === 'image' ? (a.width || 200) + 'px' : '';
    this.dom.style.marginLeft = this.dom.parentElement?.matches('.layout-row') && a.boxOffsetX ? a.boxOffsetX + 'px' : '';
    this.dom.style.minHeight = a.boxHeight ? a.boxHeight + 'px' : '';
    this.dom.style.height = codeContainer && a.boxHeight ? a.boxHeight + 'px' : '';
    this.inner.dom.style.minHeight = codeContainer && a.boxHeight ? a.boxHeight + 'px' : '';
    this.inner.dom.style.height = codeContainer && a.boxHeight ? a.boxHeight + 'px' : '';
    this.dom.addEventListener('pointermove', event => {
      const rect = this.dom.getBoundingClientRect(), nearLeft = event.clientX <= rect.left + 18 && event.clientY >= rect.bottom - 18;
      const nearRight = event.clientX >= rect.right - 18 && event.clientY >= rect.bottom - 18;
      this.dom.classList.toggle('corner-near-left', nearLeft); this.dom.classList.toggle('corner-near-right', nearRight);
    });
    this.dom.addEventListener('pointerleave', () => { this.dom.classList.remove('corner-near-left', 'corner-near-right'); });
    this.dom.dataset.align = a.boxAlign || (a.placement === 'block-center' ? 'center' : a.placement === 'block-right' ? 'right' : 'left');
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
  stopEvent(event) { return !!event.target.closest('.container-tools,.container-add-tools,.container-title,.container-caption,.container-resize,.container-resize-edge,.container-select-edge,.container-pair-resize') || !!this.inner.stopEvent?.(event); }
  ignoreMutation(mutation) {
    const target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
    if (target?.closest('.rich-label')) return true;
    if (mutation.type === 'selection') return false;
    if (!this.inner.dom.contains(mutation.target)) return true;
    return this.inner.ignoreMutation?.(mutation) ?? !this.contentDOM;
  }
  selectNode() { this.dom.classList.add('container-selected'); this.inner.selectNode?.(); }
  deselectNode() { this.dom.classList.remove('container-selected'); this.inner.deselectNode?.(); }
  destroy() { this.labels.forEach(label => label.destroy()); this.inner.destroy?.(); }
}

export function setupContainers(editor, options) {
  const original = { ...editor.view.nodeViews };
  const views = { ...original };
  for (const type of types) {
    views[type] = (node, view, getPos, decorations, innerDecorations) => {
      const $pos = view.state.doc.resolve(getPos());
      const inner = original[type]?.(node, view, getPos, decorations, innerDecorations) ||
        DOMSerializer.renderSpec(document, node.type.spec.toDOM(node));
      if (!['doc', 'layoutRow', 'blockGroup'].includes($pos.parent.type.name)) return inner;
      return new ContainerView(inner, { node, editor, getPos }, options);
    };
  }
  editor.view.setProps({ nodeViews: views });
  let copiedContainer = null;
  const containerKeys = event => {
    const selection = editor.state.selection;
    const selected = selection instanceof NodeSelection && types.includes(selection.node.type.name);
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === 'c') {
      copiedContainer = selected ? selection.node.toJSON() : null;
      return;
    }
    if (modifier && event.key.toLowerCase() === 'v' && selected && copiedContainer) {
      event.preventDefault(); event.stopImmediatePropagation();
      const clone = editor.schema.nodeFromJSON(copiedContainer), pos = selection.to;
      const tr = closeHistory(editor.state.tr).insert(pos, clone);
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      editor.view.dispatch(tr.scrollIntoView()); editor.view.dispatch(closeHistory(editor.state.tr)); editor.view.focus();
      return;
    }
    if (selected && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault(); event.stopImmediatePropagation();
      editor.view.dispatch(closeHistory(editor.state.tr).delete(selection.from, selection.to).scrollIntoView());
      editor.view.dispatch(closeHistory(editor.state.tr)); editor.view.focus();
    }
  };
  editor.view.dom.addEventListener('keydown', containerKeys, true);
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
  editor.on('destroy', () => { setRowHover(null); editor.view.dom.removeEventListener('keydown', containerKeys, true); });
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
