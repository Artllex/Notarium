import { ToolPanel, ActionButton, Handle } from '../../../../Shared/Web/UI/components.js';
import { getContainerType } from './container-types.js';
const backgroundColor = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : null;

export class ContainerVisual {
  static state(dom, name, enabled) { dom.classList.toggle(name, Boolean(enabled)); }
  static select(view, selected) { this.state(view.dom, 'container-selected', selected); }
  static previewSingle(view, width, offset) { view.dom.dataset.align = 'left'; view.dom.style.width = width + 'px'; view.dom.style.marginLeft = offset + 'px'; }
  static hover(elements, enabled) { elements.forEach(dom => this.state(dom, 'container-row-hover', enabled)); }
  static corner(view, event) {
    const rect = view.dom.getBoundingClientRect(), nearBottom = event.clientY >= rect.bottom - 18;
    this.state(view.dom, 'corner-near-left', nearBottom && event.clientX <= rect.left + 18);
    this.state(view.dom, 'corner-near-right', nearBottom && event.clientX >= rect.right - 18);
  }
  static clearCorner(view) { this.state(view.dom, 'corner-near-left', false); this.state(view.dom, 'corner-near-right', false); }
  static placeCaret(caret, editorRect, lastRect) { caret.style.left = editorRect.left + 'px'; caret.style.top = lastRect.bottom + 6 + 'px'; caret.hidden = false; }
  static previewRow(view, snapshot, boxes) {
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
  static previewHeight(view, height) {
    view.dom.style.minHeight = height + 'px';
    if (getContainerType(view.node).isCode) {
      view.dom.style.height = height + 'px';
      view.inner.dom.style.minHeight = height + 'px';
      view.inner.dom.style.height = height + 'px';
    }
  }
  static previewImageWidth(view, width) {
    if (!getContainerType(view.node).isImage) return;
    view.inner.dom.style.width = width + 'px';
    const image = view.inner.dom.querySelector('img');
    if (image) image.width = width;
  }
  static positionPair(view) {
    let next = view.dom.nextElementSibling;
    while (next && !next.matches?.('.object-container')) next = next.nextElementSibling;
    if (!next) { view.pairResize.style.right = ''; return; }
    const rect = view.dom.getBoundingClientRect(), nextRect = next.getBoundingClientRect();
    const gap = Math.max(0, nextRect.left - rect.right);
    const standardGap = Number.parseFloat(getComputedStyle(view.dom.parentElement).columnGap) || 22;
    const inset = Math.min(gap / 2, standardGap / 2);
    view.pairResize.style.right = -(inset + view.pairResize.offsetWidth / 2) + 'px';
    const otherBoundary = next.containerView?.gapBoundary;
    if (otherBoundary) {
      otherBoundary.style.left = -(inset + 5) + 'px';
      otherBoundary.style.display = gap > standardGap + 2 ? 'block' : '';
    }
  }
  static mount(view, inner, props, options) {
    view.dom = document.createElement('section'); view.dom.className = 'object-container';
    view.dom.dataset.containerType = view.node.type.name;
    view.dom.containerView = view;
    view.contentDOM = inner.contentDOM;
    view.header = ToolPanel.create(); view.header.className = 'container-title';
    view.footer = ToolPanel.create(); view.footer.className = 'container-caption';
    view.typeTools = ToolPanel.create(); view.typeTools.className = 'container-type-tools';
    view.tools = ToolPanel.create(); view.tools.className = 'container-tools';
    view.typeTools.contentEditable = view.tools.contentEditable = view.header.contentEditable = view.footer.contentEditable = 'false';
    const settings = ActionButton.create(); view.settingsButton = settings; settings.type = 'button'; settings.title = 'Tytuł, stopka i wymiary';
    const remove = ActionButton.create(); remove.type = 'button'; remove.className = 'container-delete-button';
    remove.title = 'Usuń kontener'; remove.setAttribute('aria-label', 'Usuń kontener');
    const typeLabel = document.createElement('span'); typeLabel.className = 'container-type-label'; view.typeLabel = typeLabel;
    typeLabel.dataset.label = getContainerType(view.node).label;
    typeLabel.setAttribute('aria-label', typeLabel.dataset.label);
    typeLabel.title = 'Przeciągnij kontener';
    view.typeTools.append(typeLabel);
    view.tools.append(remove, settings);
    view.addTools = ToolPanel.create(); view.addTools.className = 'container-add-tools'; view.addTools.contentEditable = 'false';
    for (const [label, title, type] of [
      ['+ text', 'Add text container', 'paragraph'],
      ['+ code block', 'Add code block', 'codeBlock'],
      ['+ code cell', 'Add code cell', 'codeCell'],
      ['+ math', 'Add math container', 'blockMath']
    ]) {
      const button = ActionButton.create(); button.type = 'button'; button.dataset.label = label; button.dataset.action = type;
      button.setAttribute('aria-label', label); button.title = title;
      view.addTools.append(button);
    }
    view.resize = Handle.create('container-resize container-resize-corner container-resize-bottom-right'); view.resize.className = 'container-resize container-resize-corner container-resize-bottom-right'; view.resize.contentEditable = 'false';
    view.resize.title = 'Zmień szerokość i wysokość';
    view.resizeRight = Handle.create('container-resize-edge container-resize-right'); view.resizeRight.className = 'container-resize-edge container-resize-right';
    view.resizeLeft = Handle.create('container-resize-edge container-resize-left'); view.resizeLeft.className = 'container-resize-edge container-resize-left';
    view.resizeBottom = Handle.create('container-resize-edge container-resize-bottom'); view.resizeBottom.className = 'container-resize-edge container-resize-bottom';
    view.selectTop = Handle.create('container-select-edge container-select-top'); view.selectTop.className = 'container-select-edge container-select-top';
    view.pairResize = Handle.create('container-pair-resize'); view.pairResize.className = 'container-pair-resize';
    view.gapBoundary = Handle.create('container-gap-boundary'); view.gapBoundary.className = 'container-gap-boundary';
    view.resizeBottomLeft = Handle.create('container-resize container-resize-corner container-resize-bottom-left'); view.resizeBottomLeft.className = 'container-resize container-resize-corner container-resize-bottom-left';
    view.resizeRight.contentEditable = view.resizeLeft.contentEditable = view.resizeBottom.contentEditable = view.resizeBottomLeft.contentEditable = view.selectTop.contentEditable = view.pairResize.contentEditable = view.gapBoundary.contentEditable = 'false';
    view.resizeRight.title = view.resizeLeft.title = 'Zmień szerokość'; view.resizeBottom.title = view.resizeBottomLeft.title = 'Zmień wysokość i szerokość';
    view.dom.append(view.typeTools, view.tools, view.header, inner.dom, view.footer, view.addTools, view.resize);
    view.dom.append(view.resizeRight, view.resizeLeft, view.resizeBottom, view.resizeBottomLeft, view.selectTop, view.pairResize, view.gapBoundary);
  }
  static paint(view) {
    const a = view.node.attrs;
    const type = getContainerType(view.node);
    const isEmptyVariant = type.isEmpty;
    view.dom.classList.toggle('container-empty', isEmptyVariant);
    view.settingsButton.hidden = isEmptyVariant;
    if (view.typeLabel) {
      view.typeLabel.dataset.label = type.label;
      view.typeLabel.setAttribute('aria-label', view.typeLabel.dataset.label);
    }
    const codeContainer = type.isCode;
    const visibleHeight = codeContainer && a.boxHeight && !a.codeAllowNarrow ?
      Math.max(a.boxHeight, view.codeMinimumHeight()) : a.boxHeight;
    view.dom.style.backgroundColor = backgroundColor(a.boxBackground) || '';
    view.dom.style.width = a.boxWidth ? a.boxWidth + 'px' : type.isImage ? (a.width || 200) + 'px' : '';
    if (type.isImage) view.previewImageWidth(a.boxWidth || a.width || 200);
    view.dom.style.marginLeft = a.boxOffsetX ? a.boxOffsetX + 'px' : '';
    view.dom.style.minHeight = visibleHeight ? visibleHeight + 'px' : '';
    view.dom.style.height = codeContainer && visibleHeight ? visibleHeight + 'px' : '';
    view.inner.dom.style.minHeight = codeContainer && visibleHeight ? visibleHeight + 'px' : '';
    view.inner.dom.style.height = codeContainer && visibleHeight ? visibleHeight + 'px' : '';
    view.dom.dataset.align = a.boxWidth && view.dom.parentElement?.matches('.layout-row') ? 'left' :
      a.boxAlign || (a.placement === 'block-center' ? 'center' : a.placement === 'block-right' ? 'right' : 'left');
    requestAnimationFrame(() => { if (view.dom.isConnected) view.positionAdjacentPairs(); });
    view.labels.forEach(label => label.update(view.node));
    }
}
