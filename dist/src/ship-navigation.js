import {bodyVectorToGame,gameVectorToBody,orbitPosition,searchOrbit,localObstructionRadius} from './orbit-model.js';
import {lagrangePosition,lagrangeDestinations} from './lagrange-model.js';
import {bodyRadiusGameAU} from './game-space.js';
import {M1A_TUNING as T,validateDrive,chargeMassFactor} from './ship-data.js';
import {add,sub,mul,dot,cross,length,distance,unit,lerp,angle,directionBetween,segmentDistance} from './ship-math.js';

export const highOrbitRadius=body=>bodyRadiusGameAU(body)*T.orbitRadiusMultipliers.high;
export const obstructionRadius=body=>bodyRadiusGameAU(body)+Math.min(T.obstacleMarginGameAU,bodyRadiusGameAU(body)*T.obstacleMarginRadiusFraction);
export function sphereAt(context,position,seconds){return [...context.planets,...context.moons].map(body=>({body,d:distance(position,context.gamePosition(body.id,seconds/86400)),r:highOrbitRadius(body)})).filter(x=>x.d<=x.r+1e-7).sort((a,b)=>a.r-b.r)[0]?.body??null;}
const bodyCenter=(context,id,t)=>context.gamePosition(id,t/86400);
export function stagePosition(context,stage,t){const k=stage.end===stage.start?1:Math.max(0,Math.min(1,(t-stage.start)/(stage.end-stage.start))),p=lerp(stage.from,stage.to,k);if(stage.holdingAt)return lagrangePosition(context,stage.holdingAt,t);return stage.frameId?add(bodyCenter(context,stage.frameId,t),stage.bodyFixed?bodyVectorToGame(context,stage.frameId,p,t):p):p;}
export function stageHeading(stage,t,context){const heading=stage.kind==='turning'?directionBetween(stage.fromHeading,stage.heading,Math.max(0,Math.min(1,(t-stage.start)/Math.max(1e-12,stage.end-stage.start)))):stage.heading;return stage.localHeading?bodyVectorToGame(context,stage.frameId,heading,t):heading;}
export function poseAfter(context,leg){return{position:stagePosition(context,leg.stages.at(-1),leg.end),heading:leg.heading,attachment:leg.frameId?{bodyId:leg.frameId,offset:{...leg.to}}:null,time:leg.end};}

// Solve a continuous arrival residual. Fixed-point first; bounded bisection also
// handles fast moons whose orbital velocity exceeds a pulse drive's speed.
export function solveArrival(evaluate,now){
  let value=now,iterations=0;
  for(;iterations<T.solverMaxIterations;iterations++){const next=evaluate(value).arrival;if(!Number.isFinite(next)||next<now)throw Error('유효한 도착 시각을 계산할 수 없습니다.');if(Math.abs(next-value)<=T.solverToleranceSeconds)return{...evaluate(next),time:next,method:'fixed-point',iterations:iterations+1};value=next;}
  let lo=now,hi=Math.max(now+1,value),f=t=>evaluate(t).arrival-t;
  for(let i=0;f(hi)>0&&i<T.bracketMaxExpansions;i++)hi=now+(hi-now)*2;
  if(f(hi)>0)throw Error('도착 예측의 탐색 범위를 초과했습니다.');
  for(let i=0;i<T.bracketMaxIterations;i++){const mid=(lo+hi)/2,res=f(mid);if(Math.abs(res)<=T.solverToleranceSeconds||hi-lo<=T.solverToleranceSeconds)return{...evaluate(mid),time:mid,method:'bracket',iterations:iterations+i+1};if(res>0)lo=mid;else hi=mid;}
  throw Error('도착 예측이 수렴하지 않았습니다.');
}
export function planLeg(context,pose,targetAt,design,{localFrame=null,charge=true,chargeMultiplier=1}={}){
  const drive=validateDrive(design),speed=localFrame?T.propulsionGameAUPerMinute/60:drive.speedGameAUPerHour/3600,chargeSeconds=localFrame||!charge?0:drive.chargeSeconds*chargeMassFactor(design)*chargeMultiplier;
  const frameId=localFrame??pose.attachment?.bodyId??null,offset=frameId?(pose.attachment?.bodyId===frameId?pose.attachment.offset:sub(pose.position,bodyCenter(context,frameId,pose.time))):null;
  const bodyFixed=!!pose.attachment?.rotating,stationOffset=bodyFixed?pose.attachment.localOffset:offset;const atDeparture=t=>pose.holdingAt?lagrangePosition(context,pose.holdingAt,t):frameId?add(bodyCenter(context,frameId,t),bodyFixed?bodyVectorToGame(context,frameId,stationOffset,t):offset):pose.position;
  const evaluate=arrival=>{
    const goal=targetAt(arrival);let heading=unit(sub(goal,pose.position)),turn=0,start=pose.position;
    // The attached departure point translates while aligning/charging.
    for(let i=0;i<T.directionMaxIterations;i++){turn=angle(pose.heading,heading)/(design.turnDegreesPerSecond*Math.PI/180);start=atDeparture(pose.time+turn+chargeSeconds);heading=unit(sub(goal,start));}
    turn=angle(pose.heading,heading)/(design.turnDegreesPerSecond*Math.PI/180);
    const departure=pose.time+turn+chargeSeconds;start=atDeparture(departure);
    const to=localFrame?sub(goal,bodyCenter(context,localFrame,arrival)):goal;
    const travel=localFrame?distance(offset,to)/speed:distance(start,goal)/speed;
    if(localFrame)heading=unit(sub(to,offset));
    return{arrival:departure+travel,goal,to,heading,turn,departure,startPosition:start};
  };
  // Local travel is in a translating, nonrotating body frame.
  let solved;
  if(localFrame){const to=sub(targetAt(pose.time),bodyCenter(context,localFrame,pose.time)),heading=unit(sub(to,offset)),turn=angle(pose.heading,heading)/(design.turnDegreesPerSecond*Math.PI/180),departure=pose.time+turn;solved={time:departure+distance(offset,to)/speed,to,heading,turn,departure,method:'local',iterations:1};}
  else solved=solveArrival(evaluate,pose.time);
  const {heading,turn,departure}=solved,stages=[],stationary=frameId?stationOffset:pose.position;
  stages.push({kind:'turning',start:pose.time,end:pose.time+turn,from:stationary,to:stationary,frameId,fromHeading:{...pose.heading},heading,bodyFixed,holdingAt:pose.holdingAt??null});
  if(chargeSeconds)stages.push({kind:'charging',start:pose.time+turn,end:departure,from:stationary,to:stationary,frameId,heading,bodyFixed,holdingAt:pose.holdingAt??null});
  const transitFrame=localFrame,from=localFrame?offset:atDeparture(departure),to=localFrame?solved.to:targetAt(solved.time);
  stages.push({kind:localFrame?'propulsion':'cruising',start:departure,end:solved.time,from,to,frameId:transitFrame,heading});
  const departureBodyId=pose.attachment?.bodyId??sphereAt(context,pose.position,pose.time)?.id;for(const stage of stages)stage.departureBodyId=departureBodyId;return{stages,end:solved.time,heading,to,frameId:transitFrame,solver:{method:solved.method,iterations:solved.iterations},speed};
}

// Conservative orbital speed bound (ellipse periapsis speed + parent bound).
function bodySpeedBound(context,body){const e=Math.min(.95,Math.abs(body.eccentricity??body.jplElements?.e?.[0]??.25)),own=body.orbitGameAU?2*Math.PI*body.orbitGameAU/Math.max(1,Math.abs(body.period??1)*86400)*Math.sqrt((1+e)/(1-e))*1.25:0;return own+(body.parent?bodySpeedBound(context,context.bodyById.get(body.parent)):0);}
export function firstObstruction(context,stages,{ignoreIds=[]}={}){
  const bodies=[...context.stars,...context.planets,...context.moons].filter(b=>!ignoreIds.includes(b.id));let first=null;
  for(const stage of stages){
    if(stage.end-stage.start<1e-9)continue;
    const travelSpeed=distance(stage.from,stage.to)/(stage.end-stage.start)+(stage.frameId?bodySpeedBound(context,context.bodyById.get(stage.frameId)):0);
    for(const body of bodies){
      const radius=body.id===stage.frameId||body.id===stage.departureBodyId?localObstructionRadius(body):obstructionRadius(body);if(stage.bodyFixed&&body.id===stage.frameId){if(segmentDistance(stage.from,stage.to,{x:0,y:0,z:0})>radius+1e-8)continue;return{body,time:stage.start,stage,radius};}let spinSpeed=0;if(stage.bodyFixed){const b=context.bodyById.get(stage.frameId),a=context.frameAt(b,stage.start/86400).spin,c=context.frameAt(b,(stage.start+1)/86400).spin;spinSpeed=Math.abs(Math.atan2(Math.sin(c-a),Math.cos(c-a)))*Math.max(length(stage.from),length(stage.to))*1.25;}const bound=travelSpeed+spinSpeed+bodySpeedBound(context,body)+(stage.holdingAt?bodySpeedBound(context,context.bodyById.get(lagrangeDestinations(context).find(p=>p.id===stage.holdingAt).bodyId))*3:0);
      const visit=(lo,hi,depth)=>{const mid=(lo+hi)/2,p=stagePosition(context,stage,mid),center=bodyCenter(context,body.id,mid),d=distance(p,center);if(d-bound*(hi-lo)/2>radius+1e-7)return null;if(d<=radius)return{body,time:mid,position:p,center,radius};if(depth>=T.collisionMaxDepth||hi-lo<T.collisionMinIntervalSeconds)return{body,time:mid,position:p,center,radius,conservative:true};return visit(lo,mid,depth+1)??visit(mid,hi,depth+1);};
      const hit=visit(stage.start,Math.min(stage.end,first?.time??stage.end),0);if(hit&&(!first||hit.time<first.time))first={...hit,stage};
    }
    if(first)break;
  }
  return first;
}


function driveRoute(context,pose,targetAt,design,budget,depth=0){
  if(T.detourMode!=='turn-and-charge-at-each-waypoint')throw Error('지원되지 않는 우회 충전 정책입니다.');
  if(++budget.nodes>T.maxRouteNodes||depth>T.maxDetours)throw Error('안전 경로 탐색 한도를 초과했습니다. 다른 이동 지점을 선택하세요.');
  const direct=planLeg(context,pose,targetAt,design,{chargeMultiplier:depth?T.detourChargeMultiplier:1}),hit=firstObstruction(context,direct.stages);
  if(!hit)return{stages:direct.stages,pose:poseAfter(context,direct),solvers:[direct.solver],waypoints:[]};
  if(hit.stage.kind!=='cruising')throw Error('선회·충전 중 천체가 접근합니다. 다른 지점에서 출발하세요.');
  const forward=unit(sub(targetAt(direct.end),pose.position)),u=unit(cross(forward,Math.abs(forward.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0})),v=cross(forward,u),options=[];
  for(const scale of T.detourRadiusMultipliers)for(let i=0;i<T.detourCandidateCount;i++){
    const radial=mul(add(mul(u,Math.cos(i*Math.PI*2/T.detourCandidateCount)),mul(v,Math.sin(i*Math.PI*2/T.detourCandidateCount))),hit.radius*scale),waypointAt=t=>add(bodyCenter(context,hit.body.id,t),radial);
    const leg=planLeg(context,pose,waypointAt,design,{chargeMultiplier:depth?T.detourChargeMultiplier:1});if(firstObstruction(context,leg.stages))continue;
    const nextPose=poseAfter(context,leg),end=planLeg(context,nextPose,targetAt,design,{chargeMultiplier:T.detourChargeMultiplier}),clear=!firstObstruction(context,end.stages);
    options.push({leg,nextPose,end,clear,via:{position:{...nextPose.position},bodyId:hit.body.id,kind:'detour'}});
  }
  options.sort((a,b)=>Number(b.clear)-Number(a.clear)||a.end.end-b.end.end);
  for(const option of options){try{const rest=option.clear?{stages:option.end.stages,pose:poseAfter(context,option.end),solvers:[option.end.solver],waypoints:[]}:driveRoute(context,option.nextPose,targetAt,design,budget,depth+1);return{stages:[...option.leg.stages,...rest.stages],pose:rest.pose,solvers:[option.leg.solver,...rest.solvers],waypoints:[option.via,...rest.waypoints]};}catch(error){if(budget.nodes>T.maxRouteNodes)throw error;}}
  throw Error('천체를 피하는 안전 경로가 없습니다. 다른 이동 지점을 선택하세요.');
}

export function planMovement(context,pose,target,design){
  const body=target.kind==='body'&&target.bodyId?context.bodyById.get(target.bodyId):null;
  if(target.kind==='body'&&target.bodyId&&(!body||!['planet','moon'].includes(body.kind)))throw Error('항성 등 이 대상에는 도착할 수 없습니다.');
  const current=sphereAt(context,pose.position,pose.time),targetPosition=target.at(pose.time);
  if(target.kind==='orbit'&&current?.id!==target.bodyId){const body=context.bodyById.get(target.bodyId),outer=planMovement(context,pose,{kind:'body',bodyId:body.id,at:t=>context.gamePosition(body.id,t/86400)},design),inner=planMovement(context,outer.pose,target,design);return{...inner,stages:[...outer.stages,...inner.stages],waypoints:[...outer.waypoints,...inner.waypoints],solvers:[...outer.solvers,...inner.solvers],mode:'drive+orbit'};}
  const local=current&&(body?.id===current.id||(!body&&distance(targetPosition,bodyCenter(context,current.id,pose.time))<=highOrbitRadius(current)+1e-7));
  if(local){const offset=target.kind==='orbit'?target.node.offset:body?gameVectorToBody(context,current.id,mul(unit(sub(pose.position,bodyCenter(context,current.id,pose.time))),highOrbitRadius(current)),pose.time):gameVectorToBody(context,current.id,sub(targetPosition,bodyCenter(context,current.id,pose.time)),pose.time);if(length(offset)<localObstructionRadius(current))throw Error('천체 내부에는 도착할 수 없습니다.');
    if(distance(pose.position,targetPosition)<1e-8||(body&&Math.abs(distance(pose.position,bodyCenter(context,current.id,pose.time))-highOrbitRadius(current))<1e-7))return{stages:[],pose,waypoints:[],solvers:[],targetBodyId:current.id,targetOrbitId:target.kind==='orbit'?target.id:null,mode:'orbit-auto'};
    const result=searchOrbit(context,pose,current,design,{goal:target.kind==='orbit'?target.node:{offset}});if(firstObstruction(context,result.stages))throw Error('행성권 경로가 다른 천체에 가려졌습니다.');return{...result,waypoints:result.orbitPoints.map(n=>({kind:'orbit',position:orbitPosition(context,n,n.time)})),solvers:[],targetBodyId:current.id,targetOrbitId:target.kind==='orbit'?target.id:null,mode:'orbit-auto'};}

  const targetAtFrom=start=>t=>{const p=target.at(t);return body?add(p,mul(unit(sub(start,p)),highOrbitRadius(body))):p;};
  let start=pose,prefix=[],exitPoint=null;
  const targetAt=targetAtFrom(pose.position),direct=planLeg(context,pose,targetAt,design),ownIds=current?[current.id,...context.moons.filter(b=>b.parent===current.id).map(b=>b.id)]:[];
  const ownBlocked=current&&firstObstruction(context,direct.stages.filter(s=>s.kind==='cruising'),{ignoreIds:[...context.stars,...context.planets,...context.moons].filter(b=>!ownIds.includes(b.id)).map(b=>b.id)});
  if(ownBlocked){
    const ignoreIds=[...context.stars,...context.planets,...context.moons].filter(b=>!ownIds.includes(b.id)).map(b=>b.id);
    const path=searchOrbit(context,pose,current,design,{departure:p=>{const leg=planLeg(context,p,targetAtFrom(p.position),design);return firstObstruction(context,leg.stages.filter(s=>s.kind==='cruising'),{ignoreIds})?null:leg;}});
    if(firstObstruction(context,path.stages))throw Error('행성권 출발 경로가 다른 천체에 가려졌습니다.');prefix=path.stages;start=path.pose;exitPoint={kind:'los-exit',bodyId:current.id,position:{...start.position},orbitPoints:path.orbitPoints};
  }
  const route=driveRoute(context,start,targetAtFrom(start.position),design,{nodes:0});
  // Refine the final boundary against its actual departure point (the departure
  // body can translate during turn/charge), including after a detour.
  if(body){
    const index=route.stages.findLastIndex(s=>s.kind==='turning'),head=route.stages.slice(0,index),previous=head.at(-1),p=previous?{position:stagePosition(context,previous,previous.end),heading:previous.heading,attachment:previous.frameId?{bodyId:previous.frameId,offset:previous.to}:null,time:previous.end}:start;
    let approach=route.stages.at(-1).from,last;
    for(let i=0;i<T.directionMaxIterations;i++){last=planLeg(context,p,targetAtFrom(approach),design,{chargeMultiplier:route.waypoints.length?T.detourChargeMultiplier:1});const next=last.stages.at(-1).from;if(distance(next,approach)<1e-7)break;approach=next;if(i===T.directionMaxIterations-1)throw Error('최종 접근 방향이 수렴하지 않았습니다.');}
    if(firstObstruction(context,last.stages))throw Error('최종 접근 경로가 가려졌습니다. 다른 이동 지점을 선택하세요.');route.stages=[...head,...last.stages];route.pose=poseAfter(context,last);route.solvers.push(last.solver);
  }
  return{...route,stages:[...prefix,...route.stages],waypoints:[...(exitPoint?[exitPoint]:[]),...route.waypoints],targetBodyId:target.kind==='orbit'?target.bodyId:body?.id??null,targetOrbitId:target.kind==='orbit'?target.id:null,mode:'drive'};
}
