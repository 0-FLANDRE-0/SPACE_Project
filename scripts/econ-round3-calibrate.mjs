import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {resourceRandom} from '../dist/src/ore-quality.js';
import {simulateEconomy,ECON_ROUND2_SCENARIOS} from '../dist/src/economy-model.js';
import {simulateEnergyEconomy,ENERGY_SCENARIOS} from '../dist/src/economy-energy-model.js';
import {POWER_TYPES} from '../dist/src/economy-energy-facilities.js';
import {energyMetrics,aggregate,industryFinance,generationFinance} from './econ-round3-analysis.mjs';
import {readRound3Inputs,sha256} from './econ-round3-inputs.mjs';
const read=f=>JSON.parse(fs.readFileSync(f)),write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n'),mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
export function sampleEnergy(config,n=config.samples,seed=config.samplingSeed){
 const samples=Array.from({length:n},()=>structuredClone(config.energy));
 for(const [key,[low,high]]of Object.entries(config.ranges)){
  const order=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(resourceRandom(seed,key,i,'shuffle')*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  for(let i=0;i<n;i++)samples[i][key]=low+(high-low)*(order[i]+resourceRandom(seed,key,i,'jitter'))/n;
 }
 for(let i=0;i<n;i++){samples[i].privatePowerLagMonths=Math.round(samples[i].privatePowerLagMonths);samples[i].industryMix=['steelHeavy','mixed','nonferrousHeavy'][i%3];}
 return samples;
}
function evaluate(job,shared){
 const {p,inputs,config}=shared,records=[];
 for(const scenario of job.scenarios)for(const seed of config.seeds){const r=simulateEnergyEconomy(job.parameters??p,job.energy,inputs,{scenario,seed,months:config.months});records.push({id:job.id,...energyMetrics(r,job.parameters??p,job.energy,config.criteria,{seed,scenario})});}
 return {summary:aggregate(job.id,job.energy,records),records};
}
class Pool {
 constructor(shared,count){this.workers=[];this.pending=[];this.active=0;for(let i=0;i<count;i++){const worker=new Worker(new URL(import.meta.url),{workerData:shared});worker.busy=false;worker.on('message',x=>{worker.busy=false;this.active--;const current=worker.current;worker.current=null;if(x.error)current.reject(Error(x.error));else current.resolve(x.result);this.flush();});worker.on('error',e=>{if(worker.current)worker.current.reject(e);});this.workers.push(worker);}}
 flush(){for(const worker of this.workers)if(!worker.busy&&this.pending.length){const task=this.pending.shift();worker.busy=true;worker.current=task;this.active++;worker.postMessage(task.job);}}
 run(job){return new Promise((resolve,reject)=>{this.pending.push({job,resolve,reject});this.flush();});}
 async phase(label,jobs){let done=0;const start=performance.now(),results=await Promise.all(jobs.map(job=>this.run(job).then(r=>{done++;if(done%32===0||done===jobs.length)console.log(label+': '+done+'/'+jobs.length+' profiles ('+((performance.now()-start)/1000).toFixed(1)+'s)');return r;})));return {results,seconds:(performance.now()-start)/1000};}
 async close(){await Promise.all(this.workers.map(w=>w.terminate()));}
}
function csv(file,rows){
 if(!rows.length){fs.writeFileSync(file,'');return;}const keys=[...new Set(rows.flatMap(r=>Object.keys(r).filter(k=>r[k]===null||typeof r[k]!=='object')))];
 const quote=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
 fs.writeFileSync(file,keys.join(',')+'\n'+rows.map(r=>keys.map(k=>quote(r[k])).join(',')).join('\n')+'\n');
}
const rank=a=>[...a].sort((x,y)=>Number(y.summary.passed)-Number(x.summary.passed)||Number(y.summary.macroPassed)-Number(x.summary.macroPassed)||y.summary.robustness-x.summary.robustness||x.summary.id.localeCompare(y.summary.id));
function roundEnergy(energy,ranges){const out=structuredClone(energy);for(const k of Object.keys(ranges)){const v=out[k],step=k.endsWith('C')?50:k.endsWith('AnnualU')?1000:k.endsWith('Months')?1:v>100?100:v>=10?1:v>=1?.1:.01;out[k]=Math.max(ranges[k][0],Math.min(ranges[k][1],Math.round(v/step)*step));}return out;}
function references(out,p,config,inputs){
 const previous=read('docs/econ-sim/round2/candidates.json'),profiles=[{id:previous.recommended.id,parameters:p},...previous.candidates],records=[],series={};
 for(const profile of profiles)for(const scenario of ECON_ROUND2_SCENARIOS)for(const seed of config.seeds){
  const params=profile.parameters,t=performance.now(),off=simulateEnergyEconomy(params,config.energy,inputs,{scenario,seed,months:config.months,energyEnabled:false}),on=simulateEnergyEconomy(params,config.energy,inputs,{scenario,seed,months:config.months});
  const clean=off.rows.map(({flow,...r})=>r),direct=simulateEconomy(params,{scenario,seed,months:config.months,diagnostics:true});
  if(sha256(JSON.stringify(clean))!==sha256(JSON.stringify(direct.rows.map(({flow,...r})=>r))))throw Error('OFF regression');
  const end=off.rows.at(-1),offMetric={id:profile.id,scenario,seed,mode:'OFF',realGDP20:end.realGDP,priceIndex20:end.priceIndex,meanRealAlloyPrice:mean(off.rows.slice(1).map(r=>r.realAlloyPrice)),treasury20:end.treasuryC,debt20:end.debtC,privateCapacity20U:end.privateCapacityU,rowsHash:sha256(JSON.stringify(clean))};
  const onMetric={id:profile.id,...energyMetrics(on,params,config.energy,config.criteria,{seed,scenario}),mode:'ON',pairMs:performance.now()-t};records.push(offMetric,onMetric);
  if(profile.id===previous.recommended.id&&seed===config.seeds[0]){series['OFF:'+scenario]=off.rows;series['ON:'+scenario]=on.rows;}
 }
 csv(path.join(out,'legacy-off-on.csv'),records);write(path.join(out,'legacy-off-on.json'),records);return {records,series};
}
export async function executeRound3(config,{out='docs/econ-sim/round3',workers=4}={}){
 const full=path.resolve(out),allowed=path.resolve('docs/econ-sim/round3');if(full!==allowed&&!full.startsWith(allowed+path.sep)&&!full.startsWith(path.resolve('artifacts')+path.sep))throw Error('Output must stay in Round3 or artifacts');
 fs.mkdirSync(out,{recursive:true});const start=performance.now(),p=read('docs/econ-sim/round2/candidates.json').recommended.parameters,inputs=readRound3Inputs();
 if(config.energy.fusionNormalHydrogenU!==2.5||config.months!==240||config.seeds.length<5)throw Error('Fixed comparison contract');
 const shared={p,inputs,config},pool=new Pool(shared,workers),timings={},runRecords=[];
 console.log('ECON-SIM-3 base '+config.baselineCommit+'; '+workers+' workers; '+config.samples+' broad profiles ×'+config.seeds.length+' seeds');
 const referenceStart=performance.now(),reference=references(out,p,config,inputs);timings.referencesSeconds=(performance.now()-referenceStart)/1000;
 const broad=await pool.phase('broad',sampleEnergy(config).map((energy,i)=>({id:'R3-B'+String(i+1).padStart(3,'0'),energy,scenarios:config.broadScenarios})));
 timings.broadSeconds=broad.seconds;const broadRanked=rank(broad.results);write(path.join(out,'broad-candidates.json'),broadRanked.map(x=>x.summary));runRecords.push(...broad.results.flatMap(x=>x.records).map(x=>({...x,phase:'broad'})));
 // OAT is run before narrowing, and its measured effects determine which axes
 // get narrowed. All other dimensions retain the top broad basins.
 const center=broadRanked[0].summary.energy,oatJobs=[];
 for(const [key,[low,high]]of Object.entries(config.ranges))for(const [label,value]of [['low',low],['high',high]])oatJobs.push({id:'OAT:'+key+':'+label,energy:{...center,[key]:key.endsWith('Months')?Math.round(value):value},scenarios:config.broadScenarios});
 const oat=await pool.phase('OAT',oatJobs);timings.oatSeconds=oat.seconds;runRecords.push(...oat.results.flatMap(x=>x.records).map(x=>({...x,phase:'oat'})));
 const sensitivities=Object.keys(config.ranges).map(key=>{const pair=oat.results.filter(x=>x.summary.id.startsWith('OAT:'+key+':')),m=pair.map(x=>({meanPrice:mean(x.records.filter(r=>r.scenario==='E0').map(r=>r.meanRealAlloyPrice)),earthUnserved:mean(x.records.map(r=>r.earthUnservedFraction)),colonyUnserved:mean(x.records.map(r=>r.colonyUnservedFraction)),hydrogenPrice:mean(x.records.map(r=>r.meanHydrogenPrice)),robustness:x.summary.robustness}));return {parameter:key,meanPriceDelta:m[1].meanPrice-m[0].meanPrice,earthUnservedDelta:m[1].earthUnserved-m[0].earthUnserved,colonyUnservedDelta:m[1].colonyUnserved-m[0].colonyUnserved,hydrogenPriceDelta:m[1].hydrogenPrice-m[0].hydrogenPrice,score:Math.abs(m[1].meanPrice-m[0].meanPrice)/2.3+Math.abs(m[1].earthUnserved-m[0].earthUnserved)+Math.abs(m[1].colonyUnserved-m[0].colonyUnserved)};}).sort((a,b)=>b.score-a.score);
 write(path.join(out,'sensitivity.json'),sensitivities);
 const varied=new Set(sensitivities.slice(0,8).map(x=>x.parameter)),lhs=sampleEnergy(config,config.narrowSamples,config.samplingSeed+':narrow');
 const narrowJobs=lhs.map((sample,i)=>{
  const anchor=broadRanked[i%8].summary.energy,energy=structuredClone(anchor);
  for(const key of varied){const [low,high]=config.ranges[key],fraction=(sample[key]-low)/(high-low);energy[key]=Math.max(low,Math.min(high,anchor[key]+(fraction-.5)*.24*(high-low)));if(key.endsWith('Months'))energy[key]=Math.round(energy[key]);}
  return {id:'R3-N'+String(i+1).padStart(3,'0'),energy,scenarios:config.narrowScenarios};
 });
 const narrow=await pool.phase('narrow',narrowJobs);timings.narrowSeconds=narrow.seconds;runRecords.push(...narrow.results.flatMap(x=>x.records).map(x=>({...x,phase:'narrow'})));write(path.join(out,'narrow-candidates.json'),rank(narrow.results).map(x=>x.summary));
 // Candidate rankings use the same nine scenarios; extend broad finalists
 // before comparing them with the narrower search, rather than comparing
 // unequal scenario scores as if they were interchangeable.
 const extended=await pool.phase('broad-finalists',broadRanked.slice(0,8).map(x=>({id:x.summary.id,energy:x.summary.energy,scenarios:config.narrowScenarios})));
 timings.extendSeconds=extended.seconds;runRecords.push(...extended.results.flatMap(x=>x.records).map(x=>({...x,phase:'extended'})));
 const finalists=rank([...extended.results,...narrow.results]).slice(0,3),roundedEnergy=roundEnergy(finalists[0].summary.energy,config.ranges);
 const finalJobs=[...finalists.map(x=>({id:x.summary.id,energy:x.summary.energy,scenarios:ENERGY_SCENARIOS})),{id:'R3-rounded',energy:roundedEnergy,scenarios:ENERGY_SCENARIOS}];
 const final=await pool.phase('all-scenario validation',finalJobs);timings.finalSeconds=final.seconds;runRecords.push(...final.results.flatMap(x=>x.records).map(x=>({...x,phase:'final'})));
 const recommended=final.results.at(-1).summary,candidates=final.results.slice(0,3).map(x=>x.summary),special=[],selectedSeries={};
 // Paired experiments change only the named assumption. None rewrites the
 // normal 2.5U/month value or chooses a sensitivity winner as a new default.
 const pairedStart=performance.now();
 for(const fuel of [.5,1,2.5])for(const scenario of ['E0','E1','E2','E4'])for(const seed of config.seeds){const result=simulateEnergyEconomy(p,roundedEnergy,inputs,{scenario,seed,months:240,fusionFuelSensitivityU:fuel});special.push({experiment:'fusion-fuel',fuel,industryMix:roundedEnergy.industryMix,...energyMetrics(result,p,roundedEnergy,config.criteria,{seed,scenario})});}
 for(const mix of ['steelHeavy','mixed','nonferrousHeavy'])for(const scenario of ['E0','E1','E2','E3'])for(const seed of config.seeds){const energy={...roundedEnergy,industryMix:mix},result=simulateEnergyEconomy(p,energy,inputs,{scenario,seed,months:240});special.push({experiment:'metal-mix',fuel:2.5,industryMix:mix,...energyMetrics(result,p,energy,config.criteria,{seed,scenario})});}
 const infrastructure=[];
 for(const scenario of ['E1','E3'])for(const seed of config.seeds){const on=simulateEnergyEconomy(p,roundedEnergy,inputs,{scenario,seed}),off=simulateEnergyEconomy(p,roundedEnergy,inputs,{scenario,seed,disableGovernmentPower:true}),a=energyMetrics(on,p,roundedEnergy,config.criteria,{seed,scenario}),b=energyMetrics(off,p,roundedEnergy,config.criteria,{seed,scenario});infrastructure.push({scenario,seed,avoidedUnservedGWh:b.planetSummary.earth.unservedGWh-a.planetSummary.earth.unservedGWh,avoidedIndustryUnderutilization:a.planetSummary.earth.meanIndustryUtilization-b.planetSummary.earth.meanIndustryUtilization,gdp20DifferenceC:a.realGDP20-b.realGDP20,treasury20DifferenceC:a.treasury20-b.treasury20,externalPowerSalesC:a.planetSummary.earth.externalPowerSalesC,minimumHealthDifference:a.minHealth-b.minHealth,extraGovPowerUpkeepU:a.planetSummary.earth.governmentPowerUpkeepU-b.planetSummary.earth.governmentPowerUpkeepU,extraGovPowerDirectC:a.planetSummary.earth.governmentPowerDirectC-b.planetSummary.earth.governmentPowerDirectC});}
 for(const scenario of ENERGY_SCENARIOS){const result=simulateEnergyEconomy(p,roundedEnergy,inputs,{scenario,seed:config.seeds[0]});selectedSeries[scenario]=result.rows;}
 timings.pairedSeconds=(performance.now()-pairedStart)/1000;
 const financial={industry:industryFinance(p,roundedEnergy),generationSingle:generationFinance(p,roundedEnergy),generationMaximum:generationFinance(p,roundedEnergy,{modules:'maximum'}),capexSensitivity:[.75,1,1.25].flatMap(scale=>generationFinance(p,roundedEnergy,{modules:'maximum',capexScale:scale}).map(x=>({...x,scale}))),foundationSensitivity:[1,2,3,4].flatMap(months=>generationFinance(p,roundedEnergy,{foundationMonths:months}).map(x=>({...x,foundationMonths:months}))),fuelSensitivity:[.5,1,2.5].flatMap(fuel=>generationFinance(p,roundedEnergy,{modules:'maximum',fusionFuelU:fuel}).filter(x=>x.type==='fusion').map(x=>({...x,fuel}))),colonySizing:[]};
 for(const id of ['moon','mars'])for(const kw of [2,4,8])for(const [type,d]of Object.entries(POWER_TYPES)){const demandGW=p.bodies[id].populationPersons*kw/1e6,averageGW=d.ratedGW*(type==='solar'?roundedEnergy.solarEarthCF*(id==='moon'?roundedEnergy.solarMoonMultiplier:roundedEnergy.solarMarsMultiplier):type==='fission'?roundedEnergy.fissionAvailability:1);financial.colonySizing.push({planet:id,kwPerPerson:kw,demandGW,type,ratedGW:d.ratedGW,averageGW,ratedToDemand:d.ratedGW/demandGW,averageToDemand:averageGW/demandGW,unusedAverageFraction:Math.max(0,1-demandGW/averageGW)});}
 write(path.join(out,'financial.json'),financial);write(path.join(out,'paired-experiments.json'),special);csv(path.join(out,'paired-experiments.csv'),special);write(path.join(out,'infrastructure-counterfactual.json'),infrastructure);
 write(path.join(out,'candidates.json'),{status:config.status,candidates,recommended,adoption:'미결정; 반올림은 별도 검증된 보고용 후보이며 게임 기본값 아님'});write(path.join(out,'final-runs.json'),final.results.flatMap(x=>x.records));
 write(path.join(out,'series.json'),selectedSeries);write(path.join(out,'reference-series.json'),reference.series);csv(path.join(out,'runs.csv'),runRecords);csv(path.join(out,'sensitivity.csv'),sensitivities);
 await pool.close();
 const probe=[];for(let i=0;i<25;i++){const t=performance.now();simulateEnergyEconomy(p,roundedEnergy,inputs,{scenario:'E0',seed:config.seeds[i%5]});probe.push(performance.now()-t);}probe.sort((a,b)=>a-b);
 const manifestFiles=['dist/src/economy-model.js','dist/src/economy-energy-ledger.js','dist/src/economy-energy-facilities.js','dist/src/economy-energy-model.js','scripts/econ-round3-analysis.mjs','scripts/econ-round3-inputs.mjs','scripts/econ-round3-calibrate.mjs','scripts/econ-round3.config.json','docs/econ-sim/round2/candidates.json',...Object.keys(inputs.files)];
 const hashes=Object.fromEntries(manifestFiles.map(f=>[f,sha256(fs.readFileSync(f))]));write(path.join(out,'input-manifest.json'),{baselineCommit:config.baselineCommit,gitHEAD:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:hashes,inputs});
 timings.totalSeconds=(performance.now()-start)/1000;
 const results={status:config.status,baselineCommit:config.baselineCommit,workers,environment:{node:process.version,platform:process.platform,cpu:os.cpus()[0]?.model,logicalCPUs:os.availableParallelism(),memoryGB:os.totalmem()/2**30},timings,performance:{sampleRuns:25,p50Ms:probe[12],p95Ms:probe[23],round2ReferenceP50Ms:2.77,round2ReferenceP95Ms:4.21},counts:{broadProfiles:broad.results.length,broadRuns:broad.results.reduce((s,x)=>s+x.records.length,0),oatProfiles:oat.results.length,oatRuns:oat.results.reduce((s,x)=>s+x.records.length,0),narrowProfiles:narrow.results.length,narrowRuns:narrow.results.reduce((s,x)=>s+x.records.length,0),extendedRuns:extended.results.reduce((s,x)=>s+x.records.length,0),finalCandidates:4,finalRuns:final.results.reduce((s,x)=>s+x.records.length,0),referenceOffRuns:reference.records.filter(x=>x.mode==='OFF').length,referenceOnRuns:reference.records.filter(x=>x.mode==='ON').length,pairedRuns:special.length,counterfactualRuns:20,directLegacyRegressionRuns:140,seriesRuns:16,performanceRuns:25,totalRecordedRuns:runRecords.length+reference.records.length+special.length+20+16+25+140},broad:{passed:broad.results.filter(x=>x.summary.passed).length,macroPassed:broad.results.filter(x=>x.summary.macroPassed).length},narrow:{passed:narrow.results.filter(x=>x.summary.passed).length,macroPassed:narrow.results.filter(x=>x.summary.macroPassed).length,variedParameters:[...varied]},final:candidates.map(c=>({id:c.id,integrity:c.integrity,macroPassed:c.macroPassed,reliabilityPassed:c.proposedReliabilityPassed,passed:c.passed,failures:c.failures})),rounded:{id:recommended.id,integrity:recommended.integrity,macroPassed:recommended.macroPassed,reliabilityPassed:recommended.proposedReliabilityPassed,passed:recommended.passed,failures:recommended.failures},scope:{broad:config.broadScenarios,narrow:config.narrowScenarios,final:ENERGY_SCENARIOS,peaceThresholdsOrigin:'원문8.2; 추가0.5%미공급/99%유지보수는 제안 지표로 별도 구분; 실비포함 회수기간을1.5–3년에 강제하지 않음'},determinism:{seriesSHA256:sha256(fs.readFileSync(path.join(out,'series.json'))),runsSHA256:sha256(fs.readFileSync(path.join(out,'runs.csv')))}};
 write(path.join(out,'results.json'),results);console.log(JSON.stringify(results,null,2));return results;
}
if(!isMainThread){parentPort.on('message',job=>{try{parentPort.postMessage({result:evaluate(job,workerData)});}catch(e){parentPort.postMessage({error:e.stack});}});}
else if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const config=read('scripts/econ-round3.config.json'),index=process.argv.indexOf('--out'),out=index>=0?process.argv[index+1]:undefined,wi=process.argv.indexOf('--workers'),workers=wi>=0?Number(process.argv[wi+1]):Math.min(4,os.availableParallelism());
 try{await executeRound3(config,{out,workers});}catch(e){console.error(e);process.exit(1);}
}
