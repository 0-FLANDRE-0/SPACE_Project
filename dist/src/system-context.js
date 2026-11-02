import { SUN, PLANETS, MOONS, BELTS, SURFACE_FILES, EPOCH } from './data.js';
import { orbitPosition, orbitalPoint, bodyFrame, elementsAt } from './model.js';
import { bodyRadiusGameAU, SATURN_RING_RADII } from './game-space.js';
import { validateSystem } from './validation.js';

export const ZERO=Object.freeze({x:0,y:0,z:0});
export const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export const mul=(a,k)=>({x:a.x*k,y:a.y*k,z:a.z*k});
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export const magnitude=a=>Math.hypot(a.x,a.y,a.z);
export function unit(a) {const length=magnitude(a);if(length<1e-10)throw new Error('A plane direction cannot be zero/parallel');return mul(a,1/length);}
export function createPlane(input={}) {
  const originGameAU={...(input.originGameAU??ZERO)},normal=unit(input.normal??{x:0,y:1,z:0});
  const candidate=input.tangentU??(Math.abs(normal.x)<.9?{x:1,y:0,z:0}:{x:0,y:0,z:1});
  const tangentU=unit(sub(candidate,mul(normal,dot(candidate,normal))));
  return {originGameAU,normal,tangentU,tangentV:unit(cross(normal,tangentU))};
}
export function planePositionToGame(plane,u,v,height=0) {
  return add(plane.originGameAU,add(mul(plane.tangentU,u),add(mul(plane.tangentV,v),mul(plane.normal,height))));
}
export function gamePositionToPlane(plane,position) {
  const p=sub(position,plane.originGameAU);
  return {u:dot(p,plane.tangentU),v:dot(p,plane.tangentV),height:dot(p,plane.normal)};
}

export function createSystemContext(input) {
  if(!input.systemId)throw new Error('systemId is required');
  const systemCenterGameAU={...(input.systemCenterGameAU??ZERO)};
  const sectorPlane=createPlane(input.sectorPlane??{originGameAU:systemCenterGameAU});
  const context={...input,epochISO:input.epochISO??'2026-10-29T00:00:00Z',systemCenterGameAU,sectorPlane,stars:input.stars??[],planets:input.planets??[],moons:input.moons??[],belts:input.belts??[],extentPadding:input.extentPadding??.1};
  context.allBodies=[...context.stars,...context.planets,...context.moons,...context.belts];
  context.bodyById=new Map(context.allBodies.map(b=>[b.id,b]));
  if(context.bodyById.size!==context.allBodies.length)throw new Error('Duplicate body ID in system');
  for(const body of context.allBodies)if(body.parent&&!context.bodyById.has(body.parent))throw new Error('Unknown parent: '+body.parent);
  context.scopedBodyId=id=>`${context.systemId}:body:${id}`;
  // Old orbital math uses XZ with Y up; this rotation preserves that basis for Sol.
  context.rotateLocal=p=>add(mul(sectorPlane.tangentU,p.x),add(mul(sectorPlane.normal,p.y),mul(sectorPlane.tangentV,-p.z)));
  const position=(id,days=0,visited=new Set())=>{
    const body=context.bodyById.get(id);if(!body)return {...systemCenterGameAU};
    if(visited.has(id))throw new Error('Cyclic body orbit');
    visited.add(id);
    if(body.positionGameAU)return {...body.positionGameAU};
    if(!body.orbitGameAU)return {...systemCenterGameAU};
    const anchor=body.parent?position(body.parent,days,visited):body.orbitCenterGameAU??systemCenterGameAU;
    return add(anchor,context.rotateLocal(orbitPosition(body,days)));
  };
  context.gamePosition=position;
  context.orbitCenter=(body,days=0)=>body.parent?position(body.parent,days):body.orbitCenterGameAU??systemCenterGameAU;
  context.orbitPoint=(body,E,days=0)=>context.rotateLocal(orbitalPoint(body,E,days));
  context.frameAt=(body,days=0)=>{
    let frame;
    if(body.pole)frame=bodyFrame(body,days);
    else {
      const tilt=(body.axialTiltDegrees??0)*Math.PI/180;
      frame={x:{x:1,y:0,z:0},pole:{x:0,y:Math.cos(tilt),z:Math.sin(tilt)},z:{x:0,y:-Math.sin(tilt),z:Math.cos(tilt)},spin:days*24/(body.spinHours??24)*Math.PI*2};
    }
    return {x:context.rotateLocal(frame.x),pole:context.rotateLocal(frame.pole),z:context.rotateLocal(frame.z),spin:frame.spin};
  };
  // Resolve once to reject cycles before rendering/extent recursion.
  for(const body of context.allBodies)position(body.id);
  return context;
}

export function bodySystemExtentGameAU(context,body,days=0) {
  let extent=bodyRadiusGameAU(body)*(body.rings?.outerRadiusMultiplier??1);
  for(const moon of context.moons.filter(m=>m.parent===body.id)) {
    const e=elementsAt(moon,days);extent=Math.max(extent,e.a*(1+e.e)+bodySystemExtentGameAU(context,moon,days));
  }
  return extent;
}
export function calculateManagedExtent(context,days=0) {
  const center=context.sectorPlane.originGameAU;
  const centerEnvelope=(body,seen=new Set())=>{
    if(seen.has(body.id))throw new Error('Cyclic extent');seen.add(body.id);
    if(body.positionGameAU)return magnitude(sub(body.positionGameAU,center));
    if(body.orbitGameAU) {
      const e=elementsAt(body,days);
      const parent=body.parent?context.bodyById.get(body.parent):null;
      return (parent?centerEnvelope(parent,seen):magnitude(sub(body.orbitCenterGameAU??context.systemCenterGameAU,center)))+e.a*(1+e.e);
    }
    return magnitude(sub(context.systemCenterGameAU,center));
  };
  let extent=Math.max(0,context.managedExtentGameAU??0);
  for(const body of context.allBodies) {
    if(body.kind==='belt')extent=Math.max(extent,magnitude(sub(body.centerGameAU??context.systemCenterGameAU,center))+body.outerGameAU);
    else extent=Math.max(extent,centerEnvelope(body)+bodyRadiusGameAU(body)*(body.rings?.outerRadiusMultiplier??1));
  }
  return {rawRadiusGameAU:extent,paddedRadiusGameAU:extent*(1+context.extentPadding)};
}

// The only adapter that knows Solar IDs, rendering cues, counts, or labels.
export function createSolContext() {
  const validation=validateSystem();
  if(!validation.valid)throw new Error('Invalid game-space configuration: '+JSON.stringify(validation.issues));
  const stars=[{...SUN,surfaceTextureKey:'sun',surfaceTint:'#ffe3a9',lightColor:'#fff1d7'}];
  const planetaryProfiles=['vacuum-rock','dry-rock','terrestrial-earthlike','dry-rock','gas-giant','gas-giant','gas-giant','gas-giant'];
  const planets=PLANETS.map((body,index)=>({...body,geologyProfileId:planetaryProfiles[index],surfaceType:index>=4?'atmosphere':'solid',...(body.id==='earth'?{surfaceLandMaskPath:'./data/planetary-generation/earth-land-50m-v5.1.2.json'}:{}),surfaceTextureKey:body.id,surfaceTint:body.id==='earth'?'#e9f1ff':'#ffffff',...(body.id==='saturn'?{rings:{innerRadiusMultiplier:SATURN_RING_RADII.inner,outerRadiusMultiplier:SATURN_RING_RADII.outer,textureKey:'rings'}}:{}),...(body.id==='earth'?{cloudTextureKey:'clouds'}:{}),...(['earth','neptune','uranus'].includes(body.id)?{atmosphereColor:body.id==='earth'?'#64acdf':'#679acb'}:{})}));
  return createSystemContext({systemId:'sol',validation,epochISO:EPOCH,displayName:'태양계',subtitle:'모항성계',systemCenterGameAU:ZERO,sectorPlane:{originGameAU:ZERO},stars,planets,moons:MOONS.map(b=>({...b,surfaceType:'solid',geologyProfileId:['europa','ganymede','callisto','titan','enceladus','titania','triton'].includes(b.id)?'ice-surface':'vacuum-rock',surfaceTextureKey:'moon',surfaceTint:b.id==='moon'?'#ffffff':b.color})),belts:BELTS.map(b=>({...b,rotationRate:b.id==='asteroid-belt'?.0009:.00005})),surfaceFiles:SURFACE_FILES});
}
