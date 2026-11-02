// Offline ECON-SIM-4.1 only. No game registry, persistence or browser dependencies.
import {account,quantize as q,trade} from './economy-energy-ledger.js';
import {round4Bill,upkeepPriority} from './economy-round4-facilities.js';
import {packagingCost} from './economy-round4-units.js';

const sum=a=>a.reduce((n,x)=>n+x,0);
export const POLICY41_RANGES=Object.freeze({enterMonths:[1,6],exitMultiple:[1.3,2],graceMonths:[6,12],postGraceDamageScale:[.5,2],marketPremium:[1.2,2],marketFraction:[.05,.3],donorReserveMonths:[3,12]});
export function validatePolicy41(p){
 if(!p||![.4,1.2].includes(p.hydrogenPrice))throw Error('Explicit Round4.1 hydrogen price hypothesis required');
 for(const key of ['triageEnabled','marketRelief','importRelief'])if(typeof p[key]!=='boolean')throw Error('Explicit policy control required: '+key);
 for(const [key,[lo,hi]]of Object.entries(POLICY41_RANGES))if(!Number.isFinite(p[key])||p[key]<lo||p[key]>hi)throw Error('Round4.1 range: '+key);
 if(!Number.isInteger(p.graceMonths))throw Error('Grace months must be integer');
 return p;
}
export const GRID41=Object.freeze([.5,.6,.7].flatMap(lossFraction=>[6,9,12].flatMap(stopMonths=>[1.5,2].map(demandMultiplier=>Object.freeze({id:`E5-M-L${lossFraction*100}-S${stopMonths}-D${demandMultiplier}`,startMonth:60,lossFraction,stopMonths,demandMultiplier})))));
export function stressDefinition41(scenario,representative={startMonth:60,lossFraction:.6,stopMonths:9,demandMultiplier:1.75}){
 const grid=GRID41.find(x=>x.id===scenario);
 if(grid)return grid;
 if(['E5-M','E11-M'].includes(scenario)){
  const x={...representative};
  if(x.startMonth!==60||![6,9,12].includes(x.stopMonths)||![.5,.6,.7].includes(x.lossFraction)||![1.5,1.75,2].includes(x.demandMultiplier))throw Error('E5-M stress definition');
  return x;
 }
 return ['E5','E5-X','E11'].includes(scenario)?{startMonth:60,lossFraction:.99,stopMonths:24,demandMultiplier:3}:null;
}
export const mediumStress41=scenario=>scenario==='E11-M'||scenario.startsWith('E5-M');
export function shockActive41(scenario,month,stress){return Boolean(stress&&month>=stress.startMonth&&month<stress.startMonth+stress.stopMonths);}
export function maintenanceBill41(a,e,r,planet,month){
 const part=a.kind==='industry'&&a.smeltCompletedMonth>month?{...a,alloyBasisU:a.mineAlloyU,creditBasisC:a.mineCreditC}:a;
 const bill=round4Bill(a.state==='dismantling'?{...part,state:'paused'}:part,e,r,planet,month);
 return {...bill,alloyU:q(bill.alloyU)/1000};
}
export function maintenanceNeed41(b,e,r,month,owner=null){
 return sum(b.assets.filter(a=>(owner===null||a.owner===owner)&&a.completedMonth<=month&&a.state!=='dismantled').map(a=>maintenanceBill41(a,e,r,b.id,month).alloyU));
}
export function updateShortage41(before,{freeU,needU,month},p){
 if(![freeU,needU,month].every(Number.isFinite)||freeU<0||needU<0)throw Error('Invalid shortage observation');
 const old=before??{active:false,entries:0,exits:0},enterU=needU*p.enterMonths,exitU=enterU*p.exitMultiple;
 const active=old.active?!(freeU>=exitU):freeU<enterU;
 const transition=active!==old.active;
 return {...old,active,freeU,needU,enterU,exitU,observedMonth:month,entries:old.entries+Number(transition&&active),exits:old.exits+Number(transition&&!active),changed:transition,enteredMonth:transition&&active?month:old.enteredMonth??null};
}
export function priority41(a,shortage,p){
 const normal=upkeepPriority(a),essential=normal===0;
 if(!p.triageEnabled)return normal;
 // Last grace month already returns the asset to first place. Re-entry does
 // not reset its clock or erase arrears.
 if(essential&&(a.lifeDeferredQ??0)>0&&(a.lifeGraceAgeMonths??0)>=p.graceMonths-1)return -1;
 if(!shortage?.active)return normal;
 return a.kind==='industry'?0:normal===1?1:essential?2:3;
}
export function damageMaintenance41(a,{shortU,billU,month,damagePerMonth,graceEnabled},p){
 if(![shortU,billU,damagePerMonth].every(Number.isFinite)||shortU<0||billU<0||damagePerMonth<0)throw Error('Invalid maintenance damage');
 const out={...a,backlogU:a.backlogU+shortU},essential=upkeepPriority(a)===0;
 let usedGrace=false,damage=0;
 if(essential&&(graceEnabled||a.lifeGraceAgeMonths!==undefined)){
  if(shortU>0&&out.lifeGraceAgeMonths===undefined)out.lifeGraceAgeMonths=0;
  if(out.lifeGraceAgeMonths!==undefined){
   usedGrace=shortU>0&&out.lifeGraceAgeMonths<p.graceMonths;
   if(usedGrace){const n=q(shortU);out.lifeDeferredQ=(out.lifeDeferredQ??0)+n;out.lifeAccruedQ=(out.lifeAccruedQ??0)+n;}
   else if(shortU>0)damage=shortU/Math.max(.001,billU)*damagePerMonth*p.postGraceDamageScale;
   out.lifeGraceAgeMonths++;
  }
 }else damage=shortU/Math.max(.001,billU)*damagePerMonth;
 const before=out.health;out.health=Math.max(.1,out.health-damage);
 return {asset:out,usedGrace,healthLost:before-out.health,month,deferredAddedQ:usedGrace?q(shortU):0};
}
export function repairMaintenance41(a,repairU,billU,damagePerMonth){
 const paidQ=Math.min(a.lifeDeferredQ??0,q(repairU)),out={...a,backlogU:Math.max(0,a.backlogU-repairU),health:Math.min(1,a.health+repairU/Math.max(.001,billU)*damagePerMonth),lifeDeferredQ:(a.lifeDeferredQ??0)-paidQ,lifeRepaidQ:(a.lifeRepaidQ??0)+paidQ};
 if(out.backlogU<.0005&&out.lifeDeferredQ===0)delete out.lifeGraceAgeMonths;
 return {asset:out,deferredRepaidQ:paidQ};
}
export function emergencyMarket41(s,b,p){
 if(!p.marketRelief||!b.shortage41?.active)return null;
 const privateQ=s.book.get(account(b.id,'private','alloy')),governmentU=s.book.get(account(b.id,'government','alloy'))/1000;
 // Government procurement targets the whole planet's maintenance shortage.
 // Existing R4 local trades still govern material reaching private operators;
 // changing ownership does not create any aggregate alloy.
 const debt=sum(b.assets.filter(a=>a.state!=='dismantled').map(a=>a.backlogU));
 const targetU=maintenanceNeed41(b,s.e,s.r,s.month)*p.enterMonths+debt;
 const maxQ=Math.floor(privateQ*p.marketFraction),requestedQ=Math.min(maxQ,Math.max(0,Math.floor((targetU-governmentU)*1000+1e-7)));
 if(requestedQ<=0)return null;
 const priceC=b.alloyPrice*p.marketPremium*s.priceIndex;
 const result=trade(s.book,{planet:b.id,from:'private',to:'government',resource:'alloy',amountU:requestedQ/1000,priceC,tag:'emergency-market'});
 if(!result.amountU)return null;
 return {...result,month:s.month,planet:b.id,privateBeforeQ:privateQ,capQ:maxQ,referencePriceC:b.alloyPrice,priceIndex:s.priceIndex,premium:p.marketPremium,paidPriceC:priceC};
}
export function donorReserve41(s,b,owner,p){
 const months=Math.max(p.enterMonths,p.donorReserveMonths),ownQ=Math.ceil(maintenanceNeed41(b,s.e,s.r,s.month,owner)*months*1000-1e-7),planetQ=Math.ceil(maintenanceNeed41(b,s.e,s.r,s.month)*months*1000-1e-7),otherQ=sum(['government','private'].filter(x=>x!==owner).map(x=>s.book.get(account(b.id,x,'alloy'))));
 return Math.max(ownQ,planetQ-otherQ,0);
}
// Keep BOTH alloy content and the actual selected container's material above
// the donor reserve. No fractional-container shortcut.
export function protectedExportQ41(s,b,owner,requestedQ,p){
 if(!Number.isSafeInteger(requestedQ)||requestedQ<0)throw Error('Invalid emergency export quantity');
 const reserveQ=donorReserve41(s,b,owner,p),freeQ=Math.max(0,s.book.get(account(b.id,owner,'alloy'))-reserveQ);
 let lo=0,hi=Math.min(requestedQ,freeQ);
 while(lo<hi){const mid=Math.ceil((lo+hi)/2),shell=packagingCost('alloy',mid,s.r).alloyQ;if(mid+shell<=freeQ)lo=mid;else hi=mid-1;}
 return {amountQ:lo,reserveQ,planetReserveQ:Math.ceil(maintenanceNeed41(b,s.e,s.r,s.month)*Math.max(p.enterMonths,p.donorReserveMonths)*1000-1e-7),freeQ};
}
export function assertPolicy41(s){
 for(const b of Object.values(s.planets))for(const a of b.assets){
  for(const k of ['lifeDeferredQ','lifeAccruedQ','lifeRepaidQ'])if(a[k]!==undefined&&(!Number.isSafeInteger(a[k])||a[k]<0))throw Error('Life-maintenance debt quanta');
  if((a.lifeAccruedQ??0)!==(a.lifeDeferredQ??0)+(a.lifeRepaidQ??0)||(a.lifeDeferredQ??0)>q(a.backlogU)+1)throw Error('Unpaid life-maintenance debt conservation');
 }
 for(const r of s.relief41.market)if(!(q(r.amountU)<=r.capQ&&r.premium>=1.2&&r.premium<=2&&Math.abs(r.cashC-r.amountU*r.paidPriceC)<=.000501))throw Error('Emergency market quote/cap conservation');
 for(const r of s.relief41.imports)if(!(r.sourceAfterQ>=r.sourceReserveQ&&r.sourcePlanetAfterQ>=r.sourcePlanetReserveQ&&r.occupiedSCU>0&&r.alloyBondedQ>0&&r.servicesC>0&&r.energyGWh>0))throw Error('Emergency source reserve / paid SCU');
 return true;
}
