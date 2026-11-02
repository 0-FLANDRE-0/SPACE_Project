import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PLANETS, MOONS, REAL_AU_KM } from '../dist/src/data.js';
import { referenceWorldPosition, referenceOrbitPosition, orbitPosition, referenceElementsAt, elementsAt, bodyFrame } from '../dist/src/model.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('astronomy-only metric radii and orbit distances retain physical km conversions',()=>{
  const earth=PLANETS.find(p=>p.id==='earth'),moon=MOONS.find(p=>p.id==='moon');
  assert.equal(earth.realRadiusKm,6371);
  assert.ok(Math.abs(moon.realOrbitAU*REAL_AU_KM-384034.8235589169)<1);
  const r=referenceWorldPosition('earth');assert.ok(Math.hypot(r.x,r.y,r.z)>.98&&Math.hypot(r.x,r.y,r.z)<1.02);
});
test('reference Earth matches the independent JPL Horizons vector within 0.0003 real AU',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('./horizons-reference.json',import.meta.url)));
  const [x,y,z]=fixture.earthEclipticAU;
  assert.ok(distance(referenceWorldPosition('earth'),{x,y:z,z:-y})<.0003);
});
test('JPL reference semimajor axis evolves independently; only game axis stays fixed',()=>{
  for(const b of PLANETS)for(const day of [0,36525,-36525]) {
    const real=referenceElementsAt(b,day),game=elementsAt(b,day);
    assert.equal(game.a,b.orbitGameAU);assert.notEqual(real.a,game.a);
    for(const key of ['e','i','node','argument','mean'])assert.equal(game[key],real[key]);
    const p=orbitPosition(b,day),q=referenceOrbitPosition(b,day),ratio=game.a/real.a;
    assert.ok(distance(p,{x:q.x*ratio,y:q.y*ratio,z:q.z*ratio})<1e-8);
  }
});
test('real satellite closure and moving-parent reference coordinates remain available',()=>{
  for(const moon of MOONS) {
    assert.ok(distance(referenceOrbitPosition(moon,0),referenceOrbitPosition(moon,moon.period))<1e-10);
    for(const day of [0,90,365]) {
      const r=distance(referenceWorldPosition(moon.id,day),referenceWorldPosition(moon.parent,day));
      assert.ok(r>=moon.realOrbitAU*(1-moon.eccentricity)-1e-10);
      assert.ok(r<=moon.realOrbitAU*(1+moon.eccentricity)+1e-10);
      assert.ok(Object.values(bodyFrame(moon,day).pole).every(Number.isFinite));
    }
  }
});
