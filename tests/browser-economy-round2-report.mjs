import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
const errors=[],requests=[],data=JSON.parse(await fs.readFile('docs/econ-sim/round2/results.json'));
await fs.mkdir('artifacts/econ2-report',{recursive:true});
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:844,height:390},{width:667,height:375}]){
  const mobile=viewport.width<1000,c=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,offline:true}),p=await c.newPage();
  p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  // Managed browser blocks file: navigation. Render the authorized standalone
  // document offline without changing browser policies.
  await p.setContent(await fs.readFile('docs/econ-sim/round2/report.html','utf8'));
  assert.equal(await p.locator('svg').count(),34);assert.equal(await p.locator('[data-candidate]').count(),4);
  for(let i=0;i<4;i++){
   const b=p.locator('[data-candidate="'+i+'"]');if(mobile)await b.tap();else await b.click();
   assert.equal(await b.getAttribute('aria-pressed'),'true');assert.equal(await p.locator('[data-panel]:visible').count(),1);assert.equal(await p.locator('[data-panel]:visible figure').count(),8);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  const text=await p.locator('body').textContent();assert.ok(text.includes('1.3333'));assert.ok(text.includes(String(data.sampling.passing)+'개'));assert.ok(text.includes('S1-sell'));
  await p.screenshot({path:'artifacts/econ2-report/recommended-'+viewport.width+'.png'});
  await p.locator('[data-panel="3"] figure').first().scrollIntoViewIfNeeded();await p.screenshot({path:'artifacts/econ2-report/charts-'+viewport.width+'.png'});
  await p.locator('[data-panel="3"] figure').last().scrollIntoViewIfNeeded();await p.screenshot({path:'artifacts/econ2-report/selling-'+viewport.width+'.png'});
  await c.close();console.log('PASS: offline round2 '+viewport.width+'×'+viewport.height+',4 profiles/34 inline SVGs, rounded and selling comparison, tables contained, no external requests');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS: no page errors or external HTTP requests');
}finally{await browser.close();}
