import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 1280 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await page.waitForFunction(() => window.notatnik);
  const markdown = await readFile(resolve('../examples/Praca licencjacka — edytor notatek — 5 stron A4.md'), 'utf8');
  const open = () => page.evaluate(markdown => notatnik.receive({ type: 'open', noteId: 'pages', markdown }), markdown);
  const change = async value => {
    await page.evaluate(value => notatnik.receive({ type: 'command', action: 'pageView', value }), value);
    await page.waitForTimeout(150);
  };
  await open(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
  const original = await page.evaluate(() => ({ json: notatnik.editor.getJSON(), snapshot: notatnik.snapshot(), selection: notatnik.editor.state.selection.toJSON() }));
  for (const value of [{direction:'down',pages:1},{direction:'down',pages:2},{direction:'down',pages:3},{direction:'down',pages:7},{direction:'across',pages:3},{direction:'down',pages:1}]) {
    await change(value);
    const state = await page.evaluate(() => {
      const root = notatnik.editor.view.dom;
      const papers = [...document.querySelectorAll('.layout-paper')].map(p => ({ x:p.offsetLeft,y:p.offsetTop,w:p.offsetWidth,h:p.offsetHeight,footer:p.textContent }));
      const bounds = root.getBoundingClientRect();
      const texts = [...root.querySelectorAll('p')].filter(p => p.textContent.trim()).flatMap(p => {
        const r = document.createRange();r.selectNodeContents(p);return [...r.getClientRects()].filter(r=>r.width>0).map(r=>({x:r.left-bounds.left,y:r.top-bounds.top}));
      });
      return { papers, texts, json:notatnik.editor.getJSON(), snapshot:notatnik.snapshot(), selection:notatnik.editor.state.selection.toJSON(), left:parseFloat(getComputedStyle(root.parentElement).paddingLeft),top:parseFloat(getComputedStyle(root.parentElement).paddingTop) };
    });
    assert.deepEqual(state.json, original.json); assert.deepEqual(state.snapshot, original.snapshot);
    assert.deepEqual(state.selection, original.selection);
    assert.equal(state.papers.length,5);
    const cols = value.direction === 'across' ? 5 : Math.min(value.pages,5);
    for (let i=0;i<5;i++) {
      const p=state.papers[i];
      assert.ok(Math.abs(p.x-(i%cols)*(210*96/25.4+24))<1);
      assert.ok(Math.abs(p.y-Math.floor(i/cols)*(297*96/25.4+24))<1);
      assert.ok(p.footer.endsWith(String(i+1)));
      assert.ok(state.texts.some(t=>t.x+state.left>=p.x && t.x+state.left<p.x+p.w && t.y+state.top>=p.y && t.y+state.top<p.y+p.h),`Page ${i+1} contains its editable text`);
    }
    console.log('PASS',JSON.stringify(value));
  }
  // Native hit testing and editing on the last page, followed by undo.
  const last = page.locator('.tiptap p').filter({ hasText: 'WHATWG' }).last();
  await last.scrollIntoViewIfNeeded(); await last.click();
  await page.keyboard.type('TEST');
  assert.ok(await page.evaluate(()=>notatnik.snapshot().plainText.includes('TEST')));
  await page.keyboard.press('Control+z');
  assert.deepEqual(await page.evaluate(()=>notatnik.editor.getJSON()),original.json);
  await page.setViewportSize({width:800,height:900}); await page.waitForTimeout(200);
  assert.equal(await page.locator('.layout-paper').count(),5);
  await change({direction:'down',pages:3});
  await page.reload(); await page.waitForFunction(()=>window.notatnik);await open();await page.waitForTimeout(200);
  const positions = await page.locator('.layout-paper').evaluateAll(ps=>ps.map(p=>[p.offsetLeft,p.offsetTop]));
  assert.equal(positions[2][1],0); assert.ok(positions[3][1]>1000);
  assert.deepEqual(errors,[]);
  console.log('PASS editing/undo, resize and persisted preference');
} finally { await browser.close(); }
