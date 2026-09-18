import { Extension, Node } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { RichLabelView, richAttribute } from './rich-label.js';

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
      boxTitleRich: richAttribute('boxTitleRich'), boxCaptionRich: richAttribute('boxCaptionRich'), ...Object.fromEntries(['boxWidth', 'boxHeight', 'boxAlign', 'boxTitle', 'boxCaption'].map(name => [name, {
      default: null,
      parseHTML: el => {
        const value = el.getAttribute('data-' + name.toLowerCase());
        return ['boxWidth', 'boxHeight'].includes(name) ? Number(value) || null : value;
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
    for (const [label, title, type] of [
      ['+ text', 'Add text container', 'paragraph'],
      ['+ code block', 'Add code block', 'codeBlock'],
      ['+ code cell', 'Add code cell', 'codeCell']
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
    this.resizeBottomLeft = document.createElement('span'); this.resizeBottomLeft.className = 'container-resize container-resize-corner container-resize-bottom-left';
    this.resizeRight.contentEditable = this.resizeLeft.contentEditable = this.resizeBottom.contentEditable = this.resizeBottomLeft.contentEditable = 'false';
    this.resizeRight.title = this.resizeLeft.title = 'Zmień szerokość'; this.resizeBottom.title = this.resizeBottomLeft.title = 'Zmień wysokość i szerokość';
    this.dom.append(this.tools, this.header, inner.dom, this.footer, this.addTools, this.resize);
    this.dom.append(this.resizeRight, this.resizeLeft, this.resizeBottom, this.resizeBottomLeft);
    for (const [handle, axis] of [[this.resize, 'both'], [this.resizeRight, 'width'], [this.resizeLeft, 'width'], [this.resizeBottom, 'height'], [this.resizeBottomLeft, 'both']]) handle.addEventListener('dblclick', event => {
      event.preventDefault(); event.stopPropagation();
      this.resetDimensions(axis);
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
      const rect = this.dom.getBoundingClientRect(), x = event.clientX, y = event.clientY;
      const doc = props.editor.state.doc;
      let moved = false;
      const fromLeft = handle === this.resizeLeft || handle === this.resizeBottomLeft;
      const size = e => ({ ...(axis !== 'height' ? { boxWidth: Math.round(Math.max(80, Math.min(4000, rect.width + (fromLeft ? x - e.clientX : e.clientX - x)))) } : {}),
        ...(axis !== 'height' && this.node.attrs.boxAlign === 'justify' ? { boxAlign: 'left' } : {}),
        ...(axis !== 'width' ? { boxHeight: Math.round(Math.max(32, Math.min(4000, rect.height + e.clientY - y))) } : {}) });
      const move = e => {
        if (Math.hypot(e.clientX - x, e.clientY - y) < 3 && !moved) return;
        moved = true; const s = size(e);
        if (s.boxAlign) this.dom.dataset.align = s.boxAlign;
        if (s.boxWidth != null) this.dom.style.width = s.boxWidth + 'px';
        if (s.boxHeight != null) {
          this.dom.style.minHeight = s.boxHeight + 'px';
          if (this.node.type.name === 'codeCell' || this.node.type.name === 'codeBlock') { this.inner.dom.style.minHeight = s.boxHeight + 'px'; this.inner.dom.style.height = s.boxHeight + 'px'; }
        }
      };
      const finish = e => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel);
        if (moved && doc === props.editor.state.doc) { this.lastEdgeClick = null; this.updateAttrs(size(e)); }
        else if (!moved && doc === props.editor.state.doc) {
          const last = this.lastEdgeClick, now = performance.now();
          if (last?.axis === axis && now - last.time < 500 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 5) {
            this.lastEdgeClick = null; this.resetDimensions(axis);
          } else this.lastEdgeClick = { axis, time: now, x: e.clientX, y: e.clientY };
          this.paint();
        } else this.paint(); };
      const cancel = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); this.paint(); };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', cancel);
    });
    this.paint();
  }
  select() { const pos = this.props.getPos(); if (typeof pos === 'number') this.props.editor.view.dispatch(this.props.editor.state.tr.setSelection(NodeSelection.create(this.props.editor.state.doc, pos))); }
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
  resetDimensions(axis) {
    this.updateAttrs({ ...(axis !== 'height' ? { boxWidth: null, boxAlign: 'justify' } : {}),
      ...(axis !== 'width' ? { boxHeight: null } : {}) });
  }
  updateAttrs(attrs) {
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
    this.dom.style.minHeight = a.boxHeight ? a.boxHeight + 'px' : '';
    this.inner.dom.style.minHeight = codeContainer && a.boxHeight ? a.boxHeight + 'px' : '';
    this.inner.dom.style.height = codeContainer && a.boxHeight ? a.boxHeight + 'px' : '';
    this.dom.addEventListener('pointermove', event => {
      const rect = this.dom.getBoundingClientRect(), nearLeft = event.clientX <= rect.left + 18 && event.clientY >= rect.bottom - 18;
      const nearRight = event.clientX >= rect.right - 18 && event.clientY >= rect.bottom - 18;
      this.dom.classList.toggle('corner-near-left', nearLeft); this.dom.classList.toggle('corner-near-right', nearRight);
    });
    this.dom.addEventListener('pointerleave', () => { this.dom.classList.remove('corner-near-left', 'corner-near-right'); });
    this.dom.dataset.align = a.boxAlign || (a.placement === 'block-center' ? 'center' : a.placement === 'block-right' ? 'right' : 'left');
    this.labels.forEach(label => label.update(this.node));
  }
  update(node, ...args) {
    if (node.type !== this.node.type) return false;
    const engineAttrs = value => Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('box')));
    if (!this.inner.update && JSON.stringify(engineAttrs(node.attrs)) !== JSON.stringify(engineAttrs(this.node.attrs))) return false;
    if (this.inner.update && !this.inner.update(node, ...args)) return false;
    this.node = node; this.paint(); return true;
  }
  stopEvent(event) { return !!event.target.closest('.container-tools,.container-add-tools,.container-title,.container-caption,.container-resize,.container-resize-edge') || !!this.inner.stopEvent?.(event); }
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
  let rowHover = null;
  const setRowHover = next => {
    if (next === rowHover) return;
    rowHover?.classList.remove('container-row-hover');
    rowHover = next;
    rowHover?.classList.add('container-row-hover');
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
  editor.on('destroy', () => setRowHover(null));
}
export function alignContainer(editor, alignment) {
  const selection = editor.state.selection;
  if (!(selection instanceof NodeSelection)) return false;
  const node = selection.node;
  if (!types.includes(node.type.name)) return false;
  const attrs = { ...node.attrs, boxAlign: alignment, ...(alignment === 'justify' ? { boxWidth: null } : {}) };
  if (node.type.name === 'image') attrs.placement = 'block-left';
  editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(selection.from, undefined, attrs));
  return true;
}
