export class VisualElement {
  constructor(dom) { this.dom = dom; }
  static create(tag, className = '') { const dom = document.createElement(tag); dom.className = className; return dom; }
}
export class ActionButton extends VisualElement {
  static create() { const dom = super.create('button'); dom.type = 'button'; return dom; }
}
export class ToolPanel extends VisualElement {
  static create(className = '') { return super.create('div', className); }
}
export class TextField extends VisualElement { }
export class Toggle extends VisualElement { }
export class Label extends VisualElement { }
export class Handle extends VisualElement {
  static create(className) { const dom = super.create('span', className); dom.contentEditable = 'false'; return dom; }
}
export class Dialog extends VisualElement {
  static instances = new WeakMap();
  static for(dom) {
    if (!this.instances.has(dom)) this.instances.set(dom, new Dialog(dom));
    return this.instances.get(dom);
  }
  static create() { const dom = super.create('dialog'); this.for(dom); return dom; }
  open() { this.dom.dispatchEvent(new Event('ui-dialog-opening')); if (!this.dom.open) this.dom.showModal(); }
  close(value) { if (this.dom.open) this.dom.close(value); }
}
