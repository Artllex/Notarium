import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Mathematics from '@tiptap/extension-mathematics';
import ImageExtension from '@tiptap/extension-image';
import { setupMedia, openMath, openImage, dismissMedia } from './media.js';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { DOMParser as PMParser } from '@tiptap/pm/model';
import { closeHistory } from '@tiptap/pm/history';
import { CodeCell } from './code-cell.js';
import { importLegacy, readDocument, snapshot } from './storage.js';

const post = message => window.chrome?.webview?.postMessage(message);
const sessions = new Map();
const dirty = new Set();
let noteId = null, loading = false;
const editor = new Editor({
  element: document.querySelector('#editor'),
  extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: true } }), TextStyle, Color, FontFamily,
    Highlight.configure({ multicolor: true }), TaskList, TaskItem.configure({ nested: true }), CodeCell,
    ImageExtension.configure({ allowBase64: true }),
    Mathematics.configure({ katexOptions: { throwOnError: false, trust: false, maxExpand: 1000 },
      inlineOptions: { onClick: (node, pos) => openMath(node, pos) },
      blockOptions: { onClick: (node, pos) => openMath(node, pos) } })],
  content: '<p></p>',
  editorProps: {
    attributes: { spellcheck: 'true', 'aria-label': 'Edytor notatki' },
    handleClick(_view, _pos, event) {
      const link = event.target.closest('a');
      if (!link) return false;
      const url = link.getAttribute('href');
      if (/^(https?:|mailto:)/i.test(url || '')) post({ type: 'openLink', url });
      event.preventDefault(); return true;
    }
  },
  onUpdate() { if (!loading && noteId) publish(); },
  onSelectionUpdate() { if (!loading) publishSelection(); },
  onTransaction({ transaction }) {
    if (!loading && transaction.storedMarksSet) publishSelection();
  }
});

setupMedia(editor, () => noteId);

function publish() {
  dirty.add(noteId);
  sessions.set(noteId, editor.state);
  post({ type: 'changed', noteId, ...snapshot(editor) });
  publishSelection();
}

// The document's outer padding looks like paper too. Only handle that padding;
// leave text selection, checkboxes and CodeMirror mouse handling to their engines.
document.querySelector('#editor').addEventListener('mousedown', event => {
  if (event.button !== 0 || event.target !== event.currentTarget || !noteId || !editor.isEditable) return;
  const bounds = editor.view.dom.getBoundingClientRect();
  const hit = editor.view.posAtCoords({
    left: Math.max(bounds.left + 1, Math.min(event.clientX, bounds.right - 1)),
    top: Math.max(bounds.top + 1, Math.min(event.clientY, bounds.bottom - 1))
  });
  const position = hit?.pos ?? (event.clientY < bounds.top ? 0 : editor.state.doc.content.size);
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(position))));
  editor.view.focus();
  event.preventDefault();
});
function publishSelection() {
  post({ type: 'selection', noteId, font: editor.getAttributes('textStyle').fontFamily || 'Segoe UI',
    canUndo: editor.can().undo(), canRedo: editor.can().redo(), inCode: editor.isActive('codeCell') });
}

function open(message) {
  dismissMedia();
  if (noteId) sessions.set(noteId, editor.state);
  loading = true;
  try {
    let state = sessions.get(message.noteId);
    if (!state) {
      let doc;
      if (message.documentJson) { doc = editor.schema.nodeFromJSON(readDocument(message.documentJson)); doc.check(); }
      else {
        const host = document.createElement('div'); host.innerHTML = importLegacy(message.markdown);
        doc = PMParser.fromSchema(editor.schema).parse(host);
      }
      state = EditorState.create({ doc, schema: editor.schema, plugins: editor.state.plugins });
    }
    noteId = message.noteId;
    editor.view.updateState(state); editor.setEditable(Boolean(noteId));
    // Opening a legacy note does not rewrite it or change its modification timestamp.
    publishSelection();
  } finally { loading = false; }
}

function command(message) {
  if (!noteId) return;
  const action = message.action, value = message.value;
  if (action === 'undo') { editor.commands.undo(); return; }
  if (action === 'redo') { editor.commands.redo(); return; }
  editor.view.dispatch(closeHistory(editor.state.tr));
  const chain = editor.chain().focus();
  switch (action) {
    case 'bold': chain.toggleBold().run(); break;
    case 'italic': chain.toggleItalic().run(); break;
    case 'strike': chain.toggleStrike().run(); break;
    case 'heading': chain.toggleHeading({ level: 1 }).run(); break;
    case 'bullet': chain.toggleBulletList().run(); break;
    case 'numbered': chain.toggleOrderedList().run(); break;
    case 'checklist': chain.toggleTaskList().run(); break;
    case 'code': chain.toggleCode().run(); break;
    case 'codeblock': chain.toggleCodeBlock().run(); break;
    case 'font': chain.setFontFamily(value).run(); break;
    case 'color': chain.setColor(value).run(); break;
    case 'clearColor': chain.unsetColor().run(); break;
    case 'clearHighlight': chain.unsetHighlight().run(); break;
    case 'highlight': chain.setHighlight({ color: value }).run(); break;
    case 'link': showLinkDialog(); break;
    case 'math': openMath(); break;
    case 'image': openImage(); break;
    case 'cell': {
      const from = editor.state.selection.$from;
      const position = from.depth ? from.after(1) : editor.state.doc.content.size;
      chain.insertContentAt(position, [{ type: 'codeCell', attrs: { language: 'python' } }, { type: 'paragraph' }])
        .setTextSelection(position + 1).run();
      break;
    }
  }
}

function showLinkDialog() {
  const dialog = document.querySelector('#link-dialog');
  const input = document.querySelector('#link-url');
  input.value = editor.getAttributes('link').href || 'https://';
  dialog.showModal(); input.focus(); input.select();
}
document.querySelector('#link-dialog').addEventListener('close', event => {
  if (event.target.returnValue !== 'save') { editor.commands.focus(); return; }
  const href = document.querySelector('#link-url').value.trim();
  if (!/^(https?:\/\/|mailto:)/i.test(href)) return;
  if (editor.state.selection.empty) editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
  else editor.chain().focus().setLink({ href }).run();
});

function receive(message) {
  try {
    switch (message.type) {
      case 'open': open(message); break;
      case 'command': command(message); break;
      case 'view':
        document.documentElement.style.setProperty('--text-size', `${16 * message.zoom / 100}px`);
        document.documentElement.style.setProperty('--line-height', String(message.spacing)); break;
      case 'focus': editor.commands.focus(); break;
      case 'close': sessions.delete(message.noteId); dirty.delete(message.noteId); break;
      case 'flush': post({ type: 'flushed', requestId: message.requestId, noteId, changed: dirty.has(noteId), ...snapshot(editor) }); break;
    }
  } catch (error) {
    if (message.type === 'open') editor.setEditable(false);
    post({ type: 'error', message: String(error.message || error), noteId: message.noteId || noteId });
  }
}
window.chrome?.webview?.addEventListener('message', event => receive(event.data));
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && ['s', 'o', 'n'].includes(event.key.toLowerCase())) {
    event.preventDefault(); post({ type: 'shortcut', key: event.key.toLowerCase() });
  }
});
window.notatnik = { receive, editor, snapshot: () => snapshot(editor) };
post({ type: 'ready' });
