import { SUN, PLANETS, MOONS, BELTS } from './data.js';
import { elementsAt } from './model.js';
import { bodyRadiusGameAU, SATURN_RING_RADII, MIN_CLEARANCE_GAME_AU } from './game-space.js';

export function orbitBounds(body,days=0) {
  const {a,e}=elementsAt(body,days);
  return {periapsisGameAU:a*(1-e),apoapsisGameAU:a*(1+e)};
}
export function systemExtentGameAU(planet,moons=MOONS,days=0) {
  const ringExtent=planet.id==='saturn'?bodyRadiusGameAU(planet)*SATURN_RING_RADII.outer:bodyRadiusGameAU(planet);
  return moons.filter(m=>m.parent===planet.id).reduce((extent,m)=>Math.max(extent,orbitBounds(m,days).apoapsisGameAU+bodyRadiusGameAU(m)),ringExtent);
}
// Conservative radial envelopes guarantee clearance for ALL anomalies/phases and
// orbital-plane directions; this is stronger than checking a handful of frames.
export function validateSystem({star=SUN,planets=PLANETS,moons=MOONS,belts=BELTS,days=0,minClearanceGameAU=MIN_CLEARANCE_GAME_AU}={}) {
  const report={valid:true,issues:[],starClearances:[],neighborClearances:[],satelliteClearances:[],beltClearances:[]};
  const check=(kind,label,clearance,minimum=minClearanceGameAU)=>{
    if(!Number.isFinite(clearance)||clearance<minimum)report.issues.push({kind,label,clearanceGameAU:clearance,minimumGameAU:minimum});
  };
  const ordered=[...planets].sort((a,b)=>a.orbitGameAU-b.orbitGameAU);
  for(const planet of ordered) {
    const bounds=orbitBounds(planet,days),clearance=bounds.periapsisGameAU-bodyRadiusGameAU(star)-bodyRadiusGameAU(planet);
    report.starClearances.push({id:planet.id,...bounds,clearanceGameAU:clearance});
    check('star-planet',planet.id,clearance);
    check('star-system',planet.id,bounds.periapsisGameAU-bodyRadiusGameAU(star)-systemExtentGameAU(planet,moons,days));
    const satellites=moons.filter(m=>m.parent===planet.id).sort((a,b)=>a.orbitGameAU-b.orbitGameAU);
    const occupiedRadius=planet.id==='saturn'?bodyRadiusGameAU(planet)*SATURN_RING_RADII.outer:bodyRadiusGameAU(planet);
    for(const moon of satellites) {
      const clearance=orbitBounds(moon,days).periapsisGameAU-occupiedRadius-bodyRadiusGameAU(moon);
      report.satelliteClearances.push({id:moon.id,parent:planet.id,clearanceGameAU:clearance});
      check('parent-or-ring-satellite',moon.id,clearance);
    }
    for(let i=1;i<satellites.length;i++) {
      const a=satellites[i-1],b=satellites[i];
      check('satellite-satellite',`${a.id}/${b.id}`,orbitBounds(b,days).periapsisGameAU-orbitBounds(a,days).apoapsisGameAU-bodyRadiusGameAU(a)-bodyRadiusGameAU(b));
    }
  }
  for(let i=1;i<ordered.length;i++) {
    const inner=ordered[i-1],outer=ordered[i];
    const gap=orbitBounds(outer,days).periapsisGameAU-orbitBounds(inner,days).apoapsisGameAU;
    const planetClearance=gap-bodyRadiusGameAU(inner)-bodyRadiusGameAU(outer);
    const systemClearance=gap-systemExtentGameAU(inner,moons,days)-systemExtentGameAU(outer,moons,days);
    report.neighborClearances.push({inner:inner.id,outer:outer.id,planetClearanceGameAU:planetClearance,systemClearanceGameAU:systemClearance});
    check('planet-planet',`${inner.id}/${outer.id}`,planetClearance);
    check('system-system',`${inner.id}/${outer.id}`,systemClearance);
  }
  // Belts are non-collidable particle regions. Validate their boundaries against
  // the planet surfaces, not fictional individual particle ephemerides.
  for(const belt of belts) {
    const inner=ordered.filter(p=>p.orbitGameAU<belt.innerGameAU).at(-1),outer=ordered.find(p=>p.orbitGameAU>belt.outerGameAU);
    const innerClearance=inner?belt.innerGameAU-orbitBounds(inner,days).apoapsisGameAU-bodyRadiusGameAU(inner):Infinity;
    const outerClearance=outer?orbitBounds(outer,days).periapsisGameAU-bodyRadiusGameAU(outer)-belt.outerGameAU:Infinity;
    report.beltClearances.push({id:belt.id,innerClearanceGameAU:innerClearance,outerClearanceGameAU:outerClearance});
    if(inner)check('planet-belt',belt.id,innerClearance);
    if(outer)check('belt-planet',belt.id,outerClearance);
  }
  report.valid=report.issues.length===0;
  return report;
}
