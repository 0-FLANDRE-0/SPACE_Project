// U is capacity; Q is integer material quantity. Cash and electricity are
// separate meters. No DOM, clock, storage, prices, or resource-specific rules.
import {materialResource,resourceContentMassKg} from './resource-definitions.js';
import {DEFAULT_PACKAGE_REGISTRY,RECOVERY_SCALE,deepFreeze,safeId,integer,scaledDecimal} from './packaging-specs.js';
export const MAX_PACKAGE_Q=1000000000000000;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),copy=structuredClone;
const dict=()=>({}),add=(d,k,n)=>{const v=(d[k]??0)+n;if(!Number.isSafeInteger(v))throw Error('포장 누계 안전 한도 초과');d[k]=v;};
const ceilRatio=(a,b,d=1000)=>Number((BigInt(a)*BigInt(b)+BigInt(d)-1n)/BigInt(d));
const floorRatio=(a,b,d)=>Number(BigInt(a)*BigInt(b)/BigInt(d));
const sum=a=>a.reduce((s,x)=>{const v=s+x;integer(v,'합계');return v;},0);
const positive=n=>{integer(n,'수량',MAX_PACKAGE_Q);if(n===0)throw Error('양수 포장 수량 필요');return n;};
export function packagingAccountKey({bodyId,ownerId}){if(!safeId(bodyId)||!safeId(ownerId)||bodyId.includes('|')||ownerId.includes('|'))throw Error('명시적인 천체/소유자 키 필요');return bodyId+'|'+ownerId;}
export function createPackagingState(){return {schemaVersion:1,revision:0,accounts:{}};}
function newAccount(ctx,{freeQ={},creditsMicroC=0,energyWh=0}={}){
 return {...ctx,freeQ:copy(freeQ),creditsMicroC,energyWh,groups:{},counters:{},ledger:{initialQ:copy(freeQ),suppliedQ:{},consumedQ:{},lostQ:{},inQ:{},outQ:{},packageDeltaQ:{},freeTransferDeltaQ:{},contentTransferDeltaQ:{},otherContentConsumedQ:{},externalFreeDeltaQ:{},initialCreditsMicroC:creditsMicroC,creditFundedMicroC:0,creditSpentMicroC:0,initialEnergyWh:energyWh,energyFundedWh:0,energySpentWh:0},automation:{enabled:true,lastMs:0,capacityQPerHour:null,batchQ:null,carry:0,protectedFreeQ:{},forecastConsumptionQ:null,benefitMicroCPerU:null,pendingReason:'승인 규격·전력·C·처리능력 미연결',nextJob:1,jobs:[]}};
}
export function packagingAccount(s,ctx){const a=s.accounts[packagingAccountKey(ctx)];if(!a)throw Error('등록되지 않은 포장 재고 계정');return a;}
export function openPackagingAccount(s,ctx,initial={},registry=DEFAULT_PACKAGE_REGISTRY){
 const key=packagingAccountKey(ctx);if(s.accounts[key])throw Error('중복 포장 계정');const w=copy(s);w.accounts[key]=newAccount(ctx,initial);validatePackagingState(w,registry);w.revision++;Object.assign(s,w);return packagingAccount(s,ctx);
}
function counter(a,specId){return a.counters[specId]??={packedQ:0,chargedQ:{},chargedCreditsMicroC:0,chargedEnergyWh:0,recovery:{}};}
function reserved(a,kind,key=null,except=null){return sum(a.automation.jobs.filter(j=>j.status==='reserved'&&j.id!==except).map(j=>kind==='material'?(j.reservation.materialQ[key]??0):j.reservation[kind]));}
export const availableFreeQ=(a,id,except=null)=>(a.freeQ[id]??0)-reserved(a,'material',id,except);
export function packagedQuantityQ(a,resourceId,{includeReserved=true}={}){return sum([...Object.values(a.groups),...(includeReserved?a.automation.jobs.filter(j=>j.status==='reserved').flatMap(j=>j.escrow):[])].filter(g=>g.resourceId===resourceId).map(g=>g.amountQ));}
function allGroups(a){return [...Object.values(a.groups),...a.automation.jobs.filter(j=>j.status==='reserved').flatMap(j=>j.escrow)];}
export function repackageReservation(escrow,spec,amountQ,registry){
 const minimumBack={},materialQ={};
 for(const g of escrow){const old=registry.get(g.packageSpecId);for(const [id,n]of Object.entries(g.bondedMaterialsQ)){const rate=old.materialInputs.find(m=>m.resourceId===id)?.recoveryParts;if(rate===undefined)throw Error('예약 묶음의 알 수 없는 소재');add(minimumBack,id,Number(BigInt(n)*BigInt(rate)/BigInt(RECOVERY_SCALE)));}}
 for(const m of spec.materialInputs)materialQ[m.resourceId]=Math.max(0,ceilRatio(amountQ,m.amountQPer1000Q)-(minimumBack[m.resourceId]??0));
 return {materialQ,creditsMicroC:ceilRatio(amountQ,scaledDecimal(spec.directCostCPerU,1000000,'C')),energyWh:ceilRatio(amountQ,scaledDecimal(spec.electricityKWhPerU,1000,'전력'))};
}
function insertGroup(a,group){if(!group.amountQ)return;const old=a.groups[group.packageSpecId];if(old){old.amountQ+=group.amountQ;integer(old.amountQ,'묶음 수량',MAX_PACKAGE_Q);for(const [id,n]of Object.entries(group.bondedMaterialsQ))add(old.bondedMaterialsQ,id,n);}else a.groups[group.packageSpecId]=copy(group);}
function splitGroup(a,id,take){const g=a.groups[id];positive(take);if(!g||take>g.amountQ)throw Error('묶음 수량 부족');const out={resourceId:g.resourceId,packageSpecId:id,amountQ:take,bondedMaterialsQ:{}};
 for(const [m,n]of Object.entries(g.bondedMaterialsQ)){const release=take===g.amountQ?n:floorRatio(n,take,g.amountQ);out.bondedMaterialsQ[m]=release;g.bondedMaterialsQ[m]-=release;}
 g.amountQ-=take;if(!g.amountQ)delete a.groups[id];return out;
}
function oldestGroups(a,resourceId,registry){return Object.values(a.groups).filter(g=>g.resourceId===resourceId).sort((a,b)=>registry.get(a.packageSpecId).generation-registry.get(b.packageSpecId).generation||a.packageSpecId.localeCompare(b.packageSpecId));}
function takeGroups(a,resourceId,amountQ,registry,specId=null){
 positive(amountQ);let remaining=amountQ;const out=[];
 for(const g of oldestGroups(a,resourceId,registry)){if(specId&&g.packageSpecId!==specId)continue;const take=Math.min(remaining,g.amountQ);if(take){out.push(splitGroup(a,g.packageSpecId,take));remaining-=take;}if(!remaining)break;}
 if(remaining)throw Error('사용 가능한 패키지 재고 부족/예약 중');return out;
}
function recover(a,g,registry){
 const spec=registry.get(g.packageSpecId),c=counter(a,spec.id),result={};
 for(const [id,released]of Object.entries(g.bondedMaterialsQ)){
  const m=spec.materialInputs.find(m=>m.resourceId===id);if(!m)throw Error('규격에 없는 묶인 소재');
  const r=c.recovery[id]??={freedQ:0,returnedQ:0,lostQ:0,remainder:0};
  const numerator=BigInt(released)*BigInt(m.recoveryParts)+BigInt(r.remainder),back=Number(numerator/BigInt(RECOVERY_SCALE));r.remainder=Number(numerator%BigInt(RECOVERY_SCALE));
  r.freedQ+=released;r.returnedQ+=back;r.lostQ+=released-back;add(a.freeQ,id,back);add(a.ledger.lostQ,id,released-back);add(a.ledger.packageDeltaQ,id,back);result[id]=back;
 }
 return result;
}
function funding(a,{resourceId,amountQ=0,creditsMicroC=0,energyWh=0,source='explicit-supply'},registry){
 if(typeof source!=='string'||!source)throw Error('명시적인 공급 출처 필요');
 if(resourceId){materialResource(resourceId,registry.resources);integer(amountQ,'공급',MAX_PACKAGE_Q);add(a.freeQ,resourceId,amountQ);add(a.ledger.suppliedQ,resourceId,amountQ);if(!['industry-output','industry-source','industry-initial','industry-migration'].includes(source))add(a.ledger.externalFreeDeltaQ,resourceId,amountQ);}
 integer(creditsMicroC,'공급 C');integer(energyWh,'공급 전력');a.creditsMicroC+=creditsMicroC;a.energyWh+=energyWh;a.ledger.creditFundedMicroC+=creditsMicroC;a.ledger.energyFundedWh+=energyWh;
}
function packing(a,request,registry,{compatibility=false,reservationId=null}={}){
 const {resourceId,amountQ,packageSpecId}=request;positive(amountQ);const resource=materialResource(resourceId,registry.resources,{configured:true}),spec=registry.get(packageSpecId);
 if(!resource.requiresPackage||spec.resourceId!==resourceId)throw Error('내용물/포장 규격 불일치');
 if(compatibility){if(!spec.compatibility||spec.materialInputs.length)throw Error('미가격화 호환 규격 필요');}
  else{registry.assertExecutable(spec.id);if(!registry.active.has(spec.id))throw Error('비활성 규격');if(!registry.availablePackageSpecs(a.ownerId,request.availablePackageSpecs??null).some(s=>s.id===spec.id))throw Error('현재 소유자에게 잠긴 포장 규격');}
 if(availableFreeQ(a,resourceId,reservationId)<amountQ)throw Error('충전할 실제 내용물 부족');
 const c=counter(a,spec.id),next=c.packedQ+amountQ,materialQ={};integer(next,'누적 포장량');
 for(const m of spec.materialInputs){const desired=ceilRatio(next,m.amountQPer1000Q),n=desired-(c.chargedQ[m.resourceId]??0);integer(n,'소재 차감');materialQ[m.resourceId]=n;if(availableFreeQ(a,m.resourceId,reservationId)<n)throw Error('자유 포장 소재 부족: '+m.resourceId);}
 const totalC=compatibility?0:ceilRatio(next,scaledDecimal(spec.directCostCPerU,1000000,'C')),totalE=compatibility?0:ceilRatio(next,scaledDecimal(spec.electricityKWhPerU,1000,'전력'));
 const credit=totalC-c.chargedCreditsMicroC,energy=totalE-c.chargedEnergyWh;
 if(a.creditsMicroC-reserved(a,'creditsMicroC',null,reservationId)<credit)throw Error('포장 C 부족');if(a.energyWh-reserved(a,'energyWh',null,reservationId)<energy)throw Error('포장 전력 부족');
 add(a.freeQ,resourceId,-amountQ);for(const [id,n]of Object.entries(materialQ)){add(a.freeQ,id,-n);add(a.ledger.packageDeltaQ,id,-n);add(c.chargedQ,id,n);}
 a.creditsMicroC-=credit;a.energyWh-=energy;a.ledger.creditSpentMicroC+=credit;a.ledger.energySpentWh+=energy;c.packedQ=next;c.chargedCreditsMicroC=totalC;c.chargedEnergyWh=totalE;
 insertGroup(a,{resourceId,packageSpecId:spec.id,amountQ,bondedMaterialsQ:materialQ});return {amountQ,materialQ,creditsMicroC:credit,energyWh:energy};
}
function consuming(a,request,registry){
 const {resourceId,amountQ,reason='consumption',unpack=false}=request;materialResource(resourceId,registry.resources,{configured:true});const groups=takeGroups(a,resourceId,amountQ,registry),returnedQ={};
 for(const g of groups)for(const [id,n]of Object.entries(recover(a,g,registry)))add(returnedQ,id,n);
 if(unpack)add(a.freeQ,resourceId,amountQ);else{add(a.ledger.consumedQ,resourceId,amountQ);if(!['construction','smelting'].includes(reason))add(a.ledger.otherContentConsumedQ,resourceId,amountQ);}
 return {amountQ,returnedQ,groups:groups.map(g=>({packageSpecId:g.packageSpecId,amountQ:g.amountQ}))};
}
function repackaging(a,request,registry){const {resourceId,amountQ,fromSpecId=null,toSpecId}=request;const selected=takeGroups(a,resourceId,amountQ,registry,fromSpecId),returnedQ={};if(selected.some(g=>g.packageSpecId===toSpecId))throw Error('동일 규격 재포장 금지');for(const g of selected)for(const [id,n]of Object.entries(recover(a,g,registry)))add(returnedQ,id,n);add(a.freeQ,resourceId,amountQ);return {...packing(a,{...request,packageSpecId:toSpecId},registry),returnedQ};}
function transfer(s,request,registry){
 const {from,to,resourceId,amountQ}=request;if(packagingAccountKey(from)===packagingAccountKey(to))throw Error('같은 계정 이전 금지');const a=packagingAccount(s,from),b=packagingAccount(s,to),groups=takeGroups(a,resourceId,amountQ,registry);
 for(const g of groups){insertGroup(b,g);for(const [id,n]of Object.entries(g.bondedMaterialsQ)){add(a.ledger.outQ,id,n);add(b.ledger.inQ,id,n);}}
 add(a.ledger.outQ,resourceId,amountQ);add(b.ledger.inQ,resourceId,amountQ);add(a.ledger.contentTransferDeltaQ,resourceId,-amountQ);add(b.ledger.contentTransferDeltaQ,resourceId,amountQ);return {amountQ};
}
const quoteData=new WeakMap();
function quote(s,registry,op,request){
 const r={...request},signature=JSON.stringify(s);let work,result,error;
 try{work=copy(s);const a=op==='transfer'?null:packagingAccount(work,r);if(op==='pack')result=packing(a,r,registry);else if(op==='repackage')result=repackaging(a,r,registry);else if(op==='consume')result=consuming(a,r,registry);else if(op==='transfer')result=transfer(work,r,registry);else if(op==='produce'){
   funding(a,{resourceId:r.resourceId,amountQ:r.amountQ,source:r.source??'industry-source'},registry);result=packing(a,r,registry,{compatibility:registry.get(r.packageSpecId).compatibility});
  }else throw Error('알 수 없는 포장 작업');validatePackagingState(work,registry);
 }catch(e){error=e.message;}
 const q=deepFreeze(error?{allowed:false,reason:error}:{allowed:true,...result});quoteData.set(q,{signature,op,request:r,registry});return q;
}
function commit(s,q){const data=quoteData.get(q);if(!data||!q.allowed)throw Error(q?.reason??'정식 견적 필요');if(data.signature!==JSON.stringify(s))throw Error('변경된 재고의 오래된 포장 견적');const again=quote(s,data.registry,data.op,data.request);if(!again.allowed)throw Error(again.reason);
 // Rebuild through the same validated operation, never trust caller-supplied
 // cost deltas or a serialized quote. A quote cannot be replayed after commit.
 const work=copy(s),a=data.op==='transfer'?null:packagingAccount(work,data.request);let result;
 if(data.op==='pack')result=packing(a,data.request,data.registry);if(data.op==='repackage')result=repackaging(a,data.request,data.registry);if(data.op==='consume')result=consuming(a,data.request,data.registry);if(data.op==='transfer')result=transfer(work,data.request,data.registry);
 if(data.op==='produce'){funding(a,{resourceId:data.request.resourceId,amountQ:data.request.amountQ,source:data.request.source??'industry-source'},data.registry);result=packing(a,data.request,data.registry,{compatibility:data.registry.get(data.request.packageSpecId).compatibility});}
 work.revision++;validatePackagingState(work,data.registry);Object.assign(s,work);quoteData.delete(q);return result;
}
export const quotePack=(s,r,request)=>quote(s,r,'pack',request);
export const quoteRepackage=(s,r,request)=>quote(s,r,'repackage',request);
export const quoteIncomingPackage=(s,r,request)=>quote(s,r,'produce',request);
export const commitPack=(s,q)=>commit(s,q);
export const commitRepackage=(s,q)=>commit(s,q);
export const consumePackagedResource=(s,r,request)=>commit(s,quote(s,r,'consume',request));
export const transferPackagedResource=(s,r,request)=>commit(s,quote(s,r,'transfer',request));
export function atomicPackagingChange(s,registry,change,{revisionStep=1}={}){const work=copy(s),result=change(work);work.revision+=typeof revisionStep==='function'?revisionStep(result):revisionStep;validatePackagingState(work,registry);Object.assign(s,work);return result;}
export function fundPackagingAccount(s,registry,request){return atomicPackagingChange(s,registry,w=>funding(packagingAccount(w,request),request,registry));}
export function consumeFreeResource(s,registry,{bodyId,ownerId,resourceId,amountQ,reason='consumption'}){positive(amountQ);materialResource(resourceId,registry.resources);return atomicPackagingChange(s,registry,w=>{const a=packagingAccount(w,{bodyId,ownerId});if(availableFreeQ(a,resourceId)<amountQ)throw Error('자유/예약 재료 부족');add(a.freeQ,resourceId,-amountQ);add(a.ledger.consumedQ,resourceId,amountQ);if(!['construction','smelting'].includes(reason))add(a.ledger.externalFreeDeltaQ,resourceId,-amountQ);return amountQ;});}
export function packageContentAndMaterialMassKg(a,registry=DEFAULT_PACKAGE_REGISTRY){let mass=0;for(const [id,n]of Object.entries(a.freeQ))if(n)mass+=resourceContentMassKg(id,n/1000,registry.resources);for(const g of allGroups(a)){mass+=resourceContentMassKg(g.resourceId,g.amountQ/1000,registry.resources);for(const [id,n]of Object.entries(g.bondedMaterialsQ))if(n)mass+=resourceContentMassKg(id,n/1000,registry.resources);}return mass;}
export function validatePackagingState(s,registry=DEFAULT_PACKAGE_REGISTRY){
 const fields=(o,keys)=>{if(!object(o)||Object.keys(o).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(o,k)))throw Error('포장 저장 필드 불일치');};
 const quantities=(d,{signed=false}={})=>{if(!object(d))throw Error('자원 Q 사전 필요');for(const [id,n]of Object.entries(d)){materialResource(id,registry.resources);if(signed){if(!Number.isSafeInteger(n))throw Error('잘못된 부호 Q');}else integer(n,id);}};
 fields(s,['schemaVersion','revision','accounts']);if(s.schemaVersion!==1||!object(s.accounts))throw Error('포장 저장 버전');integer(s.revision,'revision');
 for(const [key,a]of Object.entries(s.accounts)){
  fields(a,['bodyId','ownerId','freeQ','creditsMicroC','energyWh','groups','counters','ledger','automation']);if(key!==packagingAccountKey(a))throw Error('포장 소유/천체 불일치');quantities(a.freeQ);for(const n of Object.values(a.freeQ))integer(n,'자유 재고',MAX_PACKAGE_Q);integer(a.creditsMicroC,'C');integer(a.energyWh,'전력');
  const l=a.ledger;fields(l,['initialQ','suppliedQ','consumedQ','lostQ','inQ','outQ','packageDeltaQ','freeTransferDeltaQ','contentTransferDeltaQ','otherContentConsumedQ','externalFreeDeltaQ','initialCreditsMicroC','creditFundedMicroC','creditSpentMicroC','initialEnergyWh','energyFundedWh','energySpentWh']);
  for(const k of ['initialQ','suppliedQ','consumedQ','lostQ','inQ','outQ','otherContentConsumedQ'])quantities(l[k]);for(const k of ['packageDeltaQ','freeTransferDeltaQ','contentTransferDeltaQ','externalFreeDeltaQ'])quantities(l[k],{signed:true});
  for(const k of ['initialCreditsMicroC','creditFundedMicroC','creditSpentMicroC','initialEnergyWh','energyFundedWh','energySpentWh'])integer(l[k],k);
  if(a.creditsMicroC!==l.initialCreditsMicroC+l.creditFundedMicroC-l.creditSpentMicroC||a.energyWh!==l.initialEnergyWh+l.energyFundedWh-l.energySpentWh)throw Error('포장 C/전력 보존 불일치');
  if(!object(a.groups)||!object(a.counters))throw Error('포장 묶음/누계 필요');
  const auto=a.automation;fields(auto,['enabled','lastMs','capacityQPerHour','batchQ','carry','protectedFreeQ','forecastConsumptionQ','benefitMicroCPerU','pendingReason','nextJob','jobs']);if(typeof auto.enabled!=='boolean'||!Array.isArray(auto.jobs)||auto.jobs.length>1000||typeof auto.pendingReason!=='string')throw Error('포장 자동화 형식');integer(auto.lastMs,'작업 시각');integer(auto.carry,'작업 잔여');if(auto.carry>=3600000)throw Error('작업 잔여 범위');integer(auto.nextJob,'작업 ID');for(const k of ['capacityQPerHour','batchQ','forecastConsumptionQ','benefitMicroCPerU'])if(auto[k]!==null)integer(auto[k],k);quantities(auto.protectedFreeQ);
  const jobIds=new Set();for(const j of auto.jobs){fields(j,['id','resourceId','fromSpecId','toSpecId','amountQ','processedQ','status','escrow','reservation','availableSpecIds']);if(!safeId(j.id)||jobIds.has(j.id)||!['reserved','completed','cancelled'].includes(j.status))throw Error('포장 작업 ID/상태');jobIds.add(j.id);positive(j.amountQ);integer(j.processedQ,'처리량');if(j.processedQ>j.amountQ)throw Error('처리능력 초과');materialResource(j.resourceId,registry.resources,{configured:true});if(j.fromSpecId!==null)registry.get(j.fromSpecId);registry.assertExecutable(j.toSpecId);if(!Array.isArray(j.availableSpecIds)||!j.availableSpecIds.includes(j.toSpecId)||j.availableSpecIds.some(id=>!registry.active.has(id)))throw Error('예약 작업 해금 참조');if(!Array.isArray(j.escrow))throw Error('작업 보관 묶음');fields(j.reservation,['materialQ','creditsMicroC','energyWh']);quantities(j.reservation.materialQ);integer(j.reservation.creditsMicroC,'예약 C');integer(j.reservation.energyWh,'예약 전력');if(j.status==='reserved'&&sum(j.escrow.map(g=>g.amountQ))!==j.amountQ)throw Error('작업 내용물 예약 불일치');if(j.status!=='reserved'&&j.escrow.length)throw Error('완료/취소 작업의 잔여 내용물');}
  const activeJobs=auto.jobs.filter(j=>j.status==='reserved');if(activeJobs.length>1)throw Error('단일 포장 설비의 중복 작업');
  for(const j of auto.jobs){const target=registry.get(j.toSpecId);if(target.resourceId!==j.resourceId||j.fromSpecId===j.toSpecId)throw Error('작업 규격/내용물 불일치');if(j.status==='completed'&&j.processedQ!==j.amountQ)throw Error('미처리 작업 완료');if(j.status==='reserved'){
   if(j.escrow.some(g=>g.resourceId!==j.resourceId||(j.fromSpecId!==null&&g.packageSpecId!==j.fromSpecId)))throw Error('예약 묶음 출처 불일치');
   const expected=repackageReservation(j.escrow,target,j.amountQ,registry),actual=j.reservation;
   if(actual.creditsMicroC!==expected.creditsMicroC||actual.energyWh!==expected.energyWh||Object.keys(actual.materialQ).length!==Object.keys(expected.materialQ).length||Object.entries(expected.materialQ).some(([id,n])=>actual.materialQ[id]!==n))throw Error('작업 예약 입력 불일치');
  }}
  const holdings={...a.freeQ},groupKeys=new Set();for(const g of allGroups(a)){fields(g,['resourceId','packageSpecId','amountQ','bondedMaterialsQ']);const spec=registry.get(g.packageSpecId);if(spec.resourceId!==g.resourceId)throw Error('묶음 규격/내용물');if(!materialResource(g.resourceId,registry.resources,{configured:true}).requiresPackage)throw Error('벌크 자원을 패키지 내용물로 저장할 수 없습니다.');positive(g.amountQ);quantities(g.bondedMaterialsQ);if(Object.keys(g.bondedMaterialsQ).some(id=>!spec.materialInputs.some(m=>m.resourceId===id)))throw Error('발명된 포장 소재');add(holdings,g.resourceId,g.amountQ);for(const [id,n]of Object.entries(g.bondedMaterialsQ))add(holdings,id,n);}
  for(const [id,g]of Object.entries(a.groups)){if(id!==g.packageSpecId||groupKeys.has(id))throw Error('묶음 키 중복');groupKeys.add(id);}
  const bound={},returned={},lost={};let paidC=0,paidE=0;
  for(const [id,c]of Object.entries(a.counters)){fields(c,['packedQ','chargedQ','chargedCreditsMicroC','chargedEnergyWh','recovery']);const spec=registry.get(id);integer(c.packedQ,'포장 누계');quantities(c.chargedQ);integer(c.chargedCreditsMicroC,'누계 C');integer(c.chargedEnergyWh,'누계 전력');if(!object(c.recovery))throw Error('회수 잔여 사전');
   for(const m of spec.materialInputs){if((c.chargedQ[m.resourceId]??0)!==ceilRatio(c.packedQ,m.amountQPer1000Q))throw Error('소재 차감 누계 불일치');add(bound,m.resourceId,c.chargedQ[m.resourceId]??0);}
   if(Object.keys(c.chargedQ).some(id=>!spec.materialInputs.some(m=>m.resourceId===id)))throw Error('다른 규격 소재 차감');
   for(const [mat,r]of Object.entries(c.recovery)){fields(r,['freedQ','returnedQ','lostQ','remainder']);for(const n of Object.values(r))integer(n,'회수');const m=spec.materialInputs.find(m=>m.resourceId===mat);if(!m||r.remainder>=RECOVERY_SCALE||r.freedQ!==r.returnedQ+r.lostQ||BigInt(r.freedQ)*BigInt(m.recoveryParts)!==BigInt(r.returnedQ)*BigInt(RECOVERY_SCALE)+BigInt(r.remainder))throw Error('회수율/잔여 보존 불일치');add(returned,mat,r.returnedQ);add(lost,mat,r.lostQ);}
   const cost=spec.compatibility?0:spec.directCostCPerU===null?null:ceilRatio(c.packedQ,scaledDecimal(spec.directCostCPerU,1000000,'C'));
   const energy=spec.compatibility?0:spec.electricityKWhPerU===null?null:ceilRatio(c.packedQ,scaledDecimal(spec.electricityKWhPerU,1000,'전력'));
   if(cost===null||energy===null||c.chargedCreditsMicroC!==cost||c.chargedEnergyWh!==energy)throw Error('미가격화/누계 비용 불일치');paidC+=cost;paidE+=energy;
  }
  if(paidC!==l.creditSpentMicroC||paidE!==l.energySpentWh)throw Error('포장 비용 합계');
  const ids=new Set([...Object.keys(holdings),...Object.keys(l.initialQ),...Object.keys(l.suppliedQ),...Object.keys(l.consumedQ),...Object.keys(l.lostQ),...Object.keys(l.inQ),...Object.keys(l.outQ),...Object.keys(l.packageDeltaQ),...Object.keys(bound),...Object.keys(returned)]);
  for(const id of ids){if((holdings[id]??0)+(l.lostQ[id]??0)+(l.consumedQ[id]??0)!==(l.initialQ[id]??0)+(l.suppliedQ[id]??0)+(l.inQ[id]??0)-(l.outQ[id]??0))throw Error('물질 보존 불일치: '+id);if((l.packageDeltaQ[id]??0)!==(returned[id]??0)-(bound[id]??0))throw Error('포장 자유 소재 출입 불일치');if((l.lostQ[id]??0)!==(lost[id]??0))throw Error('포장 손실 합계 불일치');if(availableFreeQ(a,id)<0)throw Error('소재 이중 예약');}
  if(a.creditsMicroC<reserved(a,'creditsMicroC')||a.energyWh<reserved(a,'energyWh'))throw Error('C/전력 이중 예약');
 }
 const transferredIn={},transferredOut={};for(const a of Object.values(s.accounts)){for(const [id,n]of Object.entries(a.ledger.inQ))add(transferredIn,id,n);for(const [id,n]of Object.entries(a.ledger.outQ))add(transferredOut,id,n);}for(const id of new Set([...Object.keys(transferredIn),...Object.keys(transferredOut)]))if((transferredIn[id]??0)!==(transferredOut[id]??0))throw Error('행성/소유자 이전 짝 불일치');
 return true;
}

// Queue internals share the same conservation validator. Escrow is at most one
// group per spec/job, never one object per tank; it remains part of UI totals.
export const PACKAGING_INTERNALS={copy,add,ceilRatio,packing,recover,insertGroup,takeGroups,allGroups};
