import {RESOURCE_FOUNDATION_UPDATES} from './helpers/resource-foundation-preservation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {industryExpectation,privateUnitProductionCost,privateEquilibriumPrice,governmentSaleQuote,simulateEconomy,ECON_Q,ECON_ROUND2_SCENARIOS} from '../dist/src/economy-model.js';
import {readRound2Config,filteredLatinHypercube,classifyRound2,aggregateRound2,roundProfile,executeRound2} from '../scripts/econ-round2-calibrate.mjs';
const config=readRound2Config(),base=config.parameters,hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fake=(scenario='S0',change={})=>({scenario,seed:'test',integrity:true,peaceDeviation:.1,meanRealPrice:2.3,inflationMin:.015,inflationMax:.02,budgetRatio17:1.4,realBudgetRatio17:1.1,payback0OrderYears:2.5,paybackOperatingOrderYears:3.5,warPeak:.3,warRecoveryYears:0,warPurchasedU:50000,colonyBurden5:.05,governmentShare17:.9,realGDP20:25000000,priceIndex20:1.3,privateCapacity20:20000,privateExpansionOrderedU:10000,governmentSoldU:0,governmentSalesC:0,treasury20:100000,debt20:0,...change});
test('R2 analytical equilibrium uses imported set investment/throughput and amortization units',()=>{
 const p={...base,privateAmortizationYears:3.5,privateScale:1,requiredMargin:.2},t=industryExpectation(p);
 const annualized=t.totalInvestmentC/p.privateAmortizationYears+t.totalInvestmentC*p.privateOperatingRate;
 assert.ok(Math.abs(privateUnitProductionCost(p)-annualized/(12*t.alloyU)*p.privateScale)<1e-12);
 assert.ok(Math.abs(privateEquilibriumPrice(p)-privateUnitProductionCost(p)*1.2)<1e-12);
 assert.ok(privateEquilibriumPrice(p)>=2.2&&privateEquilibriumPrice(p)<=2.45);
});
test('R2 longer amortization lowers threshold; margin/scale increase it without modifying inputs',()=>{
 const raw=JSON.stringify(base),value=privateEquilibriumPrice(base);
 assert.ok(privateEquilibriumPrice({...base,privateAmortizationYears:base.privateAmortizationYears+1})<value);
 assert.ok(privateEquilibriumPrice({...base,requiredMargin:base.requiredMargin+.01})>value);
 assert.ok(privateEquilibriumPrice({...base,privateScale:base.privateScale+.01})>value);assert.equal(JSON.stringify(base),raw);
});
test('R2 conditional seeded LHS fills accepted sample count, fixed V and all original range bounds',()=>{
 const c={...config,samples:16},a=filteredLatinHypercube(c),b=filteredLatinHypercube(c);assert.deepEqual(a,b);assert.equal(a.accepted.length,16);assert.equal(a.rejected,a.proposed-16);
 for(const x of a.accepted){assert.equal(x.parameters.velocity,1.3333);assert.ok(x.equilibrium>=2.2&&x.equilibrium<=2.45);for(const [k,[lo,hi]]of Object.entries(c.ranges))assert.ok(x.parameters[k]>=lo&&x.parameters[k]<=hi);}
});
test('R2 sampler rejects velocity exploration, wrong seed count and impossible band without infinite retry',()=>{
 assert.throws(()=>filteredLatinHypercube({...config,parameters:{...base,velocity:1.5}}));
 assert.throws(()=>filteredLatinHypercube({...config,ranges:{...config.ranges,velocity:[1,2]}}));
 assert.throws(()=>filteredLatinHypercube({...config,seeds:config.seeds.slice(0,4)}));
 assert.throws(()=>filteredLatinHypercube({...config,samples:2,equilibriumBand:[5,6],maxProposalBatches:1}),/exhausted/);
});
test('R2 S1-sell quote sells half of total surplus, including old stock, with nominal C/U revenue',()=>{
 const s={scenario:'S1-sell',governmentAlloyQ:30000*ECON_Q,initialGovernmentAlloyQ:10000*ECON_Q};
 const quote=governmentSaleQuote(s,3);assert.equal(quote.amountQ,10000*ECON_Q);assert.equal(quote.revenueQ,30000*ECON_Q);assert.equal(s.governmentAlloyQ,30000*ECON_Q);
});
test('R2 sell buffer and sub-quantum rounding never manufacture material or negative stock',()=>{
 for(const excess of [-1000,0,1,2,3]){const s={scenario:'S1-sell',governmentAlloyQ:10000*ECON_Q+excess,initialGovernmentAlloyQ:10000*ECON_Q},q=governmentSaleQuote(s,2.3);assert.equal(q.amountQ,Math.floor(Math.max(0,excess)*.5));assert.ok(q.amountQ>=0&&q.amountQ<=Math.max(0,excess));}
});
test('R2 monthly S1-sell inventory reduction/revenue and all monetary ledgers reconcile for five seeds',()=>{
 for(const seed of config.seeds){
  const r=simulateEconomy(base,{scenario:'S1-sell',seed,diagnostics:true});assert.ok(r.state.ledger.govSoldQ>0);
  for(const row of r.rows.slice(1)){
   const f=row.flow;assert.equal(f.governmentSoldQ,Math.floor(Math.max(0,f.governmentBeforeSaleQ-r.state.initialGovernmentAlloyQ)*.5));
   assert.equal(f.salesQ,Math.round(f.governmentSoldQ*f.salesPriceCPerU));
   const expenses=['maintenanceQ','operatingQ','supportQ','interestQ','constructionQ','shipCostQ','alloyPurchasesQ','hydrogenPurchasesQ'].reduce((n,k)=>n+f[k],0);
   assert.equal(f.closingQ-f.openingQ-f.budgetQ-f.borrowingQ-f.monetizationQ+expenses,f.salesQ);
  }
 }
});
test('R2 S1-sell remains annual construction policy and reveals crowding out in the base fixture',()=>{
 const a=simulateEconomy(base,{scenario:'S1',diagnostics:true}),b=simulateEconomy(base,{scenario:'S1-sell',diagnostics:true});
 assert.equal(a.rows.at(-1).governmentSets,20);assert.equal(b.rows.at(-1).governmentSets,20);
 assert.ok(b.state.governmentAlloyQ<a.state.governmentAlloyQ);assert.ok(b.state.privateCapacityU<a.state.privateCapacityU);
});
test('R2 government share is informational; budget17 applies to S0 only',()=>{
 assert.equal(classifyRound2(fake('S1',{governmentShare17:10,budgetRatio17:2}),base,config).passed,true);
 assert.equal('governmentMinor' in classifyRound2(fake('S1'),base,config).checks,false);
 assert.equal(classifyRound2(fake('S0',{budgetRatio17:2}),base,config).checks.budget17,false);
});
test('R2 mean-price eight-percent condition is independent of fifteen-percent maximum deviation',()=>{
 const p=classifyRound2(fake('S0',{peaceDeviation:.1,meanRealPrice:2.3*1.09}),base,config);
 assert.equal(p.checks.peacePrice,true);assert.equal(p.checks.meanPrice,false);assert.equal(p.passed,false);
 assert.equal(classifyRound2(fake('S0',{meanRealPrice:2.3*1.08}),base,config).checks.meanPrice,true);
});
test('R2 faster war recovery passes, but missing/late recovery or incomplete purchase does not',()=>{
 for(const warRecoveryYears of [0,1,4])assert.equal(classifyRound2(fake('S3-debt',{warRecoveryYears}),base,config).checks.warRecovery,true);
 for(const warRecoveryYears of [null,4.01])assert.equal(classifyRound2(fake('S3-money',{warRecoveryYears}),base,config).checks.warRecovery,false);
 assert.equal(classifyRound2(fake('S3-money',{warPurchasedU:49999.999}),base,config).checks.warProcurement,false);
});
test('R2 basic support ten-percent applies to ordinary/war scenarios; S4 is informational',()=>{
 for(const scenario of config.scopes.support)assert.equal(classifyRound2(fake(scenario,{colonyBurden5:.11}),base,config).checks.colonyBurden,false);
 assert.equal(classifyRound2(fake('S4',{colonyBurden5:.9}),base,config).passed,true);
 assert.equal('colonyBurden' in classifyRound2(fake('S4'),base,config).checks,false);
});
test('R2 extra selling scenario is comparison-only except common integrity/payback',()=>{
 const p=classifyRound2(fake('S1-sell',{peaceDeviation:1,meanRealPrice:1,colonyBurden5:.9,budgetRatio17:10}),base,config);
 assert.deepEqual(Object.keys(p.checks).sort(),['integrity','paybackZeroOperating']);assert.equal(p.passed,true);
 assert.equal(classifyRound2(fake('S1-sell',{integrity:false}),base,config).passed,false);
});
test('R2 profile robustness uses worst margin, never a favourable average or four-of-five pass',()=>{
 const records=config.seeds.map(seed=>{const m=fake('S0',{seed});return {...m,...classifyRound2(m,base,config)};});
 const good=aggregateRound2('good',base,records);assert.equal(good.passed,true);
 records[4]={...records[4],checks:{...records[4].checks,budget17:false},margins:{...records[4].margins,budget17:-.2},passed:false};
 const bad=aggregateRound2('bad',base,records);assert.equal(bad.passed,false);assert.equal(bad.robustness,-.2);assert.equal(bad.failures.budget17,1);assert.ok(good.robustness>bad.robustness);
});
test('R2 rounding preserves fixed inputs, configured ranges and original parameter object',()=>{
 const profile=filteredLatinHypercube({...config,samples:4}).accepted[0].parameters,original=JSON.stringify(profile),p=roundProfile(profile,config,1);
 assert.equal(JSON.stringify(profile),original);assert.equal(p.velocity,1.3333);assert.equal(p.baseAlloyPrice,2.3);assert.equal(p.bodies.earth.populationPersons,8893000000);
 for(const [k,[lo,hi]]of Object.entries(config.ranges))assert.ok(p[k]>=lo&&p[k]<=hi);
});
test('R2 output guard protects every round1 output path',()=>{
 for(const out of ['docs/econ-sim','docs/econ-sim/charts','docs/econ-sim/round1'])assert.throws(()=>executeRound2(config,{out}),/protected/);
});
test('R2 preserves original six-scenario interface and exact round1 reference trajectory hash',()=>{
 const p=JSON.parse(fs.readFileSync('scripts/econ-calibrate.config.json')).parameters;
 assert.equal(hash(simulateEconomy(p).rows),'1c983b4fd1080ea0afedd0afecaf35e20dff4426bc78755edf41e1ab5e266de5');
 assert.equal(ECON_ROUND2_SCENARIOS.length,7);
});
test('R2 round1 artifacts and shipped files outside the resource foundation update remain byte-identical',()=>{
 const baseline='f04a99abc5c1b6f9c7c98bb9402814b7884f2236',paths=['dist','docs/econ-sim','scripts/econ-calibrate.mjs','scripts/econ-calibrate.config.json','scripts/econ-report-plots.py','scripts/econ-write-report.mjs','tests/economy-model.test.js','tests/browser-economy-report.mjs'];
 const files=execFileSync('git',['ls-tree','-r','--name-only',baseline,'--',...paths],{encoding:'utf8'}).trim().split('\n').filter(f=>f!=='dist/src/economy-model.js');
 for(const file of files.filter(f=>!RESOURCE_FOUNDATION_UPDATES.has(f)))assert.deepEqual(fs.readFileSync(file),execFileSync('git',['show',baseline+':'+file],{maxBuffer:20*1024*1024}),file);
});
