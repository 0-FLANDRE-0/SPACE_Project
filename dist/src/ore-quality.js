import { resourceQuanta } from './resource-quantities.js';
export const ORE_GRADES=['low','medium','high'];
export const INITIAL_ALLOY_YIELDS=Object.freeze({low:.14,medium:.33,high:.52});
export function validateGradeProbabilities(p){if(!p||Object.keys(p).sort().join()!=='high,low,medium'||ORE_GRADES.some(k=>!Number.isFinite(p[k])||p[k]<0||p[k]>1)||Math.abs(ORE_GRADES.reduce((n,k)=>n+p[k],0)-1)>1e-9)throw Error('품질 확률은 저/중/고 0–1, 합계 1이어야 합니다.');return p;}
// Integer-only keyed RNG, independent from the legacy surface generator and clocks.
export function resourceRandom(...keys){let h=2166136261;for(const c of JSON.stringify(keys)){h=Math.imul(h^c.charCodeAt(0),16777619);}h+=0x6D2B79F5;let t=Math.imul(h^h>>>15,1|h);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;}
export const getBaseGradeProbabilities=d=>({...validateGradeProbabilities(d.gradeProbabilities)});
export function getEffectiveGradeProbabilities(base,{miningTech=0,beneficiationTech=0}={}){validateGradeProbabilities(base);for(const n of [miningTech,beneficiationTech])if(!Number.isFinite(n)||n<0||n>100)throw Error('기술 가정은 0–100입니다.');const shift=Math.min(.8,.015*miningTech+.02*beneficiationTech),low=base.low*(1-shift),medium=base.medium*(1-shift*.5);return {low,medium,high:Math.max(0,1-low-medium)};}
export function weightedGradeMean(deposits){const total=deposits.reduce((n,d)=>n+d.initialReserveU,0);return total?Object.fromEntries(ORE_GRADES.map(k=>[k,deposits.reduce((n,d)=>n+d.initialReserveU*d.gradeProbabilities[k],0)/total])):null;}
export function assignGradeJitter(deposits,target,{seed,strength=.05}={}){
 validateGradeProbabilities(target);if(!Number.isFinite(strength)||strength<0||strength>.2)throw Error('품질 편차는 0–0.2입니다.');const rows=[...deposits].sort((a,b)=>a.depositId<b.depositId?-1:1),total=rows.reduce((n,d)=>n+d.initialReserveU,0),limit=Math.min(.05,strength),amplitudes=Object.fromEntries(['low','high'].map(k=>[k,Math.min(limit,.75*target[k],.75*(1-target[k]))]));
 const report={policy:'per-component-v2',maxDeviation:limit,count:rows.length,amplitudes,scaleK:1,mediumGuardRelaxed:target.medium<.001||target.medium>.999,ranges:{}};
 if(total){const raw=rows.map(d=>({low:(resourceRandom(seed,d.groupId,'low')-.5)*.8+(resourceRandom(seed,d.depositId,'low')-.5)*.2,high:(resourceRandom(seed,d.groupId,'high')-.5)*.8+(resourceRandom(seed,d.depositId,'high')-.5)*.2})),mean=k=>raw.reduce((n,x,i)=>n+x[k]*rows[i].initialReserveU,0)/total,center={low:mean('low'),high:mean('high')},delta=raw.map(x=>({low:x.low-center.low,high:x.high-center.high})),alpha={};
  for(const k of ['low','high']){const maximum=Math.max(0,...delta.map(x=>Math.abs(x[k])));alpha[k]=maximum?amplitudes[k]/maximum:0;}
  let shifts=delta.map(x=>({low:alpha.low*x.low,high:alpha.high*x.high}));
  if(target.medium===0){const maximum=Math.max(0,...delta.map(x=>Math.abs(x.low))),a=maximum?Math.min(amplitudes.low,amplitudes.high)/maximum:0;shifts=delta.map(x=>({low:a*x.low,high:-a*x.low}));}
  if(target.medium===1)shifts=delta.map(()=>({low:0,high:0}));
  const floor=report.mediumGuardRelaxed?0:.001,ceiling=report.mediumGuardRelaxed?1:.999;let scaleK=1;
  for(const x of shifts){const medium=-(x.low+x.high);if(medium<0)scaleK=Math.min(scaleK,(target.medium-floor)/-medium);else if(medium>0)scaleK=Math.min(scaleK,(ceiling-target.medium)/medium);}
  report.scaleK=Math.max(0,Math.min(1,scaleK));
  for(let i=0;i<rows.length;i++){const low=target.low+report.scaleK*shifts[i].low,high=target.high+report.scaleK*shifts[i].high;rows[i].gradeProbabilities=rows.length===1?{...target}:target.medium===0?{low,medium:0,high:1-low}:target.high===0?{low,medium:1-low,high:0}:{low,medium:1-low-high,high};validateGradeProbabilities(rows[i].gradeProbabilities);}
  const actual=weightedGradeMean(rows);for(const k of ORE_GRADES)if(Math.abs(actual[k]-target[k])>1e-10)throw Error('품질 가중평균 보존 실패');
 }
 for(const k of ORE_GRADES){const values=rows.map(d=>d.gradeProbabilities[k]);report.ranges[k]={min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,actualMaxDeviation:values.length?Math.max(...values.map(v=>Math.abs(v-target[k]))):0};}return report;
}

function binomial(n,p,key){if(!n||!p)return 0;if(p===1)return n;if(n<=256){let count=0;for(let i=0;i<n;i++)if(resourceRandom(...key,i)<p)count++;return count;}
 // Large-batch bounded normal approximation; O(1), no loop per ore quantum.
 const u=Math.max(1e-12,resourceRandom(...key,'u')),v=resourceRandom(...key,'v'),z=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);return Math.max(0,Math.min(n,Math.round(n*p+Math.sqrt(n*p*(1-p))*z)));
}
export function sampleGradeBatch({depositId,batchSerial,oreAmountU,gradeProbabilities,seed}){validateGradeProbabilities(gradeProbabilities);const n=resourceQuanta(oreAmountU);if(!Number.isFinite(oreAmountU)||oreAmountU<0||oreAmountU>1e12||!Number.isSafeInteger(batchSerial)||batchSerial<0||typeof depositId!=='string')throw Error('배치 ID/일련번호/0.001 U 물량 오류');const key=[seed,depositId,batchSerial],low=binomial(n,gradeProbabilities.low,[...key,'low']),remaining=n-low,medium=binomial(remaining,gradeProbabilities.low===1?0:Math.min(1,Math.max(0,gradeProbabilities.medium/(1-gradeProbabilities.low))),[...key,'medium']),quanta={low,medium,high:remaining-medium};return {quanta,gradeAmountsU:Object.fromEntries(ORE_GRADES.map(k=>[k,quanta[k]/1000])),inputQuanta:n};}
export function computeAlloyYield(amounts,{smeltingTech=0}={}){if(!Number.isFinite(smeltingTech)||smeltingTech<0||smeltingTech>100)throw Error('제련 기술 범위 오류');let inputU=0,alloyU=0;for(const k of ORE_GRADES){const n=amounts[k]??0;if(!Number.isFinite(n)||n<0||n>1e12)throw Error('등급 산출량 오류');inputU+=n;alloyU+=n*Math.min(1,INITIAL_ALLOY_YIELDS[k]*(1+.025*smeltingTech));}alloyU=Number(alloyU.toPrecision(15));return {inputU,alloyU,residueU:Number((inputU-alloyU).toPrecision(15))};}
