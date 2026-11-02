import {POWER_TYPES,FUSION,upkeepBill,advanceFusionStart} from './economy-energy-facilities.js';
import {facilityCapacity} from './industry-runtime.js';
export const R4_SCENARIO_BASE=Object.freeze({'E2-S':'E2','E5-X':'E5','E6-R':'E6',E9:'E2',E10:'E1',E11:'E5'});
export function powerScale(e,r,type,size='large',month=0){
 const d=POWER_TYPES[type],ratio={large:1,medium:r.mediumRatio,small:r.smallRatio}[size];if(!d||!(ratio>0&&ratio<=1))throw Error('Power size/type');
 if(type==='fusion'&&(size==='small'||size==='medium'&&month<r.fusionUnlockMonth))throw Error('Fusion size is not researched');
 const exponent=type==='solar'?r.solarCostExponent:r.nuclearCostExponent,scale=Math.pow(ratio,exponent)*(type==='solar'?r.solarCapexScale:1),time=Math.pow(ratio,r.timeExponent);
 return {type,size,ratio,ratedGW:d.ratedGW*ratio,months:d.months*time,foundationMonths:e.costs.foundationMonths*time,base:{creditC:e.costs[type].base.creditC*scale,alloyU:e.costs[type].base.alloyU*scale},module:{creditC:e.costs[type].module.creditC*scale,alloyU:e.costs[type].module.alloyU*scale},buildHydrogenU:type==='fusion'?FUSION.buildHydrogenU*ratio:0,startHydrogenU:type==='fusion'?FUSION.startHydrogenU*ratio:0,startC:type==='fusion'?FUSION.startC*Math.pow(ratio,r.nuclearCostExponent):0};
}
export function upgradeScale(e,r,type,fromSize,toSize,month=0){
 const from=powerScale(e,r,type,fromSize,month),to=powerScale(e,r,type,toSize,month);if(to.ratio<=from.ratio)throw Error('Upgrade must add capacity');
 const delta=to.ratio-from.ratio,discount=1-r.reuseDiscount;
 return {type,fromSize,toSize,existingGW:from.ratedGW,addedGW:to.ratedGW-from.ratedGW,ratio:delta,months:POWER_TYPES[type].months*Math.pow(delta,r.timeExponent),derateFraction:r.upgradeDerate,base:{creditC:(to.base.creditC-from.base.creditC)*discount,alloyU:(to.base.alloyU-from.base.alloyU)*discount},module:{creditC:(to.module.creditC-from.module.creditC)*discount,alloyU:(to.module.alloyU-from.module.alloyU)*discount},buildHydrogenU:type==='fusion'?FUSION.buildHydrogenU*delta:0,startC:type==='fusion'?FUSION.startC*Math.pow(delta,r.nuclearCostExponent):0,reusedDiscount:r.reuseDiscount};
}
export function advanceSizedFusionStart(asset,resources){
 const ratio=asset.ratio??1;if(!(ratio>0&&ratio<=1))throw Error('Invalid fusion rating');
 const out=advanceFusionStart({...resources,externalGWh:resources.externalGWh/ratio,hydrogenU:resources.hydrogenU/ratio});return {...out,inputGWh:out.inputGWh*ratio,generationGWh:out.generationGWh*ratio,hydrogenU:out.hydrogenU*ratio};
}
export function round4Bill(asset,e,r,planet,month){
 if(asset.state==='dismantled')return {alloyU:0,directC:0};
 const rate=r['upkeep_'+planet];if(!(rate>=.02&&rate<=.05))throw Error('Active environment upkeep must be 2–5%');
 if(!(r.pausedCashFraction>0&&r.pausedCashFraction<r.pausedAlloyFraction&&r.pausedAlloyFraction>0))throw Error('Paused cash must fall more than positive alloy maintenance');
 return upkeepBill(asset,{...e,month,upkeepAnnual:rate,pausedCashFraction:r.pausedCashFraction,pausedAlloyFraction:r.pausedAlloyFraction});
}
export function upkeepPriority(a){return a.kind==='legacyGrid'||a.essential?0:['powerBase','powerModule','privatePowerBase','privateGridExpansion','storage'].includes(a.kind)?1:a.kind==='industry'?2:3;}
const INITIAL_RAMP=facilityCapacity({activeDepositIds:['d'],segments:[{completedTick:0,upgradedTick:null}]},{deposits:new Map([['d',{extractionDifficulty:0}]])},0).ramp;
function rampIntegral(t,months){if(t<=0)return 0;const first=INITIAL_RAMP;return t<=months?first*t+(1-first)*t*t/(2*months):t-(1-first)*months/2;}
export function restartProfile(asset,r,month,{hours=730,monthHours=730}={}){
 if(asset.restartMonth===undefined)return {mineFactor:1,smeltFactor:1,heaterHours:0,complete:true};
 const start=Math.max(0,(month-asset.restartMonth)*monthHours),end=start+hours;
 const mineIntegral=t=>Math.min(t,24)*r.mineFirstDayFraction+Math.max(0,t-24);
 const mineFactor=(mineIntegral(end)-mineIntegral(start))/hours,heaterHours=Math.max(0,Math.min(end,96)-Math.min(start,96));
 const smeltFactor=(rampIntegral(Math.max(0,end-96)/monthHours,r.smeltRecoveryMonths)-rampIntegral(Math.max(0,start-96)/monthHours,r.smeltRecoveryMonths))*monthHours/hours;
 return {mineFactor,smeltFactor,heaterHours,complete:end>=96+r.smeltRecoveryMonths*monthHours};
}
export function restartCharge(asset,r){
 if(!['paused','coldStopped'].includes(asset.state))return {creditC:0,changed:false};
 const fraction=asset.kind==='industry'?r.mineRestartFraction*(asset.mineCreditC??0)/Math.max(1,asset.creditBasisC)+r.smeltRestartFraction*(asset.creditBasisC-(asset.mineCreditC??0))/Math.max(1,asset.creditBasisC):0;
 return {creditC:asset.creditBasisC*fraction,changed:true};
}
export function privateAction(asset,r,{expectedMonthlyMargin,restartCostC,month}){
 if(['construction','dismantling','dismantled','starting'].includes(asset.state))return 'hold';
 if(['paused','coldStopped'].includes(asset.state)){
  if(expectedMonthlyMargin>0&&expectedMonthlyMargin*r.privateRestartMonths>=restartCostC)return 'restart';
  if((asset.pausedMonths??0)>=r.privateDismantleMonths&&expectedMonthlyMargin<0)return 'dismantle';return 'hold';
 }
 return (asset.lossMonths??0)>=r.privateLossMonths&&expectedMonthlyMargin<0?'pause':'hold';
}
export function dismantleQuote(asset,r,month){
 if(asset.completedMonth>month||['dismantled','dismantling'].includes(asset.state))throw Error('Dismantling requires an existing completed asset');
 if(!(r.salvageFraction>0&&r.salvageFraction<.9&&r.dismantleCashFraction>0&&r.dismantleMonths>0))throw Error('Dismantling is neither free nor lossless');
 return {creditC:asset.creditBasisC*r.dismantleCashFraction,endMonth:month+r.dismantleMonths,returnedU:asset.alloyBasisU*r.salvageFraction};
}
