import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist']});
const base=process.env.BASE_URL||'http://127.0.0.1:5173',dir='docs/m1a',errors=[],results=[];
await fs.mkdir(dir+'/screenshots',{recursive:true});
const settle=p=>p.waitForFunction(()=>!spacePrototype.viewer.transition);
const click=(p,s)=>p.viewportSize().width<1000?p.locator(s).tap():p.locator(s).click();
async function speed(p,n){await click(p,'#speed-menu-toggle');await click(p,`[data-speed="${n}"]`);}
async function select(p,id){await click(p,'#fleet-toggle');await click(p,`[data-fleet-ship="${id}"]`);}
async function bodyPoint(p,id){return p.evaluate(id=>{const a=spacePrototype;return a.viewer.projectionFor(id);},id);}
async function aimBody(p,id,mobile){await p.evaluate(id=>spacePrototype.viewer.focus(id),id);await settle(p);if(mobile)await click(p,'#ship-move');const point=await bodyPoint(p,id);assert.ok(point.visible);if(mobile)await p.touchscreen.tap(point.x,point.y);else await p.mouse.click(point.x,point.y,{button:'right'});}
async function shot(p,name){await p.screenshot({path:`${dir}/screenshots/${name}-${p.viewportSize().width}.png`});}
try{
  for(const viewport of [{width:1440,height:900},{width:844,height:390},{width:667,height:375},{width:390,height:844}].filter(v=>!process.env.M1A_WIDTH||v.width===Number(process.env.M1A_WIDTH))){
    const mobile=viewport.width<1000,c=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile}),p=await c.newPage();
    p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    assert.equal((await p.goto(base,{waitUntil:'networkidle'})).status(),200);await p.waitForFunction(()=>window.spacePrototype?.fleet&&spacePrototype.industry.ready);await click(p,'#pause');
    assert.equal(await p.evaluate(()=>spacePrototype.fleet.ships.size),3);await select(p,'explorer-1');await shot(p,'icons-selected');
    const bounds=await p.locator('.ship-info').boundingBox();assert.ok(bounds.width<viewport.width*(viewport.width>viewport.height?.46:.6));assert.ok(bounds.height<viewport.height*(viewport.width>viewport.height?.8:.45));
    await click(p,'#ship-focus');await settle(p);await p.waitForFunction(()=>spacePrototype.shipUI.layer.projections.get('explorer-1').mode==='model');
    const projected=await p.evaluate(()=>spacePrototype.shipUI.layer.projections.get('explorer-1'));assert.ok(projected.pixelLength>=viewport.height*.044);await click(p,'#ship-close');assert.equal(await p.evaluate(()=>spacePrototype.shipUI.layer.followId),null);
    if(mobile)await p.touchscreen.tap(projected.x,projected.y);else await p.mouse.click(projected.x,projected.y);
    assert.equal(await p.evaluate(()=>spacePrototype.selection?.shipId),'explorer-1');
    assert.ok(await p.evaluate(()=>{let n=0;spacePrototype.shipUI.layer.entries.get('explorer-1').mesh.traverse(o=>{if(o.userData.shipOutline&&o.visible)n++;});return n>0;}));await shot(p,'3d-outline');
    await p.evaluate(()=>spacePrototype.viewer.zoom(20));await p.waitForFunction(()=>spacePrototype.shipUI.layer.projections.get('explorer-1').mode==='icon');await click(p,'.ship-icon[data-ship-id="explorer-1"]');
    await click(p,'#ship-move');assert.ok(await p.locator('.ship-target-prompt').isVisible());await click(p,'#ship-back');assert.equal(await p.evaluate(()=>spacePrototype.shipUI.targetMode),false);
    await p.evaluate(()=>spacePrototype.viewer.focus('earth','orbit'));await settle(p);await p.evaluate(()=>spacePrototype.viewer.setView('top'));await settle(p);if(viewport.width<viewport.height){await click(p,'#zoom-out');await click(p,'#zoom-out');}await click(p,'#ship-move');await shot(p,'target-mode');
    const moon=await bodyPoint(p,'moon');assert.ok(moon.visible);if(mobile)await p.touchscreen.tap(moon.x,moon.y);else{await click(p,'#ship-back');await p.mouse.click(moon.x,moon.y,{button:'right'});}
    assert.equal(await p.evaluate(()=>spacePrototype.fleet.ships.get('explorer-1').plan?.target.bodyId),'moon',JSON.stringify(await p.evaluate(p=>({point:p,element:document.elementFromPoint(p.x,p.y)?.outerHTML,toast:document.querySelector('#toast').textContent,selection:spacePrototype.selection,targetMode:spacePrototype.shipUI.targetMode,ship:spacePrototype.fleet.ships.get('explorer-1').state}),moon)));
    await speed(p,360);await click(p,'#pause');await p.waitForFunction(()=>spacePrototype.fleet.ships.get('explorer-1').state==='charging');await click(p,'#pause');
    assert.equal(await p.locator('#ship-move').getAttribute('aria-label'),'이동 취소');assert.ok(await p.locator('#ship-progress').isVisible());await shot(p,'charging-cancel');await click(p,'#ship-replot');assert.ok(await p.locator('.ship-target-prompt').isVisible());await click(p,'#ship-back');assert.equal(await p.evaluate(()=>spacePrototype.fleet.ships.get('explorer-1').plan.target.bodyId),'moon');
    await click(p,'#ship-move');assert.equal(await p.evaluate(()=>spacePrototype.fleet.ships.get('explorer-1').plan),null);
    await aimBody(p,'saturn',mobile);assert.equal(await p.evaluate(()=>spacePrototype.fleet.ships.get('explorer-1').plan.target.bodyId),'saturn');
    await p.locator('#ship-auto-pause').check();await speed(p,8640);const arrivalAt=await p.evaluate(()=>spacePrototype.fleet.ships.get('explorer-1').plan.arrivalAt);await click(p,'#pause');await p.waitForFunction(()=>spacePrototype.simulation.paused&&spacePrototype.fleet.ships.get('explorer-1').state==='idle');
    const clocks=await p.evaluate(()=>({game:spacePrototype.simulation.days*86400,industry:spacePrototype.industry.store.state.days*86400,fleet:spacePrototype.fleet.now,attachment:spacePrototype.fleet.ships.get('explorer-1').attachment.bodyId}));for(const n of [clocks.game,clocks.industry,clocks.fleet])assert.ok(Math.abs(n-arrivalAt)<1e-6);assert.equal(clocks.attachment,'saturn');
    // Natural Sol detour, selected through a real 210gAU lattice vertex.
    await click(p,'#home');await settle(p);await select(p,'support-1');
    const waypoint=await p.evaluate(()=>{const a=spacePrototype,s=a.fleet.ships.get('support-1'),sun=a.context.gamePosition('sun',a.simulation.days),subtract=(u,v)=>({x:u.x-v.x,y:u.y-v.y,z:u.z-v.z}),dot=(u,v)=>u.x*v.x+u.y*v.y+u.z*v.z;return a.fleet.destinations.filter(d=>d.kind==='point').map(d=>{const v=subtract(d.position,s.position),u=subtract(sun,s.position),t=Math.max(0,Math.min(1,dot(u,v)/dot(v,v))),miss=Math.hypot(s.position.x+t*v.x-sun.x,s.position.y+t*v.y-sun.y,s.position.z+t*v.z-sun.z),p=a.viewer.projectWorld({x:d.position.x*140/53,y:d.position.y*140/53,z:d.position.z*140/53});return{d,miss,p};}).filter(x=>x.p.visible&&x.p.x>90&&x.p.x<a.viewer.width-80&&x.p.y>100&&x.p.y<a.viewer.height-145).sort((a,b)=>a.miss-b.miss)[0];});assert.ok(waypoint&&waypoint.miss<13.25);
    if(mobile){await click(p,'#ship-move');await p.touchscreen.tap(waypoint.p.x,waypoint.p.y);}else await p.mouse.click(waypoint.p.x,waypoint.p.y,{button:'right'});
    assert.ok(await p.evaluate(()=>spacePrototype.fleet.ships.get('support-1').plan?.waypoints.some(p=>p.kind==='detour')));await shot(p,'detour-route');
    if(mobile)await click(p,'#ship-move');else await p.keyboard.press('c');assert.equal(await p.evaluate(()=>spacePrototype.fleet.ships.get('support-1').plan),null);
    await click(p,'#ship-focus');await settle(p);await shot(p,'support-3d');await click(p,'#home');await settle(p);await select(p,'support-1');
    // Foreground timing measured with the actual 1day/sec menu and RAF loop.
    await p.locator('#ship-auto-pause').uncheck();await click(p,'#pause');
    const perf=await p.evaluate(async()=>{const starts={game:spacePrototype.simulation.days,wall:performance.now()},deltas=[];let previous=performance.now();for(let i=0;i<30;i++)await new Promise(resolve=>requestAnimationFrame(t=>{deltas.push(t-previous);previous=t;resolve();}));const finish=performance.now();deltas.sort((a,b)=>a-b);return{frames:deltas.length,medianMs:deltas[Math.floor(deltas.length*.5)],p95Ms:deltas[Math.floor(deltas.length*.95)],maxMs:Math.max(...deltas),wallSeconds:(finish-starts.wall)/1000,gameSeconds:(spacePrototype.simulation.days-starts.game)*86400};});await click(p,'#pause');assert.ok(Math.abs(perf.gameSeconds/perf.wallSeconds-86400)<86400*.1);
    results.push({viewport,bounds,clocks,arrivalAt,performance:perf,checks:'mesh tap + outline, icon hysteresis, back, body target, charge/X, 8640× arrival auto-pause + industry clock, vertex detour, C/X cancel'});
    await p.reload({waitUntil:'networkidle'});await p.waitForFunction(()=>window.spacePrototype?.fleet);assert.ok(await p.evaluate(()=>[...spacePrototype.fleet.ships.values()].every(s=>!s.plan&&s.attachment.bodyId==='earth')));await c.close();console.log('PASS M1a',viewport.width+'×'+viewport.height,JSON.stringify(perf));
  }
  assert.deepEqual(errors,[]);await fs.writeFile(dir+(process.env.M1A_WIDTH?'/browser-results-'+process.env.M1A_WIDTH+'.json':'/browser-results.json'),JSON.stringify({results,errors,renderer:'Chromium / SwiftShader software rendering'},null,2));console.log('PASS all M1a browser stories; no console, runtime or HTTP errors');
}finally{await browser.close();}
