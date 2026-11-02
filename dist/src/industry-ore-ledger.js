import {containerGroups} from './container-state.js';
import {oreLotKey,oreLotFromKey,validateOreLot,validateOreManifest,ORE_GRADES} from './ore-lot-manifest.js';
import {integer} from './packaging-common.js';
const grades=()=>({low:0,medium:0,high:0});
const add=(o,k,q)=>{o[k]=integer((o[k]??0)+q,'산업 광석 합계');};
export function assertCatalogOreLot(lot,catalog){
 validateOreLot(lot);const source=catalog.deposits.get(lot.depositKey);
 if(!source||source.resourceId!=='ore'||lot.ownerId!=='human'||lot.bodyId!==source.bodyId||lot.depositId!==source.depositId||lot.processingDifficulty!==source.processingDifficulty)throw Error('광석 광맥 출처/소유권/가공 난도 불일치');return source;
}
export function sealedIndustryOreLots(s){const lots=[];for(const a of Object.values(s.packaging.accounts))for(const g of containerGroups(a))if(g.resourceId==='ore'){const lot=validateOreManifest(g,a);lots.push({...lot,amountQ:integer(g.fillQ*g.count,'봉인 광석')});}return lots;}
export function industryOreInventory(s,{bodyId,ownerId='human'}){
 const freeQ={...(s.planetInventory[bodyId]?.[ownerId]?.ore??grades())},sealedQ=grades();for(const lot of sealedIndustryOreLots(s))if(lot.bodyId===bodyId&&lot.ownerId===ownerId)add(sealedQ,lot.grade,lot.amountQ);const totalQ=Object.fromEntries(ORE_GRADES.map(g=>[g,integer(freeQ[g]+sealedQ[g],'전체 원광')]));return {freeQ,sealedQ,totalQ};
}
export function validateIndustryOreCustody(s,catalog){
 if(!Array.isArray(s.inventoryLots))throw Error('원광 로트 배열');const freeByBody={},sealedByBody={},sourceStock={},ids=new Set();
 for(const lot of s.inventoryLots){assertCatalogOreLot(lot,catalog);const id=oreLotKey(lot);if(ids.has(id))throw Error('중복 원광 로트 참조');ids.add(id);freeByBody[lot.bodyId]??=grades();add(freeByBody[lot.bodyId],lot.grade,lot.amountQ);add(sourceStock,lot.depositKey,lot.amountQ);}
 for(const a of Object.values(s.packaging.accounts)){
  if((a.freeQ.ore??0)!==0||(a.scu.openedQ.ore??0)!==0||a.scu.automation.jobs.some(j=>j.resourceId==='ore'))throw Error('등급 없는 광석 자유/잔여/자동화 미지원');
  for(const field of ['initialQ','suppliedQ','consumedQ','inQ','outQ','externalFreeDeltaQ','otherContentConsumedQ'])if((a.ledger[field].ore??0)!==0)throw Error('광석 외부 생성/소비/배송 장부 미지원');
  for(const map of Object.values(a.scu.oreCustody))for(const key of Object.keys(map))assertCatalogOreLot(oreLotFromKey(key),catalog);
 }
 for(const lot of sealedIndustryOreLots(s)){assertCatalogOreLot(lot,catalog);sealedByBody[lot.bodyId]??=grades();add(sealedByBody[lot.bodyId],lot.grade,lot.amountQ);add(sourceStock,lot.depositKey,lot.amountQ);}
 for(const [key,q]of Object.entries(sourceStock))if(q>(s.oreExtracted[key]??0))throw Error('광맥 실제 채굴량보다 많은 원광 소유량');
 for(const [bodyId,owners]of Object.entries(s.planetInventory))for(const [owner,inv]of Object.entries(owners))for(const grade of ORE_GRADES)if(inv.ore[grade]!==((owner==='human'?freeByBody[bodyId]?.[grade]:0)??0))throw Error('제련 가용 원광/자유 로트 불일치');
 for(const bodyId of catalog.bodies.keys()){
  let extracted=0;for(const [key,q]of Object.entries(s.oreExtracted)){const d=catalog.deposits.get(key);if(!d)throw Error('미등록 광맥 추출 장부');if(d.bodyId===bodyId)extracted=integer(extracted+q,'실제 채굴 총량');}
  const free=Object.values(freeByBody[bodyId]??grades()).reduce((n,q)=>n+q,0),sealed=Object.values(sealedByBody[bodyId]??grades()).reduce((n,q)=>n+q,0),smelted=s.materialLedger[bodyId]?.smeltingOreQ??0;
  if(free+sealed+smelted!==extracted)throw Error('원광 전체 보존: 자유+봉인+제련 소비 != 실제 채굴');
 }
 return true;
}
export function restoreSealedOreProjection(s,next){
 for(const lot of sealedIndustryOreLots(s)){const key=oreLotKey(lot),target=next.inventoryLots.find(x=>oreLotKey(x)===key);if(target)target.amountQ+=lot.amountQ;else next.inventoryLots.push({...lot});next.planetInventory[lot.bodyId][lot.ownerId].ore[lot.grade]+=lot.amountQ;}return next;
}
