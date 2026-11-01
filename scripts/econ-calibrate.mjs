import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resourceRandom} from '../dist/src/ore-quality.js';
import {ECON_SCENARIOS,ECON_SHIPS,ECON_Q,simulateEconomy,setPayback} from '../dist/src/economy-model.js';
export const configPath=fileURLToPath(new URL('./econ-calibrate.config.json',import.meta.url));
export const readConfig=()=>JSON.parse(fs.readFileSync(configPath,'utf8'));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const range=(x,a,b)=>Math.max(0,a-x,x-b)/(b-a||1);
const round=x=>Math.round(x*1e6)/1e6;
export function metrics(result,p,c){
 const r=result.rows,s=result.state,peace=['S0','S1','S2'].includes(s.scenario),at=n=>r[Math.min(n,r.length-1)];
 const yearly=[];for(let t=12;t<r.length;t+=12)yearly.push(at(t).priceIndex/at(t-12).priceIndex-1);
 const initialBudget=at(0).annualBudgetC,budget17=at(204).annualBudgetC/initialBudget;
 const peaceDeviation=Math.max(...r.slice(1).map(x=>Math.abs(x.realAlloyPrice/p.baseAlloyPrice-1)));
 const warEnd=p.warStartMonth+p.warDurationMonths,warRows=r.slice(p.warStartMonth+1,warEnd+1);
 const peak=Math.max(...warRows.map(x=>x.realAlloyPrice/p.baseAlloyPrice-1));
 let recovery=null;
 for(let i=warEnd;i<=r.length-c.recoveryHoldMonths;i++){
  if(r.slice(i,i+c.recoveryHoldMonths).every(x=>Math.abs(x.realAlloyPrice/p.baseAlloyPrice-1)<=c.recoveryDeviation)){recovery=(i-warEnd)/12;break;}
 }
 const first5=r.slice(1,61),support=first5.reduce((s,x)=>s+x.flow.supportQ,0),budgets=first5.reduce((s,x)=>s+x.flow.budgetQ,0);
 // 12-month flow windows avoid selecting a favourable single commissioning tick.
 const window17=r.slice(193,205),gov=window17.reduce((s,x)=>s+x.governmentSupplyU,0),priv=window17.reduce((s,x)=>s+x.privateSupplyU,0);
 const payback0=setPayback(p,{operatingRate:0}),payback=setPayback(p);
 const resultMetrics={scenario:s.scenario,seed:s.seed,realGDP10:at(120).realGDP,realGDP17:at(204).realGDP,realGDP20:at(240).realGDP,nominalGDP20:at(240).nominalGDP,priceIndex20:at(240).priceIndex,realAlloy20:at(240).realAlloyPrice,nominalAlloy20:at(240).nominalAlloyPrice,annualBudget17:at(204).annualBudgetC,budgetRatio17:budget17,realBudgetRatio17:budget17/at(204).priceIndex,peaceDeviation,inflationMin:Math.min(...yearly),inflationMax:Math.max(...yearly),governmentShare17:gov/priv,warPeak:peak,warRecoveryYears:recovery,warPurchasedU:s.warPurchasedQ/ECON_Q,colonyBurden5:support/budgets,treasury20:at(240).treasuryC,debt20:at(240).debtC,sets20:s.plants.length,ships20:at(240).activeShips,payback0SteadyYears:payback0.steadyYears,payback0OrderYears:payback0.fromOrderYears,paybackOperatingOrderYears:payback.fromOrderYears,oreMinedU:(s.ledger.governmentOreMinedQ+s.ledger.privateOreMinedQ)/ECON_Q,skippedOrders:s.skippedOrders};
 for(const year of [10,17,20])for(const key of ['realGDP','nominalGDP','priceIndex','realAlloyPrice','nominalAlloyPrice','annualBudgetC','treasuryC','debtC','privateSupplyU','governmentSupplyU'])resultMetrics[key+year]=at(year*12)[key];
 const checks={integrity:true};
 if(peace){checks.peacePrice=peaceDeviation<=c.peaceDeviation+1e-8;checks.inflation=resultMetrics.inflationMin>=c.inflationMin-1e-8&&resultMetrics.inflationMax<=c.inflationMax+1e-8;checks.budget17=budget17>=c.budget17Min&&budget17<=c.budget17Max;}
 if(s.scenario==='S1')checks.governmentMinor=resultMetrics.governmentShare17<=c.governmentShare17Max;
 checks.paybackZeroOperating=payback0.fromOrderYears!==null&&payback0.fromOrderYears>=c.paybackMinYears&&payback0.fromOrderYears<=c.paybackMaxYears;
 if(s.scenario.startsWith('S3')){checks.warPeak=peak>=c.warPeakMin&&peak<=c.warPeakMax;checks.warRecovery=recovery!==null&&recovery>=c.recoveryMinYears&&recovery<=c.recoveryMaxYears;checks.warProcurement=s.warPurchasedQ===Math.round(p.warAlloyU*ECON_Q);}
 checks.colonyBurden=resultMetrics.colonyBurden5<=c.colonyBurdenMax;
 // Preserve both bounds of the user's provisional 2–4 year target.
 let penalty=0;
 if(peace)penalty+=Math.max(0,peaceDeviation/c.peaceDeviation-1)+range(resultMetrics.inflationMin,c.inflationMin,c.inflationMax)+range(resultMetrics.inflationMax,c.inflationMin,c.inflationMax)+range(budget17,c.budget17Min,c.budget17Max);
 if(s.scenario==='S1')penalty+=Math.max(0,resultMetrics.governmentShare17/c.governmentShare17Max-1);
 penalty+=payback0.fromOrderYears===null?10:range(payback0.fromOrderYears,c.paybackMinYears,c.paybackMaxYears);
 if(s.scenario.startsWith('S3'))penalty+=range(peak,c.warPeakMin,c.warPeakMax)+(recovery===null?5:range(recovery,c.recoveryMinYears,c.recoveryMaxYears))+(1-s.warPurchasedQ/Math.max(1,Math.round(p.warAlloyU*ECON_Q)));
 penalty+=Math.max(0,resultMetrics.colonyBurden5/c.colonyBurdenMax-1);
 return {...resultMetrics,checks,passed:Object.values(checks).every(Boolean),penalty};
}
export function latinHypercube(config){
 const {samples:n,ranges,samplingSeed}=config,columns={};
 for(const [key,[low,high]]of Object.entries(ranges)){
  const cells=Array.from({length:n},(_,i)=>({value:low+(high-low)*(i+resourceRandom(samplingSeed,key,i,'jitter'))/n,sort:resourceRandom(samplingSeed,key,i,'permutation')}));
  cells.sort((a,b)=>a.sort-b.sort);columns[key]=cells.map(x=>x.value);
 }
 return Array.from({length:n},(_,i)=>{const p=structuredClone(config.parameters);for(const k of Object.keys(columns))p[k]=k==='expansionDelayMonths'?Math.round(columns[k][i]):columns[k][i];return p;});
}
function ranks(a){const order=a.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),r=[];for(let i=0;i<order.length;){let j=i+1;while(j<order.length&&order[j].v===order[i].v)j++;for(let k=i;k<j;k++)r[order[k].i]=(i+j-1)/2;i=j;}return r;}
function correlation(a,b){const x=ranks(a),y=ranks(b),mx=mean(x),my=mean(y);let c=0,vx=0,vy=0;for(let i=0;i<x.length;i++){c+=(x[i]-mx)*(y[i]-my);vx+=(x[i]-mx)**2;vy+=(y[i]-my)**2;}return vx&&vy?c/Math.sqrt(vx*vy):0;}
function aggregate(id,p,records){
 const by=k=>records.filter(x=>x.scenario===k),avg=(key,scen)=>{const values=(scen?by(scen):records).map(x=>x[key]);return values.some(x=>x===null)?null:mean(values);};
 const failures={};for(const r of records)for(const [key,pass]of Object.entries(r.checks))if(!pass)failures[key]=(failures[key]??0)+1;
 return {id,parameters:p,passed:records.every(r=>r.passed),passingRuns:records.filter(r=>r.passed).length,runCount:records.length,penalty:mean(records.map(r=>r.penalty)),failures,metrics:{realGDP20:avg('realGDP20','S0'),priceIndex20:avg('priceIndex20','S0'),budgetRatio17:avg('budgetRatio17','S0'),governmentShare17:avg('governmentShare17','S1'),warPeak:avg('warPeak','S3-debt'),warRecoveryYears:avg('warRecoveryYears','S3-debt'),colonyBurden5:avg('colonyBurden5','S4'),treasury20:avg('treasury20','S2')}};
}
export function executeCalibration(config,{out='docs/econ-sim',charts=true}={}){
 const started=performance.now();
 if(!Number.isInteger(config.samples)||config.samples<1||!Number.isInteger(config.months)||config.months<240||config.months%12)throw Error('Positive sample count and >=240 complete months required');
 if(config.seeds.length<3||new Set(config.seeds).size!==config.seeds.length)throw Error('At least three distinct seeds required');
 if(config.parameters.baseAlloyPrice!==2.3)throw Error('User-fixed initial alloy price must remain2.3');
 for(const [key,bounds]of Object.entries(config.ranges))if(!Number.isFinite(config.parameters[key])||bounds.length!==2||!bounds.every(Number.isFinite)||bounds[1]<bounds[0]||key==='baseAlloyPrice')throw Error('Invalid or fixed parameter range '+key);
 fs.mkdirSync(out,{recursive:true});
 const official=JSON.parse(fs.readFileSync('dist/data/planet-surfaces/sol-earth-v2.json'));
 const population=Object.values(official.startingScenario.cells).reduce((n,c)=>n+c.populationPersons,0);
 if(population!==config.parameters.bodies.earth.populationPersons)throw Error('Official Earth population mismatch');
 const scenarios=ECON_SCENARIOS,parameters=[structuredClone(config.parameters),...latinHypercube(config)],runs=[],combinations=[];
 for(let i=0;i<parameters.length;i++){
  const p=parameters[i],id=i===0?'baseline':'LHS-'+String(i).padStart(3,'0'),records=[];
  for(const scenario of scenarios)for(const seed of config.seeds){
   const r=simulateEconomy(p,{scenario,seed,months:config.months}),m=metrics(r,p,config.criteria);const record={id,...m};records.push(record);runs.push(record);
  }
  combinations.push(aggregate(id,p,records));if(i%64===0)console.log('Completed '+i+'/'+parameters.length+' parameter sets');
 }
 const eligible=combinations.filter(x=>x.id!=='baseline').sort((a,b)=>Number(b.passed)-Number(a.passed)||a.penalty-b.penalty);
 // Take near-best alternatives with materially different growth/budget choices.
 const candidates=[];
 for(const x of eligible){if(candidates.length===0||candidates.every(y=>Math.abs(x.parameters.strategyShare-y.parameters.strategyShare)/.03+Math.abs(x.parameters.productivityGrowth-y.parameters.productivityGrowth)/.02+Math.abs(x.parameters.alloyMarketShare-y.parameters.alloyMarketShare)/.025>.22))candidates.push(x);if(candidates.length===3)break;}
 for(const x of eligible){if(candidates.length===3)break;if(!candidates.includes(x))candidates.push(x);}
 const sensitivityMetrics=Object.keys(eligible[0].metrics),sensitivity=Object.keys(config.ranges).map(parameter=>{const correlations=Object.fromEntries(sensitivityMetrics.map(k=>[k,correlation(eligible.map(x=>x.parameters[parameter]),eligible.map(x=>x.metrics[k]??(config.months/12+1)))]));return {parameter,score:mean(Object.values(correlations).map(Math.abs)),correlations};}).sort((a,b)=>b.score-a.score);
 const candidateSeries=[],controls=[],oat=[];let extraRuns=0;
 for(const candidate of candidates){
  const p=candidate.parameters;
  const series={id:candidate.id,scenarios:{}};
  for(const scenario of scenarios){series.scenarios[scenario]=simulateEconomy(p,{scenario,seed:config.seeds[0],months:config.months}).rows.map(({flow,...row})=>row);extraRuns++;}
  candidateSeries.push(series);
  for(const variant of [{id:'fixed-money',moneyRule:'fixed',indexed:true},{id:'fixed-credit-prices',moneyRule:'growth',indexed:false},{id:'fixed-money-and-credit-prices',moneyRule:'fixed',indexed:false}]){
   for(const scenario of scenarios)for(const seed of config.seeds){
    const result=simulateEconomy(p,{scenario,seed,months:config.months,...variant}),m=metrics(result,p,config.criteria);controls.push({candidate:candidate.id,variant:variant.id,...m,realSupportShipCost20:ECON_SHIPS.support.creditC*(variant.indexed?result.rows.at(-1).priceIndex:1)/result.rows.at(-1).priceIndex});extraRuns++;
   }
  }
  for(const [parameter,[low,high]]of Object.entries(config.ranges))for(const direction of [-1,1]){
   const changed=structuredClone(p);changed[parameter]=Math.max(low,Math.min(high,p[parameter]+direction*(high-low)*.1));if(parameter==='expansionDelayMonths')changed[parameter]=Math.round(changed[parameter]);
   const rows=[];
   for(const scenario of ['S0','S1','S3-debt'])for(const seed of config.seeds){const result=simulateEconomy(changed,{scenario,seed,months:config.months});rows.push(metrics(result,changed,config.criteria));extraRuns++;}
   oat.push({candidate:candidate.id,parameter,direction,value:changed[parameter],realGDP20:mean(rows.filter(x=>x.scenario==='S0').map(x=>x.realGDP20)),budgetRatio17:mean(rows.filter(x=>x.scenario==='S0').map(x=>x.budgetRatio17)),governmentShare17:mean(rows.filter(x=>x.scenario==='S1').map(x=>x.governmentShare17)),warPeak:mean(rows.filter(x=>x.scenario==='S3-debt').map(x=>x.warPeak))});
  }
 }
 const sampleResult=simulateEconomy(config.parameters,{months:240});simulateEconomy(config.parameters,{months:240});const benchmark=[];
 for(let i=0;i<40;i++){const t=performance.now();simulateEconomy(config.parameters,{scenario:scenarios[i%scenarios.length],months:240});benchmark.push(performance.now()-t);}benchmark.sort((a,b)=>a-b);
 const benchmarkMs={p50:benchmark[20],p95:benchmark[38],max:benchmark.at(-1),note:'40 in-process 240-month runs; includes all ledger assertions'};
 const worldGDP=Object.values(config.parameters.bodies).reduce((n,b)=>n+b.annualGDP,0);
 const velocities=[1,1.25,4/3,1.5,1.75,2,worldGDP/15000000,worldGDP/8000000].map(velocity=>({velocity,initialMoneyC:Math.round(worldGDP/velocity*1000)/1000,insideSearch:velocity>=1&&velocity<=2}));
 const result={status:config.status,baselineCommit:config.baselineCommit,config,sampling:{method:'deterministic Latin hypercube',lhs:config.samples,baseline:1,scenarios:scenarios.length,seeds:config.seeds.length,searchRuns:runs.length,extraRuns,benchmarkRuns:42,passingCombinations:combinations.filter(x=>x.passed).length,passingLHS:eligible.filter(x=>x.passed).length},candidates,baseline:combinations[0],sensitivity,oat,controls,velocities,benchmarkMs,modelHash:crypto.createHash('sha256').update(fs.readFileSync('dist/src/economy-model.js')).digest('hex'),sampleHash:crypto.createHash('sha256').update(JSON.stringify(sampleResult.rows)).digest('hex')};
 const columns=['id','scenario','seed','passed','penalty','realGDP10','realGDP17','realGDP20','nominalGDP20','priceIndex20','realAlloy20','nominalAlloy20','annualBudget17','budgetRatio17','realBudgetRatio17','peaceDeviation','inflationMin','inflationMax','governmentShare17','warPeak','warRecoveryYears','warPurchasedU','colonyBurden5','payback0SteadyYears','payback0OrderYears','paybackOperatingOrderYears','treasury20','debt20','sets20','ships20','oreMinedU','skippedOrders'];
 for(const year of [10,17,20])for(const key of ['realGDP','nominalGDP','priceIndex','realAlloyPrice','nominalAlloyPrice','annualBudgetC','treasuryC','debtC','privateSupplyU','governmentSupplyU'])if(!columns.includes(key+year))columns.push(key+year);
 const lookup=Object.fromEntries(combinations.map(x=>[x.id,x.parameters]));for(const key of Object.keys(config.ranges)){const column='param_'+key;columns.push(column);for(const row of runs)row[column]=lookup[row.id][key];}
 fs.writeFileSync(path.join(out,'combinations.json'),JSON.stringify(combinations,null,2)+'\n');
 fs.writeFileSync(path.join(out,'runs.csv'),columns.join(',')+'\n'+runs.map(r=>columns.map(k=>typeof r[k]==='number'?round(r[k]):r[k]??'').join(',')).join('\n')+'\n');
 fs.writeFileSync(path.join(out,'candidates.json'),JSON.stringify({status:config.status,criteria:config.criteria,candidates},null,2)+'\n');
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');
 fs.writeFileSync(path.join(out,'series.json'),JSON.stringify(candidateSeries)+'\n');
 if(charts)execFileSync('python3',['scripts/econ-report-plots.py',out],{stdio:'inherit'});
 const elapsed=performance.now()-started;result.elapsedMs=elapsed;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');
 writeReport(out,result,candidateSeries);
 console.log(JSON.stringify({runs:runs.length,extras:extraRuns,passing:result.sampling.passingCombinations,elapsedMs:elapsed,benchmarkMs,candidates:candidates.map(c=>({id:c.id,passed:c.passed,penalty:c.penalty,failures:c.failures}))},null,2));
 return result;
}
function writeReport(out,result,series){
 // Kept in a separate script so the model has no filesystem/render dependency.
 execFileSync(process.execPath,['scripts/econ-write-report.mjs',out],{stdio:'inherit'});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),config=readConfig();if(args.includes('--samples'))config.samples=Number(args[args.indexOf('--samples')+1]);
 const out=args.includes('--out')?args[args.indexOf('--out')+1]:'docs/econ-sim';executeCalibration(config,{out,charts:!args.includes('--no-charts')});
}
