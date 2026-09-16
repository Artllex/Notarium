import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => { window.bridgeMessages = []; window.chrome ||= {}; window.chrome.webview = { postMessage: message => window.bridgeMessages.push(message), addEventListener() {} }; });
await page.goto(pathToFileURL(resolve('dist/index.html')).href);
await page.waitForFunction(() => window.notatnik);
let passed = 0;
const open = (id, markdown = '', documentJson = null) => page.evaluate(message => window.notatnik.receive(message), { type: 'open', noteId: id, markdown, documentJson });
const command = (action, value) => page.evaluate(message => window.notatnik.receive(message), { type: 'command', action, value });
const json = () => page.evaluate(() => window.notatnik.editor.getJSON());
async function check(name, run) { await run(); assert.deepEqual(errors, []); const bridgeErrors = await page.evaluate(() => window.bridgeMessages.filter(m => m.type === 'error')); assert.deepEqual(bridgeErrors, []); console.log(`PASS ${name}`); passed++; }
try {
  await check('Blank document can be focused from its outer margins', async () => {
    for (const [index, position] of [[8, 8], [8, 300], [1080, 300], [500, 630], [500, 300]].entries()) {
      await open(`blank-click-${index}`);
      await page.evaluate(() => window.notatnik.editor.commands.blur());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.mouse.click(...position);
      await page.keyboard.type('Test');
      assert.equal(await page.locator('.tiptap').textContent(), 'Test', `Click at ${position}`);
    }
  });
  await check('Legacy import: formatting, emoji, code cell, indentation', async () => {
    await open('legacy', '# Tytuł 🦊\n\n<span style="color:#58B889">zielony</span>\n\n<!-- cell:python -->\n```python\n    print(42)\n```');
    assert.equal(await page.locator('.tiptap h1').textContent(), 'Tytuł 🦊');
    assert.equal(await page.locator('.code-cell').count(), 1);
    assert.equal(await page.locator('.cm-content').textContent(), '    print(42)');
    assert.match(await page.locator('.tiptap').textContent(), /zielony/);
    assert.doesNotMatch(await page.locator('.tiptap').textContent(), /<span|cell:python/);
  });
  await check('Markdown input: headings and numbered list continuation', async () => {
    await open('typing'); await page.locator('.tiptap').click();
    await page.keyboard.type('# Heading'); await page.keyboard.press('Enter');
    await page.keyboard.type('1. first'); await page.keyboard.press('Enter'); await page.keyboard.type('second');
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('ol li').count(), 2);
    await page.keyboard.press('Tab'); assert.equal(await page.locator('ol ol li').count(), 1);
  });
  await check('Formatting stored as marks and undo/redo', async () => {
    await open('marks', 'hello');
    await page.evaluate(() => window.notatnik.editor.commands.selectAll());
    await command('color', '#58B889'); await command('font', 'Consolas'); await command('highlight', '#F4D35E');
    const data = JSON.stringify(await json());
    assert.match(data, /Consolas/); assert.match(data, /58B889/i); assert.match(data, /highlight/);
    assert.doesNotMatch(await page.locator('.tiptap').textContent(), /span|style=/);
    await command('undo'); assert.doesNotMatch(JSON.stringify(await json()), /highlight/);
    await command('redo'); assert.match(JSON.stringify(await json()), /highlight/);
  });
  await check('Color and highlight can be cleared for selection and subsequent typing', async () => {
    await open('clear-marks', 'text');
    await page.evaluate(() => window.notatnik.editor.commands.selectAll());
    await command('color', '#58B889'); await command('highlight', '#F4D35E');
    await command('clearColor'); await command('clearHighlight');
    assert.doesNotMatch(JSON.stringify(await json()), /58B889|highlight/);
    await command('undo'); assert.match(JSON.stringify(await json()), /highlight/);
    await open('clear-typing'); await command('color', '#58B889'); await command('highlight', '#F4D35E');
    await command('clearColor'); await command('clearHighlight');
    await page.keyboard.type('plain');
    assert.doesNotMatch(JSON.stringify(await json()), /58B889|highlight/);
  });
  await check('Task list accepts text next to its checkbox', async () => {
    await open('tasks'); await command('checklist');
    const text = page.locator('li[data-checked] p');
    await text.click(); await page.keyboard.type('Zadanie');
    assert.equal(await text.textContent(), 'Zadanie');
    assert.equal(await page.locator('li[data-checked] input[type="checkbox"]').count(), 1);
  });
  await check('Font at an empty caret changes typed text and reports its value', async () => {
    await open('caret-font'); await page.locator('.tiptap').click();
    await command('font', 'Georgia'); await page.keyboard.type('Georgia text');
    assert.match(JSON.stringify(await json()), /Georgia/);
    const selections = await page.evaluate(() => window.bridgeMessages.filter(message => message.type === 'selection'));
    assert.equal(selections.at(-1).font, 'Georgia');
  });
  await check('Cell creation, CodeMirror editing, shared history and deletion', async () => {
    await open('cells', 'Notatka'); await command('cell');
    assert.equal(await page.locator('.code-cell').count(), 1);
    await command('undo'); assert.equal(await page.locator('.code-cell').count(), 0);
    await command('redo'); assert.equal(await page.locator('.code-cell').count(), 1);
    await page.locator('.cm-content').click(); await page.keyboard.type('print(42)');
    assert.match(JSON.stringify(await json()), /print\(42\)/);
    await page.keyboard.press('Control+z'); assert.doesNotMatch(JSON.stringify(await json()), /print\(42\)/);
    await page.keyboard.press('Control+y'); assert.match(JSON.stringify(await json()), /print\(42\)/);
    await page.getByRole('button', { name: 'Usuń komórkę', exact: true }).click();
    assert.equal(await page.locator('.code-cell').count(), 0);
    await command('undo'); assert.match(await page.locator('.cm-content').textContent(), /print\(42\)/);
  });
  await check('Structured save and reopen retain the whole document', async () => {
    const saved = await page.evaluate(() => window.notatnik.snapshot()); const expected = await json();
    await open('reloaded', '', saved.documentJson); assert.deepEqual(await json(), expected);
    assert.match(saved.markdown, /cell:python/);
  });
  await check('Note switching isolates history and late messages carry note ID', async () => {
    await open('A', 'AAA'); await page.evaluate(() => window.notatnik.editor.commands.selectAll()); await command('bold');
    await open('B', 'BBB'); await command('undo'); assert.match(JSON.stringify(await json()), /BBB/);
    await open('A'); await command('undo'); assert.doesNotMatch(JSON.stringify(await json()), /bold/);
    const changes = await page.evaluate(() => window.bridgeMessages.filter(m => m.type === 'changed'));
    assert.ok(changes.length > 0 && changes.every(m => m.noteId));
  });
  await check('Deleting colored text leaves no markup', async () => {
    await open('deletion', 'abc'); await page.evaluate(() => window.notatnik.editor.commands.selectAll());
    await command('color', '#58B889'); await page.keyboard.press('Backspace');
    assert.equal(await page.locator('.tiptap').innerText(), '\n');
    await command('undo'); assert.match(await page.locator('.tiptap').textContent(), /abc/);
  });
  await check('LaTeX dialog renders, edits, rejects invalid formulas and round trips Markdown', async () => {
    await open('math-test'); await command('math');
    await page.locator('#math-source').fill('\\badcommand');
    assert.equal(await page.locator('#math-save').isDisabled(), true);
    await page.locator('#math-source').fill('\\frac{a}{b}');
    await page.locator('#math-save').click();
    assert.equal(await page.locator('.tiptap .katex').count(), 1);
    await page.locator('.tiptap .katex').click();
    await page.locator('#math-source').fill('E=mc^2'); await page.locator('#math-save').click();
    assert.match(JSON.stringify(await json()), /E=mc\^2/);
    await command('undo'); assert.match(JSON.stringify(await json()), /frac/);
    await command('redo');
    await page.evaluate(() => window.notatnik.editor.commands.focus('end'));
    await command('math'); await page.locator('#math-layout').selectOption('blockMath');
    await page.locator('#math-source').fill('\\sum_{i=1}^{n} i'); await page.locator('#math-save').click();
    assert.equal(await page.locator('.tiptap .katex').count(), 2);
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    assert.match(saved.markdown, /\$E=mc\^2\$/); assert.match(saved.markdown, /\$\$/);
    await open('math-json', '', saved.documentJson); assert.equal(await page.locator('.tiptap .katex').count(), 2);
    await open('math-md', saved.markdown); assert.equal(await page.locator('.tiptap .katex').count(), 2);
  });
  await check('Images insert from a file at 200px, keep small sizes, undo and reopen offline', async () => {
    await open('image-test');
    for (const width of [640, 80]) {
      const data = await page.evaluate(width => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = width / 2;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#60a5fa'; ctx.fillRect(0, 0, width, width / 2);
        return canvas.toDataURL('image/png').split(',')[1];
      }, width);
      const chosen = page.waitForEvent('filechooser'); await command('image');
      await (await chosen).setFiles({ name: `test-${width}.png`, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
      await page.waitForFunction(count => document.querySelectorAll('.tiptap img').length === count, width === 640 ? 1 : 2);
    }
    const dimensions = await page.locator('.tiptap img').evaluateAll(images => images.map(image => [image.width, image.height]));
    assert.deepEqual(dimensions, [[200, 100], [80, 40]]);
    await command('undo'); assert.equal(await page.locator('.tiptap img').count(), 1);
    await command('redo'); assert.equal(await page.locator('.tiptap img').count(), 2);
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    await open('image-json', '', saved.documentJson); assert.equal(await page.locator('.tiptap img').count(), 2);
    await open('image-md', saved.markdown); assert.equal(await page.locator('.tiptap img').count(), 2);
    await page.waitForFunction(() => [...document.images].every(image => image.complete));
    assert.deepEqual(await page.locator('.tiptap img').evaluateAll(images => images.map(image => image.width)), [200, 80]);
    await page.screenshot({ path: '../../../outputs/engines-check/images.png' });
  });
  await open('demo', '# Notatnik 🦊\n\n**Tiptap** — tekst, listy i formatowanie.\n\n1. Pierwszy punkt\n2. Drugi punkt');
  await command('cell'); await page.locator('.cm-content').click(); await page.keyboard.type('def greeting(name):\n    return f"Hello, {name}!"');
  await mkdir('../../../outputs/engines-check', { recursive: true });
  await page.screenshot({ path: '../../../outputs/engines-check/editor.png' });
  console.log(`PASS ${passed} browser integration scenarios`);
} finally { await browser.close(); }
