import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, MOONS, ALL_BODIES, SUN } from '../dist/src/data.js';
import { orbitPosition, orbitalPoint, orbitNormal, worldPosition, Simulation, orbitEmphasis, elementsAt, bodyFrame, axialTilt, scaleForView, wrapAngle }
from '../dist/src/model.js';
import { bodyRadiusGameAU, bodyDiameterGameAU, planetSizeFromRadiusKm, starDiameterGameAU, WORLD_UNITS_PER_GAME_AU } from '../dist/src/game-space.js';
import { validateSystem } from '../dist/src/validation.js';
import { assistedBodySelection } from '../dist/src/selection.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const byId=id=>ALL_BODIES.find(b=>b.id===id);

test('Kepler ellipses close geometrically and remain in their actual 3D orbital planes',()=>{
  for(const b of [...PLANETS,...MOONS]) {
    assert.ok(distance(orbitalPoint(b,0),orbitalPoint(b,Math.PI*2))<1e-10,b.id);
    const n=orbitNormal(b);
    for(let j=0;j<12;j++)assert.ok(Math.abs(dot(n,orbitalPoint(b,j/12*Math.PI*2)))<1e-10,b.id);
  }
  const mercury=byId('mercury');
  const points=Array.from({length:24},(_,j)=>orbitalPoint(mercury,j/24*Math.PI*2));
  assert.ok(Math.max(...points.map(p=>p.y))>.04);assert.ok(Math.min(...points.map(p=>p.y))<-.03);
});
test('argument of periapsis is honored and coordinates preserve right-handed orientation',()=>{
  const b={orbitGameAU:1,realOrbitAU:1,eccentricity:0,inclination:0,node:0,argument:90,phase:0,period:1};
  assert.ok(distance(orbitalPoint(b,0),{x:0,y:0,z:-1})<1e-12);
  const triton=byId('triton'),p=orbitPosition(triton,0),q=orbitPosition(triton,.001);
  const angularMomentumY=p.z*q.x-p.x*q.z;
  assert.ok(triton.inclination>90);assert.ok(angularMomentumY<0,'retrograde comes from the plane, without a second negative period');
});
test('moon tracks its moving parent without leaving its measured ellipse',()=>{
  for(const moon of MOONS)for(const day of [0,20,90,180,365]) {
    const r=distance(worldPosition(moon.id,day),worldPosition(moon.parent,day));
    assert.ok(r>=moon.orbitGameAU*(1-moon.eccentricity)-1e-10);
    assert.ok(r<=moon.orbitGameAU*(1+moon.eccentricity)+1e-10);
  }
});
test('IAU axes match known Earth, Mars, Venus and Uranus obliquities',()=>{
  for(const [id,value,tolerance] of [['earth',23.44,.05],['mars',25.19,.15],['venus',177.36,.05],['uranus',97.77,.05]])assert.ok(Math.abs(axialTilt(byId(id))-value)<tolerance,id);
  for(const body of [...PLANETS,...MOONS]) {
    const frame=bodyFrame(body);
    assert.ok(Math.abs(dot(frame.pole,frame.pole)-1)<1e-12);
    assert.ok(Math.abs(dot(frame.pole,frame.x))<1e-12);
    assert.ok(Math.abs(dot(frame.pole,frame.z))<1e-12);
  }
});
test('rotation advances around a fixed local pole and Venus/Uranus rotate retrograde',()=>{
  for(const body of PLANETS) {
    const a=bodyFrame(body,0),b=bodyFrame(body,.001);
    assert.ok(distance(a.pole,b.pole)<1e-5,body.id);
    const signedDelta=wrapAngle(b.spin-a.spin+Math.PI)-Math.PI;
    assert.equal(Math.sign(signedDelta),Math.sign(body.pole.pm[1]),body.id);
  }
});
test('scale bar uses game AU at every zoom level without converting to km/m',()=>{
  for(const distance of [8000,1800,500,56.25,3,.25]) {
    const scale=scaleForView(distance,43,600);
    assert.equal(scale.unit,'AU');
    assert.ok(Math.abs(scale.lengthGameAU/scale.gameAUPerPixel-scale.pixels)<1e-10);
    assert.ok(scale.pixels>35&&scale.pixels<=110);
  }
});
test('pause, speed, and frame subdivisions preserve elapsed simulation time',()=>{
  const a=new Simulation(),b=new Simulation();a.advance(10);for(let j=0;j<600;j++)b.advance(1/60);
  assert.ok(Math.abs(a.days-b.days)<1e-10);b.paused=true;const paused=b.days;b.advance(100);assert.equal(b.days,paused);
  b.paused=false;b.speed=10;b.advance(1);assert.ok(Math.abs(b.days-paused-a.days)<1e-10);b.advance(-1);b.advance(NaN);assert.ok(Number.isFinite(b.days));
});
test('selection differentiates the chosen orbit from parent/satellite context',()=>{
  assert.ok(orbitEmphasis('earth','earth')>orbitEmphasis('mars','earth')*8);
  assert.ok(orbitEmphasis('moon','moon')>orbitEmphasis('earth','moon'));
  assert.ok(orbitEmphasis('earth','moon')>orbitEmphasis('mars','moon'));
});
test('body IDs and parent links remain valid; secular elements vary with epoch',()=>{
  const ids=ALL_BODIES.map(b=>b.id);assert.equal(new Set(ids).size,ids.length);
  for(const m of MOONS)assert.ok(PLANETS.some(p=>p.id===m.parent));
  assert.notEqual(elementsAt(byId('mercury'),0).node,elementsAt(byId('mercury'),365));
  const sim=new Simulation();assert.ok(sim.select('earth'));assert.equal(sim.select('missing'),false);assert.equal(sim.selectedId,'earth');assert.ok(sim.select(null));
});

test('planet size formula and the complete requested orbit/size table are authoritative',()=>{
  const expected=[['mercury',53,9],['venus',79,15],['earth',100,15],['mars',142,11],['jupiter',280,50],['saturn',420,45],['uranus',570,30],['neptune',730,29]];
  assert.equal(WORLD_UNITS_PER_GAME_AU,1);
  for(const [id,a,size]of expected) {
    const b=byId(id);assert.equal(b.planetSize,size);assert.ok(Number.isInteger(b.planetSize));
    assert.equal(planetSizeFromRadiusKm(b.realRadiusKm),size);assert.equal(bodyDiameterGameAU(b),size);assert.equal(bodyRadiusGameAU(b),size/2);
    for(const day of [0,36525,-36525])assert.equal(elementsAt(b,day).a,a,'real secular axis must never overwrite game axis');
    assert.equal('radius' in b,false);assert.equal('orbit' in b,false);
  }
});
test('Sun classification, Star Size and converted diameter remain separate',()=>{
  assert.equal(SUN.starSize,90);assert.equal(SUN.spectralType,'G2V');assert.equal(SUN.spectralClass,'G');assert.equal(SUN.luminosityClass,'V');
  assert.equal(SUN.temperatureK,5772);assert.equal(SUN.realRadiusKm,696340);assert.equal(SUN.realRadiusSolar,1);
  assert.equal(starDiameterGameAU(SUN),70);assert.equal(bodyRadiusGameAU(SUN),35);assert.equal('planetSize' in SUN,false);
  assert.equal(starDiameterGameAU({...SUN,starSize:45}),35);
});
test('game ellipses keep the reference orientation, eccentricity and phase',()=>{
  for(const b of [...PLANETS,...MOONS]) {
    const e=elementsAt(b,0),p=orbitPosition(b,0);
    assert.ok(Math.hypot(p.x,p.y,p.z)>=e.a*(1-e.e)-1e-8);
    assert.ok(Math.hypot(p.x,p.y,p.z)<=e.a*(1+e.e)+1e-8);
    assert.ok(Math.abs(dot(p,orbitNormal(b)))<1e-8);
  }
});
test('entire orbital envelopes clear the star, neighboring systems, satellites and rings',()=>{
  for(const day of [0,3652.5,18262.5,36525]) {
    const report=validateSystem({days:day});assert.equal(report.valid,true,JSON.stringify(report.issues));
    assert.equal(report.starClearances.length,8);assert.equal(report.neighborClearances.length,7);assert.equal(report.satelliteClearances.length,11);
    for(const row of report.starClearances)assert.ok(row.clearanceGameAU>=1);
    for(const row of report.neighborClearances)assert.ok(row.systemClearanceGameAU>=1);
  }
});
test('validation catches invalid star size, crossing planet paths, satellite interiors and ring overlap',()=>{
  assert.ok(validateSystem({star:{...SUN,starSize:140}}).issues.some(i=>i.kind==='star-planet'));
  const crossing=PLANETS.map(p=>p.id==='venus'?{...p,orbitGameAU:65}:p);
  assert.ok(validateSystem({planets:crossing}).issues.some(i=>i.kind==='planet-planet'));
  const underground=MOONS.map(m=>m.id==='moon'?{...m,orbitGameAU:6}:m);
  assert.ok(validateSystem({moons:underground}).issues.some(i=>i.kind==='parent-or-ring-satellite'));
  const ring=MOONS.map(m=>m.id==='enceladus'?{...m,orbitGameAU:50}:m);
  assert.ok(validateSystem({moons:ring}).issues.some(i=>i.label==='enceladus'));
});
test('all satellites use a distinct diameter rule and game-relative orbit',()=>{
  for(const moon of MOONS) {
    assert.equal('planetSize' in moon,false);assert.ok(moon.satelliteDiameterGameAU>=.3);
    assert.notEqual(moon.orbitGameAU,moon.realOrbitAU*100);
    assert.ok(bodyDiameterGameAU(moon)>0);
  }
});
test('selection assistance ignores occluded/offscreen targets and resolves distance then depth',()=>{
  const candidates=[{id:'near',x:10,y:10,depth:20,pixelRadius:2,visible:true},{id:'far',x:10,y:10,depth:40,pixelRadius:2,visible:true},{id:'hidden',x:9,y:9,depth:10,pixelRadius:2,visible:false}];
  assert.equal(assistedBodySelection({x:10,y:10},candidates),'near');
  assert.equal(assistedBodySelection({x:25,y:10},candidates,12),null);
  assert.equal(assistedBodySelection({x:25,y:10},candidates,18),'near');
  assert.equal(assistedBodySelection({x:10,y:10},[{...candidates[0],pixelRadius:30}]),null);
});
