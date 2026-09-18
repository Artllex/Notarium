import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { InlineMath } from '@tiptap/extension-mathematics';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { NumberedMath, CaptionImage } from './document-elements.js';
import { setupMedia, openMath, openImage, editImage, openTable, dismissMedia } from './media.js';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { DOMParser as PMParser } from '@tiptap/pm/model';
import { closeHistory } from '@tiptap/pm/history';
import { CodeCell } from './code-cell.js';
import { setupBlockMovement } from './block-movement.js';
import { importLegacy, readDocument, snapshot } from './storage.js';
import { ContainerAttributes, LayoutRow, BlockGroup, setupContainers, alignContainer } from './containers.js';
import { editContainer, dismissContainer } from './container-dialog.js';
import { textTarget, clearTextTarget } from './rich-label.js';
import { ContainerKeyboard } from './container-keyboard.js';

const post = message => window.chrome?.webview?.postMessage(message);
const sessions = new Map();
const dirty = new Set();
let noteId = null, loading = false;
const editor = new Editor({
  element: document.querySelector('#editor'),
  extensions: [Extension.create({ name: 'documentLayout', addGlobalAttributes: () => [{ types: ['doc'], attributes: { layout: { default: 'note' }, contentWidth: { default: null } } }] }), StarterKit.configure({ link: { openOnClick: false, autolink: true } }), TextStyle, Color, FontFamily,
    Highlight.configure({ multicolor: true }), TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList, TaskItem.configure({ nested: true }), CodeCell, ContainerAttributes, LayoutRow, BlockGroup,
    CaptionImage.configure({ allowBase64: true, onEdit: editImage }),
    TableKit.configure({ table: { resizable: true } }),
    InlineMath.configure({ katexOptions: { throwOnError: false, trust: false, maxExpand: 1000 } }),
    NumberedMath.configure({ katexOptions: { displayMode: true, throwOnError: false, trust: false, maxExpand: 1000 } })],
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
    applyDocumentLayout(transaction.doc);
    if (!loading && transaction.storedMarksSet) publishSelection();
  }
});

const movement = setupBlockMovement(editor, () => noteId);
setupMedia(editor, () => noteId);
setupContainers(editor, { editImage, openMath, editContainer, imageDialogOpen: () => document.querySelector('#image-dialog').open });
new ContainerKeyboard(editor);
editor.view.dom.addEventListener('dblclick', event => {
  const dom = event.target.closest('[data-type="inline-math"]');
  if (!dom) return;
  const pos = editor.view.posAtDOM(dom, 0), node = editor.state.doc.nodeAt(pos);
  if (node?.type.name === 'inlineMath') openMath(node, pos);
});

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
  const width = resolvedContentWidth(editor.state.doc);
  post({ type: 'selection', noteId, font: textTarget(editor).getAttributes('textStyle').fontFamily || 'Segoe UI',
    color: textTarget(editor).getAttributes('textStyle').color || null,
    highlight: textTarget(editor).getAttributes('highlight').color || null,
    contentWidth: width, canUndo: editor.can().undo(), canRedo: editor.can().redo(), inCode: editor.isActive('codeCell') });
}

const resolvedContentWidth = doc => doc.attrs.contentWidth ?? (doc.attrs.layout === 'article' ? 790 : 0);
function applyDocumentLayout(doc) {
  editor.view.dom.dataset.layout = doc.attrs.layout || 'note';
  const width = resolvedContentWidth(doc);
  editor.view.dom.dataset.contentWidth = String(width);
  editor.view.dom.style.setProperty('--content-width', width ? `${width}px` : 'none');
}

function open(message) {
  clearTextTarget();
  movement.cancel();
  dismissMedia();
  dismissContainer();
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
        const article = (message.markdown || '').match(/<!-- notarium:article(?: width=(\d+))? -->/);
        if (article) doc = doc.type.create({ ...doc.attrs, layout: 'article', contentWidth: article[1] ? Number(article[1]) : 790 }, doc.content);
      }
      state = EditorState.create({ doc, schema: editor.schema, plugins: editor.state.plugins });
    }
    noteId = message.noteId;
    editor.view.updateState(state); editor.setEditable(Boolean(noteId));
    applyDocumentLayout(state.doc);
    // Opening a legacy note does not rewrite it or change its modification timestamp.
    publishSelection();
  } finally { loading = false; }
}

function insertionBoundary() {
  const { selection } = editor.state;
  if (selection.node?.type.name === 'blockGroup') return selection.from + selection.node.nodeSize - 1;
  for (let depth = selection.$from.depth; depth > 0; depth--) {
    if (['doc', 'blockGroup', 'layoutRow'].includes(selection.$from.node(depth - 1).type.name)) return selection.$from.after(depth);
  }
  return selection.to;
}
function command(message) {
  if (!noteId) return;
  const action = message.action, value = message.value;
  if (action === 'undo') { editor.commands.undo(); return; }
  if (action === 'redo') { editor.commands.redo(); return; }
  editor.view.dispatch(closeHistory(editor.state.tr));
  const alignment = { alignLeft: 'left', alignCenter: 'center', alignRight: 'right', alignJustify: 'justify' }[action];
  const target = textTarget(editor);
  if (alignment && target === editor && alignContainer(editor, alignment)) return;
  const chain = target.chain().focus();
  switch (action) {
    case 'bold': chain.toggleBold().run(); break;
    case 'italic': chain.toggleItalic().run(); break;
    case 'strike': chain.toggleStrike().run(); break;
    case 'alignLeft': chain.setTextAlign('left').run(); break;
    case 'alignCenter': chain.setTextAlign('center').run(); break;
    case 'alignRight': chain.setTextAlign('right').run(); break;
    case 'alignJustify': chain.setTextAlign('justify').run(); break;
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
    case 'table': openTable(); break;
    case 'contentWidth': {
      const width = Number(value);
      if (![0, 650, 790, 960].includes(width)) throw new Error('Nieobsługiwana szerokość składu.');
      editor.view.dispatch(editor.state.tr.setDocAttribute('contentWidth', width)); break;
    }
    case 'container': {
      const position = insertionBoundary();
      editor.chain().focus().insertContentAt(position, { type: 'blockGroup', content: [{ type: 'paragraph' }] }).setTextSelection(position + 2).run();
      break;
    }
    case 'cell': {
      const position = insertionBoundary();
      chain.insertContentAt(position, [{ type: 'codeCell', attrs: { language: 'python' } }, { type: 'paragraph' }])
        .setTextSelection(position + 1).run();
      break;
    }
  }
}

let linkTarget;
function showLinkDialog() {
  linkTarget = textTarget(editor);
  const dialog = document.querySelector('#link-dialog');
  const input = document.querySelector('#link-url');
  input.value = linkTarget.getAttributes('link').href || 'https://';
  dialog.showModal(); input.focus(); input.select();
}
document.querySelector('#link-dialog').addEventListener('close', event => {
  const target = linkTarget && !linkTarget.isDestroyed ? linkTarget : editor;
  if (event.target.returnValue !== 'save') { target.commands.focus(); return; }
  const href = document.querySelector('#link-url').value.trim();
  if (!/^(https?:\/\/|mailto:)/i.test(href)) return;
  if (target.state.selection.empty) target.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
  else target.chain().focus().setLink({ href }).run();
});

function receive(message) {
  try {
    switch (message.type) {
      case 'open': open(message); break;
      case 'command': command(message); break;
      case 'doubleClick': {
        const x = message.x * innerWidth, y = message.y * innerHeight;
        const target = document.elementFromPoint(x, y);
        if (target && (editor.view.dom.contains(target) || target.closest('.object-container'))) {
          target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y, detail: 2 }));
        }
        break;
      }
      case 'view':
        document.documentElement.style.setProperty('--text-size', `${16 * message.zoom / 100}px`);
        document.documentElement.style.setProperty('--line-height', String(message.spacing)); break;
      case 'focus': textTarget(editor).commands.focus(); break;
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
