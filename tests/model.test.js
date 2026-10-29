import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, MOONS, ALL_BODIES } from '../dist/src/data.js';
import { orbitPosition, worldPosition, Simulation, orbitEmphasis } from '../dist/src/model.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('every orbit closes after one signed orbital period, including retrograde Triton',()=>{
  for(const body of [...PLANETS,...MOONS])assert.ok(distance(orbitPosition(body,0),orbitPosition(body,body.period))<1e-8,body.id);
});
test('inclined orbital planes produce finite nonzero heights',()=>{
  const mercury=PLANETS.find(p=>p.id==='mercury');
  const positions=Array.from({length:24},(_,i)=>orbitPosition(mercury,mercury.period*i/24));
  assert.ok(positions.every(p=>Object.values(p).every(Number.isFinite)));
  assert.ok(positions.some(p=>p.y>.5));assert.ok(positions.some(p=>p.y<-.5));
  assert.equal(orbitPosition(PLANETS.find(p=>p.id==='earth'),100).y,0);
});
test('a moon remains in its moving parent orbit over a full Earth year',()=>{
  for(const day of [0,20,90,180,365]) {
    const moon=MOONS.find(m=>m.id==='moon');
    const separation=distance(worldPosition('moon',day),worldPosition('earth',day));
    assert.ok(separation>=moon.orbit*(1-moon.eccentricity)-1e-8);
    assert.ok(separation<=moon.orbit*(1+moon.eccentricity)+1e-8);
  }
});
test('pause freezes the model; speed and frame subdivision preserve elapsed time',()=>{
  const a=new Simulation(),b=new Simulation();
  a.advance(10);for(let i=0;i<600;i++)b.advance(1/60);
  assert.ok(Math.abs(a.days-b.days)<1e-10);
  b.paused=true;const paused=b.days;b.advance(100);assert.equal(b.days,paused);
  b.paused=false;b.speed=10;b.advance(1);assert.ok(Math.abs(b.days-paused-a.days)<1e-10);
  b.advance(-1);b.advance(NaN);assert.ok(Number.isFinite(b.days));
});
test('selection makes the chosen orbit strong and distinguishes parent and satellite context',()=>{
  assert.ok(orbitEmphasis('earth','earth')>orbitEmphasis('mars','earth')*8);
  assert.ok(orbitEmphasis('moon','moon')>orbitEmphasis('earth','moon'));
  assert.ok(orbitEmphasis('earth','moon')>orbitEmphasis('mars','moon'));
  assert.ok(orbitEmphasis('moon','earth')>orbitEmphasis('moon',null));
});
test('all selectable bodies have unique IDs and valid parent references',()=>{
  const ids=ALL_BODIES.map(b=>b.id);assert.equal(new Set(ids).size,ids.length);
  for(const moon of MOONS)assert.ok(PLANETS.some(p=>p.id===moon.parent));
  const simulation=new Simulation();assert.ok(simulation.select('earth'));
  assert.equal(simulation.select('nonexistent'),false);assert.equal(simulation.selectedId,'earth');
  assert.ok(simulation.select(null));assert.equal(simulation.selectedId,null);
});
