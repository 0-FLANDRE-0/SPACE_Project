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
try {
  const response=await page.goto(baseURL,{waitUntil:'networkidle'});assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.spacePrototype?.viewer);
  assert.equal(await page.locator('#loading.hidden').count(),1);
  assert.equal(await page.evaluate(()=>spacePrototype.viewer.bodies.size),20);
  assert.equal(await page.evaluate(()=>spacePrototype.viewer.belts.size),2);
  await page.screenshot({path:'artifacts/overview.png'});

  await page.locator('.body-row[data-select="earth"]').click();
  assert.equal(await page.evaluate(()=>spacePrototype.simulation.selectedId),'earth');
  assert.ok(await page.evaluate(()=>spacePrototype.viewer.orbits.get('earth').material.opacity>spacePrototype.viewer.orbits.get('mars').material.opacity*8));
  await page.locator('[data-focus-orbit="earth"]').click();
  await page.waitForFunction(()=>!spacePrototype.viewer.transition);
  assert.ok(await page.locator('.body-label[data-body-id="moon"]').isVisible());
  await page.screenshot({path:'artifacts/earth-orbit.png'});
  await page.locator('[data-focus="earth"]').click();
  await page.waitForFunction(()=>!spacePrototype.viewer.transition);
  await page.waitForFunction(()=>document.querySelector('#scale').dataset.unit==='km');
  assert.equal(await page.evaluate(()=>spacePrototype.viewer.surfaces.earth.image.naturalWidth),2048);
  assert.ok(await page.evaluate(()=>Math.abs(spacePrototype.viewer.bodies.get('earth').displayRadius/spacePrototype.viewer.bodies.get('earth').body.radius-1)<.001));
  assert.ok(await page.evaluate(()=>spacePrototype.viewer.bodies.get('earth').axis.visible));
  await page.screenshot({path:'artifacts/earth-focused.png'});

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
  assert.ok(await page.evaluate(()=>spacePrototype.viewer.camera.position.distanceTo(spacePrototype.viewer.controls.target)<7));
  assert.equal(await page.evaluate(()=>spacePrototype.simulation.selectedId),null);
  await page.locator('#help').click();assert.ok(await page.locator('#help-dialog').isVisible());
  await page.locator('#close-help').click();

  // A real touch-sized viewport still exposes all controls without horizontal overflow.
  const mobile=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  mobile.on('pageerror',e=>errors.push(String(e)));
  await mobile.goto(baseURL,{waitUntil:'networkidle'});await mobile.waitForFunction(()=>window.spacePrototype?.viewer);
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.locator('.body-row[data-select="saturn"]').tap();assert.equal(await mobile.evaluate(()=>spacePrototype.simulation.selectedId),'saturn');
  await mobile.locator('[data-focus="saturn"]').tap();await mobile.waitForFunction(()=>!spacePrototype.viewer.transition);
  await mobile.waitForFunction(()=>document.querySelector('#scale').dataset.unit==='km');
  assert.equal(await mobile.locator('.detail-stats').isVisible(),false);
  await mobile.locator('[data-expand]').tap();assert.equal(await mobile.locator('.detail-stats').isVisible(),true);
  await mobile.locator('[data-expand]').tap();assert.equal(await mobile.locator('.detail-stats').isVisible(),false);
  await mobile.screenshot({path:'artifacts/mobile-landscape-saturn.png'});
  const axisCorrect=await mobile.evaluate(()=>{const e=spacePrototype.viewer.bodies.get('saturn'),normal=e.root.position.clone().set(0,1,0).transformDirection(e.mesh.matrixWorld),pole=e.root.position.clone().set(0,1,0).applyQuaternion(e.axisFrame.quaternion);return normal.dot(pole)>.99999;});assert.ok(axisCorrect);
  await mobile.locator('.body-row[data-select="earth"]').tap();await mobile.locator('[data-focus="earth"]').tap();await mobile.waitForFunction(()=>!spacePrototype.viewer.transition);
  await mobile.waitForFunction(()=>document.querySelector('#scale').dataset.unit==='km');
  await mobile.screenshot({path:'artifacts/mobile-landscape-earth.png'});
  await mobile.close();
  const small=await browser.newPage({viewport:{width:667,height:375},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await small.goto(baseURL,{waitUntil:'networkidle'});await small.waitForFunction(()=>window.spacePrototype?.viewer);
  assert.ok(await small.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await small.locator('.body-row[data-select="earth"]').tap();await small.locator('[data-focus="earth"]').tap();await small.waitForFunction(()=>!spacePrototype.viewer.transition);
  await small.waitForFunction(()=>document.querySelector('#scale').dataset.unit==='km');
  await small.screenshot({path:'artifacts/mobile-small-landscape.png'});await small.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: initial render, 20 bodies, 2 belts, selected orbit, moving moon, pause/resume/speed, camera rotation/zoom + canvas picking, satellite selection, belt emphasis, overlays, side/home view, help and mobile touch layout. AU/km scale transition, real Earth texture, true close-up radius, IAU local-axis alignment and 844×390 / 667×375 landscape touch layouts. No browser errors.');
} finally { await browser.close(); }
