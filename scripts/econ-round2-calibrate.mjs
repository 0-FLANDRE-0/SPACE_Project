import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {simulateEconomy,createEconomy,privateEquilibriumPrice,ECON_ROUND2_SCENARIOS as SCENARIOS} from '../dist/src/economy-model.js';
import {latinHypercube,metrics as round1Metrics} from './econ-calibrate.mjs';
export const readRound2Config=()=>JSON.parse(fs.readFileSync(new URL('./econ-round2.config.json',import.meta.url)));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const boundMargin=(x,low,high)=>x===null||!Number.isFinite(x)?-10:Math.min((x-low)/(high-low),(high-x)/(high-low));
const upperMargin=(x,max)=>x===null||!Number.isFinite(x)?-10:(max-x)/max;
export function classifyRound2(m,p,config){
 const c=config.criteria,scope=config.scopes,scenario=m.scenario,margins={integrity:m.integrity===false?-1:1};
 if(scope.peace.includes(scenario)){
  margins.peacePrice=upperMargin(m.peaceDeviation,c.peaceDeviation);
  margins.meanPrice=upperMargin(Math.abs(m.meanRealPrice/p.baseAlloyPrice-1),c.meanPriceDeviation);
  margins.inflation=Math.min(boundMargin(m.inflationMin,c.inflationMin,c.inflationMax),boundMargin(m.inflationMax,c.inflationMin,c.inflationMax));
 }
 if(scope.budget.includes(scenario))margins.budget17=boundMargin(m.budgetRatio17,c.budget17Min,c.budget17Max);
 margins.paybackZeroOperating=boundMargin(m.payback0OrderYears,c.paybackMinYears,c.paybackMaxYears);
 if(scope.war.includes(scenario)){
  margins.warPeak=boundMargin(m.warPeak,c.warPeakMin,c.warPeakMax);
  margins.warRecovery=upperMargin(m.warRecoveryYears,c.recoveryMaxYears);
  margins.warProcurement=m.warPurchasedU===p.warAlloyU?1:-1;
 }
 if(scope.support.includes(scenario))margins.colonyBurden=upperMargin(m.colonyBurden5,c.colonyBurdenMax);
 const checks=Object.fromEntries(Object.entries(margins).map(([k,v])=>[k,v>=-1e-8]));
 return {margins,checks,passed:Object.values(checks).every(Boolean),robustness:Math.min(...Object.values(margins))};
}
export function round2Metrics(result,p,config){
 const {checks:oldChecks,passed:oldPassed,penalty:oldPenalty,...base}=round1Metrics(result,p,config.criteria);
 const r=result.rows,last=r.at(-1),meanRealPrice=mean(r.slice(1).map(x=>x.realAlloyPrice));
 const m={...base,integrity:true,meanRealPrice,meanPriceDeviation:Math.abs(meanRealPrice/p.baseAlloyPrice-1),equilibriumPrice:privateEquilibriumPrice(p),privateCapacity20:last.privateCapacityU,privateExpansionOrderedU:last.privateExpansionOrderedU,privateExpansionDeliveredU:last.privateExpansionDeliveredU,governmentSoldU:last.governmentSoldU,governmentSalesC:last.governmentSalesC};
 return {...m,...classifyRound2(m,p,config)};
}
export function filteredLatinHypercube(config){
 if(config.parameters.velocity!==1.3333||'velocity' in config.ranges)throw Error('Round2 velocity is fixed at1.3333');
 if(!Number.isInteger(config.samples)||config.samples<1||config.seeds.length!==5||new Set(config.seeds).size!==5)throw Error('Positive samples and exactly5 distinct seeds required');
 if(config.parameters.baseAlloyPrice!==2.3||config.months!==240)throw Error('Fixed initial price and 240months required');
 const accepted=[];let proposed=0,batches=0;
 for(;batches<config.maxProposalBatches&&accepted.length<config.samples;batches++){
  const proposals=latinHypercube({...config,samplingSeed:config.samplingSeed+':batch:'+batches});
  for(let i=0;i<proposals.length&&accepted.length<config.samples;i++){
   proposed++;const p=proposals[i],equilibrium=privateEquilibriumPrice(p);
   if(equilibrium>=config.equilibriumBand[0]&&equilibrium<=config.equilibriumBand[1])accepted.push({id:'R2-'+String(accepted.length+1).padStart(3,'0'),parameters:p,proposal:{batch:batches,index:i},equilibrium});
  }
 }
 if(accepted.length!==config.samples)throw Error('Equilibrium rejection sampler exhausted before filling design');
 return {accepted,proposed,rejected:proposed-accepted.length,batches,method:'seeded Latin hypercube proposal batches + analytical equilibrium rejection; accepted marginals are conditional'};
}
export function aggregateRound2(id,p,records){
 const checks={},worstMargins={},failures={};
 for(const r of records)for(const [key,pass]of Object.entries(r.checks)){
  checks[key]=(checks[key]??true)&&pass;worstMargins[key]=Math.min(worstMargins[key]??Infinity,r.margins[key]);if(!pass)failures[key]=(failures[key]??0)+1;
 }
 const perScenario={};
 for(const scenario of SCENARIOS){
  const rows=records.filter(r=>r.scenario===scenario);if(!rows.length)continue;
  const values={};for(const key of ['realGDP20','priceIndex20','meanRealPrice','peaceDeviation','budgetRatio17','realBudgetRatio17','governmentShare17','colonyBurden5','warPeak','warRecoveryYears','privateCapacity20','privateExpansionOrderedU','governmentSoldU','governmentSalesC','treasury20','debt20','payback0OrderYears','paybackOperatingOrderYears']){
   values[key]=rows.some(r=>r[key]===null)?null:mean(rows.map(r=>r[key]));
  }
  perScenario[scenario]=values;
 }
 return {id,parameters:p,equilibriumPrice:privateEquilibriumPrice(p),passed:records.every(r=>r.passed),passingRuns:records.filter(r=>r.passed).length,runCount:records.length,robustness:Math.min(...Object.values(worstMargins)),worstMargins,checks,failures,perScenario};
}
export function evaluateProfile(id,p,config){
 const records=[];
 for(const scenario of SCENARIOS)for(const seed of config.seeds){const result=simulateEconomy(p,{scenario,seed,months:config.months,diagnostics:true});records.push({id,...round2Metrics(result,p,config)});}
 return {summary:aggregateRound2(id,p,records),records};
}
export function roundProfile(p,config,scale=1){
 const next=structuredClone(p);
 for(const [key,step]of Object.entries(config.roundingSteps)){
  const quantum=key==='expansionDelayMonths'?1:step*scale,[low,high]=config.ranges[key];
  next[key]=Number(Math.max(low,Math.min(high,Math.round(p[key]/quantum)*quantum)).toPrecision(12));
 }
 next.velocity=1.3333;return next;
}
export function compareSelling(summary){
 const a=summary.perScenario.S1,b=summary.perScenario['S1-sell'];
 return {governmentShareS1:a.governmentShare17,governmentShareSell:b.governmentShare17,meanPriceS1:a.meanRealPrice,meanPriceSell:b.meanRealPrice,priceChange:b.meanRealPrice/a.meanRealPrice-1,privateCapacityS1:a.privateCapacity20,privateCapacitySell:b.privateCapacity20,privateCapacityChange:b.privateCapacity20/a.privateCapacity20-1,privateOrdersS1:a.privateExpansionOrderedU,privateOrdersSell:b.privateExpansionOrderedU,privateOrdersChange:a.privateExpansionOrderedU?b.privateExpansionOrderedU/a.privateExpansionOrderedU-1:null,governmentSoldU:b.governmentSoldU,governmentSalesC:b.governmentSalesC,treasuryS1:a.treasury20,treasurySell:b.treasury20};
}
export function equilibriumRelationship(rows,normalPrice=2.3,meanTolerance=.08){
 const x=rows.map(r=>r.equilibrium),y=rows.map(r=>r.meanRealPrice),mx=mean(x),my=mean(y);
 let covariance=0,vx=0,vy=0;for(let i=0;i<x.length;i++){covariance+=(x[i]-mx)*(y[i]-my);vx+=(x[i]-mx)**2;vy+=(y[i]-my)**2;}
 const ordered=[...x].sort((a,b)=>a-b),percentile=p=>ordered[Math.floor((ordered.length-1)*p)];
 return {count:rows.length,thresholdMin:ordered[0],thresholdP10:percentile(.1),thresholdMedian:percentile(.5),thresholdP90:percentile(.9),thresholdMax:ordered.at(-1),thresholdMean:mx,actualMean:my,meanGap:my-mx,pearson:vx&&vy?covariance/Math.sqrt(vx*vy):0,slope:vx?covariance/vx:0,withinMeanBand:rows.filter(r=>Math.abs(r.meanRealPrice/normalPrice-1)<=meanTolerance).length};
}
function csv(file,rows){
 if(!rows.length){fs.writeFileSync(file,'');return;}
 const scalarKeys=Object.keys(rows[0]).filter(k=>rows[0][k]===null||typeof rows[0][k]!=='object'),keys=[...scalarKeys,'failedCriteria','minimumMargin'];
 fs.writeFileSync(file,keys.join(',')+'\n'+rows.map(r=>keys.map(k=>k==='failedCriteria'?Object.keys(r.checks).filter(k=>!r.checks[k]).join('|'):k==='minimumMargin'?r.robustness:r[k]??'').join(',')).join('\n')+'\n');
}
function prepareOut(out){
 const full=path.resolve(out),root=path.resolve('docs/econ-sim'),allowed=path.resolve('docs/econ-sim/round2');
 if((full===root||full.startsWith(root+path.sep))&&full!==allowed&&!full.startsWith(allowed+path.sep))throw Error('Round1 output path is protected');
 fs.mkdirSync(out,{recursive:true});
}
export function executeRound2(config,{out='docs/econ-sim/round2',charts=true}={}){
 const started=performance.now();prepareOut(out);
 const official=JSON.parse(fs.readFileSync('dist/data/planet-surfaces/sol-earth-v2.json'));
 if(Object.values(official.startingScenario.cells).reduce((n,c)=>n+c.populationPersons,0)!==config.parameters.bodies.earth.populationPersons)throw Error('Official Earth mismatch');
 const sample=filteredLatinHypercube(config),runs=[],combinations=[];
 for(let i=0;i<sample.accepted.length;i++){
  const profile=sample.accepted[i],result=evaluateProfile(profile.id,profile.parameters,config);
  for(const r of result.records){for(const key of Object.keys(config.ranges))r['param_'+key]=profile.parameters[key];r.param_velocity=profile.parameters.velocity;}
  runs.push(...result.records);combinations.push({...result.summary,proposal:profile.proposal});
  if(i%64===0)console.log('Round2 '+i+'/'+sample.accepted.length+' profiles');
 }
 const sorted=[...combinations].sort((a,b)=>Number(b.passed)-Number(a.passed)||b.robustness-a.robustness||a.id.localeCompare(b.id)),candidates=sorted.slice(0,3);
 const roundedAttempts=[],roundedRecords=[];let sequence=0;
 for(const candidate of candidates)for(const scale of config.roundingScales){
  const id='rounded-'+(++sequence),p=roundProfile(candidate.parameters,config,scale),result=evaluateProfile(id,p,config),eq=privateEquilibriumPrice(p);
  result.summary.equilibriumEligible=eq>=config.equilibriumBand[0]&&eq<=config.equilibriumBand[1];
  result.summary.accepted=result.summary.passed&&result.summary.equilibriumEligible;
  roundedAttempts.push({...result.summary,sourceCandidate:candidate.id,roundingScale:scale});roundedRecords.push(...result.records);
 }
 const rounded=[...roundedAttempts].sort((a,b)=>Number(b.accepted)-Number(a.accepted)||Number(b.equilibriumEligible)-Number(a.equilibriumEligible)||b.robustness-a.robustness||b.roundingScale-a.roundingScale)[0];
 // Prefer the coarsest successful human-readable rounding, then its safety margin.
 const acceptedRounded=roundedAttempts.filter(x=>x.accepted).sort((a,b)=>b.roundingScale-a.roundingScale||b.robustness-a.robustness);
 const recommended=acceptedRounded[0]??rounded;
 const firstRound=JSON.parse(fs.readFileSync('docs/econ-sim/candidates.json')),comparisons=[],comparisonRuns=[];
 for(const old of firstRound.candidates){
  const p=structuredClone(old.parameters);p.velocity=1.3333;
  const result=evaluateProfile('R1-'+old.id,p,config);comparisons.push({...result.summary,originalId:old.id,originalMetrics:old.metrics,equilibriumEligible:privateEquilibriumPrice(p)>=config.equilibriumBand[0]&&privateEquilibriumPrice(p)<=config.equilibriumBand[1]});comparisonRuns.push(...result.records);
 }
 const profiles=[...candidates,{...recommended,id:'recommended'}],series=[];
 for(const profile of profiles){
  const data={id:profile.id,scenarios:{}};
  for(const scenario of SCENARIOS)data.scenarios[scenario]=simulateEconomy(profile.parameters,{scenario,seed:config.seeds[0],months:240,diagnostics:true}).rows.map(({flow,...r})=>r);
  series.push(data);
 }
 const timings=[];for(let i=0;i<42;i++){const t=performance.now();simulateEconomy(recommended.parameters,{scenario:SCENARIOS[i%SCENARIOS.length],seed:config.seeds[0],diagnostics:true});if(i>=2)timings.push(performance.now()-t);}timings.sort((a,b)=>a-b);
 const benchmarkMs={p50:timings[20],p95:timings[38],max:timings.at(-1),runs:40,warmup:2};
 const sellingComparisons=profiles.map(p=>({id:p.id,...compareSelling(p)}));
 const equilibriumStudy=combinations.map(p=>({id:p.id,equilibrium:p.equilibriumPrice,meanRealPrice:p.perScenario.S0.meanRealPrice,passed:p.passed}));
 const equilibriumSummary=equilibriumRelationship(equilibriumStudy,config.parameters.baseAlloyPrice,config.criteria.meanPriceDeviation);
 const modelHash=hash(fs.readFileSync('dist/src/economy-model.js')),configHash=hash(JSON.stringify(config)),referenceHash=hash(JSON.stringify(series.find(p=>p.id==='recommended').scenarios.S0));
 const core={status:config.status,baselineCommit:config.baselineCommit,config,sampling:{method:sample.method,proposals:sample.proposed,rejected:sample.rejected,batches:sample.batches,combinations:combinations.length,scenarios:SCENARIOS.length,seeds:config.seeds.length,runs:runs.length,passing:combinations.filter(p=>p.passed).length,passingFraction:combinations.filter(p=>p.passed).length/combinations.length,roundingRuns:roundedRecords.length,comparisonRuns:comparisonRuns.length,seriesRuns:series.length*SCENARIOS.length,benchmarkRuns:42},candidates,recommended,roundedAttempts,round1Comparisons:comparisons,sellingComparisons,equilibriumStudy,equilibriumSummary,benchmarkMs,modelHash,configHash,referenceHash,initialMoneyC:createEconomy(recommended.parameters).moneyQ/1000};
 const write=(file,data)=>fs.writeFileSync(path.join(out,file),JSON.stringify(data,null,2)+'\n');
 write('results.json',core);write('candidates.json',{status:config.status,candidates,recommended});write('combinations.json',combinations);write('series.json',series);
 csv(path.join(out,'runs.csv'),runs);csv(path.join(out,'rounding-runs.csv'),roundedRecords);csv(path.join(out,'round1-rechecks.csv'),comparisonRuns);
 if(charts)execFileSync('python3',['scripts/econ-round2-plots.py',out],{stdio:'inherit'});
 core.elapsedMs=performance.now()-started;write('results.json',core);
 execFileSync(process.execPath,['scripts/econ-round2-report.mjs',out],{stdio:'inherit'});
 console.log(JSON.stringify({sampling:core.sampling,recommended:{id:recommended.id,accepted:recommended.accepted,failures:recommended.failures,robustness:recommended.robustness},candidates:candidates.map(p=>({id:p.id,passed:p.passed,robustness:p.robustness,failures:p.failures})),benchmarkMs,elapsedMs:core.elapsedMs,referenceHash},null,2));
 return core;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const config=readRound2Config(),args=process.argv.slice(2);if(args.includes('--samples'))config.samples=Number(args[args.indexOf('--samples')+1]);
 executeRound2(config,{out:args.includes('--out')?args[args.indexOf('--out')+1]:'docs/econ-sim/round2',charts:!args.includes('--no-charts')});
}
