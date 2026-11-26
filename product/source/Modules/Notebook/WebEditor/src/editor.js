import { Dialog } from '../../../../Shared/Web/UI/components.js';
import { VisualRegistry } from '../../../../Shared/Web/UI/registry.js';
VisualRegistry.install();
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TrailingNode } from '@tiptap/extensions';
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { InlineMath } from '@tiptap/extension-mathematics';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { NumberedMath, CaptionImage } from './document-elements.js';
import { setupMedia, openMath, openImage, editImage, openTable, dismissMedia } from './media.js';
import { EditorState, Plugin, PluginKey, TextSelection, NodeSelection } from '@tiptap/pm/state';
import { DOMParser as PMParser } from '@tiptap/pm/model';
import { closeHistory } from '@tiptap/pm/history';
import { CodeCell, CodeBlockSurface } from './code-cell.js';
import { setupBlockMovement } from './block-movement.js';
import { importLegacy, readDocument, snapshot } from './storage.js';
import { ContainerAttributes, LayoutRow, BlockGroup, setupContainers, alignContainer } from './containers.js';
import { editContainer, dismissContainer } from './container-dialog.js';
import { textTarget, clearTextTarget } from './rich-label.js';
import { ContainerKeyboard } from './container-keyboard.js';
import { isContainerAt } from './container-types.js';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { listClipboardText } from './list-clipboard.js';
import { targetElement } from './dom-target.js';
const lineListUndoKey = new PluginKey('lineListUndo');
const wordSelectionKey = new PluginKey('wordSelection');
function selectTextRange(view, range, toggle = false) {
  const ranges = wordSelectionKey.getState(view.state);
  const same = item => item.from === range.from && item.to === range.to;
  const covered = ranges.some(item => item.from <= range.from && item.to >= range.to);
  const next = toggle && ranges.some(same) ? ranges.filter(item => !same(item)) : covered ?
    ranges.map(item => same(item) && range.kind ? { ...item, kind: range.kind } : item) :
    [...ranges.filter(item => item.to <= range.from || item.from >= range.to), range].sort((a, b) => a.from - b.from);
  view.dispatch(view.state.tr.setMeta(wordSelectionKey, next)
    .setSelection(TextSelection.create(view.state.doc, range.from, range.to)));
}
const wordSelections = Extension.create({
  name: 'wordSelections',
  addProseMirrorPlugins() { return [new Plugin({ key: wordSelectionKey,
    state: { init: () => [], apply: (tr, ranges) => tr.getMeta(wordSelectionKey) ??
      (tr.docChanged ? [] : ranges) },
    props: { decorations(state) { return DecorationSet.create(state.doc, wordSelectionKey.getState(state).map(range =>
      Decoration.inline(range.from, range.to, { class: 'word-multi-selection', style: 'background:#31547a;color:inherit' }))); } }
  })]; }
});
// Text-flow groups are editable to their end, just like paragraphs.
const containerTrailingNode = TrailingNode.extend({
  addProseMirrorPlugins() {
    return this.parent().map(plugin => new Plugin({ ...plugin.spec,
      appendTransaction: (transactions, oldState, state) => state.doc.lastChild?.attrs.textFlow ? null :
        plugin.spec.appendTransaction?.call(plugin, transactions, oldState, state)
    }));
  }
});
const textFlowSelection = Extension.create({
  name: 'textFlowSelection',
  addProseMirrorPlugins() {
    return [new Plugin({ appendTransaction(_transactions, _oldState, state) {
      if (!(state.selection instanceof NodeSelection)) return null;
      if (isContainerAt(state.doc, state.selection.from)) return null;
      const $from = state.selection.$from;
      for (let depth = $from.depth; depth > 0; depth--) {
        if (isContainerAt(state.doc, $from.before(depth)))
          return state.tr.setSelection(NodeSelection.create(state.doc, $from.before(depth)));
      }
      return null;
    } })];
  }
});
const lineListUndo = Extension.create({
  name: 'lineListUndo',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: lineListUndoKey,
      isInputRules: true,
      state: {
        init: () => null,
        apply: (tr, previous) => tr.getMeta(lineListUndoKey) ||
          (tr.docChanged || tr.selectionSet ? null : previous)
      }
    })];
  }
});

const post = message => window.chrome?.webview?.postMessage(message);
const sessions = new Map();
const dirty = new Set();
let noteId = null, loading = false;
const isAutomaticEmptyAfterRow = (node, previous) => previous?.type.name === 'layoutRow' &&
  node.type.name === 'paragraph' && !node.content.size && !node.attrs.boxEmpty && !node.attrs.boxTextExplicit;
const normalizeAutomaticEmptyAfterRows = doc => {
  let previous = null, changed = false;
  const children = [];
  doc.forEach(node => {
    const replacement = isAutomaticEmptyAfterRow(node, previous) ?
      node.type.create({ ...node.attrs, boxEmpty: true }, node.content, node.marks) : node;
    changed ||= replacement !== node;
    children.push(replacement);
    previous = node;
  });
  return changed ? doc.type.create(doc.attrs, children, doc.marks) : doc;
};
const autoEmptyAfterRow = Extension.create({
  name: 'autoEmptyAfterRow',
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, _oldState, state) {
        if (!transactions.some(transaction => transaction.docChanged)) return null;
        const tr = state.tr;
        let previous = null;
        state.doc.forEach((node, pos) => {
          if (isAutomaticEmptyAfterRow(node, previous)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, boxEmpty: true });
          previous = node;
        });
        return tr.docChanged ? tr : null;
      }
    })];
  }
});
const editor = new Editor({
  element: document.querySelector('#editor'),
  extensions: [Extension.create({ name: 'documentLayout', addGlobalAttributes: () => [{ types: ['doc'], attributes: { contentWidth: { default: null } } }] }), StarterKit.configure({ codeBlock: false, trailingNode: false, link: { openOnClick: false, autolink: true } }), containerTrailingNode, textFlowSelection, TextStyle, Color, FontFamily,
    Highlight.configure({ multicolor: true }), TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Extension.create({ name: 'paragraphLineSpacing', addGlobalAttributes: () => [{ types: ['paragraph', 'heading'], attributes: {
      lineSpacing: { default: null, parseHTML: el => Number(el.style.lineHeight) || null,
        renderHTML: attrs => attrs.lineSpacing ? { style: `line-height:${attrs.lineSpacing}` } : {} }
    } }] }),
    TaskList, TaskItem.configure({ nested: true }), CodeCell, CodeBlockSurface, ContainerAttributes, LayoutRow, BlockGroup, autoEmptyAfterRow, lineListUndo, wordSelections,
    CaptionImage.configure({ allowBase64: true, onEdit: editImage }),
    TableKit.configure({ table: { resizable: true } }),
    InlineMath.configure({ katexOptions: { throwOnError: false, trust: false, maxExpand: 1000 } }),
    NumberedMath.configure({ katexOptions: { displayMode: true, throwOnError: false, trust: false, maxExpand: 1000 } })],
  content: '<p></p>',
  editorProps: {
    handleDOMEvents: {
      dragstart(view, event) {
        const text = targetElement(event.target)?.closest('p,h1,h2,h3,h4,h5,h6,li');
        if (!text || !view.dom.contains(text)) return false;
        // Selecting or dragging a line is not permission to extract its list.
        // Containers move through the shared pointer/handle path, not HTML DnD.
        event.preventDefault();
        return true;
      }
    },
    handleDoubleClick(view, pos, event) {
      if (!event.target.closest?.('.object-container') || event.target.closest('button,input,select,.container-type-tools,.container-add-tools')) return false;
      pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? pos;
      const $pos = view.state.doc.resolve(pos);
      if (!$pos.parent.isTextblock) return false;
      const start = $pos.start(), end = $pos.end(), top = view.coordsAtPos(pos).top;
      let from = pos, to = pos;
      while (from > start && Math.abs(view.coordsAtPos(from - 1).top - top) < 1) from--;
      while (to < end && Math.abs(view.coordsAtPos(to + 1).top - top) < 1) to++;
      if (event.ctrlKey) selectTextRange(view, { from, to, kind: 'line' });
      else view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
      return true;
    },
    handleTripleClick(view, _pos, event) {
      if (event.detail !== 3) return editor.options.editorProps.handleDoubleClick(view, _pos, event);
      const host = event.target.closest?.('.object-container');
      const start = host?.containerView?.props.getPos();
      if (typeof start !== 'number' || event.target.closest('button,input,select,.container-type-tools,.container-add-tools')) return false;
      const node = view.state.doc.nodeAt(start);
      if (!node || !isContainerAt(view.state.doc, start)) return false;
      view.dispatch(view.state.tr.setSelection(TextSelection.between(
        view.state.doc.resolve(start + 1), view.state.doc.resolve(start + node.nodeSize - 1))));
      return true;
    },
    attributes: { spellcheck: 'true', 'aria-label': 'Edytor notatki' },
    clipboardTextSerializer(slice, view) {
      return listClipboardText(slice, view.state) ?? slice.content.textBetween(0, slice.content.size, '\n\n', '\n');
    },
    handleTextInput(view, from, to, text) {
      if (text !== ' ' || from !== to) return false;
      const $from = view.state.doc.resolve(from), paragraph = $from.parent;
      if (paragraph.type.name !== 'paragraph') return false;
      let lineStart = 0;
      paragraph.forEach((node, offset) => { if (node.type.name === 'hardBreak' && offset < $from.parentOffset) lineStart = offset + node.nodeSize; });
      if (!lineStart) return false; // StarterKit handles markers at the beginning of a paragraph.
      const marker = paragraph.textBetween(lineStart, $from.parentOffset);
      const ordered = /^(\d+)\.$/.exec(marker);
      if (!ordered && marker !== '-') return false;
      const schema = view.state.schema;
      const before = paragraph.type.create(null, paragraph.content.cut(0, lineStart - 1));
      const itemParagraph = schema.nodes.paragraph.create(null, paragraph.content.cut($from.parentOffset));
      const list = schema.nodes[ordered ? 'orderedList' : 'bulletList'].create(ordered ? { start: Number(ordered[1]) } : null,
        schema.nodes.listItem.create(null, itemParagraph));
      const group = schema.nodes.blockGroup.create({ ...paragraph.attrs, textFlow: true }, [before, list]);
      const start = $from.before();
      const tr = view.state.tr.replaceWith(start, $from.after(), group);
      tr.setSelection(TextSelection.create(tr.doc, start + 1 + before.nodeSize + 3));
      tr.setMeta(lineListUndoKey, { transform: tr, from, to, text });
      view.dispatch(tr.scrollIntoView());
      return true;
    },
    handleClick(_view, _pos, event) {
      if (event.ctrlKey && event.target.closest?.('.object-container')) {
        const $pos = _view.state.doc.resolve(_pos);
        if ($pos.parent.isTextblock) {
          const text = $pos.parent.textBetween(0, $pos.parent.content.size, '\n', '\ufffc');
          let from = $pos.parentOffset, to = from;
          const word = char => Boolean(char && /[\p{L}\p{N}_]/u.test(char));
          if (!word(text[from]) && from > 0 && word(text[from - 1])) from--;
          to = from;
          while (from > 0 && word(text[from - 1])) from--;
          while (to < text.length && word(text[to])) to++;
          if (to > from) {
            const range = { from: $pos.start() + from, to: $pos.start() + to };
            selectTextRange(_view, range, true);
            return true;
          }
        }
      }
      const link = targetElement(event.target)?.closest('a');
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
const containerNavigation = setupContainers(editor, { editImage, openMath, editContainer, noteId: () => noteId, imageDialogOpen: () => document.querySelector('#image-dialog').open });
new ContainerKeyboard(editor, containerNavigation);
// Use the browser's click detail, not ProseMirror's independent click counter.
// Capture before its mousedown handler can promote a double click to a triple.
for (const eventType of ['mousedown', 'mouseup']) editor.view.dom.addEventListener(eventType, event => {
  if (event.button !== 0 || event.metaKey || event.detail < 2) return;
  if (!event.target.closest?.('.object-container') || event.target.closest('button,input,select,.container-type-tools,.container-add-tools,.container-resize,.container-resize-edge,.container-select-edge')) return;
  const hit = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!hit) return;
  const handler = event.detail === 3 && !event.ctrlKey ? editor.options.editorProps.handleTripleClick : editor.options.editorProps.handleDoubleClick;
  if (handler(editor.view, hit.pos, event)) {
    event.preventDefault(); event.stopImmediatePropagation();
    if (eventType === 'mouseup') requestAnimationFrame(() => handler(editor.view, hit.pos, event));
  }
}, true);
editor.view.dom.addEventListener('mousedown', event => {
  if (!event.ctrlKey && wordSelectionKey.getState(editor.state).length)
    editor.view.dispatch(editor.state.tr.setMeta(wordSelectionKey, []));
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && wordSelectionKey.getState(editor.state).length)
    editor.view.dispatch(editor.state.tr.setMeta(wordSelectionKey, [])
      .setSelection(TextSelection.near(editor.state.doc.resolve(editor.state.selection.head))));
}, true);
for (const type of ['copy', 'cut']) editor.view.dom.addEventListener(type, event => {
  const ranges = wordSelectionKey.getState(editor.state);
  if (!ranges.length || !event.clipboardData) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const entries = ranges.map(range => {
    const entry = { text: editor.state.doc.textBetween(range.from, range.to) };
    if (range.kind !== 'line') return entry;
    const $pos = editor.state.doc.resolve(range.from);
    for (let depth = $pos.depth; depth > 0; depth--) {
      if ($pos.node(depth).type.name !== 'listItem') continue;
      const list = $pos.node(depth - 1);
      entry.item = $pos.before(depth);
      entry.marker = list.type.name === 'orderedList' ? `${(list.attrs.start || 1) + $pos.index(depth - 1)}.` : '-';
      break;
    }
    return entry;
  });
  const multipleItems = new Set(entries.filter(entry => entry.marker).map(entry => entry.item)).size > 1;
  const renderedItems = new Set();
  event.clipboardData.setData('text/plain', entries.map(entry => {
    if (!multipleItems || !entry.marker || renderedItems.has(entry.item)) return entry.text;
    renderedItems.add(entry.item);
    return `${entry.marker} ${entry.text}`;
  }).join(ranges.some(range => range.kind === 'line') ? '\n' : ' '));
  if (type === 'cut') {
    const tr = closeHistory(editor.state.tr);
    for (const range of [...ranges].reverse()) tr.delete(range.from, range.to);
    editor.view.dispatch(tr.setMeta(wordSelectionKey, []));
  }
}, true);
editor.view.dom.addEventListener('dblclick', event => {
  const hit = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (hit && editor.options.editorProps.handleDoubleClick(editor.view, hit.pos, event)) {
    event.preventDefault(); event.stopPropagation(); return;
  }
  const dom = event.target.closest?.('[data-type="inline-math"]');
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

const resolvedContentWidth = doc => doc.attrs.contentWidth ?? 0;
function applyDocumentLayout(doc) {
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
        const width = (message.markdown || '').match(/<!-- notarium:content-width (650|790|960) -->/);
        if (width) doc = doc.type.create({ ...doc.attrs, contentWidth: Number(width[1]) }, doc.content);
      }
      state = EditorState.create({ doc: normalizeAutomaticEmptyAfterRows(doc), schema: editor.schema, plugins: editor.state.plugins });
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
  if (action === 'lineSpacing') {
    const spacing = Number(value);
    if (!Number.isFinite(spacing) || spacing < 1 || spacing > 2) return;
    const { from, to, empty } = editor.state.selection;
    const tr = closeHistory(editor.state.tr);
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (!['paragraph', 'heading'].includes(node.type.name)) return;
      if (!empty && (pos + node.nodeSize <= from || pos >= to)) return;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineSpacing: spacing });
    });
    if (tr.docChanged) editor.view.dispatch(tr);
    editor.view.dispatch(closeHistory(editor.state.tr));
    return;
  }
  if (action === 'persistentHighlights') {
    document.body.classList.toggle('persistent-container-highlights', value === true || value === 'true');
    return;
  }
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
      chain.insertContentAt(position, [{ type: 'codeCell', attrs: { language: 'python' } }, { type: 'paragraph', attrs: { boxEmpty: true } }])
        .setTextSelection(position + 1).run();
      break;
    }
  }
}

let linkTarget, linkSelection;
function showLinkDialog() {
  linkTarget = textTarget(editor);
  linkSelection = linkTarget.state.selection;
  const dialog = document.querySelector('#link-dialog');
  const input = document.querySelector('#link-url');
  input.value = linkTarget.getAttributes('link').href || 'https://';
  Dialog.for(dialog).open(); input.focus({ preventScroll: true }); input.select();
}
document.querySelector('#link-dialog').addEventListener('close', event => {
  const target = linkTarget && !linkTarget.isDestroyed ? linkTarget : editor;
  if (event.target.returnValue !== 'save') { target.commands.focus(); return; }
  if (linkSelection) target.view.dispatch(target.state.tr.setSelection(linkSelection));
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
        applyDocumentLayout(editor.state.doc); break;
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
