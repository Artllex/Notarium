import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await page.waitForFunction(() => window.notatnik);
  await page.evaluate(() => window.notatnik.receive({ type: 'open', noteId: 'clean-scope', documentJson: JSON.stringify({ version: 1,
    doc: { type: 'doc', attrs: { layout: 'article', pageLayout: { paged: true, left: 40, numbering: true } }, content: [
      { type: 'paragraph', attrs: { indentLeft: 20, after: 30, firstLineIndent: 12.7 }, content: [{ type: 'text', text: 'Old document content' }] }
    ] }
  }) }));
  const before = await page.evaluate(() => window.notatnik.snapshot());
  assert.equal(before.plainText, 'Old document content');
  const document = JSON.parse(before.documentJson).doc;
  assert.equal(document.attrs.pageLayout, undefined);
  assert.equal(document.content[0].attrs.indentLeft, undefined);
  for (const action of ['pageLayout', 'setPageLayout', 'layoutField', 'layoutFields', 'paragraphFormat', 'pageView', 'workspacePanel', 'mathBlock', 'tableSize']) {
    await page.evaluate(action => window.notatnik.receive({ type: 'command', action, value: {} }), action);
    assert.deepEqual(await page.evaluate(() => window.notatnik.snapshot()), before, action);
  }
  assert.equal(await page.locator('#page-layout-dialog,.layout-paper,.workspace-panel').count(), 0);
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await page.evaluate(() => { window.notatnik.editor.commands.setTextSelection({ from: 1, to: 4 }); window.notatnik.receive({ type: 'command', action: 'bold' }); });
  assert.equal(await page.locator('.tiptap strong').textContent(), 'Old');
  assert.deepEqual(errors, []);
  console.log('PASS old content survives without advanced layout; removed commands do nothing; simple formatting still works');
} finally { await browser.close(); }
