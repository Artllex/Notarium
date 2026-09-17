import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { moveBlock } from './block-movement.js';
import { EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

const findLanguage = value => languages.find(item => item.name.toLowerCase() === value.toLowerCase() || item.alias.includes(value.toLowerCase()));
const languageList = document.createElement('datalist'); languageList.id = 'cell-languages';
for (const item of [...languages].sort((a,b) => a.name.localeCompare(b.name))) {
  const option = document.createElement('option'); option.value = item.name; languageList.append(option);
}
document.body.append(languageList);

export const CodeCell = Node.create({
  name: 'codeCell', group: 'block', content: 'text*', marks: '', code: true, defining: true, isolating: true,
  addAttributes() { return { language: { default: 'python', parseHTML: element => element.dataset.codeCell || 'python' } }; },
  parseHTML() { return [{ tag: 'section[data-code-cell]', preserveWhitespace: 'full', contentElement: 'code' }]; },
  renderHTML({ node, HTMLAttributes }) { return ['section', mergeAttributes(HTMLAttributes, { 'data-code-cell': node.attrs.language }), ['pre', ['code', 0]]]; },
  addNodeView() {
    return ({ node: initialNode, editor, getPos }) => {
      let node = initialNode, syncing = false, destroyed = false, revision = 0;
      const languageMode = new Compartment();
      const dom = document.createElement('section'); dom.className = 'code-cell'; dom.dataset.codeCell = 'python';
      const tools = document.createElement('div'); tools.className = 'cell-tools'; tools.contentEditable = 'false';
      const language = document.createElement('span'); language.className = 'language'; language.textContent = 'Python'; tools.append(language);
      language.title = 'Dwuklik: zmień język';
      const languageInput = document.createElement('input'); languageInput.className = 'cell-language-input';
      languageInput.setAttribute('list', 'cell-languages'); languageInput.setAttribute('aria-label', 'Język komórki'); languageInput.hidden = true;
      tools.append(languageInput);
      language.addEventListener('dblclick', event => {
        event.preventDefault(); event.stopPropagation(); language.hidden = true; languageInput.hidden = false;
        languageInput.value = findLanguage(node.attrs.language)?.name || node.attrs.language;
        languageInput.focus(); languageInput.select();
      });
      function cancelLanguage() { languageInput.hidden = true; language.hidden = false; languageInput.setCustomValidity(''); }
      function commitLanguage() {
        const match = findLanguage(languageInput.value.trim());
        if (!match) { languageInput.setCustomValidity('Wybierz język z listy.'); languageInput.reportValidity(); return; }
        const pos = getPos(); cancelLanguage();
        if (typeof pos === 'number' && node.attrs.language !== match.name.toLowerCase()) {
          editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, { ...node.attrs, language: match.name.toLowerCase() }));
          editor.view.dispatch(closeHistory(editor.state.tr));
        }
      }
      languageInput.addEventListener('input', () => languageInput.setCustomValidity(''));
      languageInput.addEventListener('change', commitLanguage);
      languageInput.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Enter') { event.preventDefault(); commitLanguage(); }
        if (event.key === 'Escape') { event.preventDefault(); cancelLanguage(); }
      });
      languageInput.addEventListener('blur', cancelLanguage);
      function button(label, title, action) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
        b.addEventListener('mousedown', event => event.preventDefault()); b.addEventListener('click', action); tools.append(b); return b;
      }
      const run = button('▶', 'Wykonywanie kodu nie jest jeszcze dostępne', () => {}); run.disabled = true;
      function remove() {
        const pos = getPos(); if (typeof pos !== 'number') return;
        editor.view.dispatch(closeHistory(editor.state.tr).delete(pos, pos + node.nodeSize)); editor.commands.focus();
      }
      function move(direction) {
        const pos = getPos(); if (typeof pos !== 'number') return;
        const $pos = editor.state.doc.resolve(pos);
        if ($pos.parent.type.name === 'layoutRow') {
          moveBlock(editor, pos, direction < 0 ? $pos.before() : $pos.after()); return;
        }
        const blocks = []; editor.state.doc.forEach((child, offset) => blocks.push({ child, offset }));
        const index = blocks.findIndex(block => block.offset === pos), target = blocks[index + direction];
        if (!target) return;
        moveBlock(editor, pos, direction < 0 ? target.offset : target.offset + target.child.nodeSize);
      }
      button('↑', 'Przenieś komórkę w górę', () => move(-1));
      button('↓', 'Przenieś komórkę w dół', () => move(1));
      button('×', 'Usuń komórkę', remove);
      dom.append(tools);
      const codeHost = document.createElement('div'); dom.append(codeHost);
      const historyKey = (redo = false) => { redo ? editor.commands.redo() : editor.commands.undo(); return true; };
      const cm = new EditorView({
        parent: codeHost,
        state: EditorState.create({ doc: node.textContent, extensions: [
          lineNumbers(), drawSelection(), languageMode.of(python()), oneDark,
          keymap.of([{ key: 'Mod-z', run: () => historyKey() }, { key: 'Mod-Shift-z', run: () => historyKey(true) }, { key: 'Mod-y', run: () => historyKey(true) }, indentWithTab, ...defaultKeymap]),
          EditorView.updateListener.of(update => {
            if (syncing || (!update.docChanged && !update.selectionSet)) return;
            const pos = getPos(); if (typeof pos !== 'number') return;
            const tr = editor.state.tr;
            let delta = 0;
            update.changes.iterChanges((from, to, _fromNew, _toNew, inserted) => {
              const text = inserted.toString();
              tr.replaceWith(pos + 1 + from + delta, pos + 1 + to + delta, text ? editor.schema.text(text) : []);
              delta += text.length - (to - from);
            });
            const range = update.state.selection.main;
            tr.setSelection(TextSelection.create(tr.doc, pos + 1 + range.anchor, pos + 1 + range.head));
            syncing = true;
            try { editor.view.dispatch(tr); } finally { syncing = false; }
          }),
          EditorView.domEventHandlers({ focus: () => {
            const pos = getPos(); if (typeof pos !== 'number') return;
            const selection = cm.state.selection.main;
            editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos + 1 + selection.anchor, pos + 1 + selection.head)));
          } })
        ] })
      });
      // Exposed only on the node view for integration tests; no separate history or model.
      dom.codeMirror = cm;
      function refreshLanguage() {
        const match = findLanguage(node.attrs.language);
        language.textContent = match?.name || node.attrs.language; dom.dataset.codeCell = node.attrs.language;
        const ticket = ++revision;
        cm.dispatch({ effects: languageMode.reconfigure([]) });
        match?.load().then(support => {
          if (!destroyed && ticket === revision) cm.dispatch({ effects: languageMode.reconfigure(support) });
        }).catch(error => { if (!destroyed) language.title = 'Nie udało się wczytać języka: ' + error.message; });
      }
      refreshLanguage();
      return {
        dom,
        update(nextNode) {
          if (nextNode.type !== node.type) return false;
          const changedLanguage = node.attrs.language !== nextNode.attrs.language;
          node = nextNode;
          if (changedLanguage) refreshLanguage();
          if (!syncing && cm.state.doc.toString() !== node.textContent) {
            syncing = true;
            try { cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: node.textContent } }); }
            finally { syncing = false; }
          }
          return true;
        },
        setSelection(anchor, head) {
          syncing = true;
          try { cm.dispatch({ selection: { anchor: Math.min(anchor, cm.state.doc.length), head: Math.min(head, cm.state.doc.length) } }); cm.focus(); }
          finally { syncing = false; }
        },
        stopEvent: () => true, ignoreMutation: () => true, destroy: () => { destroyed = true; cm.destroy(); }
      };
    };
  }
});
