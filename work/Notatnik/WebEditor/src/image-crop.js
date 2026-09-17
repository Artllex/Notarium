import Cropper from 'cropperjs';
import { closeHistory } from '@tiptap/pm/history';

export function readCrop(value) {
  try {
    const c = typeof value === 'string' ? JSON.parse(value) : value;
    return c && ['x','y','width','height','originalWidth','originalHeight'].every(k => Number.isFinite(c[k])) &&
      c.x >= 0 && c.y >= 0 && c.width > 0 && c.height > 0 && c.originalWidth > 0 && c.originalHeight > 0 ? c : null;
  } catch { return null; }
}
export function cropStyles(value) {
  const c = readCrop(value);
  return c ? {
    viewport: 'aspect-ratio:' + c.width + '/' + c.height + ';position:relative;overflow:hidden',
    image: 'position:absolute;left:0;top:0;max-width:none;max-height:none;width:' + (100 * c.originalWidth / c.width) + '%;height:auto;transform:translate(' +
      (-100 * c.x / c.originalWidth) + '%,' + (-100 * c.y / c.originalHeight) + '%)'
  } : { viewport: '', image: '' };
}
let active;
export function cancelInlineCrop() { active?.cancel(); }
export function startInlineCrop(editor, pos) {
  cancelInlineCrop();
  const session = new ImageCropSession(editor, pos);
  if (session.cancel) active = session;
}
export class ImageCropSession {
 constructor(editor, pos) {
  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== 'image') return;
  const root = editor.view.nodeDOM(pos), figure = root.matches('figure') ? root : root.querySelector('figure');
  if (!figure) return;
  const originalDoc = editor.state.doc;
  const viewport = figure.querySelector('.image-viewport') || figure.querySelector('img');
  const host = document.createElement('div'); host.className = 'inline-crop'; host.contentEditable = 'false';
  const bitmap = figure.querySelector('img'), bounds = viewport.getBoundingClientRect();
  if (bitmap.naturalWidth && bitmap.naturalHeight) host.style.height = Math.max(60, bounds.width * bitmap.naturalHeight / bitmap.naturalWidth) + 'px';
  const source = document.createElement('img'); source.src = node.attrs.src; host.append(source);
  const tools = document.createElement('div'); tools.className = 'inline-crop-tools'; tools.contentEditable = 'false';
  viewport.hidden = true; figure.append(host, tools); figure.draggable = false;
  let cropper, closed = false;
  function cleanup() {
    if (closed) return; closed = true; cropper?.destroy();
    host.remove(); tools.remove(); viewport.hidden = false; figure.draggable = true;
    editor.off('transaction', onTransaction); document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onOutside, true);
    if (active === session) active = null;
  }
  function commit(crop) {
    if (editor.state.doc !== originalDoc) { cleanup(); return; }
    cleanup();
    editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, { ...node.attrs, crop }));
    editor.view.dispatch(closeHistory(editor.state.tr));
  }
  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cleanup(); }
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); event.stopImmediatePropagation(); applyCrop(); }
  }
  function onOutside(event) {
    if (!host.contains(event.target) && !tools.contains(event.target)) applyCrop();
  }
  function onTransaction() { if (editor.state.doc !== originalDoc) cleanup(); }
  function button(label, action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', action); tools.append(b); }
  function applyCrop() {
    if (closed) return;
    if (!cropper?.ready) return;
    if (!ratioInput.checkValidity()) { ratioInput.reportValidity(); return; }
    const d = cropper.getData(true), image = cropper.getImageData();
    commit({ x: d.x, y: d.y, width: d.width, height: d.height, originalWidth: image.naturalWidth, originalHeight: image.naturalHeight });
  }
  button('Zastosuj kadr', applyCrop);
  button('Cały obraz', () => commit(null));
  button('Anuluj', cleanup);
  const ratioLabel = document.createElement('label'); ratioLabel.textContent = 'Proporcje X:Y ';
  const ratioInput = document.createElement('input'); ratioInput.placeholder = 'np. 16:9'; ratioInput.setAttribute('aria-label', 'Proporcje X:Y');
  ratioLabel.append(ratioInput); tools.append(ratioLabel);
  ratioInput.addEventListener('input', () => {
    const match = ratioInput.value.trim().match(/^(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)$/);
    const x = Number(match?.[1].replace(',', '.')), y = Number(match?.[2].replace(',', '.'));
    const valid = !ratioInput.value.trim() || x > 0 && y > 0;
    ratioInput.setCustomValidity(valid ? '' : 'Wpisz dodatnie proporcje X:Y, np. 16:9, lub pozostaw puste.');
    if (valid) cropper?.setAspectRatio(match ? x / y : NaN);
  });
  cropper = new Cropper(source, { viewMode: 1, background: false, autoCropArea: 1, zoomable: false,
    ready() { const crop = readCrop(node.attrs.crop); if (crop) cropper.setData(crop); }
  });
  const session = this;
  this.cancel = cleanup;
  editor.on('transaction', onTransaction); document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onOutside, true);
 }
}
