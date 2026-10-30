import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  headless:true,
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'],
});
const errors=[];
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const baseURL=process.env.BASE_URL || 'http://127.0.0.1:5173';
await fs.mkdir('artifacts',{recursive:true});
const shot=async(p,name)=>p.screenshot({path:'artifacts/v03-'+name+'.png'});
const settled=async p=>{await p.waitForFunction(()=>!spacePrototype.viewer.transition);await p.waitForTimeout(180);};
const radii=p=>p.evaluate(()=>[...spacePrototype.viewer.bodies].map(([id,e])=>[id,e.visual.scale.x]));
async function clickAssistedMoon(p,touch=false){
  const position=await p.evaluate(()=>{const v=spacePrototype.viewer,c=v.screenCandidates(),m=c.find(x=>x.id==='moon'),e=c.find(x=>x.id==='earth'),r=v.container.getBoundingClientRect();if(!m.visible)throw Error('Moon is occluded');const d=Math.hypot(m.x-e.x,m.y-e.y),offset=m.pixelRadius+3;return {x:r.x+m.x+(m.x-e.x)/d*offset,y:r.y+m.y+(m.y-e.y)/d*offset,pixelRadius:m.pixelRadius};});
  assert.ok(position.pixelRadius<(touch?15:9));
  if(touch)await p.touchscreen.tap(position.x,position.y);else await p.mouse.click(position.x,position.y);
  assert.equal(await p.evaluate(()=>spacePrototype.simulation.selectedId),'moon');
}
try {
  const response=await page.goto(baseURL,{waitUntil:'networkidle'});assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.spacePrototype?.viewer);
  assert.equal(await page.locator('#loading.hidden').count(),1);
  assert.equal(await page.evaluate(()=>spacePrototype.viewer.bodies.size),20);
  assert.equal(await page.evaluate(()=>spacePrototype.viewer.belts.size),2);
  const fixedRadii=await radii(page);
  assert.equal(await page.evaluate(()=>spacePrototype.viewer.validation.valid),true);
  assert.equal(await page.evaluate(()=>spacePrototype.viewer.controls.minDistance),42);
  assert.equal(await page.evaluate(()=>spacePrototype.viewer.bodies.get('sun').visual.scale.x),35);
  assert.equal(await page.evaluate(()=>spacePrototype.viewer.bodies.get('earth').visual.scale.x),7.5);
  await shot(page,'overview');
  await page.locator('#inner-system').click();await settled(page);await shot(page,'inner');
  console.log('PASS: overall/inner framing, fixed planet/star size, valid orbital envelopes');

  await page.locator('.body-row[data-select="earth"]').click();
  assert.equal(await page.evaluate(()=>spacePrototype.simulation.selectedId),'earth');
  assert.ok(await page.evaluate(()=>spacePrototype.viewer.orbits.get('earth').material.opacity>spacePrototype.viewer.orbits.get('mars').material.opacity*8));
  await page.locator('[data-focus-orbit="earth"]').click();
  await page.waitForFunction(()=>!spacePrototype.viewer.transition);
  await page.locator('[data-view="top"]').click();await settled(page);
  assert.ok(await page.locator('.body-label[data-body-id="moon"]').isVisible());
  await shot(page,'earth-moon');
  await page.locator('#toggle-labels').click();await clickAssistedMoon(page);
  await page.locator('[data-focus="moon"]').click();await settled(page);await shot(page,'moon-close');
  await page.locator('#toggle-labels').click();
  await page.locator('.body-row[data-select="earth"]').click();
  await page.locator('[data-focus="earth"]').click();
  await page.waitForFunction(()=>!spacePrototype.viewer.transition);
  await page.waitForFunction(()=>document.querySelector('#scale').dataset.unit==='AU');
  assert.equal(await page.evaluate(()=>spacePrototype.viewer.surfaces.earth.image.naturalWidth),2048);
  assert.ok(await page.evaluate(()=>spacePrototype.viewer.bodies.get('earth').visual.scale.x===7.5));
  assert.ok(await page.evaluate(()=>spacePrototype.viewer.bodies.get('earth').axis.visible));
  await shot(page,'earth-close');
  assert.deepEqual(await radii(page),fixedRadii);
  console.log('PASS: Earth/Moon approaches, mouse assistance, reference texture and constant game radii');

  await page.locator('#pause').click();
  const paused=await page.evaluate(()=>({days:spacePrototype.simulation.days,earth:spacePrototype.viewer.bodies.get('earth').root.position.toArray()}));
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>({days:spacePrototype.simulation.days,earth:spacePrototype.viewer.bodies.get('earth').root.position.toArray()})),paused);
  await page.locator('[data-speed="50"]').click();await page.locator('#pause').click();
  await page.waitForTimeout(300);assert.ok(await page.evaluate(days=>spacePrototype.simulation.days>days,paused.days));
  await page.locator('#pause').click();await page.locator('[data-speed="1"]').click();

  // Rotate and zoom the actual canvas, then select a mesh through the raycaster.
  const rect=await page.locator('#viewport').boundingBox();
  const cameraBefore=await page.evaluate(()=>spacePrototype.viewer.camera.position.toArray());
  await page.mouse.move(rect.x+rect.width*.35,rect.y+rect.height*.30);
  await page.mouse.down();await page.mouse.move(rect.x+rect.width*.48,rect.y+rect.height*.37,{steps:12});await page.mouse.up();
  await page.waitForTimeout(350);
  assert.notDeepEqual(await page.evaluate(()=>spacePrototype.viewer.camera.position.toArray()),cameraBefore);
  await page.mouse.wheel(0,-100);await page.waitForTimeout(300);
  await page.evaluate(()=>spacePrototype.select(null));
  const earthPixel=await page.evaluate(()=>{
    const v=spacePrototype.viewer, p=v.bodies.get('earth').root.position.clone().project(v.camera),r=v.container.getBoundingClientRect();
    return {x:r.x+(p.x*.5+.5)*r.width,y:r.y+(-p.y*.5+.5)*r.height};
  });
  await page.mouse.click(earthPixel.x,earthPixel.y);
  assert.equal(await page.evaluate(()=>spacePrototype.simulation.selectedId),'earth');

  await page.locator('.moon-row[data-select="moon"]').click();
  assert.equal(await page.evaluate(()=>spacePrototype.simulation.selectedId),'moon');
  assert.ok(await page.evaluate(()=>spacePrototype.viewer.orbits.get('moon').material.opacity>spacePrototype.viewer.orbits.get('earth').material.opacity));
  await page.locator('.body-row[data-select="asteroid-belt"]').click();
  assert.ok(await page.evaluate(()=>spacePrototype.viewer.belts.get('asteroid-belt').edges[0].material.opacity>.5));

  await page.locator('#toggle-orbits').click();
  await page.waitForFunction(()=>[...spacePrototype.viewer.orbits.values()].every(o=>!o.visible));
  await page.locator('#toggle-orbits').click();
  await page.locator('#toggle-labels').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.body-label')].every(e=>e.style.display==='none'));
  await page.locator('#toggle-labels').click();
  await page.locator('#toggle-plane').click();assert.equal(await page.evaluate(()=>spacePrototype.viewer.referencePlane.visible),true);
  await page.locator('#toggle-plane').click();
  await page.locator('[data-view="side"]').click();await page.waitForFunction(()=>!spacePrototype.viewer.transition);
  assert.ok(await page.evaluate(()=>{const v=spacePrototype.viewer,d=v.camera.position.clone().sub(v.controls.target);return Math.abs(d.y/d.length())<.05;}));
  await page.locator('#reset-view').click();await page.waitForFunction(()=>!spacePrototype.viewer.transition);
  await page.waitForFunction(()=>document.querySelector('#scale').dataset.unit==='AU');
  await page.locator('#inner-system').click();await page.waitForFunction(()=>!spacePrototype.viewer.transition);
  assert.ok(await page.evaluate(()=>spacePrototype.viewer.camera.position.distanceTo(spacePrototype.viewer.controls.target)<550));
  assert.equal(await page.evaluate(()=>spacePrototype.simulation.selectedId),null);
  for(const id of ['jupiter','saturn']){await page.locator('.body-row[data-select="'+id+'"]').click();await page.locator('[data-focus-orbit="'+id+'"]').click();await settled(page);await shot(page,id+'-close');}
  assert.deepEqual(await radii(page),fixedRadii);
  const occlusion=await page.evaluate(()=>{const v=spacePrototype.viewer,e=v.bodies.get('earth').root.position.clone();v.followId=null;v.camera.position.copy(e.clone().normalize().multiplyScalar(-1500));v.controls.target.copy(e);v.controls.update();v.camera.updateMatrixWorld();return v.screenCandidates().find(c=>c.id==='earth').visible;});assert.equal(occlusion,false);
  console.log('PASS: picking after rotation/zoom, time/pause/speed, overlays, belts, Jupiter/Saturn, occlusion');
  await page.locator('#help').click();assert.ok(await page.locator('#help-dialog').isVisible());
  await page.locator('#close-help').click();

  // A real touch-sized viewport still exposes all controls without horizontal overflow.
  const mobile=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  mobile.on('pageerror',e=>errors.push(String(e)));
  await mobile.goto(baseURL,{waitUntil:'networkidle'});await mobile.waitForFunction(()=>window.spacePrototype?.viewer);
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.locator('.body-row[data-select="saturn"]').tap();assert.equal(await mobile.evaluate(()=>spacePrototype.simulation.selectedId),'saturn');
  await mobile.locator('[data-focus="saturn"]').tap();await mobile.waitForFunction(()=>!spacePrototype.viewer.transition);
  await mobile.waitForFunction(()=>document.querySelector('#scale').dataset.unit==='AU');
  assert.equal(await mobile.locator('.reference-stats').isVisible(),false);
  await mobile.locator('[data-expand]').tap();assert.equal(await mobile.locator('.reference-stats').isVisible(),true);
  await mobile.locator('[data-expand]').tap();assert.equal(await mobile.locator('.reference-stats').isVisible(),false);
  await mobile.locator('#details').evaluate(e=>e.scrollTop=0);
  await shot(mobile,'mobile-saturn');
  const axisCorrect=await mobile.evaluate(()=>{const e=spacePrototype.viewer.bodies.get('saturn'),normal=e.root.position.clone().set(0,1,0).transformDirection(e.mesh.matrixWorld),pole=e.root.position.clone().set(0,1,0).applyQuaternion(e.axisFrame.quaternion);return normal.dot(pole)>.99999;});assert.ok(axisCorrect);
  await mobile.locator('.body-row[data-select="earth"]').tap();await mobile.locator('[data-focus="earth"]').tap();await mobile.waitForFunction(()=>!spacePrototype.viewer.transition);
  await mobile.waitForFunction(()=>document.querySelector('#scale').dataset.unit==='AU');
  await shot(mobile,'mobile-earth');
  await mobile.locator('[data-focus-orbit="earth"]').tap();await settled(mobile);await mobile.locator('[data-view="top"]').tap();await settled(mobile);
  await mobile.locator('#toggle-labels').tap();await clickAssistedMoon(mobile,true);await mobile.locator('#toggle-labels').tap();await shot(mobile,'mobile-moon-selected');
  await mobile.close();
  const small=await browser.newPage({viewport:{width:667,height:375},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await small.goto(baseURL,{waitUntil:'networkidle'});await small.waitForFunction(()=>window.spacePrototype?.viewer);
  assert.ok(await small.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await small.locator('.body-row[data-select="earth"]').tap();await small.locator('[data-focus="earth"]').tap();await small.waitForFunction(()=>!spacePrototype.viewer.transition);
  await small.waitForFunction(()=>document.querySelector('#scale').dataset.unit==='AU');
  await shot(small,'mobile-small-landscape');await small.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: initial render, 20 bodies, 2 belts, selected orbit, moving moon, pause/resume/speed, camera rotation/zoom + canvas picking, satellite selection, belt emphasis, overlays, side/home view, help and mobile touch layout. game AU at all zoom levels, real Earth texture, fixed game diameters, mouse/touch assistance, IAU local-axis alignment and 844×390 / 667×375 landscape touch layouts. No browser errors.');
} finally { await browser.close(); }
