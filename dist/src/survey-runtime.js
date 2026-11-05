import {SURVEY_TUNING as T} from './survey-data.js';
import {bindSurveyKnowledge,unbindSurveyKnowledge,visibleToSurvey,depositSurveyKnowledge} from './survey-knowledge.js';
import {orbitGraph,orbitPosition} from './orbit-model.js';
import {highOrbitRadius,sphereAt} from './ship-navigation.js';
import {distance} from './ship-math.js';
const EPS=T.completionTolerance;
export class SurveyRuntime {
 constructor(fleet,catalog,{runtime=null,capability=T.capability,onAdvance=()=>{},onEvent=()=>{}}={}){
  this.fleet=fleet;this.catalog=catalog;this.runtime=runtime;this.capability={...capability};this.onAdvance=onAdvance;this.onEvent=onEvent;this.now=fleet.now;this.bodies=new Map();this.jobs=new Map();this.queues=new Map();this.events=[];this.cache=new Map();this.pauseOnCompletion=false;
  this.previousOnOrder=fleet.onOrder;this.orderHook=(id,source)=>{this.previousOnOrder?.(id,source);if(source!=='survey')this.cancel(id);};fleet.onOrder=this.orderHook;
  bindSurveyKnowledge(runtime,{deposit:(template,d)=>this.deposit(template.bodyId,d),visible:d=>visibleToSurvey(d,this.capability),negative:(template,tileId)=>this.tileSummary(template.bodyId,tileId).status==='confirmed-zero',hydrogenKnown:key=>this.hydrogenKnown(key)});
 }
 dispose(){unbindSurveyKnowledge(this.runtime);if(this.fleet.onOrder===this.orderHook)this.fleet.onOrder=this.previousOnOrder;}
 record(bodyId){const record=this.catalog.bodies.get(bodyId);if(!record)throw Error('탐사할 표면 자료가 없습니다.');return record;}
 work(bodyId){this.record(bodyId);if(!this.bodies.has(bodyId))this.bodies.set(bodyId,{roughWork:0,preciseWork:{}});return this.bodies.get(bodyId);}
 roughRequired(bodyId){return Math.sqrt(this.record(bodyId).grid.cellCount)*T.roughSecondsPerRootSector*T.roughDifficulty;}
 preciseRequired(bodyId,tileId){const c=this.catalog.cell(bodyId,tileId),atmosphere=c.geology.surfaceType==='atmosphere'?T.atmosphereMultiplier:T.thickAtmosphereMultiplier;return T.preciseSecondsPerSector*(1+(c.geology.environment.terrainObstacle??0))*atmosphere;}
 roughProgress(bodyId){return Math.min(1,(this.bodies.get(bodyId)?.roughWork??0)/this.roughRequired(bodyId));}
 preciseProgress(bodyId,tileId){return Math.min(1,(this.bodies.get(bodyId)?.preciseWork[tileId]??0)/this.preciseRequired(bodyId,tileId));}
 explorer(id){const ship=this.fleet.ships.get(id);if(!ship?.design.surveyCapable)throw Error('탐사함만 탐사 명령을 수행할 수 있습니다.');return ship;}
 currentBody(id){const s=this.fleet.ships.get(id);if(!s)return null;const b=this.fleet.context.bodyById.get(s.attachment?.bodyId);return b&&distance(s.position,this.fleet.context.gamePosition(b.id,this.now/86400))<=highOrbitRadius(b)+T.positionToleranceGameAU?b.id:sphereAt(this.fleet.context,s.position,this.now)?.id??null;}
 atSector(id,bodyId,tileId){const ship=this.fleet.ships.get(id),point=ship?.attachment?.orbitPointId,graph=orbitGraph(this.fleet.context,bodyId),index=graph.byId.get(point),node=graph.nodes[index];return !!ship&&!ship.plan&&node?.layer==='low'&&graph.grid.byId.get(tileId)?.vertexIndices.includes(node.vertexIndex)&&distance(ship.position,orbitPosition(this.fleet.context,node,this.now))<=T.positionToleranceGameAU;}
 cancel(id){const job=this.jobs.get(id);if(!job)return false;this.jobs.delete(id);if(job.kind==='precise')this.queues.get(job.bodyId)?.members.delete(id);const ship=this.fleet.ships.get(id);if(ship?.plan?.surveyOwner===id)this.fleet.cancel(id);return true;}
 startRough(id,bodyId=this.currentBody(id)){
  this.explorer(id);if(!bodyId||this.currentBody(id)!==bodyId)throw Error('대략 탐사는 현재 천체의 행성권 안에서 명령하세요.');if(this.roughProgress(bodyId)>=1)throw Error('이미 대략 탐사를 완료한 천체입니다.');this.cancel(id);this.fleet.cancel(id);this.jobs.set(id,{kind:'rough',bodyId});
 }
 nearestPoint(id,bodyId,tileId){const graph=orbitGraph(this.fleet.context,bodyId),ship=this.fleet.ships.get(id);return graph.grid.byId.get(tileId).vertexIndices.map(v=>graph.nodes[v]).sort((a,b)=>distance(ship.position,orbitPosition(this.fleet.context,a,this.now))-distance(ship.position,orbitPosition(this.fleet.context,b,this.now))||a.vertexIndex-b.vertexIndex)[0];}
 sectorDistance(id,bodyId,tileId){return distance(this.fleet.ships.get(id).position,orbitPosition(this.fleet.context,this.nearestPoint(id,bodyId,tileId),this.now));}
 startPrecise(id,bodyId,tileIds,{all=false}={}){
  const ship=this.explorer(id);this.record(bodyId);if(this.currentBody(id)!==bodyId)throw Error('현재 천체 행성권 안의 탐사함으로 명령하세요.');
  const ids=[...new Set(all?this.record(bodyId).grid.tiles.map(t=>t.id):tileIds)];if(!ids.length||ids.some(t=>!this.record(bodyId).grid.byId.has(t)))throw Error('유효한 섹터를 하나 이상 선택하세요.');
  ids.sort((a,b)=>this.possibility(bodyId,b).rank-this.possibility(bodyId,a).rank||this.sectorDistance(id,bodyId,a)-this.sectorDistance(id,bodyId,b)||a.localeCompare(b));
  this.cancel(id);this.fleet.cancel(id);let q=this.queues.get(bodyId);if(!q||q.complete){q={bodyId,order:[],members:new Set(),complete:false};this.queues.set(bodyId,q);}q.order=[...new Set([...q.order,...ids])];q.members.add(id);this.jobs.set(id,{kind:'precise',bodyId,tileId:null,blockedReason:null});this.dispatch();return q;
 }
 emit(kind,bodyId,tileId=null,extra={}){const event={kind,bodyId,tileId,time:this.now,...extra};this.events.push(event);if(this.events.length>T.eventLimit)this.events.shift();this.onEvent(event);return event;}
 dispatch(){
  for(const q of this.queues.values()){
   if(q.complete||!q.members.size)continue;const remaining=q.order.filter(id=>this.preciseProgress(q.bodyId,id)<1);
   if(!remaining.length){q.complete=true;for(const id of q.members){const s=this.fleet.ships.get(id);if(s?.plan?.surveyOwner===id)this.fleet.cancel(id);this.jobs.delete(id);}this.emit('queue-complete',q.bodyId);continue;}
   for(const id of [...q.members].sort()){
    const job=this.jobs.get(id);if(!job||job.tileId)continue;const assigned=[...this.jobs.values()].filter(j=>j.kind==='precise'&&j.bodyId===q.bodyId&&j.tileId).map(j=>j.tileId),unassigned=remaining.filter(t=>!assigned.includes(t)),choices=unassigned.length?unassigned:remaining;
    const tileId=q.members.size===1&&unassigned.length?choices[0]:[...choices].sort((a,b)=>this.sectorDistance(id,q.bodyId,a)-this.sectorDistance(id,q.bodyId,b)||q.order.indexOf(a)-q.order.indexOf(b))[0];job.tileId=tileId;
    if(this.atSector(id,q.bodyId,tileId))continue;
    try{this.fleet.order(id,this.nearestPoint(id,q.bodyId,tileId).id,{source:'survey'});if(this.fleet.ships.get(id).plan)this.fleet.ships.get(id).plan.surveyOwner=id;}catch(error){job.blockedReason=error.message;this.emit('route-blocked',q.bodyId,tileId,{shipId:id,message:error.message});}
   }
  }
 }
 rates(){const groups=new Map();for(const [id,j]of this.jobs){let active=j.kind==='rough'?this.currentBody(id)===j.bodyId&&!this.fleet.ships.get(id).plan:j.tileId&&!j.blockedReason&&this.atSector(id,j.bodyId,j.tileId);if(!active)continue;const key=j.kind+':'+j.bodyId+':'+(j.tileId??''),group=groups.get(key)??{...j,rate:0,ships:[]};group.rate+=this.capability.speedMultiplier/(j.kind==='precise'&&this.roughProgress(j.bodyId)<1?T.withoutRoughMultiplier:1);group.ships.push(id);groups.set(key,group);}return [...groups.values()];}
 remaining(group){return group.kind==='rough'?this.roughRequired(group.bodyId)-this.work(group.bodyId).roughWork:this.preciseRequired(group.bodyId,group.tileId)-(this.work(group.bodyId).preciseWork[group.tileId]??0);}
 advanceTo(requested,{pauseOnArrival=this.fleet.pauseOnArrival,pauseOnCompletion=this.pauseOnCompletion}={}){
  if(!Number.isFinite(requested)||requested<this.now-EPS)throw Error('탐사 시계는 되돌릴 수 없습니다.');const events=[];let paused=false;this.dispatch();
  while(this.now<requested-EPS){
   const groups=this.rates(),arrival=Math.min(Infinity,...[...this.fleet.ships.values()].filter(s=>s.plan&&s.plan.arrivalAt>this.now+EPS).map(s=>s.plan.arrivalAt));let end=Math.min(requested,arrival,groups.length?(Math.floor((this.now+EPS)/T.industryStepSeconds)+1)*T.industryStepSeconds:Infinity);
   for(const g of groups)end=Math.min(end,this.now+Math.max(0,this.remaining(g))/g.rate);
   const dt=end-this.now;if(dt<-EPS)throw Error('탐사 사건 시각 오류');for(const g of groups){const w=this.work(g.bodyId);if(g.kind==='rough')w.roughWork=Math.min(this.roughRequired(g.bodyId),w.roughWork+dt*g.rate);else w.preciseWork[g.tileId]=Math.min(this.preciseRequired(g.bodyId,g.tileId),(w.preciseWork[g.tileId]??0)+dt*g.rate);}
   const moved=this.fleet.advanceTo(end,{pauseOnArrival});this.now=end;
   let completed=false;for(const g of groups)if(this.remaining(g)<=EPS){completed=true;if(g.kind==='rough'){this.work(g.bodyId).roughWork=this.roughRequired(g.bodyId);for(const id of g.ships)this.jobs.delete(id);events.push(this.emit('rough-complete',g.bodyId));}else{this.work(g.bodyId).preciseWork[g.tileId]=this.preciseRequired(g.bodyId,g.tileId);for(const j of this.jobs.values())if(j.kind==='precise'&&j.bodyId===g.bodyId&&j.tileId===g.tileId){j.tileId=null;j.blockedReason=null;}events.push(this.emit('sector-complete',g.bodyId,g.tileId));}}
   this.dispatch();this.onAdvance(end);if(moved.paused||(completed&&pauseOnCompletion)){paused=true;break;}if(dt<=EPS&&!completed)throw Error('탐사 시계가 전진하지 않습니다.');
  }
  return{time:this.now,paused,events};
 }
 bodyInfo(bodyId){const r=this.record(bodyId),key=r.signature+':'+this.capability.revealTier+':'+this.capability.deepEnabled;let info=this.cache.get(bodyId);if(info?.key===key)return info;const deposits=[];for(const t of r.grid.tiles)for(const d of r.template.geology.cells[t.id]?.deposits??[])if(visibleToSurvey(d,this.capability))deposits.push(d);const total=deposits.reduce((s,d)=>s+d.initialReserveU,0),prior={low:0,medium:0,high:0};for(const d of deposits)for(const k of Object.keys(prior))prior[k]+=(d.gradeProbabilities?.[k]??1/3)*(total?d.initialReserveU/total:1/Math.max(1,deposits.length));if(!deposits.length)Object.assign(prior,{low:1/3,medium:1/3,high:1/3});info={key,mean:total/r.grid.cellCount,prior};this.cache.set(bodyId,info);return info;}
 deposit(bodyId,d){const progress=this.preciseProgress(bodyId,this.catalog.deposits.get(this.catalog.key(bodyId,d.depositId))?.tileId??this.record(bodyId).grid.tiles.find(t=>(this.record(bodyId).template.geology.cells[t.id]?.deposits??[]).some(x=>x.depositId===d.depositId))?.id);return depositSurveyKnowledge(this.record(bodyId).template,d,{precise:progress,rough:this.roughProgress(bodyId),capability:this.capability,prior:this.bodyInfo(bodyId).prior});}
 tileSummary(bodyId,tileId){
  const r=this.record(bodyId);if(!r.grid.byId.has(tileId))throw Error('알 수 없는 탐사 섹터');const precise=this.preciseProgress(bodyId,tileId),rough=this.roughProgress(bodyId),estimates=(r.template.geology.cells[tileId]?.deposits??[]).filter(d=>visibleToSurvey(d,this.capability)).map(d=>this.deposit(bodyId,d)).filter(Boolean),deposits=estimates.filter(d=>d.detectedFraction>0),range=estimates.length?estimates.reduce((sum,d)=>[sum[0]+d.range[0],sum[1]+d.range[1]],[0,0]):[0,this.bodyInfo(bodyId).mean*(1-precise)];
  const confirmedU=deposits.reduce((n,d)=>n+d.confirmedU,0),rate=this.rates().find(g=>g.kind==='precise'&&g.bodyId===bodyId&&g.tileId===tileId)?.rate??0,sourceHere=[...this.catalog.hydrogen.values()].filter(h=>h.bodyId===bodyId&&h.tileId===tileId),anySource=[...this.catalog.hydrogen.values()].some(h=>h.bodyId===bodyId);
  const hydrogen=precise>=1?{status:sourceHere.length?'confirmed':'confirmed-zero',sourceIds:sourceHere.map(h=>h.sourceId)}:precise>=T.hydrogenRevealProgress&&sourceHere.length?{status:'detected',sourceIds:sourceHere.map(h=>h.sourceId)}:{status:rough>0&&anySource?'possible':'unknown',sourceIds:[]};
  const status=precise>=1&&!deposits.length?'confirmed-zero':precise>=1?'complete':precise>0?'active':rough>0?'rough':'unknown';return{bodyId,tileId,precise,rough,status,confirmedU,range,deposits,hydrogen,remainingSeconds:rate?(this.preciseRequired(bodyId,tileId)-(this.work(bodyId).preciseWork[tileId]??0))/rate:null,contributors:rate?this.rates().find(g=>g.kind==='precise'&&g.bodyId===bodyId&&g.tileId===tileId).ships:[]};
 }
 possibility(bodyId,tileId){const s=this.tileSummary(bodyId,tileId),mean=this.bodyInfo(bodyId).mean,ratio=mean?(s.range[0]+s.range[1])/2/mean:0,rank=T.possibilityThresholds.filter(n=>ratio>=n).length;return{rank,label:['거의 없음','낮음','보통','높음'][rank]};}
 hydrogenKnown(key){const h=this.catalog.hydrogen.get(key);return !!h&&this.preciseProgress(h.bodyId,h.tileId)>=1;}
 shipStatus(id){const j=this.jobs.get(id);if(!j)return null;const b=this.record(j.bodyId).body,progress=j.kind==='rough'?this.roughProgress(j.bodyId):j.tileId?this.preciseProgress(j.bodyId,j.tileId):0,q=this.queues.get(j.bodyId);return{...j,progress,description:j.kind==='rough'?`대략 탐사 · ${b.name} · ${(progress*100).toFixed(1)}%`:`정밀 탐사 · ${b.name} · ${j.tileId?.split(':').at(-1)??'배정 중'} · ${q.order.filter(t=>this.preciseProgress(j.bodyId,t)>=1).length}/${q.order.length} · ${(progress*100).toFixed(1)}%${this.fleet.ships.get(id).plan?' · 이동 중':j.blockedReason?' · 경로 중단':''}`};}
}
