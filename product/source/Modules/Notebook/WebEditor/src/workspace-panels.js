import { openMath, openTable, editImage } from './media.js';
import { editContainer } from './container-dialog.js';
import { normalizeLayout } from './page-layout.js';
import { closeHistory } from '@tiptap/pm/history';

// Dock existing forms rather than duplicate their validation, save and cancel paths.
export function setupWorkspacePanels(editor, getNoteId) {
  const main = document.querySelector('#editor');
  const viewport = document.createElement('div'); viewport.className = 'document-viewport';
  main.before(viewport); viewport.append(main);
  const makePanel = (side, entries) => {
    const panel = document.createElement('section'); panel.className = `workspace-panel ${side}-panel`;
    panel.setAttribute('aria-label', side === 'right' ? 'Panel prawy' : 'Panel górny');
    const tabs = document.createElement('nav'); tabs.className = 'panel-tabs';
    tabs.setAttribute('aria-label', 'Sekcje panelu');
    const content = document.createElement('div'); content.className = 'panel-content';
    panel.append(tabs, content); document.body.append(panel);
    const buttons = new Map();
    for (const [key, label] of entries) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.dataset.panel = key; button.addEventListener('click', () => show(key)); tabs.append(button); buttons.set(key, button);
    }
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.className = 'panel-close';
    close.setAttribute('aria-label', 'Zamknij panel'); close.addEventListener('click', () => hide(side)); tabs.append(close);
    return { panel, content, buttons, active: null };
  };
  const right = makePanel('right', [['comments', 'Komentarze'], ['numbering', 'Numeracje'], ['container', 'Ustawienia kontenera'], ['snippets', 'Fragmenty robocze'], ['link', 'Link'], ['image', 'Obraz'], ['table', 'Tabela']]);
  const top = makePanel('top', [['ai', 'AI'], ['math', 'Math']]);
  const docked = new Map();
  const placeholders = new Map();
  let lastSide = null;
  const closeDialog = dialog => { if (dialog?.open) dialog.close('cancel'); };
  function activate(key) {
    const host = top.buttons.has(key) ? top : right;
    for (const [other, dialog] of docked) if (other !== key && host.content.contains(dialog)) closeDialog(dialog);
    for (const child of host.content.children) child.hidden = child.dataset.panelKey !== key;
    for (const [name, button] of host.buttons) button.setAttribute('aria-pressed', String(name === key));
    host.active = key; lastSide = host === top ? 'top' : 'right';
    document.body.classList.add(`${lastSide}-panel-open`);
    host.panel.inert = false;
  }
  function attach(id, key) {
    const dialog = document.getElementById(id), host = top.buttons.has(key) ? top : right;
    dialog.dataset.panelKey = key; dialog.classList.add('docked-form'); host.content.append(dialog); docked.set(key, dialog);
    const nativeShow = dialog.show.bind(dialog);
    dialog.showModal = () => { activate(key); dialog.hidden = false; nativeShow(); };
    dialog.addEventListener('close', () => {
      if (dialog.open) return; // A previous close event may arrive after reopening.
      dialog.hidden = true;
      if (host.active === key) { host.active = null; document.body.classList.remove(host === top ? 'top-panel-open' : 'right-panel-open'); host.panel.inert = true; }
    });
    dialog.addEventListener('submit', () => { lastSide = host === top ? 'top' : 'right'; });
  }
  attach('math-dialog', 'math'); attach('link-dialog', 'link'); attach('image-dialog', 'image'); attach('table-dialog', 'table'); attach('container-dialog', 'container');
  for (const [key, title, text] of [
    ['comments', 'Komentarze', 'Komentarze nie są jeszcze zaimplementowane. Tutaj znajdzie się lista komentarzy do notatki.'],
    ['snippets', 'Fragmenty robocze', 'Fragmenty robocze nie są jeszcze zaimplementowane.'],
    ['ai', 'AI', 'Integracja AI nie jest jeszcze skonfigurowana. Ten panel jest miejscem dla jej przyszłych narzędzi.'],
    ['container', 'Ustawienia kontenera', 'Kliknij kontener w dokumencie, aby otworzyć jego właściwości.'],
    ['image', 'Obraz', 'Dwuklik na obrazie otwiera jego właściwości.']]) {
    const section = document.createElement('div'); section.dataset.panelKey = key; section.className = 'panel-empty'; section.hidden = true;
    const heading = document.createElement('h3'); heading.textContent = title;
    const description = document.createElement('p'); description.textContent = text;
    section.append(heading, description); (top.buttons.has(key) ? top : right).content.append(section); placeholders.set(key, section);
  }
  const numbering = document.createElement('form'); numbering.dataset.panelKey = 'numbering'; numbering.hidden = true;
  numbering.innerHTML = '<h3>Stopka i numeracja stron</h3><label class="check"><input name="numbering" type="checkbox">Numeruj strony</label><label>Numer początkowy<input name="start" type="number" min="1" max="1000" required></label><label>Tekst stopki<input name="footer" maxlength="500"></label><label>Odległość od dołu (mm)<input name="footerDistance" type="number" min="0" max="100" step="0.1" required></label><p>Numeracja stron i stopka są widoczne w trybie podziału na strony.</p><p class="panel-error" role="alert"></p><div class="panel-actions"><button type="button" data-cancel>Anuluj</button><button>Zastosuj</button></div>';
  right.content.append(numbering);
  let numberingNote;
  numbering.querySelector('[data-cancel]').addEventListener('click', () => hide('right'));
  numbering.addEventListener('submit', event => {
    event.preventDefault(); if (numberingNote !== getNoteId()) return;
    try {
      const value = normalizeLayout({ ...editor.state.doc.attrs.pageLayout,
        numbering: numbering.elements.numbering.checked, start: numbering.elements.start.value,
        footer: numbering.elements.footer.value, footerDistance: numbering.elements.footerDistance.value });
      editor.view.dispatch(closeHistory(editor.state.tr).setDocAttribute('pageLayout', value));
      hide('right'); editor.view.focus();
    } catch (error) { numbering.querySelector('.panel-error').textContent = error.message; }
  });
  function show(key) {
    if (!getNoteId()) return;
    if (key === 'math') { openMath(); return; }
    if (key === 'table') { openTable(); return; }
    if (key === 'link') { window.notatnik?.receive({ type: 'command', action: 'link' }); return; }
    if (key === 'container') {
      const selection = editor.state.selection;
      const dom = [...editor.view.dom.querySelectorAll('.object-container')].find(element => {
        const pos = element.containerView?.props.getPos();
        return typeof pos === 'number' && pos <= selection.from && pos + element.containerView.node.nodeSize >= selection.to;
      });
      if (dom?.containerView) { editContainer(dom.containerView); return; }
    }
    if (key === 'image' && editor.state.selection.node?.type.name === 'image') {
      editImage(editor.state.selection.node, editor.state.selection.from); return;
    }
    if (!right.buttons.has(key) && !top.buttons.has(key)) return;
    activate(key);
    // Empty property tabs are informative; they never expose an old object's draft.
    const dialog = docked.get(key); if (dialog) { closeDialog(dialog); activate(key); }
    if (placeholders.has(key)) placeholders.get(key).hidden = false;
    if (key === 'numbering') {
      numberingNote = getNoteId(); const value = normalizeLayout(editor.state.doc.attrs.pageLayout || {});
      for (const name of ['numbering', 'start', 'footer', 'footerDistance']) {
        const input = numbering.elements[name]; if (input.type === 'checkbox') input.checked = value[name]; else input.value = value[name];
      }
      numbering.querySelector('.panel-error').textContent = ''; numbering.hidden = false;
    }
  }
  function hide(side) {
    const host = side === 'top' ? top : right;
    host.active = null;
    for (const dialog of docked.values()) if (host.content.contains(dialog)) closeDialog(dialog);
    document.body.classList.remove(`${side}-panel-open`); host.panel.inert = true;
  }
  right.panel.inert = top.panel.inert = true;
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || (!right.active && !top.active)) return;
    if (document.querySelector('.ui-dropdown,dialog:modal')) return;
    hide(lastSide || 'right'); editor.view.focus(); event.preventDefault();
  }, true);
  // A non-modal draft must never commit against a moved or deleted target.
  editor.on('transaction', ({ transaction }) => {
    if (!transaction.docChanged) return;
    for (const dialog of docked.values()) closeDialog(dialog);
  });
  return { show, dismiss() { hide('right'); hide('top'); numberingNote = null; } };
}
