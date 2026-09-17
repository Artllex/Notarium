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
  await check('Paragraph alignment supports left, center, right and justify with persistence', async () => {
    await open('alignment', 'Pierwszy akapit\n\nDrugi akapit');
    const first = page.locator('.tiptap p').first();
    await first.click();
    for (const [action, value] of [['alignCenter', 'center'], ['alignRight', 'right'], ['alignJustify', 'justify'], ['alignLeft', 'left']]) {
      await command(action);
      assert.equal(await first.evaluate(element => element.style.textAlign), value);
    }
    await command('alignJustify');
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    await open('alignment-json', '', saved.documentJson);
    assert.equal(await page.locator('.tiptap p').first().evaluate(element => element.style.textAlign), 'justify');
    await open('alignment-md', saved.markdown);
    assert.equal(await page.locator('.tiptap p').first().evaluate(element => element.style.textAlign), 'justify');
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
  await check('Content width is per-document, undoable and retained by JSON and Markdown', async () => {
    await open('article-width', '<!-- notarium:article -->\n\n# Article\n\nParagraph');
    const editorElement = page.locator('.tiptap');
    assert.equal(await editorElement.getAttribute('data-content-width'), '790');
    assert.equal(await editorElement.evaluate(element => getComputedStyle(element).maxWidth), '790px');
    await command('contentWidth', '650');
    assert.equal(await editorElement.evaluate(element => getComputedStyle(element).maxWidth), '650px');
    await command('undo'); assert.equal(await editorElement.evaluate(element => getComputedStyle(element).maxWidth), '790px');
    await command('redo'); assert.equal(await editorElement.evaluate(element => getComputedStyle(element).maxWidth), '650px');
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    assert.match(saved.markdown, /notarium:article width=650/);
    await open('width-json', '', saved.documentJson);
    assert.equal(await editorElement.evaluate(element => getComputedStyle(element).maxWidth), '650px');
    await open('width-markdown', saved.markdown);
    assert.equal(await editorElement.evaluate(element => getComputedStyle(element).maxWidth), '650px');
    await command('contentWidth', '0');
    assert.equal(await editorElement.evaluate(element => getComputedStyle(element).maxWidth), 'none');
    await open('plain-note-width', 'Plain note');
    assert.equal(await editorElement.evaluate(element => getComputedStyle(element).maxWidth), 'none');
    const selections = await page.evaluate(() => window.bridgeMessages.filter(message => message.type === 'selection'));
    assert.equal(selections.at(-1).contentWidth, 0);
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
  await check('Cell language picker supports SQL and R, syntax highlighting, undo and persistence', async () => {
    await open('language-picker'); await command('cell');
    const label = page.locator('.cell-tools .language'), input = page.getByRole('combobox', { name: 'Język komórki' });
    await label.dblclick(); await input.fill('SQL'); await input.press('Enter');
    assert.equal(await label.textContent(), 'SQL');
    await page.locator('.cm-content').click(); await page.keyboard.type('SELECT * FROM users WHERE id = 1;');
    await page.waitForFunction(() => document.querySelector('.cm-line span')?.textContent === 'SELECT');
    await label.dblclick(); await input.fill('R'); await input.press('Enter');
    assert.equal(await label.textContent(), 'R');
    await command('undo'); assert.equal(await label.textContent(), 'SQL');
    await command('redo'); assert.equal(await label.textContent(), 'R');
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    assert.match(saved.markdown, /cell:r/);
    await open('language-json', '', saved.documentJson); assert.equal(await label.textContent(), 'R');
    await open('language-md', saved.markdown); assert.equal(await label.textContent(), 'R');
    assert.match(await page.locator('.cm-content').textContent(), /SELECT/);
    await label.dblclick(); await input.fill('Unknown language'); await input.press('Enter');
    assert.equal(await input.isVisible(), true); await input.press('Escape');
    assert.equal(await label.textContent(), 'R');
    await label.dblclick(); await input.fill('C++'); await input.press('Enter');
    const cpp = await page.evaluate(() => window.notatnik.snapshot());
    await open('cpp-markdown', cpp.markdown); assert.equal(await label.textContent(), 'C++');
    await open('cells');
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
    assert.equal(await page.locator('#math-dialog').evaluate(el => el.open), false);
    await page.locator('.tiptap .katex').dblclick();
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
  await check('Automatic equation numbering survives edit, delete, undo and both storage formats', async () => {
    await open('numbered-math');
    for (const latex of ['a=1', 'b=2', 'c=3']) {
      await page.evaluate(() => window.notatnik.editor.commands.focus('end'));
      await command('math'); await page.locator('#math-layout').selectOption('blockMath');
      await page.locator('#math-numbered').check(); await page.locator('#math-source').fill(latex);
      await page.locator('#math-save').click();
    }
    const numbered = page.locator('.tiptap [data-numbered="true"]');
    assert.equal(await numbered.count(), 3);
    assert.match(await numbered.first().evaluate(el => getComputedStyle(el, '::after').content), /counter\(equation\)/);
    await numbered.nth(1).dblclick(); await page.locator('#math-numbered').uncheck(); await page.locator('#math-save').click();
    assert.equal(await numbered.count(), 2);
    await command('undo'); assert.equal(await numbered.count(), 3);
    await page.evaluate(() => { const ed = window.notatnik.editor; let pos; ed.state.doc.descendants((node, p) => { if (node.attrs.latex === 'b=2') pos = p; }); ed.commands.deleteBlockMath({ pos }); });
    assert.equal(await numbered.count(), 2);
    await command('undo'); assert.equal(await numbered.count(), 3);
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    await open('numbered-json', '', saved.documentJson); assert.equal(await numbered.count(), 3);
    await open('numbered-md', saved.markdown); assert.equal(await numbered.count(), 3);
  });
  await check('Image width, title and caption edit without losing aspect ratio or history', async () => {
    await open('image-test');
    await page.locator('.tiptap img').first().dblclick();
    await page.locator('#image-width').fill('320');
    await page.locator('#image-title').fill('Tytuł obrazu'); await page.locator('#image-caption').fill('Podpis obrazu');
    await page.locator('#image-dialog button[value="save"]').click();
    assert.equal(await page.locator('.tiptap img').first().evaluate(el => el.width), 320);
    assert.equal(await page.locator('.tiptap img').first().evaluate(el => el.height), 160);
    assert.equal(await page.locator('.tiptap .image-title').first().textContent(), 'Tytuł obrazu');
    assert.equal(await page.locator('.tiptap figcaption').first().textContent(), 'Podpis obrazu');
    await page.locator('.image-title .label-editor').click();
    await page.locator('.image-title .label-editor').fill('Nowy tytuł');
    await page.locator('figcaption .label-editor').click();
    await page.locator('figcaption .label-editor').fill('Nowa stopka');
    assert.equal(await page.locator('.tiptap .image-title').first().textContent(), 'Nowy tytuł');
    assert.equal(await page.locator('.tiptap figcaption').first().textContent(), 'Nowa stopka');
    await command('undo'); assert.equal(await page.locator('.tiptap figcaption').first().textContent(), 'Podpis obrazu');
    await command('redo');
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    for (const format of ['json', 'md']) {
      await open('caption-' + format, format === 'md' ? saved.markdown : '', format === 'json' ? saved.documentJson : undefined);
      assert.equal(await page.locator('.tiptap img').first().getAttribute('title'), 'Nowy tytuł');
      assert.equal(await page.locator('.tiptap img').first().evaluate(el => el.width), 320);
      assert.equal(await page.locator('.tiptap figcaption').first().textContent(), 'Nowa stopka');
    }
  });
  await check('Image crop uses Cropper.js and participates in undo history', async () => {
    await open('image-test', '', (await page.evaluate(() => window.notatnik.snapshot())).documentJson);
    const image = page.locator('.tiptap img').first();
    const original = await image.getAttribute('src');
    await image.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Przytnij obraz…' }).click();
    assert.equal(await page.locator('#image-dialog').evaluate(el => el.open), false);
    await page.locator('.cropper-container').waitFor();
    await page.getByRole('textbox', { name: 'Proporcje X:Y' }).fill('1:1');
    await page.screenshot({ path: '../../../outputs/engines-check/inline-crop.png' });
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.inline-crop').count(), 0);
    await page.locator('.tiptap p').last().click();
    const cropped = (await json()).content.find(n => n.type === 'image').attrs.crop;
    assert.ok(cropped && cropped.width === cropped.height);
    assert.equal(await image.getAttribute('src'), original);
    await command('undo'); assert.equal((await json()).content.find(n => n.type === 'image').attrs.crop, null);
    await command('redo'); assert.deepEqual((await json()).content.find(n => n.type === 'image').attrs.crop, cropped);
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    for (const format of ['json', 'md']) {
      await open('crop-retained-' + format, format === 'md' ? saved.markdown : '', format === 'json' ? saved.documentJson : null);
      assert.equal(await image.getAttribute('src'), original);
      assert.deepEqual((await json()).content.find(n => n.type === 'image').attrs.crop, cropped);
      await image.click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Przytnij obraz…' }).click();
      assert.equal(await page.locator('.inline-crop-tools').count(), 1, 'Crop controls after reopen: ' + format);
      await page.locator('.inline-crop-tools').getByRole('button', { name: 'Cały obraz' }).click();
      assert.equal((await json()).content.find(n => n.type === 'image').attrs.crop, null);
      assert.equal(await image.getAttribute('src'), original);
      await image.click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Przytnij obraz…' }).click();
      await page.getByRole('textbox', { name: 'Proporcje X:Y' }).fill('1:1');
      await page.locator('.tiptap p').last().click();
      assert.equal(await page.locator('.inline-crop').count(), 0);
      assert.ok((await json()).content.find(n => n.type === 'image').attrs.crop);
      await command('undo');
      assert.equal((await json()).content.find(n => n.type === 'image').attrs.crop, null);
    }
  });
  await check('Windows double-click bridge opens image/math settings and image title editing', async () => {
    await open('image-test');
    async function nativeDoubleClick(selector) {
      await page.locator(selector).first().scrollIntoViewIfNeeded();
      await page.evaluate(selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        window.notatnik.receive({ type: 'doubleClick', x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight });
      }, selector);
    }
    await nativeDoubleClick('.tiptap img');
    assert.equal(await page.locator('#image-dialog').evaluate(el => el.open), true);
    await page.locator('#image-dialog button[value=cancel]').click();
    await nativeDoubleClick('.image-title');
    assert.equal(await page.locator('.image-inline-editor').count(), 0);
    await page.locator('.image-title .label-editor').fill('Tytuł po dwukliku Windows');
    assert.equal(await page.locator('.image-title').first().textContent(), 'Tytuł po dwukliku Windows');
    await open('numbered-math');
    await nativeDoubleClick('[data-type=block-math] .katex');
    assert.equal(await page.locator('#math-dialog').evaluate(el => el.open), true);
    await page.locator('#math-dialog button[value=cancel]').click();
  });
  await check('Image controls resize, wrap, align and expose document dragging', async () => {
    await open('image-controls');
    const data = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 500; c.height = 250; return c.toDataURL('image/png').split(',')[1]; });
    const chosen = page.waitForEvent('filechooser'); await command('image');
    await (await chosen).setFiles({ name: 'move.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
    const figure = page.locator('figure[data-note-image]'); await figure.click();
    assert.ok((await figure.boundingBox()).width < 230, 'Selection frame should fit the image');
    assert.equal(await figure.getAttribute('draggable'), 'true');
    assert.equal(await page.locator('#image-placement').count(), 0);
    await command('alignRight');
    assert.equal(await page.locator('[data-container-type=image]').getAttribute('data-align'), 'right');
    await figure.click();
    const handle = page.locator('[data-container-type=image]>.container-resize'), box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2); await page.mouse.up();
    assert.equal(await figure.locator('img').evaluate(img => img.width), 260);
    await command('undo'); assert.equal(await figure.locator('img').evaluate(img => img.width), 200);
    await page.locator('.tiptap p').last().click(); await page.keyboard.type('Cel przeniesienia');
    const beforeMove = await page.evaluate(() => window.notatnik.editor.getJSON().content.map(node => node.type));
    const target = page.locator('.tiptap p').last(), targetBox = await target.boundingBox();
    await figure.dragTo(target, { targetPosition: { x: 300, y: Math.max(1, targetBox.height - 1) } });
    const afterMove = await page.evaluate(() => window.notatnik.editor.getJSON().content.map(node => node.type));
    assert.notDeepEqual(afterMove, beforeMove);
    await command('undo');
    assert.deepEqual(await page.evaluate(() => window.notatnik.editor.getJSON().content.map(node => node.type)), beforeMove);
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    await open('image-controls-reopen', '', saved.documentJson);
    assert.equal(await page.locator('[data-container-type=image]').getAttribute('data-align'), 'right');
  });
  await check('Block equations expose native drag-and-drop movement', async () => {
    await open('math-drag');
    for (const latex of ['x=1', 'y=2']) {
      await command('math'); await page.locator('#math-layout').selectOption('blockMath');
      await page.locator('#math-source').fill(latex); await page.locator('#math-save').click();
      await page.evaluate(() => window.notatnik.editor.commands.focus('end'));
    }
    const formulas = page.locator('[data-type="block-math"]');
    assert.equal(await formulas.count(), 2);
    assert.deepEqual(await formulas.evaluateAll(nodes => nodes.map(node => node.draggable)), [true, true]);
    const before = await page.evaluate(() => window.notatnik.editor.getJSON().content.filter(node => node.type === 'blockMath').map(node => node.attrs.latex));
    const destination = await formulas.nth(1).boundingBox();
    await formulas.first().dragTo(formulas.nth(1), { targetPosition: { x: 10, y: destination.height - 1 } });
    const after = await page.evaluate(() => window.notatnik.editor.getJSON().content.filter(node => node.type === 'blockMath').map(node => node.attrs.latex));
    assert.notDeepEqual(after, before);
    await command('undo');
    assert.deepEqual(await page.evaluate(() => window.notatnik.editor.getJSON().content.filter(node => node.type === 'blockMath').map(node => node.attrs.latex)), before);
    assert.equal(await page.locator('#math-numbered').count(), 1);
    assert.equal(await page.locator('.math-options').evaluate(el => getComputedStyle(el).display), 'flex');
  });
  await check('Shared block movement reorders mixed sections, cell borders and text handles without data loss', async () => {
    const text = value => ({ type: 'text', text: value });
    const doc = { type: 'doc', content: [
      { type: 'paragraph', content: [text('First paragraph')] },
      { type: 'blockMath', attrs: { latex: 'x=1', numbered: true } },
      { type: 'codeCell', content: [text('print(1)')] },
      { type: 'codeCell', content: [text('print(2)')] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('List entry')] }] }] },
      { type: 'paragraph', content: [text('Last paragraph')] }
    ] };
    await open('mixed-movement', '', JSON.stringify({ version: 1, doc }));
    const original = await json();
    await page.locator('[data-type="block-math"]').dragTo(page.locator('.code-cell').last(), { targetPosition: { x: 100, y: 75 } });
    const moved = await json();
    assert.equal(moved.content[3].type, 'blockMath');
    assert.deepEqual(moved.content.filter(n => n.type === 'codeCell'), original.content.filter(n => n.type === 'codeCell'));
    await command('undo'); assert.deepEqual(await json(), original);
    await command('redo'); assert.deepEqual(await json(), moved);
    const cell = await page.locator('.code-cell').last().boundingBox();
    const first = await page.locator('.tiptap > .object-container > p').first().boundingBox();
    await page.mouse.move(cell.x + 2, cell.y + 45); await page.mouse.down();
    await page.mouse.move(first.x + 40, first.y + 1, { steps: 8 });
    assert.equal(await page.locator('.block-drop-marker').isVisible(), true);
    await page.mouse.up(); assert.equal((await json()).content[0].content[0].text, 'print(2)');
    await command('undo'); assert.deepEqual(await json(), moved);
    await page.locator('.tiptap > .object-container > p').first().hover();
    const grip = await page.locator('[data-container-type=paragraph] .container-grip').first().boundingBox();
    const last = await page.locator('.tiptap > .object-container > p').last().boundingBox();
    await page.mouse.move(grip.x + 12, grip.y + 12); await page.mouse.down();
    await page.mouse.move(last.x + 50, last.y + last.height, { steps: 8 }); await page.mouse.up();
    assert.equal((await json()).content.at(-1).content[0].text, 'First paragraph');
    await command('undo'); assert.deepEqual(await json(), moved);
    await page.locator('.tiptap > .object-container > ul').hover();
    const listGrip = await page.locator('[data-container-type=bulletList] .container-grip').boundingBox();
    await page.mouse.move(listGrip.x + 12, listGrip.y + 12); await page.mouse.down();
    await page.mouse.move(first.x + 40, first.y + 1, { steps: 8 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await json(), moved);
    await page.locator('.tiptap > .object-container > ul').hover();
    const listHandle = await page.locator('[data-container-type=bulletList] .container-grip').boundingBox();
    await page.mouse.move(listHandle.x + 12, listHandle.y + 12); await page.mouse.down();
    await page.mouse.move(first.x + 40, first.y + 1, { steps: 8 }); await page.mouse.up();
    assert.equal((await json()).content[0].type, 'bulletList');
    await command('undo'); assert.deepEqual(await json(), moved);
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    await open('mixed-movement-reopened', '', saved.documentJson); assert.deepEqual(await json(), moved);
  });
  await check('Tables insert, edit, add rows, undo, round trip and delete', async () => {
    await open('tables'); await command('table');
    await page.locator('#table-rows').fill('2'); await page.locator('#table-cols').fill('3');
    await page.locator('#table-dialog button[value="insert"]').click();
    assert.equal(await page.locator('.tiptap tr').count(), 2);
    await page.locator('.tiptap th').first().click(); await page.keyboard.type('Heading');
    await page.locator('.tiptap td').first().click(); await page.keyboard.type('Value');
    await command('table'); await page.locator('[data-table-command="addRowAfter"]').click();
    assert.equal(await page.locator('.tiptap tr').count(), 3);
    await command('undo'); assert.equal(await page.locator('.tiptap tr').count(), 2);
    await command('redo');
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    for (const format of ['json', 'md']) {
      await open('table-' + format, format === 'md' ? saved.markdown : '', format === 'json' ? saved.documentJson : undefined);
      assert.equal(await page.locator('.tiptap tr').count(), 3);
      assert.match(await page.locator('.tiptap table').textContent(), /Heading.*Value/s);
    }
    await page.locator('.tiptap td').first().click(); await command('table');
    await page.locator('[data-table-command="deleteTable"]').click(); assert.equal(await page.locator('.tiptap table').count(), 0);
    await command('undo'); assert.equal(await page.locator('.tiptap table').count(), 1);
    await page.evaluate(() => window.notatnik.editor.commands.insertContentAt(0, { type: 'paragraph', content: [{ type: 'text', text: 'Before table' }] }));
    const originalTableDocument = await json();
    await page.locator('.tiptap th').first().hover();
    const tableHandle = await page.locator('[data-container-type=table] .container-grip').boundingBox();
    const aboveTable = await page.locator('.tiptap > .object-container > p').first().boundingBox();
    await page.mouse.move(tableHandle.x + 12, tableHandle.y + 12); await page.mouse.down();
    await page.mouse.move(aboveTable.x + 30, aboveTable.y + 1, { steps: 8 }); await page.mouse.up();
    assert.equal((await json()).content[0].type, 'table');
    await command('undo'); assert.deepEqual(await json(), originalTableDocument);
    await page.screenshot({ path: '../../../outputs/engines-check/table.png' });
  });
  await check('Containers drag into columns, resize, persist and leave columns with undo', async () => {
    const doc = { type: 'doc', content: ['A', 'B', 'C'].map(text => ({ type: 'paragraph', attrs: { boxHeight: 120 }, content: [{ type: 'text', text }] })) };
    await open('columns', '', JSON.stringify({ version: 1, doc }));
    const original = await json();
    const boxes = page.locator('.object-container');
    await boxes.first().hover();
    const grip = await boxes.first().locator('.container-grip').boundingBox(), target = await boxes.nth(1).boundingBox();
    await page.mouse.move(grip.x + 12, grip.y + 12); await page.mouse.down();
    await page.mouse.move(target.x + target.width - 3, target.y + 55, { steps: 8 }); await page.mouse.up();
    assert.equal((await json()).content[0].type, 'layoutRow');
    assert.equal((await json()).content[0].content[1].content[0].text, 'A');
    const rowBoxes = page.locator('.layout-row>.object-container');
    const left = await rowBoxes.first().boundingBox(), right = await rowBoxes.last().boundingBox();
    assert.ok(right.x > left.x && Math.abs(right.y - left.y) < 2);
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    await command('undo'); assert.deepEqual(await json(), original); await command('redo');
    for (const format of ['json', 'md']) {
      await open('columns-' + format, format === 'md' ? saved.markdown : '', format === 'json' ? saved.documentJson : null);
      assert.equal(await page.locator('.layout-row>.object-container').count(), 2);
    }
    await rowBoxes.last().hover();
    const source = await rowBoxes.last().locator('.container-grip').boundingBox(), below = await boxes.last().boundingBox();
    await page.mouse.move(source.x + 12, source.y + 12); await page.mouse.down();
    await page.mouse.move(below.x + 200, below.y + below.height, { steps: 8 }); await page.mouse.up();
    assert.equal(await page.locator('.layout-row').count(), 0);
    assert.equal((await json()).content.at(-1).content[0].text, 'A');
    await boxes.first().hover();
    const resize = await boxes.first().locator('.container-resize').boundingBox();
    await page.mouse.move(resize.x + 5, resize.y + 5); await page.mouse.down();
    await page.mouse.move(resize.x - 100, resize.y + 50); await page.mouse.up();
    assert.ok((await json()).content[0].attrs.boxHeight > 120);
    await command('undo'); assert.equal((await json()).content[0].attrs.boxHeight, 120);
    await page.screenshot({ path: '../../../outputs/engines-check/containers.png' });
  });
  await check('Right and bottom edges resize independently; corner double click resets layout with undo', async () => {
    await open('edge-resize', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'paragraph', attrs: { boxWidth: 420, boxHeight: 140, boxAlign: 'center', boxTitle: 'Tytuł' }, content: [{ type: 'text', text: 'Treść' }] }
    ] } }));
    const box = page.locator('.object-container').first();
    async function dragEdge(selector, dx, dy) {
      await box.hover(); const edge = await box.locator(selector).boundingBox();
      const x = edge.x + edge.width / 2, y = edge.y + edge.height / 2;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 6 }); await page.mouse.up();
    }
    await dragEdge('.container-resize-right', 60, 25);
    assert.equal((await json()).content[0].attrs.boxWidth, 480);
    assert.equal((await json()).content[0].attrs.boxHeight, 140);
    await dragEdge('.container-resize-bottom', 25, 50);
    assert.equal((await json()).content[0].attrs.boxWidth, 480);
    assert.equal((await json()).content[0].attrs.boxHeight, 190);
    await box.hover(); await box.locator('.container-resize').dblclick();
    const attrs = (await json()).content[0].attrs;
    assert.equal(attrs.boxWidth, null); assert.equal(attrs.boxHeight, null); assert.equal(attrs.boxAlign, 'justify');
    assert.ok(Math.abs((await box.boundingBox()).width - (await page.locator('.tiptap').boundingBox()).width) < 2);
    const resetWidth = (await box.boundingBox()).width;
    await dragEdge('.container-resize-right', -100, 0);
    assert.ok(Math.abs((await box.boundingBox()).width - (resetWidth - 100)) < 2);
    assert.equal((await json()).content[0].attrs.boxAlign, 'left');
    await command('undo');
    assert.ok(Math.abs((await box.boundingBox()).width - resetWidth) < 2);
    assert.equal(attrs.boxTitle, 'Tytuł');
    await command('undo');
    assert.equal((await json()).content[0].attrs.boxWidth, 480);
    assert.equal((await json()).content[0].attrs.boxHeight, 190);
  });
  await check('Table container double click edits title and footer and persists both formats', async () => {
    await open('table-captions'); await command('table'); await page.locator('#table-dialog button[value=insert]').click();
    const box = page.locator('[data-container-type=table]');
    await box.dblclick({ position: { x: 1, y: 10 } });
    await page.locator('#container-dialog [name=title]').fill('Wyniki pomiarów');
    await page.locator('#container-dialog [name=caption]').fill('Źródło: eksperyment');
    await page.locator('#container-dialog [name=width]').fill('500');
    await page.locator('#container-dialog button[value=save]').click();
    assert.equal(await box.locator('.container-title').textContent(), 'Wyniki pomiarów');
    await box.locator('.container-caption .label-editor').click();
    await box.locator('.container-caption .label-editor').fill('Nowa stopka');
    assert.equal(await box.locator('.container-caption').textContent(), 'Nowa stopka');
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    for (const format of ['json', 'md']) {
      await open('table-captions-' + format, format === 'md' ? saved.markdown : '', format === 'json' ? saved.documentJson : null);
      assert.equal(await box.locator('.container-title').textContent(), 'Wyniki pomiarów');
      assert.equal(await box.locator('.container-caption').textContent(), 'Nowa stopka');
    }
  });
  await check('Each edge resets only its own dimension and stays draggable', async () => {
    await open('individual-reset', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'paragraph', attrs: { boxWidth: 420, boxHeight: 180 }, content: [{ type: 'text', text: 'Kontener' }] }
    ] } }));
    const box = page.locator('.object-container').first();
    await box.locator('.container-resize-right').dblclick();
    assert.equal((await json()).content[0].attrs.boxWidth, null);
    assert.equal((await json()).content[0].attrs.boxHeight, 180);
    await command('undo');
    await box.locator('.container-resize-bottom').dblclick();
    assert.equal((await json()).content[0].attrs.boxWidth, 420);
    assert.equal((await json()).content[0].attrs.boxHeight, null);
    for (const [handle, pseudo, length] of [['.container-resize-right', '::before', 'height'], ['.container-resize-bottom', '::after', 'width']]) {
      await box.locator(handle).hover();
      const dimensions = await box.evaluate((el, { pseudo, length }) => ({ line: parseFloat(getComputedStyle(el, pseudo)[length]), box: el.getBoundingClientRect()[length] }), { pseudo, length });
      assert.ok(dimensions.line >= dimensions.box, 'Highlighted edge covers entire container');
    }
  });
  await check('Natural image and table labels use text toolbar, caret, shared undo and both storage formats', async () => {
    for (const [id, selector, attr] of [['image-test', '.image-title', 'titleRich'], ['table-captions', '.container-caption', 'boxCaptionRich']]) {
      await open(id);
      const field = page.locator(selector + ' .label-editor').first();
      await field.click(); await field.press('Control+Home'); await page.keyboard.type('A');
      assert.ok((await field.textContent()).startsWith('A'), 'Single-click field accepts caret editing');
      await field.press('Control+a');
      await command('font', 'Consolas'); await command('color', '#58B889'); await command('bold'); await command('highlight', '#F4D35E');
      for (const [action, alignment] of [['alignLeft', 'left'], ['alignCenter', 'center'], ['alignRight', 'right'], ['alignJustify', 'justify']]) {
        await command(action);
        assert.equal(await field.locator('p').evaluate(el => el.style.textAlign), alignment);
      }
      await command('undo'); assert.equal(await field.locator('p').evaluate(el => el.style.textAlign), 'right');
      await command('redo'); assert.equal(await field.locator('p').evaluate(el => el.style.textAlign), 'justify');
      assert.equal(await page.locator('.image-inline-editor,.container-label-input').count(), 0);
      const saved = await page.evaluate(() => window.notatnik.snapshot());
      assert.match(saved.documentJson, new RegExp(attr));
      for (const format of ['json', 'md']) {
        await open('rich-' + id + format, format === 'md' ? saved.markdown : '', format === 'json' ? saved.documentJson : null);
        assert.equal(await field.locator('p').evaluate(el => el.style.textAlign), 'justify');
        assert.match(await field.innerHTML(), /Consolas/); assert.match(await field.innerHTML(), /<strong>/);
        assert.match(await field.innerHTML(), /<mark/);
        await field.click(); await command('clearColor'); await command('clearHighlight');
      }
    }
  });
  await check('Bottom crop preserves width and scale; outside acceptance, restore and reopening preserve actual geometry', async () => {
    await open('bottom-crop', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'image', attrs: { src: await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 240; const x = c.getContext('2d'); x.fillStyle = '#59a'; x.fillRect(0, 0, 400, 120); x.fillStyle = '#f55'; x.fillRect(0, 120, 400, 120); return c.toDataURL(); }), width: 320 } },
      { type: 'paragraph', content: [{ type: 'text', text: 'Poza obrazem' }] }
    ] } }));
    const viewport = page.locator('.image-viewport'), image = viewport.locator('img');
    await image.evaluate(el => el.decode());
    const before = await viewport.boundingBox();
    await image.click({ button: 'right' }); await page.getByRole('menuitem', { name: 'Przytnij obraz…' }).click();
    const edge = page.locator('.cropper-line.line-s'); await edge.waitFor();
    const r = await edge.boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2 - 64, { steps: 8 }); await page.mouse.up();
    await page.getByText('Poza obrazem', { exact: true }).click();
    const after = await viewport.boundingBox(), crop = (await json()).content[0].attrs.crop;
    assert.ok(crop.height < crop.originalHeight);
    assert.ok(Math.abs(after.width - before.width) < 1, 'Cropping must not shrink the image width');
    assert.ok(Math.abs(after.height - after.width * crop.height / crop.width) < 1, 'Viewport is exactly the selected crop');
    assert.ok(Math.abs((await image.boundingBox()).height - before.height) < 1, 'Source pixels keep their scale');
    assert.ok(after.height < before.height - 30);
    await page.screenshot({ path: '../../../outputs/engines-check/bottom-crop.png' });
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    await command('undo'); assert.ok(Math.abs((await viewport.boundingBox()).height - before.height) < 1);
    await command('redo');
    for (const format of ['json', 'md']) {
      await open('bottom-crop-' + format, format === 'md' ? saved.markdown : '', format === 'json' ? saved.documentJson : null);
      await image.evaluate(el => el.decode());
      assert.ok(Math.abs((await viewport.boundingBox()).height - after.height) < 1);
      assert.ok(Math.abs((await viewport.boundingBox()).width - before.width) < 1);
    }
  });
  await check('Container background is optional, undoable and retained in JSON and Markdown; hover controls fade in', async () => {
    await open('backgrounds', '', JSON.stringify({ version: 1, doc: { type: 'doc', attrs: { layout: 'article' }, content: [
      { type: 'blockMath', attrs: { latex: 'a=b', numbered: true } },
      { type: 'paragraph', content: [{ type: 'text', text: 'Tekst' }] }
    ] } }));
    assert.equal(await page.locator('.block-drag-handle').count(), 0);
    const box = page.locator('[data-container-type=blockMath]');
    assert.equal(await box.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    assert.equal(await box.locator('[data-type=block-math]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    await box.hover();
    const frames = await box.locator('.container-tools').evaluate(el => el.getAnimations()[0]?.effect.getKeyframes().map(f => f.opacity));
    assert.deepEqual(frames, ['0.5', '1']);
    await box.locator('.container-tools button').click();
    assert.equal(await page.locator('[name=noBackground]').isChecked(), true);
    await page.locator('[name=background]').fill('#354657');
    assert.equal(await page.locator('[name=noBackground]').isChecked(), false);
    await page.locator('#container-dialog button[value=save]').click();
    assert.equal(await box.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(53, 70, 87)');
    await command('undo'); assert.equal((await json()).content[0].attrs.boxBackground, null);
    await command('redo'); assert.equal((await json()).content[0].attrs.boxBackground, '#354657');
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    for (const format of ['json', 'md']) {
      await open('backgrounds-' + format, format === 'md' ? saved.markdown : '', format === 'json' ? saved.documentJson : null);
      assert.equal(await box.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(53, 70, 87)');
      await box.hover(); await box.locator('.container-tools button').click();
      await page.locator('[name=noBackground]').check(); await page.locator('#container-dialog button[value=save]').click();
      assert.equal(await box.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await box.hover();
    assert.equal(await box.locator('.container-tools').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });
  await open('demo', '# Notatnik 🦊\n\n**Tiptap** — tekst, listy i formatowanie.\n\n1. Pierwszy punkt\n2. Drugi punkt');
  await command('cell'); await page.locator('.cm-content').click(); await page.keyboard.type('def greeting(name):\n    return f"Hello, {name}!"');
  await mkdir('../../../outputs/engines-check', { recursive: true });
  await page.screenshot({ path: '../../../outputs/engines-check/editor.png' });
  console.log(`PASS ${passed} browser integration scenarios`);
} finally { await browser.close(); }
