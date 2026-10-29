import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PLANETS, MOONS, ALL_BODIES, AU_KM } from '../dist/src/data.js';
import { orbitPosition, orbitalPoint, orbitNormal, worldPosition, Simulation, orbitEmphasis, elementsAt, bodyFrame, axialTilt, scaleForView, wrapAngle } from '../dist/src/model.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const byId=id=>ALL_BODIES.find(b=>b.id===id);

test('AU distances and physical radii use one consistent metric coordinate space',()=>{
  const earth=byId('earth'),moon=byId('moon');
  assert.ok(Math.abs(earth.radius*AU_KM-6371)<1e-8);
  assert.ok(Math.abs(moon.orbit*AU_KM-384034.8235589169)<1);
  const separation=distance(worldPosition('earth'),{x:0,y:0,z:0});
  assert.ok(separation>.98&&separation<1.02);
});
test('Earth position agrees with independently requested JPL Horizons vector within 0.0003 AU',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('./horizons-reference.json',import.meta.url)));
  const [x,y,z]=fixture.earthEclipticAU;
  assert.ok(distance(worldPosition('earth'),{x,y:z,z:-y})<.0003);
});
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
  const b={orbit:1,eccentricity:0,inclination:0,node:0,argument:90,phase:0,period:1};
  assert.ok(distance(orbitalPoint(b,0),{x:0,y:0,z:-1})<1e-12);
  const triton=byId('triton'),p=orbitPosition(triton,0),q=orbitPosition(triton,.001);
  const angularMomentumY=p.z*q.x-p.x*q.z;
  assert.ok(triton.inclination>90);assert.ok(angularMomentumY<0,'retrograde comes from the plane, without a second negative period');
});
test('moon tracks its moving parent without leaving its measured ellipse',()=>{
  for(const moon of MOONS)for(const day of [0,20,90,180,365]) {
    const r=distance(worldPosition(moon.id,day),worldPosition(moon.parent,day));
    assert.ok(r>=moon.orbit*(1-moon.eccentricity)-1e-10);
    assert.ok(r<=moon.orbit*(1+moon.eccentricity)+1e-10);
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
test('scale bar automatically changes AU to km with mathematically correct pixel lengths',()=>{
  const wide=scaleForView(90,43,600),near=scaleForView(.0003,43,600);
  assert.equal(wide.unit,'AU');assert.equal(near.unit,'km');
  for(const scale of [wide,near]) {
    assert.ok(Math.abs(scale.au/scale.auPerPixel-scale.pixels)<1e-10);
    assert.ok(scale.pixels>35&&scale.pixels<=110);
  }
  assert.ok(Math.abs(near.au*AU_KM-near.value)<1e-8);
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
