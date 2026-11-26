import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const browser=await chromium.launch({channel:'msedge',headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:650}});
 await page.goto(pathToFileURL(resolve('dist/index.html')).href);
 await page.waitForFunction(()=>window.notatnik);
 await page.addStyleTag({content:'::-webkit-scrollbar{width:17px;height:17px}'});
 await page.evaluate(()=>{const p=text=>({type:'paragraph',content:[{type:'text',text}]});notatnik.receive({type:'open',noteId:'drag-layout',documentJson:JSON.stringify({version:1,doc:{type:'doc',content:[{type:'layoutRow',content:['A','B','C'].map(p)},{type:'layoutRow',content:['1','3','2'].map(p)},p('Lift'),{...p('Below'),attrs:{boxWidth:300,boxAlign:'center'}}]}})});});
 const positions=()=>page.locator('.object-container').evaluateAll(elements=>elements.filter(el=>el.textContent.includes('Lift')===false).map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}));
 const before=await positions();
 await page.locator('.tiptap > .object-container').first().evaluate(el=>{el.classList.add('container-lifted');el.style.setProperty('--drag-x','1500px');el.style.setProperty('--drag-y','100px')});
 await page.waitForTimeout(200);
 assert.deepEqual(await positions(),before,'Lifting must not shift or resize other containers when the preview causes overflow');
 console.log('PASS lifting preserves other container geometry across scrollbar changes');
}finally{await browser.close()}
