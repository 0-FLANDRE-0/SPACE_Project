import {industryExpectation,setPayback} from '../dist/src/economy-model.js';
import {FACILITY_TYPES,MINING,SMELTING} from '../dist/src/industry-policy.js';
import {industryCapacity,alloyElectricityMWhPerT,POWER_TYPES} from '../dist/src/economy-energy-facilities.js';
import {powerScale,upgradeScale,restartProfile} from '../dist/src/economy-round4-facilities.js';
import {normalizeRound4Energy} from '../dist/src/economy-round4-model.js';
import {hydrogenCost} from '../dist/src/economy-round4-units.js';
import {energyMetrics} from './econ-round3-analysis.mjs';
const mean=a=>a.reduce((n,x)=>n+x,0)/Math.max(1,a.length),sum=a=>a.reduce((n,x)=>n+x,0);
export function industryFinance4(p,e,r){
 const tech=industryExpectation(p),mine=FACILITY_TYPES[MINING],smelt=FACILITY_TYPES[SMELTING],investmentC=tech.creditC+tech.alloyInputU*p.baseAlloyPrice+tech.hydrogenInputU*r.hydrogenPrice,tariff=e.electricityGDPShare*p.bodies.earth.annualGDP/(e.earthBaseGW*8760);let ore=0,net=0,payback=null;const mature=[];
 for(let m=0;m<600;m++){
  const a=industryCapacity({sets:1,completedMonth:mine.months,month:m,difficulty:p.difficulty,processingDifficulty:p.processingDifficulty}),b=industryCapacity({sets:1,completedMonth:smelt.months,month:m,difficulty:p.difficulty,processingDifficulty:p.processingDifficulty});ore+=a.mineU;const process=Math.min(ore,b.processU),alloy=process*tech.yieldFraction;ore-=process;
  const energyGWh=(a.mineU*10*e.mineMWhPerT+process*10*e.feedMWhPerT+alloy*10*alloyElectricityMWhPerT(e.industryMix))/1000+(m>=mine.months?e.industryFixedMW*.73:0),basisC=(m>=mine.months?mine.creditC:0)+(m>=smelt.months?smelt.creditC:0),basisU=(m>=mine.months?mine.alloyU:0)+(m>=smelt.months?smelt.alloyU:0),directC=basisC*e.directAnnual/12,upkeepU=basisU*r.upkeep_earth/12,grossC=alloy*p.baseAlloyPrice,profitC=grossC-directC-upkeepU*p.baseAlloyPrice-energyGWh*tariff,prior=net;net+=profitC;if(payback===null&&net>=investmentC)payback=(m+(investmentC-prior)/profitC)/12;if(m>=120&&m<132)mature.push({alloyU:alloy,energyGWh,directC,upkeepU,grossC,profitC});
 }
 return {investmentC,actualOperatingOrderYears:payback,zeroOperatingOrderYears:setPayback({...p,hydrogenPrice:r.hydrogenPrice},{operatingRate:0}).fromOrderYears,mature:Object.fromEntries(Object.keys(mature[0]).map(k=>[k,mean(mature.map(x=>x[k]))])),assumptions:'real2.3C/U; imported government1:1 pair, no H assistance, power100%; capex H included, no financing/site fees'};
}
export function restartObligation4(e,r){
 const mine=FACILITY_TYPES[MINING],smelt=FACILITY_TYPES[SMELTING],asset={kind:'industry',mineCreditC:mine.creditC,creditBasisC:mine.creditC+smelt.creditC,restartMonth:0},profile=restartProfile(asset,r,0),fixedGWh=e.industryFixedMW/1000*96*r.smeltHeatMultiplier,restartC=mine.creditC*r.mineRestartFraction+smelt.creditC*r.smeltRestartFraction;
 // Equal-output comparison: make up unavailable capacity at its normal positive
 // capital/service cost, rather than counting undelivered output as a saving.
 const unavailableFraction=1-profile.smeltFactor,normalMonthlyC=asset.creditBasisC*e.directAnnual/12,makeupC=unavailableFraction*normalMonthlyC,parkSavingC=normalMonthlyC*(1-r.pausedCashFraction)/30;
 return {restartC,heatGWh:fixedGWh,monthOneSmeltFactor:profile.smeltFactor,makeupC,oneDayParkSavingC:parkSavingC,equalObligationExtraC:restartC+makeupC-parkSavingC,freeToggleCounterfactualSavingC:parkSavingC,passed:restartC+makeupC>=parkSavingC,scope:'matched one-month output, one-day pause diagnostic; make-up capacity priced at normal operating service. Repeated macro scenario reported separately.'};
}
export function powerFinance4(p,e,r){
 const rows=[],tariff=e.electricityGDPShare*p.bodies.earth.annualGDP/(e.earthBaseGW*8760);
 for(const type of Object.keys(POWER_TYPES))for(const size of ['small','medium','large']){
  if(type==='fusion'&&size==='small')continue;const a=powerScale(e,r,type,size,240),average=a.ratedGW*(type==='solar'?r.solarEarthCF:type==='fission'?e.fissionAvailability:1),creditC=a.base.creditC+a.module.creditC,alloyU=a.base.alloyU+a.module.alloyU,upkeepU=alloyU*r.upkeep_earth,directC=creditC*e.directAnnual,annualFuelC=type==='fusion'?12*2.5*a.ratio*r.hydrogenPrice:type==='fission'?average*8760*e.fissionFuelCPerGWh:0,annualSalesC=average*8760*tariff,annualNetC=annualSalesC-directC-upkeepU*p.baseAlloyPrice-annualFuelC,investmentC=creditC+alloyU*p.baseAlloyPrice+a.startC+(a.buildHydrogenU+a.startHydrogenU)*r.hydrogenPrice;
  rows.push({...a,averageGW:average,creditC,alloyU,creditCPerMW:creditC/(a.ratedGW*1000),annualUpkeepU:upkeepU,annualDirectC:directC,annualFuelC,annualSalesC,annualNetC,cashPaybackYears:annualNetC>0?investmentC/annualNetC+(a.months+a.foundationMonths)/12:null,criterion:'cash payback is informational; government public-infrastructure value is separate'});
 }
 return rows;
}
export function upgradeFinance4(e,r){return Object.keys(POWER_TYPES).filter(type=>type!=='fusion').map(type=>{const a=powerScale(e,r,type,'small',240),b=upgradeScale(e,r,type,'small','medium',240),c=upgradeScale(e,r,type,'medium','large',240),d=powerScale(e,r,type,'large',240);return {type,stagedC:a.base.creditC+a.module.creditC+b.base.creditC+b.module.creditC+c.base.creditC+c.module.creditC,directLargeC:d.base.creditC+d.module.creditC,stagedAlloyU:a.base.alloyU+a.module.alloyU+b.base.alloyU+b.module.alloyU+c.base.alloyU+c.module.alloyU,replacementC:a.base.creditC+a.module.creditC+powerScale(e,r,type,'medium',240).module.creditC+d.module.creditC,stages:[a,b,c],fusionSmallUnavailable:type==='fusion'};}).filter(x=>x.type!=='fusion');}
const financeCache=new WeakMap();
export function metrics4(result,p,e,r,criteria,{scenario,seed}={}){
 const mapped=scenario==='E2-S'?'E2':scenario,energy=normalizeRound4Energy(e,r),base=energyMetrics(result,p,energy,{...criteria,warRecoveryYearsMax:criteria.warRecoveryYearsMax,warPeakMin:-1,warPeakMax:1e9},{scenario:mapped,seed}),rows=result.rows.slice(1),checks={...base.checks};delete checks.warPeakLow;delete checks.warPeakHigh;
 const annual={};for(const id of ['earth','moon','mars'])annual[id]=Array.from({length:20},(_,year)=>{const a=rows.slice(year*12,(year+1)*12);return sum(a.map(x=>x.planets[id].flow.unservedGWh))/Math.max(1e-9,sum(a.map(x=>x.planets[id].flow.demandGWh)));});
 let cached=financeCache.get(r);if(!cached){cached={finance:industryFinance4(p,energy,r),hydrogen:hydrogenCost(p,energy,r),obligation:restartObligation4(energy,r)};financeCache.set(r,cached);}const {finance,hydrogen,obligation}=cached,colonyMaxYear=Math.max(...annual.moon,...annual.mars);
 if(['E0','E2','E2-S'].includes(scenario))checks.colonyAnnual=colonyMaxYear<=(scenario==='E0'?criteria.colonyPeaceYearlyMax:criteria.colonyFoundingYearlyMax)+1e-12;
 if(scenario==='E0'){checks.industryPayback=finance.actualOperatingOrderYears!==null&&finance.actualOperatingOrderYears<=criteria.industryPaybackYearsMax;checks.hydrogenMargin=hydrogen.marginCPerU>=0;}
 let crisisRecoveryYears=null;if(scenario==='E5-X')for(const row of rows.filter(x=>x.month>=84)){const b=row.planets.earth;if(b.flow.unservedGWh/Math.max(1,b.flow.demandGWh)<=criteria.crisisUnservedMax&&b.meanHealth>=criteria.crisisHealthMin){crisisRecoveryYears=(row.month-84)/12;break;}}
 if(scenario==='E5-X')checks.crisisRecovery=crisisRecoveryYears!==null&&crisisRecoveryYears<=criteria.crisisRecoveryYearsMax;
 if(scenario==='E6-R')checks.restartObligation=obligation.passed&&result.state.events.some(x=>x.event==='facility-restart')&&result.state.planets.earth.total.restartHeaterGWh>0;
 const margins={...base.checks};for(const k of Object.keys(margins))delete margins[k];
 const fail=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),earth=result.state.planets.earth,events=result.state.events;
 return {...base,scenario,seed,peace:['S0','S1','S2','E0','E1','E2','E2-S'].includes(scenario),checks,passed:fail.length===0,failures:fail,colonyMaxAnnualUnserved:colonyMaxYear,annualUnserved:annual,industryPaybackYears:finance.actualOperatingOrderYears,hydrogenAtReferenceMarginC:hydrogen.marginCPerU,hydrogenFullCostC:hydrogen.totalCPerU,crisisRecoveryYears,meanHealth20:result.rows.at(-1).planets.earth.meanHealth,pausedCount20:result.rows.at(-1).planets.earth.pausedFacilities,dismantledCount20:result.rows.at(-1).planets.earth.dismantledFacilities,restarts:events.filter(x=>x.event==='facility-restart').length,dismantles:events.filter(x=>x.event==='dismantled').length,shippingAlloyU:sum(result.state.shipmentHistory.filter(x=>x.resourceId==='alloy').map(x=>x.amountQ/1000)),shippingHydrogenU:sum(result.state.shipmentHistory.filter(x=>x.resourceId==='hydrogen').map(x=>x.amountQ/1000)),shellLossU:sum(result.state.shipmentHistory.map(x=>x.lostQ/1000)),packagingEnergyGWh:sum(result.state.shipmentHistory.map(x=>x.energyGWh)),upkeepTotalU:earth.total.upkeepPaidU,governmentPublicSalesC:earth.total.governmentExternalSalesC,rankPenalty:fail.length+Math.max(0,colonyMaxYear-.1)*5+Math.max(0,base.peacePriceDeviation-.15)*5+(scenario==='E5-X'&&!checks.crisisRecovery?2:0)};
}
export function aggregate4(id,parameters,records){
 const failures={};for(const x of records)for(const k of x.failures??[])failures[k]=(failures[k]??0)+1;
 const perScenario={};for(const scenario of new Set(records.map(x=>x.scenario))){const a=records.filter(x=>x.scenario===scenario);perScenario[scenario]={runs:a.length,passed:a.filter(x=>x.passed).length,meanPrice:mean(a.map(x=>x.meanRealAlloyPrice??0)),worstColonyAnnual:Math.max(...a.map(x=>x.colonyMaxAnnualUnserved??1)),worstEarthUnserved:Math.max(...a.map(x=>x.earthUnservedFraction??1)),health20Min:Math.min(...a.map(x=>x.meanHealth20??0)),meanHydrogenPrice:mean(a.map(x=>x.meanHydrogenPrice??0)),crisisRecoveryYearsMax:a.some(x=>x.crisisRecoveryYears===null)?null:Math.max(...a.map(x=>x.crisisRecoveryYears??0))};}
 return {id,parameters,runs:records.length,passingRuns:records.filter(x=>x.passed).length,integrity:records.every(x=>x.integrity),passed:records.every(x=>x.passed),failures,perScenario,score:mean(records.map(x=>x.rankPenalty??100))};
}
