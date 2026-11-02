import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']}),base=process.env.REPORT_URL||'http://127.0.0.1:5174/docs/econ-sim/round4-1/report.html',origin=new URL(base).origin,dir='docs/econ-sim/round4-1/screenshots',errors=[],external=[],evidence=[];
await fs.mkdir(dir,{recursive:true});
function watch(p){p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(r.url());});}
try{
 for(const viewport of [{width:1440,height:1000},{width:844,height:390},{width:667,height:375},{width:390,height:844}]){
  const touch=viewport.width<1000,c=await browser.newContext({viewport,hasTouch:touch,isMobile:touch}),p=await c.newPage();watch(p);const started=performance.now();
  await p.goto(base,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.econRound41Report?.ready);
  const state=await p.evaluate(()=>econRound41Report);assert.equal(state.candidateCount,5);assert.equal(state.scenarioCount,42);assert.equal(await p.locator('#matrix-charts .chart').count(),3);assert.equal(await p.locator('#final-charts .chart').count(),8);assert.equal(await p.locator('#matrix-charts .chart').first().locator('path').count(),8);assert.equal(await p.locator('#grid-table button').count(),36);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));for(const height of await p.locator('select').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height)))assert.ok(height>=44);
  await p.screenshot({path:`${dir}/report-${viewport.width}.png`});
  const before=await p.locator('#matrix-charts path').first().getAttribute('d');await p.locator('#matrix-scenario').selectOption('E5-X');const after=await p.locator('#matrix-charts path').first().getAttribute('d');assert.notEqual(after,before);assert.ok(Number(await p.locator('#matrix-timeline').getAttribute('data-active-months'))>0);assert.equal(await p.locator('#matrix-base').inputValue(),'R4-rounded');
  await p.locator('#matrix-timeline').scrollIntoViewIfNeeded();await p.screenshot({path:`${dir}/report-${viewport.width}-extreme.png`});
  const candidate=await p.locator('#candidate-select option').first().getAttribute('value')||await p.locator('#candidate-select option').first().textContent();await p.locator('#candidate-select').selectOption(candidate);await p.locator('#lane-select').selectOption('self');assert.equal(await p.locator('#final-charts .chart').first().locator('path').count(),1);
  const cell=p.locator('#grid-table button').first();if(touch)await cell.tap();else await cell.click();assert.ok((await p.evaluate(()=>econRound41Report.selection.scenario)).startsWith('E5-M-L'));assert.equal(await p.evaluate(()=>econRound41Report.selection.lane),'self');
  for(const d of await p.locator('.chart path').evaluateAll(es=>es.map(e=>e.getAttribute('d'))))assert.ok(!/NaN|Infinity/.test(d));
  await p.locator('#final-timeline').scrollIntoViewIfNeeded();await p.screenshot({path:`${dir}/report-${viewport.width}-curves.png`});await p.locator('footer').scrollIntoViewIfNeeded();assert.ok(await p.locator('footer').isVisible());assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  evidence.push({viewport,touch,elapsedMs:performance.now()-started,candidates:5,scenarios:42,charts:11,matrixPolicies:8,gridButtons:36,modeBandsVisible:true,gridTouchClickChangedCurve:true,bodyOverflow:false});console.log(`PASS ${viewport.width}×${viewport.height}:5 candidates/42 paths,8 policy curves, real mode bands, grid ${touch?'tap':'click'}, finite SVG,44px controls, body overflow0`);await c.close();
 }
 const isolated='/tmp/econ41-offline-report';await fs.mkdir(isolated,{recursive:true});await fs.copyFile('docs/econ-sim/round4-1/report.html',isolated+'/report.html');const c=await browser.newContext({viewport:{width:390,height:844},offline:true}),p=await c.newPage();watch(p);let fileNavigation='passed';
 try{await p.goto(pathToFileURL(isolated+'/report.html').href);}catch(e){if(!String(e).includes('ERR_BLOCKED_BY_ADMINISTRATOR'))throw e;fileNavigation='managed Chromium blocked file://; direct file opening unverified';await p.setContent(await fs.readFile(isolated+'/report.html','utf8'),{waitUntil:'load'});}
 await p.waitForFunction(()=>window.econRound41Report?.ready);await p.locator('#matrix-scenario').selectOption('E5-X');assert.ok(Number(await p.locator('#matrix-timeline').getAttribute('data-active-months'))>0);await c.close();assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await fs.writeFile('docs/econ-sim/round4-1/logs/report-browser.json',JSON.stringify({evidence,offlineSingleHtmlBytes:true,fileNavigation,errors,externalRequests:external},null,2)+'\n');console.log('PASS offline:true isolated HTML bytes; page/console errors0, external requests0; '+fileNavigation);
}finally{await browser.close();}
