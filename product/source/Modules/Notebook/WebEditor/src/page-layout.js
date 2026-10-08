import { Dialog } from '../../../../Shared/Web/UI/components.js';
import { closeHistory } from '@tiptap/pm/history';

const mm = value => value * 96 / 25.4;
export const paragraphFields = ['indentLeft', 'indentRight', 'before', 'after'];
export function paragraphFormatTransaction(editor, values, selection = editor.state.selection, tr = editor.state.tr) {
  const { from, to, empty } = selection;
  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!['paragraph', 'heading'].includes(node.type.name)) return;
    if (!empty && (pos + node.nodeSize <= from || pos >= to)) return;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...Object.fromEntries(paragraphFields.map(key => [key, values[key]])) });
  });
  return tr;
}
export const layoutDefaults = { paged: false, width: 0, size: 'A4', landscape: false, color: '#202020',
  top: 20, bottom: 20, left: 20, right: 20, indentLeft: 0, indentRight: 0,
  before: 0, after: 8, footer: '', footerDistance: 10, numbering: false, start: 1, hyphenation: false };
const sizes = { A3: [297, 420], A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
export function normalizeLayout(input = {}) {
  const value = Object.fromEntries(Object.entries(layoutDefaults).map(([key, fallback]) => [key, input[key] ?? fallback]));
  if (!sizes[value.size]) throw new Error('Nieobsługiwany rozmiar strony.');
  for (const key of ['top', 'bottom', 'left', 'right', 'indentLeft', 'indentRight', 'footerDistance']) {
    value[key] = Number(value[key]);
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 100) throw new Error('Wymiary muszą mieścić się w zakresie 0–100 mm.');
  }
  for (const key of ['width', 'before', 'after', 'start']) {
    value[key] = Number(value[key]);
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > (key === 'width' ? 4000 : 1000)) throw new Error('Nieprawidłowa wartość Układu.');
  }
  if (value.width && value.width < 120) throw new Error('Szerokość musi wynosić co najmniej 120 px.');
  if (!/^#[\da-f]{6}$/i.test(value.color)) throw new Error('Nieprawidłowy kolor strony.');
  const [w, h] = sizes[value.size], width = value.landscape ? h : w, height = value.landscape ? w : h;
  if (width - value.left - value.right - value.indentLeft - value.indentRight < 30 || height - value.top - value.bottom < 40)
    throw new Error('Marginesy i wcięcia pozostawiają zbyt mało miejsca na treść.');
  value.footer = String(value.footer).slice(0, 500);
  if ((value.footer || value.numbering) && value.footerDistance >= value.bottom)
    throw new Error('Stopka musi znajdować się w dolnym marginesie. Zwiększ margines lub zmniejsz odległość stopki.');
  value.start = Math.max(1, Math.round(value.start));
  return value;
}

export function setupPageLayout(editor) {
  const dialog = Dialog.create(); dialog.id = 'page-layout-dialog';
  const number = (name, label, unit, max = 100) => `<label>${label} (${unit})<input name="${name}" type="number" min="0" max="${max}" step="0.1"></label>`;
  dialog.innerHTML = `<form method="dialog"><h3>Układ</h3>
    <fieldset><legend>Obszar roboczy i strony</legend>
    <label><input name="paged" type="checkbox">Podział na strony — automatyczny przepływ treści</label>
    ${number('width', 'Szerokość obszaru w trybie ciągłym (0 = pełna)', 'px', 4000)}
    <label>Rozmiar strony<select name="size">${Object.keys(sizes).map(size => `<option>${size}</option>`).join('')}</select></label>
    <label><input name="landscape" type="checkbox">Orientacja pozioma</label>
    <label>Kolor strony<input name="color" type="color"></label></fieldset>
    <fieldset><legend>Marginesy strony</legend>${number('top', 'Górny margines', 'mm')}${number('bottom', 'Dolny margines', 'mm')}
    ${number('left', 'Lewy margines', 'mm')}${number('right', 'Prawy margines', 'mm')}
    </fieldset><fieldset><legend>Wcięcia i odstępy akapitów</legend>
    <label>Zastosuj wcięcia i odstępy do<select name="paragraphScope"><option value="selection">Zaznaczonych akapitów / bieżącego akapitu</option><option value="defaults">Ustaw jako domyślne dla notatki</option></select></label>
    ${number('indentLeft', 'Wcięcie z lewej', 'mm')}${number('indentRight', 'Wcięcie z prawej', 'mm')}
    ${number('before', 'Przed akapitem', 'pt', 1000)}${number('after', 'Po akapicie', 'pt', 1000)}</fieldset>
    <fieldset><legend>Tekst</legend><label><input name="hyphenation" type="checkbox">Automatyczne dzielenie wyrazów (polski)</label></fieldset>
    <fieldset><legend>Stopka i numeracja</legend><label>Tekst stopki<input name="footer" maxlength="500"></label>
    ${number('footerDistance', 'Odległość stopki od dołu strony', 'mm')}
    <label><input name="numbering" type="checkbox">Numeruj strony</label>${number('start', 'Numer początkowy', 'nr', 1000)}</fieldset>
    <p class="layout-error" role="alert"></p><div><button value="cancel" formnovalidate>Anuluj</button><button value="save">Zapisz</button></div></form>`;
  document.body.append(dialog);
  const field = name => dialog.querySelector(`[name="${name}"]`);
  const papers = document.createElement('div'); papers.className = 'layout-papers'; papers.setAttribute('aria-hidden', 'true');
  editor.view.dom.parentElement.prepend(papers);
  let current = layoutDefaults, frame = 0;
  let paragraphSelection = null;
  const fillParagraphFields = () => {
    const defaults = normalizeLayout(editor.state.doc.attrs.pageLayout || {});
    let attrs = null;
    if (field('paragraphScope').value === 'selection' && paragraphSelection)
      editor.state.doc.nodesBetween(paragraphSelection.from, paragraphSelection.to, node => {
        if (!attrs && ['paragraph', 'heading'].includes(node.type.name)) attrs = node.attrs;
      });
    for (const key of paragraphFields) field(key).value = attrs?.[key] ?? defaults[key];
  };
  field('paragraphScope').addEventListener('change', fillParagraphFields);
  const drawPapers = () => {
    if (!current.paged) { papers.replaceChildren(); return; }
    const dimensions = sizes[current.size], width = mm(dimensions[current.landscape ? 1 : 0]), height = mm(dimensions[current.landscape ? 0 : 1]);
    const content = width - mm(current.left + current.right), stride = width + 24;
    const count = Math.max(1, Math.ceil((editor.view.dom.scrollWidth + mm(current.left + current.right) + 24) / stride));
    papers.replaceChildren();
    for (let index = 0; index < count; index++) {
      const paper = document.createElement('div'); paper.className = 'layout-paper';
      Object.assign(paper.style, { left: `${index * stride}px`, width: `${width}px`, height: `${height}px`, background: current.color });
      const footer = document.createElement('div'); footer.className = 'layout-footer';
      footer.textContent = [current.footer, current.numbering ? String(current.start + index) : ''].filter(Boolean).join(' · ');
      Object.assign(footer.style, { bottom: `${mm(current.footerDistance)}px`, left: `${mm(current.left)}px`, width: `${content}px` });
      paper.append(footer); papers.append(paper);
    }
    papers.style.width = `${count * stride - 24}px`;
  };
  const refresh = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(drawPapers); };
  const apply = doc => {
    const value = doc.attrs.pageLayout;
    const host = editor.view.dom.parentElement, root = editor.view.dom;
    host.classList.toggle('document-layout-enabled', Boolean(value));
    host.classList.toggle('document-paged', Boolean(value?.paged));
    if (!value) { current = layoutDefaults; cancelAnimationFrame(frame); papers.replaceChildren(); root.style.removeProperty('column-width'); root.style.removeProperty('hyphens'); root.style.removeProperty('color'); return; }
    current = normalizeLayout(value);
    const dimensions = sizes[current.size], width = mm(dimensions[current.landscape ? 1 : 0]), height = mm(dimensions[current.landscape ? 0 : 1]);
    const contentWidth = current.paged ? width - mm(current.left + current.right) : current.width;
    for (const [key, val] of Object.entries({ 'page-width': width, 'page-height': height, 'page-top': mm(current.top), 'page-bottom': mm(current.bottom),
      'page-left': mm(current.left), 'page-right': mm(current.right), 'page-content-height': height - mm(current.top + current.bottom),
      'page-content-width': contentWidth, 'indent-left': mm(current.indentLeft), 'indent-right': mm(current.indentRight),
      'paragraph-before': current.before * 96 / 72, 'paragraph-after': current.after * 96 / 72 })) host.style.setProperty(`--${key}`, `${val}px`);
    host.style.setProperty('--page-color', current.color);
    const rgb = current.color.match(/[\da-f]{2}/gi).map(part => parseInt(part, 16));
    const ink = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 150 ? '#202020' : '#ddd';
    root.style.color = ink; host.style.setProperty('--page-ink', ink);
    root.style.hyphens = current.hyphenation ? 'auto' : 'manual'; root.lang = 'pl';
    root.style.columnWidth = current.paged ? `${contentWidth}px` : '';
    refresh();
  };
  dialog.querySelector('form').addEventListener('submit', event => {
    if (event.submitter?.value !== 'save') return;
    event.preventDefault();
    try {
      const value = Object.fromEntries(Object.keys(layoutDefaults).map(name => [name, field(name).type === 'checkbox' ? field(name).checked : field(name).value]));
      const layout = normalizeLayout(value);
      const local = field('paragraphScope').value === 'selection';
      const defaults = normalizeLayout(editor.state.doc.attrs.pageLayout || {});
      const documentLayout = local ? { ...layout, ...Object.fromEntries(paragraphFields.map(key => [key, defaults[key]])) } : layout;
      let tr = closeHistory(editor.state.tr);
      const globalChanged = Object.keys(layoutDefaults).some(key => !paragraphFields.includes(key) && layout[key] !== defaults[key]);
      if (!local || editor.state.doc.attrs.pageLayout || globalChanged)
        tr = tr.setDocAttribute('pageLayout', documentLayout).setDocAttribute('contentWidth', layout.width);
      if (local) tr = paragraphFormatTransaction(editor, layout, paragraphSelection, tr);
      editor.view.dispatch(tr);
      editor.view.dispatch(closeHistory(editor.state.tr)); dialog.close(); editor.view.focus();
    } catch (error) { dialog.querySelector('.layout-error').textContent = error.message; }
  });
  editor.on('update', refresh);
  editor.view.dom.addEventListener('load', refresh, true);
  document.fonts?.ready.then(refresh);
  window.addEventListener('resize', refresh);
  return { apply, open() {
    paragraphSelection = editor.state.selection;
    const value = normalizeLayout({ ...layoutDefaults, width: editor.state.doc.attrs.contentWidth || 0, ...editor.state.doc.attrs.pageLayout });
    for (const [name, val] of Object.entries(value)) { if (field(name).type === 'checkbox') field(name).checked = val; else field(name).value = val; }
    field('paragraphScope').value = 'selection'; fillParagraphFields();
    dialog.querySelector('.layout-error').textContent = ''; Dialog.for(dialog).open();
  }, dismiss() { if (dialog.open) dialog.close(); } };
}
