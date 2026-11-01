// SCU transport packaging. Existing per-U industrial storage stays separate.
import {materialResource,resourceCargoRatio} from './resource-definitions.js';
import {deepFreeze,integer,safeId,checkedProduct} from './packaging-common.js';
import {quoteContainerPlan} from './cargo-scu.js';
import {packagingAccount,packagingAccountKey,atomicPackagingChange,availableFreeQ,validatePackagingState,PACKAGING_INTERNALS as I} from './packaging-inventory.js';
import {addQ,containerCounter,containerGroupKey,containerGroups,insertContainerGroup,takeContainerCount,recoverContainerGroup,containerQuantityQ} from './container-state.js';
const positive=q=>{integer(q,'내용물 Q',1e15);if(!q)throw Error('양수 내용물 필요');};
const legacyQ=(a,id)=>Object.values(a.groups).filter(g=>g.resourceId===id).reduce((n,g)=>n+g.amountQ,0);
export function orderedContainerGroups(a,resourceId,registry){return Object.entries(a.scu.groups).filter(([,g])=>g.resourceId===resourceId).sort(([ka,a],[kb,b])=>registry.containers.get(a.containerSpecId).generation-registry.containers.get(b.containerSpecId).generation||a.containerSpecId.localeCompare(b.containerSpecId)||b.fillQ-a.fillQ||ka.localeCompare(kb));}
function reusable(a,r,registry){
 let left=r.amountQ;const selected=[];
 if(r.source==='sealed'||r.forceNew)return {selected,left};
 for(const [key,g]of orderedContainerGroups(a,r.resourceId,registry)){
  const spec=registry.containers.get(g.containerSpecId);if(r.allowedContainerSizes&&!r.allowedContainerSizes.includes(spec.sizeSCU))continue;
  const n=Math.min(g.count,Math.floor(left/g.fillQ));if(n){selected.push({key,count:n,resourceId:g.resourceId,containerSpecId:g.containerSpecId,fillQ:g.fillQ});left-=n*g.fillQ;}
 }
 return {selected,left};
}
export function takeContainersForQuantity(a,resourceId,amountQ,registry,{protectedCounts={},exact=false}={}){
 let left=amountQ,totalQ=0;const selected=[];
 for(const [key,g]of orderedContainerGroups(a,resourceId,registry)){const available=g.count-(protectedCounts[key]??0),n=Math.min(available,Math.ceil(left/g.fillQ));if(n>0){const part=takeContainerCount(a,key,n);selected.push(part);const q=checkedProduct(n,g.fillQ,'개봉 내용물');totalQ=integer(totalQ+q,'개봉 합계');left-=q;}if(left<=0)break;}
 if(left>0||exact&&totalQ!==amountQ)throw Error('사용 가능한 정수 컨테이너 내용물 부족/예약/부분 수량');return {groups:selected,totalQ};
}
function requireReceiver(a,registry,resourceId,extraQ,{consumer=false}={}){
 const resource=materialResource(resourceId,registry.resources,{configured:true});if(!resource.requiresPackage)return;
 const receiver=a.scu.receivers[resourceId];if(!receiver||!safeId(receiver.bindingId))throw Error('합법적 현지 탱크/소비자/배관 수취 경로 미연결');
 if((a.scu.openedQ[resourceId]??0)+extraQ>receiver.capacityQ)throw Error('개봉 잔여 내용물의 현지 특수 보관 용량 부족');
 if(consumer&&!['consumer','tank','pipeline'].includes(receiver.kind))throw Error('시설 소비 경로 필요');
}
export function configureContainerReceiver(s,registry,ctx,{resourceId,bindingId,kind,capacityQ}){
 return atomicPackagingChange(s,registry,w=>{const a=packagingAccount(w,ctx);materialResource(resourceId,registry.resources,{configured:true});integer(capacityQ,'수취 용량',1e15);if(!safeId(bindingId)||!['tank','consumer','pipeline'].includes(kind))throw Error('수취 경로 오류');a.scu.receivers[resourceId]={bindingId,kind,capacityQ};return true;});
}
export function chargeNewContainers(a,plan,registry,{reservationId=null}={}){
 if(!plan.allowed)throw Error('컨테이너 C/전력 미결정');
 for(const [id,q]of Object.entries(plan.materialQ))if(availableFreeQ(a,id,reservationId)<q)throw Error('컨테이너 자유 소재 부족: '+id);
 if(a.creditsMicroC-I.reserved(a,'creditsMicroC',null,reservationId)<plan.creditsMicroC)throw Error('컨테이너 C 부족');
 if(a.energyWh-I.reserved(a,'energyWh',null,reservationId)<plan.energyWh)throw Error('컨테이너 전력 부족');
 for(const [id,q]of Object.entries(plan.materialQ)){addQ(a.freeQ,id,-q);addQ(a.ledger.packageDeltaQ,id,-q);}
 a.creditsMicroC-=plan.creditsMicroC;a.energyWh-=plan.energyWh;a.ledger.creditSpentMicroC=integer(a.ledger.creditSpentMicroC+plan.creditsMicroC,'포장 C');a.ledger.energySpentWh=integer(a.ledger.energySpentWh+plan.energyWh,'포장 전력');
 for(const item of plan.groups){const recipe=registry.containers.recipe(item.containerSpecId,item.resourceId),c=containerCounter(a,item.resourceId,item.containerSpecId),bondedMaterialsQ={};
  for(const m of recipe.materialInputs){const q=checkedProduct(item.count,m.amountQ,'컨테이너 제작 소재');bondedMaterialsQ[m.resourceId]=q;addQ(c.chargedMaterialsQ,m.resourceId,q);}
  c.createdCount=integer(c.createdCount+item.count,'제작 누계');c.chargedCreditsMicroC=integer(c.chargedCreditsMicroC+checkedProduct(item.count,recipe.directMicroC,'제작 C'),'제작 C 누계');c.chargedEnergyWh=integer(c.chargedEnergyWh+checkedProduct(item.count,recipe.energyWh,'제작 전력'),'제작 전력 누계');insertContainerGroup(a,{...item,bondedMaterialsQ});
 }
 return plan;
}
function takeLocalContent(a,r,amountQ,registry,protectedCounts){
 const recoveredOldMaterialsQ={};let left=amountQ;const opened=Math.min(left,a.scu.openedQ[r.resourceId]??0);if(opened){addQ(a.scu.openedQ,r.resourceId,-opened);if(!a.scu.openedQ[r.resourceId])delete a.scu.openedQ[r.resourceId];left-=opened;}
 const resource=materialResource(r.resourceId,registry.resources,{configured:true});
 if(!resource.requiresPackage){const q=Math.min(left,availableFreeQ(a,r.resourceId));if(q){addQ(a.freeQ,r.resourceId,-q);left-=q;}}
 else{const q=Math.min(left,legacyQ(a,r.resourceId));if(q){for(const g of I.takeGroups(a,r.resourceId,q,registry))for(const [id,n]of Object.entries(I.recover(a,g,registry)))addQ(recoveredOldMaterialsQ,id,n);left-=q;}}
 if(left){const selected=takeContainersForQuantity(a,r.resourceId,left,registry,{protectedCounts});for(const g of selected.groups)for(const [id,n]of Object.entries(recoverContainerGroup(a,g,registry)))addQ(recoveredOldMaterialsQ,id,n);const excess=selected.totalQ-left;if(excess)requireReceiver(a,registry,r.resourceId,excess);if(excess)addQ(a.scu.openedQ,r.resourceId,excess);left=0;}
 return recoveredOldMaterialsQ;
}
function prepare(a,r,registry){
 positive(r.amountQ);if(r.source!==undefined&&!['local','sealed'].includes(r.source))throw Error('SCU 내용물 출처 유형 오류');registry.containers.available(a.ownerId,r.availableContainerSpecs,{allowedContainerSizes:r.allowedContainerSizes??null});const reuse=reusable(a,r,registry),protectedCounts=Object.fromEntries(reuse.selected.map(g=>[g.key,g.count]));
 const reusedSCU=reuse.selected.reduce((n,g)=>n+g.count*registry.containers.get(g.containerSpecId).sizeSCU,0);
 if(r.capacitySCU!==undefined&&(!Number.isSafeInteger(r.capacitySCU)||r.capacitySCU<0))throw Error('실제 SCU 한도 오류');
 if(reusedSCU>(r.capacitySCU??Infinity))throw Error('기존 컨테이너 외형 SCU 용량 초과');
 const plan=reuse.left?quoteContainerPlan(r.resourceId,reuse.left,registry,{...r,ownerId:a.ownerId,capacitySCU:r.capacitySCU===undefined?Infinity:r.capacitySCU-reusedSCU}):null;
 const ratio=resourceCargoRatio(r.resourceId,r.amountQ,registry.resources),occupiedSCU=reusedSCU+(plan?.occupiedSCU??0);
 const combinationMap=new Map(),existingBondedMaterialsQ={},expectedBondedMaterialsQ={...(plan?.materialQ??{})},recoveryNumerators={};
 const accountFor=(specId,count,isNew)=>{const recipe=registry.containers.recipe(specId,r.resourceId),prior=combinationMap.get(specId)??{containerSpecId:specId,sizeSCU:recipe.spec.sizeSCU,count:0,newCount:0,reusedCount:0};prior.count+=count;prior[isNew?'newCount':'reusedCount']+=count;combinationMap.set(specId,prior);for(const m of recipe.materialInputs){const q=checkedProduct(count,m.amountQ,'견적 묶인 소재');if(!isNew){addQ(existingBondedMaterialsQ,m.resourceId,q);addQ(expectedBondedMaterialsQ,m.resourceId,q);}recoveryNumerators[m.resourceId]=(recoveryNumerators[m.resourceId]??0n)+BigInt(q)*BigInt(m.recoveryParts);}};
 for(const item of plan?.combinations??[])accountFor(item.containerSpecId,item.count,true);for(const item of reuse.selected)accountFor(item.containerSpecId,item.count,false);
 const expectedRecoveryQ={},recoveryRemainderParts={},expectedLossQ={};for(const [id,n]of Object.entries(recoveryNumerators)){expectedRecoveryQ[id]=Number(n/1000000n);recoveryRemainderParts[id]=Number(n%1000000n);expectedLossQ[id]=expectedBondedMaterialsQ[id]-expectedRecoveryQ[id];}
 const physical={...(plan??{}),resourceId:r.resourceId,amountQ:r.amountQ,requiredSCU:Number(ratio.numerator)/Number(ratio.denominator),occupiedSCU,wasteSCU:occupiedSCU-Number(ratio.numerator)/Number(ratio.denominator),reuse:reuse.selected.map(g=>({...g})),containerCount:reuse.selected.reduce((n,g)=>n+g.count,0)+(plan?.containerCount??0),combinations:[...combinationMap.values()].sort((a,b)=>b.sizeSCU-a.sizeSCU||a.containerSpecId.localeCompare(b.containerSpecId)),existingBondedMaterialsQ,expectedBondedMaterialsQ,expectedRecoveryQ,recoveryRemainderParts,expectedLossQ,newAmountQ:reuse.left,materialQ:plan?.materialQ??{},creditsMicroC:plan?.creditsMicroC??(plan?null:0),energyWh:plan?.energyWh??(plan?null:0),status:plan?.status??'reuse',allowed:plan?.allowed??true,alreadyPaid:!reuse.left};
 return {plan,reuse,protectedCounts,physical};
}
function rawPack(a,r,registry,prepared){
 const {plan,reuse,protectedCounts,physical}=prepared;if(!reuse.left)return physical;if(!plan.allowed)throw Error('컨테이너 C/전력 입력 미정');
 let recoveredOldMaterialsQ={};if(r.source==='sealed'){
  const selected=takeContainersForQuantity(a,r.resourceId,reuse.left,registry);for(const g of selected.groups)for(const [id,n]of Object.entries(recoverContainerGroup(a,g,registry)))addQ(recoveredOldMaterialsQ,id,n);const excess=selected.totalQ-reuse.left;if(excess)requireReceiver(a,registry,r.resourceId,excess);if(excess)addQ(a.scu.openedQ,r.resourceId,excess);
 }else recoveredOldMaterialsQ=takeLocalContent(a,r,reuse.left,registry,protectedCounts);
 chargeNewContainers(a,plan,registry,r);return {...physical,recoveredOldMaterialsQ};
}
function rawOpen(a,r,registry,{consume=false}={}){
 positive(r.amountQ);let left=r.amountQ,contentQ=0,openedCount=0;const recoveredQ={};
 const buffered=Math.min(left,a.scu.openedQ[r.resourceId]??0);if(buffered){addQ(a.scu.openedQ,r.resourceId,-buffered);if(!a.scu.openedQ[r.resourceId])delete a.scu.openedQ[r.resourceId];left-=buffered;contentQ+=buffered;}
 if(left){const selected=takeContainersForQuantity(a,r.resourceId,left,registry);contentQ+=selected.totalQ;for(const g of selected.groups){openedCount+=g.count;for(const [id,q]of Object.entries(recoverContainerGroup(a,g,registry)))addQ(recoveredQ,id,q);}}
 if(consume){const surplus=contentQ-r.amountQ;requireReceiver(a,registry,r.resourceId,surplus,{consumer:true});if(surplus)addQ(a.scu.openedQ,r.resourceId,surplus);addQ(a.ledger.consumedQ,r.resourceId,r.amountQ);if(!['construction','smelting'].includes(r.reason))addQ(a.ledger.otherContentConsumedQ,r.resourceId,r.amountQ);}
 else{const resource=materialResource(r.resourceId,registry.resources,{configured:true});if(resource.requiresPackage){requireReceiver(a,registry,r.resourceId,contentQ);addQ(a.scu.openedQ,r.resourceId,contentQ);}else addQ(a.freeQ,r.resourceId,contentQ);}
 return {openedCount,contentQ,recoveredQ,consumedQ:consume?r.amountQ:0,remainingOpenedQ:a.scu.openedQ[r.resourceId]??0};
}
function rawTransfer(w,r,registry){
 if(packagingAccountKey(r.from)===packagingAccountKey(r.to))throw Error('동일 계정 이전 금지');const a=packagingAccount(w,r.from),b=packagingAccount(w,r.to);if(!Array.isArray(r.groups)||!r.groups.length)throw Error('이전할 실제 컨테이너 선택 필요');
 if(!safeId(r.deliveryReferenceId)||typeof r.deliveryProvider!=='function')throw Error('실제 도착을 확인한 외부 인도 공급자 미연결: 원장 이전만으로 배송하지 않습니다.');
 if(Object.values(w.accounts).some(account=>account.scu.appliedTransfers.includes(r.deliveryReferenceId)))throw Error('이미 반영한 인도 정산 참조');
 const receipt=r.deliveryProvider(r.deliveryReferenceId);if(!receipt||receipt.phase!=='delivered'||packagingAccountKey(receipt.from)!==packagingAccountKey(r.from)||packagingAccountKey(receipt.to)!==packagingAccountKey(r.to)||JSON.stringify(receipt.groups)!==JSON.stringify(r.groups))throw Error('미도착/일치하지 않는 인도 확인');
 for(const selected of r.groups){const g=takeContainerCount(a,selected.key,selected.count),q=checkedProduct(g.count,g.fillQ,'이전 내용물');containerCounter(a,g.resourceId,g.containerSpecId).sentCount+=g.count;containerCounter(b,g.resourceId,g.containerSpecId).receivedCount+=g.count;insertContainerGroup(b,g);
  for(const [id,n]of [[g.resourceId,q],...Object.entries(g.bondedMaterialsQ)]){addQ(a.ledger.outQ,id,n);addQ(b.ledger.inQ,id,n);}addQ(a.ledger.contentTransferDeltaQ,g.resourceId,-q);addQ(b.ledger.contentTransferDeltaQ,g.resourceId,q);
 }
 a.scu.appliedTransfers.push(r.deliveryReferenceId);return {accountingOnly:true,deliveredByLogistics:false,externalDeliveryReference:r.deliveryReferenceId};
}
const quotes=new WeakMap();
function snapshotRequest(r){const x={...r};for(const k of ['allowedContainerSizes','materialWeights','from','to','groups'])if(x[k]!==undefined)x[k]=structuredClone(x[k]);return x;}
function quote(s,registry,op,request){
 const r=snapshotRequest(request),signature=JSON.stringify(s);let result,physical,reason;
 try{validatePackagingState(s,registry);const w=structuredClone(s),a=op==='transfer'?null:packagingAccount(w,r);
  if(op==='pack'){const prepared=prepare(a,r,registry);physical=prepared.physical;if(!physical.allowed){result={...physical,reason:'컨테이너 C/전력 입력 미정'};}else result={...rawPack(a,r,registry,prepared),allowed:true};}
  else if(op==='open'||op==='consume')result={allowed:true,status:'ready',...rawOpen(a,r,registry,{consume:op==='consume'})};
  else if(op==='transfer')result={allowed:true,status:'ready',...rawTransfer(w,r,registry)};else throw Error('알 수 없는 SCU 작업');
  if(result.allowed)validatePackagingState(w,registry);
 }catch(e){reason=e.message;result={...physical,allowed:false,status:'blocked-input',reason};}
 const q=deepFreeze(result);quotes.set(q,{op,request:r,registry,signature});return q;
}
export const quoteContainerPack=(s,registry,r)=>quote(s,registry,'pack',r);
export const quoteContainerRepackage=(s,registry,r)=>quote(s,registry,'pack',{...r,source:'sealed',forceNew:true});
export const quoteContainerUnpack=(s,registry,r)=>quote(s,registry,'open',r);
export const quoteContainerConsumption=(s,registry,r)=>quote(s,registry,'consume',r);
export function commitContainerOperation(s,q){
 const data=quotes.get(q);if(!data||!q.allowed)throw Error(q?.reason??'정식 SCU 견적 필요');if(data.signature!==JSON.stringify(s))throw Error('오래된 SCU 견적');const again=quote(s,data.registry,data.op,data.request);if(!again.allowed||JSON.stringify(again)!==JSON.stringify(q))throw Error('변경된 SCU 규격/재고/해금 견적');
 const result=atomicPackagingChange(s,data.registry,w=>{const a=data.op==='transfer'?null:packagingAccount(w,data.request);if(data.op==='pack')return rawPack(a,data.request,data.registry,prepare(a,data.request,data.registry));if(data.op==='open'||data.op==='consume')return rawOpen(a,data.request,data.registry,{consume:data.op==='consume'});return rawTransfer(w,data.request,data.registry);},{revisionStep:q.status==='reuse'?0:1});quotes.delete(q);return result;
}
export const commitContainerPack=commitContainerOperation;
export const commitContainerRepackage=commitContainerOperation;
export const unpackContainerResource=(s,r,request)=>commitContainerOperation(s,quoteContainerUnpack(s,r,request));
export const consumeContainerResource=(s,r,request)=>commitContainerOperation(s,quoteContainerConsumption(s,r,request));
// Ledger transfer only. No route, inTransit transition or delivery authorization.
export const transferContainerGroups=(s,r,request)=>commitContainerOperation(s,quote(s,r,'transfer',request));
