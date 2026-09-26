import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1050, height: 900 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
let count = 0;
async function check(name, run) { await run(); assert.deepEqual(errors, []); console.log('PASS ' + name); count++; }
try {
  await page.goto(pathToFileURL(resolve('dist/index.html')).href); await page.waitForFunction(() => window.devGalleryReady);
  await check('gallery exposes all shared web components', async () => {
    assert.equal(await page.locator('.sample').count(), 9);
    await page.getByRole('button', { name: 'Przycisk', exact: true }).click(); assert.match(await page.locator('#result').textContent(), /kliknięcie działa/);
    assert.equal(await page.getByRole('button', { name: 'Przycisk wyłączony', exact: true }).isEnabled(), false);
  });
  await check('dropdown keyboard, disabled item and anchor', async () => {
    const trigger = page.getByRole('button', { name: 'Otwórz dropdown', exact: true }); await trigger.click();
    const style = await page.locator('.ui-dropdown').evaluate(el => { const s = getComputedStyle(el); return [s.borderRadius, s.boxShadow, s.padding, s.fontSize]; });
    assert.deepEqual(style, ['0px', 'none', '2px', '14px']);
    const anchor = await trigger.boundingBox(), box = await page.locator('.ui-dropdown').boundingBox(); assert.ok(Math.abs(anchor.x - box.x) < 1); assert.ok(Math.abs(anchor.y + anchor.height - box.y) < 1);
    assert.equal(await page.getByRole('menuitem', { name: 'Opcja wyłączona' }).isEnabled(), false);
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); assert.match(await page.locator('#result').textContent(), /zaznaczona opcja/);
    await trigger.click(); await page.keyboard.press('Escape'); assert.equal(await page.locator('.ui-dropdown').count(), 0); assert.equal(await trigger.evaluate(el => document.activeElement === el), true);
  });
  await check('shared select and suggestions', async () => {
    await page.locator('.ui-choice').first().click(); await page.getByRole('menuitem', { name: 'Math', exact: true }).click(); assert.match(await page.locator('#result').textContent(), /Math/);
    const language = page.getByRole('combobox', { name: 'Sugestie języka' }); await language.fill('Py'); await language.press('ArrowDown'); await language.press('Enter'); assert.equal(await language.inputValue(), 'Python');
  });
  await check('context menu and modal dialog use common dropdown', async () => {
    await page.getByText('Kliknij tutaj PPM.', { exact: true }).click({ button: 'right' }); await page.getByRole('menuitem', { name: 'Akcja kontekstowa' }).click();
    await page.getByRole('button', { name: 'Otwórz dialog', exact: true }).click(); await page.locator('dialog .ui-choice').click(); assert.equal(await page.locator('dialog .ui-dropdown').count(), 1);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog').evaluate(el => el.open), true); await page.getByRole('button', { name: 'Zamknij dialog' }).click(); assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
  });
  await check('fields, toggle, handle and dynamic adoption', async () => {
    await page.getByRole('checkbox').check(); assert.match(await page.locator('#result').textContent(), /true/);
    await page.getByRole('textbox', { name: 'Pole tekstowe', exact: true }).fill('DEV'); await page.getByRole('textbox', { name: 'Pole wielowierszowe' }).fill('A\nB');
    const handle = page.getByRole('separator', { name: 'Uchwyt szerokości' }); await handle.scrollIntoViewIfNeeded(); const box = await handle.boundingBox();
    await page.mouse.move(box.x + 5, box.y + 20); await page.mouse.down(); await page.mouse.move(box.x + 55, box.y + 20); await page.mouse.up(); assert.match(await page.locator('#result').textContent(), /Handle: 200px/);
    await page.getByRole('button', { name: 'Dodaj dynamiczny element' }).click(); await page.getByRole('textbox', { name: 'Dynamiczny TextField' }).fill('dynamic');
  });
  console.log('TOTAL ' + count + ' gallery scenarios passed');
} finally { await browser.close(); }
