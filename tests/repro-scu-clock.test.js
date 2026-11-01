// Written against PR #12 before production fixes. Run this exact manual path.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createSolContext} from '../dist/src/system-context.js';import {createPlanetarySurfaceGrid} from '../dist/src/planetary-surface-grid.js';
import {IndustryCatalog,advanceIndustry} from '../dist/src/industry-runtime.js';
import {IndustryStore} from '../dist/src/industry-storage.js';import {initializeIndustryFixture} from '../dist/src/industry-fixture.js';
import {PackageRegistry,DEFAULT_PACKAGE_REGISTRY} from '../dist/src/packaging-specs.js';
import {fundIndustryPackaging,quoteIndustryContainerPack,commitIndustryContainerPack} from '../dist/src/industry-packaging.js';
import {packagingAccount} from '../dist/src/packaging-inventory.js';
import {configureContainerAutomation,reserveContainerRepackageJob} from '../dist/src/container-automation.js';
test('REPRO: day500 manual32SCU job at8SCU/hour processes only8 after one hour',()=>{
 const r=new PackageRegistry();r.register(DEFAULT_PACKAGE_REGISTRY.get('hydrogen-legacy-unpriced-v1'));
 for(const spec of r.containers.specs.values())r.containers.register({...spec,id:'repro-paid-'+spec.sizeSCU,generation:2,directCostCPerContainer:1,electricityKWhPerContainer:1});
 const c=new IndustryCatalog('sol',{packageRegistry:r}),sol=createSolContext(),body=sol.bodyById.get('earth');c.register({body,grid:createPlanetarySurfaceGrid('sol',body),template:JSON.parse(fs.readFileSync('dist/data/planet-surfaces/sol-earth-v2.json'))});
 const store=new IndustryStore(c,{fixture:true,transient:true});initializeIndustryFixture(store);const s=store.state,ctx={bodyId:'earth',ownerId:'human'};
 fundIndustryPackaging(s,c,ctx,{creditC:100,energyWh:100000});commitIndustryContainerPack(s,c,ctx,quoteIndustryContainerPack(s,c,{...ctx,resourceId:'alloy',amountQ:8000}));advanceIndustry(s,c,500);
 r.containers.register({...r.containers.get('repro-paid-32'),id:'repro-gen3',generation:3});
 const atMs=s.settledTick*3600000;configureContainerAutomation(s.packaging,r,ctx,{capacitySCUPerHour:8},{atMs});
 reserveContainerRepackageJob(s.packaging,r,{...ctx,resourceId:'alloy',amountQ:8000,atMs});
 advanceIndustry(s,c,500+1/24);const job=packagingAccount(s.packaging,ctx).scu.automation.jobs[0];
 console.log(JSON.stringify({atDay:500,afterHours:1,capacitySCUPerHour:8,workSCU:job.workSCU,processedSCU:job.processedSCU,status:job.status}));
 assert.equal(job.processedSCU,8);assert.equal(job.status,'reserved');
});
