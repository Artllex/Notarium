import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { closeHistory } from '@tiptap/pm/history';

let active = null;
export const textTarget = parent => active?.parent === parent && !active.editor?.isDestroyed ? active.editor : parent;
export function clearTextTarget() { active = null; }
document.addEventListener('pointerdown', event => {
  if (event.target.closest('.ProseMirror') && !event.target.closest('.rich-label')) active = null;
}, true);

export function richAttribute(name) {
  return { default: null, parseHTML: el => el.getAttribute('data-' + name.toLowerCase()),
    renderHTML: attrs => attrs[name] ? { ['data-' + name.toLowerCase()]: attrs[name] } : {} };
}

// Persistent engine-backed text fields. Their changes belong to the containing
// document's history, not a separate input/blur transaction or undo stack.
export class RichLabelView {
  constructor(element, parent, getPos, attribute, label) {
    Object.assign(this, { element, parent, getPos, attribute });
    this.richAttribute = attribute + 'Rich';
    element.classList.add('rich-label'); element.contentEditable = 'false';
    this.label = label;
  }
  update(node) {
    const text = node.attrs[this.attribute] || '', html = node.attrs[this.richAttribute];
    this.element.hidden = !text && active !== this;
    if (!this.editor && !text) return;
    if (!this.editor) this.create();
    let content = html || { type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] };
    if (this.savedText === text && this.savedHTML === html) return;
    this.savedText = text; this.savedHTML = html;
    this.editor.commands.setContent(content, { emitUpdate: false });
    // Settings dialogs still accept plain text. An intentionally changed plain
    // label supersedes its previous formatting; unchanged labels retain it.
    if (this.editor.getText() !== text) this.editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] }, { emitUpdate: false });
  }
  create() {
    const owner = this;
    this.editor = new Editor({ element: this.element,
      extensions: [StarterKit.configure({ undoRedo: false, link: { openOnClick: false } }), TextStyle, Color, FontFamily,
        Highlight.configure({ multicolor: true }), TextAlign.configure({ types: ['heading', 'paragraph'] }), TaskList, TaskItem.configure({ nested: true }),
        Extension.create({ name: 'documentHistory', addKeyboardShortcuts() { return {
          'Mod-z': () => owner.parent.commands.undo(), 'Mod-Shift-z': () => owner.parent.commands.redo(), 'Mod-y': () => owner.parent.commands.redo(),
          'Mod-Home': () => this.editor.commands.setTextSelection(1),
          'Mod-End': () => this.editor.commands.setTextSelection(this.editor.state.doc.content.size - 1)
        }; } })],
      editorProps: { attributes: { class: 'label-editor', 'aria-label': this.label }, handleDOMEvents: {
        mousedown: () => { this.activate(); return false; },
        focus: () => { this.activate(); this.parent.emit('selectionUpdate', { editor: this.parent }); return false; }
      } },
      onSelectionUpdate: () => { if (active === this) this.parent.emit('selectionUpdate', { editor: this.parent }); },
      onUpdate: () => this.save()
    });
    this.editor.view.dom.classList.remove('tiptap');
  }
  save() {
    const pos = this.getPos(), node = typeof pos === 'number' && this.parent.state.doc.nodeAt(pos);
    if (!node) return;
    this.savedText = this.editor.getText(); this.savedHTML = this.editor.getHTML();
    this.parent.view.dispatch(this.parent.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs, [this.attribute]: this.savedText, [this.richAttribute]: this.savedHTML
    }));
  }
  activate() { if (active !== this) { active = this; this.parent.view.dispatch(closeHistory(this.parent.state.tr)); } }
  destroy() { if (active === this) active = null; this.editor?.destroy(); }
}
