import katex from 'katex';
import { closeHistory } from '@tiptap/pm/history';
import { startInlineCrop, cancelInlineCrop } from './image-crop.js';

let editor, getNoteId, mathContext, imageContext, imageEditContext;
const dialog = document.querySelector('#math-dialog');
const source = document.querySelector('#math-source');
const layout = document.querySelector('#math-layout');
const preview = document.querySelector('#math-preview');
const error = document.querySelector('#math-error');
const save = document.querySelector('#math-save');
const picker = document.querySelector('#image-file');
const numbered = document.querySelector('#math-numbered');
const imageDialog = document.querySelector('#image-dialog');
const tableDialog = document.querySelector('#table-dialog');
const capture = () => ({ noteId: getNoteId(), selection: { from: editor.state.selection.from, to: editor.state.selection.to } });

export function setupMedia(instance, noteId) {
  editor = instance; getNoteId = noteId;
  setupMediaPointerActions();
  source.addEventListener('input', renderPreview);
  layout.addEventListener('change', () => { numbered.disabled = layout.value !== 'blockMath'; if (numbered.disabled) numbered.checked = false; renderPreview(); });
  dialog.querySelector('form').addEventListener('submit', event => {
    if (event.submitter?.value !== 'save') return;
    event.preventDefault();
    if (!mathContext || mathContext.noteId !== getNoteId() || !renderPreview()) return;
    const latex = source.value.trim();
    editor.view.dispatch(closeHistory(editor.state.tr));
    if (mathContext.pos != null) {
      const node = editor.state.doc.nodeAt(mathContext.pos);
      if (node?.type.name !== mathContext.type) return;
      editor.view.dispatch(editor.state.tr.setNodeMarkup(mathContext.pos, undefined, { ...node.attrs, latex, ...(mathContext.type === 'blockMath' ? { numbered: numbered.checked } : {}) }));
    } else {
      editor.commands.insertContent({ type: layout.value, attrs: { latex, numbered: numbered.checked } });
    }
    dialog.close(); editor.commands.focus();
  });
  picker.addEventListener('change', () => {
    const files = [...picker.files]; picker.value = '';
    if (files.length && imageContext) void insertImages(files, imageContext);
  });
  imageDialog.querySelector('form').addEventListener('submit', event => {
    if (event.submitter?.value !== 'save') return;
    event.preventDefault();
    if (!imageEditContext || imageEditContext.noteId !== getNoteId()) return;
    const node = editor.state.doc.nodeAt(imageEditContext.pos);
    if (node?.type.name !== 'image') return;
    const width = Number(document.querySelector('#image-width').value);
    if (!Number.isInteger(width) || width < 20 || width > 4000) return;
    editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(imageEditContext.pos, undefined, { ...node.attrs, width,
      title: document.querySelector('#image-title').value, caption: document.querySelector('#image-caption').value }));
    imageDialog.close(); editor.commands.focus();
  });
  document.querySelector('#image-crop-toggle').addEventListener('click', () => {
    const context = imageEditContext; imageDialog.close();
    if (context?.noteId === getNoteId()) startInlineCrop(editor, context.pos);
  });
  tableDialog.querySelector('form').addEventListener('submit', event => {
    if (event.submitter?.value !== 'insert') return;
    event.preventDefault();
    const rows = Number(document.querySelector('#table-rows').value), cols = Number(document.querySelector('#table-cols').value);
    if (![rows, cols].every(n => Number.isInteger(n) && n >= 1 && n <= 20)) return;
    editor.view.dispatch(closeHistory(editor.state.tr));
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run(); tableDialog.close();
  });
  tableDialog.querySelectorAll('[data-table-command]').forEach(button => button.addEventListener('click', () => {
    editor.view.dispatch(closeHistory(editor.state.tr));
    editor.chain().focus()[button.dataset.tableCommand]().run(); tableDialog.close();
  }));
  editor.view.dom.addEventListener('paste', event => {
    const files = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault(); event.stopImmediatePropagation();
    void insertImages(files, capture());
  }, true);
  editor.view.dom.addEventListener('dragover', event => {
    if ([...(event.dataTransfer?.items || [])].some(item => item.kind === 'file' && item.type.startsWith('image/'))) event.preventDefault();
  });
  editor.view.dom.addEventListener('drop', event => {
    const files = [...(event.dataTransfer?.files || [])].filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const hit = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (hit) editor.commands.setTextSelection(hit.pos);
    void insertImages(files, capture());
  }, true);
}

export function openMath(node = null, pos = null) {
  if (!editor?.isEditable || !getNoteId()) return;
  mathContext = { ...capture(), pos, type: node?.type.name };
  source.value = node?.attrs.latex || '';
  layout.value = node?.type.name || 'inlineMath'; layout.disabled = Boolean(node);
  numbered.checked = Boolean(node?.attrs.numbered); numbered.disabled = layout.value !== 'blockMath';
  save.textContent = node ? 'Zapisz' : 'Wstaw';
  renderPreview(); dialog.showModal(); source.focus();
}

function renderPreview() {
  try {
    if (!source.value.trim()) { preview.textContent = ''; error.textContent = ''; save.disabled = true; return false; }
    katex.render(source.value.trim(), preview, { displayMode: layout.value === 'blockMath', throwOnError: true, trust: false, maxExpand: 1000 });
    error.textContent = ''; save.disabled = false; return true;
  } catch (exception) {
    preview.textContent = ''; error.textContent = 'Niepoprawny wzór: ' + exception.message;
    save.disabled = true; return false;
  }
}

export function openImage() {
  if (!editor?.isEditable || !getNoteId()) return;
  imageContext = capture(); picker.click();
}

export function editImage(node, pos) {
  if (!editor.isEditable || typeof pos !== 'number') return;
  imageEditContext = { noteId: getNoteId(), pos };
  document.querySelector('#image-width').value = node.attrs.width || 200;
  document.querySelector('#image-title').value = node.attrs.title || '';
  document.querySelector('#image-caption').value = node.attrs.caption || '';
  imageDialog.showModal();
}

export function openTable() {
  if (!editor.isEditable || !getNoteId()) return;
  tableDialog.querySelectorAll('[data-table-command]').forEach(button => { button.disabled = !editor.can()[button.dataset.tableCommand](); });
  tableDialog.showModal();
}

export function dismissMedia() {
  cancelInlineCrop();
  document.querySelector('.media-context-menu')?.remove();
  if (dialog.open) dialog.close();
  if (imageDialog.open) imageDialog.close();
  if (tableDialog.open) tableDialog.close();
  mathContext = null; imageContext = null; imageEditContext = null;
}

function setupMediaPointerActions() {
  const root = editor.view.dom;
  const findMedia = target => {
    let result;
    editor.state.doc.descendants((node, pos) => {
      if (result || !['image', 'inlineMath', 'blockMath'].includes(node.type.name)) return !result;
      const dom = editor.view.nodeDOM(pos);
      if (dom && (dom === target || dom.contains(target))) result = { node, pos };
    });
    return result;
  };
  root.addEventListener('dblclick', event => {
    if (event.target.closest('input,button,.container-title,.container-caption,.image-title,figcaption,.container-resize,.container-resize-edge')) return;
    const hit = findMedia(event.target);
    if (!hit) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (hit.node.type.name === 'image') editImage(hit.node, hit.pos);
    else openMath(hit.node, hit.pos);
  }, true);
  root.addEventListener('contextmenu', event => {
    const hit = findMedia(event.target);
    if (hit?.node.type.name !== 'image') return;
    event.preventDefault(); event.stopImmediatePropagation();
    document.querySelector('.media-context-menu')?.remove();
    const menu = document.createElement('div'); menu.className = 'media-context-menu'; menu.setAttribute('role', 'menu');
    const origin = getNoteId();
    for (const [label, crop] of [['Ustawienia obrazu…', false], ['Przytnij obraz…', true]]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.setAttribute('role', 'menuitem');
      button.addEventListener('click', () => {
        menu.remove();
        if (getNoteId() !== origin || !editor.state.doc.nodeAt(hit.pos)?.eq(hit.node)) return;
        if (crop) startInlineCrop(editor, hit.pos);
        else editImage(hit.node, hit.pos);
      });
      menu.append(button);
    }
    document.body.append(menu);
    menu.style.left = Math.max(0, Math.min(event.clientX, innerWidth - menu.offsetWidth - 6)) + 'px';
    menu.style.top = Math.max(0, Math.min(event.clientY, innerHeight - menu.offsetHeight - 6)) + 'px';
    menu.firstElementChild.focus();
  }, true);
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.media-context-menu')) document.querySelector('.media-context-menu')?.remove();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.querySelector('.media-context-menu')?.remove();
  });
}

async function insertImages(files, context) {
  try {
    const images = [];
    for (const file of files) {
      if (!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type)) throw new Error('Wybierz obraz PNG, JPG, WebP, GIF lub BMP.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Maksymalny rozmiar obrazu to 20 MB.');
      const src = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
      });
      const bitmap = new Image(); bitmap.src = src; await bitmap.decode();
      images.push({ type: 'image', attrs: { src, alt: file.name || 'Obraz', width: Math.min(200, bitmap.naturalWidth) } });
    }
    // A file dialog/decode can finish after the user switched notes.
    if (context.noteId !== getNoteId() || !editor.isEditable) return;
    editor.view.dispatch(closeHistory(editor.state.tr));
    editor.chain().focus().setTextSelection(context.selection).insertContent([...images, { type: 'paragraph' }]).run();
  } catch (exception) {
    window.chrome?.webview?.postMessage({ type: 'error', message: exception.message || 'Nie udało się wczytać obrazu.', noteId: context.noteId });
  }
}
