import { INDUSTRY_POLICY as P, FACILITY_TYPES, MINING, SMELTING, constructionSlots, constructionEnvironment, investmentCost, extractionEfficiency, rampDurationMonths, processingEfficiency } from './industry-policy.js';
import { sampleGradeBatch, ORE_GRADES } from './ore-quality.js';
import { resourceQuanta } from './resource-quantities.js';
import { depositKnowledgeFor } from './resource-knowledge.js';
import { resolvedSurfaceCell } from './planetary-surface-model.js';
export const INDUSTRY_SCHEMA_VERSION=1;
export const OWNER='human';
export function templateSignature(template){let h=2166136261;for(const c of JSON.stringify(template))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16);}
export class IndustryCatalog {
 constructor(systemId){this.systemId=systemId;this.bodies=new Map();this.deposits=new Map();this.hydrogen=new Map();}
 register(entry){const {grid,body}=entry,template=structuredClone(entry.template);if(grid.systemId!==this.systemId)throw Error('산업 항성계 불일치');
  const record={grid,body,template,signature:templateSignature(template)};this.bodies.set(body.id,record);
  for(const tile of grid.tiles){const cell=resolvedSurfaceCell(template,grid,body,tile.id);for(const d of cell.geology.deposits??[]){const key=this.key(body.id,d.depositId);this.deposits.set(key,{...d,bodyId:body.id,tileId:tile.id,key});}}
  for(const s of template.hydrogenSources??[])this.hydrogen.set(this.key(body.id,s.sourceId),{...s,bodyId:body.id,key:this.key(body.id,s.sourceId)});
 }
 key(bodyId,id){return `${this.systemId}/${bodyId}/${id}`;}
 cell(bodyId,tileId){const b=this.bodies.get(bodyId);if(!b||!b.grid.byId.has(tileId))throw Error('등록되지 않은 표면 구역');return {...resolvedSurfaceCell(b.template,b.grid,b.body,tileId),record:b};}
}
const inventory=()=>({ore:{low:0,medium:0,high:0},alloy:0,hydrogen:0,residue:0});
export function createIndustryState(catalog,days=0,{fixture=false}={}){
 return {schemaVersion:1,kind:'campaign-industry-runtime',systemId:catalog.systemId,scenarioId:fixture?'development-fixture-v1':'unconfigured',seed:'industry-v1',days,originDays:days,settledTick:0,nextFacilitySerial:1,sourceSignatures:Object.fromEntries([...catalog.bodies].map(([id,b])=>[id,b.signature])),governmentTreasuries:{human:fixture?100000:null},planetInventory:{},oreRemaining:{},oreExtracted:{},hydrogenRemaining:{},hydrogenRecovered:{},governmentSlots:{},facilityInstances:{},inventoryLots:[],hydrogenKnowledge:{},depositKnowledge:{},productionExperience:{},productionHistory:[],eventLog:[],materialLedger:{},fixture};
}
export function ownerInventory(s,bodyId,ownerId=OWNER){s.planetInventory[bodyId]??={};return s.planetInventory[bodyId][ownerId]??=inventory();}
export function slotsFor(s,catalog,bodyId,tileId){s.governmentSlots[bodyId]??={};const cell=catalog.cell(bodyId,tileId);return s.governmentSlots[bodyId][tileId]??=constructionSlots(cell.geography,cell.record.body,cell.geology,cell.scenario);}
export function accessibleDeposits(s,catalog,bodyId,tileId,ownerId=OWNER){
 const cell=catalog.cell(bodyId,tileId);
 return (cell.geology.deposits??[]).filter(d=>{const k=depositKnowledgeFor(cell.record.template,d.depositId,ownerId),override=s.depositKnowledge[ownerId]?.[catalog.key(bodyId,d.depositId)];return d.resourceId==='ore'&&d.gradeProbabilities&&(override>0||k?.confirmedFraction>0)&&(d.discoveryTier??5)<=(s.fixture?5:P.maximumDiscoveryTier)&&(d.accessDepth??100)<=(s.fixture?100:P.maximumDepth)&&d.extractionDifficulty!==null&&d.processingDifficulty!==null;}).map(d=>{const key=catalog.key(bodyId,d.depositId),confirmedQ=s.depositKnowledge[ownerId]?.[key]??Math.floor(resourceQuanta(d.initialReserveU)*depositKnowledgeFor(cell.record.template,d.depositId,ownerId).confirmedFraction),remainingQ=s.oreRemaining[key]??resourceQuanta(d.initialReserveU);return {...d,key,confirmedQ,accessibleQ:Math.max(0,Math.min(remainingQ,confirmedQ-(s.oreExtracted[key]??0)))};});
}
// Confirmed estimates can have >3 decimal places. Truncate the accessible budget,
// never the immutable geological reserve, to avoid claiming extra surveyed ore.
export function buildQuote(s,catalog,{bodyId,tileId,slot,type,ownerId=OWNER}){
 const cell=catalog.cell(bodyId,tileId),slots=slotsFor(s,catalog,bodyId,tileId),env=constructionEnvironment(cell.geology,cell.scenario),cost=investmentCost(type,1,'build',env.factor),reasons=[];
 if(!Number.isInteger(slot)||slot<0||slot>=slots.unlockedSlots)reasons.push('구획이 잠겨 있습니다. 기반시설별 개방 정책은 잠정입니다.');else if(slots.slotFacilityIds[slot])reasons.push('이미 사용 중인 구획입니다.');
 if(env.blocked)reasons.push(env.blocked);
 if(cell.scenario.ownerFactionId&&cell.scenario.ownerFactionId!==ownerId)reasons.push('다른 소유권의 구역입니다.');
 if(type===MINING&&accessibleDeposits(s,catalog,bodyId,tileId,ownerId).reduce((n,d)=>n+d.accessibleQ,0)<P.minimumConfirmedOreU*1000)reasons.push('확인·접근 가능한 광석이 시범 기준 1,000 U에 미달합니다.');
 const inv=s.planetInventory[bodyId]?.[ownerId]??inventory(),cash=s.governmentTreasuries[ownerId];
 if(cash===null||cash===undefined)reasons.push('시작 정부 재정이 미정입니다.');else if(cash<cost.creditC)reasons.push('정부 크레딧 부족');
 if(inv.alloy<cost.alloyQ)reasons.push('행성 정부 합금 부족');if(inv.hydrogen<cost.hydrogenQ)reasons.push('행성 정부 수소 부족');
 return {cost,reasons,allowed:reasons.length===0,environmentFactor:env.factor};
}
function log(s,message,facilityId=null){s.eventLog.push({tick:s.settledTick,message,facilityId});if(s.eventLog.length>P.eventLimit)s.eventLog.shift();}
function charge(s,bodyId,ownerId,cost){const inv=ownerInventory(s,bodyId,ownerId);if(s.governmentTreasuries[ownerId]===null||s.governmentTreasuries[ownerId]<cost.creditC||inv.alloy<cost.alloyQ||inv.hydrogen<cost.hydrogenQ)throw Error('건설 자원이 부족합니다.');s.governmentTreasuries[ownerId]-=cost.creditC;inv.alloy-=cost.alloyQ;inv.hydrogen-=cost.hydrogenQ;const ledger=s.materialLedger[bodyId]??={constructionCreditC:0,constructionAlloyQ:0,constructionHydrogenQ:0,smeltingOreQ:0,smeltingHydrogenQ:0,alloyProducedQ:0,residueProducedQ:0};ledger.constructionCreditC+=cost.creditC;ledger.constructionAlloyQ+=cost.alloyQ;ledger.constructionHydrogenQ+=cost.hydrogenQ;}
export function orderConstruction(s,catalog,command){
 const quote=buildQuote(s,catalog,command);if(!quote.allowed)throw Error(quote.reasons.join(' · '));const {bodyId,tileId,slot,type,ownerId=OWNER}=command,slots=slotsFor(s,catalog,bodyId,tileId),id=`facility-${s.nextFacilitySerial++}`;
 charge(s,bodyId,ownerId,quote.cost);
 const deps=type===MINING?accessibleDeposits(s,catalog,bodyId,tileId,ownerId).filter(d=>d.accessibleQ>0).map(d=>d.key):[];
 s.facilityInstances[id]={id,type,ownerId,civilizationId:ownerId,systemId:s.systemId,bodyId,tileId,slot,level:1,equipmentGenerationId:'gen1',installedModules:[],status:'construction',construction:{kind:'build',startedTick:s.settledTick,endTick:s.settledTick+quote.cost.durationTicks,cost:quote.cost},pendingInvestment:null,segments:[],activeDepositIds:deps,activeSourceIds:[],batchSerials:{},fractional:{},yieldRemainder:0,experiencedProductionQ:0,currentUtilization:0,rampupProgress:0,hydrogenMode:'auto',monthlyOperatingCostC:null,powerDemandMW:null,laborDemandPersons:null,lastRates:{oreQ:0,hydrogenQ:0,processedQ:0,alloyQ:0,residueQ:0,hydrogenConsumedQ:0},stopReason:'건설 중'};
 slots.slotFacilityIds[slot]=id;log(s,'건설 자원을 차감하고 공사를 시작했습니다.',id);return id;
}
export function orderInvestment(s,catalog,id,kind){const f=s.facilityInstances[id];if(!f||f.status==='construction'||f.pendingInvestment||!['expand','upgrade'].includes(kind))throw Error('현재 증설·개량을 지시할 수 없습니다.');
 const targets=f.segments.filter(x=>x.equipmentGenerationId==='gen1').map(x=>x.id);if(kind==='expand'&&f.level>=P.maximumLevel)throw Error('시범 최대 규모 Lv5입니다.');if(kind==='upgrade'&&!targets.length)throw Error('개량할 구형 설비가 없습니다.');
 const cell=catalog.cell(f.bodyId,f.tileId),cost=investmentCost(f.type,kind==='expand'?f.level+1:targets.length,kind,constructionEnvironment(cell.geology,cell.scenario).factor);charge(s,f.bodyId,f.ownerId,cost);f.pendingInvestment={kind,startedTick:s.settledTick,endTick:s.settledTick+cost.durationTicks,cost,targetSegmentIds:targets};log(s,kind==='expand'?'기존 설비를 유지하며 증설 시작':'구형 설비 대상 장비 개량 시작',id);
}
function addSegment(f,tick){f.segments.push({id:`${f.id}-level-${f.level}`,completedTick:tick,equipmentGenerationId:'gen1',upgradedTick:null});}
export function facilityCapacity(f,catalog,tick){const deps=f.activeDepositIds.map(k=>catalog.deposits.get(k)).filter(Boolean),difficulty=deps.length?deps.reduce((n,d)=>n+d.extractionDifficulty,0)/deps.length:30,rampTicks=rampDurationMonths(difficulty)*30*24;let capacity=0,readiness=0;
 for(const seg of f.segments){const ramp=Math.min(1,.1+.9*Math.max(0,tick-seg.completedTick)/rampTicks),upgrade=seg.upgradedTick===null?0:.1*Math.min(1,Math.max(0,tick-seg.upgradedTick)/rampTicks);capacity+=ramp*(1+upgrade);readiness+=ramp;}
 return {scale:capacity,ramp:f.segments.length?readiness/f.segments.length:0};
}
function quantize(f,key,raw){const n=raw+(f.fractional[key]??0),q=Math.floor(n+1e-9);f.fractional[key]=Math.max(0,n-q);return q;}
function sourceHydrogen(s,catalog,f,oreQ,capacityOreQ){if(!oreQ)return 0;let q=quantize(f,'hydrogen',100000/720*Math.min(1,oreQ/Math.max(1,capacityOreQ))),recovered=0;f.activeSourceIds=[];
 for(const source of catalog.hydrogen.values()){if(source.bodyId!==f.bodyId||source.tileId!==f.tileId||source.sourceType!=='finite-source'||!s.hydrogenKnowledge[f.ownerId]?.includes(source.key))continue;f.activeSourceIds.push(source.key);const remaining=s.hydrogenRemaining[source.key]??resourceQuanta(source.initialReserveU),take=Math.min(q,remaining);s.hydrogenRemaining[source.key]=remaining-take;s.hydrogenRecovered[source.key]=(s.hydrogenRecovered[source.key]??0)+take;q-=take;recovered+=take;if(!q)break;}return recovered;}
function addLot(s,f,d,grade,q){if(!q)return;let lot=s.inventoryLots.find(x=>x.bodyId===f.bodyId&&x.ownerId===f.ownerId&&x.depositKey===d.key&&x.grade===grade);if(!lot){if(s.inventoryLots.length>=P.lotLimit)throw Error('원광 출처 보관 한도입니다.');lot={bodyId:f.bodyId,ownerId:f.ownerId,depositKey:d.key,depositId:d.depositId,grade,processingDifficulty:d.processingDifficulty,amountQ:0};s.inventoryLots.push(lot);}lot.amountQ+=q;}
function mine(s,catalog,f,tick,capacity){const available=accessibleDeposits(s,catalog,f.bodyId,f.tileId,f.ownerId).filter(d=>f.activeDepositIds.includes(d.key)&&d.accessibleQ>0),inv=ownerInventory(s,f.bodyId,f.ownerId);let budget=5000000/720*capacity.scale,oreQ=0;
 for(const d of available){const efficiency=extractionEfficiency(d.extractionDifficulty)*(1-.2*(d.accessDepth??0)/100),q=Math.min(d.accessibleQ,quantize(f,'ore:'+d.key,budget*efficiency));if(!q)continue;
  const serial=f.batchSerials[d.key]??0,batch=sampleGradeBatch({depositId:d.key,batchSerial:serial,oreAmountU:q/1000,gradeProbabilities:d.gradeProbabilities,seed:s.seed});f.batchSerials[d.key]=serial+1;
  s.oreRemaining[d.key]=(s.oreRemaining[d.key]??resourceQuanta(d.initialReserveU))-q;s.oreExtracted[d.key]=(s.oreExtracted[d.key]??0)+q;
  for(const grade of ORE_GRADES){addLot(s,f,d,grade,batch.quanta[grade]);inv.ore[grade]+=batch.quanta[grade];}oreQ+=q;budget-=q/efficiency;if(budget<1)break;
 }
 const hydrogenQ=sourceHydrogen(s,catalog,f,oreQ,5000000/720);inv.hydrogen+=hydrogenQ;f.lastRates={oreQ,hydrogenQ,processedQ:0,alloyQ:0,residueQ:0,hydrogenConsumedQ:0};f.currentUtilization=Math.min(1,oreQ/(5000000/720*Math.max(1,f.level)));f.stopReason=oreQ?'':'확인·접근 가능한 광석 고갈 또는 대기';f.experiencedProductionQ+=oreQ;
}
function smelt(s,catalog,f,tick,capacity){const inv=ownerInventory(s,f.bodyId,f.ownerId),base=5000000/1.15/720*capacity.scale,lots=s.inventoryLots.filter(l=>l.bodyId===f.bodyId&&l.ownerId===f.ownerId&&l.amountQ>0).sort((a,b)=>a.depositKey.localeCompare(b.depositKey)||ORE_GRADES.indexOf(a.grade)-ORE_GRADES.indexOf(b.grade));
 // Continuous assisted throughput: h=(x-b)*85/(5000-b), limited by
 // the available hydrogen and actual processed ore. Difficulty changes work,
 // never the fixed 14/33/52% yields. FIFO source order is deterministic.
 const maxH=85000/720*capacity.scale,hFactor=f.hydrogenMode==='auto'?Math.min(1,inv.hydrogen/Math.max(1,maxH)):0;let work=base*(1+.15*hFactor),processedQ=0,alloyQ=0,residueQ=0;
 for(const lot of lots){const efficiency=processingEfficiency(lot.processingDifficulty),q=Math.min(lot.amountQ,quantize(f,'smelt:'+lot.depositKey+':'+lot.grade,work*efficiency));if(!q)continue;const numerator=q*({low:14,medium:33,high:52}[lot.grade])+f.yieldRemainder,out=Math.floor(numerator/100);f.yieldRemainder=numerator%100;lot.amountQ-=q;inv.ore[lot.grade]-=q;inv.alloy+=out;inv.residue+=q-out;processedQ+=q;alloyQ+=out;residueQ+=q-out;work-=q/efficiency;if(work<1)break;}
 const hydrogenQ=f.hydrogenMode==='auto'?Math.min(inv.hydrogen,quantize(f,'smeltingHydrogen',maxH*hFactor*Math.min(1,processedQ/(base*(1+.15*hFactor)||1)))):0;inv.hydrogen-=hydrogenQ;
 const ledger=s.materialLedger[f.bodyId]??={constructionCreditC:0,constructionAlloyQ:0,constructionHydrogenQ:0,smeltingOreQ:0,smeltingHydrogenQ:0,alloyProducedQ:0,residueProducedQ:0};ledger.smeltingOreQ+=processedQ;ledger.smeltingHydrogenQ+=hydrogenQ;ledger.alloyProducedQ+=alloyQ;ledger.residueProducedQ+=residueQ;
 f.lastRates={oreQ:0,hydrogenQ:0,processedQ,alloyQ,residueQ,hydrogenConsumedQ:hydrogenQ};f.currentUtilization=Math.min(1,processedQ/(5000000/720*Math.max(1,f.level)));f.stopReason=processedQ?'':'같은 행성 정부 원광 재고 부족';f.experiencedProductionQ+=processedQ;
}
function history(s,f){const month=Math.floor((s.settledTick-1)/720);let row=s.productionHistory.find(x=>x.month===month&&x.facilityId===f.id);if(!row){row={month,facilityId:f.id,bodyId:f.bodyId,tileId:f.tileId,ownerId:f.ownerId,...Object.fromEntries(Object.keys(f.lastRates).map(k=>[k,0]))};s.productionHistory.push(row);}for(const k of Object.keys(f.lastRates))row[k]+=f.lastRates[k];}
export function advanceIndustry(s,catalog,days){if(!Number.isFinite(days)||days<s.days-1e-9)throw Error('산업 시계 역행은 허용하지 않습니다.');const target=Math.floor((days-s.originDays)*24+1e-7);if(target-s.settledTick>P.maxTicksPerAdvance)throw Error('한 번에 처리할 게임 시간이 너무 큽니다. 개발 진행은 1,000일 이하로 나누세요.');
 for(let tick=s.settledTick+1;tick<=target;tick++){s.settledTick=tick;const facilities=Object.values(s.facilityInstances).sort((a,b)=>Number(a.id.split('-').at(-1))-Number(b.id.split('-').at(-1)));
  for(const f of facilities){if(f.construction&&tick>=f.construction.endTick){f.construction=null;f.status='rampup';addSegment(f,tick);log(s,'완공 · 가동 준비 시작',f.id);}if(f.pendingInvestment&&tick>=f.pendingInvestment.endTick){const p=f.pendingInvestment;if(p.kind==='expand'){f.level++;addSegment(f,tick);}else for(const seg of f.segments)if(p.targetSegmentIds.includes(seg.id)){seg.equipmentGenerationId='gen2';seg.upgradedTick=tick;}f.equipmentGenerationId=f.segments.every(x=>x.equipmentGenerationId==='gen2')?'gen2':'gen1';f.pendingInvestment=null;log(s,'투자 공사 완료',f.id);}}
  // Same-hour mine output is available to same-planet smelters, always in ID order.
  for(const type of [MINING,SMELTING])for(const f of facilities.filter(f=>f.type===type&&!f.construction)){const capacity=facilityCapacity(f,catalog,tick);f.rampupProgress=capacity.ramp;(type===MINING?mine:smelt)(s,catalog,f,tick,capacity);f.status=f.stopReason?'stopped':capacity.ramp<1?'rampup':'active';history(s,f);const key=`${f.ownerId}:${f.type}`;s.productionExperience[key]=(s.productionExperience[key]??0)+(type===MINING?f.lastRates.oreQ:f.lastRates.processedQ);}
  s.productionHistory=s.productionHistory.filter(x=>x.month>=Math.floor((tick-1)/720)-P.historyMonths+1);
 }
 s.days=days;return s;
}
