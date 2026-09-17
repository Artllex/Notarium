const dialog = document.createElement('dialog');
dialog.id = 'container-dialog';
dialog.innerHTML = '<form method="dialog"><h3>Kontener</h3><label>Tytuł<input name="title" maxlength="500"></label><label>Stopka<input name="caption" maxlength="2000"></label><label>Szerokość (px, puste = automatyczna)<input name="width" type="number" min="80" max="4000"></label><label>Minimalna wysokość (px, puste = automatyczna)<input name="height" type="number" min="32" max="4000"></label><div><button value="cancel" formnovalidate>Anuluj</button><button value="save">Zapisz</button></div></form>';
document.body.append(dialog);
dialog.querySelector('form>div').insertAdjacentHTML('beforebegin', '<fieldset><legend>Tło kontenera</legend><div class="background-options"><label>Kolor<input name="background" type="color" aria-label="Kolor tła kontenera"></label><label><input name="noBackground" type="checkbox">Brak koloru</label></div></fieldset>');
let context;
const field = name => dialog.querySelector('[name="' + name + '"]');
field('background').addEventListener('input', () => { field('noBackground').checked = false; });
export function editContainer(view) {
  context = view;
  field('title').value = view.node.attrs.boxTitle || '';
  field('caption').value = view.node.attrs.boxCaption || '';
  field('width').value = view.node.attrs.boxWidth || '';
  field('height').value = view.node.attrs.boxHeight || '';
  field('background').value = view.node.attrs.boxBackground || '#303030';
  field('noBackground').checked = !view.node.attrs.boxBackground;
  dialog.showModal();
}
export function dismissContainer() { context = null; if (dialog.open) dialog.close(); }
dialog.querySelector('form').addEventListener('submit', event => {
  if (event.submitter?.value !== 'save' || !context) return;
  event.preventDefault();
  context.updateAttrs({ boxTitle: field('title').value, boxCaption: field('caption').value,
    boxBackground: field('noBackground').checked ? null : field('background').value,
    boxWidth: Number(field('width').value) || null, boxHeight: Number(field('height').value) || null });
  dialog.close(); context = null;
});
