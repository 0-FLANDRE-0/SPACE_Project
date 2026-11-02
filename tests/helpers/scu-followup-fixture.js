import fs from 'node:fs';
import {createSolContext} from '../../dist/src/system-context.js';
import {createPlanetarySurfaceGrid} from '../../dist/src/planetary-surface-grid.js';
import {IndustryCatalog,advanceIndustry,orderConstruction,buildQuote} from '../../dist/src/industry-runtime.js';
import {IndustryStore} from '../../dist/src/industry-storage.js';
import {initializeIndustryFixture} from '../../dist/src/industry-fixture.js';
import {PackageRegistry,DEFAULT_PACKAGE_REGISTRY} from '../../dist/src/packaging-specs.js';
import {fundIndustryPackaging,quoteIndustryContainerPack,commitIndustryContainerPack} from '../../dist/src/industry-packaging.js';
import {resourceQuanta} from '../../dist/src/resource-quantities.js';
export const ctx={bodyId:'earth',ownerId:'human'},sol=createSolContext();
export function followupWorld({paid=true,full=false}={}){
 const r=new PackageRegistry();r.register(DEFAULT_PACKAGE_REGISTRY.get('hydrogen-legacy-unpriced-v1'));if(paid)for(const spec of r.containers.specs.values())r.containers.register({...spec,id:'followup-paid-'+spec.sizeSCU,generation:2,directCostCPerContainer:1,electricityKWhPerContainer:1});
 const c=new IndustryCatalog('sol',{packageRegistry:r});for(const b of sol.allBodies.filter(b=>full?['planet','moon'].includes(b.kind):['earth','moon','mars','venus','jupiter'].includes(b.id)))c.register({body:b,grid:createPlanetarySurfaceGrid('sol',b),template:JSON.parse(fs.readFileSync(`dist/data/planet-surfaces/sol-${b.id}-v2.json`))});
 const store=new IndustryStore(c,{fixture:true,transient:true});initializeIndustryFixture(store);return {r,c,s:store.state,store};
}
export function addClockGeneration(r,options={}){r.containers.register({...r.containers.get('followup-paid-32'),id:'followup-gen3-32',generation:3,...options});}
export function clockWorld(){const x=followupWorld();fundIndustryPackaging(x.s,x.c,ctx,{creditC:100,energyWh:100000});commitIndustryContainerPack(x.s,x.c,ctx,quoteIndustryContainerPack(x.s,x.c,{...ctx,resourceId:'alloy',amountQ:8000}));advanceIndustry(x.s,x.c,500);addClockGeneration(x.r);return x;}
export function minedWorld({paid=true,secondSource=false}={}){
 const x=followupWorld({paid}),source=[...x.c.hydrogen.values()].find(h=>x.s.hydrogenKnowledge.human.includes(h.key));orderConstruction(x.s,x.c,{bodyId:'earth',tileId:source.tileId,slot:0,type:'government_mining_complex'});
 if(secondSource){for(const d of x.c.deposits.values()){if(d.bodyId!=='earth'||d.tileId===source.tileId||d.resourceId!=='ore')continue;x.s.depositKnowledge.human[d.key]=resourceQuanta(d.initialReserveU);const cmd={bodyId:'earth',tileId:d.tileId,slot:0,type:'government_mining_complex'};if(buildQuote(x.s,x.c,cmd).allowed){orderConstruction(x.s,x.c,cmd);break;}}}
 advanceIndustry(x.s,x.c,500);fundIndustryPackaging(x.s,x.c,ctx,{creditC:100,energyWh:100000});return x;
}
