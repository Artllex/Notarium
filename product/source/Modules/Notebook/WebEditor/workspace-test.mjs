import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
const reports = await mkdtemp(join(tmpdir(), 'Notarium-workspace-tests-'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 750 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => { window.bridgeMessages = []; window.chrome ||= {}; window.chrome.webview = { postMessage: m => bridgeMessages.push(m), addEventListener() {} }; });
const command = (action, value) => page.evaluate(message => notatnik.receive(message), { type: 'command', action, value });
const open = (noteId, markdown = 'One\n\nTwo\n\nKeep', documentJson = null) => page.evaluate(m => notatnik.receive(m), { type: 'open', noteId, markdown, documentJson: documentJson && JSON.stringify(documentJson) });
const doc = () => page.evaluate(() => notatnik.editor.getJSON());
const select = (from, to = from) => page.evaluate(({ from, to }) => notatnik.editor.commands.setTextSelection({ from, to }), { from, to });
let checks = 0;
async function check(name, run) { await run(); assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => bridgeMessages.filter(m => m.type === 'error')), []); console.log('PASS ' + name); checks++; }
try {
  await page.goto(pathToFileURL(resolve('dist/index.html')).href); await page.waitForFunction(() => window.notatnik);
  await check('New page areas default to white without recoloring saved documents', async () => {
    await open('white-default');
    await command('layoutField', JSON.stringify({ key: 'paged', value: true }));
    assert.equal((await doc()).attrs.pageLayout.color, '#ffffff');
    await command('undo'); assert.equal((await doc()).attrs.pageLayout, null);
    await command('setPageLayout', JSON.stringify({ paged: true, color: '#202020' }));
    await command('layoutField', JSON.stringify({ key: 'paged', value: false }));
    await command('layoutField', JSON.stringify({ key: 'paged', value: true }));
    assert.equal((await doc()).attrs.pageLayout.color, '#202020');
    await open('cream-saved', 'Saved', {version:1, doc:{type:'doc',attrs:{pageLayout:{paged:true,color:'#fff8e7'}},content:[{type:'paragraph',content:[{type:'text',text:'Saved'}]}]}});
    await command('layoutField', JSON.stringify({ key: 'size', value: 'A5' }));
    assert.equal((await doc()).attrs.pageLayout.color, '#fff8e7');
    await command('undo'); assert.equal((await doc()).attrs.pageLayout.color, '#fff8e7');
  });
  await check('Ribbon field changes only selected paragraph attribute and supports undo', async () => {
    await open('layout-fields'); await select(1, 8);
    await command('layoutField', JSON.stringify({ key: 'indentLeft', value: 9 }));
    const data = await doc(); assert.equal(data.content[0].attrs.indentLeft, 9); assert.equal(data.content[1].attrs.indentLeft, 9); assert.equal(data.content[2].attrs.indentLeft, null);
    assert.equal(data.content[0].attrs.after, null);
    await command('undo'); assert.equal((await doc()).content[0].attrs.indentLeft, null);
    await command('layoutField', JSON.stringify({ key: 'size', value: 'A5' })); assert.equal((await doc()).attrs.pageLayout.size, 'A5');
    await command('layoutField', JSON.stringify({ key: 'width', value: 650 })); assert.equal((await doc()).attrs.contentWidth, 650);
  });
  await check('Right panel slides alongside document without changing data; Escape closes it', async () => {
    const before = await doc(); await command('workspacePanel', 'comments');
    await page.locator('body.right-panel-open').waitFor();
    await page.waitForFunction(() => {
      const editor = document.querySelector('.document-viewport').getBoundingClientRect();
      const panel = document.querySelector('.right-panel');
      return getComputedStyle(panel).transform === 'none' && editor.right <= panel.getBoundingClientRect().left + 1;
    });
    const editorBox = await page.locator('.document-viewport').boundingBox(), panelBox = await page.locator('.right-panel').boundingBox();
    assert.ok(editorBox.x + editorBox.width <= panelBox.x + 1);
    assert.deepEqual(await doc(), before);
    await page.screenshot({ path: join(reports, 'right-panel.png') });
    await page.keyboard.press('Escape'); assert.equal(await page.locator('body.right-panel-open').count(), 0);
  });
  await check('Invalid ribbon dimensions show inline error without changing document', async () => {
    const before = await doc(); await command('layoutField', JSON.stringify({ key: 'width', value: 50 }));
    assert.deepEqual(await doc(), before);
    assert.ok(await page.evaluate(() => bridgeMessages.some(m => m.type === 'ribbonError' && m.message)));
    assert.equal(await page.locator('dialog[open]').count(), 0);
  });
  await check('Math is non-modal, saves to original range and has preview', async () => {
    await open('math'); await select(1, 4); await command('math');
    await page.locator('#math-source').fill('x^2');
    assert.equal(await page.locator('#math-preview .katex').count(), 1);
    assert.equal(await page.locator('dialog:modal').count(), 0);
    await page.waitForTimeout(230);
    assert.equal(await page.evaluate(() => scrollY), 0);
    await page.screenshot({ path: join(reports, 'math-panel.png') });
    await select(6); // Moving the caret must not move the insertion target.
    await page.locator('#math-save').click(); await page.waitForTimeout(70);
    assert.equal((await doc()).content[0].content[0].type, 'inlineMath');
    assert.equal((await doc()).content[1].content[0].text, 'Two');
  });
  await check('Switching notes cancels Math draft; AI is explicitly unavailable', async () => {
    await command('math'); await page.locator('#math-source').fill('y^3'); await open('other', 'Other note');
    assert.equal(await page.locator('dialog[open]').count(), 0); assert.equal(await page.locator('body.top-panel-open').count(), 0);
    await command('workspacePanel', 'ai'); assert.match(await page.locator('.top-panel').innerText(), /nie jest jeszcze/);
    await page.keyboard.press('Escape'); assert.equal((await doc()).content[0].content[0].text, 'Other note');
  });
  await check('Link saves to original selection without a floating dialog', async () => {
    await open('link'); await select(1, 4); await command('link');
    await page.locator('#link-url').fill('https://example.com'); assert.equal(await page.locator('dialog:modal').count(), 0);
    await select(6); await page.locator('#link-save').click(); await page.waitForTimeout(70);
    const data = await doc(); assert.equal(data.content[0].content[0].marks[0].attrs.href, 'https://example.com'); assert.equal(data.content[1].content[0].marks, undefined);
  });
  await check('Container properties save, cancel and stale-target edit cannot apply', async () => {
    await open('container'); await select(1); await command('workspacePanel', 'container');
    await page.locator('#container-dialog [name=title]').fill('Container title'); await page.locator('#container-dialog button[value=save]').click(); await page.waitForTimeout(70);
    assert.equal((await doc()).content[0].attrs.boxTitle, 'Container title');
    await command('workspacePanel', 'container'); await page.locator('#container-dialog [name=title]').fill('Discard'); await page.keyboard.press('Escape'); await page.waitForTimeout(70);
    assert.equal((await doc()).content[0].attrs.boxTitle, 'Container title');
    await command('workspacePanel', 'container'); await page.evaluate(() => notatnik.editor.commands.insertContent('changed'));
    await page.waitForTimeout(70); assert.equal(await page.locator('#container-dialog[open]').count(), 0);
  });
  await check('Numbering panel applies page settings and supports undo', async () => {
    await open('numbering'); await command('workspacePanel', 'numbering');
    const form = page.locator('.right-panel form[data-panel-key=numbering]');
    await form.locator('[name=numbering]').check(); await form.locator('[name=start]').fill('3'); await form.locator('[name=footer]').fill('Notarium'); await form.locator('button:not([type])').click();
    assert.equal((await doc()).attrs.pageLayout.start, 3); assert.equal((await doc()).attrs.pageLayout.footer, 'Notarium');
    await command('undo'); assert.equal((await doc()).attrs.pageLayout, null);
  });
  await check('Table insertion stays at original selected container', async () => {
    await open('table'); await select(1); await command('table');
    await select(11); await page.locator('#table-dialog button[value=insert]').click(); await page.waitForTimeout(70);
    const data = await doc(); assert.equal(data.content[0].type, 'table');
    assert.ok(data.content.some(node => node.content?.some(child => child.text === 'Keep')));
  });
  await check('Image properties use right panel and update only the selected image', async () => {
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNf8AAAAASUVORK5CYII=';
    await open('image', '', { version: 1, doc: { type: 'doc', content: [{ type: 'image', attrs: { src: pixel, width: 100 } }, { type: 'paragraph', content: [{ type: 'text', text: 'Keep' }] }] } });
    await page.evaluate(() => notatnik.editor.commands.setNodeSelection(0)); await command('workspacePanel', 'image');
    await page.locator('#image-width').fill('200'); await page.locator('#image-title').fill('Image title');
    await page.locator('#image-dialog button[value=save]').click(); await page.waitForTimeout(70);
    assert.equal((await doc()).content[0].attrs.width, 200); assert.equal((await doc()).content[0].attrs.title, 'Image title');
    assert.equal((await doc()).content[1].content[0].text, 'Keep');
  });
  await check('Escape dismisses dropdown before Math panel, then dismisses Math', async () => {
    await open('dropdown'); await command('math'); await page.waitForTimeout(230);
    await page.locator('#math-dialog .ui-choice').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#math-dialog[open]').count(), 1); assert.equal(await page.locator('.ui-dropdown').count(), 0);
    await page.keyboard.press('Escape'); await page.waitForTimeout(70); assert.equal(await page.locator('#math-dialog[open]').count(), 0);
  });
  await check('Both panels fit narrow viewport and close independently', async () => {
    await page.setViewportSize({ width: 760, height: 480 }); await command('workspacePanel', 'comments'); await command('math'); await page.waitForTimeout(230);
    assert.equal(await page.locator('body.right-panel-open.top-panel-open').count(), 1);
    assert.ok((await page.locator('.document-viewport').boundingBox()).width >= 400);
    await page.locator('.top-panel .panel-close').click(); assert.equal(await page.locator('body.right-panel-open').count(), 1);
    await page.locator('.right-panel .panel-close').click(); assert.equal(await page.locator('body.right-panel-open').count(), 0);
  });
  await check('Ribbon margin preset is one undoable change and leaves paragraph settings alone', async () => {
    await open('margin-preset'); await command('layoutField', JSON.stringify({ key: 'indentLeft', value: 8 }));
    const before = await doc(); await command('layoutFields', JSON.stringify({ top: 12.7, bottom: 12.7, left: 12.7, right: 12.7 }));
    const data = await doc(); assert.equal(data.attrs.pageLayout.top, 12.7); assert.equal(data.attrs.pageLayout.right, 12.7); assert.equal(data.content[0].attrs.indentLeft, 8);
    await command('undo'); assert.deepEqual(await doc(), before);
  });
  await check('Ribbon table grid inserts selected dimensions; block equation opens matching layout', async () => {
    await open('grid-table'); await select(1); await command('tableSize', JSON.stringify({ rows: 2, cols: 4 }));
    const table = (await doc()).content[0]; assert.equal(table.type, 'table'); assert.equal(table.content.length, 2); assert.equal(table.content[0].content.length, 4);
    await command('mathBlock'); assert.equal(await page.locator('#math-layout').inputValue(), 'blockMath');
    await page.keyboard.press('Escape');
  });
  console.log(`TOTAL ${checks} workspace checks; screenshots: ${reports}`);
} finally { await browser.close(); }
