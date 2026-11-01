import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root='docs/econ-sim/round3/',html=await fs.readFile(root+'report.html','utf8'),errors=[],requests=[],screenshots=[];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
try{
 for(const viewport of [{width:1440,height:1000},{width:844,height:390},{width:667,height:375},{width:390,height:844}]){
  const mobile=viewport.width<1000,c=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,offline:true}),p=await c.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  // Managed Chromium blocks file: navigation; keep that policy and render the
  // exact authorized standalone document offline, without network dependencies.
  await p.setContent(html);assert.equal(await p.locator('svg').count(),21);assert.equal(await p.locator('[data-nav]').count(),6);
  const click=async locator=>mobile?locator.tap():locator.click();
  for(const id of ['summary','candidates','power','hydrogen','stress','verification']){
   await click(p.locator('[data-nav="'+id+'"]'));assert.equal(await p.locator('[data-panel]:visible').count(),1);assert.equal(await p.locator('[data-nav="'+id+'"]').getAttribute('aria-pressed'),'true');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+' page overflow at'+viewport.width);
   if(id==='candidates'){
    for(let i=0;i<4;i++){await click(p.locator('[data-candidate="'+i+'"]'));assert.equal(await p.locator('[data-candidate="'+i+'"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#candidate-results tbody tr').count(),16);assert.ok((await p.locator('#candidate-description').textContent()).includes('최종 채택 아님'));}
    const table=p.locator('#candidate-results .table-scroll');if(viewport.width<640){assert.ok(await table.evaluate(e=>e.scrollWidth>e.clientWidth));await table.evaluate(e=>e.scrollLeft=e.scrollWidth);assert.ok(await table.evaluate(e=>e.scrollLeft>0));}
   }
   if(['summary','power','hydrogen','candidates'].includes(id)){
    if(id==='power'&&viewport.width===390){await p.locator('#power figure').first().scrollIntoViewIfNeeded();assert.ok(await p.locator('#power .plot-scroll').first().evaluate(e=>e.scrollWidth>e.clientWidth));await p.screenshot({path:root+'screenshots/chart-grid-390.png'});await p.evaluate(()=>scrollTo(0,0));}
    const file='screenshots/'+id+'-'+viewport.width+'.png';await p.screenshot({path:root+file});screenshots.push(file);
   }
  }
  assert.ok((await p.locator('body').textContent()).includes('2.5U/월'));assert.ok((await p.locator('body').textContent()).includes('부분 충족을 최종 합격으로 표시하지 않았습니다'));
  await c.close();console.log('PASS: '+viewport.width+'×'+viewport.height+', offline,6 tabs,4 candidates×16 scenarios,21 SVGs, internal table scroll, no body overflow');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS: no page errors or external HTTP requests');
 await fs.writeFile(root+'logs/report-browser.json',JSON.stringify({viewports:4,charts:21,candidates:4,scenarios:16,externalRequests:requests.length,pageErrors:errors.length,screenshots,directFileNavigation:'Not directly tested: managed browser file: restriction; exact HTML rendered with setContent',physicalSafari:'not tested'},null,2)+'\n');
}finally{await browser.close();}
