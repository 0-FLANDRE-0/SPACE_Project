import test from 'node:test';import assert from 'node:assert/strict';
import {ctx,followupWorld} from './helpers/scu-followup-fixture.js';
import {IndustryCatalog,advanceIndustry,orderConstruction} from '../dist/src/industry-runtime.js';
import {IndustryStore,validateIndustryState} from '../dist/src/industry-storage.js';
import {initializeIndustryFixture} from '../dist/src/industry-fixture.js';
import {fundIndustryPackaging,quoteIndustryContainerPack,commitIndustryContainerPack,unpackIndustryContainer,industryOreInventory} from '../dist/src/industry-packaging.js';
import {packagingAccount} from '../dist/src/packaging-inventory.js';
import {oreLotKey} from '../dist/src/ore-lot-manifest.js';
// Explicit test-only finite/pure-grade copy of the real catalog. No preset file
// or production yield, throughput, construction or cost formula is modified.
for(const [grade,yieldQ]of [['low',1120],['medium',2640],['high',4160]])test('sealed '+grade+' ore is unavailable to smelting; whole-container reopening restores the original '+yieldQ+'/8000 yield',()=>{
 const x=followupWorld(),record=x.c.bodies.get('earth'),template=structuredClone(record.template);
 for(const [id,g]of Object.entries(template.geology.cells)){
  Object.assign(g.environment,{temperatureK:288,terrainObstacle:0,radiationLevel:0});g.terrain.terrainType='land';template.startingScenario.cells[id].infrastructureLevel=0;
  for(const d of g.deposits??[])Object.assign(d,{initialReserveU:2000,extractionDifficulty:0,processingDifficulty:0,accessDepth:0,discoveryTier:0,gradeProbabilities:{low:0,medium:0,high:0,[grade]:1}});
 }
 const c=new IndustryCatalog('sol',{packageRegistry:x.r});c.register({...record,template});const store=new IndustryStore(c,{fixture:true,transient:true});initializeIndustryFixture(store);const s=store.state,source=[...c.hydrogen.values()].find(h=>s.hydrogenKnowledge.human.includes(h.key));
 orderConstruction(s,c,{bodyId:'earth',tileId:source.tileId,slot:0,type:'government_mining_complex'});advanceIndustry(s,c,500);
 const lot=s.inventoryLots.find(l=>l.amountQ>0);assert.equal(lot.grade,grade);assert.equal(lot.amountQ,2000000);fundIndustryPackaging(s,c,ctx,{creditC:1000,energyWh:1000000});
 const q=quoteIndustryContainerPack(s,c,{...ctx,resourceId:'ore',amountQ:2000000,lotKey:oreLotKey(lot)});assert.ok(q.allowed,q.reason);commitIndustryContainerPack(s,c,ctx,q);assert.equal(industryOreInventory(s,ctx).freeQ[grade],0);assert.equal(industryOreInventory(s,ctx).sealedQ[grade],2000000);
 const tile=record.grid.tiles.find(t=>t.id!==source.tileId).id,id=orderConstruction(s,c,{bodyId:'earth',tileId:tile,slot:0,type:'government_smelting_complex'});s.facilityInstances[id].hydrogenMode='off';advanceIndustry(s,c,1000);assert.equal(s.materialLedger.earth.smeltingOreQ,0);assert.equal(s.materialLedger.earth.alloyProducedQ,0);
 const before={remaining:structuredClone(s.oreRemaining),extracted:structuredClone(s.oreExtracted)},[groupKey,g]=Object.entries(packagingAccount(s.packaging,ctx).scu.groups).find(([,g])=>g.resourceId==='ore'&&g.fillQ===8000);assert.ok(g.count>0);
 unpackIndustryContainer(s,c,{...ctx,resourceId:'ore',groupKey,count:1});assert.equal(industryOreInventory(s,ctx).freeQ[grade],8000);assert.equal(s.inventoryLots.find(l=>oreLotKey(l)===oreLotKey(lot)).processingDifficulty,0);
 advanceIndustry(s,c,1001);assert.equal(s.materialLedger.earth.smeltingOreQ,8000);assert.equal(s.materialLedger.earth.alloyProducedQ,yieldQ);assert.equal(s.materialLedger.earth.residueProducedQ,8000-yieldQ);assert.equal(industryOreInventory(s,ctx).sealedQ[grade],1992000);assert.equal(industryOreInventory(s,ctx).freeQ[grade],0);assert.deepEqual(s.oreRemaining,before.remaining);assert.deepEqual(s.oreExtracted,before.extracted);validateIndustryState(s,c);
});
