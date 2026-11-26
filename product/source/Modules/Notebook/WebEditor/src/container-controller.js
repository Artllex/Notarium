import { collapseRows } from './block-movement.js';
import { setupContainerHover } from './container-hover.js';
import { DOMSerializer } from '@tiptap/pm/model';
import { NodeSelection, Selection, TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { ContainerView } from './container-view.js';
import { setupContainerSelection } from './container-selection.js';
import { ContainerInteractions } from './container-interactions.js';
import { ContainerVisual } from './container-visual.js';
import { containerTypes, getContainerType, isContainerAt } from './container-types.js';
import { lastLineStartSelection } from './container-keyboard.js';
import { listClipboardText } from './list-clipboard.js';
const types = Object.keys(containerTypes);

export function setupContainers(editor, options) {
  const { clearMultiSelection } = setupContainerSelection(editor, () => { boundaryTarget = null; hideEndCaret(); });
  const showCtrlActions = enabled => editor.view.dom.classList.toggle('container-ctrl-actions', enabled);
  const onCtrlKey = event => showCtrlActions(event.ctrlKey);
  const clearCtrlActions = () => showCtrlActions(false);
  document.addEventListener('keydown', onCtrlKey, true);
  document.addEventListener('keyup', onCtrlKey, true);
  window.addEventListener('blur', clearCtrlActions);
  document.addEventListener('visibilitychange', clearCtrlActions);
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
      if (!isContainerAt(view.state.doc, getPos())) {
        const update = inner.update?.bind(inner);
        return { ...inner, update(nextNode, nextDecorations, nextInnerDecorations) {
          if (isContainerAt(view.state.doc, getPos())) return false;
          return update ? update(nextNode, nextDecorations, nextInnerDecorations) : nextNode.sameMarkup(node);
        } };
      }
      return new ContainerView(inner, { node, editor, getPos, noteId: options.noteId, setBoundaryTarget }, viewOptions);
    };
  }
  editor.view.setProps({ nodeViews: views });
  const containerFormat = 'application/x-notarium-container+json';
  const selectedContainer = () => {
    const selection = editor.state.selection;
    return selection instanceof NodeSelection && isContainerAt(editor.state.doc, selection.from) ? selection : null;
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
    event.clipboardData.setData('text/plain', listClipboardText(editor.state.selection.content(), editor.state) ?? selection.node.textContent ?? '');
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
    if (target.kind === 'vertical' && !$pos.nodeBefore?.attrs.boxEmpty && !$pos.nodeAfter?.attrs.boxEmpty) {
      const row = editor.view.nodeDOM($pos.before());
      const gap = parseFloat(getComputedStyle(row).columnGap) || 22;
      const available = row.getBoundingClientRect().width - gap * $pos.parent.childCount;
      const width = inserted.attrs.boxWidth || available / ($pos.parent.childCount + 1);
      if (width + 60 * $pos.parent.childCount > available + 1) return false;
      $pos.parent.forEach((child, offset) => {
        tr.setNodeMarkup($pos.start() + offset, undefined, { ...child.attrs, boxWidth: (available - width) / $pos.parent.childCount, boxOffsetX: null, boxAlign: 'left' });
      });
    }
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
    let selection = selectedContainer();
    const data = event.clipboardData?.getData(containerFormat);
    if (!selection && editor.state.selection.empty) {
      const $from = editor.state.selection.$from;
      for (let depth = $from.depth; depth > 0; depth--) {
        if (isContainerAt(editor.state.doc, $from.before(depth))) {
          selection = { from: $from.before(depth), to: $from.after(depth) };
          break;
        }
      }
    }
    const target = activeBoundary();
    const emptyRange = emptyContainerSelection(event);
    const empty = emptyRange && editor.state.doc.nodeAt(emptyRange.from);
    const replaceEmpty = empty && getContainerType(empty).isEmpty;
    if ((!selection && !target && !replaceEmpty) || !data) return;
    let clone;
    try { clone = editor.schema.nodeFromJSON(JSON.parse(data)); } catch { return; }
    if (!types.includes(clone.type.name)) return;
    if (replaceEmpty) {
      event.preventDefault(); event.stopImmediatePropagation();
      const tr = closeHistory(editor.state.tr).replaceWith(emptyRange.from, emptyRange.to, clone);
      tr.setSelection(NodeSelection.create(tr.doc, emptyRange.from));
      boundaryTarget = null; hideEndCaret(); clearMultiSelection();
      editor.view.dispatch(tr.scrollIntoView()); editor.view.dispatch(closeHistory(editor.state.tr)); editor.view.focus();
      return;
    }
    if (target) {
      if (insertAtBoundary(target, clone)) { event.preventDefault(); event.stopImmediatePropagation(); }
      return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    const pos = selection.to, tr = closeHistory(editor.state.tr);
    const $pos = editor.state.doc.resolve(selection.from);
    if ($pos.parent.type.name === 'layoutRow') {
      const row = editor.view.nodeDOM($pos.before());
      const gap = parseFloat(getComputedStyle(row).columnGap) || 22;
      const available = row.getBoundingClientRect().width - gap * $pos.parent.childCount;
      const cloneWidth = clone.attrs.boxWidth || available / ($pos.parent.childCount + 1);
      if (cloneWidth + 60 * $pos.parent.childCount > available + 1) return;
      // Keep copied dimensions; only the receiving row's existing columns share the remaining space.
      $pos.parent.forEach((child, offset) => {
        tr.setNodeMarkup($pos.start() + offset, undefined, { ...child.attrs, boxWidth: (available - cloneWidth) / $pos.parent.childCount, boxOffsetX: null, boxAlign: 'left' });
      });
      clone = clone.type.create({ ...clone.attrs, boxOffsetX: null, boxAlign: 'left' }, clone.content, clone.marks);
    }
    tr.insert(pos, clone);
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
    if (activeBoundary()?.kind === 'end' && ['ArrowDown', 'ArrowRight'].includes(event.key) &&
        !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (activeBoundary()?.kind === 'end' && ['ArrowLeft', 'ArrowUp'].includes(event.key) &&
        !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      const before = boundaryTarget.before;
      const end = Selection.near(editor.state.doc.resolve(before - 1), -1);
      const previous = event.key === 'ArrowUp' ? lastLineStartSelection(editor.view, end) : end;
      boundaryTarget = null; hideEndCaret();
      editor.view.dispatch(editor.state.tr.setSelection(previous).scrollIntoView());
      editor.view.focus();
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
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
    if (selection instanceof NodeSelection && isContainerAt(editor.state.doc, selection.from)) return { from: selection.from, to: selection.to };
    if (!selection.empty) return null;
    const $from = selection.$from;
    for (let depth = 1; depth <= $from.depth; depth++) {
      if ($from.node(depth).type.name === 'blockGroup' && $from.node(depth).attrs.textFlow) return null;
    }
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth), parent = $from.node(depth - 1);
      if (isContainerAt(editor.state.doc, $from.before(depth)) && !node.textContent)
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
  const focusEndInsertion = () => {
    if (!editor.isEditable || !options.noteId?.()) return false;
    const last = editor.state.doc.lastChild;
    if (!last) return false;
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
    return true;
  };
  const onClickBelowLast = event => {
    if (event.button !== 0 || !editor.isEditable || !options.noteId?.()) return;
    if (event.target.closest?.('.object-container,.layout-row,.container-add-tools')) return;
    const blocks = [...editor.view.dom.children].filter(child => child.matches?.('.object-container,.layout-row'));
    const lastDom = blocks.at(-1);
    if (!lastDom || event.clientY <= lastDom.getBoundingClientRect().bottom + 6) return;
    if (!focusEndInsertion()) return;
    event.preventDefault(); event.stopPropagation();
  };
  editor.view.dom.parentElement.addEventListener('mousedown', onClickBelowLast, true);
  const clearBoundaryOnOtherClick = event => {
    if (event.button === 0 && editor.view.dom.parentElement.contains(event.target) &&
        !event.target.closest?.('.object-container') && !ContainerInteractions.isControl(event.target)) {
      clearMultiSelection();
      ContainerVisual.state(editor.view.dom, 'containers-all-selected', false);
      const selection = editor.state.selection;
      if (selection instanceof NodeSelection)
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(selection.from))));
    }
    if (!event.target.closest?.('.container-pair-resize,.container-gap-boundary')) {
      boundaryTarget = null;
      hideEndCaret();
      ContainerVisual.state(editor.view.dom, 'container-boundary-selected', false);
    }
  };
  document.addEventListener('pointerdown', clearBoundaryOnOtherClick, true);
  const { gapAtPoint, rowBoundaryAtPoint } = setupContainerHover(editor, options);
  const selectGap = event => {
    if (event.button !== 0 || event.target.closest?.('.container-select-edge,.container-pair-resize,.container-gap-boundary,.container-type-tools,.container-tools,.container-resize,.container-resize-edge,.container-add-tools')) return;
    const horizontal = rowBoundaryAtPoint(event.clientX, event.clientY);
    if (event.target.closest?.('.object-container') && !horizontal) return;
    const gap = horizontal ? null : gapAtPoint(event.clientX, event.clientY);
    const before = horizontal ? editor.view.posAtDOM(horizontal, 0) :
      gap?.right.dom?.containerView?.props.getPos();
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
    document.removeEventListener('keydown', onCtrlKey, true);
    document.removeEventListener('keyup', onCtrlKey, true);
    window.removeEventListener('blur', clearCtrlActions);
    document.removeEventListener('visibilitychange', clearCtrlActions);
    endCaret.remove();
    boundaryFocus.remove();
    document.removeEventListener('pointerdown', clearBoundaryOnOtherClick, true);
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
  return { focusEndInsertion };
}
