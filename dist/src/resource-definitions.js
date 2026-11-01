// Historical BULK ore/alloy benchmark, retained for frozen ECON-SIM-1/2/3.
// New mass conversions must use the resource definition, particularly hydrogen.
export const TONNES_PER_RESOURCE_U=10;
export const PERSONS_PER_POP=1000000;
export const MAX_RESOURCE_U=1e12; // prototype numeric safety bound, not a reserve balance
export const MAX_POPULATION_PERSONS=1e12;
import {resourceQuanta} from './resource-quantities.js';
export class ResourceRegistry extends Map {
 delete(id){if(this.lockedIds?.has(id))throw Error('공식 자원 규격 삭제 금지');return super.delete(id);}
 clear(){if(this.lockedIds?.size)throw Error('공식 자원 규격 삭제 금지');return super.clear();}
 set(id,definition){
  if(!definition||id!==definition.id||!/^[a-z][a-z0-9_-]{0,47}$/.test(id)||['constructor','prototype','__proto__'].includes(id)||!['U','C'].includes(definition.unit)||this.has(id))throw Error('자원 정의 ID/단위가 올바르지 않거나 중복됩니다.');
  const d={category:'unconfigured',storageMode:'unconfigured',contentMassKgPerU:null,cargoUnitsPerU:definition.unit==='U'?1:null,requiresPackage:null,...definition};
  if(d.naturalDeposit&&d.unit!=='U')throw Error('매장 자원은 U 단위를 사용해야 합니다.');
  if(d.unit==='C'){
   if(d.contentMassKgPerU!==null||d.cargoUnitsPerU!==null||d.requiresPackage===true)throw Error('화폐에 질량/화물/패키지를 적용할 수 없습니다.');
   d.category='currency';d.storageMode='currency';d.requiresPackage=false;
  }else{
   if(d.cargoUnitsPerU!==1||!['bulk','packaged','unconfigured'].includes(d.storageMode)||!['string'].includes(typeof d.category))throw Error('모든 물질 자원은 동일한1U 공간을 사용합니다.');
   if(d.contentMassKgPerU!==null&&(!Number.isFinite(d.contentMassKgPerU)||d.contentMassKgPerU<=0))throw Error('내용물 질량은 양수 또는 미정이어야 합니다.');
   if(d.storageMode==='packaged'&&d.requiresPackage!==true||d.storageMode==='bulk'&&d.requiresPackage!==false)throw Error('자원 저장 방식/포장 필요 여부 불일치');
  }
  return super.set(id,Object.freeze(d));
 }
 register(definition){this.set(definition.id,definition);return this.get(definition.id);}
}
export const RESOURCE_DEFINITIONS=new ResourceRegistry();
for(const d of [
 {id:'ore',name:'광석',unit:'U',naturalDeposit:true,category:'ore',storageMode:'bulk',requiresPackage:false,contentMassKgPerU:10000},
 {id:'alloy',name:'합금',unit:'U',naturalDeposit:false,category:'metal',storageMode:'bulk',requiresPackage:false,contentMassKgPerU:10000},
 {id:'hydrogen',name:'수소',unit:'U',naturalDeposit:false,supplySource:true,category:'gas',storageMode:'packaged',requiresPackage:true,contentMassKgPerU:500},
 {id:'residue',name:'잔여물',unit:'U',naturalDeposit:false,category:'industrial-residue',storageMode:'bulk',requiresPackage:false,contentMassKgPerU:null},
 {id:'credits',name:'크레딧',unit:'C',naturalDeposit:false}
])RESOURCE_DEFINITIONS.register(d);
RESOURCE_DEFINITIONS.lockedIds=new Set(RESOURCE_DEFINITIONS.keys());
export function registerResource(definition){return RESOURCE_DEFINITIONS.register(definition);}
export function materialResource(id,registry=RESOURCE_DEFINITIONS,{configured=false}={}){
 const d=registry.get(id);if(!d||d.unit!=='U')throw Error('등록된 물질 U 자원이 필요합니다: '+id);
 if(configured&&(d.contentMassKgPerU===null||d.storageMode==='unconfigured'))throw Error('자원 물리 규격 미결정: '+id);return d;
}
export function resourceContentMassKg(id,quantityU,registry=RESOURCE_DEFINITIONS){
 const d=materialResource(id,registry,{configured:true});if(!Number.isFinite(quantityU)||quantityU<0||quantityU>MAX_RESOURCE_U)throw Error('잘못된 자원 수량');return d.contentMassKgPerU*quantityU;
}
export function cargoQuantityU(entries,{capacityU=Infinity,registry=RESOURCE_DEFINITIONS}={}){
 let totalQ=0;for(const {resourceId,quantityU}of entries){materialResource(resourceId,registry,{configured:true});totalQ+=resourceQuanta(quantityU);if(!Number.isSafeInteger(totalQ))throw Error('화물 수량 한도');}
 if(totalQ>(capacityU===Infinity?Infinity:resourceQuanta(capacityU)))throw Error('U 화물/보관 용량 초과');return totalQ/1000;
}
export const personsToPOP=persons=>persons===null?null:persons/PERSONS_PER_POP;
export function popToPersons(value){if(value===null||String(value).trim()==='')return null;const text=String(value).trim();if(!/^\d+(\.\d{1,6})?$/.test(text))throw Error('POP는 음수가 아닌 소수 6자리까지 입력하세요.');const [whole,fraction='']=text.split('.');const n=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));if(n>BigInt(MAX_POPULATION_PERSONS))throw Error('인구 안전 한도를 초과했습니다.');return Number(n);}
