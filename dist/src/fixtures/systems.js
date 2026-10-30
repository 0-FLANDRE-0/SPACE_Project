// Developer-only systems. Not additional playable content or real ephemerides.
import { createSystemContext, createSolContext } from '../system-context.js';
const star=(id,name,positionGameAU,spectralClass='K')=>({id,name,english:id.toUpperCase(),kind:'star',positionGameAU,spectralClass,spectralType:spectralClass==='K'?'K5V':'A7V',luminosityClass:'V',starSize:70,color:spectralClass==='K'?'#f1bc79':'#bfd9ff',surfaceTextureKey:'sun',surfaceTint:spectralClass==='K'?'#ffd6a1':'#c7dcff',spinHours:500});
const planet=(id,name,a,size,extras={})=>({id,name,english:id.toUpperCase(),kind:'planet',type:'시험 암석형 행성',planetSize:size,orbitGameAU:a,eccentricity:.04,inclination:4,node:35,argument:20,phase:50,period:300,spinHours:27,axialTiltDegrees:15,color:'#96b7ca',surfaceTextureKey:'mars',...extras});
export function createSmallFixture() {
  return createSystemContext({systemId:'fixture-small',displayName:'에리다니 시험계',subtitle:'개발용 · 소형 항성계',stars:[star('ember','엠버',{x:0,y:0,z:0})],planets:[planet('ochre','오커',50,11,{phase:220,surfaceTextureKey:'mercury'}),planet('vela','벨라',145,18,{period:700,phase:15,surfaceTextureKey:'earth'})],moons:[{id:'pebble',name:'페블',english:'PEBBLE',kind:'moon',parent:'vela',satelliteDiameterWorldUnits:.7,orbitGameAU:12,period:15,eccentricity:.02,inclination:8,node:40,argument:0,phase:100,surfaceTextureKey:'moon',color:'#b7c3ce'}]});
}
export function createLargeFixture() {
  const center={x:3200,y:500,z:-1600};
  return createSystemContext({systemId:'fixture-wide',displayName:'카이트 시험계',subtitle:'개발용 · 경사진 다중 항성계',systemCenterGameAU:center,sectorPlane:{originGameAU:{x:3210,y:505,z:-1600},normal:{x:.35,y:.82,z:.45},tangentU:{x:1,y:0,z:0}},stars:[star('primary','아스터',{x:3260,y:500,z:-1600},'A'),star('companion','신더',{x:3120,y:500,z:-1600})],planets:[planet('kite-a','나크르',240,14,{phase:150,inclination:18}),planet('kite-b','에코',780,32,{phase:320,period:1600,surfaceTextureKey:'neptune'}),planet('kite-c','베스퍼',1480,39,{eccentricity:.08,inclination:11,period:4800,phase:60,surfaceTextureKey:'jupiter'})],moons:[],belts:[{id:'outer-band',name:'외곽 천체군',english:'OUTER BAND',kind:'belt',innerGameAU:1640,outerGameAU:1800,count:900,color:'#9cb9c8',rotationRate:.00005}]});
}
export const SYSTEM_FACTORIES={sol:createSolContext,small:createSmallFixture,wide:createLargeFixture};
