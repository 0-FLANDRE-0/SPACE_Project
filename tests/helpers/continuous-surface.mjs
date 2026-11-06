// UI1 exits the derived surface stage with zoom, rather than a hidden mode toolbar.
export async function leaveSurface(page){
 for(let n=0;n<8&&await page.evaluate(()=>!!spacePrototype.surfaceUI.active);n++){
  await page.locator('#zoom-out').click();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 }
 await page.waitForFunction(()=>!spacePrototype.surfaceUI.active);
}
// Close zoom can put every tile centre outside a short landscape viewport.
// Sample exposed interiors instead; verify neighbouring rays agree before returning.
export async function surfacePoints(page,{limit=2,kind=null,avoidTargets=false,skipShips=true}={}){
 await page.evaluate(()=>window.__ui1PickPrevious=null);
 await page.waitForFunction(()=>{const a=spacePrototype,v=a.viewer;if(v.transition)return false;const values=[...v.camera.position.toArray(),...v.controls.target.toArray(),a.ui1?.offset.x??0,a.ui1?.offset.y??0],prior=window.__ui1PickPrevious;window.__ui1PickPrevious=values;return prior&&Math.hypot(...values.map((n,i)=>n-prior[i]))<.01;});
 return page.evaluate(({limit,kind,avoidTargets,skipShips})=>{
  const a=spacePrototype,v=a.viewer,s=v.surface;if(!s)return[];
  const header=document.querySelector('.top-hud').getBoundingClientRect(),box=v.container.getBoundingClientRect(),centre=v.projectWorld(s.entry.root.position),candidates=[],out=[],seen=new Set();
  for(let y=header.bottom+16;y<v.height-76;y+=13)for(let x=20;x<v.width-20;x+=13)candidates.push({x,y});
  candidates.sort((p,q)=>Math.hypot(p.x-centre.x,p.y-centre.y)-Math.hypot(q.x-centre.x,q.y-centre.y));
  for(const p of candidates){const x=p.x+box.x,y=p.y+box.y;if(document.elementFromPoint(x,y)!==v.renderer.domElement)continue;
   if(skipShips&&a.shipUI?.layer.pickShip(x,y,'touch'))continue;
   if(avoidTargets&&a.shipUI?.targetMode&&a.shipUI.layer.pickTarget(x,y,'touch',{includeBodies:false}))continue;
   v.setRay(x,y);const t=s.pick(v.raycaster.ray)?.tile;if(!t||seen.has(t.id)||(kind&&t.kind!==kind))continue;
   if(![[-3,0],[3,0],[0,-3],[0,3]].every(([dx,dy])=>{v.setRay(x+dx,y+dy);return s.pick(v.raycaster.ray)?.tile.id===t.id;}))continue;
   out.push({id:t.id,x,y,visible:true});seen.add(t.id);if(out.length>=limit)break;
  }return out;
 },{limit,kind,avoidTargets,skipShips});
}
export function assertCameraStable(actual,expected){
 if(actual.length!==expected.length||Math.hypot(...actual.map((n,i)=>n-expected[i]))>=1e-8)throw Error('World camera translated: '+JSON.stringify({actual,expected}));
}
