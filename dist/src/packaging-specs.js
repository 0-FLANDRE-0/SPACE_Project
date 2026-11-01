import {RESOURCE_DEFINITIONS,materialResource} from './resource-definitions.js';
import {RECOVERY_SCALE,deepFreeze,safeId,integer,scaledDecimal} from './packaging-common.js';
import {ContainerRegistry} from './container-specs.js';
export {RECOVERY_SCALE,deepFreeze,safeId,integer,scaledDecimal} from './packaging-common.js';
export {ContainerRegistry,SCU_VOLUME_M3,STANDARD_CONTAINERS} from './container-specs.js';
export const PACKAGE_SCHEMA_VERSION=3;
// Historical industrial storage recipes are separate from SCU transport recipes.
export class PackageRegistry {
 #specs=new Map();
 constructor(resources=RESOURCE_DEFINITIONS){this.resources=resources;this.active=new Set();this.containers=new ContainerRegistry(resources);}
 get specs(){return new Map(this.#specs);}
 register(input){
  const s=structuredClone(input);if(!safeId(s.id)||this.specs.has(s.id)||!safeId(s.resourceId))throw Error('포장 규격 ID/중복 오류');
  integer(s.generation,'세대');if(!Array.isArray(s.materialInputs))throw Error('포장 소재 배열 필요');
  const seen=new Set();for(const m of s.materialInputs){if(!safeId(m.resourceId)||seen.has(m.resourceId)||m.resourceId===s.resourceId)throw Error('포장 소재 중복/자기 참조');seen.add(m.resourceId);integer(m.amountQPer1000Q,'소재');if(m.recoveryRate<0||m.recoveryRate>1)throw Error('회수율0~1 필요');m.recoveryParts=scaledDecimal(m.recoveryRate,RECOVERY_SCALE,'회수율');}
  for(const key of ['electricityKWhPerU','directCostCPerU'])if(s[key]!==null&&s[key]!==undefined)scaledDecimal(s[key],key==='directCostCPerU'?1000000:1000,key);
  s.electricityKWhPerU??=null;s.directCostCPerU??=null;s.unlockedBy??=null;s.approved??=false;s.compatibility??=false;
  if(typeof s.approved!=='boolean'||typeof s.compatibility!=='boolean'||s.unlockedBy!==null&&typeof s.unlockedBy!=='string')throw Error('포장 승인/해금 필드 오류');
  if(s.compatibility&&(s.generation!==0||s.materialInputs.length||s.directCostCPerU!==null||s.electricityKWhPerU!==null||s.approved))throw Error('호환 규격은 소재/회수/가격 없는0세대 전용');
  this.#specs.set(s.id,deepFreeze(s));try{this.checkCycles();}catch(e){this.#specs.delete(s.id);throw e;}return this.#specs.get(s.id);
 }
 checkCycles(){const edges=new Map();for(const s of this.specs.values()){if(!edges.has(s.resourceId))edges.set(s.resourceId,new Set());for(const m of s.materialInputs)edges.get(s.resourceId).add(m.resourceId);}
  const visited=new Set(),visiting=new Set();const visit=id=>{if(visiting.has(id))throw Error('포장 소재 간접 순환');if(visited.has(id))return;visiting.add(id);for(const next of edges.get(id)??[])visit(next);visiting.delete(id);visited.add(id);};for(const id of edges.keys())visit(id);return true;
 }
 assertExecutable(id){const s=this.specs.get(id);if(!s||s.compatibility||!s.approved)throw Error('승인된 정식 포장 규격 필요');const r=materialResource(s.resourceId,this.resources,{configured:true});if(!r.requiresPackage)throw Error('패키지형 내용물 필요');
  for(const m of s.materialInputs)materialResource(m.resourceId,this.resources,{configured:true});if(s.electricityKWhPerU===null||s.directCostCPerU===null)throw Error('포장 전력/C 미결정');this.checkCycles();return s;
 }
 activate(id){this.assertExecutable(id);this.active.add(id);return this.specs.get(id);}
 get(id){const s=this.specs.get(id);if(!s)throw Error('알 수 없는 포장 규격: '+id);return s;}
 availablePackageSpecs(ownerId,provider=null){const supplied=provider?.(ownerId);if(supplied!==undefined&&(!Array.isArray(supplied)||supplied.some(id=>!this.specs.has(id))))throw Error('해금 인터페이스의 규격 참조 오류');return [...this.active].map(id=>this.get(id)).filter(s=>supplied?supplied.includes(s.id):s.unlockedBy===null).sort((a,b)=>a.generation-b.generation||a.id.localeCompare(b.id));}
 latest(resourceId,ownerId,provider=null){return this.availablePackageSpecs(ownerId,provider).filter(s=>s.resourceId===resourceId).at(-1)??[...this.specs.values()].find(s=>s.resourceId===resourceId&&s.compatibility)??null;}
}
export const DEFAULT_PACKAGE_REGISTRY=new PackageRegistry();
DEFAULT_PACKAGE_REGISTRY.register({id:'hydrogen-legacy-unpriced-v1',resourceId:'hydrogen',generation:0,materialInputs:[],electricityKWhPerU:null,directCostCPerU:null,compatibility:true,approved:false});
