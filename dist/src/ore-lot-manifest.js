// One source/grade/difficulty lot per container. Mixed manifests fail closed.
import {integer,safeId} from './packaging-common.js';
export const ORE_GRADES=['low','medium','high'];
const names=['bodyId','ownerId','depositKey','depositId','grade','processingDifficulty','amountQ'];
export function validateOreLot(lot,{positive=false}={}){
 if(!lot||typeof lot!=='object'||Array.isArray(lot)||Object.keys(lot).length!==names.length||names.some(k=>!Object.hasOwn(lot,k)))throw Error('광석 로트 필드 불일치');
 for(const k of names.slice(0,4))if(!safeId(lot[k]))throw Error('광석 출처/소유자 ID');
 if(!ORE_GRADES.includes(lot.grade)||typeof lot.processingDifficulty!=='number'||!Number.isFinite(lot.processingDifficulty)||lot.processingDifficulty<0||lot.processingDifficulty>100)throw Error('광석 등급/가공 난도');integer(lot.amountQ,'광석 로트 Q',1e15);if(positive&&!lot.amountQ)throw Error('봉인 광석은 양수여야 합니다.');return lot;
}
export function oreLotKey(lot){return JSON.stringify([lot.bodyId,lot.ownerId,lot.depositKey,lot.depositId,lot.grade,lot.processingDifficulty]);}
export function oreLotFromKey(key){let row;try{row=JSON.parse(key);}catch{throw Error('광석 로트 장부 키');}if(!Array.isArray(row)||row.length!==6)throw Error('광석 로트 장부 참조');const lot=Object.fromEntries(names.slice(0,6).map((name,i)=>[name,row[i]]));lot.amountQ=0;validateOreLot(lot);if(oreLotKey(lot)!==key)throw Error('비정규 광석 로트 키');return lot;}
export function validateOreManifest(group,account){
 if(group.resourceId!=='ore'||!Array.isArray(group.lotManifest)||group.lotManifest.length!==1)throw Error('단일 광석 로트 manifest만 지원합니다.');const lot=validateOreLot(group.lotManifest[0],{positive:true});
 if(lot.bodyId!==account.bodyId||lot.ownerId!==account.ownerId||lot.amountQ!==group.fillQ)throw Error('광석 manifest 천체/소유자/개별 적재량 불일치');return lot;
}
export function oreManifestGroupSuffix(group){if(!Object.hasOwn(group,'lotManifest'))return '';if(!Array.isArray(group.lotManifest)||group.lotManifest.length!==1)throw Error('혼합 광석 컨테이너 미지원');const lot=validateOreLot(group.lotManifest[0],{positive:true});return '|lot:'+encodeURIComponent(oreLotKey(lot));}
export function validateOreCustody(account,groups){
 const c=account.scu.oreCustody;if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).length!==2||!Object.hasOwn(c,'packedByLotQ')||!Object.hasOwn(c,'unpackedByLotQ'))throw Error('광석 현지 보관 장부 필드');
 const sealed={},add=(o,k,n)=>{o[k]=integer((o[k]??0)+n,'광석 집계');};let packed=0,unpacked=0;
 for(const [name,d]of Object.entries(c)){if(!d||typeof d!=='object'||Array.isArray(d))throw Error('광석 보관 사전');for(const [key,q]of Object.entries(d)){const lot=oreLotFromKey(key);if(lot.bodyId!==account.bodyId||lot.ownerId!==account.ownerId)throw Error('광석 보관 원 소유권');integer(q,'광석 보관 Q',1e15);if(name==='packedByLotQ')packed=integer(packed+q,'누적 봉인');else unpacked=integer(unpacked+q,'누적 개봉');}}
 for(const g of groups)if(Object.hasOwn(g,'lotManifest')){const lot=validateOreManifest(g,account);add(sealed,oreLotKey(lot),g.fillQ*g.count);}
 for(const key of new Set([...Object.keys(c.packedByLotQ),...Object.keys(c.unpackedByLotQ),...Object.keys(sealed)]))if((c.packedByLotQ[key]??0)-(c.unpackedByLotQ[key]??0)!==(sealed[key]??0))throw Error('광석 로트별 봉인/개봉/실물 보존 불일치');
 return packed-unpacked;
}
