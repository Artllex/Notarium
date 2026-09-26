import { RichLabelView } from './rich-label.js';
import { getContainerType } from './container-types.js';
import { ContainerVisual } from './container-visual.js';

export class ContainerInteractions {
  static isControl(target) { return Boolean(target.closest?.('button,input,select,.ui-dropdown,.container-tools,.container-add-tools,.container-pair-resize,.container-gap-boundary,.container-resize,.container-resize-edge')); }
  constructor(view, props, options) {
    const typeLabel = view.typeLabel;
    view.selectTop.title = 'Zaznacz kontener';
    view.selectTop.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); event.stopPropagation(); view.select(); } });
    view.selectTop.addEventListener('mousedown', event => { if (event.button === 0) { event.preventDefault(); event.stopPropagation(); view.select(); } });
    view.selectTop.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); view.select(); });
    view.pairResize.title = 'Przeciągnij: zmień szerokości; kliknij: wyrównaj i wybierz miejsce wklejenia';
    view.pairResize.addEventListener('pointerdown', event => view.resizePair(event));
    view.gapBoundary.title = view.pairResize.title;
    view.gapBoundary.addEventListener('pointerdown', event => {
      const previous = view.dom.previousElementSibling?.containerView;
      if (previous?.dom.parentElement === view.dom.parentElement) previous.resizePair(event);
    });
    for (const [handle, axis] of [[view.resize, 'both'], [view.resizeRight, 'width'], [view.resizeLeft, 'width'], [view.resizeBottom, 'height'], [view.resizeBottomLeft, 'both']]) handle.addEventListener('dblclick', event => {
      event.preventDefault(); event.stopPropagation();
      if (performance.now() - (view.lastEdgeReset || 0) < 300) return;
      view.resetDimensions(axis, handle);
    });
    view.dom.addEventListener('mousedown', event => {
      if (event.target === view.dom || event.target === typeLabel) view.select();
    });
    view.dom.addEventListener('dblclick', event => {
      if (event.target.closest('.object-container') !== view.dom) return;
      if (event.target.closest('input,button,.container-title,.container-caption,.image-title,figcaption,.cm-editor')) return;
      const pos = view.props.getPos(); if (typeof pos !== 'number') return;
      if (view.node.type.name === 'image' && !options.imageDialogOpen()) { event.preventDefault(); options.editImage(view.node, pos); }
      else if (view.node.type.name === 'blockMath') { event.preventDefault(); options.openMath(view.node, pos); }
      else if (event.target === view.dom || event.target === typeLabel || view.node.type.name === 'table' &&
        (!event.target.closest('td,th') || event.clientX < view.dom.getBoundingClientRect().left + 5 || event.clientX > view.dom.getBoundingClientRect().right - 5)) {
        event.preventDefault(); options.editContainer(view);
      }
    });
    view.labels = [new RichLabelView(view.header, props.editor, props.getPos, 'boxTitle', 'Tytuł kontenera'),
      new RichLabelView(view.footer, props.editor, props.getPos, 'boxCaption', 'Stopka kontenera')];
    for (const [handle, axis] of [[view.resize, 'both'], [view.resizeRight, 'width'], [view.resizeLeft, 'width'], [view.resizeBottom, 'height'], [view.resizeBottomLeft, 'both']])
      handle.addEventListener('pointerdown', event => view.resizeEdge(event, handle, axis));
    view.onPointerMove = event => ContainerVisual.corner(view, event);
    view.onPointerLeave = () => ContainerVisual.clearCorner(view);
    view.dom.addEventListener('pointermove', view.onPointerMove);
    view.dom.addEventListener('pointerleave', view.onPointerLeave);
    view.settingsButton.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); options.editContainer(view); });
    const remove = view.tools.querySelector('.container-delete-button');
    remove.addEventListener('mousedown', event => event.preventDefault());
    remove.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); view.remove(); });
    view.typeLabel.addEventListener('mousedown', event => { if (getContainerType(view.node).isEmpty) event.preventDefault(); });
    view.typeLabel.addEventListener('click', event => {
      if (!getContainerType(view.node).isEmpty) return;
      event.preventDefault(); event.stopPropagation(); view.select();
    });
    for (const button of view.addTools.children) {
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); view.insertAfter(button.dataset.action); });
    }
  }
}
