import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const base=process.env.BASE_URL||'http://127.0.0.1:5173',errors=[];
const raw=await fs.readFile('tests/fixtures/industry-v1-sol-full.json','utf8'),prefix='space-project:resource-unit-packaging:backup:v1:';
const dir='docs/resource-cargo-scu/screenshots';await fs.mkdir(dir,{recursive:true});
const click=async(p,s)=>p.viewportSize().width<1000?p.locator(s).tap():p.locator(s).click();
async function file(p,text){await p.locator('#industry-import').setInputFiles({name:'industry-save.json',mimeType:'application/json',buffer:Buffer.from(text)});await p.waitForFunction(()=>document.querySelector('#industry-file-status').textContent.includes('검증 완료'));}
async function apply(p){await p.locator('#industry-import-confirm').check();await click(p,'#industry-import-apply');}
try{
 for(const viewport of [{width:1440,height:1000},{width:844,height:390}]){
  const c=await browser.newContext({viewport,hasTouch:viewport.width<1000,isMobile:viewport.width<1000,acceptDownloads:true});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(base+'/?dev=1',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.spacePrototype?.industry.ready);await click(p,'#pause');
  await p.evaluate(()=>{localStorage.setItem('another-project:save','keep');return spacePrototype.industry.switchCampaign(true);});await p.waitForFunction(()=>!spacePrototype.viewer.transition);
  assert.equal(await p.evaluate(()=>spacePrototype.industry.catalog.bodies.size),19);
  await p.evaluate(()=>{const a=spacePrototype.industry;a.dirty=true;a.render();});
  assert.match(await p.locator('#industry-hydrogen-known').innerText(),/미가격화 임시 호환.*소재 회수0/);
  await p.locator('#industry-hydrogen-known').scrollIntoViewIfNeeded();await p.waitForFunction(()=>!document.querySelector('#toast').classList.contains('visible'));
  await p.screenshot({path:`${dir}/compatibility-${viewport.width}.png`});
  await click(p,'#surface-info-close');await click(p,'#industry-files-toggle');
  const before=await p.evaluate(()=>JSON.stringify(spacePrototype.industry.store.state));await file(p,raw);
  assert.equal(await p.evaluate(()=>JSON.stringify(spacePrototype.industry.store.state)),before);
  assert.equal(await p.evaluate(prefix=>Object.keys(localStorage).filter(k=>k.startsWith(prefix)).length,prefix),0);
  await apply(p);const backup=await p.evaluate(()=>spacePrototype.industry.store.migrationBackupKey);
  assert.ok(backup.startsWith(prefix));assert.equal(await p.evaluate(k=>localStorage.getItem(k),backup),raw);
  assert.equal(await p.evaluate(()=>spacePrototype.industry.store.state.schemaVersion),3);
  assert.equal(await p.evaluate(()=>spacePrototype.industry.store.state.planetInventory.earth.human.hydrogen),500000);
  const first=await p.evaluate(()=>JSON.stringify(spacePrototype.industry.store.state));await file(p,raw);await apply(p);
  assert.equal(await p.evaluate(()=>JSON.stringify(spacePrototype.industry.store.state)),first);
  assert.equal(await p.evaluate(prefix=>Object.keys(localStorage).filter(k=>k.startsWith(prefix)).length,prefix),1);
  await p.evaluate(async()=>{const {consumeIndustryPackaged}=await import('/src/industry-packaging.js');const a=spacePrototype.industry,s=a.store.state,before=s.planetInventory.earth.human.alloy;const result=consumeIndustryPackaged(s,a.catalog,{bodyId:'earth',ownerId:'human'},'hydrogen',1000,'explicit-browser-test');if(Object.keys(result.returnedQ).length||s.planetInventory.earth.human.alloy!==before)throw Error('legacy material minted');});
  const event=p.waitForEvent('download');await click(p,'#industry-export');const saved=await event,v2=await fs.readFile(await saved.path(),'utf8');assert.equal(JSON.parse(v2).schemaVersion,3);
  await p.evaluate(()=>{window.beforeDenied=JSON.stringify(spacePrototype.industry.store.state);window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('space-project:resource-unit-packaging:backup:'))throw Error('test backup denied');return realSet.call(this,k,v);};});
  // A different byte representation needs its own preserved original; refusal must leave live state untouched.
  await file(p,JSON.stringify(JSON.parse(raw)));await apply(p);
  assert.equal(await p.evaluate(()=>JSON.stringify(spacePrototype.industry.store.state)===beforeDenied),true);
  assert.match(await p.locator('#industry-message').textContent(),/test backup denied/);
  await p.evaluate(()=>Storage.prototype.setItem=realSet);
  await file(p,v2);await apply(p);assert.equal(await p.evaluate(()=>spacePrototype.industry.store.state.planetInventory.earth.human.hydrogen),499000);
  const bad=JSON.parse(raw);bad.sourceSignatures.earth='corrupt';await p.locator('#industry-import').setInputFiles({name:'bad-v1.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await p.waitForFunction(()=>document.querySelector('#industry-file-status').textContent.includes('가져오기 거부'));assert.equal(await p.locator('#industry-import-apply').isDisabled(),true);
  await p.reload({waitUntil:'networkidle'});await p.waitForFunction(()=>window.spacePrototype?.industry.ready);await click(p,'#pause');
  assert.equal(await p.evaluate(()=>spacePrototype.industry.store.state.fixture),false);assert.deepEqual(await p.evaluate(()=>spacePrototype.industry.store.state.planetInventory),{});
  assert.equal(await p.evaluate(k=>localStorage.getItem(k),backup),raw);assert.equal(await p.evaluate(()=>localStorage.getItem('another-project:save')),'keep');
  await p.evaluate(()=>spacePrototype.industry.switchCampaign(true));await p.waitForFunction(()=>!spacePrototype.viewer.transition);
  assert.equal(await p.evaluate(()=>spacePrototype.industry.store.state.planetInventory.earth.human.hydrogen),500000);
  assert.equal(await p.evaluate(()=>spacePrototype.industry.store.state.days),0);
  console.log(`PASS: ${viewport.width}×${viewport.height} actual19 catalog, unpriced UI, v1 preview/backup/migration/repeat, zero legacy recovery, v3 export/import, backup denial atomicity, malformed signature rejection, reload reset and protected original/foreign storage`);
  await c.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: no browser page/console errors');
}finally{await browser.close();}
