import { ActionButton, TextField, Toggle, Label, Dialog } from './components.js';
import { DropDownMenu } from './dropdown-menu.js';

// All application-owned controls, including static dialog markup, use the
// same component types. The registry never replaces editing-engine content.
export class VisualRegistry {
  static instances = new WeakMap();
  static adopt(root) {
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    const selector = 'button,input,textarea,label,dialog,select';
    const controls = [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];
    for (const dom of controls) {
      if (this.instances.has(dom)) continue;
      const component = dom.tagName === 'SELECT' ? DropDownMenu.forSelect(dom) : dom.tagName === 'DIALOG' ? Dialog.for(dom) :
        dom.tagName === 'BUTTON' ? new ActionButton(dom) : dom.tagName === 'LABEL' ? new Label(dom) :
        ['checkbox', 'radio'].includes(dom.type) ? new Toggle(dom) : new TextField(dom);
      this.instances.set(dom, component);
    }
  }
  static install(root = document) {
    this.adopt(root);
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => this.adopt(node))));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }
}
