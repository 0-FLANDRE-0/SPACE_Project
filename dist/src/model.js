import { TimeControl } from './time-control.js';
import { BODY_BY_ID, J2000_DAYS_AT_EPOCH } from './data.js';
const TAU=Math.PI*2;
const RAD=Math.PI/180;
export const wrapAngle=angle=>((angle%TAU)+TAU)%TAU;
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
// Right-handed scene basis: J2000 ecliptic (x,y,z) -> world (x,z,-y).
export const eclipticToWorld=(x,y,z)=>({x,y:z,z:-y});
export function referenceElementsAt(body,days=0) {
  if(body.jplElements) {
    const t=(J2000_DAYS_AT_EPOCH+days)/36525;
    const [a,e,i,L,peri,node]=body.jplElements.base.map((v,k)=>v+body.jplElements.rate[k]*t);
    return {a,e,i,node,argument:peri-node,mean:L-peri};
  }
  return {a:body.realOrbitAU,e:body.eccentricity??0,i:body.inclination??0,node:body.node??0,argument:body.argument??0,mean:(body.phase??0)+days/body.period*360};
}
// Game semimajor axis is authoritative, while all angular/shape data stay astronomical.
export function elementsAt(body,days=0) {
  return {...referenceElementsAt(body,days),a:body.orbitGameAU};
}
export function orbitalPoint(body,eccentric,days=0) {
  return projectOrbitalPoint(elementsAt(body,days),eccentric);
}
export function referenceOrbitalPoint(body,eccentric,days=0) {
  return projectOrbitalPoint(referenceElementsAt(body,days),eccentric);
}
function projectOrbitalPoint({a,e,i,node,argument},eccentric) {
  const xp=a*(Math.cos(eccentric)-e),yp=a*Math.sqrt(1-e*e)*Math.sin(eccentric);
  const w=argument*RAD,O=node*RAD,I=i*RAD;
  const x=(Math.cos(w)*Math.cos(O)-Math.sin(w)*Math.sin(O)*Math.cos(I))*xp+(-Math.sin(w)*Math.cos(O)-Math.cos(w)*Math.sin(O)*Math.cos(I))*yp;
  const y=(Math.cos(w)*Math.sin(O)+Math.sin(w)*Math.cos(O)*Math.cos(I))*xp+(-Math.sin(w)*Math.sin(O)+Math.cos(w)*Math.cos(O)*Math.cos(I))*yp;
  const z=Math.sin(w)*Math.sin(I)*xp+Math.cos(w)*Math.sin(I)*yp;
  return eclipticToWorld(x,y,z);
}
function positionFromElements(elements) {
  const mean=wrapAngle(elements.mean*RAD);let E=mean;
  for(let i=0;i<10;i++)E-=(E-elements.e*Math.sin(E)-mean)/(1-elements.e*Math.cos(E));
  return projectOrbitalPoint(elements,E);
}
export const orbitPosition=(body,days=0)=>positionFromElements(elementsAt(body,days));
export const referenceOrbitPosition=(body,days=0)=>positionFromElements(referenceElementsAt(body,days));
function positionInSystem(id,days,reference) {
  const body=BODY_BY_ID.get(id);
  if(!body||body.kind==='star'||body.kind==='belt')return {x:0,y:0,z:0};
  const local=reference?referenceOrbitPosition(body,days):orbitPosition(body,days);
  if(!body.parent)return local;
  const parent=positionInSystem(body.parent,days,reference);
  return {x:parent.x+local.x,y:parent.y+local.y,z:parent.z+local.z};
}
export const worldPosition=(id,days=0)=>positionInSystem(id,days,false);
export const referenceWorldPosition=(id,days=0)=>positionInSystem(id,days,true);
export function orbitNormal(body,days=0) {
  const {i,node}=elementsAt(body,days),I=i*RAD,O=node*RAD;
  return eclipticToWorld(Math.sin(O)*Math.sin(I),-Math.cos(O)*Math.sin(I),Math.cos(I));
}
// IAU pole/prime-meridian model, including PCK periodic nutation terms.
// The body-fixed spin is applied below this frame, around its LOCAL Y axis.
export function bodyFrame(body,days=0) {
  const d=J2000_DAYS_AT_EPOCH+days,t=d/36525;
  const poly=(values,x)=>values.reduce((sum,v,i)=>sum+v*x**i,0);
  const angles=body.pole.angles.map(values=>poly(values,t)*RAD);
  const correction=(values,fn)=>values.reduce((sum,v,i)=>sum+v*fn(angles[i]),0);
  const ra=(poly(body.pole.ra,t)+correction(body.pole.periodicRA,Math.sin))*RAD;
  const dec=(poly(body.pole.dec,t)+correction(body.pole.periodicDEC,Math.cos))*RAD;
  const obliquity=23.43928*RAD;
  const transform=(x,y,z)=>eclipticToWorld(x,Math.cos(obliquity)*y+Math.sin(obliquity)*z,-Math.sin(obliquity)*y+Math.cos(obliquity)*z);
  const pole=transform(Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec));
  const x=transform(-Math.sin(ra),Math.cos(ra),0);
  const negativeZ=cross(pole,x),z={x:-negativeZ.x,y:-negativeZ.y,z:-negativeZ.z};
  return {pole,x,z,spin:wrapAngle((poly(body.pole.pm,d)+correction(body.pole.periodicPM,Math.sin))*RAD)};
}
export function axialTilt(body,days=0) {
  const pole=bodyFrame(body,days).pole,normal=body.orbitGameAU?orbitNormal(body,days):{x:0,y:1,z:0};
  const sign=Math.sign(body.pole.pm[1]);
  return Math.acos(Math.max(-1,Math.min(1,dot(pole,normal)*sign)))/RAD;
}
export function orbitEmphasis(id,selectedId,bodyMap=BODY_BY_ID) {
  if(!selectedId)return .10;
  if(id===selectedId)return .90;
  if(bodyMap.get(selectedId)?.parent===id)return .32;
  if(bodyMap.get(id)?.parent===selectedId)return .28;
  return .055;
}
export function scaleForView(distanceGameAU,fovDegrees,height,pixels=110) {
  const gameAUPerPixel=2*Math.max(distanceGameAU,1e-8)*Math.tan(fovDegrees*RAD/2)/Math.max(height,1);
  const raw=gameAUPerPixel*pixels,power=10**Math.floor(Math.log10(raw));
  const nice=[1,2,5].filter(n=>n*power<=raw).at(-1)??1;
  const lengthGameAU=nice*power;
  return {unit:'AU',value:lengthGameAU,lengthGameAU,pixels:lengthGameAU/gameAUPerPixel,gameAUPerPixel};
}
export class Simulation extends TimeControl {
  constructor(bodyMap=BODY_BY_ID){super();this.bodyMap=bodyMap;}
  setSystem(context){this.bodyMap=context.bodyById;this.selectedId=null;}
  days=0;selectedId=null;
  get speed(){return this.effectiveSpeed;}
  set speed(value){this.setRequestedSpeed(value);}
  advance(seconds) {this.days+=this.gameSecondsFor(seconds)/86400;}
  select(id) {if(id!==null&&!this.bodyMap.has(id))return false;this.selectedId=id;return true;}
}
