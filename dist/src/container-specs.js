import {RESOURCE_DEFINITIONS,materialResource} from './resource-definitions.js';
import {deepFreeze,safeId,integer,scaledDecimal} from './packaging-common.js';
export const SCU_VOLUME_M3=1.953125;
export const STANDARD_CONTAINERS=deepFreeze([
 {sizeSCU:1,dimensionsM:[1.25,1.25,1.25],alloyQ:25},
 {sizeSCU:2,dimensionsM:[2.5,1.25,1.25],alloyQ:45},
 {sizeSCU:4,dimensionsM:[2.5,2.5,1.25],alloyQ:85},
 {sizeSCU:8,dimensionsM:[2.5,2.5,2.5],alloyQ:160},
 {sizeSCU:16,dimensionsM:[5,2.5,2.5],alloyQ:270},
 {sizeSCU:24,dimensionsM:[7.5,2.5,2.5],alloyQ:370},
 {sizeSCU:32,dimensionsM:[10,2.5,2.5],alloyQ:450}
]);
function inputs(rows){
 if(!Array.isArray(rows))throw Error('컨테이너 소재 배열 필요');const seen=new Set();
 return rows.map(m=>{if(!safeId(m.resourceId)||seen.has(m.resourceId))throw Error('중복/잘못된 컨테이너 소재');seen.add(m.resourceId);integer(m.amountQ,'컨테이너당 소재');if(m.recoveryRate<0||m.recoveryRate>1)throw Error('회수율0~1');return {...m,recoveryParts:scaledDecimal(m.recoveryRate,1000000,'회수율')};});
}
function costs(s){for(const [k,scale]of [['directCostCPerContainer',1000000],['electricityKWhPerContainer',1000]]){s[k]??=null;if(s[k]!==null)scaledDecimal(s[k],scale,k);}}
export class ContainerRegistry {
 #specs=new Map();
 constructor(resources=RESOURCE_DEFINITIONS,{standards=true}={}){this.resources=resources;if(standards)for(const x of STANDARD_CONTAINERS)this.register({id:`standard-${x.sizeSCU}scu-gen1`,sizeSCU:x.sizeSCU,dimensionsM:x.dimensionsM,generation:1,materialInputs:[{resourceId:'alloy',amountQ:x.alloyQ,recoveryRate:.9}],approved:true});}
 get specs(){return new Map(this.#specs);}
 register(input){
  const s=structuredClone(input),geometry=STANDARD_CONTAINERS.find(x=>x.sizeSCU===s.sizeSCU);
  if(!safeId(s.id)||this.#specs.has(s.id)||!geometry)throw Error('컨테이너 규격 ID/크기 오류');integer(s.generation,'컨테이너 세대');if(!s.generation)throw Error('정식 컨테이너 세대는1이상');
  s.dimensionsM??=[...geometry.dimensionsM];if(JSON.stringify(s.dimensionsM)!==JSON.stringify(geometry.dimensionsM))throw Error('표준 외부 치수 불일치');s.externalVolumeM3=s.sizeSCU*SCU_VOLUME_M3;
  s.materialInputs=inputs(s.materialInputs);if(!s.materialInputs.some(m=>m.amountQ>0))throw Error('컨테이너 실물 제작 소재 필요');costs(s);s.approved??=false;s.unlockedBy??=null;
  if(typeof s.approved!=='boolean'||s.unlockedBy!==null&&typeof s.unlockedBy!=='string')throw Error('컨테이너 승인/해금 필드');
  s.storageRequirements??={cryogenic:{materialInputs:[],directCostCPerContainer:null,electricityKWhPerContainer:null},contained:{materialInputs:[],directCostCPerContainer:null,electricityKWhPerContainer:null}};
  for(const [type,requirements]of Object.entries(s.storageRequirements)){if(!safeId(type)||type==='bulk')throw Error('특수 보관 유형');requirements.materialInputs=inputs(requirements.materialInputs??[]);costs(requirements);}
  this.#specs.set(s.id,deepFreeze(s));return this.#specs.get(s.id);
 }
 get(id){const s=this.#specs.get(id);if(!s)throw Error('알 수 없는 컨테이너 규격: '+id);return s;}
 available(ownerId,provider=null,{allowedContainerSizes=null,minGeneration=1}={}){
  integer(minGeneration,'최소 컨테이너 세대');if(minGeneration<1)throw Error('컨테이너 최소 세대1');
  if(allowedContainerSizes!==null&&(!Array.isArray(allowedContainerSizes)||!allowedContainerSizes.length||new Set(allowedContainerSizes).size!==allowedContainerSizes.length||allowedContainerSizes.some(n=>!STANDARD_CONTAINERS.some(x=>x.sizeSCU===n))))throw Error('허용 컨테이너 크기 오류');
  const ids=provider?.(ownerId);if(ids!==undefined&&(!Array.isArray(ids)||ids.some(id=>!this.#specs.has(id))))throw Error('컨테이너 해금 참조 오류');
  const latest=new Map();for(const s of this.#specs.values())if(s.approved&&s.generation>=minGeneration&&(!allowedContainerSizes||allowedContainerSizes.includes(s.sizeSCU))&&(ids?ids.includes(s.id):s.unlockedBy===null)){const old=latest.get(s.sizeSCU);if(!old||s.generation>old.generation||s.generation===old.generation&&s.id<old.id)latest.set(s.sizeSCU,s);}
  return [...latest.values()].sort((a,b)=>a.sizeSCU-b.sizeSCU||a.id.localeCompare(b.id));
 }
 recipe(id,resourceId){
  const s=this.get(id),resource=materialResource(resourceId,this.resources,{configured:true});if(resource.cargoSCUPerU===null)throw Error('SCU/U 미결정: '+resourceId);if(!s.approved)throw Error('미승인 컨테이너');
  const type=resource.requiresPackage?(resource.containmentType??'contained'):'bulk',extra=type==='bulk'?null:s.storageRequirements[type];if(type!=='bulk'&&!extra)throw Error('컨테이너의 특수 보관 미지원: '+type);
  const materials=new Map();for(const m of [...s.materialInputs,...(extra?.materialInputs??[])]){const r=materialResource(m.resourceId,this.resources,{configured:true});if(r.requiresPackage||r.storageMode!=='bulk')throw Error('재귀/패키지 소재 금지: 자유 bulk 소재만 허용');const old=materials.get(m.resourceId);if(old&&old.recoveryParts!==m.recoveryParts)throw Error('동일 소재의 상충 회수율');materials.set(m.resourceId,old?{...m,amountQ:integer(old.amountQ+m.amountQ,'소재 합계')}:m);}
  const pending=[];for(const [scope,obj]of [['container',s],...(extra?[[type,extra]]:[])])for(const key of ['directCostCPerContainer','electricityKWhPerContainer'])if(obj[key]===null)pending.push(scope+'.'+key);
  return {spec:s,resource,type,materialInputs:[...materials.values()],pendingCosts:pending,directMicroC:pending.some(k=>k.endsWith('directCostCPerContainer'))?null:scaledDecimal(s.directCostCPerContainer,1000000,'C')+(extra?scaledDecimal(extra.directCostCPerContainer,1000000,'특수 C'):0),energyWh:pending.some(k=>k.endsWith('electricityKWhPerContainer'))?null:scaledDecimal(s.electricityKWhPerContainer,1000,'전력')+(extra?scaledDecimal(extra.electricityKWhPerContainer,1000,'특수 전력'):0)};
 }
}
