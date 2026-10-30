import test from 'node:test';
import assert from 'node:assert/strict';
import { AdministrativeRegions, administrativeEdges, classifySharedEdge, ADMIN_STORAGE_KEY } from '../dist/src/administrative-regions.js';
import { createHexGrid, growHexGrid } from '../dist/src/hex-sectors.js';
import { createSolContext, createSystemContext } from '../dist/src/system-context.js';
import { SYSTEM_FACTORIES } from '../dist/src/fixtures/systems.js';
const grid=()=>createHexGrid(createSolContext());
const memory=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const id=(q,r)=>`sol:${q}:${r}`;
const four=[id(0,0),id(1,0),id(0,1),id(1,-1)];
const state=m=>JSON.stringify(m.state);
test('three grids retain fixed base cells; four-cell region changes only shared internal edges',()=>{
 assert.deepEqual(Object.values(SYSTEM_FACTORIES).map(f=>{const g=createHexGrid(f());return[g.radiusGameAU,g.ringCount,g.sectorCount];}),[[210,3,37],[210,0,1],[210,6,127]]);
 const g=grid(),before=JSON.stringify(g.sectors),m=new AdministrativeRegions(g);m.create(four,'내행성구');const edges=administrativeEdges(g,m.assignments);assert.ok(edges.some(e=>e.kind==='internal'));assert.ok(edges.filter(e=>e.kind==='internal').every(e=>four.includes(e.a)&&four.includes(e.b)));assert.equal(JSON.stringify(g.sectors),before);
 const keys=edges.map(e=>e.points.map(p=>p.u.toFixed(6)+','+p.v.toFixed(6)).sort().join('|'));assert.equal(new Set(keys).size,keys.length);
});
test('unassigned pairs and different administrative regions always preserve their shared edge',()=>{
 const m=new AdministrativeRegions(grid()),a=m.create([id(0,0)],'A'),b=m.create([id(1,0)],'B');assert.notEqual(a,b);assert.equal(classifySharedEdge(id(0,0),id(1,0),m.assignments),'admin-boundary');assert.equal(classifySharedEdge(id(-2,0),id(-1,0),m.assignments),'base-boundary');
});
test('six-cell ring is connected, leaves a hole and emits both its six inner and outer borders',()=>{
 const m=new AdministrativeRegions(grid()),ring=m.idsForRing(1);m.create(ring,'고리');assert.equal(m.forSector(id(0,0)),null);const border=administrativeEdges(m.grid,m.assignments).filter(e=>e.kind==='admin-boundary');assert.equal(border.filter(e=>e.a===id(0,0)||e.b===id(0,0)).length,6);assert.ok(border.length>6);
});
test('disconnected, duplicate, foreign and unknown base sector assignments reject atomically',()=>{
 const m=new AdministrativeRegions(grid());for(const ids of [[id(0,0),id(2,0)],[id(0,0),id(0,0)],['other:0:0'],[id(99,0)],[]]){const before=state(m);assert.throws(()=>m.create(ids,'invalid'));assert.equal(state(m),before);}m.create([id(0,0)],'A');const before=state(m);assert.throws(()=>m.create([id(0,0)],'overlap'));assert.equal(state(m),before);
});
test('adjacent merge preserves target identity/name/color and removes absorbed ID; nonadjacent merge rejects',()=>{
 const m=new AdministrativeRegions(grid()),a=m.create([id(0,0)],'A'),b=m.create([id(1,0)],'B'),c=m.create([id(-3,0)],'C');const before=state(m);assert.throws(()=>m.merge(a,[c]));assert.equal(state(m),before);m.merge(a,[b]);assert.equal(m.region(b),null);assert.equal(m.region(a).name,'A');assert.equal(m.region(a).sectorIds.length,2);assert.equal(m.forSector(id(1,0)).id,a);assert.ok(administrativeEdges(m.grid,m.assignments).some(e=>e.kind==='internal'&&[e.a,e.b].includes(id(0,0))));
});
test('bridge removal rejects without mutation; connected removal, add, metadata and deletion preserve unrelated regions',()=>{
 const m=new AdministrativeRegions(grid()),a=m.create([id(0,0),id(1,0),id(2,0)],'A'),b=m.create([id(-2,0)],'B'),other=JSON.stringify(m.region(b));const before=state(m);assert.throws(()=>m.remove(a,[id(1,0)]));assert.equal(state(m),before);m.remove(a,[id(2,0)]);m.add(a,[id(0,1)]);m.update(a,{name:'새 이름',color:'#91afd0'});assert.equal(m.region(a).name,'새 이름');assert.equal(JSON.stringify(m.region(b)),other);m.delete(a);assert.equal(m.forSector(id(0,0)),null);assert.equal(JSON.stringify(m.region(b)),other);
});
test('undo keeps serials monotonic and is isolated across systems',()=>{
 const m=new AdministrativeRegions(grid()),a=m.create(four,'A');m.undo();const b=m.create(four,'B');assert.notEqual(a,b);const sol=state(m);m.setGrid(createHexGrid(SYSTEM_FACTORIES.small()));assert.throws(()=>m.undo());assert.equal(m.regions.length,0);m.setGrid(grid());assert.equal(state(m),sol);
});
test('grid growth preserves saved assignments, base IDs and centers; new sectors are unassigned',()=>{
 const c=createSolContext(),g=createHexGrid(c),m=new AdministrativeRegions(g);const r=m.create(four,'A');const expanded=growHexGrid(createSystemContext({...c,managedExtentGameAU:2400}),g);m.setGrid(expanded);assert.equal(m.region(r).sectorIds.length,4);for(const s of g.sectors)assert.deepEqual(expanded.byId.get(s.id).centerGameAU,s.centerGameAU);assert.equal(m.forSector(expanded.sectors.at(-1).id),null);
});
test('versioned JSON round-trip and system switching preserve each system independently without time state',()=>{
 const storage=memory(),m=new AdministrativeRegions(grid(),{storage});m.create(four,'A');m.setGrid(createHexGrid(SYSTEM_FACTORIES.small()));m.create(['fixture-small:0:0'],'Small');const loaded=new AdministrativeRegions(grid(),{storage});assert.equal(loaded.regions[0].name,'A');loaded.setGrid(createHexGrid(SYSTEM_FACTORIES.small()));assert.equal(loaded.regions[0].name,'Small');const json=JSON.parse(loaded.serialize());assert.equal(json.schemaVersion,1);assert.equal('days' in json,false);assert.equal('speed' in json,false);
});
test('malformed/unsupported JSON is preserved and blocks overwrite until explicit backup recovery',()=>{
 for(const raw of ['{bad',JSON.stringify({schemaVersion:99,systems:{}})]){const storage=memory();storage.setItem(ADMIN_STORAGE_KEY,raw);const errors=[];const m=new AdministrativeRegions(grid(),{storage,onError:e=>errors.push(e)});assert.equal(m.regions.length,0);assert.ok(errors.length);assert.throws(()=>m.create(four,'No overwrite'));assert.equal(storage.getItem(ADMIN_STORAGE_KEY),raw);m.resetInvalidStorage();assert.equal(storage.getItem(ADMIN_STORAGE_KEY+':backup'),raw);m.create(four,'Recovered');assert.equal(m.regions.length,1);}
});
test('invalid sector references quarantine only their own system and remain intact when another system is saved',()=>{
 const storage=memory(),bad={regions:[{id:'sol:admin:1',systemId:'sol',name:'bad',color:'#80b8a8',sectorIds:[id(99,0)]}],nextRegionSerial:2};storage.setItem(ADMIN_STORAGE_KEY,JSON.stringify({schemaVersion:1,systems:{sol:bad}}));const m=new AdministrativeRegions(grid(),{storage});assert.equal(m.regions.length,0);assert.throws(()=>m.create(four,'unsafe'));m.setGrid(createHexGrid(SYSTEM_FACTORIES.small()));m.create(['fixture-small:0:0'],'Okay');assert.deepEqual(JSON.parse(storage.getItem(ADMIN_STORAGE_KEY)).systems.sol,bad);
});
test('localStorage write failure leaves validated edits in memory and reports their persistence limit',()=>{
 const errors=[],m=new AdministrativeRegions(grid(),{storage:{getItem:()=>null,setItem:()=>{throw Error('quota');}},onError:e=>errors.push(e)});m.create(four,'In memory');assert.equal(m.regions.length,1);assert.ok(errors.some(e=>e.includes('保存')||e.includes('저장 실패')));
});
