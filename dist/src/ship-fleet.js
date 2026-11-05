import {orbitGraph,orbitPosition,bodyVectorToGame,gameVectorToBody} from './orbit-model.js';
import {lagrangeDestinations,lagrangePosition} from './lagrange-model.js';
import {STARTING_SHIPS,SHIP_DESIGNS,M1A_TUNING as T,validateDrive} from './ship-data.js';
import {createMovementDestinations,asteroidPosition} from './ship-destinations.js';
import {highOrbitRadius,sphereAt,planMovement,stagePosition,stageHeading} from './ship-navigation.js';
import {add,sub,mul,unit,finiteVector} from './ship-math.js';

export class ShipFleet {
  constructor(context,{now=0,onArrival=()=>{},startingShips=context.systemId==='sol'?STARTING_SHIPS:[]}={}){
    this.context=context;this.now=now;this.onArrival=onArrival;this.pauseOnArrival=false;this.events=[];this.destinations=[...createMovementDestinations(context),...lagrangeDestinations(context)];this.ships=new Map();
    const earth=context.bodyById.get('earth');if(!earth&&startingShips.length)throw Error('Starting fleet requires Earth');
    startingShips.forEach((definition,i)=>{const design=SHIP_DESIGNS[definition.designId];validateDrive(design);const offset=mul(unit(T.stationDirections[i%T.stationDirections.length]),highOrbitRadius(earth)),position=add(context.gamePosition('earth',now/86400),offset);this.ships.set(definition.id,{...definition,design,position,heading:{x:0,y:0,z:1},attachment:{bodyId:'earth',offset},state:'idle',locationName:'지구 궤도 정거장',plan:null,eventIndex:0});});
  }
  orbitDestinations(bodyId,layer){return orbitGraph(this.context,bodyId).nodes.filter(n=>!layer||n.layer===layer);}
  destinationPosition(destination,seconds=this.now){if(destination.kind==='orbit')return orbitPosition(this.context,destination,seconds);if(destination.kind==='lagrange')return lagrangePosition(this.context,destination,seconds);if(destination.kind==='body')return this.context.gamePosition(destination.id,seconds/86400);if(destination.kind==='asteroid')return asteroidPosition(this.context,destination,seconds);if(destination.kind==='ship')return this.ships.get(destination.id)?.position;return destination.position;}
  resolveTarget(input,shipId){
    let destination=typeof input==='string'?this.destinations.find(d=>d.id===input)??(this.ships.has(input)?{kind:'ship',id:input,name:this.ships.get(input).name}:null):input;
    if(!destination&&typeof input==='string'){const body=[...this.context.planets,...this.context.moons].find(b=>input.startsWith(b.id+':'));if(body){const graph=orbitGraph(this.context,body.id);destination=graph.nodes[graph.byId.get(input)];}}if(!destination)throw Error('유효한 이동 지점이 아닙니다.');if(destination.kind==='ship'&&destination.id===shipId)throw Error('자기 함선을 목적지로 지정할 수 없습니다.');
    if(destination.kind==='body'){
      const body=this.context.bodyById.get(destination.id);if(!body||!['planet','moon'].includes(body.kind))throw Error('항성 등 이 대상에는 도착할 수 없습니다.');
      return{kind:'body',id:body.id,bodyId:body.id,name:body.name,at:t=>this.context.gamePosition(body.id,t/86400)};
    }
    if(destination.kind==='orbit')return{kind:'orbit',id:destination.id,bodyId:destination.bodyId,node:destination,name:destination.name,at:t=>orbitPosition(this.context,destination,t)};
    if(destination.kind==='lagrange')return{kind:'lagrange',id:destination.id,name:destination.name,at:t=>lagrangePosition(this.context,destination,t)};
    const point=this.destinationPosition(destination);if(!finiteVector(point))throw Error('유효한 이동 좌표가 아닙니다.');
    // Friendly ships are snapshots. Orbiting asteroid waypoints predict arrival.
    return destination.kind==='asteroid'?{kind:'asteroid',id:destination.id,name:destination.name,at:t=>asteroidPosition(this.context,destination,t)}:{kind:'point',id:destination.id??'manual-point',name:destination.name??'좌표점',position:{...point},at:()=>({...point})};
  }
  order(id,input,{source=null}={}){
    const ship=this.ships.get(id);if(!ship)throw Error('함선을 먼저 선택하세요.');
    const target=this.resolveTarget(input,id),pose={position:{...ship.position},heading:{...ship.heading},attachment:ship.attachment?structuredClone(ship.attachment):null,holdingAt:ship.holdingAt??null,time:this.now},plan=planMovement(this.context,pose,target,ship.design);
    this.onOrder?.(id,source);
    if(!plan.stages.length){ship.plan=null;ship.state='idle';this.attachAt(ship,this.now,plan.targetBodyId,plan.targetOrbitId);ship.locationName=target.name;return ship;}
    plan.startedAt=this.now;plan.arrivalAt=plan.pose.time;plan.target=target;plan.startPosition={...pose.position};plan.beforeAttachment=pose.attachment;ship.plan=plan;ship.eventIndex=0;ship.state=plan.stages[0].kind;ship.locationName=target.name;this.sampleShip(ship,this.now);return ship;
  }
  attachAt(ship,t,bodyId=null,orbitId=null){
    ship.holdingAt=null;const rotating=!!ship.attachment?.rotating,body=bodyId?this.context.bodyById.get(bodyId):sphereAt(this.context,ship.position,t);
    if(!body){ship.attachment=null;return;}const offset=sub(ship.position,this.context.gamePosition(body.id,t/86400));ship.attachment={bodyId:body.id,offset};
    if(orbitId||rotating){const localOffset=gameVectorToBody(this.context,body.id,offset,t),pointId=orbitId??orbitGraph(this.context,body.id).nodes.find(n=>Math.hypot(n.offset.x-localOffset.x,n.offset.y-localOffset.y,n.offset.z-localOffset.z)<1e-7)?.id??null;Object.assign(ship.attachment,{rotating:true,orbitPointId:pointId,localOffset});}
  }
  cancel(id){const ship=this.ships.get(id);if(!ship?.plan)return false;this.sampleShip(ship,this.now);const holdingAt=ship.holdingAt;ship.plan=null;ship.state='idle';this.attachAt(ship,this.now);if(holdingAt)ship.holdingAt=holdingAt;ship.locationName=ship.attachment?`${this.context.bodyById.get(ship.attachment.bodyId).name} 행성권 대기`:'항성계 좌표 대기';return true;}
  sampleShip(ship,t){
    const plan=ship.plan;if(!plan){if(ship.holdingAt)ship.position=lagrangePosition(this.context,ship.holdingAt,t);else if(ship.attachment){if(ship.attachment.rotating)ship.attachment.offset=bodyVectorToGame(this.context,ship.attachment.bodyId,ship.attachment.localOffset,t);ship.position=add(this.context.gamePosition(ship.attachment.bodyId,t/86400),ship.attachment.offset);}return;}
    const stage=plan.stages.find(s=>t<s.end-1e-8)??plan.stages.at(-1);ship.position=stagePosition(this.context,stage,t);ship.heading=stageHeading(stage,t,this.context);ship.holdingAt=stage.holdingAt??null;ship.state=stage.kind;
    ship.attachment=stage.frameId?{bodyId:stage.frameId,offset:sub(ship.position,this.context.gamePosition(stage.frameId,t/86400)),...(stage.bodyFixed?{rotating:true,localOffset:stage.to&&gameVectorToBody(this.context,stage.frameId,sub(ship.position,this.context.gamePosition(stage.frameId,t/86400)),t)}:{})}:null;
  }
  advanceTo(requested,{pauseOnArrival=this.pauseOnArrival}={}){
    if(!Number.isFinite(requested)||requested<this.now-1e-7)throw Error('Ship clock must be monotonic; reset the development fleet explicitly.');
    let to=Math.max(this.now,requested),paused=false;
    if(pauseOnArrival){const arrivals=[...this.ships.values()].filter(s=>s.plan&&s.plan.arrivalAt<=to+1e-8).map(s=>s.plan.arrivalAt);if(arrivals.length){to=Math.max(this.now,Math.min(...arrivals));paused=true;}}
    const pending=[];
    for(const ship of this.ships.values())if(ship.plan){const plan=ship.plan;while(ship.eventIndex<plan.stages.length&&plan.stages[ship.eventIndex].end<=to+1e-8){const stage=plan.stages[ship.eventIndex++];pending.push({shipId:ship.id,kind:stage.kind+'-complete',time:stage.end});}if(plan.arrivalAt<=to+1e-8){this.sampleShip(ship,plan.arrivalAt);this.attachAt(ship,plan.arrivalAt,plan.targetBodyId,plan.targetOrbitId);if(plan.target.kind==='lagrange')ship.holdingAt=plan.target.id;ship.plan=null;ship.state='idle';ship.locationName=plan.target.name+' 도착';pending.push({shipId:ship.id,kind:'arrival',time:plan.arrivalAt,targetName:plan.target.name});}}
    pending.sort((a,b)=>a.time-b.time||a.shipId.localeCompare(b.shipId));this.events.push(...pending);if(this.events.length>300)this.events.splice(0,this.events.length-300);
    this.now=to;for(const ship of this.ships.values())this.sampleShip(ship,to);
    for(const event of pending)if(event.kind==='arrival')this.onArrival({...event,ship:this.ships.get(event.shipId)});
    return{time:to,paused,events:pending};
  }
}
