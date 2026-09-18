import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';

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
  createAfter(pos) {
    const { state, view, schema } = this.editor;
    const node = state.doc.nodeAt(pos);
    if (!node) return;
    const boundary = pos + node.nodeSize;
    const tr = closeHistory(state.tr).insert(boundary, schema.nodes.paragraph.create());
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
