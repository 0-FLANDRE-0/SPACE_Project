import {calculateManagedExtent,planePositionToGame} from './system-context.js';
import {createHexGrid,axialVertices} from './hex-sectors.js';
import {M1A_TUNING as T} from './ship-data.js';
import {add,mul} from './ship-math.js';
function seeded(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function createAsteroidDestinations(context,seed=T.asteroidSeed){
  for(const c of context.systemId)seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;
  const rng=seeded(seed),outer=Math.max(T.asteroidMinimumOuterGameAU,calculateManagedExtent(context).rawRadiusGameAU),result=[];
  for(let i=0;i<T.asteroidCount+T.beltPointCount;i++){
    const belt=i>=T.asteroidCount,index=belt?i-T.asteroidCount:i;
    // Stratified radial coverage + independent azimuth/height; no geological data.
    const a=belt?T.beltInnerGameAU+rng()*(T.beltOuterGameAU-T.beltInnerGameAU):T.asteroidInnerGameAU+(outer-T.asteroidInnerGameAU)*(index+rng())/T.asteroidCount;
    result.push({kind:'asteroid',id:`${context.systemId}:${belt?'belt':'asteroid'}:${index}`,name:`${belt?'소행성대 지점':'소행성'} ${String(index+1).padStart(2,'0')}`,orbitGameAU:a,inclination:(rng()-.5)*(belt?T.beltInclinationSpreadRad:T.asteroidInclinationSpreadRad),node:rng()*Math.PI*2,phase:rng()*Math.PI*2,periodSeconds:365.256*86400*(a/100)**1.5,belt});
  }
  return result;
}
export function asteroidPosition(context,a,seconds){const theta=a.phase+seconds/a.periodSeconds*Math.PI*2,x=Math.cos(theta)*a.orbitGameAU,z=Math.sin(theta)*a.orbitGameAU,c=Math.cos(a.node),s=Math.sin(a.node);return add(context.systemCenterGameAU,add(mul(context.sectorPlane.tangentU,x*c-z*Math.cos(a.inclination)*s),add(mul(context.sectorPlane.tangentV,x*s+z*Math.cos(a.inclination)*c),mul(context.sectorPlane.normal,z*Math.sin(a.inclination)))));}
export function createMovementDestinations(context){
  const result=context.allBodies.filter(b=>['planet','moon','star'].includes(b.kind)).map(b=>({kind:'body',id:b.id,name:b.name,arrivable:b.kind!=='star'}));
  const vertices=new Map();for(const sector of createHexGrid(context).sectors)for(const p of axialVertices(sector.q,sector.r)){const key=`${p.u.toFixed(6)}:${p.v.toFixed(6)}`;if(!vertices.has(key))vertices.set(key,{kind:'point',id:`${context.systemId}:vertex:${key}`,name:'섹터 꼭짓점',position:planePositionToGame(context.sectorPlane,p.u,p.v)});}
  return [...result,...createAsteroidDestinations(context),...vertices.values()];
}
