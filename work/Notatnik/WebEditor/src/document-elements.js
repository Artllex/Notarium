import { BlockMath } from '@tiptap/extension-mathematics';
import Image from '@tiptap/extension-image';
import { closeHistory } from '@tiptap/pm/history';
import { readCrop, cropStyles } from './image-crop.js';
import { RichLabelView, richAttribute } from './rich-label.js';

// A derived CSS counter avoids renumbering transactions polluting undo history.
export const NumberedMath = BlockMath.extend({
  draggable: false,
  addAttributes() {
    return { ...this.parent?.(), numbered: { default: false,
      parseHTML: el => el.dataset.numbered === 'true',
      renderHTML: attrs => ({ 'data-numbered': String(attrs.numbered) }) } };
  },
  addNodeView() {
    const parent = this.parent();
    return props => {
      const view = parent(props);
      view.dom.dataset.numbered = String(props.node.attrs.numbered);
      view.dom.draggable = false;
      view.dom.title = 'Przeciągnij, aby przenieść wzór';
      return view;
    };
  }
});

export const CaptionImage = Image.extend({
  draggable: false,
  parseHTML() {
    return [{ tag: 'figure[data-note-image]', getAttrs: element => {
      const img = element.querySelector('img'); if (!img) return false;
      return { src: img.getAttribute('src'), alt: img.getAttribute('alt'), title: element.querySelector('.image-title')?.textContent || img.getAttribute('title') || '',
        width: Number(img.getAttribute('width')) || 200, caption: element.querySelector('figcaption')?.textContent || '', placement: element.dataset.placement || 'block-left' };
    } }, ...this.parent()];
  },
  addAttributes() {
    const attributes = this.parent();
    for (const name of ['src', 'alt', 'title', 'width', 'height']) attributes[name] = { ...attributes[name],
      parseHTML: el => (el.matches('figure') ? el.querySelector('img') : el)?.getAttribute(name) ?? null };
    return { ...attributes, titleRich: richAttribute('titleRich'), captionRich: richAttribute('captionRich'), crop: { default: null, rendered: false,
      parseHTML: el => readCrop(el.closest('figure')?.dataset.crop) }, caption: { default: '',
      parseHTML: el => el.closest('figure')?.querySelector('figcaption')?.textContent || '',
      rendered: false }, placement: { default: 'block-left',
      parseHTML: el => el.closest('figure')?.dataset.placement || 'block-left', rendered: false } };
  },
  renderHTML({ node, HTMLAttributes }) {
    const styles = cropStyles(node.attrs.crop);
    return ['figure', { ...Object.fromEntries(Object.entries(HTMLAttributes).filter(([key]) => key.startsWith('data-'))), 'data-note-image': 'true', 'data-placement': node.attrs.placement,
      ...(node.attrs.crop ? { 'data-crop': JSON.stringify(node.attrs.crop) } : {}) },
      ['div', { class: 'image-title' }, node.attrs.title || ''],
      ['div', { class: 'image-viewport', style: styles.viewport }, ['img', { ...HTMLAttributes, style: styles.image }]], ['figcaption', {}, node.attrs.caption || '']];
  },
  addNodeView() {
    return ({ node, getPos }) => {
      const dom = document.createElement('figure'); dom.dataset.noteImage = 'true';
      const title = document.createElement('div'); title.className = 'image-title';
      const img = document.createElement('img'); const caption = document.createElement('figcaption');
      const viewport = document.createElement('div'); viewport.className = 'image-viewport'; viewport.append(img);
      const tools = document.createElement('div'); tools.className = 'image-tools'; tools.contentEditable = 'false';
      const drag = document.createElement('span'); drag.className = 'image-drag'; drag.textContent = '⠿'; drag.title = 'Przeciągnij obraz';
      const settings = document.createElement('button'); settings.type = 'button'; settings.textContent = '⚙'; settings.title = 'Rozmiar, podpis i otaczanie tekstem';
      const resize = document.createElement('span'); resize.className = 'image-resize'; resize.title = 'Przeciągnij, aby zmienić rozmiar';
      tools.append(drag, settings); dom.append(tools, title, viewport, caption, resize); dom.draggable = false;
      const labels = [new RichLabelView(title, this.editor, getPos, 'title', 'Tytuł obrazu'),
        new RichLabelView(caption, this.editor, getPos, 'caption', 'Stopka obrazu')];
      const paint = value => {
        node = value; dom.dataset.placement = node.attrs.placement || 'block-left';
        img.src = node.attrs.src; img.alt = node.attrs.alt || ''; img.title = node.attrs.title || '';
        const styles = cropStyles(node.attrs.crop);
        viewport.style.cssText = styles.viewport; img.style.cssText = styles.image;
        const width = Number(node.attrs.width) || 200;
        img.width = width; dom.style.width = `${width}px`; labels.forEach(label => label.update(node));
      };
      paint(node);
      const edit = event => { event.preventDefault(); this.options.onEdit?.(node, getPos()); };
      img.addEventListener('dblclick', edit);
      settings.addEventListener('click', edit);
      resize.addEventListener('pointerdown', event => {
        event.preventDefault(); event.stopPropagation(); dom.draggable = false;
        const startX = event.clientX, startWidth = img.getBoundingClientRect().width;
        const move = moveEvent => { dom.style.width = img.style.width = `${Math.max(20, Math.min(4000, startWidth + moveEvent.clientX - startX))}px`; };
        const up = upEvent => {
          document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); dom.draggable = false;
          img.style.width = ''; const width = Math.round(Math.max(20, Math.min(4000, startWidth + upEvent.clientX - startX)));
          const pos = getPos();
          if (typeof pos === 'number') {
            const current = this.editor.state.doc.nodeAt(pos);
            if (current?.type.name === 'image') {
              this.editor.view.dispatch(closeHistory(this.editor.state.tr));
              this.editor.view.dispatch(this.editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, width }));
            }
          }
        };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
      });
      return { dom, update: updated => { if (updated.type !== node.type) return false; paint(updated); return true; },
        ignoreMutation: () => true,
        stopEvent: event => event.target === settings || event.target === resize || event.target.closest?.('.rich-label') || (event.target === drag && event.type !== 'dragstart'),
        destroy: () => { labels.forEach(label => label.destroy()); img.removeEventListener('dblclick', edit); } };
    };
  }
});
