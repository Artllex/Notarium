import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { ContainerVisual } from './container-visual.js';

export function setupContainerSelection(editor, onEscape) {
  const multiSelected = new Set();
  let keyboardAnchor = null, keyboardFocus = null;
  const paintMultiSelection = () => {
    for (const dom of editor.view.dom.querySelectorAll('.object-container'))
      dom.classList.toggle('container-multi-selected', multiSelected.has(dom.containerView?.props.getPos()));
  };
  const clearMultiSelection = () => { multiSelected.clear(); keyboardAnchor = keyboardFocus = null; paintMultiSelection(); };
  const navigateSelectedContainers = event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!editor.view.dom.contains(event.target)) return;
    const selection = editor.state.selection;
    if (!(selection instanceof NodeSelection) && !multiSelected.size) return;
    const entries = [...editor.view.dom.querySelectorAll('.object-container')].map(dom => ({ dom,
      pos: dom.containerView?.props.getPos(), rect: dom.getBoundingClientRect() })).filter(entry => typeof entry.pos === 'number').sort((a, b) => a.pos - b.pos);
    const currentPos = keyboardFocus ?? (selection instanceof NodeSelection ? selection.from : [...multiSelected].at(-1));
    const currentIndex = entries.findIndex(entry => entry.pos === currentPos);
    if (currentIndex < 0) return;
    const current = entries[currentIndex];
    let target;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') target = entries[currentIndex + (event.key === 'ArrowLeft' ? -1 : 1)];
    else {
      const down = event.key === 'ArrowDown', center = current.rect.left + current.rect.width / 2;
      const candidates = entries.filter(entry => down ? entry.rect.top >= current.rect.bottom - 1 : entry.rect.bottom <= current.rect.top + 1);
      const distance = entry => down ? entry.rect.top - current.rect.bottom : current.rect.top - entry.rect.bottom;
      const horizontal = entry => Math.abs(entry.rect.left + entry.rect.width / 2 - center);
      candidates.sort((a, b) => distance(a) - distance(b) || horizontal(a) - horizontal(b));
      target = candidates[0];
    }
    event.preventDefault(); event.stopImmediatePropagation();
    if (!target) return;
    if (event.shiftKey) {
      keyboardAnchor ??= currentPos;
      keyboardFocus = target.pos;
      const anchorIndex = entries.findIndex(entry => entry.pos === keyboardAnchor), targetIndex = entries.indexOf(target);
      multiSelected.clear();
      for (let i = Math.min(anchorIndex, targetIndex); i <= Math.max(anchorIndex, targetIndex); i++) multiSelected.add(entries[i].pos);
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, target.pos)));
      paintMultiSelection();
    } else {
      clearMultiSelection();
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, target.pos)));
    }
    target.dom.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    editor.view.focus();
  };
  const multiClick = event => {
    const dom = event.target.closest?.('.object-container');
    if (!dom || !editor.view.dom.contains(dom) || event.button !== 0) return;
    if (!(event.ctrlKey || event.metaKey)) { clearMultiSelection(); return; }
    if (event.target.closest('p,h1,h2,h3,h4,h5,h6,li') && event.target !== dom) return;
    if (event.target.closest('button,input,select,.container-resize,.container-resize-edge,.container-pair-resize,.container-gap-boundary')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.type !== 'pointerdown') return;
    const pos = dom.containerView?.props.getPos();
    if (typeof pos !== 'number') return;
    const selection = editor.state.selection;
    if (!multiSelected.size && selection instanceof NodeSelection) multiSelected.add(selection.from);
    if (multiSelected.has(pos)) multiSelected.delete(pos); else multiSelected.add(pos);
    if (selection instanceof NodeSelection)
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(selection.from))));
    paintMultiSelection();
  };
  const cancelSelections = event => {
    if (event.key !== 'Escape') return;
    clearMultiSelection(); onEscape();
    ContainerVisual.state(editor.view.dom, 'containers-all-selected', false);
    ContainerVisual.state(editor.view.dom, 'container-boundary-selected', false);
    const selection = editor.state.selection;
    if (!selection.empty || selection instanceof NodeSelection)
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(selection.from))));
  };
  const onMultiTransaction = ({ transaction }) => {
    if (transaction.docChanged) clearMultiSelection();
  };
  document.addEventListener('pointerdown', multiClick, true);
  document.addEventListener('mousedown', multiClick, true);
  document.addEventListener('click', multiClick, true);
  document.addEventListener('keydown', cancelSelections, true);
  document.addEventListener('keydown', navigateSelectedContainers, true);
  editor.on('transaction', onMultiTransaction);
  editor.on('destroy', () => {
    for (const type of ['pointerdown', 'mousedown', 'click']) document.removeEventListener(type, multiClick, true);
    document.removeEventListener('keydown', cancelSelections, true);
    document.removeEventListener('keydown', navigateSelectedContainers, true);
    editor.off('transaction', onMultiTransaction);
  });
  return { clearMultiSelection };
}
