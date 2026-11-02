import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
const errors=[],requests=[];await fs.mkdir('artifacts/econ-report',{recursive:true});
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:844,height:390}]){
  const mobile=viewport.width<1000,context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,offline:true}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  // Managed Chromium disallows file: navigation. Render the authorized generated
  // document directly as an offline HTML document; no policy flags are changed.
  await page.setContent(await fs.readFile(path.resolve('docs/econ-sim/report.html'),'utf8'));
  assert.equal(await page.locator('svg').count(),21);assert.equal(await page.locator('[data-candidate]').count(),3);
  assert.equal(await page.locator('[data-panel]:visible').count(),1);
  for(let i=0;i<3;i++){
   const b=page.locator('[data-candidate="'+i+'"]');if(mobile)await b.tap();else await b.click();
   assert.equal(await b.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-panel="'+i+'"]').isVisible(),true);
   assert.equal(await page.locator('[data-panel]:visible figure').count(),7);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.locator('[data-candidate="0"]').click();await page.screenshot({path:'artifacts/econ-report/summary-'+viewport.width+'.png'});
  await page.locator('[data-panel="0"] figure').first().scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/econ-report/charts-'+viewport.width+'.png'});
  const figures=await page.locator('[data-panel="0"] figure svg').evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
  assert.ok(figures.every(x=>x.width>0&&x.width<=viewport.width&&x.height>100));
  await context.close();console.log('PASS: offline single HTML '+viewport.width+'×'+viewport.height+', all3 candidate buttons/21 inline SVGs, tables scroll inside page, no network');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS: no page errors or external network requests');
}finally{await browser.close();}
