import test from 'node:test';
import assert from 'node:assert/strict';
import { createSolContext, createSystemContext, createPlane, planePositionToGame, gamePositionToPlane, add, mul } from '../dist/src/system-context.js';
import { SYSTEM_FACTORIES, createSmallFixture, createLargeFixture } from '../dist/src/fixtures/systems.js';
import { HEX_SECTOR_RADIUS_GAME_AU as S, hexRing, sectorCountForRings, axialCoordinates, axialToPlane, axialVertices, coveredDiskRadius, findMinimalRingCount, createHexGrid, gamePositionToSector, worldPositionToSector, sectorCoordsToCenter, getSectorNeighbors, growHexGrid } from '../dist/src/hex-sectors.js';
import { worldPosition, bodyFrame, Simulation } from '../dist/src/model.js';
import { gameAUToWorld } from '../dist/src/game-space.js';
import { placeContextPanel } from '../dist/src/context-panel.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('axial uniqueness, ring distance and 1 + 3R(R+1) counts hold through eight rings',()=>{
  for(let R=0;R<=8;R++){
    const coords=axialCoordinates(R);assert.equal(coords.length,sectorCountForRings(R));assert.equal(new Set(coords.map(p=>p.q+':'+p.r)).size,coords.length);
    assert.ok(coords.every(p=>hexRing(p.q,p.r)<=R));assert.equal(axialCoordinates(R,true).length,R===0?1:6*R);
  }
});
test('all neighboring regular hexagons share exactly one full edge with no gap',()=>{
  const center=axialVertices(0,0),context=createSolContext();
  for(const n of getSectorNeighbors(context,0,0)){
    const p=axialToPlane(n.q,n.r);assert.ok(Math.abs(Math.hypot(p.u,p.v)-Math.sqrt(3)*S)<1e-8);
    const vertices=axialVertices(n.q,n.r),shared=center.filter(a=>vertices.some(b=>Math.hypot(a.u-b.u,a.v-b.v)<1e-8));assert.equal(shared.length,2);
    assert.ok(Math.abs(Math.hypot(shared[0].u-shared[1].u,shared[0].v-shared[1].v)-S)<1e-8);
  }
});
test('fixed 210 AU cells give Sol three rings and exact coverage including edge notches',()=>{
  const grid=createHexGrid(createSolContext());assert.equal(grid.radiusGameAU,210);assert.equal(grid.ringCount,3);assert.equal(grid.sectorCount,37);
  assert.ok(Math.abs(coveredDiskRadius(3)-1050)<1e-8);assert.ok(Math.abs(coveredDiskRadius(2)-Math.sqrt(13)*210)<1e-8);
  assert.ok(grid.coveredRadiusGameAU>=990);assert.ok(coveredDiskRadius(2)<990);
});
test('three system sizes share exactly the same radius and choose different minimal ring counts',()=>{
  const grids=Object.values(SYSTEM_FACTORIES).map(fn=>createHexGrid(fn()));
  assert.deepEqual(grids.map(g=>g.radiusGameAU),[S,S,S]);assert.deepEqual(grids.map(g=>g.ringCount),[3,0,6]);assert.deepEqual(grids.map(g=>g.sectorCount),[37,1,127]);
  for(const g of grids){assert.ok(g.coveredRadiusGameAU>=g.extent.paddedRadiusGameAU);if(g.ringCount)assert.ok(coveredDiskRadius(g.ringCount-1)<g.extent.paddedRadiusGameAU);}
});
test('every generated sector center round-trips in all context frames',()=>{
  for(const factory of Object.values(SYSTEM_FACTORIES)){const c=factory(),g=createHexGrid(c);for(const s of g.sectors){const found=gamePositionToSector(c,s.centerGameAU,g);assert.equal(found.id,s.id);assert.ok(distance(sectorCoordsToCenter(c,s.q,s.r),s.centerGameAU)<1e-9);}}
});
test('boundary ties are deterministic and favor the inner ring then axial order',()=>{
  const c=createSolContext(),g=createHexGrid(c);const edge=planePositionToGame(c.sectorPlane,Math.sqrt(3)*S/2,0),corner=planePositionToGame(c.sectorPlane,Math.sqrt(3)*S/2,S/2);
  for(let i=0;i<30;i++){assert.equal(gamePositionToSector(c,edge,g).id,'sol:0:0');assert.equal(gamePositionToSector(c,corner,g).id,'sol:0:0');}
  assert.equal(getSectorNeighbors(c,0,0,g).length,6);assert.ok(getSectorNeighbors(c,0,0,g).every(s=>s.ring===1));
});
test('required circular management bounds are covered at 1440 angular samples and several radii',()=>{
  for(const factory of Object.values(SYSTEM_FACTORIES)){const c=factory(),g=createHexGrid(c);for(const ratio of [.2,.7,1])for(let i=0;i<1440;i++){const angle=i/1440*Math.PI*2,r=g.extent.paddedRadiusGameAU*ratio,p=planePositionToGame(c.sectorPlane,Math.cos(angle)*r,Math.sin(angle)*r);assert.ok(gamePositionToSector(c,p,g),c.systemId+' angle '+i);}}
});
test('growth appends rings without changing any prior sector ID, center or radius',()=>{
  const old=createSolContext(),grid=createHexGrid(old),expanded=createSystemContext({...old,managedExtentGameAU:2400});const grown=growHexGrid(expanded,grid);
  assert.ok(grown.ringCount>grid.ringCount);assert.equal(grown.radiusGameAU,grid.radiusGameAU);
  for(const sector of grid.sectors){const next=grown.byId.get(sector.id);assert.ok(next);assert.equal(next.radiusGameAU,sector.radiusGameAU);assert.deepEqual(next.centerGameAU,sector.centerGameAU);assert.deepEqual(axialVertices(next.q,next.r),axialVertices(sector.q,sector.r));}
});
test('tilted/off-origin projection and game AU <-> world mapping preserve height and membership',()=>{
  const c=createLargeFixture(),g=createHexGrid(c),point=sectorCoordsToCenter(c,2,-1),high=Object.freeze(add(point,mul(c.sectorPlane.normal,800)));
  const before={...high};assert.equal(gamePositionToSector(c,point,g).id,gamePositionToSector(c,high,g).id);
  assert.equal(worldPositionToSector(c,{x:gameAUToWorld(high.x),y:gameAUToWorld(high.y),z:gameAUToWorld(high.z)},g).id,gamePositionToSector(c,point,g).id);
  assert.deepEqual(high,before);assert.ok(Math.abs(gamePositionToPlane(c.sectorPlane,high).height-800)<1e-8);
  assert.notDeepEqual(c.stars[0].positionGameAU,c.sectorPlane.originGameAU);
  const vertical=createPlane({normal:{x:1,y:0,z:0}}),local=gamePositionToPlane(vertical,planePositionToGame(vertical,20,-30,8));assert.deepEqual(local,{u:20,v:-30,height:8});
});
test('all sector and upper-scoped body IDs remain unique across systems with reused local IDs',()=>{
  const c=createSolContext(),d=createSystemContext({...c,systemId:'another-system'}),a=createHexGrid(c),b=createHexGrid(d);
  assert.equal(new Set([...a.sectors,...b.sectors].map(s=>s.id)).size,a.sectorCount+b.sectorCount);assert.notEqual(c.scopedBodyId('earth'),d.scopedBodyId('earth'));
});
test('moving celestial membership is queried from its current position rather than cached once',()=>{
  const c=createSolContext(),g=createHexGrid(c),b=c.planets.find(p=>p.id==='jupiter');
  const ids=Array.from({length:12},(_,i)=>gamePositionToSector(c,c.gamePosition(b.id,b.period*i/12),g).id);
  assert.ok(new Set(ids).size>1);
});
test('Sol adapter preserves prior orbital math and IAU frame without modifying source data',()=>{
  const c=createSolContext();assert.equal(c.validation.valid,true);for(const body of [...c.stars,...c.planets,...c.moons])for(const day of [0,20,365]){assert.ok(distance(c.gamePosition(body.id,day),worldPosition(body.id,day))<1e-9);const a=c.frameAt(body,day),b=bodyFrame(body,day);assert.ok(distance(a.pole,b.pole)<1e-12);assert.ok(Math.abs(a.spin-b.spin)<1e-12);}
});
test('empty optional arrays and independent multiple-star positions are accepted',()=>{
  const minimal=createSystemContext({systemId:'empty',displayName:'empty',stars:[],managedExtentGameAU:30});assert.equal(createHexGrid(minimal).ringCount,0);
  const c=createLargeFixture();assert.notDeepEqual(c.gamePosition(c.stars[0].id),c.systemCenterGameAU);assert.notDeepEqual(c.gamePosition(c.stars[1].id),c.gamePosition(c.stars[0].id));
  assert.throws(()=>createSystemContext({systemId:'bad',planets:[{id:'a',parent:'b'}]}),/Unknown parent/);
});
test('simulation context switch clears previous selection and accepts only the new body namespace',()=>{
  const c=createSolContext(),d=createSmallFixture(),sim=new Simulation(c.bodyById);sim.select('earth');sim.advance(1);sim.setSystem(d);assert.equal(sim.selectedId,null);assert.equal(sim.days,0);assert.equal(sim.select('earth'),false);assert.equal(sim.select('vela'),true);
});
test('context popup flips and clamps near every edge in desktop and mobile landscape',()=>{
  for(const viewport of [{width:1440,height:1000},{width:844,height:390},{width:667,height:375}])for(const x of [0,viewport.width/2,viewport.width])for(const y of [0,viewport.height/2,viewport.height]){const p=placeContextPanel({x,y,pixelRadius:20},190,200,viewport);assert.ok(p.x>=12);assert.ok(p.x+190<=viewport.width-12);assert.ok(p.y>=68);assert.ok(p.y+200<=viewport.height-90);}
});
