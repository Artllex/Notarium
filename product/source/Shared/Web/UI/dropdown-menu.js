import { ActionButton, VisualElement } from './components.js';
import policy from '../../UI/ui-policy.json';
import { applyTheme } from './theme.js';

// One popup implementation for choice lists, context menus and autocomplete.
// Caller supplies actions; this component owns focus, anchoring and dismissal.
export class DropDownMenu extends VisualElement {
  static active = null;
  static nextId = 0;
  static selects = new WeakMap();
  constructor({ anchor = null, className = '', restoreFocus = true } = {}) {
    super(VisualElement.create('div', `ui-dropdown ${className}`));
    this.anchor = anchor; this.restoreFocus = restoreFocus;
    this.dom.setAttribute('role', 'menu');
    this.dom.id = 'ui-dropdown-' + ++DropDownMenu.nextId;
    applyTheme(this.dom);
    for (const [name, value] of Object.entries({ '--ui-menu-background': policy.menuBackground, '--ui-menu-border': policy.menuBorder, '--ui-menu-hover': policy.menuHover, '--ui-menu-selected': policy.menuSelected, '--ui-menu-text': policy.menuText, '--ui-menu-min-height': policy.itemMinHeight + 'px', '--ui-menu-max-height': policy.menuMaxHeight + 'px' })) this.dom.style.setProperty(name, value);
  }
  open(items, point = null, focus = true) {
    DropDownMenu.active?.close(false);
    this.previousFocus = document.activeElement;
    this.events = new AbortController();
    this.dom.replaceChildren();
    for (const item of items) {
      const button = ActionButton.create(); button.textContent = item.label;
      button.disabled = Boolean(item.disabled); button.setAttribute('role', this.suggestions ? 'option' : 'menuitem');
      if (item.checked) { button.classList.add('checked'); button.setAttribute('aria-current', 'true'); }
      button.addEventListener('pointerdown', event => event.preventDefault());
      button.addEventListener('click', () => { this.close(false); item.action(); });
      this.dom.append(button);
    }
    (this.anchor?.closest('dialog[open]') || document.body).append(this.dom);
    const rect = this.anchor?.getBoundingClientRect();
    if (rect) this.dom.style.minWidth = rect.width + 'px';
    const x = point?.x ?? rect?.left ?? 0, y = point?.y ?? rect?.bottom ?? 0;
    this.dom.style.left = Math.max(0, Math.min(x, innerWidth - this.dom.offsetWidth - 6)) + 'px';
    this.dom.style.top = Math.max(0, Math.min(y, innerHeight - this.dom.offsetHeight - 6)) + 'px';
    DropDownMenu.active = this;
    this.anchor?.setAttribute('aria-expanded', 'true');
    const signal = this.events.signal;
    this.anchor?.closest('dialog')?.addEventListener('close', () => this.close(false), { signal });
    document.addEventListener('pointerdown', event => { if (!this.dom.contains(event.target) && !this.anchor?.contains(event.target)) this.close(false); }, { capture: true, signal });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') { if (!this.suggestions) { event.preventDefault(); event.stopImmediatePropagation(); } this.close(); }
      else if (this.dom.contains(document.activeElement) && ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Tab'].includes(event.key)) {
        const buttons = [...this.dom.querySelectorAll('button:not(:disabled)')];
        if (event.key === 'Tab') { this.close(false); return; }
        event.preventDefault(); event.stopImmediatePropagation();
        const index = buttons.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    }, { capture: true, signal });
    if (focus) this.dom.querySelector('button:not(:disabled)')?.focus();
  }
  close(restore = this.restoreFocus) {
    this.events?.abort(); this.dom.remove();
    if (DropDownMenu.active === this) DropDownMenu.active = null;
    this.anchor?.setAttribute('aria-expanded', 'false');
    if (restore) (this.anchor || this.previousFocus)?.focus();
  }
  static forSelect(select) {
    if (this.selects.has(select)) return this.selects.get(select);
    const trigger = ActionButton.create(); trigger.className = 'ui-choice';
    const menu = new DropDownMenu({ anchor: trigger });
    this.selects.set(select, menu);
    const refresh = () => { trigger.textContent = select.selectedOptions[0]?.textContent || ''; trigger.disabled = select.disabled; };
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || select.id || 'Wybierz');
    select.hidden = true; select.after(trigger); refresh();
    select.addEventListener('change', refresh);
    select.closest('dialog')?.addEventListener('ui-dialog-opening', refresh);
    trigger.addEventListener('click', () => {
      if (DropDownMenu.active === menu) { menu.close(); return; }
      menu.open([...select.options].map(option => ({ label: option.textContent, disabled: option.disabled, checked: option.selected,
        action: () => { select.value = option.value; refresh(); select.dispatchEvent(new Event('change', { bubbles: true })); trigger.focus(); } })));
    });
    return menu;
  }
  static forSuggestions(input, choices) {
    input.removeAttribute('list');
    const menu = new DropDownMenu({ anchor: input, restoreFocus: false });
    menu.suggestions = true;
    menu.dom.setAttribute('role', 'listbox');
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', menu.dom.id); input.setAttribute('aria-expanded', 'false');
    let index = -1;
    const show = () => {
      if (input.hidden || !input.isConnected) return;
      const query = input.value.toLocaleLowerCase();
      const values = choices.filter(value => value.toLocaleLowerCase().includes(query));
      index = -1;
      menu.open(values.map(value => ({ label: value, action: () => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); menu.close(false); input.dispatchEvent(new Event('change', { bubbles: true })); } })), null, false);
    };
    input.addEventListener('focus', show); input.addEventListener('input', show);
    input.addEventListener('blur', () => menu.close(false));
    input.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key) && DropDownMenu.active === menu) {
        const buttons = [...menu.dom.querySelectorAll('button')];
        if (!buttons.length) return;
        event.preventDefault(); event.stopImmediatePropagation();
        index = (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
        buttons.forEach((button, item) => button.classList.toggle('checked', item === index));
        buttons[index].scrollIntoView({ block: 'nearest' });
      }
      if (event.key === 'Enter') {
        if (index >= 0 && DropDownMenu.active === menu) { event.preventDefault(); event.stopImmediatePropagation(); menu.dom.querySelectorAll('button')[index]?.click(); }
        menu.close(false);
      }
    }, true);
    return menu;
  }
}
