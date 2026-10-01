import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { containerTypes, getContainerType, EmptyTextContainer } from './src/container-types.js';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => { window.chrome ||= {}; window.chrome.webview = { postMessage() {}, addEventListener() {} }; });
let sequence = 0;
const open = content => page.evaluate(({ doc, id }) => window.notatnik.receive({ type: 'open', noteId: id, markdown: '', documentJson: JSON.stringify({ version: 1, doc: { type: 'doc', content: doc } }) }), { doc: content, id: 'ui-test-' + ++sequence });
try {
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await page.waitForFunction(() => window.notatnik);
  assert.equal(new Set(Object.values(containerTypes)).size, 12);
  assert.ok(getContainerType({ type: { name: 'paragraph' }, attrs: { boxEmpty: true }, textContent: '' }) instanceof EmptyTextContainer);
  assert.equal(getContainerType({ type: { name: 'paragraph' }, attrs: { boxEmpty: true }, textContent: 'x' }), containerTypes.paragraph);
  console.log('PASS separate type policies and Empty-to-Text transition');

  await open([{ type: 'codeCell', attrs: { language: 'python' }, content: [{ type: 'text', text: 'print(1)' }] }]);
  await page.locator('.object-container').hover();
  await page.keyboard.down('Control');
  const closeButton = page.locator('.object-container > .container-type-tools .container-delete-button').first();
  const closeIcon = await closeButton.evaluate(button => {
    const box = button.getBoundingClientRect();
    const first = getComputedStyle(button, '::before');
    const second = getComputedStyle(button, '::after');
    return { buttonWidth: box.width, buttonHeight: box.height, firstWidth: first.width, secondWidth: second.width,
      firstHeight: first.height, secondHeight: second.height, firstTop: first.top, secondTop: second.top,
      firstTransform: first.transform, secondTransform: second.transform };
  });
  assert.equal(closeIcon.buttonWidth, 18);
  assert.equal(closeIcon.buttonHeight, 23);
  assert.equal(closeIcon.firstWidth, '10px');
  assert.equal(closeIcon.secondWidth, '10px');
  assert.equal(closeIcon.firstHeight, '1px');
  assert.equal(closeIcon.secondHeight, '1px');
  assert.equal(closeIcon.firstTop, '12.5px');
  assert.equal(closeIcon.secondTop, '12.5px');
  assert.notEqual(closeIcon.firstTransform, closeIcon.secondTransform);
  if (process.env.NOTARIUM_TEST_OUTPUT) await page.locator('.object-container > .container-type-tools').first().screenshot({ path: resolve(process.env.NOTARIUM_TEST_OUTPUT, 'container-tools.png') });
  await page.keyboard.up('Control');
  console.log('PASS container close icon uses centered drawn strokes in the existing hit target');
  await page.locator('.cell-tools .language').click();
  const input = page.locator('.cell-language-input');
  await input.fill('JavaScript');
  await page.getByRole('option', { name: 'JavaScript', exact: true }).click();
  assert.equal(await page.evaluate(() => window.notatnik.editor.getJSON().content[0].attrs.language), 'javascript');
  assert.equal(await page.locator('.ui-dropdown').count(), 0);
  await page.locator('.cell-tools .language').click();
  await input.fill('Python'); await input.press('ArrowDown'); await input.press('Enter');
  assert.equal(await page.evaluate(() => window.notatnik.editor.getJSON().content[0].attrs.language), 'python');
  console.log('PASS common language dropdown mouse and keyboard commit');

  await page.evaluate(() => window.notatnik.receive({ type: 'command', action: 'math' }));
  const trigger = page.locator('#math-dialog .ui-choice');
  await trigger.click();
  assert.equal(await page.locator('#math-dialog .ui-dropdown').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(37, 37, 37)');
  assert.equal(await page.locator('#math-dialog .ui-dropdown').count(), 1);
  await page.getByRole('menuitem', { name: 'Osobny wiersz', exact: true }).click();
  assert.equal(await page.locator('#math-layout').inputValue(), 'blockMath');
  await trigger.click(); await page.keyboard.press('Escape');
  assert.equal(await page.locator('.ui-dropdown').count(), 0);
  assert.equal(await page.locator('#math-dialog').evaluate(el => el.open), true);
  await page.locator('#math-dialog button[value=cancel]').click();
  console.log('PASS common choice dropdown, dialog ownership and Escape');

  await open([{ type: 'image', attrs: { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', width: 200 } }]);
  await page.locator('.object-container img').click({ button: 'right' });
  assert.equal(await page.locator('.media-context-menu.ui-dropdown').count(), 1);
  assert.equal(await page.getByRole('menuitem', { name: 'Przytnij obraz…', exact: true }).count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.ui-dropdown').count(), 0);
  console.log('PASS image context menu uses the shared dropdown');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
