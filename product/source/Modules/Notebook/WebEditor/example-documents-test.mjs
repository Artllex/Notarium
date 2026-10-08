import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const reports = await mkdtemp(join(tmpdir(), 'Notarium-example-documents-'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 1280 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await page.waitForFunction(() => window.notatnik);
  const results = [];
  for (const [id, filename] of [
    ['features', 'Notarium — pokaz funkcji A4.md'],
    ['thesis', 'Praca licencjacka — edytor notatek — 5 stron A4.md'],
  ]) {
    const markdown = await readFile(resolve('../examples', filename), 'utf8');
    await page.evaluate(message => notatnik.receive(message), { type: 'open', noteId: id, markdown });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.tiptap img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      const editor = notatnik.editor, root = editor.view.dom;
      const textRects = [...root.querySelectorAll('p')].flatMap(paragraph => {
        const range = document.createRange(); range.selectNodeContents(paragraph);
        return [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
      });
      const populatedPages = [...document.querySelectorAll('.layout-paper')].map(paper => {
        const bounds = paper.getBoundingClientRect();
        return textRects.some(rect => rect.left < bounds.right && rect.right > bounds.left && rect.top < bounds.bottom && rect.bottom > bounds.top);
      });
      return { layout: editor.getJSON().attrs.pageLayout, pages: document.querySelectorAll('.layout-paper').length, populatedPages,
        nodes: Object.fromEntries(['heading','blockGroup','layoutRow','table','image','blockMath','inlineMath','codeBlock','codeCell','taskList','orderedList','bulletList'].map(type => {
          let count = 0; editor.state.doc.descendants(node => { if (node.type.name === type) count++; }); return [type, count];
        })), width: root.scrollWidth, height: root.offsetHeight, plainText: notatnik.snapshot().plainText };
    });
    assert.equal(result.layout.size, 'A4'); assert.equal(result.layout.paged, true);
    assert.equal(result.layout.numbering, true);
    assert.ok(result.populatedPages.every(Boolean), 'No empty trailing page');
    console.log('Rendered ' + id + ': ' + result.pages + ' pages, scroll width ' + result.width);
    assert.deepEqual(errors, []);
    for (let index = 0; index < result.pages; index++) {
      const paper = page.locator('.layout-paper').nth(index);
      await paper.scrollIntoViewIfNeeded(); await page.waitForTimeout(100);
      const bounds = await paper.boundingBox();
      assert.ok(Math.abs(bounds.width - 210 * 96 / 25.4) < 1);
      assert.ok(Math.abs(bounds.height - 297 * 96 / 25.4) < 1);
      await page.screenshot({ path: join(reports, `${id}-${index + 1}.png`), clip: bounds });
    }
    const snapshot = await page.evaluate(() => notatnik.snapshot());
    await page.evaluate(message => notatnik.receive(message), { type: 'open', noteId: id + '-roundtrip', markdown: snapshot.markdown });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.layout-paper').count(), result.pages, 'Markdown roundtrip retains page count');
    if (id === 'features') {
      assert.equal(result.pages, 5, 'Feature demo spans five populated A4 pages');
      for (const type of ['layoutRow','table','image','blockMath','inlineMath','codeBlock','codeCell','taskList','orderedList','bulletList']) assert.ok(result.nodes[type] > 0, `Demo contains ${type}`);
      assert.ok((await page.evaluate(() => notatnik.editor.getJSON())).content.some(node => node.type === 'layoutRow'));
    }
    results.push({ id, filename, ...result, plainText: undefined });
    console.log(JSON.stringify(results.at(-1)));
  }
  await writeFile(join(reports, 'verification.json'), JSON.stringify(results, null, 2));
  console.log('Reports: ' + reports);
  assert.deepEqual(errors, []);
  assert.equal(results.find(result => result.id === 'thesis').pages, 5, 'Thesis must occupy exactly five A4 pages');
} finally { await browser.close(); }
