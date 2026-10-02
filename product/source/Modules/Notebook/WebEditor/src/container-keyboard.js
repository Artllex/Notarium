import { NodeSelection, Selection, TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';

export function lastLineStartSelection(view, end) {
  if (!(end instanceof TextSelection)) return end;
  const start = end.$from.start(), endPos = end.from;
  const lastLineTop = view.coordsAtPos(endPos).top;
  let low = start, high = endPos;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (view.coordsAtPos(middle).top < lastLineTop - 1) low = middle + 1;
    else high = middle;
  }
  return TextSelection.create(view.state.doc, low);
}

// One keyboard policy for text, nested containers and embedded code editors.
export class ContainerKeyboard {
  constructor(editor) {
    this.editor = editor;
    this.onKey = event => this.handle(event);
    editor.view.dom.addEventListener('keydown', this.onKey, true);
    editor.on('destroy', () => editor.view.dom.removeEventListener('keydown', this.onKey, true));
  }
  handle(event) {
    if (event.isComposing || !this.editor.isEditable || event.altKey || event.target.closest('input,textarea,select,button')) return;
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey &&
        !event.target.closest('.cm-editor,.rich-label') && this.navigateArrow(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    const create = event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.shiftKey;
    const next = event.key === 'Tab' && event.shiftKey && !event.ctrlKey && !event.metaKey;
    const newline = event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    if (!create && !next && !newline) return;
    if (newline && event.target.closest('.cm-editor,.rich-label')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (newline) {
      if (this.editor.state.selection.$from.parent.type.spec.code) this.editor.commands.insertContent('\n');
      else this.editor.commands.setHardBreak();
      return;
    }
    const selectionPos = this.editor.state.selection.from;
    const wrapper = event.target.closest('.object-container') || [...this.editor.view.dom.querySelectorAll('.object-container')].reverse().find(dom => {
      const start = dom.containerView?.props.getPos();
      const node = typeof start === 'number' && this.editor.state.doc.nodeAt(start);
      return node && start <= selectionPos && selectionPos < start + node.nodeSize;
    });
    const pos = wrapper?.containerView?.props.getPos();
    if (typeof pos !== 'number') return;
    if (create) this.createAfter(pos);
    else this.focusNext(wrapper);
  }
  navigateArrow(key) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return false;
    const { state, view } = this.editor;
    const { selection } = state;
    if (!(selection instanceof TextSelection) || !selection.empty || selection.$from.depth < 1) return false;
    const $from = selection.$from, depth = $from.depth, parent = $from.node(depth - 1);
    if (!['doc', 'layoutRow', 'blockGroup'].includes(parent.type.name)) return false;
    const index = $from.index(depth - 1), backward = key === 'ArrowLeft' || key === 'ArrowUp';
    let target;
    if (backward) {
      if (index === 0 || (key === 'ArrowLeft' && $from.parentOffset !== 0) ||
          (key === 'ArrowUp' && !view.endOfTextblock('up'))) return false;
      const current = $from.before(depth);
      target = Selection.near(state.doc.resolve(current - 1), -1);
      if (target.from >= current) return false;
      if (key === 'ArrowUp') target = lastLineStartSelection(view, target);
    } else {
      if (index + 1 >= parent.childCount ||
          (key === 'ArrowRight' && $from.parentOffset !== $from.parent.content.size) ||
          (key === 'ArrowDown' && !view.endOfTextblock('down'))) return false;
      const next = parent.child(index + 1);
      if (key === 'ArrowRight' && parent.type.name === 'doc' && index + 2 === parent.childCount &&
          next.type.name === 'paragraph' && next.attrs.boxEmpty && !next.content.size) return true;
      const nextStart = $from.after(depth);
      target = Selection.near(state.doc.resolve(nextStart + 1), 1);
      if (target.from < nextStart) return false;
    }
    view.dispatch(state.tr.setSelection(target).scrollIntoView());
    view.focus();
    return true;
  }
  createAfter(pos) {
    const { state, view, schema } = this.editor;
    const node = state.doc.nodeAt(pos);
    if (!node) return;
    const boundary = pos + node.nodeSize;
    const tr = closeHistory(state.tr).insert(boundary, schema.nodes.paragraph.create({ boxEmpty: true }));
    tr.setSelection(TextSelection.create(tr.doc, boundary + 1));
    view.dispatch(tr.scrollIntoView());
    view.dispatch(closeHistory(this.editor.state.tr));
    view.focus();
  }
  focusNext(wrapper) {
    const wrappers = [...this.editor.view.dom.querySelectorAll('.object-container')];
    const target = wrappers[wrappers.indexOf(wrapper) + 1];
    if (!target) return; // Navigation never creates content or wraps unexpectedly.
    const pos = target.containerView?.props.getPos();
    if (typeof pos !== 'number') return;
    const { state, view } = this.editor;
    const node = state.doc.nodeAt(pos);
    const selection = node.isTextblock ? TextSelection.create(state.doc, pos + 1)
      : node.isAtom ? NodeSelection.create(state.doc, pos)
      : TextSelection.near(state.doc.resolve(pos + 1));
    view.dispatch(state.tr.setSelection(selection).scrollIntoView());
    view.focus();
  }
}
