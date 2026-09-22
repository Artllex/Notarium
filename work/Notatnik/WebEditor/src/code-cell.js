import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

const findLanguage = value => languages.find(item => item.name.toLowerCase() === value.toLowerCase() || item.alias.includes(value.toLowerCase()));
const languageList = document.createElement('datalist'); languageList.id = 'cell-languages';
const sortedLanguages = [...languages].sort((a, b) => a.name.localeCompare(b.name));
function populateLanguageList(query = '') {
  const value = query.trim().toLocaleLowerCase();
  const ordered = [...sortedLanguages].sort((a, b) => {
    const aStarts = a.name.toLocaleLowerCase().startsWith(value), bStarts = b.name.toLocaleLowerCase().startsWith(value);
    return Number(bStarts) - Number(aStarts) || a.name.localeCompare(b.name);
  });
  languageList.replaceChildren(...ordered.map(item => {
    const option = document.createElement('option'); option.value = item.name; return option;
  }));
}
populateLanguageList();
document.body.append(languageList);

function createCodeSurface(name, { defaultLanguage, showRun, showLineNumbers }) { return Node.create({
  name, group: 'block', content: 'text*', marks: '', code: true, defining: true, isolating: true,
  addAttributes() { return { language: { default: defaultLanguage, parseHTML: element => element.dataset.codeCell || element.querySelector('code')?.className.replace(/^language-/, '') || defaultLanguage } }; },
  parseHTML() { return defaultLanguage ? [{ tag: 'section[data-code-cell]', preserveWhitespace: 'full', contentElement: 'code' }] : [{ tag: 'pre', preserveWhitespace: 'full' }]; },
  renderHTML({ node, HTMLAttributes }) { return defaultLanguage ? ['section', mergeAttributes(HTMLAttributes, { 'data-code-cell': node.attrs.language }), ['pre', ['code', 0]]] : ['pre', mergeAttributes(HTMLAttributes, { 'data-code-block': 'true' }), ['code', { class: node.attrs.language ? `language-${node.attrs.language}` : null }, 0]]; },
  addNodeView() {
    return ({ node: initialNode, editor, getPos }) => {
      let node = initialNode, syncing = false, destroyed = false, revision = 0;
      const languageMode = new Compartment();
      const dom = document.createElement('section'); dom.className = `code-cell ${defaultLanguage ? 'code-cell-executable' : 'code-cell-plain'}`;
      if (defaultLanguage) dom.dataset.codeCell = defaultLanguage; else dom.dataset.codeBlock = 'true';
      const tools = document.createElement('div'); tools.className = 'cell-tools'; tools.contentEditable = 'false';
      const language = document.createElement('span'); language.className = `language${defaultLanguage ? '' : ' language-empty'}`; language.textContent = defaultLanguage ? 'Python' : '...'; tools.append(language);
      language.title = 'Kliknij, aby zmienić język';
      const languageInput = document.createElement('input'); languageInput.className = 'cell-language-input';
      languageInput.setAttribute('list', 'cell-languages'); languageInput.setAttribute('aria-label', 'Język komórki'); languageInput.hidden = true;
      tools.append(languageInput);
      language.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation(); language.hidden = true; languageInput.hidden = false;
        languageInput.value = findLanguage(node.attrs.language || '')?.name || node.attrs.language || '';
        languageInput.focus(); languageInput.select();
      });
      function cancelLanguage() { languageInput.hidden = true; language.hidden = false; languageInput.setCustomValidity(''); }
      function commitLanguage() {
        const match = findLanguage(languageInput.value.trim());
        if (!match && languageInput.value.trim()) { languageInput.setCustomValidity('Wybierz język z listy.'); languageInput.reportValidity(); return; }
        const pos = getPos(); cancelLanguage();
        const value = match?.name.toLowerCase() || null;
        const targetType = value ? editor.schema.nodes.codeCell : editor.schema.nodes.codeBlock;
        if (typeof pos === 'number' && (node.attrs.language !== value || node.type !== targetType)) {
          editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos, targetType, { ...node.attrs, language: value }));
          editor.view.dispatch(closeHistory(editor.state.tr));
        }
      }
      languageInput.addEventListener('input', () => { languageInput.setCustomValidity(''); populateLanguageList(languageInput.value); });
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
      if (showRun) { const run = button('▶', 'Wykonywanie kodu nie jest jeszcze dostępne', () => {}); run.disabled = true; }
      dom.append(tools);
      const codeHost = document.createElement('div'); dom.append(codeHost);
      const historyKey = (redo = false) => { redo ? editor.commands.redo() : editor.commands.undo(); return true; };
      const cm = new EditorView({
        parent: codeHost,
        state: EditorState.create({ doc: node.textContent, extensions: [
          ...(showLineNumbers ? [lineNumbers()] : []), drawSelection(), languageMode.of(defaultLanguage ? python() : []), oneDark,
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
        const match = findLanguage(node.attrs.language || '');
        language.textContent = match?.name || node.attrs.language || (defaultLanguage ? '' : '...');
        if (defaultLanguage) dom.dataset.codeCell = node.attrs.language || ''; else dom.dataset.codeBlock = 'true';
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
}); }

export const CodeCell = createCodeSurface('codeCell', { defaultLanguage: 'python', showRun: true, showLineNumbers: true });
export const CodeBlockSurface = createCodeSurface('codeBlock', { defaultLanguage: null, showRun: false, showLineNumbers: false });
