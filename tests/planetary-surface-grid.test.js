import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSurfaceTopology, createPlanetarySurfaceGrid, findSurfaceTile, pickSurfaceTile, containsSurfacePoint, normalize, add, mul, dot, SURFACE_RADIUS } from '../dist/src/planetary-surface-grid.js';
import { PLANETS, MOONS } from '../dist/src/data.js';
import { SYSTEM_FACTORIES } from '../dist/src/fixtures/systems.js';
const key=(a,b)=>[a,b].sort((x,y)=>x-y).join(':');
test('spherical duals at f=2/3/4/5 have 42/92/162/252 faces and exactly twelve pentagons',()=>{
 for(const [f,count]of [[2,42],[3,92],[4,162],[5,252]]){const g=generateSurfaceTopology(f);assert.equal(g.tiles.length,count);assert.equal(g.tiles.filter(t=>t.kind==='pentagon').length,12);assert.equal(g.tiles.filter(t=>t.kind==='hexagon').length,10*(f*f-1));}
});
test('closed manifold, Euler characteristic, paired reverse edges and degree-3 dual vertices hold',()=>{
 for(const f of [2,3,4,5,8]){const g=generateSurfaceTopology(f),edges=new Map(),vertexUses=new Map();
  for(const t of g.tiles){assert.equal(t.boundary.length,t.neighbors.length);assert.ok([5,6].includes(t.neighbors.length));for(let i=0;i<t.boundary.length;i++){const a=t.vertexIndices[i],b=t.vertexIndices[(i+1)%t.boundary.length],k=key(a,b);if(!edges.has(k))edges.set(k,[]);edges.get(k).push([a,b]);vertexUses.set(a,(vertexUses.get(a)??0)+1);assert.ok(dot(t.edgeNormals[i],t.center)>0);}}
  assert.equal(edges.size,30*f*f);assert.equal(g.vertices.length-edges.size+g.tiles.length,2);assert.ok([...edges.values()].every(e=>e.length===2&&e[0][0]===e[1][1]&&e[0][1]===e[1][0]));assert.ok([...vertexUses.values()].every(n=>n===3));assert.equal(new Set(g.tiles.map(t=>[t.center.x,t.center.y,t.center.z].map(n=>n.toFixed(10)).join(','))).size,g.tiles.length);
 }
});
test('neighbor graph is reciprocal and connected, and spherical areas partition 4π exactly',()=>{
 for(const f of [2,3,5,8]){const g=generateSurfaceTopology(f);for(const t of g.tiles){assert.equal(new Set(t.neighbors).size,t.neighbors.length);for(const n of t.neighbors)assert.ok(g.tiles[n].neighbors.includes(t.index));assert.ok(t.areaSteradians>0);assert.ok(Math.abs(dot(t.center,t.center)-1)<1e-12);}const reached=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const n of g.tiles[queue[i]].neighbors)if(!reached.has(n)){reached.add(n);queue.push(n);}assert.equal(reached.size,g.tiles.length);assert.ok(Math.abs(g.tiles.reduce((s,t)=>s+t.areaWeight,0)-1)<1e-12);}
});
test('fresh independent generator reproduces exact IDs, geometry, neighbors and checksum',async()=>{
 const independent=await import('../dist/src/planetary-surface-grid.js?independent=1'),a=createPlanetarySurfaceGrid('sol',PLANETS[2]),b=independent.createPlanetarySurfaceGrid('sol',PLANETS[2]);assert.deepEqual(a,b);const other=createPlanetarySurfaceGrid('other',PLANETS[2]);assert.notEqual(a.gridFingerprint,other.gridFingerprint);assert.equal(new Set([...a.tiles,...other.tiles].map(t=>t.id)).size,184);const x=createPlanetarySurfaceGrid('a:b',{...PLANETS[2],id:'c'}),y=createPlanetarySurfaceGrid('a',{...PLANETS[2],id:'b:c'});assert.notEqual(x.tiles[0].id,y.tiles[0].id);
});
test('all eight planets and eleven moons have size-based valid grids without changing body data',()=>{
 const before=JSON.stringify([...PLANETS,...MOONS]),expected={mercury:42,venus:92,earth:92,mars:42,jupiter:642,saturn:492,uranus:252,neptune:252};
 for(const b of PLANETS){const g=createPlanetarySurfaceGrid('sol',b);assert.equal(g.cellCount,expected[b.id]);assert.equal(g.cellCount,10*g.frequency*g.frequency+2);assert.ok(g.equatorCellCount>0);assert.equal(g.tiles.filter(t=>t.kind==='pentagon').length,12);}
 for(const b of MOONS){assert.equal(b.planetSize,undefined);const g=createPlanetarySurfaceGrid('sol',b);assert.equal(g.cellCount,42);assert.ok(g.frequency>=2);assert.ok(g.tiles.every(t=>t.neighborIds.length===t.boundary.length));}
 assert.equal(JSON.stringify([...PLANETS,...MOONS]),before);
});
test('fixture planets and arbitrary moons use the same generator, with explicit technical cap signaling',()=>{
 for(const factory of Object.values(SYSTEM_FACTORIES)){const c=factory();for(const b of [...c.planets,...c.moons]){const g=createPlanetarySurfaceGrid(c.systemId,b);assert.ok(g.tiles.every(t=>t.id.startsWith(`${c.systemId}:${b.id}:surface:`)));}}
 const g=createPlanetarySurfaceGrid('custom',{id:'huge',kind:'planet',planetSize:1000});assert.equal(g.resolution.capped,true);assert.equal(g.frequency,12);assert.throws(()=>createPlanetarySurfaceGrid('custom',{id:'star',kind:'star'}));assert.throws(()=>generateSurfaceTopology(2.5));
});
test('exact polygon lookup covers poles, longitude seam and 2048 deterministic points at each density',()=>{
 for(const f of [2,3,5,8]){const g=generateSurfaceTopology(f);for(let i=0;i<2048;i++){const y=1-2*(i+.5)/2048,theta=i*Math.PI*(3-Math.sqrt(5)),p={x:Math.sqrt(1-y*y)*Math.cos(theta),y,z:Math.sqrt(1-y*y)*Math.sin(theta)},tile=findSurfaceTile(g,p);assert.ok(tile);assert.ok(containsSurfacePoint(tile,p));assert.equal(findSurfaceTile(g,p).index,tile.index);}for(const y of[-1,1])assert.ok(findSurfaceTile(g,{x:0,y,z:0}));assert.equal(findSurfaceTile(g,{x:-1,y:0,z:1e-16}).index,findSurfaceTile(g,{x:-1,y:0,z:-1e-16}).index);}
});
test('edge and corner ties are deterministic minimum indices and share rendered polygon boundaries',()=>{
 const g=generateSurfaceTopology(3);for(const tile of g.tiles){assert.equal(findSurfaceTile(g,tile.center).index,tile.index);for(let i=0;i<tile.boundary.length;i++){const point=normalize(add(tile.boundary[i],tile.boundary[(i+1)%tile.boundary.length])),candidates=g.tiles.filter(t=>containsSurfacePoint(t,point));assert.equal(candidates.length,2);assert.equal(findSurfaceTile(g,point).index,Math.min(...candidates.map(t=>t.index)));const corner=tile.boundary[i],cornerTiles=g.tiles.filter(t=>containsSurfacePoint(t,corner));assert.equal(cornerTiles.length,3);assert.equal(findSurfaceTile(g,corner).index,Math.min(...cornerTiles.map(t=>t.index)));}}
});
test('front sphere ray selection rejects the back, empty space, tangent and inside-origin hits',()=>{
 const g=createPlanetarySurfaceGrid('sol',PLANETS[2]),front=pickSurfaceTile(g,{x:0,y:0,z:3},{x:0,y:0,z:-1});assert.ok(front.point.z>.999);assert.ok(front.tile.center.z>0);assert.notEqual(front.tile.id,findSurfaceTile(g,{x:0,y:0,z:-1}).id);assert.equal(pickSurfaceTile(g,{x:0,y:0,z:3},{x:0,y:0,z:1}),null);assert.equal(pickSurfaceTile(g,{x:5,y:5,z:3},{x:0,y:0,z:-1}),null);assert.equal(pickSurfaceTile(g,{x:0,y:0,z:0},{x:0,y:0,z:1}),null);assert.equal(pickSurfaceTile(g,{x:SURFACE_RADIUS,y:0,z:3},{x:0,y:0,z:-1}),null);
});
