// Local custody adapter: quality lots and cargo book commit together. No shipping.
import {quoteContainerPlan} from './cargo-scu.js';
import {integer,deepFreeze} from './packaging-common.js';
import {assertPackagingTime,bindIndustryPackagingClock} from './packaging-clock.js';
import {packagingAccount,atomicPackagingChange} from './packaging-inventory.js';
import {addQ,takeContainerCount,recoverContainerGroup} from './container-state.js';
import {chargeNewContainers} from './container-inventory.js';
import {oreLotKey,oreLotFromKey,validateOreManifest} from './ore-lot-manifest.js';
import {assertCatalogOreLot} from './industry-ore-ledger.js';
import {validateIndustryState} from './industry-storage.js';
import {industryPackageRegistry,syncIndustryPackageView} from './industry-packaging.js';
const tokens=new WeakMap();
export const isIndustryOreQuote=q=>tokens.has(q);
function requestCopy(r){return structuredClone(Object.fromEntries(Object.entries(r).filter(([,v])=>typeof v!=='function')));}
function localRequest(s,catalog,r){
 validateIndustryState(s,catalog);assertPackagingTime(s.packaging,r.atMs);if(r.resourceId!=='ore'||!catalog.bodies.has(r.bodyId)||r.ownerId!=='human'||!s.planetInventory[r.bodyId]?.[r.ownerId])throw Error('현지 광석 천체/소유자 불일치');
 if(r.from||r.to||r.destination||r.deliveryProvider||r.deliveryReferenceId)throw Error('광석 로트 배송/원격 인도 미지원');
 if(['lots','lotKeys','lotSelections'].some(k=>Object.hasOwn(r,k)))throw Error('혼합/중복 로트 요청 미지원: 단일 lotKey를 선택하세요.');
}
function selectedLot(s,catalog,r){
 let lot;if(r.lotKey!==undefined){const id=oreLotFromKey(r.lotKey);assertCatalogOreLot(id,catalog);if(id.bodyId!==r.bodyId||id.ownerId!==r.ownerId)throw Error('선택 로트의 천체/소유자 불일치');lot=s.inventoryLots.find(x=>oreLotKey(x)===r.lotKey);}
 else if(r.lotPolicy==='single-source-first')lot=s.inventoryLots.filter(x=>x.bodyId===r.bodyId&&x.ownerId===r.ownerId&&x.amountQ>=r.amountQ).sort((a,b)=>{const ka=oreLotKey(a),kb=oreLotKey(b);return ka<kb?-1:ka>kb?1:0;})[0];
 else throw Error('광석 lotKey 또는 명시적 single-source-first 정책 필요');
 if(!lot||lot.amountQ<r.amountQ)throw Error('선택한 단일 광석 로트의 자유 재고 부족');assertCatalogOreLot(lot,catalog);return lot;
}
function stagePack(s,catalog,r,plan,lot){
 const work=structuredClone(s),target=work.inventoryLots.find(x=>oreLotKey(x)===oreLotKey(lot)),registry=industryPackageRegistry(catalog);target.amountQ-=r.amountQ;work.planetInventory[r.bodyId][r.ownerId].ore[lot.grade]-=r.amountQ;
 atomicPackagingChange(work.packaging,registry,book=>{const a=packagingAccount(book,r);addQ(a.scu.oreCustody.packedByLotQ,oreLotKey(lot),r.amountQ);chargeNewContainers(a,plan,registry);});
 syncIndustryPackageView(work,r);validateIndustryState(work,catalog);return work;
}
function stageUnpack(s,catalog,r){
 const work=structuredClone(s),registry=industryPackageRegistry(catalog);let result;
 atomicPackagingChange(work.packaging,registry,book=>{const a=packagingAccount(book,r),group=a.scu.groups[r.groupKey];if(!group||group.resourceId!=='ore')throw Error('선택한 현지 봉인 광석 그룹 없음');const lot=validateOreManifest(group,a);assertCatalogOreLot(lot,catalog);
  let count=r.count;if(count===undefined&&r.amountQ!==undefined){if(r.amountQ%group.fillQ!==0)throw Error('부분 내용물 개봉 미지원: 정수 컨테이너를 선택하세요.');count=r.amountQ/group.fillQ;}integer(count,'개봉 컨테이너 수');if(!count||count>group.count||r.amountQ!==undefined&&r.amountQ!==count*group.fillQ)throw Error('개봉 개수/수량 불일치');
  const opened=takeContainerCount(a,r.groupKey,count),amountQ=integer(opened.fillQ*opened.count,'개봉 원광'),before={...a.ledger.lostQ},recoveredMaterialsQ=recoverContainerGroup(a,opened,registry);addQ(a.scu.oreCustody.unpackedByLotQ,oreLotKey(lot),amountQ);
  const target=work.inventoryLots.find(x=>oreLotKey(x)===oreLotKey(lot));if(target)target.amountQ+=amountQ;else work.inventoryLots.push({...lot,amountQ});work.planetInventory[r.bodyId][r.ownerId].ore[lot.grade]+=amountQ;
  const lostMaterialsQ=Object.fromEntries(Object.keys(opened.bondedMaterialsQ).map(id=>[id,(a.ledger.lostQ[id]??0)-(before[id]??0)]));result={amountQ,count,lot:{...lot,amountQ},recoveredMaterialsQ,lostMaterialsQ,openedSCU:registry.containers.get(opened.containerSpecId).sizeSCU*count};
 });syncIndustryPackageView(work,r);validateIndustryState(work,catalog);return {work,result};
}
function quote(s,catalog,request,kind){
 const r=requestCopy({...request,ownerId:request.ownerId??'human'}),signature=JSON.stringify(s);let q;
 try{if(request.deliveryProvider)throw Error('광석 로트 배송/원격 인도 미지원');localRequest(s,catalog,r);if(kind==='pack'){
  integer(r.amountQ,'광석 포장 Q',1e15);if(!r.amountQ)throw Error('양수 광석 필요');const registry=industryPackageRegistry(catalog),physical=quoteContainerPlan('ore',r.amountQ,registry,{...r,availableContainerSpecs:catalog.availableContainerSpecs});
  if(physical.groups.some(g=>registry.containers.recipe(g.containerSpecId,'ore').materialInputs.some(m=>m.resourceId==='ore')))throw Error('광석 품질 로트의 구조재 사용 미지원');
  if(!physical.allowed&&r.lotKey===undefined&&r.lotPolicy===undefined)q={...physical,kind:'ore-pack',allowed:false,reason:'포장 비용 미정; 실행 전 단일 로트를 선택하세요.'};
  else{const lot=selectedLot(s,catalog,r),plan={...physical,groups:physical.groups.map(g=>({...g,lotManifest:[{...lot,amountQ:g.fillQ}]}))};if(physical.allowed)stagePack(s,catalog,r,plan,lot);q={...plan,...(!physical.allowed?{reason:'컨테이너 C/전력 미정'}:{}),kind:'ore-pack',selectedLot:{...lot},lotKey:oreLotKey(lot)};}
 }else{const {result}=stageUnpack(s,catalog,r);q={allowed:true,status:'ready',kind:'ore-unpack',...result};}}
 catch(error){q={allowed:false,status:'blocked-ore-input',kind:'ore-'+kind,reason:error.message};}
 const frozen=deepFreeze(q);tokens.set(frozen,{state:s,catalog,request:r,kind,signature});return frozen;
}
export const quoteIndustryOrePack=(s,c,r)=>quote(s,c,r,'pack');
export const quoteIndustryOreUnpack=(s,c,r)=>quote(s,c,r,'unpack');
export function commitIndustryOreOperation(s,catalog,ctx,q){
 const token=tokens.get(q);if(!token||!q.allowed)throw Error(q?.reason??'정식 광석 견적 필요');if(token.state!==s||token.catalog!==catalog||token.request.bodyId!==ctx.bodyId||token.request.ownerId!==ctx.ownerId)throw Error('다른 상태/소유자/천체의 광석 견적');if(token.signature!==JSON.stringify(s))throw Error('낡은 광석 로트/원장/시계 견적');
 const again=quote(s,catalog,token.request,token.kind);if(!again.allowed||JSON.stringify(again)!==JSON.stringify(q))throw Error('변경된 광석 로트/규격/해금 견적');
 let work;if(token.kind==='pack'){const lot=selectedLot(s,catalog,token.request);work=stagePack(s,catalog,token.request,q,lot);}else work=stageUnpack(s,catalog,token.request).work;
 Object.assign(s,work);bindIndustryPackagingClock(s);tokens.delete(q);return q;
}
