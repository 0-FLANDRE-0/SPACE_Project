// ECON-SIM-4.1 ON settlement adapter derived from PR15 b04e3f1.
// R4 private settlement functions have no injection API. This separate adapter
// keeps those settlement bodies frozen, importing its public constructor, audit,
// snapshot, units and facilities. Only shortage/shock/relief integration differs.
// ALL-OFF calls the original R4 engine; no source rewriting occurs at runtime.
import {createRound4Economy,simulateRound4Economy,tickRound4Economy,round4Snapshot,assertRound4Economy,ROUND4_SCENARIOS,normalizeRound4Energy} from './economy-round4-model.js';
import {GRID41,validatePolicy41,stressDefinition41,mediumStress41,shockActive41,maintenanceBill41,maintenanceNeed41,updateShortage41,priority41,damageMaintenance41,repairMaintenance41,emergencyMarket41,protectedExportQ41,assertPolicy41} from './economy-round4-1-policy.js';
import {simulateEnergyEconomy as simulateRound3} from './economy-energy-model.js';
import {packagingCost,transferRound4,hydrogenCost,unitConversion,ROUND4_RESOURCES} from './economy-round4-units.js';
import {powerScale,upgradeScale,advanceSizedFusionStart,round4Bill,upkeepPriority,restartProfile,restartCharge,privateAction,dismantleQuote,R4_SCENARIO_BASE} from './economy-round4-facilities.js';
import {simulateEconomy,industryExpectation,ECON_ROUND2_SCENARIOS,ECON_SHIPS} from './economy-model.js';
import {resourceRandom} from './ore-quality.js';
import {FACILITY_TYPES,MINING,SMELTING} from './industry-policy.js';
import {Ledger,account,quantize as q,trade,energyAudit} from './economy-energy-ledger.js';
import {POWER_TYPES,FUSION,industryCapacity as rawIndustryCapacity,alloyElectricityMWhPerT,advanceFusionStart,dispatchFusion,constructionQuote,upkeepBill,balanceStorage,assistedSmelting,explicitIndustryUnitCost} from './economy-energy-facilities.js';
export const ROUND41_SCENARIOS=Object.freeze([...ROUND4_SCENARIOS,'E5-M','E11-M',...GRID41.map(x=>x.id)]);
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
 const reserve=owner==='private'?(resource==='alloy'?12*sum(b.assets.filter(a=>a.owner==='government'&&a.completedMonth<=s.month).map(a=>round4Bill(a,s.e,s.r,b.id,s.month).alloyU)):Math.max(10,b.hydrogenGovernmentReservationU??0)):0;
 const available=Math.max(0,stock(s,b.id,seller,resource)-reserve);
 const r=trade(s.book,{planet:b.id,from:seller,to:owner,resource,amountU:Math.min(available,Math.max(0,u)),priceC:(resource==='alloy'?b.alloyPrice:b.hydrogenPrice)*s.priceIndex,tag:resource+'-purchase'});
 b.flow.purchasesC+=r.cashC;return r;
}
function ensureStock(s,b,owner,resource,u){const need=Math.max(0,u-stock(s,b.id,owner,resource));if(need)purchase(s,b,owner,resource,need);return stock(s,b.id,owner,resource)>=u-1e-6;}
function addAsset(b,asset){const a={id:b.id+'-'+(b.serial++),lossMonths:0,pausedMonths:0,state:'active',health:1,backlogU:0,completedMonth:0,creditBasisC:0,alloyBasisU:0,...asset};a.alloyBasisU=q(a.alloyBasisU)/1000;b.assets.push(a);return a;}
function industryAsset(b,owner,sets,completedMonth,e,{mineRatio=e.mineRatio}={}){
 const mine=FACILITY_TYPES[MINING],smelt=FACILITY_TYPES[SMELTING],scale=owner==='private'?e.privateScale:1;
 return addAsset(b,{kind:'industry',owner,sets,mineRatio,completedMonth,smeltCompletedMonth:completedMonth<0?completedMonth:completedMonth+smelt.months-mine.months,mineCreditC:mine.creditC*mineRatio*sets*scale,mineAlloyU:mine.alloyU*mineRatio*sets*scale,creditBasisC:(mine.creditC*mineRatio+smelt.creditC)*sets*scale,alloyBasisU:(mine.alloyU*mineRatio+smelt.alloyU)*sets*scale,state:completedMonth>0?'construction':'active',hydrogenU:smelt.hydrogenU*sets,tag:'mine+smelter'});
}
function baseFlow(){return {producedU:0,privateProducedU:0,governmentProducedU:0,minedU:0,processedU:0,residueU:0,hydrogenProducedU:0,hydrogenUsedU:0,hydrogenUnmetU:0,hydrogenByproductU:0,hydrogenElectrolysisU:0,upkeepRequiredU:0,upkeepPaidU:0,repairU:0,repairC:0,directC:0,purchasesC:0,constructionC:0,constructionAlloyU:0,constructionHydrogenU:0,startC:0,startHydrogenU:0,normalHydrogenU:0,generalAlloyDemandU:0,generalAlloyConsumedU:0,unmetAlloyU:0,governmentSoldU:0,governmentSaleC:0,powerSalesC:0,powerFuelC:0,powerUnpaidC:0,warAlloyU:0,powerDirectC:0,powerUpkeepU:0,governmentPowerDirectC:0,governmentPowerUpkeepU:0,governmentIndustryDirectC:0,governmentIndustryUpkeepU:0,governmentPowerPurchaseC:0,hydrogenDirectC:0,hydrogenUpkeepU:0,hydrogenConstructionC:0,privateExpansionSets:0,governmentPowerGWh:0,packagingGWh:0,packagingGovernmentGWh:0,packagingC:0,shippingAlloyU:0,shippingHydrogenU:0,restartC:0,restartHeaterGWh:0,dismantleC:0,salvageU:0,liquefactionGWh:0,oxygenLiquefactionGWh:0,hydrogenStorageGWh:0,boiloffU:0,pausedFacilities:0,dismantledFacilities:0,healthMin:1,loanC:0,budgetC:0,mandatoryC:0,shipOrders:0,maintenanceByKind:{},...initialEnergyStats()};}
// PR15's immutable constructor supplies original capital, inventories and units.
export function createRound41Economy(p,e,inputs,options={}){
 if(options.round41Enabled===false){const x=createRound4Economy(p,e,inputs,options);x.round41Off=true;return x;}
 const policy=validatePolicy41(options.round41),scenario=options.scenario??'E0';
 if(!ROUND41_SCENARIOS.includes(scenario))throw Error('Unknown Round4.1 scenario');
 const baseScenario=mediumStress41(scenario)?(scenario==='E11-M'?'E11':'E5'):scenario;
 const s=createRound4Economy(p,e,inputs,{...options,scenario:baseScenario,round4:{...options.round4,hydrogenPrice:policy.hydrogenPrice}});
 s.scenario=scenario;s.r41=structuredClone(policy);s.stress41=stressDefinition41(scenario,options.stress);
 s.relief41={market:[],imports:[],mode:[],grace:[],privateDecisions:[]};s.capturePrivateDecisions=Boolean(options.capturePrivateDecisions);
 for(const b of Object.values(s.planets)){b.shortage41={active:false,entries:0,exits:0};b.policyStats41={marketU:0,marketC:0,importU:0,importGoodsC:0,importServiceC:0,importEnergyGWh:0,graceAssetMonths:0,lifeDamageAssetMonths:0};}
 return s;
}
function transportGrant(s,to,c,alloyU,hydrogenU){
 const amt=Math.min(c,stock(s,'earth','government','C'));if(amt)s.book.move(account('earth','government'),account(to,'government'),q(amt),'explicit-financial-grant');
 scheduleShipment(s,to,'alloy',alloyU);scheduleShipment(s,to,'hydrogen',hydrogenU);
 s.events.push({month:s.month,event:'shipment-requested',to,alloyU,hydrogenU,creditC:amt});
}
function borrow(s,b,amount){const n=Math.min(q(Math.max(0,amount)),s.book.get(account(b.id,'household')));if(n){s.book.move(account(b.id,'household'),account(b.id,'government'),n,'bond-subscription');s.debtC+=n/1000;b.flow.loanC+=n/1000;}return n/1000;}
function issue(s,planet,owner,c,tag){if(c<=0)return;s.book.source(account(planet,owner),q(c),tag);s.issuedC+=q(c)/1000;}
function constructionPurchase(s,b,owner,{creditC,alloyU,hydrogenU=0},tag){
 // No partial material payment or free foundation: all three budgets must be
 // present before the atomic order. Government may buy local private stock.
 creditC*=s.priceIndex;
 const extraAlloy=Math.max(0,alloyU-stock(s,b.id,owner,'alloy')),extraH=Math.max(0,hydrogenU-stock(s,b.id,owner,'hydrogen'));
 const totalC=creditC+(extraAlloy*b.alloyPrice+extraH*b.hydrogenPrice)*s.priceIndex;
 if(stock(s,b.id,owner,'C')<totalC||stock(s,b.id,owner,'alloy')+(owner==='government'?stock(s,b.id,'private','alloy'):0)<alloyU||stock(s,b.id,owner,'hydrogen')+(owner==='government'?stock(s,b.id,'private','hydrogen'):0)<hydrogenU)return false;
 ensureStock(s,b,owner,'alloy',alloyU);ensureStock(s,b,owner,'hydrogen',hydrogenU);
 pay(s,b.id,owner,'household',creditC,'construction:'+tag);s.book.move(account(b.id,owner,'alloy'),account(b.id,owner,tag==='ship'?'shipAlloy':'capitalAlloy'),q(alloyU),'construction-alloy-bond');consume(s,b.id,owner,'hydrogen',hydrogenU,'construction-hydrogen');
 b.flow.constructionC+=creditC;b.flow.constructionAlloyU+=alloyU;b.flow.constructionHydrogenU+=hydrogenU;return true;
}
export function orderPowerComplex(s,planet,type,modules=1,{size='large',owner='government'}={}){
 const b=s.planets[planet],e=s.e,def=POWER_TYPES[type],scaled=powerScale(e,s.r,type,size,s.month);if(!def||modules<1||modules>def.maxModules||!Number.isInteger(modules))throw Error('Invalid power complex');
 if(s.disableGovernmentPower&&owner==='government')return null;
 const duration=scaled.foundationMonths,jobs=b.jobs.filter(j=>j.startMonth<s.month+duration&&j.endMonth>s.month),costs={...e.costs,[type]:{base:scaled.base,module:scaled.module}},quote=constructionQuote({type,part:'base',costs,startMonth:s.month,jobs,experience:b.experience,surcharge:owner==='government'?e.parallelSurcharge:0,learning:e.learning});quote.endMonth=s.month+duration;
 if(!constructionPurchase(s,b,owner,quote,type+'-base'))return null;
 const complex={id:planet+'-complex-'+b.complexes.length,owner,type,size,foundationEnd:quote.endMonth,modules:[],wanted:modules,foundationPaid:true};b.complexes.push(complex);
 addAsset(b,{kind:'powerBase',owner,type,complexId:complex.id,state:'construction',completedMonth:quote.endMonth,creditBasisC:quote.creditC,alloyBasisU:quote.alloyU});
 b.jobs.push({...quote,owner,complexId:complex.id,part:'base'});s.events.push({month:s.month,event:'base-ordered',planet,type,size,complexId:complex.id,overlap:quote.overlap,factor:quote.factor});return complex;
}
function orderPowerModule(s,b,c){
 const def=POWER_TYPES[c.type];if(c.modules.length>=def.maxModules||c.modules.length>=c.wanted||s.month<c.foundationEnd)return false;
 const scaled=powerScale(s.e,s.r,c.type,c.size,s.month),jobs=b.jobs.filter(j=>j.startMonth<s.month+scaled.months&&j.endMonth>s.month),costs={...s.e.costs,[c.type]:{base:scaled.base,module:scaled.module}},quote=constructionQuote({type:c.type,costs,startMonth:s.month,jobs,experience:b.experience,surcharge:c.owner==='government'?s.e.parallelSurcharge:0,learning:s.e.learning});quote.endMonth=s.month+scaled.months+(c.owner==='private'?Math.max(0,s.e.privatePowerLagMonths-s.e.costs.foundationMonths-POWER_TYPES[c.type].months)*Math.pow(scaled.ratio,s.r.timeExponent):0);quote.hydrogenU=scaled.buildHydrogenU;
 if(!constructionPurchase(s,b,c.owner,quote,c.type+'-module'))return false;
 const a=addAsset(b,{kind:'powerModule',owner:c.owner,type:c.type,size:c.size,ratio:scaled.ratio,ratedGW:scaled.ratedGW,startC:scaled.startC,complexId:c.id,state:'construction',completedMonth:quote.endMonth,creditBasisC:quote.creditC,alloyBasisU:quote.alloyU,progressHours:0,startPaid:false,starts:0});
 c.modules.push(a.id);b.jobs.push({...quote,owner:c.owner,part:'module',complexId:c.id});s.events.push({month:s.month,event:'module-ordered',planet:b.id,type:c.type,size:c.size,overlap:quote.overlap,factor:quote.factor});return true;
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
 const m=s.month,b=s.planets.earth,c=mediumStress41(s.scenario)?'E5':(R4_SCENARIO_BASE[s.scenario]??s.scenario);
 if(m===0&&['S1','S1-sell','S2','S3-debt','S3-money','S4','E0','E1','E3','E4','E5','E6','E7'].includes(c))orderIndustry(s,b,'government');
 if(['S1','S1-sell','S2','S3-debt','S3-money','S4'].includes(c)&&m>0&&m%24===0)orderIndustry(s,b,'government');
 if(c==='E1'&&s.scenario!=='E10'&&[0,36,72].includes(m))orderPowerComplex(s,'earth',m===36?'solar':m===72?'fission':'fusion',m===0?4:2);
 if(c==='E3'&&m===36)orderPowerComplex(s,'earth','fission',8);
 if(c==='E4'&&m===0){orderPowerComplex(s,'earth','fusion',8);orderPowerComplex(s,'moon','fusion',1);}
 if(c==='E6'&&m===0)orderPowerComplex(s,'earth','fusion',2);
 if(c==='E7'&&[0,48].includes(m)){borrow(s,b,250000);for(let i=0;i<6;i++)orderPowerComplex(s,'earth',['fusion','fission','solar'][i%3],4);}
 if(['E2','E8'].includes(c)&&!['E2-S','E9'].includes(s.scenario)&&m===0){for(const id of ['moon','mars']){orderPowerComplex(s,id,'solar',1);orderStorage(s,s.planets[id]);}orderPowerComplex(s,'moon','fission',1);}
 if(c==='E2'&&!['E2-S','E9'].includes(s.scenario)&&m===60)orderPowerComplex(s,'mars','fission',1);
 if(c==='S4'&&m>0&&m%s.p.colonyBuildEveryMonths===0){transportGrant(s,m%48?'moon':'mars',5000,500,10);orderIndustry(s,s.planets[m%48?'moon':'mars'],'government');}
 for(const planet of Object.values(s.planets)){
  for(const a of planet.assets){
   if(a.state==='construction'&&a.completedMonth<=m){a.state=a.kind==='powerModule'&&a.type==='fusion'?'coldStopped':'active';planet.experience++;}
   if(c==='E6'&&s.scenario!=='E6-R'&&a.owner==='government'&&a.completedMonth<=m){if(m===48){a.state=a.kind==='powerModule'&&a.type==='fusion'?'coldStopped':'paused';a.startPaid=false;a.progressHours=0;}if(m===60)restartRound4(s,planet,a);}
  }
  for(const complex of planet.complexes){while(complex.modules.length<complex.wanted&&orderPowerModule(s,planet,complex)){} }
 }
 if(['E5','E5-X','E11'].includes(c)&&m===60){
  // Actual military material consumption and no fictitious sale receipts.
  for(const owner of ['government','private'])consume(s,'earth',owner,'alloy',stock(s,'earth',owner,'alloy')*s.stress41.lossFraction,'stress-physical-requisition');
 }
}
export function upkeepRound41(s,b){
 const e=s.e;for(const a of [...b.assets].sort((x,y)=>s.r.priorityEnabled?priority41(x,b.shortage41,s.r41)-priority41(y,b.shortage41,s.r41):0)){
  if(a.completedMonth>s.month||a.state==='dismantled')continue;
  const bill=maintenanceBill41(a,e,s.r,b.id,s.month),kind=a.kind,ownBefore=stock(s,b.id,a.owner,'alloy');
  ensureStock(s,b,a.owner,'alloy',bill.alloyU);
  const paid=consume(s,b.id,a.owner,'alloy',bill.alloyU,'alloy-upkeep:'+kind),short=Math.max(0,bill.alloyU-paid);
  const damage=damageMaintenance41(a,{shortU:short,billU:bill.alloyU,month:s.month,damagePerMonth:e.damagePerMonth,graceEnabled:s.r41.triageEnabled&&b.shortage41.active},s.r41);Object.assign(a,damage.asset);
  if(damage.usedGrace)b.policyStats41.graceAssetMonths++;
  if(upkeepPriority(a)===0&&damage.healthLost>0)b.policyStats41.lifeDamageAssetMonths++;
  if(damage.usedGrace||upkeepPriority(a)===0&&damage.healthLost>0)s.relief41.grace.push({month:s.month,planet:b.id,asset:a.id,usedGrace:damage.usedGrace,healthLost:damage.healthLost,deferredQ:a.lifeDeferredQ??0,age:a.lifeGraceAgeMonths,shortU:short,priority:priority41(a,b.shortage41,s.r41)});
  let repair=0,repairC=0;
  if(!short&&a.backlogU>0){const possible=Math.min(a.backlogU,bill.alloyU*e.repairRate);ensureStock(s,b,a.owner,'alloy',possible);repair=Math.min(possible,stock(s,b.id,a.owner,'alloy'),stock(s,b.id,a.owner,'C')/e.repairCPerU);if(repair>0){repair=consume(s,b.id,a.owner,'alloy',repair,'alloy-repair');repairC=pay(s,b.id,a.owner,'household',repair*e.repairCPerU,'repair-labour');const repayment=repairMaintenance41(a,repair,bill.alloyU,e.damagePerMonth);Object.assign(a,repayment.asset);if(repayment.asset.lifeGraceAgeMonths===undefined)delete a.lifeGraceAgeMonths;if(repayment.deferredRepaidQ)s.relief41.grace.push({month:s.month,planet:b.id,asset:a.id,repaidQ:repayment.deferredRepaidQ,deferredQ:a.lifeDeferredQ});}}
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
 if(a.state==='construction'||a.state==='paused'||a.state==='dismantling'||a.state==='dismantled'||(shockActive41(s.scenario,m,s.stress41??stressDefinition41(s.scenario))&&(!mediumStress41(s.scenario)||b.id==='earth')))factor=0;
 const profile=restartProfile(a,s.r,m),mineU=cap.mineU*factor*profile.mineFactor,baseProcess=cap.processU*factor*profile.smeltFactor,oreAvailable=mineU+(budgets?.ore[a.owner]??stock(s,b.id,a.owner,'ore'));
 const boostUseful=oreAvailable>baseProcess&&baseProcess*s.inputs.contract.smeltBoost*s.tech.yieldFraction*b.alloyPrice>s.inputs.contract.smeltHydrogenU*a.sets*b.hydrogenPrice;
 const maxH=s.inputs.contract.smeltHydrogenU*a.sets*smeltCap.ramp*factor;
 const work=assistedSmelting({oreU:oreAvailable,baseProcessU:baseProcess,rawWorkU:FACILITY_TYPES[SMELTING].capacityU*a.sets*smeltCap.ramp*factor,maxHydrogenU:maxH,availableHydrogenU:budgets?.hydrogen[a.owner]??stock(s,b.id,a.owner,'hydrogen'),boost:s.inputs.contract.smeltBoost,enabled:boostUseful});
 const {processU,hydrogenU,desiredHydrogenU}=work,alloyU=processU*s.tech.yieldFraction;
 const energyGWh=mineU*ROUND4_RESOURCES.get('ore').contentMassKgPerU/1000*e.mineMWhPerT/1000+processU*ROUND4_RESOURCES.get('ore').contentMassKgPerU/1000*e.feedMWhPerT/1000+alloyU*ROUND4_RESOURCES.get('alloy').contentMassKgPerU/1000*alloyElectricityMWhPerT(e.industryMix)/1000+(a.completedMonth>m?0:a.sets*e.industryFixedMW*730/1000*(a.state==='paused'||a.state==='dismantling'?.05:1));
 if(budgets){budgets.ore[a.owner]=oreAvailable-processU;budgets.hydrogen[a.owner]=Math.max(0,budgets.hydrogen[a.owner]-hydrogenU);}
 const heaterGWh=a.state==='active'?a.sets*e.industryFixedMW/1000*profile.heaterHours*s.r.smeltHeatMultiplier:0;
 return {asset:a,mineU,processU,alloyU,hydrogenU,desiredHydrogenU,energyGWh:energyGWh+heaterGWh,heaterGWh,baseProcess};
}
function industryPlans(s,b,m){const budgets={ore:{government:stock(s,b.id,'government','ore'),private:stock(s,b.id,'private','ore')},hydrogen:{government:stock(s,b.id,'government','hydrogen'),private:stock(s,b.id,'private','hydrogen')}};return b.assets.filter(a=>a.kind==='industry'&&a.state!=='dismantled').map(a=>industryPlan(s,b,a,m,budgets));}
function mergeMaturePrivateCohorts(b,m){return; // Lifecycle cohorts retain their independent vintage and decisions.

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
  const need=industryH+sum(modules.map(a=>['coldStopped','starting'].includes(a.state)?Math.max(0,FUSION.startHydrogenU*(a.ratio??1)*(1-a.progressHours/FUSION.startHours)):s.fuelU*(a.ratio??1)));
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
 if(['E2','E2-S','E9','E8'].includes(s.scenario)&&!pe&&m>=36&&m<60)existingFactor=.65;
 const legacy=b.assets.find(a=>a.kind==='legacyGrid'),legacyGWh=!['paused','coldStopped','dismantling','dismantled'].includes(legacy.state)?legacy.capacityGW*730*existingFactor*legacy.health*(legacy.cashFraction??1):0;
 const privateExpansions=b.assets.filter(a=>a.kind==='privateGridExpansion'&&a.completedMonth<=m&&!['paused','dismantling','dismantled'].includes(a.state));
 const privateNewGWh=sum(privateExpansions.map(a=>a.capacityGW*730*e.fissionAvailability*a.health*(a.cashFraction??1)));
 let supply=legacyGWh+privateNewGWh,governmentGWh=0,startInput=0,startGeneration=0,normalFusionH=0,startGenerationGov=0;
 const completed=b.assets.filter(a=>a.kind==='powerModule'&&a.completedMonth<=m&&!a.manualPause&&!['paused','construction','dismantling','dismantled'].includes(a.state));
 const fusionHReserved={government:sum(plans.filter(x=>x.asset.owner==='government').map(x=>x.hydrogenU)),private:sum(plans.filter(x=>x.asset.owner==='private').map(x=>x.hydrogenU))};
 // Normal fuel is reserved before starts; no two modules can spend the same H.
 for(const a of completed.filter(a=>a.type==='fusion'&&['active','curtailed'].includes(a.state))){
  if(s.scenario==='E6'&&m>=48&&m<60)continue;
  const available=Math.max(0,stock(s,b.id,a.owner,'hydrogen')-fusionHReserved[a.owner]);
  const r=dispatchFusion({requestedGWh:a.ratedGW/(a.ratio??1)*730*a.health,availableHydrogenU:available/(a.ratio??1),minimumFraction:e.fusionMinimumFraction,normalHydrogenU:s.fuelU});
  a.state=r.state;if(r.state==='coldStopped'){a.startPaid=false;a.progressHours=0;continue;}
  fusionHReserved[a.owner]+=r.hydrogenU*(a.ratio??1);a.provisionalGWh=r.energyGWh*(a.ratio??1);a.normalHours=730;
 }
 for(const a of completed.filter(a=>a.type!=='fusion')){const r=a.ratedGW*730*a.health*(a.cashFraction??1)*(a.type==='solar'?solarFactor(s,b,m):e.fissionAvailability)*(a.derateUntil>m?1-a.derateFraction:1);a.provisionalGWh=r;}
 const regularGovernment=sum(completed.map(a=>a.provisionalGWh??0));
 const externalSupply=supply+regularGovernment;
 let startupExternalRemaining=Math.max(0,externalSupply-background);
 for(const a of completed.filter(a=>a.type==='fusion'&&['coldStopped','starting'].includes(a.state))){
  if(s.scenario==='E6'&&m>=48&&m<60)continue;
  if(!a.startPaid){if(stock(s,b.id,a.owner,'C')<a.startC*s.priceIndex)continue;const c=pay(s,b.id,a.owner,'household',a.startC*s.priceIndex,'fusion-start-labour');b.flow.startC+=c;a.startPaid=true;a.startHConsumedQ=0;a.starts++;s.normalStarts++;s.events.push({month:m,event:'fusion-start',planet:b.id,asset:a.id,number:a.starts});}
  a.state='starting';let wall=730,normalHours=0,steps=0;
  // At most four startup progress windows per successful boot. The external
  // instantaneous allocation is limited as well as its monthly energy budget.
  while(wall>1e-8&&a.progressHours<96-1e-8&&steps<32){
   const dt=Math.min(24,wall,96-a.progressHours),available=Math.max(0,stock(s,b.id,a.owner,'hydrogen')-fusionHReserved[a.owner]);
   const stableSurplusGW=Math.max(0,(externalSupply-background)/730);
   const input=Math.min(startupExternalRemaining,Math.min(stableSurplusGW,FUSION.inputGW*(a.ratio??1))*dt);
   const theoreticalUsed=a.progressHours*FUSION.startHydrogenU*(a.ratio??1)/FUSION.startHours,paidCredit=Math.max(0,(a.startHConsumedQ??0)/1000-theoreticalUsed),provisional=advanceSizedFusionStart(a,{progressHours:a.progressHours,wallHours:dt,externalGWh:input,hydrogenU:available+paidCredit});
   // Fund startup progress with whole material quanta. Sub-quantum resources
   // cannot be spent repeatedly while the same H remains in the account.
   const targetQ=Math.ceil(provisional.progressHours*FUSION.startHydrogenU*(a.ratio??1)/FUSION.startHours*1000-1e-7),fundedQ=Math.min(q(available),Math.max(0,targetQ-(a.startHConsumedQ??0))),fundedH=fundedQ/1000;
   const r=advanceSizedFusionStart(a,{progressHours:a.progressHours,wallHours:dt,externalGWh:input,hydrogenU:fundedH+paidCredit});
   a.progressHours=r.progressHours;startInput+=r.inputGWh;startGeneration+=r.generationGWh;if(a.owner==='government')startGenerationGov+=r.generationGWh;startupExternalRemaining-=r.inputGWh;
   const used=consume(s,b.id,a.owner,'hydrogen',fundedH,'fusion-start-hydrogen');a.startHConsumedQ=(a.startHConsumedQ??0)+q(used);b.flow.startHydrogenU+=used;b.flow.hydrogenUsedU+=used;
   s.bootSubsteps++;steps++;wall-=dt;if(r.advancedHours<1e-9)break;
   if(r.completed){a.state='active';normalHours=wall;break;}
  }
  if(normalHours>0){const available=Math.max(0,stock(s,b.id,a.owner,'hydrogen')-fusionHReserved[a.owner]),r=dispatchFusion({requestedGWh:a.ratedGW/(a.ratio??1)*normalHours*a.health,hours:normalHours,availableHydrogenU:available/(a.ratio??1),minimumFraction:e.fusionMinimumFraction,normalHydrogenU:s.fuelU});a.state=r.state;a.provisionalGWh=r.energyGWh*(a.ratio??1);a.normalHours=normalHours;fusionHReserved[a.owner]+=r.hydrogenU*(a.ratio??1);if(r.state==='coldStopped'){a.startPaid=false;a.progressHours=0;}}
 }
 // Newly started normal operation is included; startup output cannot start
 // itself/another reactor in this settlement, but can supply end-use loads.
 governmentGWh=sum(completed.filter(a=>a.owner==='government').map(a=>a.provisionalGWh??0))+startGenerationGov;
 supply+=sum(completed.map(a=>a.provisionalGWh??0))+startGeneration;
 const industrial=sum(plans.map(p=>p.energyGWh));
 const electrolyzers=b.assets.filter(a=>a.kind==='electrolyzer'&&a.completedMonth<=m&&!['paused','dismantling','dismantled'].includes(a.state));
 const storageH=sum(['government','private'].map(owner=>stock(s,b.id,owner,'hydrogen'))),storageGWh=storageH*ROUND4_RESOURCES.get('hydrogen').contentMassKgPerU*s.r.hydrogenStorageKWhKgMonth/1e6;
 const hPlans=electrolyzers.map(a=>{
  const eligible=b.reference.waterTiles.includes(a.hostTile),target=b.hydrogenTargetU||e.hydrogenModuleU*3;
  const deficit=Math.max(0,target-stock(s,b.id,a.owner,'hydrogen'));
  const margin=b.hydrogenPrice-((e.electrolysisGWhPerU+s.r.hydrogenLiquefactionKWhKg*ROUND4_RESOURCES.get('hydrogen').contentMassKgPerU/1e6)*b.powerPriceC+s.e.hydrogenVariableCPerU);
  let units=eligible&&margin>0?Math.min(a.capacityU*a.health*(a.cashFraction??1),deficit+(b.hydrogenDesiredUseU??0), e.waterIntakeU/electrolyzers.length):0;
  if(!Number.isFinite(units))units=0;if(s.scenario==='E4'&&m>=48&&m<84)units=0;
  const liquefactionGWh=units*s.r.hydrogenLiquefactionKWhKg*ROUND4_RESOURCES.get('hydrogen').contentMassKgPerU/1e6;const oxygenLiquefactionGWh=s.r.oxygenStored?units*s.r.oxygenLiquefactionKWhKg*ROUND4_RESOURCES.get('oxygen').contentMassKgPerU/1e6:0;return {asset:a,units,liquefactionGWh,oxygenLiquefactionGWh,energyGWh:units*e.electrolysisGWhPerU+liquefactionGWh+oxygenLiquefactionGWh};
 });
 const electrolysis=sum(hPlans.map(p=>p.energyGWh))+storageGWh,packagingGWh=runShipments(s,b,Math.max(0,supply-background*e.essentialShare-startInput),fusionHReserved);
 const demand=background+industrial+electrolysis+startInput+packagingGWh;
 const storageAsset=b.storage&&b.assets.find(a=>a.id===b.storage.assetId),storageEnabled=storageAsset&&storageAsset.completedMonth<=m&&!['paused','dismantling','dismantled'].includes(storageAsset.state);
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
  const blockDemand=peakEvent?background*fraction*(k===0?peakRatio:1)/(.75+.25*peakRatio)+(industrial+electrolysis+startInput+packagingGWh)*fraction:demand*fraction;
  let st={chargeGWh:0,dischargeGWh:0,lossGWh:0};
  if(storageEnabled){st=balanceStorage({...b.storage,efficiency:e.storageEfficiency,supplyGWh:blockSupply,demandGWh:blockDemand,hours:730*fraction});b.storage.socGWh=st.socGWh;}
  const available=blockSupply+st.dischargeGWh-st.chargeGWh,delivered=Math.min(available,blockDemand),excess=Math.max(0,available-blockDemand);
  const genK=q(blockSupply,1e6),disK=q(st.dischargeGWh,1e6),chargeK=q(st.chargeGWh,1e6),servedK=Math.min(genK+disK-chargeK,q(delivered,1e6));
  energyAudit({generationKWh:genK,dischargeKWh:disK,servedKWh:servedK,chargeKWh:chargeK,curtailedKWh:genK+disK-chargeK-servedK});
  served+=delivered;curtailed+=excess;charge+=st.chargeGWh;discharge+=st.dischargeGWh;loss+=st.lossGWh;usedSupply+=blockSupply-excess;
 }
 // Boot input was reserved out of external supply above; priority then protects
 // basic cities/life support. Remaining industrial/H loads share one grid.
 const usable=Math.max(0,served-startInput-packagingGWh),essential=Math.min(background*e.essentialShare,usable),remaining=Math.max(0,usable-essential);
 const optionalCity=background*(1-e.essentialShare),other=optionalCity+industrial+electrolysis;
 let ratio=other?clamp(remaining/other):1,industryRatio=ratio;
 if(e.dispatchPolicy==='industryFirst'){industryRatio=industrial+electrolysis?clamp(remaining/(industrial+electrolysis)):1;ratio=optionalCity?clamp((remaining-(industrial+electrolysis)*industryRatio)/optionalCity):1;}
 b.cityUtilization=background?clamp((essential+optionalCity*ratio)/background):1;
 // Settlement curtails actual generation and fuel together. Startup was fixed
 // by progress already and is never retroactively erased by curtailment.
 const dispatchRatio=supply>0?clamp((usedSupply-startGeneration)/(supply-startGeneration||1)):0;
 b.flow.powerFuelC+=pay(s,b.id,'private','household',privateNewGWh*dispatchRatio*e.fissionFuelCPerGWh*s.priceIndex,'private-fission-fuel-services');
 let actualGovernment=startGenerationGov;
 for(const a of completed){
  const actual=(a.provisionalGWh??0)*dispatchRatio;a.actualGWh=actual;if(a.owner==='government')actualGovernment+=actual;
  if(a.type==='fusion'&&(a.provisionalGWh??0)>0){
   const sustainingGWh=a.ratedGW*(a.normalHours??730)*e.fusionMinimumFraction,fuelOutput=Math.max(actual,sustainingGWh);
   // A running reactor can hold its minimum output and spill unused power.
   // Curtailment does not charge a restart, and sustaining fuel is not free.
   const fuel=consume(s,b.id,a.owner,'hydrogen',fuelOutput/3650*s.fuelU,'fusion-normal-hydrogen');normalFusionH+=fuel;b.flow.hydrogenUsedU+=fuel;a.state=actual<(a.provisionalGWh??0)-1e-8?'curtailed':'active';
  }
  a.lastUtilization=actual/(a.ratedGW*730);
  if(a.type==='fission')b.flow.powerFuelC+=pay(s,b.id,a.owner,'household',actual*e.fissionFuelCPerGWh*s.priceIndex,'fission-fuel-services');
  delete a.provisionalGWh;
 }
 b.flow.normalHydrogenU+=normalFusionH;
 b.flow.liquefactionGWh+=sum(hPlans.map(h=>h.liquefactionGWh))*industryRatio;b.flow.oxygenLiquefactionGWh+=sum(hPlans.map(h=>h.oxygenLiquefactionGWh))*industryRatio;b.flow.hydrogenStorageGWh+=storageGWh*industryRatio;b.flow.restartHeaterGWh+=sum(plans.map(x=>x.heaterGWh))*industryRatio;
 // Consumer-to-utility payments are existing GDP expenditure, not new GDP.
 const tariff=b.powerPriceC*s.priceIndex,cityServed=background*b.cityUtilization;
 pay(s,b.id,'household','private',cityServed*tariff,'existing-city-electric-bill');
 const govH=sum(hPlans.filter(h=>h.asset.owner==='government').map(h=>h.energyGWh))*industryRatio+storageGWh*industryRatio*(storageH?stock(s,b.id,'government','hydrogen')/storageH:0),govIndustry=b.flow.packagingGovernmentGWh+govH+sum(plans.filter(p=>p.asset.owner==='government').map(p=>p.energyGWh))*industryRatio,privateIndustry=packagingGWh-b.flow.packagingGovernmentGWh+electrolysis*industryRatio-govH+sum(plans.filter(p=>p.asset.owner==='private').map(p=>p.energyGWh))*industryRatio;
 const totalDelivered=Math.max(1e-9,served),governmentShare=clamp(actualGovernment/totalDelivered),govSelf=govIndustry*governmentShare;
 const exported=Math.min(actualGovernment-govSelf,cityServed+privateIndustry),govBought=Math.max(0,govIndustry-govSelf);
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
  const a=h.asset,requested=h.units*dispatch.hydrogenRatio,existingWater=stock(s,b.id,a.owner,'water'),intake=Math.min(e.waterIntakeU,Math.max(0,requested-existingWater));
  // Surface water is a declared finite per-month intake, not an ore/H deposit.
  if(b.reference.waterTiles.includes(a.hostTile)&&intake)s.book.source(account(b.id,a.owner,'water'),q(intake),'metered-surface-water-intake');
  const u=Math.min(requested,stock(s,b.id,a.owner,'water')),n=Math.min(q(u),s.book.get(account(b.id,a.owner,'water')));a.lastUtilization=n/1000/Math.max(.001,a.capacityU);if(n){consume(s,b.id,a.owner,'water',n/1000,'electrolysis-water');s.book.source(account(b.id,a.owner,'oxygen'),n,'electrolysis-oxygen');if(!s.r.oxygenStored)s.book.sink(account(b.id,a.owner,'oxygen'),n,'oxygen-vented');newHydrogen.push({owner:a.owner,n,electrolysis:true});b.flow.hydrogenElectrolysisU+=n/1000;b.flow.electrolysisGWh+=n/1000*e.electrolysisGWhPerU;b.flow.hydrogenDirectC+=pay(s,b.id,a.owner,'household',n/1000*e.hydrogenVariableCPerU*s.priceIndex,'hydrogen-variable-services');}
 }
 // Closing-only H output. It cannot fuel this month's reactor boot or smelter.
 for(const h of newHydrogen){s.book.source(account(b.id,h.owner,'hydrogen'),h.n,h.electrolysis?'electrolysis-hydrogen':'byproduct-hydrogen');b.flow.hydrogenProducedU+=h.n/1000;}
 b.hydrogenLastUseU=b.flow.hydrogenUsedU;
}
function marketAndInvestment(s,b){
 const p=s.p,e=s.e,m=s.month,grow=b.gdp/p.bodies[b.id].annualGDP;
 let demand=b.backgroundAlloyU*grow*Math.pow(b.alloyPrice/p.baseAlloyPrice,-p.demandElasticity);
 if(shockActive41(s.scenario,m,s.stress41)&&(!mediumStress41(s.scenario)||b.id==='earth'))demand*=s.stress41.demandMultiplier;
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
 b.hydrogenPrice=clamp(b.hydrogenPrice*Math.exp(e.hydrogenPriceAdjustment*clamp((htarget-hstock)/htarget,-2,2)-e.hydrogenPriceReversion*Math.log(b.hydrogenPrice/s.r.hydrogenPrice)),.02,40);
 b.hydrogenTargetU=htarget;
 // Endogenous electricity quote derives from existing GDP spending, not an
 // aluminium-heavy industrial load or an arbitrary scarcity target.
 b.powerPriceC=e.electricityGDPShare*p.bodies.earth.annualGDP/(e.earthBaseGW*8760)*Math.exp(e.powerScarcityElasticity*clamp(-b.reserveFraction,0,3));
 if(b.id==='earth'&&m%3===0){
  const cap=b.assets.filter(a=>a.kind==='industry'&&a.owner==='private'&&a.state!=='dismantled').reduce((v,a)=>v+a.sets,0),output=Math.max(1,mean(b.outputHistory.slice(-p.privateForecastMonths))),recent=mean(b.demandHistory.slice(-p.privateForecastMonths));
  const creditBasisC=(FACILITY_TYPES[MINING].creditC*e.mineRatio+FACILITY_TYPES[SMELTING].creditC)*e.privateScale,alloyBasisU=(FACILITY_TYPES[MINING].alloyU*e.mineRatio+FACILITY_TYPES[SMELTING].alloyU)*e.privateScale;
  const investment=creditBasisC+alloyBasisU*b.alloyPrice+FACILITY_TYPES[SMELTING].hydrogenU*b.hydrogenPrice;
  const full=industryPlan(s,b,{sets:1,owner:'private',mineRatio:e.mineRatio,completedMonth:-100,smeltCompletedMonth:-100,health:1,state:'active'},m,{ore:{private:0},hydrogen:{private:Infinity}});
  const unitCost=explicitIndustryUnitCost({investmentC:investment,creditBasisC,alloyBasisU,outputU:full.alloyU,energyGWh:full.energyGWh,hydrogenU:full.hydrogenU,amortizationMonths:p.privateAmortizationYears*12,directAnnual:e.directAnnual,upkeepAnnual:s.r['upkeep_'+b.id],alloyPrice:b.alloyPrice,hydrogenPrice:b.hydrogenPrice,powerPrice:b.powerPriceC});
  b.industryUnitCostC=unitCost;
  const margin=Math.max(0,b.alloyPrice/unitCost-1-p.requiredMargin),inventoryGap=clamp((b.alloyTargetU-inventory)/Math.max(1,b.alloyTargetU),-1,1);
  const growth=p.expansionBeta*Math.max(0,margin+inventoryGap)+p.privateDepreciation/12;
  const sets=Math.min(cap*.03,cap*growth*3*Math.max(.25,recent/output));
  if(sets>.001)orderIndustry(s,b,'private',sets);
  const hCapacity=sum(b.assets.filter(a=>a.kind==='electrolyzer'&&a.owner==='private'&&a.state!=='dismantled').map(a=>a.capacityU)),hCost=hydrogenCost(p,e,s.r,{planet:b.id,packaged:false}).totalCPerU;
  b.hydrogenUnitCostC=hCost;
  if(b.hydrogenPrice>hCost*(1+p.requiredMargin)&&b.hydrogenDesiredUseU>hCapacity)orderHydrogen(s,b,'private',Math.min(2,(b.hydrogenDesiredUseU-hCapacity)/e.hydrogenModuleU));
  const scaled=powerScale(e,s.r,'fission','large',m),modules=POWER_TYPES.fission.maxModules,creditC=scaled.base.creditC+scaled.module.creditC*modules,alloyU=scaled.base.alloyU+scaled.module.alloyU*modules,electricOutput=scaled.ratedGW*modules*e.fissionAvailability*730,net=electricOutput*(b.powerPriceC-e.fissionFuelCPerGWh)-creditC*e.directAnnual/12-alloyU*s.r['upkeep_'+b.id]*b.alloyPrice/12;
  const profitable=net>0&&(creditC+alloyU*b.alloyPrice)/(net*12)<e.privatePowerHorizonYears,pending=b.complexes.some(c=>c.owner==='private'&&(c.modules.length<c.wanted||b.assets.some(a=>a.complexId===c.id&&a.kind==='powerModule'&&a.completedMonth>m)));
  if(b.reserveFraction<e.gridReserve*.6&&profitable&&!pending)orderPowerComplex(s,b.id,'fission',modules,{owner:'private'});
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
  if(s.shipQueue.filter(x=>x.completedMonth>m).length<p.shipyardSlots){const kind=s.ships.length%3===0?'support':'explorer',def=ECON_SHIPS[kind];if(constructionPurchase(s,earth,'government',{creditC:def.creditC,alloyU:def.alloyU},'ship')){const ship={kind,completedMonth:m+def.months,alloyBasisQ:q(def.alloyU)};s.ships.push(ship);s.shipQueue.push(ship);earth.flow.shipOrders++;}}
 }
}
function accrueTotals(b){
 for(const [k,v]of Object.entries(b.flow))if(typeof v==='number'&&k!=='healthMin')b.total[k]+=v;
 b.total.healthMin=Math.min(b.total.healthMin,b.flow.healthMin);
 for(const [kind,v]of Object.entries(b.flow.maintenanceByKind)){const dst=b.total.maintenanceByKind[kind]??={requiredU:0,paidU:0,directC:0,pausedRequiredU:0};for(const k of Object.keys(v))dst[k]+=v[k];}
}
export function round41Snapshot(s){
 const row=round4Snapshot(s);if(s.round41Off)return row;
 row.round41=Object.fromEntries(Object.values(s.planets).map(b=>[b.id,{...b.shortage41,triageApplied:Boolean(s.r41.triageEnabled&&b.shortage41.active),...b.policyStats41,deferredU:sum(b.assets.map(a=>(a.lifeDeferredQ??0)/1000)),accruedU:sum(b.assets.map(a=>(a.lifeAccruedQ??0)/1000)),repaidU:sum(b.assets.map(a=>(a.lifeRepaidQ??0)/1000)),lifeHealthMin:Math.min(1,...b.assets.filter(a=>upkeepPriority(a)===0&&a.state!=='dismantled').map(a=>a.health))}]));
 return row;
}
export function assertRound41Economy(s){assertRound4Economy(s);if(!s.round41Off)assertPolicy41(s);return true;}
export function tickRound41Economy(s){
 if(s.round41Off)return tickRound4Economy(s);
 const p=s.p,e=s.e,m=s.month;
 for(const b of Object.values(s.planets)){
  b.flow=baseFlow();for(const owner of ['government','private']){const loss=consume(s,b.id,owner,'hydrogen',stock(s,b.id,owner,'hydrogen')*s.r.boiloffMonthly,'hydrogen-boiloff');b.flow.boiloffU+=loss;}const shock=p.productivityShock*normal(s.seed,m)/Math.sqrt(12);
  b.potentialGDP*=Math.pow(1+p.productivityGrowth,1/12)*Math.exp(shock)*(b.id==='earth'?Math.pow(1+p.earthPopulationGrowth,1/12):Math.pow(1+p.colonyPopulationGrowth,1/12));
  b.population*=Math.pow(1+(b.id==='earth'?p.earthPopulationGrowth:p.colonyPopulationGrowth),1/12);
  b.powerPriceC=e.electricityGDPShare*p.bodies.earth.annualGDP/(e.earthBaseGW*8760)*Math.exp(e.powerScarcityElasticity*clamp(-(b.reserveFraction??0),0,3));
 }
 fiscal(s);scenarioEvents(s);aggregatePrivatePower(s);round4Events(s);
 for(const b of Object.values(s.planets)){completeDismantles(s,b);lifecycleDecisions(s,b);planColonySupply(s,b);}
 for(const b of Object.values(s.planets)){
  const observation={freeU:sum(['government','private'].map(owner=>stock(s,b.id,owner,'alloy'))),needU:maintenanceNeed41(b,s.e,s.r,m),month:m};
  b.shortage41=updateShortage41(b.shortage41,observation,s.r41);
  if(b.shortage41.changed)s.relief41.mode.push({planet:b.id,month:m,...b.shortage41});
  const purchase=emergencyMarket41(s,b,s.r41);if(purchase){s.relief41.market.push(purchase);b.policyStats41.marketU+=purchase.amountU;b.policyStats41.marketC+=purchase.cashC;b.flow.purchasesC+=purchase.cashC;}
 }
 planEmergencyImports41(s);
 // When imports exist, settle their actual source grids first in this same
 // month; delivered material is then available for Earth's maintenance.
 const order=s.shipments.some(x=>x.emergency41)?[s.planets.moon,s.planets.mars,s.planets.earth]:Object.values(s.planets);
 for(const b of order){
  upkeepRound41(s,b);
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
  for(const a of b.assets.filter(a=>a.kind==='industry'&&a.owner==='private'&&a.state!=='dismantled'&&a.completedMonth<=m))a.sets*=1-p.privateDepreciation/12;
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
 assertRound41Economy(s);return round41Snapshot(s);
}
export function simulateRound41Economy(p,e,inputs,options={}){
 if(options.round41Enabled===false)return simulateRound4Economy(p,e,inputs,options);
 const s=createRound41Economy(p,e,inputs,options),rows=[round41Snapshot(s)];
 for(let i=0;i<(options.months??240);i++)rows.push(tickRound41Economy(s));
 return {state:s,rows};
}

function scheduleShipment(s,to,resourceId,u,{fromOwner='government',toOwner='government',priceC=0}={}){
 const amountQ=q(u);if(!amountQ)return;
 const pending=s.shipments.find(x=>x.to.planet===to&&x.resourceId===resourceId&&x.from.owner===fromOwner&&x.to.owner===toOwner);if(pending){pending.amountQ=Math.max(pending.amountQ,amountQ);return;}
 s.shipments.push({from:{planet:'earth',owner:fromOwner},to:{planet:to,owner:toOwner},resourceId,amountQ,marketPriceC:priceC,month:s.month});
}
function runShipments(s,b,budgetGWh,reservedHydrogen={}){
 const budget={remainingGWh:Math.max(0,budgetGWh),usedGWh:0};
 for(const request of [...s.shipments].filter(x=>x.from.planet===b.id)){
  try{if(request.emergency41){const bounded=protectedExportQ41(s,b,request.from.owner,request.amountQ,s.r41);if(!bounded.amountQ)continue;request.amountQ=bounded.amountQ;request.sourceReserveQ=bounded.reserveQ;request.sourcePlanetReserveQ=bounded.planetReserveQ;}if(request.resourceId==='hydrogen'&&request.amountQ/1000>Math.max(0,stock(s,b.id,request.from.owner,'hydrogen')-(reservedHydrogen[request.from.owner]??0)))continue;const record=transferRound4(s.book,request,s.r,{powerBudget:budget,priceIndex:s.priceIndex,recovery:s.packageRecovery,trace:s.shipmentHistory});if(request.emergency41){record.sourceAfterQ=s.book.get(account(b.id,request.from.owner,'alloy'));record.sourcePlanetAfterQ=sum(['government','private'].map(owner=>s.book.get(account(b.id,owner,'alloy'))));s.relief41.imports.push(record);const t=s.planets[request.to.planet].policyStats41;t.importU+=record.amountQ/1000;t.importGoodsC+=record.goodsPaymentC;t.importServiceC+=record.servicesC;t.importEnergyGWh+=record.energyGWh;}b.flow.packagingC+=record.servicesC;if(request.from.owner==='government')b.flow.packagingGovernmentGWh+=record.energyGWh;b.flow.shippingAlloyU+=request.resourceId==='alloy'?request.amountQ/1000:0;b.flow.shippingHydrogenU+=request.resourceId==='hydrogen'?request.amountQ/1000:0;s.shipments.splice(s.shipments.indexOf(request),1);s.events.push({event:'paid-SCU-shipment',month:s.month,...record});}
  catch(error){if(!/unavailable/.test(error.message))throw error;}
 }
 b.flow.packagingGWh+=budget.usedGWh;return budget.usedGWh;
}
export function pauseRound4(s,b,a){
 if(a.completedMonth>s.month||['paused','dismantling','dismantled'].includes(a.state))return false;
 a.state=a.kind==='powerModule'&&a.type==='fusion'?'coldStopped':'paused';a.manualPause=true;a.progressHours=0;a.startPaid=false;a.pausedMonths=0;
 s.events.push({event:'facility-paused',month:s.month,planet:b.id,owner:a.owner,asset:a.id});return true;
}
export function restartRound4(s,b,a){
 if(!['paused','coldStopped'].includes(a.state))return false;
 if(a.kind==='powerModule'&&a.type==='fusion'){a.state='coldStopped';a.manualPause=false;return true;}
 const cost=restartCharge(a,s.r).creditC*s.priceIndex;if(stock(s,b.id,a.owner,'C')<cost)return false;
 const paid=pay(s,b.id,a.owner,'household',cost,'facility-restart:C');b.flow.restartC+=paid;
 a.state='active';a.manualPause=false;a.restartMonth=s.month;a.pausedMonths=0;a.lossMonths=0;
 s.events.push({event:'facility-restart',month:s.month,planet:b.id,asset:a.id,owner:a.owner,creditC:paid,miningHours:a.kind==='industry'?48:0,smelterHeatHours:a.kind==='industry'?96:0});return true;
}
export function dismantleRound4(s,b,a,{governmentPolicy=false}={}){
 if(a.owner==='government'&&!governmentPolicy)return false;
 const quote=dismantleQuote(a,s.r,s.month),cost=quote.creditC*s.priceIndex;if(stock(s,b.id,a.owner,'C')<cost)return false;
 b.flow.dismantleC+=pay(s,b.id,a.owner,'household',cost,'dismantling:C');a.state='dismantling';a.dismantleEnd=quote.endMonth;a.salvageU=quote.returnedU;
 s.events.push({event:'dismantling-ordered',month:s.month,planet:b.id,owner:a.owner,asset:a.id,...quote});return true;
}
function completeDismantles(s,b){
 for(const a of b.assets.filter(a=>a.state==='dismantling'&&a.dismantleEnd<=s.month)){
  const amountQ=q(a.alloyBasisU),returnedQ=Math.floor(amountQ*s.r.salvageFraction),capital=account(b.id,a.owner,'capitalAlloy');
  if(returnedQ) s.book.move(capital,account(b.id,a.owner,'alloy'),returnedQ,'dismantling-salvage');if(amountQ-returnedQ)s.book.sink(capital,amountQ-returnedQ,'dismantling-loss');
  a.state='dismantled';a.lastUtilization=0;b.flow.salvageU+=returnedQ/1000;s.events.push({event:'dismantled',month:s.month,planet:b.id,owner:a.owner,asset:a.id,returnedU:returnedQ/1000,lostU:(amountQ-returnedQ)/1000});
 }
}
export function expectedMargin41(s,b,a){
 const bill=round4Bill({...a,state:'active',lastUtilization:1},s.e,s.r,b.id,s.month);
 if(a.kind==='industry'){const plan=industryPlan(s,b,{...a,state:'active',health:1,cashFraction:1,restartMonth:undefined},s.month,{ore:{[a.owner]:0},hydrogen:{[a.owner]:1e15}});return plan.alloyU*b.alloyPrice-bill.directC-bill.alloyU*b.alloyPrice-plan.energyGWh*b.powerPriceC-plan.hydrogenU*b.hydrogenPrice;}
 if(a.kind==='electrolyzer')return a.capacityU*(b.hydrogenPrice-hydrogenCost(s.p,s.e,s.r,{planet:b.id,packaged:false}).totalCPerU);
 if(a.kind==='legacyGrid')return b.population>0?Math.max(1,a.capacityGW*730*b.powerPriceC-bill.directC-bill.alloyU*b.alloyPrice): -bill.directC;
 if(a.kind==='powerModule'||a.kind==='privateGridExpansion')return (a.ratedGW??a.capacityGW??POWER_TYPES[a.type]?.ratedGW??0)*730*(a.type==='solar'?solarFactor(s,b,s.month):s.e.fissionAvailability)*b.powerPriceC-bill.directC-bill.alloyU*b.alloyPrice;
 return 1;
}
function lifecycleDecisions(s,b){
 if(!s.r.lifecycleEnabled)return;
 for(const a of b.assets){if(a.completedMonth>s.month||a.state==='dismantled')continue;
  if(a.owner==='private'&&s.r.privateLifecycleEnabled!==false){
   const margin=expectedMargin41(s,b,a);a.lossMonths=margin<0?(a.lossMonths??0)+1:0;if(['paused','coldStopped'].includes(a.state))a.pausedMonths++;
   const action=privateAction(a,s.r,{expectedMonthlyMargin:margin,restartCostC:restartCharge(a,s.r).creditC,month:s.month});if(s.capturePrivateDecisions)s.relief41.privateDecisions.push({month:s.month,planet:b.id,asset:a.id,kind:a.kind,state:a.state,margin,lossMonths:a.lossMonths,pausedMonths:a.pausedMonths,threshold:s.r.privateDismantleMonths,action});
   if(action==='pause')pauseRound4(s,b,a);else if(action==='restart')restartRound4(s,b,a);else if(action==='dismantle'&&s.r.dismantleEnabled!==false)dismantleRound4(s,b,a);
  }
 }
}
function planColonySupply(s,b){
 if(b.id==='earth'||s.scenario==='E4')return;
 if(s.r.publicColonyResponse&&['S0','S1','S2','E0','E1'].includes(s.scenario)&&s.month%12===0&&!b.complexes.some(c=>c.autoResponse)){
  const legacy=b.assets.find(a=>a.kind==='legacyGrid'),demand=b.population*s.e.colonyKWPerPerson/1e6;
  if(legacy.capacityGW<demand*(1+s.e.gridReserve)){
   const size=powerScale(s.e,s.r,'fission','small',s.month),needed=size.base.alloyU+size.module.alloyU-stock(s,b.id,'government','alloy');if(needed>0)scheduleShipment(s,b.id,'alloy',needed);
   const c=orderPowerComplex(s,b.id,'fission',1,{size:'small'});if(c){c.autoResponse=true;s.events.push({event:'funded-public-colony-response',month:s.month,planet:b.id,demandGW:demand,ratedGW:size.ratedGW});}
  }
 }
 // The existing lunar/Martian settlements have demand even in E0. Recurring
 // supply is paid, finite, packaged and may fail at the source.
 if(s.month%3!==0)return;
 for(const owner of ['government','private']){
  const generalTargetU=owner==='private'?Math.max(b.initialGeneralAlloyU,b.flow.generalAlloyDemandU??0)*3:0;
  const need=Math.max(0,generalTargetU+sum(b.assets.filter(a=>a.owner===owner&&a.completedMonth<=s.month&&a.state!=='dismantled').map(a=>round4Bill(a,s.e,s.r,b.id,s.month).alloyU))*12-stock(s,b.id,owner,'alloy'));
  const price=s.planets.earth.alloyPrice,affordable=owner==='private'?stock(s,b.id,owner,'C')*.8/(price+4*(s.r.packCPerSCU+s.r.freightCPerSCU)):need,amount=Math.min(need,affordable);
  if(amount>.001)scheduleShipment(s,b.id,'alloy',amount,{fromOwner:owner,toOwner:owner,priceC:owner==='private'?price:0});
 }
}
export function upgradeRound4Power(s,b,c,toSize){
 const siteId=c.modules[0],fromSize=c.siteSizes?.[siteId]??c.size,quote=upgradeScale(s.e,s.r,c.type,fromSize,toSize,s.month),old=b.assets.filter(a=>(a.id===siteId||a.siteId===siteId)&&a.kind==='powerModule'&&a.state!=='dismantled');if(!old.length)return false;
 const cost={creditC:quote.base.creditC+quote.module.creditC,alloyU:(q(quote.base.alloyU)+q(quote.module.alloyU))/1000,hydrogenU:quote.buildHydrogenU};
 if(!constructionPurchase(s,b,c.owner,cost,'same-site-upgrade'))return false;
 for(const a of old){a.derateUntil=s.month+quote.months;a.derateFraction=quote.derateFraction;}
 addAsset(b,{kind:'powerBase',type:c.type,owner:c.owner,complexId:c.id,completedMonth:s.month+quote.months,state:'construction',creditBasisC:quote.base.creditC,alloyBasisU:quote.base.alloyU});
 const a=addAsset(b,{kind:'powerModule',type:c.type,owner:c.owner,complexId:c.id,siteId:c.modules[0],size:toSize,ratio:quote.ratio,ratedGW:quote.addedGW,startC:quote.startC,completedMonth:s.month+quote.months,state:'construction',creditBasisC:quote.module.creditC,alloyBasisU:quote.module.alloyU,progressHours:0,startPaid:false,starts:0});
 c.siteSizes??={};c.siteSizes[siteId]=toSize;s.events.push({event:'same-site-upgrade',month:s.month,planet:b.id,asset:a.id,...quote});return true;
}
function round4Events(s){
 const m=s.month,c=s.scenario,b=s.planets.earth;
 if(['E2-S','E9'].includes(c))for(const id of ['moon','mars']){const body=s.planets[id];if(!body.complexes.length){const def=powerScale(s.e,s.r,'fission','small',m),modules=Math.min(POWER_TYPES.fission.maxModules,Math.max(1,Math.ceil(body.population*s.e.colonyKWPerPerson/1e6*.4/(def.ratedGW*s.e.fissionAvailability))));orderPowerComplex(s,id,'fission',modules,{size:'small'});}const active=body.complexes.find(x=>x.type==='fission');if(active&&m===36)upgradeRound4Power(s,body,active,'medium');if(active&&m===120)upgradeRound4Power(s,body,active,'large');if(c==='E9'&&m===s.r.fusionUnlockMonth)orderPowerComplex(s,id,'fusion',1,{size:'medium'});}
 if(c==='E10'){
  if(!b.complexes.length)orderPowerComplex(s,'earth','fission',1,{size:s.r.directLarge?'large':'small'});
  const site=b.complexes[0];if(site&&!s.r.directLarge&&[36,84].includes(m))upgradeRound4Power(s,b,site,m===36?'medium':'large');
 }
 if((['E5-X','E11'].includes(c)||mediumStress41(c))&&s.r.lifecycleEnabled){
  if(m===60)for(const a of b.assets.filter(a=>['industry','electrolyzer'].includes(a.kind)&&(a.owner==='government'?s.r.governmentLifecycleEnabled!==false:s.r.privateLifecycleEnabled!==false)))pauseRound4(s,b,a);
  if(m===s.stress41.startMonth+s.stress41.stopMonths&&s.r.governmentLifecycleEnabled!==false)for(const a of b.assets.filter(a=>a.owner==='government'))restartRound4(s,b,a);
  if((['E11','E11-M'].includes(c)||s.r.governmentDismantle)&&m===66){const a=b.assets.find(a=>a.kind==='industry'&&a.owner==='government'&&a.completedMonth<=m);if(a)dismantleRound4(s,b,a,{governmentPolicy:true});}
 }
 if(c==='E6-R'&&m%12===0&&m>=36&&m<=120){for(const a of b.assets.filter(a=>a.owner==='government'&&a.completedMonth<=m))if(m%24===12)pauseRound4(s,b,a);else restartRound4(s,b,a);}
}

// Cache the imported unit-capacity function, then scale its linear sets/ratio.
// Policies, efficiencies and ramp shape remain owned by the actual Round3 helper.
const capacityCache=new Map();
function industryCapacity(args){
 const age=Math.max(-1,Math.min(50,args.month-(args.completedMonth??-100))),key=[args.difficulty,args.processingDifficulty,age].join('|');let unit=capacityCache.get(key);
 if(!unit){unit=rawIndustryCapacity({...args,sets:1,mineRatio:1,completedMonth:0,month:age});capacityCache.set(key,unit);}
 return {mineU:unit.mineU*args.sets*(args.mineRatio??1),processU:unit.processU*args.sets,ramp:unit.ramp};
}

function weightedHealth(assets){return sum(assets.map(a=>a.health*(a.moduleCount??1)))/Math.max(1,sum(assets.map(a=>a.moduleCount??1)));}
function aggregatePrivatePower(s){
 for(const b of Object.values(s.planets)){const groups=new Map(),remove=new Set();
  for(const a of b.assets)if(a.kind==='powerModule'&&a.owner==='private'&&a.type==='fission'&&a.state==='active'&&a.health===1&&a.backlogU===0&&!a.manualPause){const key=[a.complexId,a.completedMonth,a.lastUtilization??1].join('|');const first=groups.get(key);if(!first){groups.set(key,a);continue;}for(const field of ['ratedGW','creditBasisC','alloyBasisU'])first[field]+=a[field];first.alloyBasisU=q(first.alloyBasisU)/1000;first.moduleCount=(first.moduleCount??1)+(a.moduleCount??1);remove.add(a.id);}
  if(remove.size)b.assets=b.assets.filter(a=>!remove.has(a.id));
 }
}

function planEmergencyImports41(s){
 // Failed offers are reconsidered against THIS month's shortage and donor
 // budget; a stale offer may not ship after the emergency has ended.
 s.shipments=s.shipments.filter(x=>!x.emergency41);
 if(!s.r41.importRelief||!s.planets.earth.shortage41.active)return;
 const earth=s.planets.earth,needU=Math.max(0,maintenanceNeed41(earth,s.e,s.r,s.month)*s.r41.enterMonths+sum(earth.assets.filter(a=>a.state!=='dismantled').map(a=>a.backlogU))-stock(s,'earth','government','alloy'));
 let remainingQ=q(needU);
 // Existing settlements only; no invented donor reserves or outside source.
 for(const id of ['moon','mars'])for(const owner of ['government','private']){
  if(remainingQ<=0)return;
  if(s.shipments.some(x=>x.emergency41&&x.from.planet===id&&x.from.owner===owner))continue;
  const b=s.planets[id],bounded=protectedExportQ41(s,b,owner,remainingQ,s.r41);if(!bounded.amountQ)continue;
  s.shipments.push({from:{planet:id,owner},to:{planet:'earth',owner:'government'},resourceId:'alloy',amountQ:bounded.amountQ,marketPriceC:b.alloyPrice,month:s.month,emergency41:true,sourceReserveQ:bounded.reserveQ,sourcePlanetReserveQ:bounded.planetReserveQ});remainingQ-=bounded.amountQ;
 }
}
