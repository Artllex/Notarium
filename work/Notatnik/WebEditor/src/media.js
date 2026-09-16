import katex from 'katex';
import { closeHistory } from '@tiptap/pm/history';

let editor, getNoteId, mathContext, imageContext;
const dialog = document.querySelector('#math-dialog');
const source = document.querySelector('#math-source');
const layout = document.querySelector('#math-layout');
const preview = document.querySelector('#math-preview');
const error = document.querySelector('#math-error');
const save = document.querySelector('#math-save');
const picker = document.querySelector('#image-file');
const capture = () => ({ noteId: getNoteId(), selection: { from: editor.state.selection.from, to: editor.state.selection.to } });

export function setupMedia(instance, noteId) {
  editor = instance; getNoteId = noteId;
  source.addEventListener('input', renderPreview);
  layout.addEventListener('change', renderPreview);
  dialog.querySelector('form').addEventListener('submit', event => {
    if (event.submitter?.value !== 'save') return;
    event.preventDefault();
    if (!mathContext || mathContext.noteId !== getNoteId() || !renderPreview()) return;
    const latex = source.value.trim();
    editor.view.dispatch(closeHistory(editor.state.tr));
    if (mathContext.pos != null) {
      const node = editor.state.doc.nodeAt(mathContext.pos);
      if (node?.type.name !== mathContext.type) return;
      editor.commands[mathContext.type === 'inlineMath' ? 'updateInlineMath' : 'updateBlockMath']({ pos: mathContext.pos, latex });
    } else {
      editor.commands[layout.value === 'inlineMath' ? 'insertInlineMath' : 'insertBlockMath']({ latex });
    }
    dialog.close(); editor.commands.focus();
  });
  picker.addEventListener('change', () => {
    const files = [...picker.files]; picker.value = '';
    if (files.length && imageContext) void insertImages(files, imageContext);
  });
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

export function dismissMedia() {
  if (dialog.open) dialog.close();
  mathContext = null; imageContext = null;
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
