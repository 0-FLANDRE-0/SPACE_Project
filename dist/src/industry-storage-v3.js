// Frozen PR #12 validator before explicit schema4 migration.
import { parseSurfaceJSON } from './planetary-surface-io.js';
import { createIndustryState, OWNER } from './industry-runtime.js';
import { resourceQuanta } from './resource-quantities.js';
import { FACILITY_TYPES, INDUSTRY_POLICY as P } from './industry-policy.js';
import { canonicalPopulationMigration, writePreservedBackup } from './earth-population-update.js';
import {validateIndustryStateV2} from './industry-storage-v2.js';
import {createContainerAccount,containerQuantityQ,containerGroups} from './container-state.js';
import {validateIndustryStateV1,STATE_FIELDS as V1_FIELDS} from './industry-storage-v1.js';
import {validatePackagingState,packagingAccount,packagingAccountKey,packagedQuantityQ} from './packaging-inventory.js';
import {initializePackagingFromV1,industryPackageRegistry} from './industry-packaging.js';
const ensure=(ok,message)=>{if(!ok)throw Error('산업 저장 검증: '+message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fields=(o,keys)=>{ensure(object(o),'객체 필요');ensure(Object.keys(o).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(o,k)),'알 수 없는 필드/필수 필드 누락');};
function industryLegacyProjectionV3(s){
 const next=structuredClone(s);delete next.packaging;next.schemaVersion=1;
 let creditFunded=0;
 for(const a of Object.values(s.packaging.accounts))if(a.ownerId===OWNER)creditFunded+=a.ledger.creditFundedMicroC;
 if(next.governmentTreasuries.human!==null)next.governmentTreasuries.human=Math.round((next.governmentTreasuries.human+creditFunded/1000000)*1000000)/1000000;
 for(const [bodyId,owners]of Object.entries(next.planetInventory)){
  for(const ownerId of Object.keys(owners))if(ownerId!==OWNER)delete owners[ownerId];
  if(!owners.human){delete next.planetInventory[bodyId];continue;}
  const inv=owners.human,a=packagingAccount(s.packaging,{bodyId,ownerId:OWNER}),l=a.ledger;delete inv.resourcesQ;
  for(const id of ['alloy','residue'])inv[id]-=(l.packageDeltaQ[id]??0)+(l.freeTransferDeltaQ[id]??0)+(l.externalFreeDeltaQ[id]??0)+(l.contentTransferDeltaQ[id]??0)-(l.otherContentConsumedQ[id]??0);
  inv.hydrogen-=(l.contentTransferDeltaQ.hydrogen??0);inv.hydrogen+=(l.otherContentConsumedQ.hydrogen??0);
 }
 return next;
}
export function validateIndustryStateV3(s,catalog){
 fields(s,[...V1_FIELDS,'packaging']);ensure(s.schemaVersion===3,'버전 불일치');const registry=industryPackageRegistry(catalog);validatePackagingState(s.packaging,registry,{version:2});
 ensure(object(s.governmentTreasuries)&&Object.values(s.governmentTreasuries).every(n=>n===null||typeof n==='number'&&Number.isFinite(n)&&n>=0),'현재 국고 음수/비정상 수치');
 ensure(object(s.planetInventory),'행성 재고 객체');const accounts=new Set();
 for(const [bodyId,owners]of Object.entries(s.planetInventory)){
  ensure(catalog.bodies.has(bodyId)&&object(owners),'재고 천체');
  for(const [ownerId,inv]of Object.entries(owners)){
   fields(inv,['ore','alloy','hydrogen','residue','resourcesQ']);ensure(object(inv.resourcesQ),'추가 자원 재고');const ctx={bodyId,ownerId},a=packagingAccount(s.packaging,ctx);accounts.add(packagingAccountKey(ctx));
   fields(inv.ore,['low','medium','high']);ensure(Object.values(inv.ore).every(n=>Number.isSafeInteger(n)&&n>=0&&n<=P.maxInventoryQ),'원광 품질 재고 수량');if(ownerId!==OWNER)ensure(Object.values(inv.ore).every(n=>n===0),'민간 원광 품질 lot 공급자 미연결');ensure((a.freeQ.ore??0)===0&&(a.scu.openedQ.ore??0)===0&&!containerGroups(a).some(g=>g.resourceId==='ore'),'원광 품질 lot 포장 소재 어댑터 미연결');
   ensure((a.freeQ.hydrogen??0)===0,'미포장 수소는 저장/자동 활성화 불가');ensure(inv.alloy===(a.freeQ.alloy??0)+containerQuantityQ(a,'alloy')&&inv.residue===(a.freeQ.residue??0)+containerQuantityQ(a,'residue')&&inv.hydrogen===packagedQuantityQ(a,'hydrogen'),'파생 재고/포장 묶음 불일치');
   const extra={};for(const [id,n]of Object.entries(a.freeQ))if(!['alloy','residue','hydrogen'].includes(id))extra[id]=n;for(const g of [...Object.values(a.groups),...a.automation.jobs.filter(j=>j.status==='reserved').flatMap(j=>j.escrow)])if(g.resourceId!=='hydrogen')extra[g.resourceId]=(extra[g.resourceId]??0)+g.amountQ;
   for(const g of containerGroups(a))if(!['hydrogen','alloy','residue'].includes(g.resourceId))extra[g.resourceId]=(extra[g.resourceId]??0)+g.count*g.fillQ;for(const [id,q]of Object.entries(a.scu.openedQ))if(!['hydrogen','alloy','residue'].includes(id))extra[id]=(extra[id]??0)+q;
   ensure(JSON.stringify(Object.entries(extra).sort())===JSON.stringify(Object.entries(inv.resourcesQ).sort()),'추가 자원 합계');ensure(a.ledger.initialCreditsMicroC===0,'초기 포장 자금 생성 금지');if(ownerId!==OWNER)ensure(a.ledger.creditFundedMicroC===0,'민간 금융 공급자 미연결');
  }
 }
 ensure(Object.keys(s.packaging.accounts).length===accounts.size,'분리된 포장 재고 계정');validateIndustryStateV1(industryLegacyProjectionV3(s),catalog);return s;
}
