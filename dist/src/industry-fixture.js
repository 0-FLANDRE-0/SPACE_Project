import { ownerInventory, OWNER } from './industry-runtime.js';
import {produceIndustryPackaged,produceIndustryBulk} from './industry-packaging.js';
import { resourceQuanta } from './resource-quantities.js';
// Explicit developer scenario, separate key and badge. Never touches geology,
// startingScenario, normal campaign funds, speed presets or the UTC epoch.
export function initializeIndustryFixture(store){
 if(!store.state.fixture||store.raw||store.blocked||store.fixtureInitialized)return;
 const s=store.state,c=store.catalog;if(!c.bodies.has('earth'))throw Error('이 개발 시나리오는 Sol 지구 전용입니다.');
 ownerInventory(s,'earth');produceIndustryBulk(s,c,{bodyId:'earth',ownerId:OWNER},'alloy',10000000,{source:'industry-initial'});const initial=produceIndustryPackaged(s,c,{bodyId:'earth',ownerId:OWNER},'hydrogen',500000,{source:'industry-initial',legacy:true});if(!initial.allowed)throw Error(initial.reason);
 const source=[...c.hydrogen.values()].filter(h=>h.bodyId==='earth'&&h.sourceType==='finite-source'&&c.cell('earth',h.tileId).geology.deposits?.some(d=>d.resourceId==='ore')).at(-1);
 if(source){s.hydrogenKnowledge[OWNER]=[source.key];s.depositKnowledge[OWNER]={};for(const d of c.cell('earth',source.tileId).geology.deposits??[])if(d.resourceId==='ore')s.depositKnowledge[OWNER][c.key('earth',d.depositId)]=resourceQuanta(d.initialReserveU);}
 store.fixtureInitialized=true;if(!store.transient)store.persist();
}
