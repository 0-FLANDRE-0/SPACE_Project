import {bodyRadiusGameAU} from './game-space.js';
import {M1A_TUNING as T} from './ship-data.js';
import {M1B_TUNING as B} from './orbit-data.js';
import {add,sub,mul,unit,distance} from './ship-math.js';
const cache=new WeakMap(),high=b=>bodyRadiusGameAU(b)*T.orbitRadiusMultipliers.high;
export function lagrangeDestinations(context){
  if(cache.has(context))return cache.get(context);const result=[],cfg=B.lagrange;
  for(const body of [...context.planets,...context.moons]){
    const parent=body.parent?context.bodyById.get(body.parent):context.stars.find(b=>b.id==='sun')??context.stars[0];if(!parent||!body.orbitGameAU)continue;
    const siblings=(body.parent?context.moons.filter(m=>m.parent===body.parent):context.planets).filter(b=>b.id!==body.id),gap=Math.min(Infinity,...siblings.map(b=>Math.abs(b.orbitGameAU-body.orbitGameAU)));
    let offset;
    if(body.parent){offset=Math.min(Math.max(body.orbitGameAU*cfg.moonOrbitFactor,high(body)*cfg.moonSphereFactor),gap*cfg.moonGapFactor,Math.max(0,body.orbitGameAU-high(parent))*cfg.parentGapFactor);}
    else{const moonExtent=Math.max(0,...context.moons.filter(m=>m.parent===body.id).map(m=>m.orbitGameAU));offset=Math.min(Math.max(high(body)*cfg.planetSphereFactor,moonExtent*cfg.outerMoonFactor),gap*cfg.planetGapFactor);}
    for(let index=1;index<=5;index++)result.push({kind:'lagrange',id:`${parent.id}-${body.id}:L${index}`,name:`${body.parent?parent.name+'–':''}${body.name} L${index}`,bodyId:body.id,parentId:parent.id,index,offsetGameAU:offset,stable:index>=4});
  }
  cache.set(context,result);return result;
}
export function lagrangePosition(context,point,seconds,{diagnostics=false}={}){
  if(typeof point==='string')point=lagrangeDestinations(context).find(p=>p.id===point);if(!point)throw Error('알 수 없는 라그랑주점');
  const body=context.bodyById.get(point.bodyId),parentNow=context.gamePosition(point.parentId,seconds/86400),bodyNow=context.gamePosition(body.id,seconds/86400);let position;
  if(point.index<=2)position=add(bodyNow,mul(unit(sub(bodyNow,parentNow)),point.offsetGameAU*(point.index===1?-1:1)));
  else{const phase=point.index===3?.5:point.index===4?1/6:-1/6,time=seconds/86400+Math.abs(body.period)*phase;position=add(parentNow,sub(context.gamePosition(body.id,time),context.gamePosition(point.parentId,time)));}
  const adjustments=[];
  for(let i=0;i<B.lagrange.maxPushIterations;i++){
    let blocker=null;for(const other of [...context.stars,...context.planets,...context.moons]){const center=context.gamePosition(other.id,seconds/86400),radius=other.kind==='star'?bodyRadiusGameAU(other)+Math.min(T.obstacleMarginGameAU,bodyRadiusGameAU(other)*T.obstacleMarginRadiusFraction):high(other),d=distance(position,center);if(d<radius+B.lagrange.pushClearanceGameAU){blocker={other,center,radius,d};break;}}
    if(!blocker)return diagnostics?{position,adjustments}:position;
    const {other,center,radius,d}=blocker,from={...position};position=add(center,mul(unit(d<1e-10?sub(bodyNow,parentNow):sub(position,center)),radius+B.lagrange.pushClearanceGameAU*2));adjustments.push({bodyId:other.id,from,to:{...position}});
  }
  throw Error('라그랑주점 안전 여유를 확보할 수 없습니다.');
}
export function lagrangeVisible(point,zoomBodyId,context){if(!zoomBodyId)return !context.bodyById.get(point.bodyId).parent;return !!context.bodyById.get(point.bodyId).parent&&(point.parentId===zoomBodyId||point.bodyId===zoomBodyId);}
