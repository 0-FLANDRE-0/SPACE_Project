import {RESOURCE_FOUNDATION_UPDATES} from './helpers/resource-foundation-preservation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createEconomy,tickEconomy,simulateEconomy,migratePopulation,assertEconomy,industryExpectation,setPayback,ECON_SHIPS,ECON_SCENARIOS,ECON_Q} from '../dist/src/economy-model.js';
import {FACILITY_TYPES,MINING,SMELTING,extractionEfficiency,processingEfficiency} from '../dist/src/industry-policy.js';
import {INITIAL_ALLOY_YIELDS} from '../dist/src/ore-quality.js';
import {readConfig,latinHypercube,metrics} from '../scripts/econ-calibrate.mjs';
const config=readConfig(),base=config.parameters,params=change=>({...structuredClone(base),...change}),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('ECON initial money derives from GDP/velocity; CPI1 and alloy2.3 in every velocity',()=>{
 for(const velocity of [1,1.25,1.5,2]){const s=createEconomy(params({velocity}));assert.equal(s.priceIndex,1);assert.equal(s.realAlloyPrice,2.3);assert.ok(Math.abs(s.moneyQ/ECON_Q-s.realGDP/velocity)<=.000501);assert.equal(Object.values(s.bodies).reduce((n,b)=>n+b.population,0),8893250000);}
});
test('ECON same config/seed produces exactly equal twenty-year hash; shock seeds differ',()=>{
 const a=simulateEconomy(base,{scenario:'S1',seed:'repeat'}),b=simulateEconomy(base,{scenario:'S1',seed:'repeat'}),c=simulateEconomy(base,{scenario:'S1',seed:'other'});
 assert.equal(hash(a.rows),hash(b.rows));assert.notEqual(hash(a.rows),hash(c.rows));
});
test('ECON declining/stagnant/growing populations stay integer; explicit migration conserves persons',()=>{
 for(const earthPopulationGrowth of [-.002,0,.003]){const s=simulateEconomy(params({earthPopulationGrowth}),{months:240}).state;for(const b of Object.values(s.bodies))assert.ok(Number.isSafeInteger(b.population)&&b.population>=0);assert.equal(Math.sign(s.bodies.earth.population-base.bodies.earth.populationPersons),Math.sign(earthPopulationGrowth));const total=Object.values(s.bodies).reduce((n,b)=>n+b.population,0);migratePopulation(s,'earth','mars',12345);assert.equal(Object.values(s.bodies).reduce((n,b)=>n+b.population,0),total);assert.throws(()=>migratePopulation(s,'earth','mars',-1));}
});
test('ECON all six actions/three seeds preserve monthly taxes, treasury, currency and material ledgers',()=>{
 for(const scenario of ECON_SCENARIOS)for(const seed of config.seeds){const r=simulateEconomy(base,{scenario,seed});assertEconomy(r.state);for(const row of r.rows.slice(1)){assert.equal(row.flow.taxQ,row.flow.budgetQ+row.flow.fixedSpendingQ);assert.ok(row.treasuryC>=0&&row.marketInventoryU>=0&&row.governmentInventoryU>=0);}assert.equal(r.state.moneyQ,r.state.initialMoneyQ+r.state.ledger.normalIssuanceQ+r.state.ledger.monetizationQ);}
});
test('ECON fixed-money growth deflates; growth-linked money follows specified CPI without arbitrary grants',()=>{
 const p=params({productivityShock:0,productivityGrowth:.02,earthPopulationGrowth:0,supplyConstraintStrength:0});
 const fixed=simulateEconomy(p,{moneyRule:'fixed'}),growth=simulateEconomy(p);
 assert.equal(fixed.state.moneyQ,fixed.state.initialMoneyQ);assert.ok(fixed.rows.at(-1).priceIndex<1);
 assert.ok(Math.abs(growth.state.priceIndex-Math.pow(1+p.targetInflation,20))<1e-7);
 assert.equal(growth.state.ledger.monetizationQ,0);
});
test('ECON monetary financing creates explicit issuance and more inflation than matched debt branch',()=>{
 const p=params({productivityShock:0}),debt=simulateEconomy(p,{scenario:'S3-debt'}),money=simulateEconomy(p,{scenario:'S3-money'});
 assert.equal(debt.state.ledger.monetizationQ,0);assert.ok(money.state.ledger.monetizationQ>0);assert.ok(money.state.priceIndex>debt.state.priceIndex);assert.equal(money.state.warPurchasedQ,50000*ECON_Q);assert.equal(debt.state.warPurchasedQ,50000*ECON_Q);
});
test('ECON policy imports establish set cost, extraction/processing limits and weighted yield',()=>{
 const x=industryExpectation(base),yieldExpected=Object.keys(INITIAL_ALLOY_YIELDS).reduce((n,k)=>n+base.gradeProbabilities[k]*INITIAL_ALLOY_YIELDS[k],0);
 assert.equal(x.creditC,FACILITY_TYPES[MINING].creditC+FACILITY_TYPES[SMELTING].creditC);
 assert.equal(x.alloyInputU,4350);assert.equal(x.hydrogenInputU,120);
 assert.equal(x.alloyU,Math.min(FACILITY_TYPES[MINING].capacityU*extractionEfficiency(base.difficulty),FACILITY_TYPES[SMELTING].capacityU*processingEfficiency(base.processingDifficulty))*yieldExpected);
 const p0=setPayback(base,{operatingRate:0}),p1=setPayback(base,{operatingRate:.15});assert.ok(p0.fromOrderYears>p0.steadyYears);assert.ok(p1.fromOrderYears>p0.fromOrderYears);
});
test('ECON construction requires elapsed commissioning/ramp and ore mass cannot appear as alloy early',()=>{
 const r=simulateEconomy(params({productivityShock:0}),{scenario:'S1',months:15});
 assert.equal(r.rows[1].governmentSets,1);assert.ok(r.rows.slice(1,9).every(x=>x.governmentSupplyU===0));assert.ok(r.rows[9].governmentSupplyU>0);assert.ok(r.rows[14].governmentSupplyU>r.rows[9].governmentSupplyU);
});
test('ECON ships keep fixed five-and-a-half-month jobs and alternate orders without instant fleet creation',()=>{
 assert.equal(ECON_SHIPS.support.months,5.5);assert.equal(ECON_SHIPS.explorer.months,5.5);
 const r=simulateEconomy(params({productivityShock:0}),{scenario:'S2',months:12});
 assert.equal(r.rows[0].activeShips,3);assert.equal(r.rows[1].activeShips,3);assert.equal(r.rows[6].activeShips,4);assert.equal(r.state.ships[3].completed,5.5);assert.equal(r.state.ships[3].kind,'support');assert.equal(r.state.ships[4].kind,'explorer');
});
test('ECON price-index control retains alloy U costs while fixed C ship prices become cheaper in real terms',()=>{
 const p=params({productivityShock:0,targetInflation:.03}),a=simulateEconomy(p,{scenario:'S2'}),b=simulateEconomy(p,{scenario:'S2',indexed:false});
 assert.ok(b.state.priceIndex>1);assert.ok(ECON_SHIPS.support.creditC/b.state.priceIndex<ECON_SHIPS.support.creditC);assert.ok(b.rows.at(-1).activeShips>=a.rows.at(-1).activeShips);
 assert.equal(ECON_SHIPS.support.alloyU,750);
});
test('ECON prices remain bounded and finite under extreme adjustment and zero private investment',()=>{
 const p=params({priceAdjustment:2,expansionBeta:0,productivityShock:.025}),r=simulateEconomy(p,{scenario:'S3-money'});
 for(const row of r.rows){assert.ok(row.realAlloyPrice>=p.baseAlloyPrice*p.priceFloor-1e-10);assert.ok(row.realAlloyPrice<=p.baseAlloyPrice*p.priceCeiling+1e-10);assert.ok(Number.isFinite(row.priceIndex)&&row.priceIndex>0);}
});
test('ECON colony tax exemptions and mandatory debt are explicit, not negative treasury',()=>{
 const p=params({initialTreasuryC:0,strategyShare:0,colonySupportC:10000}),r=simulateEconomy(p,{scenario:'S4',months:12});
 assert.equal(r.state.bodies.moon.taxRate,0);assert.equal(r.state.bodies.mars.taxRate,0);assert.ok(r.state.debtQ>0);assert.ok(r.rows.every(x=>x.treasuryC>=0));assert.equal(r.state.ships.length,3);
});
test('ECON invalid stock, grade, velocity and migration inputs fail validation',()=>{
 for(const delta of [{velocity:0},{gradeProbabilities:{low:1,medium:1,high:0}},{initialAlloyU:-1},{earthPopulationGrowth:-1},{warPurchaseMonths:0}])assert.throws(()=>createEconomy(params(delta)));
 const s=createEconomy(base);s.governmentAlloyQ++;assert.throws(()=>assertEconomy(s),/ledger/);
});
test('ECON seeded LHS is reproducible, bounded and stratified for continuous parameters',()=>{
 const c={...config,samples:16},a=latinHypercube(c);assert.deepEqual(a,latinHypercube(c));
 for(const [key,[low,high]]of Object.entries(c.ranges)){for(const p of a)assert.ok(p[key]>=low&&p[key]<=high);if(key!=='expansionDelayMonths')assert.equal(new Set(a.map(p=>Math.floor((p[key]-low)/(high-low)*16))).size,16);}
});
test('ECON criteria report failures rather than coercing prices or silently passing impossible payback',()=>{
 const p=params({productivityGrowth:.025,targetInflation:.03,productivityShock:0}),r=simulateEconomy(p,{scenario:'S0'}),m=metrics(r,p,config.criteria);
 assert.equal(m.checks.budget17,false);assert.equal(m.passed,false);assert.ok(m.penalty>0);
});
test('ECON model is independent of browser, real clock, filesystem and unseeded randomness',()=>{
 const source=fs.readFileSync('dist/src/economy-model.js','utf8');assert.doesNotMatch(source,/\b(?:document|window|localStorage|sessionStorage|performance|Date)\b|Math\.random|node:fs|advanceIndustry/);
});
test('ECON shipped files outside the authorized resource foundation update remain byte-identical',()=>{
 const baseline='7d31e16b1ecc9faa42d9ea21aee7068e8dc09722',files=execFileSync('git',['ls-tree','-r','--name-only',baseline,'--','dist'],{encoding:'utf8'}).trim().split('\n');
 for(const file of files.filter(f=>!RESOURCE_FOUNDATION_UPDATES.has(f)))assert.deepEqual(fs.readFileSync(file),execFileSync('git',['show',baseline+':'+file],{maxBuffer:10*1024*1024}),file);
});

test('ECON collection efficiency has its own body-level policy slot and changes collected tax without minting',()=>{
 const p=params({productivityShock:0}),half=structuredClone(p);half.bodies.earth.collectionEfficiency=.5;
 const a=simulateEconomy(p,{months:1}),b=simulateEconomy(half,{months:1});
 assert.ok(Math.abs(a.rows[1].flow.taxQ/2-b.rows[1].flow.taxQ)<=1);
 assert.equal(a.state.moneyQ,b.state.moneyQ);assert.equal(b.state.bodies.moon.taxRate,0);
});
