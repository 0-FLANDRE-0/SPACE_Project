// ECON-SIM-1: isolated exploratory model. No game runtime, storage, DOM or clock.
import {INDUSTRY_POLICY as INDUSTRY_TIME,FACILITY_TYPES,MINING,SMELTING,extractionEfficiency,rampDurationMonths,processingEfficiency} from './industry-policy.js';
import {facilityCapacity} from './industry-runtime.js';
import {INITIAL_ALLOY_YIELDS,validateGradeProbabilities,resourceRandom} from './ore-quality.js';
import {PERSONS_PER_POP,TONNES_PER_RESOURCE_U} from './resource-definitions.js';
export const ECON_SHIPS=Object.freeze({support:Object.freeze({creditC:25000,alloyU:750,months:5.5}),explorer:Object.freeze({creditC:32500,alloyU:215,months:5.5})});
export const ECON_SCENARIOS=Object.freeze(['S0','S1','S2','S3-debt','S3-money','S4']);
export const ECON_Q=1000;
const q=x=>Math.round(x*ECON_Q),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const assert=(ok,message)=>{if(!ok)throw Error('ECON-SIM-1: '+message);};
const annualToMonthly=r=>Math.pow(1+r,1/12);
function quantize(holder,key,raw){const n=raw+(holder[key]??0),v=Math.floor(n+1e-9);holder[key]=n-v;return v;}
function normal(seed,month){const u=Math.max(1e-12,resourceRandom(seed,month,'productivity-u')),v=resourceRandom(seed,month,'productivity-v');return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
export function industryExpectation(p){
 const mine=FACILITY_TYPES[MINING],smelt=FACILITY_TYPES[SMELTING];validateGradeProbabilities(p.gradeProbabilities);
 const yieldFraction=Object.entries(INITIAL_ALLOY_YIELDS).reduce((s,[g,y])=>s+p.gradeProbabilities[g]*y,0);
 const oreU=mine.capacityU*extractionEfficiency(p.difficulty),processingU=smelt.capacityU*processingEfficiency(p.processingDifficulty);
 const alloyU=Math.min(oreU,processingU)*yieldFraction;
 const creditC=mine.creditC+smelt.creditC,alloyInputU=mine.alloyU+smelt.alloyU,hydrogenInputU=mine.hydrogenU+smelt.hydrogenU;
 const totalInvestmentC=creditC+alloyInputU*p.baseAlloyPrice+hydrogenInputU*p.hydrogenPrice;
 return {creditC,alloyInputU,hydrogenInputU,totalInvestmentC,oreU,processingU,alloyU,yieldFraction,rampMonths:rampDurationMonths(p.difficulty),tonnesPerU:TONNES_PER_RESOURCE_U};
}
// Integral of the campaign's 10% -> 100% linear readiness curve, with exact
// fractional-month commissioning. Production decisions still occur monthly.
const rampCurves=new Map();
function rampIntegral(from,to,completion,difficulty){
 const ramp=rampDurationMonths(difficulty),a=Math.max(0,from-completion),b=Math.max(0,to-completion);
 if(!rampCurves.has(difficulty)){
  const record={activeDepositIds:['reference'],segments:[{completedTick:0,upgradedTick:null}]},catalog={deposits:new Map([['reference',{extractionDifficulty:difficulty}]])};
  const initial=facilityCapacity(record,catalog,0).ramp,full=facilityCapacity(record,catalog,ramp*INDUSTRY_TIME.monthDays*INDUSTRY_TIME.ticksPerDay).ramp;
  rampCurves.set(difficulty,{initial,full});
 }
 const {initial,full}=rampCurves.get(difficulty);
 const primitive=t=>t<=ramp?initial*t+(full-initial)*t*t/(2*ramp):full*t-(full-initial)*ramp/2;
 return primitive(b)-primitive(a);
}
function producePlant(plant,p,month,tech){
 const mined=quantize(plant.remainders,'ore',FACILITY_TYPES[MINING].capacityU*extractionEfficiency(p.difficulty)*rampIntegral(month,month+1,plant.started+FACILITY_TYPES[MINING].months,p.difficulty)*ECON_Q);
 plant.oreQ+=mined;
 const capacity=quantize(plant.remainders,'process',FACILITY_TYPES[SMELTING].capacityU*processingEfficiency(p.processingDifficulty)*rampIntegral(month,month+1,plant.started+FACILITY_TYPES[SMELTING].months,p.difficulty)*ECON_Q);
 const processed=Math.min(capacity,plant.oreQ),alloy=quantize(plant.remainders,'yield',processed*tech.yieldFraction);plant.oreQ-=processed;
 return {mined,processed,alloy,residue:processed-alloy};
}
export function setPayback(p,{operatingRate=p.governmentOperatingRate,maxMonths=600}={}){
 const tech=industryExpectation(p),plant={started:0,oreQ:0,remainders:{}};
 let netC=0,breakEvenMonths=null;
 for(let t=0;t<maxMonths;t++){
  const out=producePlant(plant,p,t,tech),revenue=out.alloy/ECON_Q*p.baseAlloyPrice;
  const active=.5*(clamp(t+1-FACILITY_TYPES[MINING].months,0,1)+clamp(t+1-FACILITY_TYPES[SMELTING].months,0,1));
  const profit=revenue-tech.totalInvestmentC*operatingRate/12*active,previous=netC;netC+=profit;
  if(netC>=tech.totalInvestmentC){breakEvenMonths=t+(tech.totalInvestmentC-previous)/profit;break;}
 }
 const monthlyNet=tech.alloyU*p.baseAlloyPrice-tech.totalInvestmentC*operatingRate/12;
 return {investmentC:tech.totalInvestmentC,matureAlloyU:tech.alloyU,matureGrossRevenueC:tech.alloyU*p.baseAlloyPrice,steadyYears:monthlyNet>0?tech.totalInvestmentC/monthlyNet/12:null,fromOrderYears:breakEvenMonths===null?null:breakEvenMonths/12};
}
export function migratePopulation(state,from,to,persons){
 assert(from!==to&&state.bodies[from]&&state.bodies[to],'migration bodies');assert(Number.isSafeInteger(persons)&&persons>=0&&persons<=state.bodies[from].population,'migration persons');
 state.bodies[from].population-=persons;state.bodies[to].population+=persons;
}
const creditCategories=['budgetQ','salesQ','borrowingQ','monetizationQ','maintenanceQ','operatingQ','supportQ','interestQ','constructionQ','shipCostQ','alloyPurchasesQ','hydrogenPurchasesQ'];
const incomeKeys=['budgetQ','salesQ','borrowingQ','monetizationQ'],expenseKeys=creditCategories.filter(k=>!incomeKeys.includes(k));
export function createEconomy(p,{seed='econ-1',scenario='S0',moneyRule='growth',indexed=true}={}){
 assert(ECON_SCENARIOS.includes(scenario),'unknown scenario');assert(['growth','fixed'].includes(moneyRule),'money rule');
 validateParameters(p);
 const tech=industryExpectation(p),bodies={};
 for(const [id,b]of Object.entries(p.bodies))bodies[id]={population:b.populationPersons,productivity:b.annualGDP/b.populationPersons*PERSONS_PER_POP,taxRate:id==='earth'?p.earthTaxRate:b.taxRate,collectionEfficiency:b.collectionEfficiency??1,populationRemainder:0,growthRate:id==='earth'?p.earthPopulationGrowth:p.colonyPopulationGrowth};
 const realGDP=Object.values(p.bodies).reduce((n,b)=>n+b.annualGDP,0),monthlyDemand=p.bodies.earth.annualGDP*p.alloyMarketShare/p.baseAlloyPrice/12;
 const moneyQ=q(realGDP/p.velocity),marketQ=q(monthlyDemand*p.inventoryDays/30);
 const ledger=Object.fromEntries(creditCategories.map(k=>[k,0]));
 Object.assign(ledger,{taxQ:0,fixedSpendingQ:0,govProducedQ:0,govPurchasedQ:0,govUsedQ:0,govSoldQ:0,privateProducedQ:0,privateUsedQ:0,governmentOreMinedQ:0,governmentOreProcessedQ:0,governmentResidueQ:0,privateOreMinedQ:0,hydrogenPurchasedQ:0,hydrogenUsedQ:0,normalIssuanceQ:0});
 const ships=[{kind:'support',completed:0},{kind:'explorer',completed:0},{kind:'explorer',completed:0}];
 return {p,seed,scenario,moneyRule,indexed,tech,month:0,bodies,realGDP,earthGDP:p.bodies.earth.annualGDP,initialGDP:realGDP,priceIndex:1,realAlloyPrice:p.baseAlloyPrice,moneyQ,initialMoneyQ:moneyQ,treasuryQ:q(p.initialTreasuryC),initialTreasuryQ:q(p.initialTreasuryC),debtQ:0,marketQ,initialMarketQ:marketQ,governmentAlloyQ:q(p.initialAlloyU),initialGovernmentAlloyQ:q(p.initialAlloyU),governmentHydrogenQ:q(p.initialHydrogenU),initialGovernmentHydrogenQ:q(p.initialHydrogenU),privateCapacityU:monthlyDemand,capacityQueue:[],demandHistory:[],plants:[],colonialFacilities:0,ships,nextShip:'support',ledger,remainders:{},warPurchasedQ:0,skippedOrders:0,lastFlow:null};
}
export function validateParameters(p){
 const finite=['baseAlloyPrice','hydrogenPrice','velocity','productivityGrowth','earthPopulationGrowth','colonyPopulationGrowth','targetInflation','earthTaxRate','strategyShare','alloyMarketShare','demandElasticity','inventoryDays','priceAdjustment','priceReversion','priceFloor','priceCeiling','expansionDelayMonths','expansionBeta','privateDepreciation','privateAmortizationYears','privateOperatingRate','privateScale','requiredMargin','shipMaintenanceRate','governmentOperatingRate','colonySupportC','productivityShock','difficulty','processingDifficulty','initialTreasuryC','initialAlloyU','initialHydrogenU','debtInterestRate','warStartMonth','warDurationMonths','warPurchaseMonths','warAlloyU','warStrategyShare','warMonetizationFraction','colonySupportMultiplier','colonyBuildEveryMonths','supplyConstraintStrength','governmentSaleFraction','privateForecastMonths','shipyardSlots'];
 for(const k of finite)assert(Number.isFinite(p[k]),'invalid '+k);
 for(const k of finite.filter(k=>!['earthPopulationGrowth','productivityGrowth','colonyPopulationGrowth'].includes(k)))assert(p[k]>=0,'negative '+k);
 assert(p.velocity>0&&p.baseAlloyPrice>0&&p.inventoryDays>0&&p.privateAmortizationYears>0&&p.privateScale>0&&p.expansionDelayMonths>=1,'positive denominator');
 assert(p.earthPopulationGrowth> -1&&p.productivityGrowth> -1&&p.colonyPopulationGrowth> -1&&p.priceFloor>0&&p.priceCeiling>=p.priceFloor,'growth/bounds');
 for(const k of ['earthTaxRate','strategyShare','warStrategyShare','warMonetizationFraction','governmentSaleFraction','supplyConstraintStrength'])assert(p[k]<=1,'fraction '+k);
 assert(Number.isInteger(p.shipyardSlots)&&p.shipyardSlots>=1&&Number.isInteger(p.privateForecastMonths)&&p.privateForecastMonths>=1&&p.privateDepreciation<1,'capacity policy');
 assert(Number.isInteger(p.warPurchaseMonths)&&p.warPurchaseMonths>0&&p.warDurationMonths>=p.warPurchaseMonths,'war months');
 for(const b of Object.values(p.bodies))assert(Number.isSafeInteger(b.populationPersons)&&b.populationPersons>0&&b.annualGDP>0&&b.taxRate>=0&&b.taxRate<=1&&(b.collectionEfficiency??1)>=0&&(b.collectionEfficiency??1)<=1,'initial body');
 validateGradeProbabilities(p.gradeProbabilities);return p;
}
function snapshot(s){
 const p=s.p,flow=s.lastFlow;
 return {month:s.month,realGDP:s.realGDP,earthGDP:s.earthGDP,nominalGDP:s.realGDP*s.priceIndex,priceIndex:s.priceIndex,realAlloyPrice:s.realAlloyPrice,nominalAlloyPrice:s.realAlloyPrice*s.priceIndex,moneyC:s.moneyQ/ECON_Q,treasuryC:s.treasuryQ/ECON_Q,debtC:s.debtQ/ECON_Q,marketInventoryU:s.marketQ/ECON_Q,governmentInventoryU:s.governmentAlloyQ/ECON_Q,privateCapacityU:s.privateCapacityU,privateSupplyU:(flow?.privateProducedQ??0)/ECON_Q,governmentSupplyU:(flow?.govProducedQ??0)/ECON_Q,annualBudgetC:flow?flow.budgetQ/ECON_Q*12:Object.values(s.bodies).reduce((n,b)=>n+b.population/PERSONS_PER_POP*b.productivity*b.taxRate*b.collectionEfficiency*p.strategyShare,0),annualSupportC:flow?flow.supportQ/ECON_Q*12:p.colonySupportC*(s.scenario==='S4'?p.colonySupportMultiplier:1),population:Object.fromEntries(Object.entries(s.bodies).map(([id,b])=>[id,b.population])),activeShips:s.ships.filter(x=>x.completed<=s.month).length,orderedShips:s.ships.length-3,governmentSets:s.plants.length,colonialFacilities:s.colonialFacilities,warPurchasedU:s.warPurchasedQ/ECON_Q,flow};
}
export function tickEconomy(s){
 const p=s.p,t=s.month,war=s.scenario.startsWith('S3')&&t>=p.warStartMonth&&t<p.warStartMonth+p.warDurationMonths,flow=Object.fromEntries(creditCategories.map(k=>[k,0]));
 Object.assign(flow,{openingQ:s.treasuryQ,taxQ:0,fixedSpendingQ:0,govProducedQ:0,privateProducedQ:0,privateUsedQ:0,governmentOreMinedQ:0,governmentOreProcessedQ:0,governmentResidueQ:0});
 const normalDemand=s.earthGDP*p.alloyMarketShare/p.baseAlloyPrice/12,targetStock=normalDemand*p.inventoryDays/30;
 const constraint=1-p.supplyConstraintStrength*clamp(1-s.marketQ/ECON_Q/Math.max(1,targetStock),0,1);
 const shock=p.productivityShock?normal(s.seed,t)*p.productivityShock/Math.sqrt(12):0;
 let realGDP=0,earthGDP=0;
 for(const [id,b]of Object.entries(s.bodies)){
  const next=b.population*annualToMonthly(b.growthRate)+b.populationRemainder,persons=Math.max(0,Math.floor(next));b.populationRemainder=next-persons;b.population=persons;
  b.productivity*=annualToMonthly(p.productivityGrowth)*Math.exp(shock-.5*p.productivityShock*p.productivityShock/12);
  const g=b.population/PERSONS_PER_POP*b.productivity*(id==='earth'?constraint:1);realGDP+=g;if(id==='earth')earthGDP=g;
 }
 const previousGDP=s.realGDP;s.realGDP=realGDP;s.earthGDP=earthGDP;
 if(s.moneyRule==='growth'){const next=quantize(s.remainders,'money',s.moneyQ*realGDP/previousGDP*annualToMonthly(p.targetInflation));s.ledger.normalIssuanceQ+=next-s.moneyQ;s.moneyQ=next;}
 s.priceIndex=(s.moneyQ/ECON_Q)*p.velocity/realGDP;
 const nominalPrice=s.realAlloyPrice*s.priceIndex,creditIndex=s.indexed?s.priceIndex:1;
 for(const b of Object.values(s.bodies)){const factor=b===s.bodies.earth?constraint:1;flow.taxQ+=q(b.population/PERSONS_PER_POP*b.productivity*factor*s.priceIndex*b.taxRate*b.collectionEfficiency/12);}
 flow.budgetQ=Math.round(flow.taxQ*(war?p.warStrategyShare:p.strategyShare));flow.fixedSpendingQ=flow.taxQ-flow.budgetQ;s.treasuryQ+=flow.budgetQ;
 const pay=(amount,key,{mandatory=false,monetized=false}={})=>{
  assert(Number.isSafeInteger(amount)&&amount>=0,'credit amount');
  if(monetized){s.moneyQ+=amount;s.treasuryQ+=amount;flow.monetizationQ+=amount;}
  if(s.treasuryQ<amount){if(!mandatory)return false;const loan=amount-s.treasuryQ;s.debtQ+=loan;s.treasuryQ+=loan;flow.borrowingQ+=loan;}
  s.treasuryQ-=amount;flow[key]+=amount;return true;
 };
 pay(q(s.debtQ/ECON_Q*p.debtInterestRate/12),'interestQ',{mandatory:true});
 for(const ship of s.ships)pay(q(ECON_SHIPS[ship.kind].creditC*p.shipMaintenanceRate/12*creditIndex*clamp(t+1-ship.completed,0,1)),'maintenanceQ',{mandatory:true});
 pay(q(p.colonySupportC/12*(s.scenario==='S4'?p.colonySupportMultiplier:1)*s.priceIndex),'supportQ',{mandatory:true});
 for(const plant of s.plants){
  const produced=producePlant(plant,p,t,s.tech);flow.govProducedQ+=produced.alloy;flow.governmentOreMinedQ+=produced.mined;flow.governmentOreProcessedQ+=produced.processed;flow.governmentResidueQ+=produced.residue;
  const active=.5*(clamp(t+1-plant.started-FACILITY_TYPES[MINING].months,0,1)+clamp(t+1-plant.started-FACILITY_TYPES[SMELTING].months,0,1));
  pay(q(s.tech.totalInvestmentC*p.governmentOperatingRate/12*s.priceIndex*active),'operatingQ',{mandatory:true});
 }
 s.governmentAlloyQ+=flow.govProducedQ;
 for(const item of s.capacityQueue)if(item.due===t)s.privateCapacityU+=item.amount;
 s.capacityQueue=s.capacityQueue.filter(item=>item.due>t);
 s.privateCapacityU*=annualToMonthly(-p.privateDepreciation);
 flow.privateProducedQ=quantize(s.remainders,'privateProduction',s.privateCapacityU*ECON_Q);s.marketQ+=flow.privateProducedQ;
 s.ledger.privateOreMinedQ+=Math.ceil(flow.privateProducedQ/s.tech.yieldFraction);
 const sold=Math.floor(flow.govProducedQ*p.governmentSaleFraction);s.governmentAlloyQ-=sold;s.marketQ+=sold;s.ledger.govSoldQ+=sold;
 flow.salesQ=q(sold/ECON_Q*nominalPrice);s.treasuryQ+=flow.salesQ;
 const buyAlloy=(amount,{mandatory=false,monetized=false}={})=>{
  if(amount>s.marketQ)return false;const cost=q(amount/ECON_Q*nominalPrice);if(!pay(cost,'alloyPurchasesQ',{mandatory,monetized}))return false;
  s.marketQ-=amount;s.governmentAlloyQ+=amount;s.ledger.govPurchasedQ+=amount;return true;
 };
 const construct=(alloyU,hydrogenU,creditC,kind)=>{
  const aq=q(alloyU),hq=q(hydrogenU),missing=Math.max(0,aq-s.governmentAlloyQ),missingH=Math.max(0,hq-s.governmentHydrogenQ),materialCost=q(missing/ECON_Q*nominalPrice),hydrogenCost=q(missingH/ECON_Q*p.hydrogenPrice*s.priceIndex),cost=q(creditC*creditIndex);
  if(s.marketQ<missing||s.treasuryQ<cost+materialCost+hydrogenCost){s.skippedOrders++;return false;}
  assert(buyAlloy(missing),'prechecked purchase');pay(hydrogenCost,'hydrogenPurchasesQ');s.governmentHydrogenQ+=missingH;s.ledger.hydrogenPurchasedQ+=missingH;
  s.governmentAlloyQ-=aq;s.governmentHydrogenQ-=hq;s.ledger.govUsedQ+=aq;s.ledger.hydrogenUsedQ+=hq;pay(cost,kind);return true;
 };
 if(war&&t<p.warStartMonth+p.warPurchaseMonths){
  const i=t-p.warStartMonth,total=q(p.warAlloyU),requested=Math.floor(total*(i+1)/p.warPurchaseMonths)-Math.floor(total*i/p.warPurchaseMonths),available=Math.min(requested,s.marketQ);
  const monetize=s.scenario==='S3-money',printed=monetize?Math.round(q(available/ECON_Q*nominalPrice)*p.warMonetizationFraction):0;
  if(printed){s.moneyQ+=printed;s.treasuryQ+=printed;flow.monetizationQ+=printed;}
  if(buyAlloy(available,{mandatory:true}))s.warPurchasedQ+=available;
 }
 if(s.scenario==='S1'&&t%12===0&&construct(s.tech.alloyInputU,s.tech.hydrogenInputU,s.tech.creditC,'constructionQ'))s.plants.push({started:t,oreQ:0,remainders:{}});
 if(s.scenario==='S2')while(s.ships.filter(x=>x.completed>t).length<p.shipyardSlots){
  const ship=ECON_SHIPS[s.nextShip];if(!construct(ship.alloyU,0,ship.creditC,'shipCostQ'))break;
  s.ships.push({kind:s.nextShip,completed:t+ship.months});s.nextShip=s.nextShip==='support'?'explorer':'support';
 }
 if(s.scenario==='S4'&&t%p.colonyBuildEveryMonths===0&&construct(s.tech.alloyInputU,s.tech.hydrogenInputU,s.tech.creditC,'constructionQ'))s.colonialFacilities++;
 const demandU=earthGDP*p.alloyMarketShare/p.baseAlloyPrice/12*Math.pow(s.realAlloyPrice/p.baseAlloyPrice,-p.demandElasticity),requested=quantize(s.remainders,'privateDemand',demandU*ECON_Q);
 flow.privateUsedQ=Math.min(s.marketQ,requested);s.marketQ-=flow.privateUsedQ;
 const updatedTarget=earthGDP*p.alloyMarketShare/p.baseAlloyPrice/12*p.inventoryDays/30,stockRatio=updatedTarget/Math.max(1,s.marketQ/ECON_Q);
 const logPrice=(1-p.priceReversion)*Math.log(s.realAlloyPrice/p.baseAlloyPrice)+p.priceAdjustment*clamp(Math.log(stockRatio),-2,2);
 s.realAlloyPrice=p.baseAlloyPrice*Math.exp(clamp(logPrice,Math.log(p.priceFloor),Math.log(p.priceCeiling)));
 const productionCost=s.tech.totalInvestmentC*(1/(p.privateAmortizationYears*12)+p.privateOperatingRate/12)/s.tech.alloyU*p.privateScale;
 const totalDemand=(requested+q(t>=p.warStartMonth&&t<p.warStartMonth+p.warPurchaseMonths&&war?p.warAlloyU/p.warPurchaseMonths:0))/ECON_Q;
 s.demandHistory.push(totalDemand);if(s.demandHistory.length>p.privateForecastMonths)s.demandHistory.shift();
 const forecast=s.demandHistory.reduce((a,b)=>a+b,0)/s.demandHistory.length,queued=s.capacityQueue.reduce((a,b)=>a+b.amount,0),replacement=s.privateCapacityU*(1-annualToMonthly(-p.privateDepreciation))*(p.expansionDelayMonths+1);
 const need=Math.max(0,forecast+(updatedTarget-s.marketQ/ECON_Q)/p.expansionDelayMonths+replacement-s.privateCapacityU-queued);
 if(s.realAlloyPrice>productionCost*(1+p.requiredMargin)&&need>0)s.capacityQueue.push({due:t+Math.round(p.expansionDelayMonths),amount:Math.min(s.privateCapacityU*p.expansionBeta,need)});
 s.priceIndex=(s.moneyQ/ECON_Q)*p.velocity/realGDP;
 for(const k of creditCategories)s.ledger[k]+=flow[k];
 for(const k of ['taxQ','fixedSpendingQ','govProducedQ','privateProducedQ','privateUsedQ','governmentOreMinedQ','governmentOreProcessedQ','governmentResidueQ'])s.ledger[k]+=flow[k];
 flow.closingQ=s.treasuryQ;
 assert(flow.taxQ===flow.budgetQ+flow.fixedSpendingQ,'tax ledger');
 assert(flow.closingQ===flow.openingQ+incomeKeys.reduce((n,k)=>n+flow[k],0)-expenseKeys.reduce((n,k)=>n+flow[k],0),'treasury ledger');
 s.month++;s.lastFlow=flow;assertEconomy(s);return snapshot(s);
}
export function assertEconomy(s){
 const l=s.ledger;
 for(const v of [s.moneyQ,s.treasuryQ,s.debtQ,s.marketQ,s.governmentAlloyQ,s.governmentHydrogenQ,...Object.entries(l).filter(([k])=>k!=='normalIssuanceQ').map(([,v])=>v),...Object.values(s.bodies).map(b=>b.population)])assert(Number.isSafeInteger(v)&&v>=0,'integer/nonnegative stock');
 assert(s.moneyQ===s.initialMoneyQ+l.normalIssuanceQ+l.monetizationQ,'money ledger');
 assert(s.debtQ===l.borrowingQ,'debt ledger');
 assert(s.treasuryQ===s.initialTreasuryQ+incomeKeys.reduce((n,k)=>n+l[k],0)-expenseKeys.reduce((n,k)=>n+l[k],0),'cumulative credit ledger');
 assert(s.governmentAlloyQ===s.initialGovernmentAlloyQ+l.govProducedQ+l.govPurchasedQ-l.govUsedQ-l.govSoldQ,'government alloy ledger');
 assert(s.marketQ===s.initialMarketQ+l.privateProducedQ+l.govSoldQ-l.privateUsedQ-l.govPurchasedQ,'market alloy ledger');
 assert(s.governmentHydrogenQ===s.initialGovernmentHydrogenQ+l.hydrogenPurchasedQ-l.hydrogenUsedQ,'hydrogen ledger');
 assert(l.governmentOreMinedQ===s.plants.reduce((n,x)=>n+x.oreQ,0)+l.governmentOreProcessedQ,'ore stock ledger');
 assert(l.governmentOreProcessedQ===l.govProducedQ+l.governmentResidueQ,'smelting mass');
 for(const v of [s.realGDP,s.priceIndex,s.realAlloyPrice,s.privateCapacityU])assert(Number.isFinite(v)&&v>0,'finite positive aggregate');
 assert(s.realAlloyPrice/s.p.baseAlloyPrice>=s.p.priceFloor-1e-12&&s.realAlloyPrice/s.p.baseAlloyPrice<=s.p.priceCeiling+1e-12,'price bounds');
 return true;
}
export function simulateEconomy(p,options={}){
 const s=createEconomy(p,options),rows=[snapshot(s)];for(let i=0;i<(options.months??240);i++)rows.push(tickEconomy(s));return {state:s,rows};
}
