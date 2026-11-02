// Fixed user contracts, distinct from exploratory costs in the caller's config.
import {FACILITY_TYPES,MINING,SMELTING,extractionEfficiency,processingEfficiency,rampDurationMonths} from './industry-policy.js';
import {facilityCapacity} from './industry-runtime.js';
export const POWER_TYPES=Object.freeze({fusion:Object.freeze({ratedGW:5,maxModules:50,months:4}),fission:Object.freeze({ratedGW:2.5,maxModules:35,months:3}),solar:Object.freeze({ratedGW:1.5,maxModules:80,months:1})});
export const FUSION=Object.freeze({buildHydrogenU:5,startHydrogenU:5,startC:2500,startHours:96,normalHydrogenU:2.5,firstHours:24,inputGW:1.25});
export const INDUSTRY_MIXES=Object.freeze({
 steelHeavy:Object.freeze({steel:.8,other:.15,aluminium:.05}),
 mixed:Object.freeze({steel:.6,other:.25,aluminium:.15}),
 nonferrousHeavy:Object.freeze({steel:.3,other:.4,aluminium:.3})
});
export function alloyElectricityMWhPerT(mix='mixed',intensities={steel:1,other:3.5,aluminium:14}){
 const weights=typeof mix==='string'?INDUSTRY_MIXES[mix]:mix;
 if(!weights||Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-1)>1e-9)throw Error('Metal mix must sum to one');
 return Object.entries(weights).reduce((s,[k,v])=>s+v*intensities[k],0);
}
// Integrals over progressed startup hours. Generation ceases if startup is
// stalled: progress, resource use and generated energy always advance together.
function startPrimitive(progress){const p=Math.max(0,Math.min(96,progress)),r=Math.max(0,p-24);return {input:1.25*Math.min(p,24)+1.25*(r-r*r/144),output:5*r*r/144};}
export function advanceFusionStart({progressHours=0,wallHours,externalGWh,hydrogenU}){
 for(const n of [progressHours,wallHours,externalGWh,hydrogenU])if(!Number.isFinite(n)||n<0)throw Error('Invalid startup resources');
 const start=startPrimitive(progressHours),limit=Math.min(96,progressHours+wallHours,progressHours+hydrogenU*96/5);
 let end=limit;if(startPrimitive(end).input-start.input>externalGWh+1e-10){let lo=progressHours,hi=limit;for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(startPrimitive(mid).input-start.input<=externalGWh)lo=mid;else hi=mid;}end=lo;}
 const final=startPrimitive(end),hours=end-progressHours;
 return {progressHours:end,advancedHours:hours,inputGWh:Math.max(0,final.input-start.input),generationGWh:Math.max(0,final.output-start.output),hydrogenU:hours*5/96,completed:end>=96-1e-8};
}
export function dispatchFusion({requestedGWh,hours=730,monthHours=730,availableHydrogenU,minimumFraction,normalHydrogenU=2.5}){
 const maximum=5*hours,energy=Math.max(0,Math.min(requestedGWh,maximum,availableHydrogenU/normalHydrogenU*5*monthHours));
 if(energy<maximum*minimumFraction-1e-9)return {energyGWh:0,hydrogenU:0,state:'coldStopped'};
 return {energyGWh:energy,hydrogenU:energy/(5*monthHours)*normalHydrogenU,state:energy<maximum-1e-9?'curtailed':'active'};
}
export function constructionQuote({type,part='module',costs,startMonth,foundations=[],jobs=[],experience=0,surcharge=.1,learning=.1}){
 const def=POWER_TYPES[type];if(!def)throw Error('Power type');
 const duration=part==='base'?costs.foundationMonths:def.months,endMonth=startMonth+duration;
 // Reservations count across the entire planet and every complex. There is no
 // hard concurrency cap, and splitting a complex cannot bypass this surcharge.
 const overlap=jobs.filter(j=>j.owner!=='private'&&j.startMonth<endMonth&&j.endMonth>startMonth).length;
 const factor=1+surcharge*overlap/(1+learning*Math.sqrt(experience));
 const price=costs[type][part];return {creditC:price.creditC*factor,alloyU:price.alloyU,hydrogenU:type==='fusion'&&part==='module'?5:0,startMonth,endMonth,overlap,factor,foundationAlreadyPaid:foundations.length>0};
}
export function governmentPowerSlots(complexes){return complexes.filter(c=>c.owner==='government').length;}
export function rampFraction(completedMonth,month,difficulty){
 const ramp=rampDurationMonths(difficulty),a=Math.max(0,month-completedMonth),b=Math.max(0,month+1-completedMonth);
 if(b===0)return 0;
 const rec={activeDepositIds:['d'],segments:[{completedTick:0,upgradedTick:null}]},catalog={deposits:new Map([['d',{extractionDifficulty:difficulty}]])};
 const initial=facilityCapacity(rec,catalog,0).ramp;
 const integral=t=>t<=ramp?initial*t+(1-initial)*t*t/(2*ramp):t-(1-initial)*ramp/2;
 return integral(b)-integral(a);
}
export function industryCapacity({sets,completedMonth=-100,month,difficulty,processingDifficulty,mineRatio=1}){
 const ramp=rampFraction(completedMonth,month,difficulty);
 return {mineU:FACILITY_TYPES[MINING].capacityU*extractionEfficiency(difficulty)*sets*mineRatio*ramp,processU:FACILITY_TYPES[SMELTING].capacityU*processingEfficiency(processingDifficulty)*sets*ramp,ramp};
}
// Integral monthly counterpart of the runtime's processed-ore-adjusted H use.
// Solve for assistance alpha against ACTUAL H use, not its raw85U ceiling.
// If processing efficiency is76%, full assistance consumes64.6U, not85U.
export function assistedSmelting({oreU,baseProcessU,rawWorkU,maxHydrogenU,availableHydrogenU,boost=.15,enabled=true}){
 const fullProcess=Math.min(oreU,baseProcessU*(1+boost));
 const desiredHydrogenU=enabled&&oreU>baseProcessU&&rawWorkU>0?maxHydrogenU*fullProcess/(rawWorkU*(1+boost)):0;
 let alpha=0;
 if(desiredHydrogenU>0&&maxHydrogenU>0){
  const efficiency=baseProcessU/rawWorkU,unlimited=availableHydrogenU/(maxHydrogenU*efficiency),oreThreshold=(oreU/baseProcessU-1)/boost;
  if(unlimited<=oreThreshold)alpha=unlimited;
  else {const k=maxHydrogenU*oreU/rawWorkU,denominator=k-availableHydrogenU*boost;alpha=denominator>0?availableHydrogenU/denominator:1;}
  alpha=Math.max(0,Math.min(1,alpha));
 }
 const processU=Math.min(oreU,baseProcessU*(1+boost*alpha));
 const hydrogenU=rawWorkU>0?maxHydrogenU*alpha*processU/(rawWorkU*(1+boost*alpha)):0;
 return {processU,hydrogenU,desiredHydrogenU,alpha};
}
export function explicitIndustryUnitCost({investmentC,creditBasisC,alloyBasisU,outputU,energyGWh,hydrogenU,amortizationMonths,directAnnual,upkeepAnnual,alloyPrice,hydrogenPrice,powerPrice}){
 if(!(outputU>0&&amortizationMonths>0))return Infinity;
 return (investmentC/amortizationMonths+creditBasisC*directAnnual/12+alloyBasisU*upkeepAnnual*alloyPrice/12+energyGWh*powerPrice+hydrogenU*hydrogenPrice)/outputU;
}
export function upkeepBill(asset,p){
 if(asset.completedMonth>p.month)return {alloyU:0,directC:0};
 const stopped=['paused','coldStopped'].includes(asset.state),fraction=asset.activeFraction??1,util=Math.max(0,Math.min(1,asset.lastUtilization??1));
 const alloyFactor=stopped?p.pausedAlloyFraction:(p.upkeepFixedShare??.85)+(1-(p.upkeepFixedShare??.85))*util;
 const cashFactor=stopped?p.pausedCashFraction:(p.directFixedShare??.6)+(1-(p.directFixedShare??.6))*util;
 return {alloyU:asset.alloyBasisU*p.upkeepAnnual/12*alloyFactor*fraction,
 directC:asset.creditBasisC*p.directAnnual/12*cashFactor*fraction};
}
// No invented negative energy: storage discharges only into deficits, charges
// only after all demand; losses are explicit and it never charges itself.
export function balanceStorage({socGWh,capacityGWh,rateGW,efficiency,supplyGWh,demandGWh,hours=720}){
 if(!(efficiency>0&&efficiency<=1)||[socGWh,capacityGWh,rateGW,supplyGWh,demandGWh].some(x=>x<0)||socGWh>capacityGWh+1e-9)throw Error('Storage bounds');
 const charge=Math.min(Math.max(0,supplyGWh-demandGWh),rateGW*hours,(capacityGWh-socGWh)/efficiency);
 const discharge=Math.min(Math.max(0,demandGWh-supplyGWh),rateGW*hours,socGWh*efficiency);
 return {chargeGWh:charge,dischargeGWh:discharge,socGWh:Math.max(0,Math.min(capacityGWh,socGWh+charge*efficiency-discharge/efficiency)),lossGWh:charge*(1-efficiency)+discharge*(1/efficiency-1)};
}
