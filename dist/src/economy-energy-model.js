// Standalone ECON-SIM-3 experiment. Never imported by the game entry point.
// OFF delegates the untouched Round1/2 model. ON owns a new closed cash book,
// local physical inventories and integrated planetary grids.
import {simulateEconomy,industryExpectation,ECON_ROUND2_SCENARIOS,ECON_SHIPS} from './economy-model.js';
import {resourceRandom} from './ore-quality.js';
import {FACILITY_TYPES,MINING,SMELTING} from './industry-policy.js';
import {Ledger,account,quantize as q,trade,energyAudit} from './economy-energy-ledger.js';
import {POWER_TYPES,FUSION,industryCapacity,alloyElectricityMWhPerT,advanceFusionStart,dispatchFusion,constructionQuote,upkeepBill,balanceStorage,assistedSmelting,explicitIndustryUnitCost} from './economy-energy-facilities.js';
export const ENERGY_SCENARIOS=Object.freeze([...ECON_ROUND2_SCENARIOS,'E0','E1','E2','E3','E4','E5','E6','E7','E8']);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),sum=a=>a.reduce((s,x)=>s+x,0),mean=a=>sum(a)/Math.max(1,a.length);
const initialEnergyStats=()=>({generationGWh:0,demandGWh:0,servedGWh:0,unservedGWh:0,startInputGWh:0,startGenerationGWh:0,industryDemandGWh:0,industryServedGWh:0,electrolysisGWh:0,storageChargeGWh:0,storageDischargeGWh:0,storageLossGWh:0,curtailedGWh:0,governmentExternalSalesC:0,governmentSelfSalesC:0});
const normal=(seed,m)=>{const u=Math.max(1e-12,resourceRandom(seed,m,'energy-growth-u')),v=resourceRandom(seed,m,'energy-growth-v');return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
function pay(s,planet,from,to,c,tag){
 const a=account(planet,from),b=account(planet,to),n=Math.min(s.book.get(a),q(Math.max(0,c)));
 if(n&&a!==b)s.book.move(a,b,n,tag);return n/1000;
}
function consume(s,planet,owner,resource,u,tag){const a=account(planet,owner,resource),n=Math.min(s.book.get(a),Math.max(0,q(u)));if(n)s.book.sink(a,n,tag);return n/1000;}
function stock(s,planet,owner,resource){return s.book.get(account(planet,owner,resource))/1000;}
function purchase(s,b,owner,resource,u){
 const seller=owner==='government'?'private':'government';
 const reserve=owner==='private'?(resource==='alloy'?12*sum(b.assets.filter(a=>a.owner==='government'&&a.completedMonth<=s.month).map(a=>upkeepBill(a,{...s.e,month:s.month}).alloyU)):Math.max(10,b.hydrogenGovernmentReservationU??0)):0;
 const available=Math.max(0,stock(s,b.id,seller,resource)-reserve);
 const r=trade(s.book,{planet:b.id,from:seller,to:owner,resource,amountU:Math.min(available,Math.max(0,u)),priceC:(resource==='alloy'?b.alloyPrice:b.hydrogenPrice)*s.priceIndex,tag:resource+'-purchase'});
 b.flow.purchasesC+=r.cashC;return r;
}
function ensureStock(s,b,owner,resource,u){const need=Math.max(0,u-stock(s,b.id,owner,resource));if(need)purchase(s,b,owner,resource,need);return stock(s,b.id,owner,resource)>=u-1e-6;}
function addAsset(b,asset){const a={id:b.id+'-'+(b.serial++),state:'active',health:1,backlogU:0,completedMonth:0,creditBasisC:0,alloyBasisU:0,...asset};b.assets.push(a);return a;}
function industryAsset(b,owner,sets,completedMonth,e,{mineRatio=e.mineRatio}={}){
 const mine=FACILITY_TYPES[MINING],smelt=FACILITY_TYPES[SMELTING],scale=owner==='private'?e.privateScale:1;
 return addAsset(b,{kind:'industry',owner,sets,mineRatio,completedMonth,smeltCompletedMonth:completedMonth<0?completedMonth:completedMonth+smelt.months-mine.months,mineCreditC:mine.creditC*mineRatio*sets*scale,mineAlloyU:mine.alloyU*mineRatio*sets*scale,creditBasisC:(mine.creditC*mineRatio+smelt.creditC)*sets*scale,alloyBasisU:(mine.alloyU*mineRatio+smelt.alloyU)*sets*scale,state:completedMonth>0?'construction':'active',hydrogenU:smelt.hydrogenU*sets,tag:'mine+smelter'});
}
function baseFlow(){return {producedU:0,privateProducedU:0,governmentProducedU:0,minedU:0,processedU:0,residueU:0,hydrogenProducedU:0,hydrogenUsedU:0,hydrogenUnmetU:0,hydrogenByproductU:0,hydrogenElectrolysisU:0,upkeepRequiredU:0,upkeepPaidU:0,repairU:0,repairC:0,directC:0,purchasesC:0,constructionC:0,constructionAlloyU:0,constructionHydrogenU:0,startC:0,startHydrogenU:0,normalHydrogenU:0,generalAlloyDemandU:0,generalAlloyConsumedU:0,unmetAlloyU:0,governmentSoldU:0,governmentSaleC:0,powerSalesC:0,powerFuelC:0,powerUnpaidC:0,warAlloyU:0,powerDirectC:0,powerUpkeepU:0,governmentPowerDirectC:0,governmentPowerUpkeepU:0,governmentIndustryDirectC:0,governmentIndustryUpkeepU:0,governmentPowerPurchaseC:0,hydrogenDirectC:0,hydrogenUpkeepU:0,hydrogenConstructionC:0,privateExpansionSets:0,governmentPowerGWh:0,healthMin:1,loanC:0,budgetC:0,mandatoryC:0,shipOrders:0,maintenanceByKind:{},...initialEnergyStats()};}
function initPlanet(s,id,inputs){
 const p=s.p,e=s.e,ref=inputs.planets[id],definition=p.bodies[id],b={id,reference:ref,serial:0,assets:[],complexes:[],jobs:[],experience:0,alloyPrice:p.baseAlloyPrice,hydrogenPrice:.4,alloyTargetU:0,hydrogenTargetU:0,outputHistory:[],demandHistory:[],flow:baseFlow(),total:baseFlow(),gdp:definition.annualGDP,potentialGDP:definition.annualGDP,population:definition.populationPersons,storage:null,baselineIndustrialGWh:0,initialGeneralAlloyU:0,privateCapitalU:0};
 for(const owner of ['government','private','household'])for(const resource of ['C','alloy','hydrogen','ore','water','residue','oxygen'])s.book.open(account(id,owner,resource),0);
 s.book.open(account(id,'ground','ore'),q(ref.oreU));
 for(const source of ref.sources)s.book.open(account(id,'ground',source.sourceId),q(source.initialReserveU));
 const initialMoney=definition.annualGDP/p.velocity;
 s.book.source(account(id,'private'),q(initialMoney*.3),'opening-cash');s.book.source(account(id,'household'),q(initialMoney*.7),'opening-cash');
 if(id==='earth'){
  s.book.move(account(id,'household'),account(id,'government'),q(p.initialTreasuryC),'initial-treasury-allocation');
  s.book.source(account(id,'government','alloy'),q(p.initialAlloyU),'opening-government-alloy');s.book.source(account(id,'government','hydrogen'),q(p.initialHydrogenU),'opening-government-hydrogen');
 }
 const generalU=definition.annualGDP*p.alloyMarketShare/p.baseAlloyPrice/12;
 if(id==='earth'){
  const cap=industryCapacity({sets:1,month:0,difficulty:p.difficulty,processingDifficulty:p.processingDifficulty,mineRatio:e.mineRatio}),yieldFraction=s.tech.yieldFraction;
  const output=Math.min(cap.mineU,cap.processU*(1+inputs.contract.smeltBoost))*yieldFraction;
  const sets=generalU/output;industryAsset(b,'private',sets,-100,e);
  const hydrogenU=sets*inputs.contract.smeltHydrogenU*(cap.processU/(FACILITY_TYPES[SMELTING].capacityU))*(cap.mineU>cap.processU?1:0);
  b.hydrogenTargetU=Math.max(100,hydrogenU*e.hydrogenInventoryMonths);
  b.hydrogenLastUseU=hydrogenU;
  const byproduct=ref.sources.filter(x=>x.oreEligible).length*inputs.contract.byproductMaximumU;
  const hModules=Math.max(0,(hydrogenU-byproduct)/e.hydrogenModuleU);
  if(hModules)addAsset(b,{kind:'electrolyzer',owner:'private',modules:hModules,hostTile:ref.waterHostTile,capacityU:hModules*e.hydrogenModuleU,creditBasisC:hModules*e.hydrogenModuleC,alloyBasisU:hModules*e.hydrogenModuleAlloyU,completedMonth:-100});
  const supply=e.earthBaseGW*(1+e.gridReserve);
  addAsset(b,{kind:'legacyGrid',owner:'private',capacityGW:supply,creditBasisC:p.bodies.earth.annualGDP*e.legacyGridCashGDPShare/e.directAnnual,alloyBasisU:e.legacyGridUpkeepAnnualU/e.upkeepAnnual,completedMonth:-100});
  s.book.source(account(id,'private','hydrogen'),q(b.hydrogenTargetU),'opening-private-hydrogen');
  b.initialGeneralAlloyU=generalU;b.alloyTargetU=generalU*p.inventoryDays/30;
 }else{
  b.initialGeneralAlloyU=generalU;b.alloyTargetU=generalU*p.inventoryDays/30;
  const gw=b.population*e.colonyKWPerPerson/1e6;
  addAsset(b,{kind:'legacyGrid',owner:'private',capacityGW:gw*1.05,creditBasisC:definition.annualGDP*e.legacyGridCashGDPShare/e.directAnnual,alloyBasisU:Math.max(1,e.legacyGridUpkeepAnnualU*gw/e.earthBaseGW/e.upkeepAnnual),completedMonth:-100});
 }
 // Opening inventories are declared historic stocks, never hidden recurring
 // imports. Colonial private alloy is finite and can run out.
 s.book.source(account(id,'private','alloy'),q(b.alloyTargetU),'opening-private-alloy');
 if(ref.waterTiles.length)s.book.source(account(id,'private','water'),q(e.waterTankU),'opening-water-tank');
 s.planets[id]=b;return b;
}
export function createEnergyEconomy(p,e,inputs,{seed='econ-1',scenario='E0',trace=false,fusionFuelSensitivityU=null,disableGovernmentPower=false}={}){
 if(!ENERGY_SCENARIOS.includes(scenario))throw Error('Unknown energy scenario');
 if(e.fusionNormalHydrogenU!==2.5)throw Error('Normal fusion contract is fixed at 2.5 U/month');
 if(fusionFuelSensitivityU!==null&&![.5,1,2.5].includes(fusionFuelSensitivityU))throw Error('Invalid explicit fuel sensitivity arm');
 if(!inputs?.contract||!inputs?.planets)throw Error('Audited preset inputs required');
 const s={p,e,inputs,seed,scenario,disableGovernmentPower,fuelU:fusionFuelSensitivityU??2.5,sensitivity:fusionFuelSensitivityU!==null,book:new Ledger({trace}),planets:{},tech:industryExpectation(p),month:0,priceIndex:1,debtC:0,issuedC:0,burnedC:0,ships:[{kind:'support',completedMonth:0},{kind:'explorer',completedMonth:0},{kind:'explorer',completedMonth:0}],shipQueue:[],events:[],normalStarts:0,bootSubsteps:0};
 for(const id of ['earth','moon','mars'])initPlanet(s,id,inputs);
 s.initialGDP=sum(Object.values(s.planets).map(b=>b.gdp));s.realGDP=s.initialGDP;s.initialMoneyQ=s.book.sum(k=>k.endsWith('/C'));
 s.moneyQ=s.initialMoneyQ;s.previousGDP=s.realGDP;
 // The 8.12 TW includes existing explicitly modelled industry and H plants.
 const earth=s.planets.earth;earth.baselineIndustrialGWh=sum(earth.assets.filter(a=>a.kind==='industry').map(a=>industryPlan(s,earth,a,0).energyGWh))+sum(earth.assets.filter(a=>a.kind==='electrolyzer').map(a=>a.capacityU*e.electrolysisGWhPerU));
 if(earth.baselineIndustrialGWh>=e.earthBaseGW*730)throw Error('Detailed baseline exceeds observed system demand');
 for(const b of Object.values(s.planets)){
  b.initialExplicitUpkeepU=sum(b.assets.map(a=>upkeepBill(a,{...e,month:0}).alloyU));
  const industry=b.assets.find(a=>a.kind==='industry');b.privateCapitalU=industry?industry.alloyBasisU*p.privateDepreciation/12:0;
  b.backgroundAlloyU=Math.max(0,b.initialGeneralAlloyU-b.initialExplicitUpkeepU-b.privateCapitalU);
 }
 // A finite, priced opening maintenance shipment supports the tiny pre-existing
 // settlements. It is debited from Earth's fixed 10,000 U, not replenished.
 transportGrant(s,'moon',0,250,0);transportGrant(s,'mars',0,80,0);
 if(['E2','E4','E8','S4'].includes(scenario)){
  transportGrant(s,'moon',scenario==='E4'?35000:24000,scenario==='E4'?3000:2100,30);transportGrant(s,'mars',15000,1400,20);
 }
 if(scenario==='E4')s.planets.moon.assets.find(a=>a.kind==='legacyGrid').capacityGW=0;
 s.initialLocalStocks=Object.fromEntries(Object.values(s.planets).map(b=>[b.id,{governmentAlloyU:stock(s,b.id,'government','alloy'),privateAlloyU:stock(s,b.id,'private','alloy'),governmentHydrogenU:stock(s,b.id,'government','hydrogen')}]));
 return s;
}
function transportGrant(s,to,c,alloyU,hydrogenU){
 const source=s.planets.earth,target=s.planets[to],freight=alloyU*s.e.freightCPerU;
 const amt=Math.min(c,stock(s,'earth','government','C'));
 if(amt)s.book.move(account('earth','government'),account(to,'government'),q(amt),'explicit-financial-grant');
 for(const [resource,u]of [['alloy',alloyU],['hydrogen',hydrogenU]]){
  const n=Math.min(q(u),s.book.get(account('earth','government',resource)));if(n)s.book.move(account('earth','government',resource),account(to,'government',resource),n,'explicit-finite-shipment');
 }
 pay(s,'earth','government','household',freight,'freight');s.events.push({month:s.month,event:'finite-shipment',from:source.id,to:target.id,alloyU,hydrogenU,creditC:amt,freightC:freight});
}
function borrow(s,b,amount){const n=Math.min(q(Math.max(0,amount)),s.book.get(account(b.id,'household')));if(n){s.book.move(account(b.id,'household'),account(b.id,'government'),n,'bond-subscription');s.debtC+=n/1000;b.flow.loanC+=n/1000;}return n/1000;}
function issue(s,planet,owner,c,tag){if(c<=0)return;s.book.source(account(planet,owner),q(c),tag);s.issuedC+=q(c)/1000;}
function constructionPurchase(s,b,owner,{creditC,alloyU,hydrogenU=0},tag){
 // No partial material payment or free foundation: all three budgets must be
 // present before the atomic order. Government may buy local private stock.
 const extraAlloy=Math.max(0,alloyU-stock(s,b.id,owner,'alloy')),extraH=Math.max(0,hydrogenU-stock(s,b.id,owner,'hydrogen'));
 const totalC=creditC+(extraAlloy*b.alloyPrice+extraH*b.hydrogenPrice)*s.priceIndex;
 if(stock(s,b.id,owner,'C')<totalC||stock(s,b.id,owner,'alloy')+(owner==='government'?stock(s,b.id,'private','alloy'):0)<alloyU||stock(s,b.id,owner,'hydrogen')+(owner==='government'?stock(s,b.id,'private','hydrogen'):0)<hydrogenU)return false;
 ensureStock(s,b,owner,'alloy',alloyU);ensureStock(s,b,owner,'hydrogen',hydrogenU);
 pay(s,b.id,owner,'household',creditC,'construction:'+tag);consume(s,b.id,owner,'alloy',alloyU,'construction-alloy');consume(s,b.id,owner,'hydrogen',hydrogenU,'construction-hydrogen');
 b.flow.constructionC+=creditC;b.flow.constructionAlloyU+=alloyU;b.flow.constructionHydrogenU+=hydrogenU;return true;
}
export function orderPowerComplex(s,planet,type,modules=1){
 const b=s.planets[planet],e=s.e,def=POWER_TYPES[type];if(!def||modules<1||modules>def.maxModules||!Number.isInteger(modules))throw Error('Invalid power complex');
 if(s.disableGovernmentPower)return null;
 const quote=constructionQuote({type,part:'base',costs:e.costs,startMonth:s.month,jobs:b.jobs,experience:b.experience,surcharge:e.parallelSurcharge,learning:e.learning});
 if(!constructionPurchase(s,b,'government',quote,type+'-base'))return null;
 const complex={id:planet+'-complex-'+b.complexes.length,owner:'government',type,foundationEnd:quote.endMonth,modules:[],wanted:modules,foundationPaid:true};b.complexes.push(complex);
 addAsset(b,{kind:'powerBase',owner:'government',type,complexId:complex.id,state:'construction',completedMonth:quote.endMonth,creditBasisC:e.costs[type].base.creditC,alloyBasisU:e.costs[type].base.alloyU});
 b.jobs.push({...quote,complexId:complex.id,part:'base'});s.events.push({month:s.month,event:'base-ordered',planet,type,complexId:complex.id,overlap:quote.overlap,factor:quote.factor});return complex;
}
function orderPowerModule(s,b,c){
 const def=POWER_TYPES[c.type];if(c.modules.length>=def.maxModules||c.modules.length>=c.wanted||s.month<c.foundationEnd)return false;
 const quote=constructionQuote({type:c.type,costs:s.e.costs,startMonth:s.month,jobs:b.jobs,experience:b.experience,surcharge:s.e.parallelSurcharge,learning:s.e.learning});
 if(!constructionPurchase(s,b,'government',quote,c.type+'-module'))return false;
 const a=addAsset(b,{kind:'powerModule',owner:'government',type:c.type,complexId:c.id,state:'construction',completedMonth:quote.endMonth,creditBasisC:s.e.costs[c.type].module.creditC,alloyBasisU:s.e.costs[c.type].module.alloyU,progressHours:0,startPaid:false,starts:0});
 c.modules.push(a.id);b.jobs.push({...quote,part:'module',complexId:c.id});s.events.push({month:s.month,event:'module-ordered',planet:b.id,type:c.type,overlap:quote.overlap,factor:quote.factor});return true;
}
export function orderIndustry(s,b,owner,sets=1){
 if(owner==='government'&&sets!==1)throw Error('Government industry uses one fixed mining/smelting pair');
 const permitDelay=owner==='private'?Math.max(0,s.p.expansionDelayMonths-FACILITY_TYPES[SMELTING].months):0;
 const a=industryAsset(b,owner,sets,s.month+permitDelay+FACILITY_TYPES[MINING].months,s.e,{mineRatio:owner==='private'?s.e.mineRatio:1});
 const cost={creditC:a.creditBasisC,alloyU:a.alloyBasisU,hydrogenU:a.hydrogenU};
 const overlap=b.jobs.filter(j=>j.startMonth<=s.month&&j.endMonth>s.month).length;
 if(owner==='government')cost.creditC*=1+s.e.parallelSurcharge*overlap/(1+s.e.learning*Math.sqrt(b.experience));
 if(!constructionPurchase(s,b,owner,cost,'industry')){b.assets.pop();return false;}
 b.jobs.push({startMonth:s.month,endMonth:a.smeltCompletedMonth,part:'industry',owner});if(owner==='private')b.flow.privateExpansionSets+=sets;return true;
}
export function orderHydrogen(s,b,owner,modules=1){
 if(!b.reference.waterHostTile||!b.assets.some(a=>a.kind==='industry'&&a.owner===owner&&a.completedMonth<=s.month))return false;
 modules=Math.max(1,Math.ceil(modules));const e=s.e,cost={creditC:e.hydrogenModuleC*modules,alloyU:e.hydrogenModuleAlloyU*modules};
 if(!constructionPurchase(s,b,owner,cost,'hydrogen'))return false;
 addAsset(b,{kind:'electrolyzer',owner,modules,hostTile:b.reference.waterHostTile,completedMonth:s.month+e.hydrogenLagMonths,state:'construction',capacityU:e.hydrogenModuleU*modules,creditBasisC:cost.creditC,alloyBasisU:cost.alloyU});b.flow.hydrogenConstructionC+=cost.creditC;return true;
}
function orderStorage(s,b){
 const e=s.e;if(b.storage)return false;const cost={creditC:e.storageC,alloyU:e.storageAlloyU};if(!constructionPurchase(s,b,'government',cost,'storage'))return false;
 const asset=addAsset(b,{kind:'storage',owner:'government',completedMonth:s.month+1,state:'construction',creditBasisC:cost.creditC,alloyBasisU:cost.alloyU});b.storage={assetId:asset.id,socGWh:0,capacityGWh:e.storageGWh,rateGW:e.storageGW};return true;
}
function scenarioEvents(s){
 const m=s.month,b=s.planets.earth,c=s.scenario;
 if(m===0&&['S1','S1-sell','S2','S3-debt','S3-money','S4','E0','E1','E3','E4','E5','E6','E7'].includes(c))orderIndustry(s,b,'government');
 if(['S1','S1-sell','S2','S3-debt','S3-money','S4'].includes(c)&&m>0&&m%24===0)orderIndustry(s,b,'government');
 if(c==='E1'&&[0,36,72].includes(m))orderPowerComplex(s,'earth',m===36?'solar':m===72?'fission':'fusion',m===0?4:2);
 if(c==='E3'&&m===36)orderPowerComplex(s,'earth','fission',8);
 if(c==='E4'&&m===0){orderPowerComplex(s,'earth','fusion',8);orderPowerComplex(s,'moon','fusion',1);}
 if(c==='E6'&&m===0)orderPowerComplex(s,'earth','fusion',2);
 if(c==='E7'&&[0,48].includes(m)){borrow(s,b,250000);for(let i=0;i<6;i++)orderPowerComplex(s,'earth',['fusion','fission','solar'][i%3],4);}
 if(['E2','E8'].includes(c)&&m===0){for(const id of ['moon','mars']){orderPowerComplex(s,id,'solar',1);orderStorage(s,s.planets[id]);}orderPowerComplex(s,'moon','fission',1);}
 if(c==='E2'&&m===60)orderPowerComplex(s,'mars','fission',1);
 if(c==='S4'&&m>0&&m%s.p.colonyBuildEveryMonths===0){transportGrant(s,m%48?'moon':'mars',5000,500,10);orderIndustry(s,s.planets[m%48?'moon':'mars'],'government');}
 for(const planet of Object.values(s.planets)){
  for(const a of planet.assets){
   if(a.state==='construction'&&a.completedMonth<=m){a.state=a.kind==='powerModule'&&a.type==='fusion'?'coldStopped':'active';planet.experience++;}
   if(c==='E6'&&a.owner==='government'&&a.completedMonth<=m){if(m===48){a.state=a.kind==='powerModule'&&a.type==='fusion'?'coldStopped':'paused';a.startPaid=false;a.progressHours=0;}if(m===60)a.state=a.kind==='powerModule'&&a.type==='fusion'?'coldStopped':'active';}
  }
  for(const complex of planet.complexes){while(complex.modules.length<complex.wanted&&orderPowerModule(s,planet,complex)){} }
 }
 if(c==='E5'&&m===60){
  // Actual military material consumption and no fictitious sale receipts.
  for(const owner of ['government','private'])consume(s,'earth',owner,'alloy',stock(s,'earth',owner,'alloy')*.99,'stress-physical-requisition');
 }
}
function upkeep(s,b){
 const e=s.e;for(const a of b.assets){
  if(a.completedMonth>s.month)continue;
  const billAsset=a.kind==='industry'&&a.smeltCompletedMonth>s.month?{...a,alloyBasisU:a.mineAlloyU,creditBasisC:a.mineCreditC}:a;
  const bill=upkeepBill(billAsset,{...e,month:s.month}),kind=a.kind,ownBefore=stock(s,b.id,a.owner,'alloy');bill.alloyU=q(bill.alloyU)/1000;
  ensureStock(s,b,a.owner,'alloy',bill.alloyU);
  const paid=consume(s,b.id,a.owner,'alloy',bill.alloyU,'alloy-upkeep:'+kind),short=Math.max(0,bill.alloyU-paid);
  a.backlogU+=short;a.health=Math.max(.1,a.health-short/Math.max(.001,bill.alloyU)*e.damagePerMonth);
  let repair=0,repairC=0;
  if(!short&&a.backlogU>0){const possible=Math.min(a.backlogU,bill.alloyU*e.repairRate);ensureStock(s,b,a.owner,'alloy',possible);repair=Math.min(possible,stock(s,b.id,a.owner,'alloy'),stock(s,b.id,a.owner,'C')/e.repairCPerU);if(repair>0){repair=consume(s,b.id,a.owner,'alloy',repair,'alloy-repair');repairC=pay(s,b.id,a.owner,'household',repair*e.repairCPerU,'repair-labour');a.backlogU=Math.max(0,a.backlogU-repair);a.health=Math.min(1,a.health+repair/Math.max(.001,bill.alloyU)*e.damagePerMonth);}}
  const cash=pay(s,b.id,a.owner,'household',bill.directC*s.priceIndex,'wages-admin:'+kind);a.cashFraction=bill.directC?clamp(cash/(bill.directC*s.priceIndex)):1;
  b.flow.upkeepRequiredU+=bill.alloyU;b.flow.upkeepPaidU+=paid;b.flow.directC+=cash;b.flow.repairU+=repair;b.flow.repairC+=repairC;b.flow.healthMin=Math.min(b.flow.healthMin,a.health);
  const k=b.flow.maintenanceByKind[kind]??={requiredU:0,paidU:0,directC:0,pausedRequiredU:0};k.requiredU+=bill.alloyU;k.paidU+=paid;k.directC+=cash;if(['paused','coldStopped'].includes(a.state))k.pausedRequiredU+=bill.alloyU;
  if(['powerBase','powerModule','legacyGrid','storage'].includes(kind)){b.flow.powerDirectC+=cash;b.flow.powerUpkeepU+=paid;}
  if(a.owner==='government'&&['powerBase','powerModule','storage'].includes(kind)){b.flow.governmentPowerDirectC+=cash;b.flow.governmentPowerUpkeepU+=paid;}
  if(a.owner==='government'&&kind==='industry'){b.flow.governmentIndustryDirectC+=cash;b.flow.governmentIndustryUpkeepU+=paid;}
  if(kind==='electrolyzer'){b.flow.hydrogenDirectC+=cash;b.flow.hydrogenUpkeepU+=paid;}
  // Own stock is a material cost, never an invented cash debit. Acquisition
  // money appears only in the atomic purchase above.
  a.lastOwnUpkeepU=Math.min(ownBefore,paid);a.lastBill=bill;
 }
}
function industryPlan(s,b,a,m,budgets=null){
 const e=s.e,p=s.p,cap=industryCapacity({sets:a.sets,completedMonth:a.completedMonth,month:m,difficulty:p.difficulty,processingDifficulty:p.processingDifficulty,mineRatio:a.mineRatio});
 const smeltCap=industryCapacity({sets:a.sets,completedMonth:a.smeltCompletedMonth,month:m,difficulty:p.difficulty,processingDifficulty:p.processingDifficulty,mineRatio:a.mineRatio});cap.processU=smeltCap.processU;
 let factor=a.health*(a.cashFraction??1);
 if(a.state==='construction'||a.state==='paused'||(s.scenario==='E5'&&m>=60&&m<84))factor=0;
 const mineU=cap.mineU*factor,baseProcess=cap.processU*factor,oreAvailable=mineU+(budgets?.ore[a.owner]??stock(s,b.id,a.owner,'ore'));
 const boostUseful=oreAvailable>baseProcess&&baseProcess*s.inputs.contract.smeltBoost*s.tech.yieldFraction*b.alloyPrice>s.inputs.contract.smeltHydrogenU*a.sets*b.hydrogenPrice;
 const maxH=s.inputs.contract.smeltHydrogenU*a.sets*smeltCap.ramp*factor;
 const work=assistedSmelting({oreU:oreAvailable,baseProcessU:baseProcess,rawWorkU:FACILITY_TYPES[SMELTING].capacityU*a.sets*smeltCap.ramp*factor,maxHydrogenU:maxH,availableHydrogenU:budgets?.hydrogen[a.owner]??stock(s,b.id,a.owner,'hydrogen'),boost:s.inputs.contract.smeltBoost,enabled:boostUseful});
 const {processU,hydrogenU,desiredHydrogenU}=work,alloyU=processU*s.tech.yieldFraction;
 const energyGWh=mineU*10*e.mineMWhPerT/1000+processU*10*e.feedMWhPerT/1000+alloyU*10*alloyElectricityMWhPerT(e.industryMix)/1000+(a.completedMonth>m?0:a.sets*e.industryFixedMW*730/1000*(a.state==='paused'?.05:1));
 if(budgets){budgets.ore[a.owner]=oreAvailable-processU;budgets.hydrogen[a.owner]=Math.max(0,budgets.hydrogen[a.owner]-hydrogenU);}
 return {asset:a,mineU,processU,alloyU,hydrogenU,desiredHydrogenU,energyGWh,baseProcess};
}
function industryPlans(s,b,m){const budgets={ore:{government:stock(s,b.id,'government','ore'),private:stock(s,b.id,'private','ore')},hydrogen:{government:stock(s,b.id,'government','hydrogen'),private:stock(s,b.id,'private','hydrogen')}};return b.assets.filter(a=>a.kind==='industry').map(a=>industryPlan(s,b,a,m,budgets));}
function mergeMaturePrivateCohorts(b,m){
 const eligible=b.assets.filter(a=>a.kind==='industry'&&a.owner==='private'&&a.smeltCompletedMonth<m-12&&a.health===1&&a.backlogU===0&&a.state==='active');
 if(eligible.length<2)return;const first=eligible[0],ids=new Set(eligible.slice(1).map(a=>a.id));
 for(const a of eligible.slice(1))for(const k of ['sets','creditBasisC','alloyBasisU','mineCreditC','mineAlloyU'])first[k]+=a[k];
 first.completedMonth=-100;first.smeltCompletedMonth=-100;b.assets=b.assets.filter(a=>!ids.has(a.id));
}
function solarFactor(s,b,m){let cf=s.e.solarEarthCF;if(b.id==='moon')cf*=s.e.solarMoonMultiplier;if(b.id==='mars')cf*=s.e.solarMarsMultiplier;if(s.scenario==='E8'&&m>=36&&m<108)cf*=.25;return cf;}
function openingHydrogenPurchases(s,b,plans){
 b.hydrogenDesiredUseU=0;
 for(const owner of ['government','private']){
  const industryH=sum(plans.filter(p=>p.asset.owner===owner).map(p=>p.desiredHydrogenU));
  const modules=b.assets.filter(a=>a.owner===owner&&a.kind==='powerModule'&&a.type==='fusion'&&a.completedMonth<=s.month);
  const need=industryH+sum(modules.map(a=>['coldStopped','starting'].includes(a.state)?Math.max(0,5-a.progressHours*5/96):s.fuelU));
  if(owner==='government')b.hydrogenGovernmentReservationU=need;
  purchase(s,b,owner,'hydrogen',Math.max(0,need-stock(s,b.id,owner,'hydrogen')));
  b.hydrogenDesiredUseU+=need;
  // This is an unfilled opening order, not consumed H minus closing stock.
  b.flow.hydrogenUnmetU+=Math.max(0,need-stock(s,b.id,owner,'hydrogen'));
 }
}
function monthlyPower(s,b,plans){
 const e=s.e,m=s.month,pe=b.id==='earth',hours=730;
 const grow=b.potentialGDP/s.p.bodies[b.id].annualGDP;
 let background=pe?Math.max(0,e.earthBaseGW*730-b.baselineIndustrialGWh)*Math.pow(grow,e.electricDemandGDPExponent):b.population*e.colonyKWPerPerson/1e6*730;
 let existingFactor=1;const peakEvent=s.scenario==='E3'&&m>=48&&m<60&&pe,peakRatio=e.peakGW/e.earthBaseGW;
 if(peakEvent){background*=.75+.25*peakRatio;existingFactor=.9;}
 if(['E2','E8'].includes(s.scenario)&&!pe&&m>=36&&m<60)existingFactor=.65;
 const legacy=b.assets.find(a=>a.kind==='legacyGrid'),legacyGWh=legacy.capacityGW*730*existingFactor*legacy.health*(legacy.cashFraction??1);
 const privateExpansions=b.assets.filter(a=>a.kind==='privateGridExpansion'&&a.completedMonth<=m&&a.state!=='paused');
 const privateNewGWh=sum(privateExpansions.map(a=>a.capacityGW*730*e.fissionAvailability*a.health*(a.cashFraction??1)));
 let supply=legacyGWh+privateNewGWh,governmentGWh=0,startInput=0,startGeneration=0,normalFusionH=0;
 const completed=b.assets.filter(a=>a.kind==='powerModule'&&a.completedMonth<=m&&!['paused','construction'].includes(a.state));
 const fusionHReserved={government:sum(plans.filter(x=>x.asset.owner==='government').map(x=>x.hydrogenU)),private:sum(plans.filter(x=>x.asset.owner==='private').map(x=>x.hydrogenU))};
 // Normal fuel is reserved before starts; no two modules can spend the same H.
 for(const a of completed.filter(a=>a.type==='fusion'&&['active','curtailed'].includes(a.state))){
  if(s.scenario==='E6'&&m>=48&&m<60)continue;
  const available=Math.max(0,stock(s,b.id,a.owner,'hydrogen')-fusionHReserved[a.owner]);
  const r=dispatchFusion({requestedGWh:5*730*a.health,availableHydrogenU:available,minimumFraction:e.fusionMinimumFraction,normalHydrogenU:s.fuelU});
  a.state=r.state;if(r.state==='coldStopped'){a.startPaid=false;a.progressHours=0;continue;}
  fusionHReserved[a.owner]+=r.hydrogenU;a.provisionalGWh=r.energyGWh;a.normalHours=730;
 }
 for(const a of completed.filter(a=>a.type!=='fusion')){const r=POWER_TYPES[a.type].ratedGW*730*a.health*(a.cashFraction??1)*(a.type==='solar'?solarFactor(s,b,m):e.fissionAvailability);a.provisionalGWh=r;}
 const regularGovernment=sum(completed.map(a=>a.provisionalGWh??0));
 const externalSupply=supply+regularGovernment;
 let startupExternalRemaining=Math.max(0,externalSupply-background);
 for(const a of completed.filter(a=>a.type==='fusion'&&['coldStopped','starting'].includes(a.state))){
  if(s.scenario==='E6'&&m>=48&&m<60)continue;
  if(!a.startPaid){if(stock(s,b.id,a.owner,'C')<2500)continue;const c=pay(s,b.id,a.owner,'household',2500,'fusion-start-labour');b.flow.startC+=c;a.startPaid=true;a.starts++;s.normalStarts++;s.events.push({month:m,event:'fusion-start',planet:b.id,asset:a.id,number:a.starts});}
  a.state='starting';let wall=730,normalHours=0,steps=0;
  // At most four startup progress windows per successful boot. The external
  // instantaneous allocation is limited as well as its monthly energy budget.
  while(wall>1e-8&&a.progressHours<96-1e-8&&steps<32){
   const dt=Math.min(24,wall,96-a.progressHours),available=Math.max(0,stock(s,b.id,a.owner,'hydrogen')-fusionHReserved[a.owner]);
   const stableSurplusGW=Math.max(0,(externalSupply-background)/730);
   const input=Math.min(startupExternalRemaining,stableSurplusGW*dt);
   const provisional=advanceFusionStart({progressHours:a.progressHours,wallHours:dt,externalGWh:input,hydrogenU:available});
   // Fund startup progress with whole material quanta. Sub-quantum resources
   // cannot be spent repeatedly while the same H remains in the account.
   const fundedH=Math.floor(provisional.hydrogenU*1000+1e-7)/1000;
   const r=advanceFusionStart({progressHours:a.progressHours,wallHours:dt,externalGWh:input,hydrogenU:fundedH});
   a.progressHours=r.progressHours;startInput+=r.inputGWh;startGeneration+=r.generationGWh;startupExternalRemaining-=r.inputGWh;
   const used=consume(s,b.id,a.owner,'hydrogen',r.hydrogenU,'fusion-start-hydrogen');b.flow.startHydrogenU+=used;b.flow.hydrogenUsedU+=used;
   s.bootSubsteps++;steps++;wall-=dt;if(r.advancedHours<1e-9)break;
   if(r.completed){a.state='active';normalHours=wall;break;}
  }
  if(normalHours>0){const available=Math.max(0,stock(s,b.id,a.owner,'hydrogen')-fusionHReserved[a.owner]),r=dispatchFusion({requestedGWh:5*normalHours*a.health,hours:normalHours,availableHydrogenU:available,minimumFraction:e.fusionMinimumFraction,normalHydrogenU:s.fuelU});a.state=r.state;a.provisionalGWh=r.energyGWh;a.normalHours=normalHours;fusionHReserved[a.owner]+=r.hydrogenU;if(r.state==='coldStopped'){a.startPaid=false;a.progressHours=0;}}
 }
 // Newly started normal operation is included; startup output cannot start
 // itself/another reactor in this settlement, but can supply end-use loads.
 governmentGWh=sum(completed.map(a=>a.provisionalGWh??0))+startGeneration;
 supply+=governmentGWh;
 const industrial=sum(plans.map(p=>p.energyGWh));
 const electrolyzers=b.assets.filter(a=>a.kind==='electrolyzer'&&a.completedMonth<=m&&a.state!=='paused');
 const hPlans=electrolyzers.map(a=>{
  const eligible=b.reference.waterTiles.includes(a.hostTile),target=b.hydrogenTargetU||e.hydrogenModuleU*3;
  const deficit=Math.max(0,target-stock(s,b.id,a.owner,'hydrogen'));
  const margin=b.hydrogenPrice-(e.electrolysisGWhPerU*b.powerPriceC+s.e.hydrogenVariableCPerU);
  let units=eligible&&margin>0?Math.min(a.capacityU*a.health*(a.cashFraction??1),deficit+(b.hydrogenDesiredUseU??0), e.waterIntakeU/9):0;
  if(!Number.isFinite(units))units=0;if(s.scenario==='E4'&&m>=48&&m<84)units=0;
  return {asset:a,units,energyGWh:units*e.electrolysisGWhPerU};
 });
 const electrolysis=sum(hPlans.map(p=>p.energyGWh)),demand=background+industrial+electrolysis+startInput;
 const storageAsset=b.storage&&b.assets.find(a=>a.id===b.storage.assetId),storageEnabled=storageAsset&&storageAsset.completedMonth<=m&&storageAsset.state!=='paused';
 // Monthly averages cannot represent lunar nights. A two-block clear/night
 // dispatch is used for colony solar/storage; every block conserves energy.
 const split=!pe&&completed.some(a=>a.type==='solar');
 const blockHours=[];
 if(split&&storageEnabled&&b.id==='mars'){
  // A Martian night is about 12.33h, not half a month. Integrate representative
  // sol day/night events; the final partial sol keeps the month exactly730h.
  let left=730;while(left>1e-8){const h=Math.min(12.33,left);blockHours.push(h);left-=h;}
 }else if(split)blockHours.push(365,365);
 else if(peakEvent)blockHours.push(182.5,547.5);
 else blockHours.push(730);
 const dayHours=sum(blockHours.filter((_,i)=>i%2===0));
 let served=0,curtailed=0,charge=0,discharge=0,loss=0,usedSupply=0;
 const solarGWh=sum(completed.filter(a=>a.type==='solar').map(a=>a.provisionalGWh??0));
 for(let k=0;k<blockHours.length;k++){
  const fraction=blockHours[k]/730;
  const blockSupply=split?(supply-solarGWh)*fraction+(k%2===0?solarGWh*blockHours[k]/dayHours:0):supply*fraction;
  const blockDemand=peakEvent?background*fraction*(k===0?peakRatio:1)/(.75+.25*peakRatio)+(industrial+electrolysis+startInput)*fraction:demand*fraction;
  let st={chargeGWh:0,dischargeGWh:0,lossGWh:0};
  if(storageEnabled){st=balanceStorage({...b.storage,efficiency:e.storageEfficiency,supplyGWh:blockSupply,demandGWh:blockDemand,hours:730*fraction});b.storage.socGWh=st.socGWh;}
  const available=blockSupply+st.dischargeGWh-st.chargeGWh,delivered=Math.min(available,blockDemand),excess=Math.max(0,available-blockDemand);
  const genK=q(blockSupply,1e6),disK=q(st.dischargeGWh,1e6),chargeK=q(st.chargeGWh,1e6),servedK=Math.min(genK+disK-chargeK,q(delivered,1e6));
  energyAudit({generationKWh:genK,dischargeKWh:disK,servedKWh:servedK,chargeKWh:chargeK,curtailedKWh:genK+disK-chargeK-servedK});
  served+=delivered;curtailed+=excess;charge+=st.chargeGWh;discharge+=st.dischargeGWh;loss+=st.lossGWh;usedSupply+=blockSupply-excess;
 }
 // Boot input was reserved out of external supply above; priority then protects
 // basic cities/life support. Remaining industrial/H loads share one grid.
 const usable=Math.max(0,served-startInput),essential=Math.min(background*e.essentialShare,usable),remaining=Math.max(0,usable-essential);
 const optionalCity=background*(1-e.essentialShare),other=optionalCity+industrial+electrolysis;
 let ratio=other?clamp(remaining/other):1,industryRatio=ratio;
 if(e.dispatchPolicy==='industryFirst'){industryRatio=industrial+electrolysis?clamp(remaining/(industrial+electrolysis)):1;ratio=optionalCity?clamp((remaining-(industrial+electrolysis)*industryRatio)/optionalCity):1;}
 b.cityUtilization=background?clamp((essential+optionalCity*ratio)/background):1;
 // Settlement curtails actual generation and fuel together. Startup was fixed
 // by progress already and is never retroactively erased by curtailment.
 const dispatchRatio=supply>0?clamp((usedSupply-startGeneration)/(supply-startGeneration||1)):0;
 b.flow.powerFuelC+=pay(s,b.id,'private','household',privateNewGWh*dispatchRatio*e.fissionFuelCPerGWh*s.priceIndex,'private-fission-fuel-services');
 let actualGovernment=startGeneration;
 for(const a of completed){
  const actual=(a.provisionalGWh??0)*dispatchRatio;a.actualGWh=actual;actualGovernment+=actual;
  if(a.type==='fusion'&&(a.provisionalGWh??0)>0){
   const sustainingGWh=5*(a.normalHours??730)*e.fusionMinimumFraction,fuelOutput=Math.max(actual,sustainingGWh);
   // A running reactor can hold its minimum output and spill unused power.
   // Curtailment does not charge a restart, and sustaining fuel is not free.
   const fuel=consume(s,b.id,a.owner,'hydrogen',fuelOutput/3650*s.fuelU,'fusion-normal-hydrogen');normalFusionH+=fuel;b.flow.hydrogenUsedU+=fuel;a.state=actual<(a.provisionalGWh??0)-1e-8?'curtailed':'active';
  }
  a.lastUtilization=actual/(POWER_TYPES[a.type].ratedGW*730);
  if(a.type==='fission')b.flow.powerFuelC+=pay(s,b.id,a.owner,'household',actual*e.fissionFuelCPerGWh*s.priceIndex,'fission-fuel-services');
  delete a.provisionalGWh;
 }
 b.flow.normalHydrogenU+=normalFusionH;
 // Consumer-to-utility payments are existing GDP expenditure, not new GDP.
 const tariff=b.powerPriceC*s.priceIndex,cityServed=background*b.cityUtilization;
 pay(s,b.id,'household','private',cityServed*tariff,'existing-city-electric-bill');
 const govIndustry=sum(plans.filter(p=>p.asset.owner==='government').map(p=>p.energyGWh))*industryRatio,privateIndustry=sum(plans.filter(p=>p.asset.owner==='private').map(p=>p.energyGWh))*industryRatio;
 const totalDelivered=Math.max(1e-9,served),governmentShare=clamp(actualGovernment/totalDelivered),govSelf=govIndustry*governmentShare;
 const exported=Math.min(actualGovernment-govSelf,cityServed+privateIndustry+electrolysis*industryRatio),govBought=Math.max(0,govIndustry-govSelf);
 const sales=pay(s,b.id,'private','government',Math.max(0,exported)*tariff,'government-external-electric-sale');
 b.flow.governmentPowerPurchaseC+=pay(s,b.id,'government','private',govBought*tariff,'government-electric-purchase');
 b.flow.powerUnpaidC+=Math.max(0,Math.max(0,exported)*tariff-sales)+Math.max(0,govBought*tariff-b.flow.governmentPowerPurchaseC);
 b.flow.governmentExternalSalesC+=sales;b.flow.powerSalesC+=sales;b.flow.governmentPowerGWh+=actualGovernment;
 b.flow.generationGWh+=supply;b.flow.demandGWh+=demand;b.flow.servedGWh+=served;b.flow.unservedGWh+=Math.max(0,demand-served);
 b.flow.startInputGWh+=startInput;b.flow.startGenerationGWh+=startGeneration;b.flow.industryDemandGWh+=industrial;b.flow.industryServedGWh+=industrial*industryRatio;
 b.flow.storageChargeGWh+=charge;b.flow.storageDischargeGWh+=discharge;b.flow.storageLossGWh+=loss;b.flow.curtailedGWh+=curtailed;
 b.reserveFraction=demand?(supply-demand)/demand:0;b.industryUtilization=industryRatio;
 return {industryRatio,hPlans,hydrogenRatio:industryRatio};
}
function produce(s,b,plans,dispatch){
 const e=s.e,m=s.month,newHydrogen=[];
 for(const plan of plans){
  const a=plan.asset,r=dispatch.industryRatio,ground=account(b.id,'ground','ore'),mined=Math.min(q(plan.mineU*r),s.book.get(ground));
  if(mined)s.book.move(ground,account(b.id,a.owner,'ore'),mined,'ore-extraction');
  const processed=Math.min(q(plan.processU*r),s.book.get(account(b.id,a.owner,'ore'))),alloy=Math.floor(processed*s.tech.yieldFraction),residue=processed-alloy;
  if(processed){s.book.sink(account(b.id,a.owner,'ore'),processed,'smelting-ore');s.book.source(account(b.id,a.owner,'alloy'),alloy,'smelting-alloy');s.book.source(account(b.id,a.owner,'residue'),residue,'smelting-residue');}
  const hydrogen=consume(s,b.id,a.owner,'hydrogen',plan.hydrogenU*r,'smelting-hydrogen');b.flow.hydrogenUsedU+=hydrogen;
  b.flow.minedU+=mined/1000;b.flow.processedU+=processed/1000;b.flow.residueU+=residue/1000;b.flow.producedU+=alloy/1000;b.flow[a.owner==='government'?'governmentProducedU':'privateProducedU']+=alloy/1000;
  a.lastUtilization=plan.baseProcess>0?Math.min(1,processed/1000/plan.baseProcess):0;
  // Sources and facilities are explicitly co-located. One source is allocated
  // to a single owner, and all withdrawals use the same finite reserve account.
  const sources=b.reference.sources.filter(x=>x.oreEligible);
  const assigned=sources.filter((_,i)=>a.owner==='government'?i===0:i>0||!b.assets.some(x=>x.kind==='industry'&&x.owner==='government'&&x.completedMonth<=m));
  if(mined>0&&!(s.scenario==='E4'&&m>=48&&m<84))for(const source of assigned){
   if(newHydrogen.some(x=>x.sourceId===source.sourceId))continue;
   const u=s.inputs.contract.byproductMaximumU*Math.min(1,mined/1000/5000,a.sets),n=Math.min(q(u),s.book.get(account(b.id,'ground',source.sourceId)));
   if(n){s.book.sink(account(b.id,'ground',source.sourceId),n,'finite-hydrogen-recovery');newHydrogen.push({owner:a.owner,n,sourceId:source.sourceId});b.flow.hydrogenByproductU+=n/1000;}
  }
 }
 for(const h of dispatch.hPlans){
  const a=h.asset,requested=h.units*dispatch.hydrogenRatio,existingWater=stock(s,b.id,a.owner,'water'),intake=Math.min(e.waterIntakeU,Math.max(0,requested*9-existingWater));
  // Surface water is a declared finite per-month intake, not an ore/H deposit.
  if(b.reference.waterTiles.includes(a.hostTile)&&intake)s.book.source(account(b.id,a.owner,'water'),q(intake),'metered-surface-water-intake');
  const u=Math.min(requested,stock(s,b.id,a.owner,'water')/9),n=Math.min(q(u),Math.floor(s.book.get(account(b.id,a.owner,'water'))/9));a.lastUtilization=n/1000/Math.max(.001,a.capacityU);if(n){consume(s,b.id,a.owner,'water',n/1000*9,'electrolysis-water');s.book.source(account(b.id,a.owner,'oxygen'),n*8,'electrolysis-oxygen');newHydrogen.push({owner:a.owner,n,electrolysis:true});b.flow.hydrogenElectrolysisU+=n/1000;b.flow.electrolysisGWh+=n/1000*e.electrolysisGWhPerU;b.flow.hydrogenDirectC+=pay(s,b.id,a.owner,'household',n/1000*e.hydrogenVariableCPerU*s.priceIndex,'hydrogen-variable-services');}
 }
 // Closing-only H output. It cannot fuel this month's reactor boot or smelter.
 for(const h of newHydrogen){s.book.source(account(b.id,h.owner,'hydrogen'),h.n,h.electrolysis?'electrolysis-hydrogen':'byproduct-hydrogen');b.flow.hydrogenProducedU+=h.n/1000;}
 b.hydrogenLastUseU=b.flow.hydrogenUsedU;
}
function marketAndInvestment(s,b){
 const p=s.p,e=s.e,m=s.month,grow=b.gdp/p.bodies[b.id].annualGDP;
 let demand=b.backgroundAlloyU*grow*Math.pow(b.alloyPrice/p.baseAlloyPrice,-p.demandElasticity);
 if(s.scenario==='E5'&&m>=60&&m<84)demand*=3;
 b.flow.generalAlloyDemandU=demand;
 const available=stock(s,b.id,'private','alloy'),cash=stock(s,b.id,'household','C'),bought=Math.min(demand,available,cash/(b.alloyPrice*s.priceIndex));
 pay(s,b.id,'household','private',bought*b.alloyPrice*s.priceIndex,'general-alloy-demand');consume(s,b.id,'private','alloy',bought,'general-alloy-consumption');b.flow.generalAlloyConsumedU=bought;b.flow.unmetAlloyU=Math.max(0,demand-bought);
 if(s.scenario==='S1-sell'){
  const excess=Math.max(0,stock(s,b.id,'government','alloy')-p.initialAlloyU),n=Math.min(excess*.5,Math.max(0,b.alloyTargetU-stock(s,b.id,'private','alloy')));
  const sale=trade(s.book,{planet:b.id,from:'government',to:'private',resource:'alloy',amountU:n,priceC:b.alloyPrice*s.priceIndex,tag:'government-alloy-sale'});b.flow.governmentSoldU+=sale.amountU;b.flow.governmentSaleC+=sale.cashC;
 }
 const totalDemand=demand+b.flow.upkeepRequiredU+b.privateCapitalU*grow,inventory=stock(s,b.id,'private','alloy');
 b.alloyTargetU=totalDemand*p.inventoryDays/30;b.demandHistory.push(totalDemand);b.outputHistory.push(b.flow.privateProducedU);
 const gap=(b.alloyTargetU-inventory)/Math.max(1,b.alloyTargetU),price= b.alloyPrice*Math.exp(p.priceAdjustment*clamp(gap,-2,2)-p.priceReversion*Math.log(b.alloyPrice/p.baseAlloyPrice));
 // The numerical quote guard is not a scarcity cure. Unfilled U/GWh orders
 // and health losses remain explicit at any bounded price.
 b.alloyPrice=clamp(price,p.baseAlloyPrice*.05,p.baseAlloyPrice*20);
 const hstock=stock(s,b.id,'private','hydrogen')+stock(s,b.id,'government','hydrogen'),htarget=Math.max(10,(b.hydrogenDesiredUseU??0)*e.hydrogenInventoryMonths);
 b.hydrogenPrice=clamp(b.hydrogenPrice*Math.exp(e.hydrogenPriceAdjustment*clamp((htarget-hstock)/htarget,-2,2)-e.hydrogenPriceReversion*Math.log(b.hydrogenPrice/.4)),.02,40);
 b.hydrogenTargetU=htarget;
 // Endogenous electricity quote derives from existing GDP spending, not an
 // aluminium-heavy industrial load or an arbitrary scarcity target.
 b.powerPriceC=e.electricityGDPShare*p.bodies.earth.annualGDP/(e.earthBaseGW*8760)*Math.exp(e.powerScarcityElasticity*clamp(-b.reserveFraction,0,3));
 if(b.id==='earth'&&m%3===0){
  const cap=b.assets.filter(a=>a.kind==='industry'&&a.owner==='private').reduce((v,a)=>v+a.sets,0),output=Math.max(1,mean(b.outputHistory.slice(-p.privateForecastMonths))),recent=mean(b.demandHistory.slice(-p.privateForecastMonths));
  const creditBasisC=(FACILITY_TYPES[MINING].creditC*e.mineRatio+FACILITY_TYPES[SMELTING].creditC)*e.privateScale,alloyBasisU=(FACILITY_TYPES[MINING].alloyU*e.mineRatio+FACILITY_TYPES[SMELTING].alloyU)*e.privateScale;
  const investment=creditBasisC+alloyBasisU*b.alloyPrice+FACILITY_TYPES[SMELTING].hydrogenU*b.hydrogenPrice;
  const full=industryPlan(s,b,{sets:1,owner:'private',mineRatio:e.mineRatio,completedMonth:-100,smeltCompletedMonth:-100,health:1,state:'active'},m,{ore:{private:0},hydrogen:{private:Infinity}});
  const unitCost=explicitIndustryUnitCost({investmentC:investment,creditBasisC,alloyBasisU,outputU:full.alloyU,energyGWh:full.energyGWh,hydrogenU:full.hydrogenU,amortizationMonths:p.privateAmortizationYears*12,directAnnual:e.directAnnual,upkeepAnnual:e.upkeepAnnual,alloyPrice:b.alloyPrice,hydrogenPrice:b.hydrogenPrice,powerPrice:b.powerPriceC});
  b.industryUnitCostC=unitCost;
  const margin=Math.max(0,b.alloyPrice/unitCost-1-p.requiredMargin),inventoryGap=clamp((b.alloyTargetU-inventory)/Math.max(1,b.alloyTargetU),-1,1);
  const growth=p.expansionBeta*Math.max(0,margin+inventoryGap)+p.privateDepreciation/12;
  const sets=Math.min(cap*.03,cap*growth*3*Math.max(.25,recent/output));
  if(sets>.001)orderIndustry(s,b,'private',sets);
  const hCapacity=sum(b.assets.filter(a=>a.kind==='electrolyzer'&&a.owner==='private').map(a=>a.capacityU)),hCost=e.hydrogenModuleC/(p.privateAmortizationYears*12*e.hydrogenModuleU)+e.hydrogenModuleC*e.directAnnual/(12*e.hydrogenModuleU)+e.hydrogenModuleAlloyU*e.upkeepAnnual*b.alloyPrice/(12*e.hydrogenModuleU)+e.electrolysisGWhPerU*b.powerPriceC+e.hydrogenVariableCPerU;
  b.hydrogenUnitCostC=hCost;
  if(b.hydrogenPrice>hCost*(1+p.requiredMargin)&&b.hydrogenDesiredUseU>hCapacity)orderHydrogen(s,b,'private',Math.min(2,(b.hydrogenDesiredUseU-hCapacity)/e.hydrogenModuleU));
  const modules=POWER_TYPES.fission.maxModules,base=e.costs.fission.base,module=e.costs.fission.module,creditC=base.creditC+module.creditC*modules,alloyU=base.alloyU+module.alloyU*modules;
  const electricOutput=POWER_TYPES.fission.ratedGW*modules*e.fissionAvailability*730;
  const net=electricOutput*(b.powerPriceC-e.fissionFuelCPerGWh)-creditC*e.directAnnual/12-alloyU*e.upkeepAnnual*b.alloyPrice/12;
  const powerInvestment=creditC+alloyU*b.alloyPrice;
  const profitable=net>0&&powerInvestment/(net*12)<e.privatePowerHorizonYears;
  const pending=b.assets.some(a=>a.kind==='privateGridExpansion'&&a.completedMonth>m);
  if(b.reserveFraction<e.gridReserve*.6&&profitable&&!pending&&constructionPurchase(s,b,'private',{creditC,alloyU},'private-fission-grid')){
   addAsset(b,{kind:'privatePowerBase',owner:'private',completedMonth:m+e.costs.foundationMonths,state:'construction',creditBasisC:base.creditC,alloyBasisU:base.alloyU});
   addAsset(b,{kind:'privateGridExpansion',owner:'private',type:'fission',modules,capacityGW:POWER_TYPES.fission.ratedGW*modules,completedMonth:m+e.privatePowerLagMonths,state:'construction',creditBasisC:module.creditC*modules,alloyBasisU:module.alloyU*modules});
   s.events.push({month:m,event:'private-grid-investment',planet:b.id,modules,creditC,alloyU,expectedCashPaybackYears:powerInvestment/(net*12)});
  }
 }
}
function fiscal(s){
 const p=s.p,m=s.month,war=['S3-debt','S3-money'].includes(s.scenario)&&m>=p.warStartMonth&&m<p.warStartMonth+p.warDurationMonths;
 for(const b of Object.values(s.planets)){
  const tax=b.gdp*s.priceIndex*(b.id==='earth'?p.earthTaxRate:p.bodies[b.id].taxRate)/12,budget=tax*(war?p.warStrategyShare:p.strategyShare);
  // Tax and fixed civilian expenditure are separate paired transfers. Their
  // difference, not a fresh-money source, funds the discretionary treasury.
  let remaining=tax;for(const owner of ['household','private']){const paid=pay(s,b.id,owner,'government',remaining,'tax');remaining-=paid;}
  pay(s,b.id,'government','household',Math.max(0,tax-budget-remaining),'fixed-civilian-spending');b.flow.budgetC=budget;
 }
 const earth=s.planets.earth,interest=s.debtC*p.debtInterestRate/12;
 if(stock(s,'earth','government','C')<interest)borrow(s,earth,interest-stock(s,'earth','government','C'));
 earth.flow.mandatoryC+=pay(s,'earth','government','household',interest,'bond-interest');
 const support=p.colonySupportC*(s.scenario==='S4'?p.colonySupportMultiplier:1)/12;
 const allocated=Math.min(support,stock(s,'earth','government','C'));
 for(const [id,part]of [['moon',.8],['mars',.2]])if(allocated){s.book.move(account('earth','government'),account(id,'government'),q(allocated*part),'colony-financial-support');}
 earth.flow.mandatoryC+=allocated;
 if(war&&m<p.warStartMonth+p.warPurchaseMonths){
  const u=p.warAlloyU/p.warPurchaseMonths,cost=u*earth.alloyPrice*s.priceIndex;
  if(s.scenario==='S3-money')issue(s,'earth','government',cost*p.warMonetizationFraction,'explicit-war-issuance');else borrow(s,earth,Math.max(0,cost-stock(s,'earth','government','C')));
  purchase(s,earth,'government','alloy',u);earth.flow.warAlloyU+=consume(s,'earth','government','alloy',u,'war-procurement-consumption');
 }
 if(['S2','S3-debt','S3-money','S4'].includes(s.scenario)){
  const mature=s.ships.filter(x=>x.completedMonth<=m),cost=sum(mature.map(x=>ECON_SHIPS[x.kind].creditC))*p.shipMaintenanceRate/12;
  earth.flow.mandatoryC+=pay(s,'earth','government','household',cost*s.priceIndex,'ship-maintenance-services');
  if(s.shipQueue.filter(x=>x.completedMonth>m).length<p.shipyardSlots){const kind=s.ships.length%3===0?'support':'explorer',def=ECON_SHIPS[kind];if(constructionPurchase(s,earth,'government',{creditC:def.creditC*s.priceIndex,alloyU:def.alloyU},'ship')){const ship={kind,completedMonth:m+def.months};s.ships.push(ship);s.shipQueue.push(ship);earth.flow.shipOrders++;}}
 }
}
function accrueTotals(b){
 for(const [k,v]of Object.entries(b.flow))if(typeof v==='number'&&k!=='healthMin')b.total[k]+=v;
 b.total.healthMin=Math.min(b.total.healthMin,b.flow.healthMin);
 for(const [kind,v]of Object.entries(b.flow.maintenanceByKind)){const dst=b.total.maintenanceByKind[kind]??={requiredU:0,paidU:0,directC:0,pausedRequiredU:0};for(const k of Object.keys(v))dst[k]+=v[k];}
}
export function assertEnergyEconomy(s){
 s.book.audit();const money=s.book.sum(k=>k.endsWith('/C'));
 if(money!==s.initialMoneyQ+q(s.issuedC)-q(s.burnedC)||money!==s.moneyQ)throw Error('Money stock != ledger sum');
 const ore=s.book.turnover['smelting-ore']??0,alloy=s.book.turnover['smelting-alloy']??0,residue=s.book.turnover['smelting-residue']??0;
 if(ore!==alloy+residue)throw Error('Ore conversion mass balance');
 for(const b of Object.values(s.planets)){
  for(const a of b.assets)if(a.completedMonth<=s.month&&!(a.alloyBasisU>0))throw Error('Completed facility without alloy upkeep basis');
  if(b.storage&&(b.storage.socGWh< -1e-8||b.storage.socGWh>b.storage.capacityGWh+1e-8))throw Error('Storage SOC');
  if(b.flow.governmentSelfSalesC!==0)throw Error('Government self-sale');
 }
 if(!Number.isFinite(s.realGDP)||s.realGDP<=0||!Number.isFinite(s.priceIndex)||s.priceIndex<=0)throw Error('Invalid macro state');return true;
}
export function energySnapshot(s){
 const planets={};for(const b of Object.values(s.planets))planets[b.id]={gdp:b.gdp,population:b.population,governmentC:stock(s,b.id,'government','C'),privateC:stock(s,b.id,'private','C'),householdC:stock(s,b.id,'household','C'),governmentAlloyU:stock(s,b.id,'government','alloy'),privateAlloyU:stock(s,b.id,'private','alloy'),governmentHydrogenU:stock(s,b.id,'government','hydrogen'),privateHydrogenU:stock(s,b.id,'private','hydrogen'),alloyPrice:b.alloyPrice,hydrogenPrice:b.hydrogenPrice,powerPriceC:b.powerPriceC,reserveFraction:b.reserveFraction??0,industryUtilization:b.industryUtilization??1,cityUtilization:b.cityUtilization??1,privateSets:sum(b.assets.filter(a=>a.kind==='industry'&&a.owner==='private').map(a=>a.sets)),governmentSets:sum(b.assets.filter(a=>a.kind==='industry'&&a.owner==='government').map(a=>a.sets)),industryUnitCostC:b.industryUnitCostC??0,hydrogenUnitCostC:b.hydrogenUnitCostC??0,storageGWh:b.storage?.socGWh??0,coldStopped:b.assets.filter(a=>a.state==='coldStopped').length,starting:b.assets.filter(a=>a.state==='starting').length,activePowerModules:b.assets.filter(a=>a.kind==='powerModule'&&['active','curtailed'].includes(a.state)).length,flow:structuredClone(b.flow)};
 const earth=planets.earth;return {month:s.month,year:s.month/12,realGDP:s.realGDP,priceIndex:s.priceIndex,moneyC:s.moneyQ/1000,treasuryC:sum(Object.values(planets).map(b=>b.governmentC)),debtC:s.debtC,realAlloyPrice:earth.alloyPrice,nominalAlloyPrice:earth.alloyPrice*s.priceIndex,hydrogenPrice:earth.hydrogenPrice,fusionFuelU:s.fuelU,planets};
}
export function tickEnergyEconomy(s){
 const p=s.p,e=s.e,m=s.month;
 for(const b of Object.values(s.planets)){
  b.flow=baseFlow();const shock=p.productivityShock*normal(s.seed,m)/Math.sqrt(12);
  b.potentialGDP*=Math.pow(1+p.productivityGrowth,1/12)*Math.exp(shock)*(b.id==='earth'?Math.pow(1+p.earthPopulationGrowth,1/12):Math.pow(1+p.colonyPopulationGrowth,1/12));
  b.population*=Math.pow(1+(b.id==='earth'?p.earthPopulationGrowth:p.colonyPopulationGrowth),1/12);
  b.powerPriceC=e.electricityGDPShare*p.bodies.earth.annualGDP/(e.earthBaseGW*8760)*Math.exp(e.powerScarcityElasticity*clamp(-(b.reserveFraction??0),0,3));
 }
 fiscal(s);scenarioEvents(s);
 for(const b of Object.values(s.planets)){
  upkeep(s,b);
  if(m%12===0)mergeMaturePrivateCohorts(b,m);
  let plans=industryPlans(s,b,m);openingHydrogenPurchases(s,b,plans);
  plans=industryPlans(s,b,m);
  const dispatch=monthlyPower(s,b,plans);produce(s,b,plans,dispatch);
  const materialFactor=b.demandHistory.length?clamp(stock(s,b.id,'private','alloy')/Math.max(1,b.demandHistory.at(-1)),.1,1):1;
  const powerFactor=clamp((b.cityUtilization??1)*(1-e.industryGDPWeight)+dispatch.industryRatio*e.industryGDPWeight,.05,1);
  b.gdp=b.potentialGDP*powerFactor*(1-p.supplyConstraintStrength*(1-materialFactor));
  marketAndInvestment(s,b);
  // Capital replacement wears actual cohorts, not an extra legacy operating
  // proxy. Pipeline additions are paid before entry and readiness ramps.
  for(const a of b.assets.filter(a=>a.kind==='industry'&&a.owner==='private'&&a.completedMonth<=m))a.sets*=1-p.privateDepreciation/12;
  // Aggregate residual wages/dividends recycle existing private liquidity;
  // this is distribution of GDP, not currency creation or extra output.
  const turnover=b.gdp*s.priceIndex/12;
  pay(s,b.id,'household','private',turnover*.35,'existing-services-turnover');
  const reserve=b.id==='earth'?b.gdp*s.priceIndex*.06:10;
  pay(s,b.id,'private','household',Math.max(0,stock(s,b.id,'private','C')-reserve),'wages-dividends-distribution');
  accrueTotals(b);
 }
 s.previousGDP=s.realGDP;s.realGDP=sum(Object.values(s.planets).map(b=>b.gdp));
 // Growth-linked issuance is explicit. The deflation arm burns available cash,
 // never uses a negative balance; the exact MV=PY identity uses closing M.
 const desired=s.moneyQ*(s.realGDP/s.previousGDP)*Math.pow(1+p.targetInflation,1/12),change=Math.round(desired-s.moneyQ);
 if(change>=0)issue(s,'earth','household',change/1000,'normal-growth-issuance');
 else {let need=-change;for(const b of Object.values(s.planets))for(const owner of ['household','private','government']){const key=account(b.id,owner),take=Math.min(need,s.book.get(key));if(take){s.book.sink(key,take,'normal-growth-burn');need-=take;s.burnedC+=take/1000;}}}
 s.moneyQ=s.book.sum(k=>k.endsWith('/C'));s.priceIndex=s.moneyQ/1000*p.velocity/s.realGDP;s.month++;
 assertEnergyEconomy(s);return energySnapshot(s);
}
export function simulateEnergyEconomy(p,e,inputs,options={}){
 if(options.energyEnabled===false)return simulateEconomy(p,{...options,diagnostics:true});
 const s=createEnergyEconomy(p,e,inputs,options),rows=[energySnapshot(s)];for(let i=0;i<(options.months??240);i++)rows.push(tickEnergyEconomy(s));return {state:s,rows};
}
