export class ContainerType {
  constructor(label = 'Text') { this.label = label; this.isCode = false; this.isImage = false; this.isEmpty = false; this.selectionOffset = 1; }
  minimumWidth() { return 80; }
  minimumHeight() { return 32; }
  normalizeAttrs(attrs) { return attrs; }
  initialAttrs() { return null; }
  initialContent() { return null; }
  copyAttrs(attrs) { return attrs; }
}
export class TextContainer extends ContainerType {
  initialAttrs() { return { boxTextExplicit: true }; }
}
export class EmptyTextContainer extends TextContainer {
  constructor() { super('Empty'); this.isEmpty = true; }
  initialAttrs() { return { boxEmpty: true }; }
  minimumWidth() { return 0; }
}
export class HeadingContainer extends ContainerType { }
export class QuoteContainer extends ContainerType { }
export class BulletListContainer extends ContainerType { }
export class OrderedListContainer extends ContainerType { }
export class TaskListContainer extends ContainerType { }
export class CodeBlockContainer extends ContainerType {
  constructor() { super('Code'); this.isCode = true; this.gutterWidth = 32; }
  minimumWidth(view) {
    if (view.node.attrs.codeAllowNarrow) return 164;
    const content = view.inner.dom.querySelector('.cm-content');
    const context = document.createElement('canvas').getContext('2d');
    if (!context || !content) return 164;
    context.font = getComputedStyle(content).font;
    const widest = Math.max(0, ...view.node.textContent.split('\n').map(line => context.measureText(line).width));
    return Math.ceil(Math.max(164, widest + this.gutterWidth));
  }
  minimumHeight(view) {
    if (view.node.attrs.codeAllowNarrow) return 32;
    const content = view.inner.dom.querySelector('.cm-content');
    const tools = view.inner.dom.querySelector('.cell-tools');
    if (!content) return 32;
    const style = getComputedStyle(content);
    const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.4 || 20;
    const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
    return Math.ceil((tools?.getBoundingClientRect().height || 30) + Math.max(1, view.node.textContent.split('\n').length) * lineHeight + padding + 2);
  }
  normalizeAttrs(attrs, view) {
    return { ...attrs,
      ...(attrs.boxWidth != null ? { boxWidth: Math.max(this.minimumWidth(view), attrs.boxWidth) } : {}),
      ...(attrs.boxHeight != null ? { boxHeight: Math.max(this.minimumHeight(view), attrs.boxHeight) } : {}) };
  }
}
export class CodeCellContainer extends CodeBlockContainer {
  constructor() { super(); this.gutterWidth = 70; }
  initialAttrs() { return { language: 'python' }; }
}
export class ImageContainer extends ContainerType {
  constructor() { super('Picture'); this.isImage = true; }
  normalizeAttrs(attrs) { return attrs.boxWidth == null ? attrs : { ...attrs, width: attrs.boxWidth }; }
  copyAttrs(attrs) { return { ...attrs, placement: 'block-left' }; }
}
export class MathContainer extends ContainerType { constructor() { super('Math'); } }
export class TableContainer extends ContainerType { constructor() { super('Table'); } }
export class GroupContainer extends ContainerType {
  constructor() { super(); this.selectionOffset = 2; }
  initialContent(schema) { return schema.nodes.paragraph.create(); }
}

export const containerTypes = Object.freeze({
  paragraph: new TextContainer(), heading: new HeadingContainer(), blockquote: new QuoteContainer(),
  bulletList: new BulletListContainer(), orderedList: new OrderedListContainer(), taskList: new TaskListContainer(),
  codeBlock: new CodeBlockContainer(), codeCell: new CodeCellContainer(), image: new ImageContainer(),
  blockMath: new MathContainer(), table: new TableContainer(), blockGroup: new GroupContainer()
});
const empty = new EmptyTextContainer();
export const getContainerType = node => node.type.name === 'paragraph' && node.attrs.boxEmpty && !node.textContent ? empty : containerTypes[node.type.name];
