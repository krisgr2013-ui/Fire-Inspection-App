const {chromium,webkit}=require('playwright');const fs=require('fs');const assert=require('node:assert/strict');
const fixture=fs.readFileSync(__dirname+'/fixture.js','utf8');
(async()=>{fs.mkdirSync('test-results',{recursive:true});let checks=0;
for(const [engine,width] of [['chromium',360],['chromium',390],['chromium',768],['chromium',1440],['webkit',390]]){
 const browser=await ({chromium,webkit}[engine]).launch({headless:true});const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8766/')?r.continue():r.abort());
 await page.route('**/backend.js*',r=>r.fulfill({contentType:'application/javascript',body:`window.GSBackend={ready:new Promise(()=>{}),role:'admin',user:null,membership:{tech_id:'t1'},companyId:'qa'};`}));
 try{
  await page.goto('http://127.0.0.1:8766/');
  await page.evaluate(fixture);await page.evaluate(()=>{document.getElementById('splash')?.remove();closeModal();window.GSBackend.user={id:'browser-fixture'};render();});
  await page.locator('#gs-smart-job').selectOption('j');await page.locator('[data-smart=draft]').click();
  assert.match(await page.locator('#gs-smart-draft').inputValue(),/Fail recorded/);checks++;
  const layout=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('.gs-smart .btn')].map(e=>e.getBoundingClientRect().height)}));assert(layout.width<=layout.viewport+1,JSON.stringify(layout));assert(layout.buttons.every(h=>h>=43),JSON.stringify(layout));checks++;
  await page.locator('[data-smart=append]').click();assert.equal(await page.evaluate(()=>S.jobs.j.techNotes),'Original notes');checks++;
  await page.locator('#gs-smart-reviewed').check();await page.locator('[data-smart=append]').click();assert.match(await page.evaluate(()=>S.jobs.j.techNotes),/^Original notes\n\nINSPECTION HANDOFF/);assert.equal(await page.evaluate(()=>S.jobs.j.results.u.outcome),'fail');checks++;
  await context.setOffline(true);await page.waitForFunction(()=>document.getElementById('gs-smart-status').textContent.includes('Offline'));await page.locator('[data-smart=draft]').click();assert((await page.locator('#gs-smart-draft').inputValue()).length>0);checks++;
  await context.setOffline(false);await page.waitForFunction(()=>document.getElementById('gs-smart-status').textContent.includes('Works on this device'));checks++;
  await page.locator('#gs-smart-draft').fill('Draft retained through refresh.');await page.reload();await page.evaluate(fixture);await page.evaluate(()=>{document.getElementById('splash')?.remove();closeModal();window.GSBackend.user={id:'browser-fixture'};render();});assert.equal(await page.locator('#gs-smart-draft').inputValue(),'Draft retained through refresh.');checks++;
  await page.locator('#gs-smart-query').fill('Same-time');await page.waitForFunction(()=>document.querySelectorAll('.gs-smart-item').length===1);assert.match(await page.locator('.gs-smart-item').innerText(),/Same-time/);checks++;
  await page.locator('#gs-smart-query').fill('');await page.waitForFunction(()=>document.querySelectorAll('.gs-smart-item').length>1);
  await page.evaluate(()=>{document.activeElement?.blur();window.GSBackend.role='tech';ROLE='tech';S.jobs.j2.techIds=['other'];UI.mode='field';UI.view='field-assist';render();});assert.equal(await page.locator('#gs-smart-job option[value=j2]').count(),0);assert.equal(await page.locator('#gs-smart-mode option[value=office]').count(),0);checks++;
  await page.screenshot({path:`test-results/${engine}-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);checks++;
  console.log(`PASS ${engine} ${width}px: layout, controls, draft review, unchanged result, offline/reconnect, refresh, search and roles.`);
 }catch(e){await page.screenshot({path:`test-results/FAILED-${engine}-${width}.png`,fullPage:true}).catch(()=>{});throw e;}
 finally{await browser.close();}
}
console.log(`${checks} browser assertions passed across five browser/viewport combinations.`);
})().catch(e=>{console.error(e);process.exit(1)});
