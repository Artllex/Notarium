import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Reproducible, self-contained demo; the generated PNG is embedded in Markdown.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 360;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#172839'; ctx.fillRect(0, 0, 600, 360);
    ctx.fillStyle = '#ffd46b'; ctx.beginPath(); ctx.arc(100, 90, 40, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd46b'; ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(100 + Math.cos(a)*50,90 + Math.sin(a)*50); ctx.lineTo(100 + Math.cos(a)*64,90 + Math.sin(a)*64); ctx.stroke(); }
    ctx.fillStyle = '#378bcc'; ctx.fillRect(200, 150, 180, 112);
    ctx.strokeStyle = '#a9d9ff'; ctx.lineWidth = 2;
    for(let i=0;i<=4;i++){ ctx.beginPath();ctx.moveTo(200+i*45,150);ctx.lineTo(200+i*45,262);ctx.stroke(); }
    for(let i=0;i<=3;i++){ ctx.beginPath();ctx.moveTo(200,150+i*112/3);ctx.lineTo(380,150+i*112/3);ctx.stroke(); }
    ctx.strokeStyle = '#ffd46b'; ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(145,120);ctx.lineTo(190,145);ctx.stroke();
    ctx.fillStyle='#70d7b0';ctx.fillRect(465,175,70,75);ctx.fillRect(487,166,26,9);
    ctx.strokeStyle='#70d7b0';ctx.beginPath();ctx.moveTo(390,207);ctx.lineTo(452,207);ctx.lineTo(440,198);ctx.moveTo(452,207);ctx.lineTo(440,216);ctx.stroke();
    ctx.fillStyle='#f3f7ff';ctx.font='bold 24px Segoe UI';ctx.fillText('Od światła do energii',195,65);
    ctx.font='18px Segoe UI';ctx.fillText('Słońce',65,185);ctx.fillText('Panel',263,298);ctx.fillText('Energia',464,285);
    return c.toDataURL('image/png');
  });
  const article = `<!-- notarium:article -->

# Od światła do energii

Co właściwie oznacza moc panelu słonecznego? Prosty eksperyment liczbowy pokazuje, dlaczego o wyniku decyduje nie tylko urządzenie, lecz także czas jego pracy.

Moc i energia opisują dwa różne aspekty tego samego procesu. Moc mówi, jak szybko urządzenie przekazuje energię; energia określa, ile jej przekazało w pewnym czasie. Rozróżnienie jest niewielkie w słowach, ale kluczowe w obliczeniach.

## Zobaczyć cały proces

Wyobraźmy sobie panel, który zamienia światło w energię elektryczną. Na potrzeby przykładu upraszczamy zmienne warunki do kilku stałych wartości. Dzięki temu możemy prześledzić zależność bez gubienia się w szczegółach technicznych.

<figure data-note-image="true" data-placement="block-center"><img src="${image}" width="560" alt="Schemat przepływu: światło słoneczne, panel i energia elektryczna" title="Od światła do energii"><figcaption>Rys. 1. Światło, konwersja i uzyskana energia — trzy etapy jednego procesu.</figcaption></figure>

W rzeczywistych warunkach moc zmienia się w ciągu dnia. Nasz model przyjmuje natomiast stałą wartość i jeden umowny współczynnik strat. To świadome uproszczenie: celem jest zrozumienie relacji, a nie prognoza uzysku instalacji.

## Trzy liczby, jedna zależność

Przyjmijmy moc **400 W**, czas **4 h** oraz współczynnik **0,8**. Energię obliczamy jako iloczyn tych trzech wartości:

<div data-type="block-math" data-numbered="true" data-latex="E = P \\cdot t \\cdot \\eta">E = P · t · η</div>

Symbol **E** oznacza energię, **P** — moc, **t** — czas, a **η** — przyjęty współczynnik. Po podstawieniu otrzymujemy **1280 Wh**, czyli **1,28 kWh**. Jednostki pozwalają sprawdzić sens wyniku: wat pomnożony przez godzinę daje watogodzinę.

> Moc opisuje tempo. Energia opisuje ilość zgromadzoną w czasie.

## Co zmienia większa moc?

Porównajmy trzy warianty przy tym samym czasie pracy i współczynniku. Krótsza tabela uwidacznia jedną zależność: w tym modelu energia rośnie proporcjonalnie do mocy.

| Wariant | Moc panelu | Energia |
| --- | --- | --- |
| Kompaktowy | 200 W | 0,64 kWh |
| Standardowy | 400 W | 1,28 kWh |
| Rozszerzony | 600 W | 1,92 kWh |

*Założenia wspólne: 4 godziny pracy, współczynnik 0,8. Dane demonstracyjne.*

Podwojenie mocy podwaja obliczoną energię — o ile pozostałe założenia się nie zmieniają. Ta prosta obserwacja pomaga czytać dane techniczne i zadawać trafniejsze pytania o warunki, w których powstały.

## Wniosek

Dobry model nie musi uwzględniać wszystkiego naraz. Powinien jasno pokazywać zależności i nazywać swoje założenia. Tutaj wystarczą trzy liczby, wzór i porównanie, aby odróżnić moc urządzenia od energii uzyskanej w czasie.

*Notarium · artykuł przykładowy. Akapity, ilustrację, wzór i tabelę można edytować oraz przenosić za uchwyty sekcji.*
`;
  await mkdir('../../../examples', { recursive: true });
  const output = resolve('../../../examples/Notarium — przykładowy artykuł.md');
  await writeFile(output, article, 'utf8');
  await page.evaluate(markdown => window.notatnik.receive({ type:'open', noteId:'example-preview', markdown }), article);
  assert.equal(await page.locator('.tiptap img').count(),1);
  await page.locator('.tiptap img').evaluate(img => img.decode());
  assert.equal(await page.locator('.tiptap img').evaluate(img => img.naturalWidth),600);
  const snapshot = await page.evaluate(() => window.notatnik.snapshot());
  assert.equal((snapshot.plainText.match(/Rys\. 1\./g) || []).length, 0, 'Caption must not leak into a duplicate text paragraph');
  assert.equal(await page.locator('.tiptap figcaption').count(), 1);
  assert.equal(await page.locator('.tiptap').getAttribute('data-layout'), 'article');
  await page.evaluate(markdown => window.notatnik.receive({ type:'open', noteId:'example-roundtrip', markdown }), snapshot.markdown);
  await page.locator('.tiptap img').evaluate(img => img.decode());
  assert.equal(await page.locator('.tiptap figcaption').count(),1);
  assert.equal(await page.locator('.tiptap .katex').count(),1);
  assert.equal(await page.locator('.tiptap table tr').count(),4);
  assert.ok(await page.locator('.tiptap > p').count() >= 6);
  await page.locator('.tiptap > p').nth(1).hover();
  assert.equal(await page.locator('.block-drag-handle').isVisible(),true);
  await page.mouse.move(1050, 10);
  await mkdir('../../../outputs/engines-check', { recursive: true });
  await page.screenshot({ path:'../../../outputs/engines-check/example-article.png', fullPage:true });
  console.log('Verified example: '+output);
} finally { await browser.close(); }
