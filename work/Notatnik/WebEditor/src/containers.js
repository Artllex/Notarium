import { Extension, Node } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { RichLabelView, richAttribute } from './rich-label.js';

const types = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList', 'codeBlock', 'codeCell', 'image', 'blockMath', 'table'];
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
    this.contentDOM = inner.contentDOM;
    this.header = document.createElement('div'); this.header.className = 'container-title';
    this.footer = document.createElement('div'); this.footer.className = 'container-caption';
    this.tools = document.createElement('div'); this.tools.className = 'container-tools';
    this.tools.contentEditable = this.header.contentEditable = this.footer.contentEditable = 'false';
    const grip = document.createElement('span'); grip.className = 'container-grip'; grip.title = 'Przeciągnij kontener';
    const settings = document.createElement('button'); settings.type = 'button'; settings.title = 'Tytuł, stopka i wymiary';
    settings.addEventListener('click', event => { event.preventDefault(); options.editContainer(this); });
    this.tools.append(grip, settings);
    this.resize = document.createElement('span'); this.resize.className = 'container-resize'; this.resize.contentEditable = 'false';
    this.resize.title = 'Zmień szerokość i wysokość';
    this.resizeRight = document.createElement('span'); this.resizeRight.className = 'container-resize-edge container-resize-right';
    this.resizeBottom = document.createElement('span'); this.resizeBottom.className = 'container-resize-edge container-resize-bottom';
    this.resizeRight.contentEditable = this.resizeBottom.contentEditable = 'false';
    this.resizeRight.title = 'Zmień szerokość'; this.resizeBottom.title = 'Zmień wysokość';
    this.dom.append(this.tools, this.header, inner.dom, this.footer, this.resize);
    this.dom.append(this.resizeRight, this.resizeBottom);
    for (const [handle, axis] of [[this.resize, 'both'], [this.resizeRight, 'width'], [this.resizeBottom, 'height']]) handle.addEventListener('dblclick', event => {
      event.preventDefault(); event.stopPropagation();
      this.resetDimensions(axis);
    });
    this.dom.addEventListener('mousedown', event => {
      if (event.target === this.dom || event.target === grip) this.select();
    });
    this.dom.addEventListener('dblclick', event => {
      if (event.target.closest('input,button,.container-title,.container-caption,.image-title,figcaption,.cm-editor')) return;
      const pos = this.props.getPos(); if (typeof pos !== 'number') return;
      if (this.node.type.name === 'image' && !options.imageDialogOpen()) { event.preventDefault(); options.editImage(this.node, pos); }
      else if (this.node.type.name === 'blockMath') { event.preventDefault(); options.openMath(this.node, pos); }
      else if (event.target === this.dom || event.target === grip || this.node.type.name === 'table' &&
        (!event.target.closest('td,th') || event.clientX < this.dom.getBoundingClientRect().left + 5 || event.clientX > this.dom.getBoundingClientRect().right - 5)) {
        event.preventDefault(); options.editContainer(this);
      }
    });
    this.labels = [new RichLabelView(this.header, props.editor, props.getPos, 'boxTitle', 'Tytuł kontenera'),
      new RichLabelView(this.footer, props.editor, props.getPos, 'boxCaption', 'Stopka kontenera')];
    for (const [handle, axis] of [[this.resize, 'both'], [this.resizeRight, 'width'], [this.resizeBottom, 'height']]) handle.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      const rect = this.dom.getBoundingClientRect(), x = event.clientX, y = event.clientY;
      const doc = props.editor.state.doc;
      let moved = false;
      const size = e => ({ ...(axis !== 'height' ? { boxWidth: Math.round(Math.max(80, Math.min(4000, rect.width + e.clientX - x))) } : {}),
        ...(axis !== 'height' && this.node.attrs.boxAlign === 'justify' ? { boxAlign: 'left' } : {}),
        ...(axis !== 'width' ? { boxHeight: Math.round(Math.max(32, Math.min(4000, rect.height + e.clientY - y))) } : {}) });
      const move = e => {
        if (Math.hypot(e.clientX - x, e.clientY - y) < 3 && !moved) return;
        moved = true; const s = size(e);
        if (s.boxAlign) this.dom.dataset.align = s.boxAlign;
        if (s.boxWidth != null) this.dom.style.width = s.boxWidth + 'px';
        if (s.boxHeight != null) this.dom.style.minHeight = s.boxHeight + 'px';
      };
      const finish = e => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel);
        if (moved && doc === props.editor.state.doc) this.updateAttrs(size(e)); else this.paint(); };
      const cancel = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); this.paint(); };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', cancel);
    });
    this.paint();
  }
  select() { const pos = this.props.getPos(); if (typeof pos === 'number') this.props.editor.view.dispatch(this.props.editor.state.tr.setSelection(NodeSelection.create(this.props.editor.state.doc, pos))); }
  resetDimensions(axis) {
    this.updateAttrs({ ...(axis !== 'height' ? { boxWidth: null, boxAlign: 'justify' } : {}),
      ...(axis !== 'width' ? { boxHeight: null } : {}) });
  }
  updateAttrs(attrs) {
    const { editor, getPos } = this.props, pos = getPos();
    const current = typeof pos === 'number' && editor.state.doc.nodeAt(pos);
    if (!current || current.type !== this.node.type) return;
    editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, { ...current.attrs, ...attrs }));
    editor.view.dispatch(closeHistory(editor.state.tr));
  }
  paint() {
    const a = this.node.attrs;
    this.dom.style.backgroundColor = backgroundColor(a.boxBackground) || '';
    this.dom.style.width = a.boxWidth ? a.boxWidth + 'px' : this.node.type.name === 'image' ? (a.width || 200) + 'px' : '';
    this.dom.style.minHeight = a.boxHeight ? a.boxHeight + 'px' : '';
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
  stopEvent(event) { return !!event.target.closest('.container-tools,.container-title,.container-caption,.container-resize,.container-resize-edge') || !!this.inner.stopEvent?.(event); }
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
      if (!['doc', 'layoutRow'].includes($pos.parent.type.name)) return inner;
      return new ContainerView(inner, { node, editor, getPos }, options);
    };
  }
  editor.view.setProps({ nodeViews: views });
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
