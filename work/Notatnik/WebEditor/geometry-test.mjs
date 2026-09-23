import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.on('pageerror', error => { throw error; });
await page.addInitScript(() => {
  window.chrome ||= {};
  window.chrome.webview = { postMessage() {}, addEventListener() {} };
});
await page.goto(pathToFileURL(resolve('dist/index.html')).href);
await page.waitForFunction(() => window.notatnik);
const open = (id, doc) => page.evaluate(({ id, doc }) =>
  window.notatnik.receive({ type: 'open', noteId: id, markdown: '', documentJson: JSON.stringify({ version: 1, doc }) }), { id, doc });
const json = () => page.evaluate(() => window.notatnik.editor.getJSON());
const bounds = locator => locator.boundingBox();
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= 2, `${message}: ${actual} versus ${expected}`);
const drag = async (locator, dx, dy = 0) => {
  const box = await bounds(locator), x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 5 }); await page.mouse.up();
};
const text = label => ({ type: 'paragraph', content: [{ type: 'text', text: label }] });
const row = { type: 'layoutRow', content: [text('Lewy'), text('Środkowy'), text('Prawy')] };

try {
  await open('two-boundaries', { type: 'doc', content: [{ type: 'layoutRow', content: [text('Lewy'), text('Prawy')] }] });
  const neighboring = page.locator('.layout-row > .object-container');
  const stationary = neighboring.nth(0).locator(':scope > .container-pair-resize');
  const emerging = neighboring.nth(1).locator(':scope > .container-gap-boundary');
  const firstLine = await bounds(stationary);
  assert.equal(await emerging.isVisible(), false, 'One line represents the ordinary gap');
  const movingEdge = await bounds(neighboring.nth(1).locator(':scope > .container-resize-left'));
  const mx = movingEdge.x + movingEdge.width / 2, my = movingEdge.y + movingEdge.height / 2;
  await page.mouse.move(mx, my); await page.mouse.down(); await page.mouse.move(mx + 55, my, { steps: 5 });
  const secondLineDuringDrag = await bounds(emerging);
  assert.ok(secondLineDuringDrag, 'Second boundary appears during edge drag');
  near((await bounds(stationary)).x, firstLine.x, 'Original divider remains stationary during drag');
  assert.ok(secondLineDuringDrag.x > firstLine.x + 40, 'New divider follows the moved edge');
  await page.mouse.up();
  near((await bounds(stationary)).x, firstLine.x, 'Original divider remains stationary after release');
  const persistedGap = await json();
  await open('two-boundaries-reopen', persistedGap);
  near((await bounds(stationary)).x, firstLine.x, 'Original divider position survives reopening');
  assert.ok(await emerging.isVisible(), 'Second boundary survives reopening');

  await open('geometry', { type: 'doc', content: [row] });
  const boxes = page.locator('.layout-row > .object-container');
  const before = await Promise.all([0, 1, 2].map(i => bounds(boxes.nth(i))));
  await drag(boxes.nth(0).locator(':scope > .container-resize-right'), -70);
  let after = await Promise.all([0, 1, 2].map(i => bounds(boxes.nth(i))));
  near(after[0].x, before[0].x, 'Right edge keeps its left anchor');
  assert.ok(after[0].width < before[0].width - 60);
  for (let i = 1; i < 3; i++) {
    near(after[i].x, before[i].x, 'Unchanged neighbor keeps x');
    near(after[i].width, before[i].width, 'Unchanged neighbor keeps width');
  }
  const saved = await page.evaluate(() => window.notatnik.snapshot());
  await open('geometry-reopen', JSON.parse(saved.documentJson).doc);
  const reopened = await Promise.all([0, 1, 2].map(i => bounds(boxes.nth(i))));
  for (let i = 0; i < 3; i++) { near(reopened[i].x, after[i].x, 'Reopen x'); near(reopened[i].width, after[i].width, 'Reopen width'); }
  await page.evaluate(markdown => window.notatnik.receive({ type: 'open', noteId: 'geometry-markdown', markdown, documentJson: null }), saved.markdown);
  const fromMarkdown = await Promise.all([0, 1, 2].map(i => bounds(boxes.nth(i))));
  for (let i = 0; i < 3; i++) { near(fromMarkdown[i].x, after[i].x, 'Markdown x'); near(fromMarkdown[i].width, after[i].width, 'Markdown width'); }
  await page.setViewportSize({ width: 680, height: 700 });
  const compact = await Promise.all([0, 1, 2].map(i => bounds(boxes.nth(i))));
  for (let i = 0; i < 3; i++) near(compact[i].width, after[i].width, 'Stored column width at narrower viewport');
  for (let i = 1; i < 3; i++) assert.ok(compact[i].x >= compact[i - 1].x + compact[i - 1].width + 21, 'Stored columns do not overlap');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), true,
    'Overwide row remains horizontally scrollable');
  await page.setViewportSize({ width: 1100, height: 700 });
  await drag(boxes.nth(0).locator(':scope > .container-resize-right'), 500);
  after = await Promise.all([0, 1, 2].map(i => bounds(boxes.nth(i))));
  assert.ok(after[0].x + after[0].width <= after[1].x - 21, 'One edge stops before its neighbor');
  near(after[1].x, before[1].x, 'Neighbor x after collision clamp');
  await drag(boxes.nth(2).locator(':scope > .container-resize-left'), 45);
  const leftResize = await Promise.all([0, 1, 2].map(i => bounds(boxes.nth(i))));
  near(leftResize[2].x + leftResize[2].width, after[2].x + after[2].width, 'Left edge keeps right anchor');
  near(leftResize[1].x, after[1].x, 'Left neighbor x');
  near(leftResize[1].width, after[1].width, 'Left neighbor width');
  const pairBefore = await Promise.all([0, 1].map(i => bounds(boxes.nth(i))));
  await drag(boxes.nth(0).locator(':scope > .container-pair-resize'), -25);
  const pairAfter = await Promise.all([0, 1].map(i => bounds(boxes.nth(i))));
  near(pairAfter[0].x, pairBefore[0].x, 'Pair external left');
  near(pairAfter[1].x + pairAfter[1].width, pairBefore[1].x + pairBefore[1].width, 'Pair external right');
  assert.ok(pairAfter[0].width < pairBefore[0].width - 15 && pairAfter[1].width > pairBefore[1].width + 15);
  await boxes.nth(0).locator(':scope > .container-pair-resize').click();
  const resetPair = await Promise.all([0, 1].map(i => bounds(boxes.nth(i))));
  near(resetPair[0].width, resetPair[1].width, 'Clicking divider balances both adjacent widths');
  near(resetPair[0].x, pairAfter[0].x, 'Divider reset keeps external left edge');
  near(resetPair[1].x + resetPair[1].width, pairAfter[1].x + pairAfter[1].width, 'Divider reset keeps external right edge');
  await boxes.nth(2).locator(':scope > .container-select-top').click();
  await page.evaluate(() => {
    window.copiedContainer = new DataTransfer();
    window.notatnik.editor.view.dom.dispatchEvent(new ClipboardEvent('copy',
      { bubbles: true, cancelable: true, clipboardData: window.copiedContainer }));
  });
  await boxes.nth(0).locator(':scope > .container-pair-resize').click();
  await page.evaluate(() => window.notatnik.editor.view.dom.dispatchEvent(new ClipboardEvent('paste',
    { bubbles: true, cancelable: true, clipboardData: window.copiedContainer })));
  assert.deepEqual((await json()).content[0].content.map(node => node.textContent || node.content?.[0]?.text),
    ['Lewy', 'Prawy', 'Środkowy', 'Prawy'], 'Vertical divider inserts a copy between its neighbors');

  await open('horizontal-paste', { type: 'doc', content: [text('Góra'), text('Dół')] });
  await page.locator('.container-between-horizontal').waitFor();
  assert.equal(await page.locator('.container-between-horizontal').count(), 1, 'Horizontal divider appears between stacked containers');
  await page.locator('.object-container').first().locator(':scope > .container-select-top').click();
  await page.evaluate(() => {
    window.copiedContainer = new DataTransfer();
    window.notatnik.editor.view.dom.dispatchEvent(new ClipboardEvent('copy',
      { bubbles: true, cancelable: true, clipboardData: window.copiedContainer }));
  });
  const horizontal = await bounds(page.locator('.container-between-horizontal'));
  await page.mouse.click(horizontal.x + 15, horizontal.y + horizontal.height / 2);
  await page.evaluate(() => window.notatnik.editor.view.dom.dispatchEvent(new ClipboardEvent('paste',
    { bubbles: true, cancelable: true, clipboardData: window.copiedContainer })));
  assert.deepEqual((await json()).content.map(node => node.content?.[0]?.text),
    ['Góra', 'Góra', 'Dół'], 'Horizontal divider inserts a copy between stacked containers');
  await open('geometry', { type: 'doc', content: [row] });

  const beforeCancel = await json();
  const widthBeforeCancel = (await bounds(boxes.nth(0))).width;
  const cancelRect = await bounds(boxes.nth(0).locator(':scope > .container-resize-right'));
  const cx = cancelRect.x + cancelRect.width / 2, cy = cancelRect.y + cancelRect.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 25, cy, { steps: 4 });
  await page.keyboard.press('Escape'); await page.mouse.up();
  assert.deepEqual(await json(), beforeCancel, 'Escape leaves document unchanged');
  const afterCancel = await bounds(boxes.nth(0));
  near(afterCancel.width, widthBeforeCancel, 'Escape restores preview width');
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 25, cy, { steps: 4 });
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up();
  assert.deepEqual(await json(), beforeCancel, 'Window blur leaves document unchanged');
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 25, cy, { steps: 4 });
  await open('different-note', { type: 'doc', content: [text('Druga notatka')] });
  await page.mouse.up();
  assert.equal((await json()).content[0].content[0].text, 'Druga notatka', 'Note switch cancels previous gesture');
  await page.setViewportSize({ width: 680, height: 700 });
  await open('narrow-row', { type: 'doc', content: [row] });
  const narrow = await Promise.all([0, 1, 2].map(i => bounds(boxes.nth(i))));
  for (let i = 1; i < 3; i++) assert.ok(narrow[i].x >= narrow[i - 1].x + narrow[i - 1].width + 21, 'Viewport never overlaps neighbors');
  await page.setViewportSize({ width: 1100, height: 700 });

  await open('height-snap', { type: 'doc', content: [{ type: 'layoutRow', content: [
    { ...text('A'), attrs: { boxHeight: 130 } }, { ...text('B'), attrs: { boxHeight: 220 } }
  ] }] });
  const two = page.locator('.layout-row > .object-container');
  const leftBottom = (await bounds(two.nth(0))).y + (await bounds(two.nth(0))).height;
  const rightBottom = (await bounds(two.nth(1))).y + (await bounds(two.nth(1))).height;
  const bottomEdge = await bounds(two.nth(0).locator(':scope > .container-resize-bottom'));
  await page.mouse.dblclick(bottomEdge.x + 30, bottomEdge.y + bottomEdge.height / 2);
  const snappedBottom = (await bounds(two.nth(0))).y + (await bounds(two.nth(0))).height;
  near(snappedBottom, rightBottom, 'Bottom edge aligns with adjacent bottom');
  assert.ok(snappedBottom > leftBottom + 50);

  await open('nested-arrows', { type: 'doc', content: [
    { type: 'blockGroup', content: [text('A'), text('B'), text('C')] }
  ] });
  const groupChildren = page.locator('.block-group-content > .object-container');
  await groupChildren.nth(1).hover();
  await groupChildren.nth(1).locator(':scope > .container-add-tools [aria-label="Przenieś kontener w górę"]').click();
  let nested = await json();
  assert.equal(nested.content[0].content[0].content[0].text, 'B', 'Up moves nested sibling');
  await groupChildren.nth(0).hover();
  await groupChildren.nth(0).locator(':scope > .container-add-tools [aria-label="Przenieś kontener w dół"]').click();
  nested = await json();
  assert.equal(nested.content[0].content[1].content[0].text, 'B', 'Down moves nested sibling');

  await open('row-insert', { type: 'doc', content: [row] });
  await boxes.nth(1).hover();
  await boxes.nth(1).locator(':scope > .container-add-tools [data-action=paragraph]').click();
  assert.equal((await json()).content[0].type, 'layoutRow');
  assert.equal((await json()).content[1].type, 'paragraph', 'Add below row creates a sibling below it');
  await open('row-delete', { type: 'doc', content: [{ type: 'layoutRow', content: [text('A'), text('B')] }] });
  await boxes.nth(0).hover();
  await boxes.nth(0).locator(':scope > .container-add-tools [aria-label="Usuń kontener"]').click();
  assert.equal((await json()).content[0].type, 'paragraph', 'Removing one column unwraps the remaining container');
  assert.equal((await json()).content[0].attrs.boxOffsetX, null, 'Unwrapped container drops row-only offset');

  await open('center-anchor', { type: 'doc', content: [{ ...text('Wyśrodkowany'),
    attrs: { boxWidth: 300, boxAlign: 'center' } }] });
  const centered = page.locator('.object-container').first(), centeredBefore = await bounds(centered);
  await drag(centered.locator(':scope > .container-resize-right'), 45);
  const centeredAfter = await bounds(centered);
  near(centeredAfter.x, centeredBefore.x, 'Standalone right edge keeps left anchor');
  assert.ok(centeredAfter.width > centeredBefore.width + 35);
  const savedCenter = await page.evaluate(() => window.notatnik.snapshot());
  await open('center-reopen', JSON.parse(savedCenter.documentJson).doc);
  near((await bounds(centered)).x, centeredAfter.x, 'Standalone anchor survives reopening');

  await open('code-growth', { type: 'doc', content: [{ type: 'codeCell',
    attrs: { language: 'python', boxHeight: 120, codeAllowNarrow: false },
    content: [{ type: 'text', text: 'print(1)' }] }] });
  const code = page.locator('[data-container-type=codeCell]');
  const oldCodeHeight = (await bounds(code)).height;
  await code.locator('.cm-content').click();
  await page.keyboard.type('\nprint(2)\nprint(3)\nprint(4)\nprint(5)\nprint(6)\nprint(7)\nprint(8)');
  assert.ok((await bounds(code)).height > oldCodeHeight + 20, 'Visible code grows when content needs more lines');
  assert.equal((await json()).content[0].attrs.boxHeight, 120, 'Saved user height remains the requested minimum');

  await open('foreign-clipboard', { type: 'doc', content: [text('Kopiowany kontener')] });
  await page.locator('.object-container .container-select-top').click();
  await page.keyboard.press('Control+c');
  await page.evaluate(() => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'Tekst z innej aplikacji');
    window.notatnik.editor.view.dom.dispatchEvent(new ClipboardEvent('paste',
      { bubbles: true, cancelable: true, clipboardData }));
  });
  assert.ok((await json()).content.length <= 1, 'Foreign clipboard never pastes a stale container');

  await open('type-on-vertical-line', { type: 'doc', content: [{ type: 'layoutRow', content: [text('A'), text('B')] }] });
  await page.locator('.layout-row > .object-container:first-child > .container-pair-resize').click();
  assert.equal((await json()).content[0].content.length, 2, 'Click alone does not add a container');
  await page.keyboard.type('Nowy');
  assert.deepEqual((await json()).content[0].content.map(node => node.content?.[0]?.text),
    ['A', 'Nowy', 'B'], 'Typing on vertical divider inserts a text column');

  await open('type-on-second-vertical-line', { type: 'doc', content: [{ type: 'layoutRow', content: [text('A'), text('B')] }] });
  const separated = page.locator('.layout-row > .object-container');
  await drag(separated.nth(1).locator(':scope > .container-resize-left'), 45);
  await separated.nth(1).locator(':scope > .container-gap-boundary').click();
  await page.keyboard.type('Między');
  assert.deepEqual((await json()).content[0].content.map(node => node.content?.[0]?.text),
    ['A', 'Między', 'B'], 'Typing on the second vertical divider inserts a text column');

  await open('type-on-horizontal-line', { type: 'doc', content: [text('Góra'), text('Dół')] });
  await page.locator('.container-between-horizontal').waitFor();
  const horizontalForTyping = await bounds(page.locator('.container-between-horizontal'));
  await page.mouse.click(horizontalForTyping.x + 15, horizontalForTyping.y + horizontalForTyping.height / 2);
  assert.equal((await json()).content.length, 2, 'Click alone does not add a block');
  await page.keyboard.type('Środek');
  assert.deepEqual((await json()).content.map(node => node.content?.[0]?.text),
    ['Góra', 'Środek', 'Dół'], 'Typing on horizontal divider inserts a text block');

  await open('type-below-last', { type: 'doc', content: [text('Ostatni')] });
  const last = await bounds(page.locator('.object-container').last());
  await page.mouse.click(last.x + 45, last.y + last.height + 40);
  await page.keyboard.type('Dalej');
  assert.deepEqual((await json()).content.map(node => node.content?.[0]?.text),
    ['Ostatni', 'Dalej'], 'Typing below the last container appends a text container');
  await open('type-below-row', { type: 'doc', content: [{ type: 'layoutRow', content: [text('A'), text('B')] }] });
  const lastRow = await bounds(page.locator('.layout-row'));
  await page.mouse.click(lastRow.x + 45, lastRow.y + lastRow.height + 40);
  await page.keyboard.type('Pod wierszem');
  assert.equal((await json()).content[1].content?.[0]?.text, 'Pod wierszem',
    'Typing below a row adds a sibling below the whole row');
  await open('reuse-empty-last', { type: 'doc', content: [text('A'), { type: 'paragraph' }] });
  const emptyLast = await bounds(page.locator('.object-container').last());
  await page.mouse.click(emptyLast.x + 45, emptyLast.y + emptyLast.height + 40);
  await page.keyboard.type('W pustym');
  assert.equal((await json()).content.length, 2, 'Clicking below an empty last container reuses it');
  assert.equal((await json()).content[1].content?.[0]?.text, 'W pustym');

  console.log('PASS focused container geometry and gesture scenarios');
} finally { await browser.close(); }
