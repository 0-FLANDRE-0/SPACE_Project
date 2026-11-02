import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
import {ctx,minedWorld,followupWorld} from '../tests/helpers/scu-followup-fixture.js';
import {bindIndustryPackagingClock} from '../dist/src/packaging-clock.js';
import {oreLotKey} from '../dist/src/ore-lot-manifest.js';
import {quoteIndustryContainerPack,commitIndustryContainerPack,unpackIndustryContainer,industryOreInventory} from '../dist/src/industry-packaging.js';
import {validateIndustryState} from '../dist/src/industry-storage.js';
const base=minedWorld(),rows=[];let example;
for(const amountQ of [1,8000,500000]){const times=[];for(let run=0;run<5;run++){const x=followupWorld();x.s=structuredClone(base.s);bindIndustryPackagingClock(x.s);const lot=x.s.inventoryLots.find(l=>l.grade==='low'&&l.amountQ>=amountQ),snapshot=()=>({lot:{...x.s.inventoryLots.find(l=>oreLotKey(l)===oreLotKey(lot))},inventory:industryOreInventory(x.s,ctx),alloyFreeQ:x.s.packaging.accounts['earth|human'].freeQ.alloy,creditsMicroC:x.s.packaging.accounts['earth|human'].creditsMicroC,energyWh:x.s.packaging.accounts['earth|human'].energyWh}),before=snapshot(),start=performance.now(),q=quoteIndustryContainerPack(x.s,x.c,{...ctx,resourceId:'ore',amountQ,lotKey:oreLotKey(lot)});assert.ok(q.allowed,q.reason);const quoted=performance.now();commitIndustryContainerPack(x.s,x.c,ctx,q);const committed=performance.now(),sealed=snapshot();
// The commit replaces nested records atomically: always re-read the active account.
 const actual=()=>x.s.packaging.accounts['earth|human'];for(const [groupKey,g]of Object.entries(actual().scu.groups).filter(([,g])=>g.resourceId==='ore'))unpackIndustryContainer(x.s,x.c,{...ctx,resourceId:'ore',groupKey,count:g.count});validateIndustryState(x.s,x.c);const end=performance.now();assert.deepEqual(x.s.inventoryLots,base.s.inventoryLots);times.push({quoteMs:quoted-start,commitMs:committed-quoted,openMs:end-committed});
 if(amountQ===8000&&run===0){const active=actual();example={before,sealed:{lot:x.s.inventoryLots.find(l=>oreLotKey(l)===oreLotKey(lot)),inventory:sealed.inventory,alloyFreeQ:before.alloyFreeQ-q.materialQ.alloy,creditsMicroC:before.creditsMicroC-q.creditsMicroC,energyWh:before.energyWh-q.energyWh},after:{lot:x.s.inventoryLots.find(l=>oreLotKey(l)===oreLotKey(lot)),inventory:industryOreInventory(x.s,ctx),alloyFreeQ:active.freeQ.alloy,creditsMicroC:active.creditsMicroC,energyWh:active.energyWh},quote:q,lossQ:active.ledger.lostQ.alloy};example.sealed.lot={...example.before.lot,amountQ:example.before.lot.amountQ-8000};}
 if(run===0)rows.push({amountQ,containerCount:q.containerCount,groupCount:q.groups.length,times});
 }}
console.log(JSON.stringify({node:process.version,scope:'actual mined source, test-only paid registry, five runs each',rows,example},null,2));
