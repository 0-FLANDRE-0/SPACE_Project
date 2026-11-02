import {validateIndustryOreCustody,restoreSealedOreProjection} from './industry-ore-ledger.js';
import { parseSurfaceJSON } from './planetary-surface-io.js';
import { createIndustryState, OWNER } from './industry-runtime.js';
import { resourceQuanta } from './resource-quantities.js';
import { FACILITY_TYPES, INDUSTRY_POLICY as P } from './industry-policy.js';
import { canonicalPopulationMigration, writePreservedBackup } from './earth-population-update.js';
import {bindIndustryPackagingClock} from './packaging-clock.js';
import {validateIndustryStateV3} from './industry-storage-v3.js';
import {validateIndustryStateV2} from './industry-storage-v2.js';
import {createContainerAccount,containerQuantityQ,containerGroups} from './container-state.js';
import {validateIndustryStateV1,STATE_FIELDS as V1_FIELDS} from './industry-storage-v1.js';
import {validatePackagingState,packagingAccount,packagingAccountKey,packagedQuantityQ} from './packaging-inventory.js';
import {initializePackagingFromV1,industryPackageRegistry} from './industry-packaging.js';
const ensure=(ok,message)=>{if(!ok)throw Error('산업 저장 검증: '+message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fields=(o,keys)=>{ensure(object(o),'객체 필요');ensure(Object.keys(o).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(o,k)),'알 수 없는 필드/필수 필드 누락');};
export function industryLegacyProjection(s){
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
 return restoreSealedOreProjection(s,next);
}
export function validateIndustryState(s,catalog){
 fields(s,[...V1_FIELDS,'packaging']);ensure(s.schemaVersion===4,'버전 불일치');ensure(s.packaging.clockMs===s.settledTick*3600000,'산업/포장 권위 시계');const registry=industryPackageRegistry(catalog);validatePackagingState(s.packaging,registry);
 ensure(object(s.governmentTreasuries)&&Object.values(s.governmentTreasuries).every(n=>n===null||typeof n==='number'&&Number.isFinite(n)&&n>=0),'현재 국고 음수/비정상 수치');
 ensure(object(s.planetInventory),'행성 재고 객체');const accounts=new Set();
 for(const [bodyId,owners]of Object.entries(s.planetInventory)){
  ensure(catalog.bodies.has(bodyId)&&object(owners),'재고 천체');
  for(const [ownerId,inv]of Object.entries(owners)){
   fields(inv,['ore','alloy','hydrogen','residue','resourcesQ']);ensure(object(inv.resourcesQ),'추가 자원 재고');const ctx={bodyId,ownerId},a=packagingAccount(s.packaging,ctx);accounts.add(packagingAccountKey(ctx));
   fields(inv.ore,['low','medium','high']);ensure(Object.values(inv.ore).every(n=>Number.isSafeInteger(n)&&n>=0&&n<=P.maxInventoryQ),'원광 품질 재고 수량');if(ownerId!==OWNER)ensure(Object.values(inv.ore).every(n=>n===0),'민간 원광 품질 lot 공급자 미연결');ensure((a.freeQ.ore??0)===0&&(a.scu.openedQ.ore??0)===0,'원광 품질 lot: 등급 없는 광석 자유/잔여 보관 금지');
   ensure((a.freeQ.hydrogen??0)===0,'미포장 수소는 저장/자동 활성화 불가');ensure(inv.alloy===(a.freeQ.alloy??0)+containerQuantityQ(a,'alloy')&&inv.residue===(a.freeQ.residue??0)+containerQuantityQ(a,'residue')&&inv.hydrogen===packagedQuantityQ(a,'hydrogen'),'파생 재고/포장 묶음 불일치');
   const extra={};for(const [id,n]of Object.entries(a.freeQ))if(!['ore','alloy','residue','hydrogen'].includes(id))extra[id]=n;for(const g of [...Object.values(a.groups),...a.automation.jobs.filter(j=>j.status==='reserved').flatMap(j=>j.escrow)])if(g.resourceId!=='hydrogen')extra[g.resourceId]=(extra[g.resourceId]??0)+g.amountQ;
   for(const g of containerGroups(a))if(!['ore','hydrogen','alloy','residue'].includes(g.resourceId))extra[g.resourceId]=(extra[g.resourceId]??0)+g.count*g.fillQ;for(const [id,q]of Object.entries(a.scu.openedQ))if(!['ore','hydrogen','alloy','residue'].includes(id))extra[id]=(extra[id]??0)+q;
   ensure(JSON.stringify(Object.entries(extra).sort())===JSON.stringify(Object.entries(inv.resourcesQ).sort()),'추가 자원 합계');ensure(a.ledger.initialCreditsMicroC===0,'초기 포장 자금 생성 금지');if(ownerId!==OWNER)ensure(a.ledger.creditFundedMicroC===0,'민간 금융 공급자 미연결');
  }
 }
 ensure(Object.keys(s.packaging.accounts).length===accounts.size,'분리된 포장 재고 계정');validateIndustryOreCustody(s,catalog);validateIndustryStateV1(industryLegacyProjection(s),catalog);return s;
}
export function migrateIndustryV1ToV4(old,catalog){
 validateIndustryStateV1(old,catalog);const next=structuredClone(old);next.schemaVersion=4;initializePackagingFromV1(next,catalog);next.packaging.clockMs=next.settledTick*3600000;return bindIndustryPackagingClock(validateIndustryState(next,catalog));
}
export function migrateIndustryV2ToV4(old,catalog){
 validateIndustryStateV2(old,catalog);const next=structuredClone(old);next.schemaVersion=4;next.packaging.schemaVersion=3;next.packaging.clockMs=next.settledTick*3600000;for(const a of Object.values(next.packaging.accounts))a.scu=createContainerAccount();return bindIndustryPackagingClock(validateIndustryState(next,catalog));
}
export function migrateIndustryV3ToV4(old,catalog){
 validateIndustryStateV3(old,catalog);const next=structuredClone(old);next.schemaVersion=4;next.packaging.schemaVersion=3;next.packaging.clockMs=next.settledTick*3600000;
 for(const a of Object.values(next.packaging.accounts)){a.scu.oreCustody={packedByLotQ:{},unpackedByLotQ:{}};const line=a.scu.automation;line.lastMs=next.packaging.clockMs;if(!line.jobs.some(j=>j.status==='reserved'))line.carry=0;for(const j of line.jobs)j.startedMs=next.packaging.clockMs;}
 return bindIndustryPackagingClock(validateIndustryState(next,catalog));
}
const migrateToCurrent=(s,c)=>s.schemaVersion===1?migrateIndustryV1ToV4(s,c):s.schemaVersion===2?migrateIndustryV2ToV4(s,c):s.schemaVersion===3?migrateIndustryV3ToV4(s,c):validateIndustryState(s,c);
const fingerprint=text=>{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16);};
// This new backup namespace survives the development trial-save reset. Only
// explicit v1/v2/v3 import/opt-in persistent migration writes it; boot stays transient.
export function preserveIndustryRaw(storage,key,raw,version=1){
 if(![1,2,3].includes(version))throw Error('지원하는 이관 원본 버전은1/2/3입니다.');if(!storage)throw Error('구버전 원본 백업 저장소가 없어 이관을 활성화하지 않았습니다.');
 const base=(version===1?'space-project:resource-unit-packaging:backup:v1:':'space-project:resource-cargo-scu:backup:v'+version+':')+encodeURIComponent(key)+':'+fingerprint(raw);
 for(let i=0;i<1000;i++){const target=base+(i?':'+i:'');const previous=storage.getItem(target);if(previous!==null&&previous!==raw)continue;if(previous===null)storage.setItem(target,raw);if(storage.getItem(target)!==raw)throw Error('구버전 원본 백업 확인 실패');return target;}
 throw Error('구버전 원본 백업 충돌 한도');
}
export const preserveIndustryV1Raw=(storage,key,raw)=>preserveIndustryRaw(storage,key,raw,1);
export const industryStorageKey=(systemId,fixture=false)=>`space-project:industry:v1:${encodeURIComponent(systemId)}${fixture?':fixture':''}`;
export class IndustryStore {
 constructor(catalog,{storage=null,notify=()=>{},fixture=false,days=0,populationUpdate=null,transient=false,importBackupStorage=null}={}){
  Object.assign(this,{transient,catalog,notify,populationUpdate,importBackupStorage});this.storage=transient?null:storage;this.key=industryStorageKey(catalog.systemId,fixture);this.blocked=false;this.error=null;this.raw=null;this.previewOrigins=new WeakMap();this.state=createIndustryState(catalog,days,{fixture});
  if(transient)return;
  let validatedNext=null;
  try{
   this.raw=storage?.getItem(this.key)??null;if(!this.raw)return;
   const parsed=parseSurfaceJSON(this.raw),population=canonicalPopulationMigration(parsed,catalog,populationUpdate),candidate=population??parsed,oldVersion=candidate.schemaVersion<4?candidate.schemaVersion:null;
   const next=migrateToCurrent(candidate,catalog);if(next.fixture!==fixture)throw Error('일반/개발 저장 키와 캠페인 종류가 다릅니다.');validatedNext=next;
   if(population)writePreservedBackup(storage,this.key+':population-e1:backup',this.raw);
   if(oldVersion)this.migrationBackupKey=preserveIndustryRaw(storage,this.key,this.raw,oldVersion);
   if(population||oldVersion){const text=JSON.stringify(next);storage.setItem(this.key,text);this.raw=text;}
   this.state=bindIndustryPackagingClock(next);
   if(population){this.populationMigration='ghsl-e2025-earth92-v1';notify('공식 지구 인구 변경의 저장 서명만 이관했습니다. 원본 백업을 보존했습니다.');}
   if(oldVersion)notify('산업 구버전→v4: U 수량·시설·원천·시계와 기존 포장·소재·예약을 보존했습니다.');
  }catch(e){if(validatedNext){this.quarantinedState=validatedNext;}this.blocked=true;this.error=e.message;notify('산업 저장 원본을 보존·격리했습니다. '+e.message);}
 }
 persist(){if(this.transient)return true;try{if(this.blocked)throw Error('손상/다른 버전 저장 원본 보존 중');validateIndustryState(this.state,this.catalog);if(!this.storage)throw Error('저장소 접근 불가');const text=JSON.stringify(this.state);this.storage.setItem(this.key,text);this.raw=text;this.error=null;return true;}catch(e){this.error=e.message;this.notify('산업 저장 실패: '+e.message+' · 캠페인 JSON을 내보내세요.');return false;}}
 preview(text){
  const parsed=parseSurfaceJSON(text),population=this.transient?null:canonicalPopulationMigration(parsed,this.catalog,this.populationUpdate),candidate=population??parsed,oldVersion=candidate.schemaVersion<4?candidate.schemaVersion:null;
  const next=structuredClone(migrateToCurrent(candidate,this.catalog));
  this.previewOrigins.set(next,{raw:text,oldVersion,signature:JSON.stringify(next)});return next;
 }
 replace(next){
  validateIndustryState(next,this.catalog);if(next.fixture!==this.state.fixture)throw Error('일반/개발 캠페인 종류가 다릅니다.');
  const origin=this.previewOrigins.get(next);if(origin&&origin.signature!==JSON.stringify(next))throw Error('가져오기 미리보기가 변경되었습니다. 원본 JSON을 다시 검증하세요.');
  if(origin?.oldVersion){const backup=typeof this.importBackupStorage==='function'?this.importBackupStorage():this.importBackupStorage??this.storage;this.migrationBackupKey=preserveIndustryRaw(backup,this.key,origin.raw,origin.oldVersion);}
  if(this.transient){this.state=bindIndustryPackagingClock(structuredClone(next));this.fixtureInitialized=next.fixture||this.fixtureInitialized;this.blocked=false;this.error=null;this.previewOrigins.delete(next);return;}
  if(!this.storage)throw Error('교체 전 백업 저장소가 필요합니다.');const old=this.storage.getItem(this.key);if(old)this.storage.setItem(this.key+':backup',old);
  const text=JSON.stringify(next);this.storage.setItem(this.key,text);this.state=bindIndustryPackagingClock(structuredClone(next));this.fixtureInitialized=next.fixture||this.fixtureInitialized;this.blocked=false;this.error=null;this.raw=text;this.previewOrigins.delete(next);
 }
 importJSON(text){const next=this.preview(text);this.replace(next);return this.state;}
 export(){validateIndustryState(this.state,this.catalog);return JSON.stringify(this.state,null,2);}
}
