import { TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { wordSelectionKey } from './text-selection.js';
import { openMath } from './media.js';

export function setupTextGestures(editor) {
  const listeners = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };
  editor.on('destroy', () => { for (const remove of listeners) remove(); });
  // Use the browser's click detail, not ProseMirror's independent click counter.
  // Capture before its mousedown handler can promote a double click to a triple.
  for (const eventType of ['mousedown', 'mouseup']) listen(editor.view.dom, eventType, event => {
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
  listen(editor.view.dom, 'mousedown', event => {
    if (!event.ctrlKey && wordSelectionKey.getState(editor.state).length)
      editor.view.dispatch(editor.state.tr.setMeta(wordSelectionKey, []));
  }, true);
  listen(document, 'keydown', event => {
    if (event.key === 'Escape' && wordSelectionKey.getState(editor.state).length)
      editor.view.dispatch(editor.state.tr.setMeta(wordSelectionKey, [])
        .setSelection(TextSelection.near(editor.state.doc.resolve(editor.state.selection.head))));
  }, true);
  for (const type of ['copy', 'cut']) listen(editor.view.dom, type, event => {
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
  listen(editor.view.dom, 'dblclick', event => {
    const hit = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (hit && editor.options.editorProps.handleDoubleClick(editor.view, hit.pos, event)) {
      event.preventDefault(); event.stopPropagation(); return;
    }
    const dom = event.target.closest?.('[data-type="inline-math"]');
    if (!dom) return;
    const pos = editor.view.posAtDOM(dom, 0), node = editor.state.doc.nodeAt(pos);
    if (node?.type.name === 'inlineMath') openMath(node, pos);
  });

}
