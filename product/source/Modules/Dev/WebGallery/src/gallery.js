import { ActionButton, ToolPanel, TextField, Toggle, Label, Handle, Dialog, VisualElement } from '../../../../Shared/Web/UI/components.js';
import { DropDownMenu } from '../../../../Shared/Web/UI/dropdown-menu.js';
import { VisualRegistry } from '../../../../Shared/Web/UI/registry.js';

const host = document.querySelector('#samples'), result = document.querySelector('#result');
const report = text => result.textContent = text;
function section(title, ...children) { const panel = ToolPanel.create('sample'); const heading = document.createElement('h2'); heading.textContent = title; panel.append(heading, ...children); host.append(panel); return panel; }
function button(label, action) { const dom = ActionButton.create(); dom.textContent = label; dom.onclick = action; return dom; }
const disabled = button('Przycisk wyłączony', () => report('Nie powinno się pojawić')); disabled.disabled = true;
section('ActionButton / ToolPanel', button('Przycisk', () => report('ActionButton: kliknięcie działa.')), disabled);
const dropdownButton = button('Otwórz dropdown', () => dropdown.open([
  { label: 'Zwykła akcja', action: () => report('Dropdown: zwykła akcja.') },
  { label: 'Zaznaczona opcja', checked: true, action: () => report('Dropdown: zaznaczona opcja.') },
  { label: 'Opcja wyłączona', disabled: true, action: () => {} }
]));
const dropdown = new DropDownMenu({ anchor: dropdownButton }); section('DropDownMenu — akcje, zaznaczenie i wyłączenie', dropdownButton);
const choice = document.createElement('select'); choice.setAttribute('aria-label', 'Przykładowy wybór');
for (const text of ['Text', 'Code Cell', 'Math']) { const option = document.createElement('option'); option.textContent = text; choice.append(option); }
choice.onchange = () => report('Wybór: ' + choice.value); section('DropDownMenu — lista wyboru', choice);
const language = document.createElement('input'); language.setAttribute('aria-label', 'Sugestie języka'); language.placeholder = 'Wpisz język, np. Python';
DropDownMenu.forSuggestions(language, ['Python', 'JavaScript', 'SQL']);
language.onchange = () => report('Sugestia: ' + language.value);
section('DropDownMenu — sugestie', language);
const context = document.createElement('p'); context.textContent = 'Kliknij tutaj PPM.';
context.oncontextmenu = event => { event.preventDefault(); new DropDownMenu().open([{ label: 'Akcja kontekstowa', action: () => report('Menu kontekstowe: działa.') }], { x: event.clientX, y: event.clientY }); };
section('DropDownMenu — menu kontekstowe', context);
const field = document.createElement('input'); field.setAttribute('aria-label', 'Pole tekstowe'); field.placeholder = 'TextField'; new TextField(field);
const multiline = document.createElement('textarea'); multiline.setAttribute('aria-label', 'Pole wielowierszowe'); multiline.placeholder = 'Tekst wielowierszowy';
const toggle = document.createElement('input'); toggle.type = 'checkbox'; new Toggle(toggle);
const label = document.createElement('label'); label.append(toggle, 'Toggle on/off'); new Label(label); toggle.onchange = () => report('Toggle: ' + toggle.checked);
section('TextField / Toggle / Label', field, label, multiline);
const dialog = Dialog.create(); const dialogTitle = document.createElement('h2'); dialogTitle.textContent = 'Wspólny Dialog';
const dialogSelect = choice.cloneNode(true); dialogSelect.removeAttribute('hidden'); dialogSelect.onchange = () => report('Wybór w dialogu: ' + dialogSelect.value);
dialog.append(dialogTitle, dialogSelect, button('Zamknij dialog', () => Dialog.for(dialog).close())); document.body.append(dialog);
section('Dialog — również dropdown w oknie modalnym', button('Otwórz dialog', () => Dialog.for(dialog).open()));
const size = ToolPanel.create('demo-size'), handle = Handle.create('demo-handle'); handle.setAttribute('role', 'separator'); handle.setAttribute('aria-label', 'Uchwyt szerokości');
handle.onpointerdown = event => { const x = event.clientX, width = size.offsetWidth; handle.setPointerCapture(event.pointerId); handle.onpointermove = move => { size.style.width = Math.max(60, Math.min(500, width + move.clientX - x)) + 'px'; report('Handle: ' + size.style.width); }; handle.onpointerup = () => { handle.onpointermove = null; handle.releasePointerCapture(event.pointerId); }; handle.onpointercancel = () => handle.onpointermove = null; };
section('Handle — uchwyt przeciągania', size, handle);
section('VisualElement / VisualRegistry', button('Dodaj dynamiczny element', () => { const node = VisualElement.create('input'); node.placeholder = 'Dynamiczny TextField'; node.setAttribute('aria-label', 'Dynamiczny TextField'); host.lastElementChild.append(node); report('VisualRegistry obejmuje nową kontrolkę.'); }));
VisualRegistry.install();
window.devGalleryReady = true; window.chrome?.webview?.postMessage('ready');
