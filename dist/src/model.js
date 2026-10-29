import { BASE_DAYS_PER_SECOND, BODY_BY_ID, J2000_DAYS_AT_EPOCH, AU_KM } from './data.js';
const TAU=Math.PI*2;
const RAD=Math.PI/180;
export const wrapAngle=angle=>((angle%TAU)+TAU)%TAU;
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
// Right-handed scene basis: J2000 ecliptic (x,y,z) -> world (x,z,-y).
export const eclipticToWorld=(x,y,z)=>({x,y:z,z:-y});
export function elementsAt(body,days=0) {
  if(body.elements) {
    const t=(J2000_DAYS_AT_EPOCH+days)/36525;
    const [a,e,i,L,peri,node]=body.elements.base.map((v,k)=>v+body.elements.rate[k]*t);
    return {a,e,i,node,argument:peri-node,mean:L-peri};
  }
  return {a:body.orbit,e:body.eccentricity??0,i:body.inclination??0,node:body.node??0,argument:body.argument??0,mean:(body.phase??0)+days/body.period*360};
}
export function orbitalPoint(body,eccentric,days=0) {
  const {a,e,i,node,argument}=elementsAt(body,days);
  const xp=a*(Math.cos(eccentric)-e),yp=a*Math.sqrt(1-e*e)*Math.sin(eccentric);
  const w=argument*RAD,O=node*RAD,I=i*RAD;
  const x=(Math.cos(w)*Math.cos(O)-Math.sin(w)*Math.sin(O)*Math.cos(I))*xp+(-Math.sin(w)*Math.cos(O)-Math.cos(w)*Math.sin(O)*Math.cos(I))*yp;
  const y=(Math.cos(w)*Math.sin(O)+Math.sin(w)*Math.cos(O)*Math.cos(I))*xp+(-Math.sin(w)*Math.sin(O)+Math.cos(w)*Math.cos(O)*Math.cos(I))*yp;
  const z=Math.sin(w)*Math.sin(I)*xp+Math.cos(w)*Math.sin(I)*yp;
  return eclipticToWorld(x,y,z);
}
export function orbitPosition(body,days=0) {
  const elements=elementsAt(body,days),mean=wrapAngle(elements.mean*RAD);
  let E=mean;
  for(let i=0;i<10;i++)E-=(E-elements.e*Math.sin(E)-mean)/(1-elements.e*Math.cos(E));
  return orbitalPoint(body,E,days);
}
export function worldPosition(id,days=0) {
  const body=BODY_BY_ID.get(id);
  if(!body?.orbit)return {x:0,y:0,z:0};
  const local=orbitPosition(body,days);
  if(!body.parent)return local;
  const parent=worldPosition(body.parent,days);
  return {x:parent.x+local.x,y:parent.y+local.y,z:parent.z+local.z};
}
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
  const pole=bodyFrame(body,days).pole,normal=body.orbit?orbitNormal(body,days):{x:0,y:1,z:0};
  const sign=Math.sign(body.pole.pm[1]);
  return Math.acos(Math.max(-1,Math.min(1,dot(pole,normal)*sign)))/RAD;
}
export function orbitEmphasis(id,selectedId) {
  if(!selectedId)return .10;
  if(id===selectedId)return .90;
  if(BODY_BY_ID.get(selectedId)?.parent===id)return .32;
  if(BODY_BY_ID.get(id)?.parent===selectedId)return .28;
  return .055;
}
export function scaleForView(distanceAU,fovDegrees,height,pixels=110) {
  const auPerPixel=2*distanceAU*Math.tan(fovDegrees*RAD/2)/Math.max(height,1);
  const raw=auPerPixel*pixels;
  const unit=raw>=.05?'AU':raw*AU_KM>=1?'km':'m';
  const multiplier=unit==='AU'?1:unit==='km'?AU_KM:AU_KM*1000;
  const value=raw*multiplier,power=10**Math.floor(Math.log10(Math.max(value,1e-12)));
  const nice=[1,2,5].filter(n=>n*power<=value).at(-1)??1;
  const length=nice*power;
  return {unit,value:length,au:length/multiplier,pixels:length/multiplier/auPerPixel,auPerPixel};
}
export class Simulation {
  days=0;speed=1;paused=false;selectedId=null;
  advance(seconds) {if(Number.isFinite(seconds)&&seconds>=0&&!this.paused)this.days+=seconds*BASE_DAYS_PER_SECOND*this.speed;}
  select(id) {if(id!==null&&!BODY_BY_ID.has(id))return false;this.selectedId=id;return true;}
}
