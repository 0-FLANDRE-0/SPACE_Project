import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Ledger,account,trade,energyAudit} from '../dist/src/economy-energy-ledger.js';
import {POWER_TYPES,FUSION,advanceFusionStart,dispatchFusion,constructionQuote,governmentPowerSlots,upkeepBill,balanceStorage,alloyElectricityMWhPerT,industryCapacity,assistedSmelting,explicitIndustryUnitCost} from '../dist/src/economy-energy-facilities.js';
import {createEnergyEconomy,simulateEnergyEconomy,tickEnergyEconomy,assertEnergyEconomy,orderPowerComplex,orderIndustry,orderHydrogen,ENERGY_SCENARIOS} from '../dist/src/economy-energy-model.js';
import {simulateEconomy} from '../dist/src/economy-model.js';
import {readRound3Inputs} from '../scripts/econ-round3-inputs.mjs';
const p=JSON.parse(fs.readFileSync('docs/econ-sim/round2/candidates.json')).recommended.parameters,e=JSON.parse(fs.readFileSync('scripts/econ-round3.config.json')).energy,inputs=readRound3Inputs();
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const run=(scenario='E0',months=24,extra={})=>simulateEnergyEconomy(p,e,inputs,{scenario,months,...extra});

test('fixed generator contracts and normal fusion fuel cannot be overwritten by calibration',()=>{
 assert.deepEqual(Object.values(POWER_TYPES).map(x=>[x.ratedGW,x.maxModules,x.months]),[[5,50,4],[2.5,35,3],[1.5,80,1]]);assert.equal(FUSION.normalHydrogenU,2.5);
 assert.throws(()=>createEnergyEconomy(p,{...e,fusionNormalHydrogenU:1},inputs));
});
test('full 96h fusion startup: external75GWh, output180GWh, net105, hydrogen5U',()=>{
 const r=advanceFusionStart({wallHours:96,externalGWh:1000,hydrogenU:5});near(r.inputGWh,75);near(r.generationGWh,180);near(r.hydrogenU,5);near(r.generationGWh-r.inputGWh,105);assert.ok(r.completed);
});
test('first24h has 30GWh input and zero output; substep integrals equal one-step result',()=>{
 let progressHours=0,input=0,output=0,h=0;for(let i=0;i<16;i++){const r=advanceFusionStart({progressHours,wallHours:6,externalGWh:1000,hydrogenU:10});progressHours=r.progressHours;input+=r.inputGWh;output+=r.generationGWh;h+=r.hydrogenU;if(i===3){near(output,0);near(input,30);}}near(input,75);near(output,180);near(h,5);
});
test('96 wall hours without external power cannot advance or create fusion output',()=>{const r=advanceFusionStart({wallHours:96,externalGWh:0,hydrogenU:5});near(r.advancedHours,0);assert.equal(r.completed,false);near(r.generationGWh,0);});
test('partial startup power and H constrain progress; no H gives no output even at ramp midpoint',()=>{
 const r=advanceFusionStart({wallHours:96,externalGWh:15,hydrogenU:5});near(r.progressHours,12);near(r.hydrogenU,.625);
 const h=advanceFusionStart({wallHours:96,externalGWh:100,hydrogenU:2.5});near(h.progressHours,48);assert.equal(h.completed,false);
 const zero=advanceFusionStart({progressHours:60,wallHours:720,externalGWh:100,hydrogenU:0});near(zero.generationGWh,0);near(zero.advancedHours,0);
});
test('normal fusion uses output-proportional H; below sustaining output cold-stops',()=>{
 const r=dispatchFusion({requestedGWh:1825,availableHydrogenU:2.5,minimumFraction:.1});near(r.hydrogenU,1.25);assert.equal(r.state,'curtailed');
 assert.equal(dispatchFusion({requestedGWh:3600,availableHydrogenU:.01,minimumFraction:.1}).state,'coldStopped');
});
test('each C/material transfer conserves balances and a quote creates no stock or cash',()=>{
 const b=new Ledger();b.open(account('earth','private','alloy'),100000);b.open(account('earth','private'),0);b.open(account('earth','government'),23000);
 const r=trade(b,{planet:'earth',from:'private',to:'government',resource:'alloy',amountU:100,priceC:2.3});near(r.amountU,10);near(r.cashC,23);assert.equal(b.sum(k=>k.endsWith('/C')),23000);b.audit();
});
test('ledger rejects overdrafts and detects cash/material mutations',()=>{
 const b=new Ledger();b.open('a',100);b.open('b',0);assert.throws(()=>b.move('a','b',101));b.move('a','b',50);b.balance.b++;assert.throws(()=>b.audit());
});
test('power energy balance detects created energy',()=>{energyAudit({generationKWh:100,servedKWh:70,chargeKWh:20,curtailedKWh:10});assert.throws(()=>energyAudit({generationKWh:0,servedKWh:1}));});
test('storage cannot create energy: SOC and losses, charge and discharge are exclusive',()=>{
 const a=balanceStorage({socGWh:0,capacityGWh:10,rateGW:1,efficiency:.9,supplyGWh:10,demandGWh:0});near(a.socGWh,9);near(a.dischargeGWh,0);
 const b=balanceStorage({...a,socGWh:a.socGWh,capacityGWh:10,rateGW:1,efficiency:.9,supplyGWh:0,demandGWh:20});near(b.dischargeGWh,8.1);near(b.socGWh,0);near(a.chargeGWh-b.dischargeGWh,a.lossGWh+b.lossGWh);
});
test('stopped facilities retain high alloy upkeep, low C; construction has neither',()=>{
 const a={alloyBasisU:1200,creditBasisC:15000,completedMonth:2,state:'active'},active=upkeepBill(a,{...e,month:2}),paused=upkeepBill({...a,state:'paused'},{...e,month:2}),cold=upkeepBill({...a,state:'coldStopped'},{...e,month:2});
 near(paused.alloyU/active.alloyU,.9);near(paused.directC/active.directC,.15);assert.ok(cold.alloyU>0);assert.deepEqual(upkeepBill(a,{...e,month:1}),{alloyU:0,directC:0});
});
test('foundation and module costs are separate; one government slot per complex',()=>{
 const s=createEnergyEconomy(p,e,inputs),c=orderPowerComplex(s,'earth','fusion',2);assert.ok(c);assert.equal(governmentPowerSlots(s.planets.earth.complexes),1);
 const before=s.planets.earth.assets.filter(a=>a.kind==='powerBase').length;for(let i=0;i<8;i++)tickEnergyEconomy(s);
 assert.equal(s.planets.earth.assets.filter(a=>a.kind==='powerBase').length,before);assert.equal(c.modules.length,2);assert.equal(governmentPowerSlots(s.planets.earth.complexes),1);
});
test('global parallel C surcharge cannot be evaded by splitting complexes; U/H unchanged',()=>{
 const jobs=[{startMonth:0,endMonth:4,complexId:'a'}],base={type:'fusion',costs:e.costs,startMonth:1,surcharge:.2,learning:.1},a=constructionQuote({...base,jobs}),b=constructionQuote({...base,jobs:[{...jobs[0],complexId:'different'}]});
 assert.equal(a.creditC,b.creditC);assert.equal(a.alloyU,450);assert.equal(a.hydrogenU,5);assert.ok(a.creditC>6000);assert.ok(constructionQuote({...base,jobs,experience:100}).creditC<a.creditC);
});
test('integer build limits are enforced, not a planetary concurrency hard cap',()=>{const s=createEnergyEconomy(p,e,inputs);assert.throws(()=>orderPowerComplex(s,'earth','fusion',51));assert.throws(()=>orderPowerComplex(s,'earth','solar',1.5));});
test('metal mixtures differ and none treats all alloy as aluminium',()=>{const a=alloyElectricityMWhPerT('steelHeavy'),b=alloyElectricityMWhPerT('mixed'),c=alloyElectricityMWhPerT('nonferrousHeavy');assert.ok(a<b&&b<c&&c<14);near(b,3.575);});
test('existing capacity uses game readiness and efficiency: new facilities ramp',()=>{const args={sets:1,completedMonth:0,difficulty:48,processingDifficulty:48,mineRatio:1};const a=industryCapacity({...args,month:0}),b=industryCapacity({...args,month:12});assert.ok(a.mineU<b.mineU);near(b.mineU,3200);});
test('audited source eligibility: Earth2 finite H sources, Moon no water/H, Mars water but no H deposit',()=>{assert.equal(inputs.planets.earth.sources.length,2);assert.ok(inputs.planets.earth.sources.every(x=>x.oreEligible));assert.equal(inputs.planets.moon.waterTiles.length,0);assert.equal(inputs.planets.moon.sources.length,0);assert.equal(inputs.planets.mars.sources.length,0);assert.deepEqual(inputs.planets.mars.waterTiles,['sol:mars:surface:00019']);assert.equal(inputs.planets.earth.populationPersons,8893000000);});
test('OFF is byte-equivalent to the original and the Round2 golden path is preserved',()=>{
 const original=simulateEconomy(p,{seed:'econ-1',scenario:'S0',months:240,diagnostics:true}),off=simulateEnergyEconomy(p,e,inputs,{seed:'econ-1',scenario:'S0',months:240,energyEnabled:false});assert.deepEqual(off.rows,original.rows);
 assert.equal(hash(original.rows.map(({flow,...rest})=>rest)),'8d1ff9cf827461200f4831313449df1b44f334f2d42f4daa89835f14c045e71b');
});
test('ON is deterministic, preserves MV=PY and all balances across owners',()=>{const a=run('E0',60),b=run('E0',60);assert.equal(hash(a.rows),hash(b.rows));assertEnergyEconomy(a.state);for(const r of a.rows)near(r.moneyC*p.velocity,r.priceIndex*r.realGDP,.01);});
test('Earth baseline disaggregates existing industry rather than adding it twice',()=>{
 const s=createEnergyEconomy(p,e,inputs);assert.ok(s.planets.earth.baselineIndustrialGWh>0);assert.ok(s.planets.earth.baselineIndustrialGWh<8120*730*.01);
 tickEnergyEconomy(s);assert.ok(Math.abs(s.planets.earth.flow.demandGWh/(8120*730)-1)<.01);assert.ok(s.planets.earth.backgroundAlloyU<s.planets.earth.initialGeneralAlloyU);
});
test('government self generation never books power sales to itself',()=>{const r=run('E1',24);assert.ok(r.state.planets.earth.total.powerSalesC>0);assert.equal(r.state.planets.earth.total.governmentSelfSalesC,0);});
test('zero-startup-grid colony cannot bootstrap its fusion from generated H/power',()=>{const r=run('E4',24),moon=r.state.planets.moon;const a=moon.assets.find(a=>a.kind==='powerModule');assert.ok(a);near(a.progressHours,0);assert.equal(a.state,'starting');near(moon.total.governmentPowerGWh,0);near(moon.total.hydrogenProducedU,0);});
test('no electricity gives no electrolysis output; output H never funds same-settlement startup',()=>{
 const s=createEnergyEconomy(p,e,inputs);s.planets.earth.assets.find(a=>a.kind==='legacyGrid').capacityGW=0;s.book.sink(account('earth','private','hydrogen'),s.book.get(account('earth','private','hydrogen')),'test-hydrogen-empty');tickEnergyEconomy(s);near(s.planets.earth.flow.hydrogenElectrolysisU,0);assert.equal(s.planets.earth.flow.normalHydrogenU,0);
});
test('electrolysis consumes9 water mass, creates1 H and8 oxygen with actual energy',()=>{
 const r=run('E0',36),b=r.state.book,h=b.turnover['electrolysis-hydrogen']??0;assert.ok(h>0);assert.equal(b.turnover['electrolysis-water'],9*h);assert.equal(b.turnover['electrolysis-oxygen'],8*h);near(r.state.planets.earth.total.electrolysisGWh,h/1000*e.electrolysisGWhPerU,.1);
});
test('Moon/Mars cannot borrow Earth stock or invented local H sources',()=>{const r=run('E2',36);near(r.state.planets.moon.total.hydrogenByproductU,0);near(r.state.planets.mars.total.hydrogenByproductU,0);assert.ok(r.state.book.turnover['explicit-finite-shipment']>0);assert.ok(r.state.book.turnover.freight>0);});
test('all completed kinds incur alloy upkeep, including paused and restart states',()=>{const r=run('E6',72),maint=r.state.planets.earth.total.maintenanceByKind;for(const v of Object.values(maint))assert.ok(v.requiredU>0);assert.ok(maint.powerModule.pausedRequiredU>0);assert.ok(r.state.events.filter(x=>x.event==='fusion-start'&&x.number===2).length>0);});
test('upkeep shortage causes persistent damage; resumed supply requires paid repair',()=>{
 const r=run('E5',96),b=r.state.planets.earth;assert.ok(b.total.healthMin<1);assert.ok(b.total.upkeepPaidU<b.total.upkeepRequiredU);assert.ok(b.assets.some(a=>a.health<1));
 const fresh=createEnergyEconomy(p,e,inputs),asset=fresh.planets.earth.assets.find(a=>a.kind==='industry');asset.backlogU=10;asset.health=.5;tickEnergyEconomy(fresh);assert.ok(fresh.planets.earth.flow.repairU>0);assert.ok(fresh.planets.earth.flow.repairC>0);assert.ok(asset.health>.5);
});
test('H sensitivities are explicit and never mutate defaults or previous runs',()=>{
 const before=JSON.stringify(e),a=run('E1',36,{fusionFuelSensitivityU:.5}),b=run('E1',36);assert.equal(a.state.fuelU,.5);assert.equal(b.state.fuelU,2.5);assert.equal(JSON.stringify(e),before);assert.ok(a.state.planets.earth.total.normalHydrogenU<b.state.planets.earth.total.normalHydrogenU);
});
for(const scenario of ENERGY_SCENARIOS)test('scenario '+scenario+' retains cash/material integrity for20years',()=>{const r=run(scenario,240);assertEnergyEconomy(r.state);assert.equal(r.rows.length,241);assert.ok(r.rows.every(x=>Number.isFinite(x.realGDP)&&Number.isFinite(x.priceIndex)));});

test('legacy operating proxies have zero effect when explicit costs are enabled',()=>{const a=run('E0',36),b=simulateEnergyEconomy({...p,governmentOperatingRate:.9,privateOperatingRate:.9},e,inputs,{scenario:'E0',months:36});assert.equal(hash(a.rows),hash(b.rows));});
test('an empty colony cannot borrow Earth alloy to order a government base',()=>{const s=createEnergyEconomy(p,e,inputs);const local=account('moon','government','alloy');s.book.sink(local,s.book.get(local),'test-local-empty');s.book.move(account('earth','government'),account('moon','government'),20000000,'test-finite-cash-grant');const before=s.book.get(account('earth','government','alloy'));assert.equal(orderPowerComplex(s,'moon','fusion',1),null);assert.equal(s.book.get(account('earth','government','alloy')),before);});
test('mining completes in6months, smelting8; both use their fixed full government contracts',()=>{const s=createEnergyEconomy(p,e,inputs);assert.ok(orderIndustry(s,s.planets.earth,'government'));const a=s.planets.earth.assets.find(x=>x.owner==='government'&&x.kind==='industry');assert.equal(a.completedMonth,6);assert.equal(a.smeltCompletedMonth,8);assert.equal(a.creditBasisC,39000);assert.equal(a.alloyBasisU,4350);assert.throws(()=>orderIndustry(s,s.planets.earth,'government',.1));});
test('a water-eligible government H module attaches to a paid industrial host without an extra slot',()=>{const s=createEnergyEconomy(p,e,inputs);for(const [r,n]of [['C',45000000],['alloy',5000000],['hydrogen',150000]])s.book.move(account('earth','government',r),account('mars','government',r),n,'test-explicit-shipment');const b=s.planets.mars;assert.ok(orderIndustry(s,b,'government'));for(let i=0;i<9;i++)tickEnergyEconomy(s);assert.ok(orderHydrogen(s,b,'government'));assert.equal(orderHydrogen(s,s.planets.moon,'government'),false);const slots=governmentPowerSlots(b.complexes);s.book.sink(account('mars','government','hydrogen'),s.book.get(account('mars','government','hydrogen')),'test-hydrogen-empty');for(let i=0;i<10;i++)tickEnergyEconomy(s);assert.ok(b.total.hydrogenElectrolysisU>0);assert.equal(governmentPowerSlots(b.complexes),slots);assertEnergyEconomy(s);});
test('two completed fusion modules spend build H10 and separate startup H10 with150/360GWh',()=>{const s=createEnergyEconomy(p,e,inputs);assert.ok(orderPowerComplex(s,'earth','fusion',2));for(let i=0;i<9;i++)tickEnergyEconomy(s);const t=s.planets.earth.total;near(t.startHydrogenU,10);near(t.startInputGWh,150,.001);near(t.startGenerationGWh,360,.001);assert.ok((s.book.turnover['construction-hydrogen']??0)>=130000);near(t.startC,5000);});
test('existing completed power continues generating while its complex expands',()=>{const s=createEnergyEconomy(p,e,inputs),c=orderPowerComplex(s,'earth','fission',1);for(let i=0;i<7;i++)tickEnergyEconomy(s);const baseCount=s.planets.earth.assets.filter(a=>a.kind==='powerBase').length;c.wanted=2;tickEnergyEconomy(s);assert.equal(c.modules.length,2);assert.ok(s.planets.earth.flow.governmentPowerGWh>0);assert.equal(s.planets.earth.assets.filter(a=>a.kind==='powerBase').length,baseCount);});

test('monthly assisted smelting funds actual processed-ore H, not the85U raw ceiling',()=>{const full=assistedSmelting({oreU:5000,baseProcessU:5000/1.15*.76,rawWorkU:5000/1.15,maxHydrogenU:85,availableHydrogenU:64.6});near(full.processU,3800);near(full.hydrogenU,64.6);near(full.alpha,1);const partial=assistedSmelting({oreU:3500,baseProcessU:5000/1.15*.76,rawWorkU:5000/1.15,maxHydrogenU:85,availableHydrogenU:20});assert.ok(partial.hydrogenU<=20+1e-8);near(partial.hydrogenU,20);assert.ok(partial.processU<=3500);});
test('a private H deficit buys finite government surplus and leaves an honest unfilled order',()=>{const s=createEnergyEconomy(p,e,inputs,{trace:true}),privateH=account('earth','private','hydrogen'),govC=account('earth','government');s.book.sink(privateH,s.book.get(privateH),'test-H-shortage');const before=s.book.get(govC);tickEnergyEconomy(s);assert.ok((s.book.turnover['hydrogen-purchase:C']??0)>0);assert.ok(s.book.trace.some(t=>t.tag==='hydrogen-purchase:C'&&t.to===govC&&t.n>0));assert.ok(s.planets.earth.flow.hydrogenUnmetU>0);assert.ok(s.planets.earth.flow.hydrogenUsedU>0);assertEnergyEconomy(s);});
test('startup-only H5 without sustaining fuel cold-stops and a funded later restart pays again',()=>{const s=createEnergyEconomy(p,e,inputs);const c=orderPowerComplex(s,'earth','fusion',1);for(let i=0;i<6;i++)tickEnergyEconomy(s);for(const owner of ['government','private']){const key=account('earth',owner,'hydrogen');s.book.sink(key,s.book.get(key),'test-H-exhausted');}s.book.source(account('earth','government','hydrogen'),5000,'test-exact-startup-H');tickEnergyEconomy(s);const a=s.planets.earth.assets.find(x=>x.id===c.modules[0]);assert.equal(a.state,'coldStopped');assert.equal(a.progressHours,0);assert.equal(a.startPaid,false);assert.equal(a.starts,1);tickEnergyEconomy(s);assert.equal(a.starts,2);assert.ok(s.planets.earth.total.startC>=5000);assertEnergyEconomy(s);});

test('private investment cost includes actual H/electricity and charges direct labor against credit basis only',()=>{const args={investmentC:50000,creditBasisC:39000,alloyBasisU:4350,outputU:900,energyGWh:40,hydrogenU:64.6,amortizationMonths:40.8,directAnnual:.09,upkeepAnnual:.02,alloyPrice:2.3,hydrogenPrice:.4,powerPrice:.02},a=explicitIndustryUnitCost(args),h=explicitIndustryUnitCost({...args,hydrogenPrice:.8}),power=explicitIndustryUnitCost({...args,powerPrice:.04});near(h-a,64.6*.4/900);near(power-a,40*.02/900);near(a,(50000/40.8+39000*.09/12+4350*.02*2.3/12+40*.02+64.6*.4)/900);});
