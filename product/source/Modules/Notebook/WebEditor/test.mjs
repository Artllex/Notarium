import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
const temporaryReports = !process.env.NOTARIUM_TEST_OUTPUT;
const reportDirectory = process.env.NOTARIUM_TEST_OUTPUT || await mkdtemp(join(tmpdir(), 'Notarium-editor-tests-'));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
const errors = [];
page.on('pageerror', error => { errors.push(error.message); console.error('PAGEERROR ' + error.message); });
await page.addInitScript(() => { window.bridgeMessages = []; window.chrome ||= {}; window.chrome.webview = { postMessage: message => window.bridgeMessages.push(message), addEventListener() {} }; });
await page.goto(pathToFileURL(resolve('dist/index.html')).href);
await page.waitForFunction(() => window.notatnik);
await mkdir(reportDirectory, { recursive: true });
let passed = 0;
const open = (id, markdown = '', documentJson = null) => page.evaluate(message => window.notatnik.receive(message), { type: 'open', noteId: id, markdown, documentJson });
const command = (action, value) => page.evaluate(message => window.notatnik.receive(message), { type: 'command', action, value });
const json = () => page.evaluate(() => window.notatnik.editor.getJSON());
async function revealTypeTools(container) {
  const box = await container.boundingBox();
  await page.mouse.move(box.x + Math.min(12, box.width / 2), box.y + box.height / 2);
  await page.mouse.move(box.x - 6, box.y + box.height / 2);
  await container.locator(':scope > .container-type-tools').waitFor({ state: 'visible' });
}
async function chooseMathLayout(value) {
  const label = await page.locator('#math-layout').evaluate((select, choice) => [...select.options].find(option => option.value === choice).textContent, value);
  await page.locator('#math-dialog .ui-choice').click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}
async function check(name, run) { await run(); assert.deepEqual(errors, []); const bridgeErrors = await page.evaluate(() => window.bridgeMessages.filter(m => m.type === 'error')); assert.deepEqual(bridgeErrors, []); console.log(`PASS ${name}`); passed++; }
try {
  await check('Type panel appears only after crossing the container left edge', async () => {
    await open('left-edge-panel', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Panel trigger' }] }
    ] } }));
    const container = page.locator('.object-container').first();
    await container.hover();
    const panel = container.locator(':scope > .container-type-tools');
    assert.equal(await panel.isVisible(), false);
    await revealTypeTools(container);
    assert.equal(await panel.isVisible(), true);
    await container.hover();
    assert.equal(await panel.isVisible(), false);
    const box = await container.boundingBox();
    await page.mouse.move(0, 0);
    await page.mouse.move(box.x - 6, box.y + box.height / 2);
    assert.equal(await panel.isVisible(), false);
    await revealTypeTools(container);
    await page.mouse.move(0, 0);
    assert.equal(await panel.isVisible(), false);
  });
  await check('Open Type panel stays above neighboring container text so backdrop blur applies', async () => {
    await open('left-panel-stacking', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'layoutRow', content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Tekst pod panelem, który ma być rozmyty i nadal można go rozpoznać pod półprzezroczystą kartą' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Drugi kontener' }] }
      ] }
    ] } }));
    await page.locator('.layout-row > .object-container').first().locator('p').evaluate(el => { el.style.whiteSpace = 'nowrap'; });
    const right = page.locator('.layout-row > .object-container').last();
    await revealTypeTools(right);
    const panel = right.locator(':scope > .container-type-tools');
    assert.equal(await right.evaluate(el => getComputedStyle(el).zIndex), '40');
    assert.equal(await panel.evaluate(el => getComputedStyle(el).backdropFilter), 'blur(1px)');
    const bounds = await panel.boundingBox();
    const topElement = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.container-type-tools')?.className,
      { x: bounds.x + 8, y: bounds.y + bounds.height / 2 });
    assert.equal(topElement, 'container-type-tools');
    if (process.env.NOTARIUM_TEST_OUTPUT) await page.screenshot({ path: resolve(reportDirectory, 'left-panel-blur.png') });
  });
  await check('Empty has no visible label, Ctrl close control, and a translucent selected fill', async () => {
    await open('empty-panel', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [{ type: 'paragraph', attrs: { boxEmpty: true } }] } }));
    const empty = page.locator('.container-empty');
    await empty.hover();
    assert.equal(await page.evaluate(() => window.bridgeMessages.filter(message => message.type === 'containerHover').at(-1)?.label), 'Empty');
    assert.equal(await empty.locator('.container-type-tools .container-tools > button:not([hidden])').count(), 1);
    const centers = await empty.evaluate(el => {
      const a = el.getBoundingClientRect(), b = el.querySelector('.container-type-tools').getBoundingClientRect();
      return [a.left + a.width / 2, b.left + b.width / 2];
    });
    assert.ok(Math.abs(centers[0] - centers[1]) < 1);
    assert.equal(await empty.locator('.container-type-tools').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    assert.equal(await empty.locator('.container-type-tools').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
    assert.equal(await empty.locator('.container-type-label').isVisible(), false);
    const middle = await empty.boundingBox();
    await page.mouse.click(middle.x + middle.width / 2, middle.y + middle.height / 2);
    assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), false);
    await page.mouse.dblclick(middle.x + middle.width / 2, middle.y + middle.height / 2);
    assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), true);
    await page.waitForTimeout(250);
    assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), true);
    await page.mouse.click(middle.x + middle.width / 2, middle.y + middle.height / 2);
    assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), true);
    assert.equal(await empty.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(130, 184, 248, 0.18)');
    assert.match(await empty.evaluate(el => getComputedStyle(el).boxShadow), /rgba\(130, 184, 248, 0\.18\) 0px 0px 0px 4px/);
    for (const side of ['left', 'right']) {
      await open(`empty-panel-${side}`, '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [{ type: 'paragraph', attrs: { boxEmpty: true } }] } }));
      const box = await empty.boundingBox();
      await page.mouse.click(side === 'left' ? box.x + 12 : box.x + box.width - 12, box.y + box.height / 2);
      assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), false);
      await page.mouse.dblclick(side === 'left' ? box.x + 12 : box.x + box.width - 12, box.y + box.height / 2);
      assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), true);
      await page.waitForTimeout(250);
      assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), true);
    }
  });
  await check('Entire Empty surface ignores single click and lifts, moves, and drops on drag', async () => {
    const content = [{ type: 'paragraph', attrs: { boxEmpty: true, boxHeight: 90 } },
      { type: 'paragraph', content: [{ type: 'text', text: 'Target' }] }];
    await open('empty-surface-drag', '', JSON.stringify({ version: 1, doc: { type: 'doc', content } }));
    const empty = page.locator('.container-empty'), target = page.locator('.object-container').last();
    const box = await empty.boundingBox();
    for (const [x, y] of [[.15, .25], [.5, .5], [.85, .75]]) {
      await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
      assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), false);
    }
    const targetBox = await target.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height + 12, { steps: 8 });
    assert.equal(await empty.evaluate(el => el.classList.contains('container-lifted')), true);
    await page.mouse.up();
    assert.equal((await json()).content[0].content[0].text, 'Target');
    assert.equal((await json()).content[1].attrs.boxEmpty, true);
    await command('undo');
    assert.equal((await json()).content[0].attrs.boxEmpty, true);
  });
  await check('Empty between neighboring containers keeps double-click selection after a caret click', async () => {
    await open('empty-middle-doubleclick', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'layoutRow', content: [
        { type: 'paragraph', attrs: { boxWidth: 160 }, content: [{ type: 'text', text: 'Left' }] },
        { type: 'paragraph', attrs: { boxWidth: 300, boxEmpty: true, boxHeight: 100 } },
        { type: 'paragraph', attrs: { boxWidth: 160 }, content: [{ type: 'text', text: 'Right' }] }
      ] }
    ] } }));
    const empty = page.locator('.layout-row > .container-empty');
    const box = await empty.boundingBox(), x = box.x + 30, y = box.y + box.height / 2;
    await page.mouse.click(x, y);
    assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), false);
    assert.equal(await page.evaluate(() => window.notatnik.editor.state.selection.$from.parent.type.name), 'paragraph');
    await page.mouse.dblclick(x, y);
    assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), true);
    await page.waitForTimeout(250);
    assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), true);
    await page.mouse.click(x, y);
    assert.equal(await empty.evaluate(el => el.classList.contains('container-selected')), true);
  });
  await check('Double click below a row does not select the whole row and automatic trailing text is Empty', async () => {
    await open('rows-and-empty', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'layoutRow', content: ['A', 'X', 'B'].map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })) },
      { type: 'layoutRow', content: ['C', 'D'].map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })) },
      { type: 'paragraph' }
    ] } }));
    assert.equal((await json()).content[2].attrs.boxEmpty, true);
    assert.equal(await page.locator('.tiptap > .container-empty').count(), 1);
    const rows = await page.locator('.layout-row').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect(); return { left: rect.left, top: rect.top, bottom: rect.bottom };
    }));
    await page.mouse.dblclick(rows[0].left + 80, (rows[0].bottom + rows[1].top) / 2);
    assert.equal(await page.locator('.layout-row.ProseMirror-selectednode').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('container-boundary-focus')), true);
    await open('explicit-text-after-row', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'layoutRow', content: ['A', 'B'].map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })) },
      { type: 'paragraph', attrs: { boxTextExplicit: true } }
    ] } }));
    assert.equal(await page.locator('.tiptap > .container-empty').count(), 0);
    await open('row-only', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'layoutRow', content: ['A', 'B'].map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })) }
    ] } }));
    await page.evaluate(() => {
      const editor = window.notatnik.editor;
      editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph' });
    });
    assert.equal((await json()).content[1].attrs.boxEmpty, true);
  });
  await check('Clicking between containers focuses an insertion point instead of the previous text', async () => {
    await open('click-between', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'layoutRow', content: [
        { type: 'paragraph', attrs: { boxWidth: 260 }, content: [{ type: 'text', text: 'Lewy' }] },
        { type: 'paragraph', attrs: { boxWidth: 180, boxEmpty: true } },
        { type: 'paragraph', attrs: { boxWidth: 260 }, content: [{ type: 'text', text: 'Prawy' }] }
      ] }
    ] } }));
    const empty = page.locator('.layout-row > .container-empty');
    const leftBox = await page.locator('.layout-row > .object-container').first().boundingBox();
    const emptyBox = await empty.boundingBox();
    await page.mouse.click((leftBox.x + leftBox.width + emptyBox.x) / 2, emptyBox.y + 18);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('container-boundary-focus')), true);
    assert.equal(await page.locator('.container-selected').count(), 0);
    assert.equal(await page.evaluate(() => getComputedStyle(document.elementFromPoint(...(() => { const r = document.querySelector('.container-empty').getBoundingClientRect(); return [r.left + 90, r.top + 18]; })())).cursor), 'grab');
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.setData('application/x-notarium-container+json', JSON.stringify({ type: 'paragraph', attrs: { boxWidth: 90 }, content: [{ type: 'text', text: 'Wklejony' }] }));
      document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
    });
    assert.equal(await page.locator('.layout-row > .object-container').count(), 4);
    assert.equal(await page.locator('.layout-row > .object-container').nth(1).textContent(), 'Wklejony');
    await open('click-plain-gap', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'layoutRow', content: [
        { type: 'paragraph', attrs: { boxWidth: 260 }, content: [{ type: 'text', text: 'Lewy' }] },
        { type: 'paragraph', attrs: { boxWidth: 260, boxOffsetX: 90 }, content: [{ type: 'text', text: 'Prawy' }] }
      ] }
    ] } }));
    const boxes = await page.locator('.layout-row > .object-container').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top };
    }));
    await page.mouse.click(boxes[0].right + 32, boxes[0].top + 20);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('container-boundary-focus')), true);
    assert.equal(await page.locator('.container-selected').count(), 0);
  });
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
  await check('Enter stays in a container; Ctrl+Enter creates a sibling; Shift+Tab moves forward', async () => {
    await open('typing'); await page.locator('.tiptap').click();
    await page.keyboard.type('# Heading'); await page.keyboard.press('Control+Enter');
    await page.keyboard.type('1. first'); await page.keyboard.press('Enter'); await page.keyboard.type('second');
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('ol li').count(), 1);
    assert.match(JSON.stringify(await json()), /hardBreak/);
    await page.keyboard.press('Control+Enter'); await page.keyboard.type('third');
    assert.equal((await json()).content.filter(node => node.content?.length).length, 3);
    await page.evaluate(() => window.notatnik.editor.commands.setTextSelection(1));
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => window.notatnik.editor.state.selection.$from.parent.textContent), 'firstsecond');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => window.notatnik.editor.state.selection.$from.parent.textContent), 'third');
  });
  await check('Container shortcuts preserve nesting, code newlines and undo', async () => {
    await open('keyboard-nested'); await command('container');
    await page.keyboard.type('alpha'); await page.keyboard.press('Enter'); await page.keyboard.type('beta');
    assert.equal((await json()).content.find(n => n.type === 'blockGroup').content.length, 1);
    await page.keyboard.press('Control+Enter');
    assert.equal((await json()).content.find(n => n.type === 'blockGroup').content.length, 2);
    await page.keyboard.press('Control+z');
    assert.equal((await json()).content.find(n => n.type === 'blockGroup').content.length, 1);
    await command('cell');
    await page.locator('.cm-content').click(); await page.keyboard.type('x'); await page.keyboard.press('Enter'); await page.keyboard.type('y');
    assert.equal(await page.locator('.code-cell').evaluate(el => el.codeMirror.state.doc.toString()), 'x\ny');
    await page.keyboard.press('Control+Enter'); await page.keyboard.type('after code');
    assert.match((await json()).content.find(n => n.type === 'blockGroup').content.map(n => JSON.stringify(n)).join(''), /after code/);
    await page.locator('.cm-content').click(); await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => window.notatnik.editor.state.selection.$from.parent.textContent), 'after code');
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
    assert.equal(await page.locator('.code-cell .cm-gutters').evaluate(element => getComputedStyle(element).display), 'none');
    await command('undo'); assert.equal(await page.locator('.code-cell').count(), 0);
    await command('redo'); assert.equal(await page.locator('.code-cell').count(), 1);
    await page.locator('.cm-content').click(); await page.keyboard.type('print(42)');
    assert.notEqual(await page.locator('.code-cell .cm-gutters').evaluate(element => getComputedStyle(element).display), 'none');
    assert.match(JSON.stringify(await json()), /print\(42\)/);
    await page.keyboard.press('Control+z'); assert.doesNotMatch(JSON.stringify(await json()), /print\(42\)/);
    assert.equal(await page.locator('.code-cell .cm-gutters').evaluate(element => getComputedStyle(element).display), 'none');
    await page.keyboard.press('Control+y'); assert.match(JSON.stringify(await json()), /print\(42\)/);
    await revealTypeTools(page.locator('.code-cell').locator('..'));
    await page.keyboard.down('Control');
    await page.getByRole('button', { name: 'Usuń kontener', exact: true }).click();
    await page.keyboard.up('Control');
    assert.equal(await page.locator('.code-cell').count(), 0);
    await command('undo'); assert.match(await page.locator('.cm-content').textContent(), /print\(42\)/);
  });
  await check('Container border selects immediately and supports repeated copy, paste and delete', async () => {
    await open('container-clipboard', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'paragraph', attrs: { boxWidth: 360, boxTitle: 'Kopia' }, content: [{ type: 'text', text: 'Treść kontenera' }] }
    ] } }));
    const original = page.locator('[data-container-type=paragraph]').first();
    const topEdge = original.locator(':scope > .container-select-top');
    assert.equal(await topEdge.evaluate(element => getComputedStyle(element).cursor), 'pointer');
    assert.ok((await topEdge.boundingBox()).height >= 10);
    const edge = await topEdge.boundingBox();
    const hitClass = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className || '', { x: edge.x + edge.width / 2, y: edge.y + edge.height / 2 });
    assert.match(hitClass, /container-select-top/);
    await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2); await page.mouse.down();
    await page.mouse.up();
    assert.equal(await page.evaluate(() => window.notatnik.editor.state.selection.toJSON().type), 'node');
    assert.equal(await original.evaluate(element => element.classList.contains('container-selected')), true);
    await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v'); await page.keyboard.press('Control+v');
    assert.equal(await page.locator('[data-container-type=paragraph]').count(), 3);
    const copied = await json();
    assert.equal(copied.content[2].attrs.boxTitle, 'Kopia'); assert.equal(copied.content[2].attrs.boxWidth, 360);
    await page.keyboard.press('Delete');
    assert.equal(await page.locator('[data-container-type=paragraph]').count(), 2);
  });
  await check('Side edges anchor independently and the middle divider resizes both neighbors', async () => {
    await open('anchored-row-resize', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'layoutRow', content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Lewy' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Prawy' }] }
      ] }
    ] } }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const items = page.locator('.layout-row > .object-container'), left = items.filter({ hasText: 'Lewy' }), right = items.filter({ hasText: 'Prawy' });
    const initialLeft = await left.boundingBox(), initialRight = await right.boundingBox();
    let handle = await left.locator(':scope > .container-resize-right').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 - 70, handle.y + handle.height / 2, { steps: 4 }); await page.mouse.up();
    const afterRightEdgeLeft = await left.boundingBox(), afterRightEdgeRight = await right.boundingBox();
    assert.ok(Math.abs(afterRightEdgeLeft.x - initialLeft.x) <= 1, 'Right edge keeps the left side anchored');
    assert.ok(afterRightEdgeLeft.width < initialLeft.width - 60);
    assert.ok(Math.abs(afterRightEdgeRight.width - initialRight.width) <= 1, 'Neighbor does not grow into released space');
    assert.equal(await page.locator('.layout-row > .container-empty').count(), 1, 'Released space becomes one Empty container');
    handle = await right.locator(':scope > .container-resize-left').boundingBox();
    const beforeLeftEdge = await right.boundingBox(), stableLeftWidth = (await left.boundingBox()).width;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 50, handle.y + handle.height / 2, { steps: 4 }); await page.mouse.up();
    const afterLeftEdge = await right.boundingBox();
    assert.ok(Math.abs(afterLeftEdge.x + afterLeftEdge.width - (beforeLeftEdge.x + beforeLeftEdge.width)) <= 1, 'Left edge keeps the right side anchored');
    assert.ok(Math.abs((await left.boundingBox()).width - stableLeftWidth) <= 1, 'Left neighbor remains unchanged');
    assert.equal(await page.locator('.layout-row > .container-empty').count(), 1, 'Resizing beside Empty expands it instead of duplicating it');
    const divider = left.locator(':scope > .container-pair-resize');
    assert.equal(await divider.evaluate(element => getComputedStyle(element).display), 'block');
    const empty = page.locator('.layout-row > .container-empty'), dividerBox = await divider.boundingBox();
    const beforePairLeft = await left.boundingBox(), beforePairEmpty = await empty.boundingBox(), beforePairRight = await right.boundingBox();
    await page.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + dividerBox.height / 2); await page.mouse.down();
    await page.mouse.move(dividerBox.x + dividerBox.width / 2 + 30, dividerBox.y + dividerBox.height / 2, { steps: 4 }); await page.mouse.up();
    const afterPairLeft = await left.boundingBox(), afterPairEmpty = await empty.boundingBox(), afterPairRight = await right.boundingBox();
    assert.ok(afterPairLeft.width > beforePairLeft.width + 20 && afterPairEmpty.width < beforePairEmpty.width - 20);
    assert.ok(Math.abs(afterPairLeft.x - beforePairLeft.x) <= 1);
    assert.ok(Math.abs(afterPairRight.x - beforePairRight.x) <= 1 && Math.abs(afterPairRight.width - beforePairRight.width) <= 1);
  });
  await check('Code containers resize together with their code surface', async () => {
    await open('code-dimensions', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'codeCell', attrs: { boxHeight: 210, language: 'python' }, content: [{ type: 'text', text: 'print(1)' }] },
      { type: 'codeBlock', attrs: { boxHeight: 180 }, content: [{ type: 'text', text: 'print(2)' }] }
    ] } }));
    for (const selector of ['codeCell', 'codeBlock']) {
      const outer = page.locator(`[data-container-type=${selector}]`).first();
      const inner = outer.locator('.code-cell');
      assert.ok(Math.abs((await outer.boundingBox()).height - (await inner.boundingBox()).height) <= 2);
    }
    const outer = page.locator('[data-container-type=codeCell]').first();
    const edge = await outer.locator('.container-resize-bottom').boundingBox();
    await page.mouse.move(edge.x + edge.width * .85, edge.y + edge.height / 2); await page.mouse.down();
    await page.mouse.move(edge.x + edge.width * .85, edge.y + 70);
    assert.ok((await outer.locator('.code-cell').boundingBox()).height > 210);
    await page.mouse.up();
    assert.ok((await outer.locator('.code-cell').boundingBox()).height > 210);
    const block = page.locator('[data-container-type=codeBlock]').first();
    const emptyLanguage = block.locator('.language');
    assert.equal(await emptyLanguage.textContent(), '...');
    assert.equal(await emptyLanguage.evaluate(element => getComputedStyle(element, ':after').content), 'none');
    await page.mouse.move(0, 0);
    assert.equal(await emptyLanguage.evaluate(element => getComputedStyle(element).visibility), 'hidden');
    assert.equal(await block.locator(':scope > .container-type-tools .container-tools [aria-label="Usuń kontener"]').count(), 1);
    assert.equal(await page.locator('.container-add-tools [aria-label^="Przenieś kontener"]').count(), 0);
    assert.equal(await block.locator('.cm-gutters').count(), 0);
    assert.equal(await block.getByRole('button', { name: 'Wykonywanie kodu nie jest jeszcze dostępne' }).count(), 0);
    await block.hover();
    const blockBefore = (await block.boundingBox()).height, blockEdge = await block.locator('.container-resize-bottom').boundingBox();
    const blockX = blockEdge.x + blockEdge.width * .15, blockY = blockEdge.y + blockEdge.height / 2;
    await page.mouse.move(blockX, blockY); await page.mouse.down(); await page.mouse.move(blockX, blockY + 60, { steps: 4 });
    assert.ok((await block.locator('.code-cell').boundingBox()).height > blockBefore, 'Code Block resizes live through the shared surface');
    await page.mouse.up();
    await block.hover(); await emptyLanguage.click();
    const blockLanguage = block.getByRole('combobox', { name: 'Język komórki' });
    await blockLanguage.fill('Python'); await blockLanguage.press('Enter');
    assert.equal(await page.locator('[data-container-type=codeBlock]').count(), 0);
    assert.equal(await page.locator('[data-container-type=codeCell]').count(), 2);
    assert.equal(await page.locator('button[aria-label="Wykonywanie kodu nie jest jeszcze dostępne"]').count(), 2);
    const play = page.locator('[data-container-type=codeCell]').first().locator('button[aria-label="Wykonywanie kodu nie jest jeszcze dostępne"]');
    const picker = page.locator('[data-container-type=codeCell]').first().locator('.language');
    assert.ok((await play.boundingBox()).x < (await picker.boundingBox()).x, 'Play is left of the language picker');
    const converted = page.locator('[data-container-type=codeCell]').nth(1);
    await converted.hover(); await converted.locator('.language').click();
    const convertedLanguage = converted.getByRole('combobox', { name: 'Język komórki' });
    await convertedLanguage.fill(''); await convertedLanguage.press('Enter');
    assert.equal(await page.locator('[data-container-type=codeBlock]').count(), 1);
    assert.equal(await page.locator('[data-container-type=codeBlock] .language').textContent(), '...');
    const restoredBlock = page.locator('[data-container-type=codeBlock]');
    await restoredBlock.hover(); await restoredBlock.locator(':scope > .container-add-tools [data-action=blockMath]').click();
    assert.equal(await page.locator('[data-container-type=blockMath]').count(), 1);
  });
  await check('Cell language picker supports SQL and R, syntax highlighting, undo and persistence', async () => {
    await open('language-picker'); await command('cell');
    const label = page.locator('.cell-tools .language'), input = page.getByRole('combobox', { name: 'Język komórki' });
    await page.locator('.code-cell').first().hover(); await label.click(); await input.fill('SQL'); await input.press('Enter');
    assert.equal(await label.textContent(), 'SQL');
    await page.locator('.cm-content').click(); await page.keyboard.type('SELECT * FROM users WHERE id = 1;');
    await page.waitForFunction(() => document.querySelector('.cm-line span')?.textContent === 'SELECT');
    await page.locator('.code-cell').first().hover(); await label.click(); await input.fill('R'); await input.press('Enter');
    assert.equal(await label.textContent(), 'R');
    await command('undo'); assert.equal(await label.textContent(), 'SQL');
    await command('redo'); assert.equal(await label.textContent(), 'R');
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    assert.match(saved.markdown, /cell:r/);
    await open('language-json', '', saved.documentJson); assert.equal(await label.textContent(), 'R');
    await open('language-md', saved.markdown); assert.equal(await label.textContent(), 'R');
    assert.match(await page.locator('.cm-content').textContent(), /SELECT/);
    await page.locator('.code-cell').first().hover(); await label.click(); await input.fill('Unknown language'); await input.press('Enter');
    assert.equal(await input.isVisible(), true); await input.press('Escape');
    assert.equal(await label.textContent(), 'R');
    await page.locator('.code-cell').first().hover(); await label.click(); await input.fill('C++'); await input.press('Enter');
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
    await command('math'); await chooseMathLayout('blockMath');
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
    await page.screenshot({ path: resolve(reportDirectory, 'images.png') });
  });
  await check('Automatic equation numbering survives edit, delete, undo and both storage formats', async () => {
    await open('numbered-math');
    for (const latex of ['a=1', 'b=2', 'c=3']) {
      await page.evaluate(() => window.notatnik.editor.commands.focus('end'));
      await command('math'); await chooseMathLayout('blockMath');
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
    await page.screenshot({ path: resolve(reportDirectory, 'inline-crop.png') });
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.inline-crop').count(), 0);
    await page.locator('.tiptap p').last().click({ position: { x: 12, y: 8 } });
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
      await page.locator('.tiptap p').last().click({ position: { x: 12, y: 8 } });
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
    assert.equal(await figure.getAttribute('draggable'), 'false');
    assert.equal(await page.locator('#image-placement').count(), 0);
    await command('alignRight');
    assert.equal(await page.locator('[data-container-type=image]').getAttribute('data-align'), 'right');
    await figure.click();
    const imageBox = await page.locator('[data-container-type=image]').boundingBox();
    await page.mouse.move(imageBox.x + 5, imageBox.y + imageBox.height - 5);
    const handle = page.locator('[data-container-type=image]>.container-resize-bottom-left'), box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2); await page.mouse.up();
    assert.equal(await figure.locator('img').evaluate(img => img.width), 260);
    await command('undo'); assert.equal(await figure.locator('img').evaluate(img => img.width), 200);
    await page.locator('.tiptap p').last().click({ position: { x: 12, y: 8 } }); await page.keyboard.type('Cel przeniesienia');
    const beforeMove = await page.evaluate(() => window.notatnik.editor.getJSON().content.map(node => node.type));
    const target = page.locator('.tiptap p').last(), targetBox = await target.boundingBox();
    const sourceBox = await figure.boundingBox();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + 300, targetBox.y + Math.max(1, targetBox.height - 1), { steps: 8 });
    await page.mouse.up();
    const afterMove = await page.evaluate(() => window.notatnik.editor.getJSON().content.map(node => node.type));
    assert.notDeepEqual(afterMove, beforeMove);
    await command('undo');
    assert.deepEqual(await page.evaluate(() => window.notatnik.editor.getJSON().content.map(node => node.type)), beforeMove);
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    await open('image-controls-reopen', '', saved.documentJson);
    assert.equal(await page.locator('[data-container-type=image]').getAttribute('data-align'), 'right');
  });
  await check('Block equations use shared container movement', async () => {
    await open('math-drag', '', JSON.stringify({ version: 1, doc: { type: 'doc', content:
      ['x=1', 'y=2'].map(latex => ({ type: 'blockMath', attrs: { latex, numbered: false } })) } }));
    const formulas = page.locator('[data-type="block-math"]');
    assert.equal(await formulas.count(), 2);
    assert.deepEqual(await formulas.evaluateAll(nodes => nodes.map(node => node.draggable)), [false, false]);
    const before = await page.evaluate(() => window.notatnik.editor.getJSON().content.filter(node => node.type === 'blockMath').map(node => node.attrs.latex));
    const destination = await formulas.nth(1).boundingBox();
    const source = await formulas.first().boundingBox();
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
    await page.mouse.move(destination.x + Math.min(10, destination.width / 2), destination.y + destination.height - 1, { steps: 8 }); await page.mouse.up();
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
    const mathBox = await page.locator('[data-type="block-math"]').boundingBox();
    const cellBox = await page.locator('.code-cell').last().boundingBox();
    await page.mouse.move(mathBox.x + mathBox.width / 2, mathBox.y + mathBox.height / 2); await page.mouse.down();
    await page.mouse.move(cellBox.x + 100, cellBox.y + 40, { steps: 8 }); await page.mouse.up();
    const moved = await json();
    assert.notDeepEqual(moved, original);
    const descendants = node => [node, ...(node.content || []).flatMap(descendants)];
    assert.deepEqual(descendants(moved).filter(n => n.type === 'codeCell'), descendants(original).filter(n => n.type === 'codeCell'));
    await command('undo'); assert.deepEqual(await json(), original);
    await command('redo'); assert.deepEqual(await json(), moved);
    const cell = await page.locator('.code-cell').last().boundingBox();
    const first = await page.locator('.tiptap > .object-container > p').first().boundingBox();
    await page.mouse.move(cell.x + 2, cell.y + 45); await page.mouse.down();
    await page.mouse.move(first.x + 40, first.y + 1, { steps: 8 });
    assert.equal(await page.locator('.block-drop-marker').isVisible(), true);
    await page.mouse.up(); assert.equal((await json()).content[0].content[0].text, 'print(2)');
    await command('undo'); assert.deepEqual(await json(), moved);
    await revealTypeTools(page.locator('.tiptap > .object-container').first());
    const grip = await page.locator('[data-container-type=paragraph] .container-type-label').first().boundingBox();
    const last = await page.locator('.tiptap > .object-container > p').last().boundingBox();
    await page.mouse.move(grip.x + 12, grip.y + 12); await page.mouse.down();
    await page.mouse.move(last.x + last.width / 2, last.y + last.height - 1, { steps: 8 }); await page.mouse.up();
    const reorderedText = descendants(await json()).filter(node => node.type === 'paragraph').map(node => node.content?.[0]?.text);
    assert.ok(reorderedText.indexOf('First paragraph') > reorderedText.indexOf('Last paragraph'));
    await command('undo'); assert.deepEqual(await json(), moved);
    await revealTypeTools(page.locator('.tiptap > .object-container[data-container-type=bulletList]'));
    const listGrip = await page.locator('[data-container-type=bulletList] .container-type-label').boundingBox();
    await page.mouse.move(listGrip.x + 12, listGrip.y + 12); await page.mouse.down();
    await page.mouse.move(first.x + 40, first.y + 1, { steps: 8 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await json(), moved);
    await revealTypeTools(page.locator('.tiptap > .object-container[data-container-type=bulletList]'));
    const listHandle = await page.locator('[data-container-type=bulletList] .container-type-label').boundingBox();
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
    await revealTypeTools(page.locator('[data-container-type=table]'));
    const tableHandle = await page.locator('[data-container-type=table] .container-type-label').boundingBox();
    const aboveTable = await page.locator('.tiptap > .object-container > p').first().boundingBox();
    await page.mouse.move(tableHandle.x + 12, tableHandle.y + 12); await page.mouse.down();
    await page.mouse.move(aboveTable.x + 30, aboveTable.y + 1, { steps: 8 }); await page.mouse.up();
    assert.equal((await json()).content[0].type, 'table');
    await command('undo'); assert.deepEqual(await json(), originalTableDocument);
    await page.screenshot({ path: resolve(reportDirectory, 'table.png') });
  });
  await check('Containers drag into columns, resize, persist and leave columns with undo', async () => {
    const doc = { type: 'doc', content: ['A', 'B', 'C'].map(text => ({ type: 'paragraph', attrs: { boxHeight: 120 }, content: [{ type: 'text', text }] })) };
    await open('columns', '', JSON.stringify({ version: 1, doc }));
    const original = await json();
    const boxes = page.locator('.object-container');
    await revealTypeTools(boxes.first());
    const grip = await boxes.first().locator('.container-type-label').boundingBox(), target = await boxes.nth(1).boundingBox();
    await page.mouse.move(grip.x + 12, grip.y + 12); await page.mouse.down();
    await page.mouse.move(target.x + target.width - 3, target.y + 55, { steps: 8 });
    assert.equal(await boxes.first().evaluate(el => getComputedStyle(el, '::before').backdropFilter), 'blur(2px)');
    assert.equal(await boxes.first().evaluate(el => getComputedStyle(el, '::before').backgroundColor), 'rgba(30, 30, 30, 0.72)');
    if (process.env.NOTARIUM_TEST_OUTPUT) await page.screenshot({ path: resolve(reportDirectory, 'dragged-container-blur.png') });
    await page.mouse.up();
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
    await revealTypeTools(rowBoxes.last());
    const source = await rowBoxes.last().locator('.container-type-label').boundingBox(), below = await boxes.last().boundingBox();
    await page.mouse.move(source.x + 12, source.y + 12); await page.mouse.down();
    await page.mouse.move(below.x + 200, below.y + below.height, { steps: 8 }); await page.mouse.up();
    assert.equal(await page.locator('.layout-row').count(), 0);
    assert.equal((await json()).content.at(-1).content[0].text, 'A');
    await boxes.first().hover();
    const firstBox = await boxes.first().boundingBox();
    await page.mouse.move(firstBox.x + firstBox.width - 5, firstBox.y + firstBox.height - 5);
    const resize = await boxes.first().locator('.container-resize-bottom-right').boundingBox();
    await page.mouse.move(resize.x + 5, resize.y + 5); await page.mouse.down();
    await page.mouse.move(resize.x - 100, resize.y + 50); await page.mouse.up();
    assert.ok((await json()).content[0].attrs.boxHeight > 120);
    await command('undo'); assert.equal((await json()).content[0].attrs.boxHeight, 120);
    await page.screenshot({ path: resolve(reportDirectory, 'containers.png') });
  });
  await check('Lifted text container blurs the text it crosses while dragging', async () => {
    await open('drag-blur-overlap', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Moc i energia opisują dwa różne aspekty tego samego procesu. To jest tekst pod przeciąganą kartą.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Zobaczyć cały proces' }] }
    ] } }));
    const source = page.locator('.tiptap > .object-container').last();
    const beneath = page.locator('.tiptap > .object-container').first();
    await revealTypeTools(source);
    const handle = await source.locator('.container-type-label').boundingBox();
    const target = await beneath.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + 10, { steps: 8 });
    await page.waitForTimeout(120);
    assert.equal(await source.evaluate(el => el.classList.contains('container-lifted')), true);
    assert.equal(await source.evaluate(el => getComputedStyle(el, '::before').backdropFilter), 'blur(2px)');
    assert.equal(await source.evaluate(el => getComputedStyle(el, '::before').inset), '-4px');
    const typePanel = source.locator(':scope > .container-type-tools');
    assert.equal(await typePanel.isVisible(), true);
    assert.equal(await typePanel.evaluate(el => getComputedStyle(el).backdropFilter), 'blur(2px)');
    if (process.env.NOTARIUM_TEST_OUTPUT) await page.screenshot({ path: resolve(reportDirectory, 'dragged-over-text-blur.png') });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.equal(await source.evaluate(el => el.classList.contains('container-lifted')), false);
    assert.equal(await source.evaluate(el => getComputedStyle(el).backdropFilter), 'none');
    assert.equal(await typePanel.evaluate(el => getComputedStyle(el).backdropFilter), 'blur(1px)');
  });
  await check('Right and bottom edges resize independently; corner double click resets layout with undo', async () => {
    await open('edge-resize', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'paragraph', attrs: { boxWidth: 420, boxHeight: 140, boxAlign: 'center', boxTitle: 'Tytuł' }, content: [{ type: 'text', text: 'Treść' }] }
    ] } }));
    const box = page.locator('.object-container').first();
    async function dragEdge(selector, dx, dy) {
      await box.hover(); const edge = await box.locator(selector).boundingBox();
      const x = edge.x + edge.width * (selector.includes('bottom') ? .85 : .5), y = edge.y + edge.height / 2;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 6 }); await page.mouse.up();
    }
    await dragEdge('.container-resize-right', 60, 25);
    assert.equal((await json()).content[0].attrs.boxWidth, 480);
    assert.equal((await json()).content[0].attrs.boxHeight, 140);
    await dragEdge('.container-resize-bottom', 25, 50);
    assert.equal((await json()).content[0].attrs.boxWidth, 480);
    assert.equal((await json()).content[0].attrs.boxHeight, 190);
    await box.hover();
    const corner = await box.boundingBox();
    await page.mouse.move(corner.x + corner.width - 5, corner.y + corner.height - 5);
    const cornerHandle = await box.locator('.container-resize-bottom-right').boundingBox();
    await page.mouse.dblclick(cornerHandle.x + cornerHandle.width / 2, cornerHandle.y + cornerHandle.height / 2);
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
    await box.hover();
    const rightEdge = await box.locator('.container-resize-right').boundingBox();
    await page.mouse.dblclick(rightEdge.x + rightEdge.width / 2, rightEdge.y + rightEdge.height / 2);
    assert.equal((await json()).content[0].attrs.boxWidth, null);
    assert.equal((await json()).content[0].attrs.boxHeight, 180);
    await command('undo');
    const bottomEdge = await box.locator('.container-resize-bottom').boundingBox();
    await page.mouse.dblclick(bottomEdge.x + 10, bottomEdge.y + bottomEdge.height / 2);
    assert.equal((await json()).content[0].attrs.boxWidth, 420);
    assert.equal((await json()).content[0].attrs.boxHeight, null);
    const leftEdge = await box.locator('.container-resize-left').boundingBox();
    const beforeLeftResize = await box.boundingBox();
    await page.mouse.move(leftEdge.x + leftEdge.width / 2, leftEdge.y + leftEdge.height / 2); await page.mouse.down();
    await page.mouse.move(leftEdge.x + 50, leftEdge.y + leftEdge.height / 2); await page.mouse.up();
    assert.ok((await json()).content[0].attrs.boxWidth < 420);
    const afterLeftResize = await box.boundingBox();
    assert.ok(Math.abs(afterLeftResize.x + afterLeftResize.width - beforeLeftResize.x - beforeLeftResize.width) <= 2);
    const leftBox = await box.boundingBox();
    await page.mouse.move(leftBox.x + 5, leftBox.y + leftBox.height - 5);
    assert.ok(await box.locator('.container-resize-bottom-left').boundingBox());
    await page.waitForTimeout(20);
    for (const [handle, pseudo, length] of [['.container-resize-right', '::before', 'height'], ['.container-resize-bottom', '::after', 'width']]) {
      const edge = await box.locator(handle).boundingBox();
      await page.mouse.move(edge.x + (handle.includes('bottom') ? 10 : edge.width / 2), edge.y + edge.height / 2);
      const dimensions = await box.evaluate((el, { pseudo, length }) => ({ line: parseFloat(getComputedStyle(el, pseudo)[length]), box: el.getBoundingClientRect()[length] }), { pseudo, length });
      assert.ok(dimensions.line >= dimensions.box, 'Highlighted edge covers entire container');
    }
    assert.ok(['corner-chrome-appear', 'container-chrome-appear'].includes(await box.locator('.container-resize-bottom-left').evaluate(el => getComputedStyle(el).animationName)));
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
    await page.screenshot({ path: resolve(reportDirectory, 'bottom-crop.png') });
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
    await page.locator('[data-container-type=paragraph] p').click();
    await revealTypeTools(box);
    const frames = await box.locator('.container-type-tools').evaluate(el => el.getAnimations()[0]?.effect.getKeyframes().map(f => f.opacity));
    assert.deepEqual(frames, ['0.5', '1']);
    assert.equal(await box.locator('.container-type-tools').evaluate(el => getComputedStyle(el).animationDuration), '0.18s');
    const animationBox = await box.boundingBox();
    await page.mouse.move(animationBox.x + animationBox.width - 5, animationBox.y + animationBox.height - 5);
    assert.deepEqual(await box.locator('.container-resize-bottom-right').evaluate(el => el.getAnimations()[0]?.effect.getKeyframes().map(f => f.opacity)), ['0.5', '1']);
    assert.ok((await box.evaluate(el => el.getAnimations().length)) > 0);
    await revealTypeTools(box);
    await box.locator('.container-type-label').click();
    await page.mouse.move(1000, 600); await box.hover();
    assert.equal(await box.locator('.container-type-tools').evaluate(el => el.getAnimations().length), 0);
    assert.equal(await box.locator('.container-type-tools').evaluate(el => getComputedStyle(el).opacity), '1');
    await revealTypeTools(box);
    await page.keyboard.down('Control');
    await box.locator('.container-tools button[title="Tytuł, stopka i wymiary"]').click();
    await page.keyboard.up('Control');
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
      await revealTypeTools(box); await page.keyboard.down('Control');
      await box.locator('.container-tools button[title="Tytuł, stopka i wymiary"]').click();
      await page.keyboard.up('Control');
      await page.locator('[name=noBackground]').check(); await page.locator('#container-dialog button[value=save]').click();
      assert.equal(await box.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await box.hover();
    assert.equal(await box.locator('.container-type-tools').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });
  await check('Pointer-only double tap resets the right edge without a native dblclick', async () => {
    await open('edge-pointer-only', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [{ type: 'paragraph', attrs: { boxWidth: 320, boxHeight: 140 }, content: [{ type: 'text', text: 'Reset' }] }] } }));
    const edge = page.locator('.container-resize-right');
    await edge.evaluate(el => {
      const rect = el.getBoundingClientRect(), init = { bubbles: true, button: 0, clientX: rect.x + 3, clientY: rect.y + 40 };
      for (let i = 0; i < 2; i++) { el.dispatchEvent(new PointerEvent('pointerdown', init)); document.dispatchEvent(new PointerEvent('pointerup', init)); }
    });
    assert.equal((await json()).content[0].attrs.boxWidth, null);
    assert.equal((await json()).content[0].attrs.boxHeight, 140);
    await command('undo'); assert.equal((await json()).content[0].attrs.boxWidth, 320);
  });
  await check('Groups nest by dragging, preserve children through both formats and undo, and allow extraction', async () => {
    await open('nested-containers', 'Przenoszony tekst');
    await command('container');
    const group = page.locator('[data-container-type=blockGroup]');
    assert.equal(await group.count(), 1);
    await revealTypeTools(page.locator('.tiptap>.object-container[data-container-type=paragraph]').first());
    const grip = await page.locator('.tiptap>.object-container[data-container-type=paragraph] .container-type-label').first().boundingBox();
    const destination = await group.boundingBox();
    await page.mouse.move(grip.x + 8, grip.y + 8); await page.mouse.down();
    await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 8 }); await page.mouse.up();
    assert.match(await group.textContent(), /Przenoszony tekst/);
    const nested = await json(); assert.equal(nested.content[0].type, 'blockGroup');
    await command('undo'); assert.equal((await json()).content[0].type, 'paragraph');
    await command('redo'); assert.deepEqual(await json(), nested);
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    for (const format of ['json', 'md']) {
      await open('nest-' + format, format === 'md' ? saved.markdown : '', format === 'json' ? saved.documentJson : null);
      assert.match(await group.textContent(), /Przenoszony tekst/);
    }
    await group.locator('p').last().click(); await command('container');
    assert.equal(await group.count(), 2);
    assert.equal(await page.locator('.block-group-content [data-container-type=blockGroup]').count(), 1);
    await command('undo'); assert.equal(await group.count(), 1);
    const child = group.locator('[data-container-type=paragraph]').last(); await revealTypeTools(child);
    const childGrip = await child.locator('.container-type-label').boundingBox(), bounds = await group.boundingBox();
    await page.mouse.move(childGrip.x + 8, childGrip.y + 8); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 3, { steps: 8 }); await page.mouse.up();
    assert.equal((await json()).content[0].type, 'paragraph');
    assert.equal((await json()).content[0].content[0].text, 'Przenoszony tekst');
    await command('undo'); assert.match(await group.textContent(), /Przenoszony tekst/);
  });
  await check('Nested siblings reorder and code cells insert inside the active group', async () => {
    await open('nested-siblings', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: [
      { type: 'blockGroup', content: ['A', 'B'].map(text => ({ type: 'paragraph', attrs: { boxHeight: 110 }, content: [{ type: 'text', text }] })) },
      { type: 'paragraph', content: [{ type: 'text', text: 'Zewnętrzny' }] }
    ] } }));
    const children = page.locator('.block-group-content>[data-container-type=paragraph]');
    await revealTypeTools(children.last());
    const handle = await children.last().locator('.container-type-label').boundingBox(), first = await children.first().boundingBox();
    await page.mouse.move(handle.x + 8, handle.y + 8); await page.mouse.down();
    await page.mouse.move(first.x + first.width / 2, first.y + 1, { steps: 8 }); await page.mouse.up();
    assert.equal((await json()).content[0].content[0].content[0].text, 'B');
    await command('undo'); assert.equal((await json()).content[0].content[0].content[0].text, 'A');
    await children.first().locator('p').click(); await command('cell');
    assert.equal(await page.locator('.block-group-content .code-cell').count(), 1);
    await page.locator('.cm-content').click(); await page.keyboard.type('print(123)');
    assert.match(JSON.stringify((await json()).content[0]), /print\(123\)/);
    const saved = await page.evaluate(() => window.notatnik.snapshot());
    for (const format of ['json', 'md']) {
      await open('nested-cell-' + format, format === 'md' ? saved.markdown : '', format === 'json' ? saved.documentJson : null);
      assert.equal(await page.locator('.block-group-content .code-cell').count(), 1);
      assert.match(await page.locator('.cm-content').textContent(), /print\(123\)/);
    }
  });
  await check('Wider Type switches to close and settings while Ctrl is held', async () => {
    const nodes = [{ type: 'paragraph', content: [{ type: 'text', text: 'Text example' }] },
      { type: 'blockMath', attrs: { latex: 'x=1' } }, { type: 'codeCell' },
      { type: 'image', attrs: { src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="teal"/></svg>') } },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }] }] }];
    await open('container-badges', '', JSON.stringify({ version: 1, doc: { type: 'doc', content: nodes } }));
    for (const [type, label] of [['paragraph','Text'], ['blockMath','Math'], ['codeCell','Code'], ['image','Picture'], ['table','Table']]) {
      const container = page.locator(`[data-container-type="${type}"]`).first();
      await revealTypeTools(container);
      const left = container.locator(':scope > .container-type-tools');
      await left.waitFor({ state: 'visible' });
      assert.equal(await container.locator(':scope > .container-tools').count(), 0);
      assert.equal(await left.locator('.container-type-label').getAttribute('data-label'), label);
      assert.ok((await left.boundingBox()).width >= 64);
      assert.equal(await left.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(30, 30, 30, 0.45)');
      assert.equal(await left.evaluate(element => getComputedStyle(element).backdropFilter), 'blur(1px)');
      assert.equal(await left.locator('.container-type-label').isVisible(), true);
      assert.equal(await left.locator('.container-tools').isVisible(), false);
      assert.deepEqual(await left.locator('.container-tools button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label') || button.title)),
        ['Usuń kontener', 'Tytuł, stopka i wymiary']);
      const box = await container.boundingBox(), leftBox = await left.boundingBox();
      assert.ok(Math.abs(leftBox.x + leftBox.width - (box.x - 4)) <= 1);
      assert.ok(Math.abs(leftBox.y - (box.y - 4)) <= 1);
      assert.ok(Math.abs(leftBox.height - (box.height + 8)) <= 1);
      assert.ok(Math.abs((await left.locator('.container-type-label').boundingBox()).height - leftBox.height) <= 1);
      assert.equal(await left.locator('.container-grip').count(), 0);
      assert.equal(await left.locator('.container-type-label').evaluate(element => getComputedStyle(element).cursor), 'grab');
    }
    const first = page.locator('[data-container-type=paragraph]').first();
    await revealTypeTools(first);
    await page.keyboard.down('Control');
    const controls = first.locator(':scope > .container-type-tools');
    assert.equal(await controls.locator('.container-type-label').isVisible(), false);
    assert.equal(await controls.locator('.container-tools').isVisible(), true);
    for (const button of await controls.locator('.container-tools button:not([hidden])').all()) {
      const bounds = await button.boundingBox();
      assert.equal(bounds.width, 23);
      assert.equal(bounds.height, 23);
      assert.equal(await button.evaluate(element => getComputedStyle(element).transitionDuration), '0.12s, 0.12s');
      await button.hover();
      await page.waitForFunction(element => getComputedStyle(element).backgroundColor === 'rgb(68, 68, 68)' &&
        getComputedStyle(element).color === 'rgb(255, 255, 255)', await button.elementHandle());
    }
    if (process.env.NOTARIUM_TEST_OUTPUT) await page.screenshot({ path: resolve(reportDirectory, 'container-ctrl-actions.png') });
    const settings = controls.locator('button[title="Tytuł, stopka i wymiary"]'), settingsBox = await settings.boundingBox();
    await page.mouse.move(settingsBox.x + settingsBox.width / 2, settingsBox.y + settingsBox.height / 2);
    assert.equal(await controls.isVisible(), true);
    await page.keyboard.up('Control');
    assert.equal(await controls.locator('.container-type-label').isVisible(), true);
    assert.equal(await controls.locator('.container-tools').isVisible(), false);
    await page.keyboard.down('Control');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await controls.locator('.container-type-label').isVisible(), true);
    await page.keyboard.up('Control');
    const add = first.locator(':scope > .container-add-tools');
    await add.waitFor({ state: 'visible' });
    assert.deepEqual(await add.locator('button').evaluateAll(buttons => buttons.map(button => button.dataset.label)),
      ['+ text', '+ code block', '+ code cell', '+ math']);
    let addBox = await add.boundingBox(), firstBox = await first.boundingBox();
    assert.ok(addBox.y < firstBox.y + firstBox.height && addBox.y + addBox.height > firstBox.y + firstBox.height);
    assert.ok(Math.abs(addBox.y + addBox.height / 2 - (firstBox.y + firstBox.height + 3)) <= 1);
    assert.ok(Math.abs(addBox.x + addBox.width / 2 - (firstBox.x + firstBox.width / 2)) <= 1);
    assert.equal(await add.locator('button').nth(1).evaluate(element => getComputedStyle(element).borderLeftStyle), 'solid');
    const picture = page.locator('[data-container-type=image]'), pictureBox = await picture.boundingBox();
    const editorBox = await page.locator('#editor').boundingBox();
    await page.mouse.move(editorBox.x + editorBox.width - 8, pictureBox.y + pictureBox.height / 2);
    assert.equal(await picture.evaluate(element => element.classList.contains('container-row-hover')), true);
    assert.equal(await picture.locator(':scope > .container-type-tools').isVisible(), false);
    await first.hover();
    let actionBox = await add.locator('[data-action=paragraph]').boundingBox();
    await page.mouse.click(actionBox.x + actionBox.width / 2, actionBox.y + actionBox.height / 2);
    assert.equal(await page.locator('[data-container-type=paragraph]').count(), 3);
    assert.equal(await page.locator('.block-group-content').count(), 0);
    await command('undo');
    await first.hover(); actionBox = await first.locator(':scope > .container-add-tools [data-action=codeBlock]').boundingBox();
    await page.mouse.click(actionBox.x + actionBox.width / 2, actionBox.y + actionBox.height / 2);
    assert.equal(await page.locator('[data-container-type=codeBlock]').count(), 1);
    await command('undo');
    await first.hover(); actionBox = await first.locator(':scope > .container-add-tools [data-action=codeCell]').boundingBox();
    await page.mouse.click(actionBox.x + actionBox.width / 2, actionBox.y + actionBox.height / 2);
    assert.equal(await page.locator('.code-cell').count(), 2);
    await page.screenshot({ path: resolve(reportDirectory, 'container-badges.png') });
  });
  await open('demo', '# Notatnik 🦊\n\n**Tiptap** — tekst, listy i formatowanie.\n\n1. Pierwszy punkt\n2. Drugi punkt');
  await command('cell'); await page.locator('.cm-content').click(); await page.keyboard.type('def greeting(name):\n    return f"Hello, {name}!"');
  await mkdir(reportDirectory, { recursive: true });
  await page.screenshot({ path: resolve(reportDirectory, 'editor.png') });
  console.log(`PASS ${passed} browser integration scenarios`);
} finally { await browser.close(); if (temporaryReports) await rm(reportDirectory, { recursive: true, force: true }); }
