// Revalidate only the E11-M information scenario after its missing baseline
// government-industry event was found. Other scenario formulas are unchanged.
// A fresh full run with corrected source already contains these events: no-op.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {readRound3Inputs,sha256} from './econ-round3-inputs.mjs';
import {simulateRound41Economy} from '../dist/src/economy-round4-1-model.js';
import {metrics41,compact41,aggregate41} from './econ-round4-1-analysis.mjs';
const dir='docs/econ-sim/round4-1',read=n=>JSON.parse(fs.readFileSync(dir+'/'+n+'.json')),write=(n,x)=>fs.writeFileSync(dir+'/'+n+'.json',(n==='series'?JSON.stringify(x):JSON.stringify(x,null,2))+'\n'),result=read('results'),cs=read('candidates'),records=read('final-runs'),series=read('series'),manifest=read('input-manifest'),profiles=[...cs.finalists,cs.rounded],inputs=readRound3Inputs(),selected=records.filter(x=>x.scenario==='E11-M');
assert.equal(selected.length,50);
if(selected.every(x=>x.governmentSalvageU>0)){console.log('PASS E11-M already has the government baseline/demolition; no extra executions');process.exit(0);}
assert.equal(result.counts.e11CorrectionRuns??0,0);const start=performance.now(),replacements=new Map(),changes=[];
const key=x=>[x.id,x.lane,x.scenario,x.seed].join('/');
for(const old of selected){
 const candidate=profiles.find(x=>x.id===old.id),base=manifest.baseCandidates.find(x=>x.id===candidate.baseId),policy={...candidate.policy,marketRelief:old.lane==='relief',importRelief:old.lane==='relief'},x=simulateRound41Economy(manifest.macro,manifest.baselineEnergy,inputs,{round4:base.parameters,round41:policy,scenario:'E11-M',seed:old.seed});
 const next={stage:old.stage,id:old.id,baseId:old.baseId,lane:old.lane,...metrics41(x,manifest.macro,manifest.baselineEnergy,x.state.r,policy,result.config.criteria,{scenario:'E11-M',seed:old.seed}),pathHash:sha256(JSON.stringify(compact41(x.rows)))};
 assert.ok(next.integrity&&next.governmentSalvageU>0);assert.ok(x.state.events.some(e=>e.event==='dismantling-ordered'&&e.owner==='government'&&e.month===66));
 replacements.set(key(old),next);changes.push({id:old.id,lane:old.lane,seed:old.seed,oldHash:old.pathHash,newHash:next.pathHash,oldGovernmentSalvageU:old.governmentSalvageU,newGovernmentSalvageU:next.governmentSalvageU});
 if(old.seed===result.config.seeds[0])series.profiles[old.id][old.lane+'/E11-M']=compact41(x.rows).map(row=>series.columns.map(k=>row[k]));
}
const updated=records.map(x=>replacements.get(key(x))??x);write('e11-m-before-fix',selected);write('e11-m-revalidation-runs',[...replacements.values()]);write('final-runs',updated);write('series',series);
const summaries=profiles.map(c=>aggregate41(c.id,c.baseId,c.policy,updated.filter(x=>x.id===c.id)));cs.finalists=summaries.slice(0,4);cs.rounded=summaries[4];write('candidates',cs);result.finalists=summaries;result.selfPassingFinalists=summaries.filter(x=>x.self.passed).length;result.reliefPassingFinalists=summaries.filter(x=>x.relief.passed).length;
// Keep the final canonical CSV at7900 distinct paths. Extra revalidation runs
// are separately counted and retained, so they are not silently double-counted
// as new unique scenarios or mixed with the discarded pre-donor-fix run.
function parseLine(line){const a=[];let s='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){s+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){a.push(s);s='';}else s+=c;}a.push(s);return a;}
const csv=fs.readFileSync(dir+'/runs.csv','utf8').trimEnd().split('\n'),headers=parseLine(csv[0]),at=Object.fromEntries(headers.map((k,i)=>[k,i])),cell=x=>'"'+String(x===undefined||x===null?'':typeof x==='object'?JSON.stringify(x):x).replaceAll('"','""')+'"';let patched=0;
for(let i=1;i<csv.length;i++){const values=parseLine(csv[i]);if(values[at.scenario]!=='E11-M')continue;const k=[values[at.id],values[at.lane],values[at.scenario],values[at.seed]].join('/'),next=replacements.get(k);assert.ok(next);csv[i]=headers.map(k=>cell(next[k])).join(',');patched++;}
assert.equal(patched,50);fs.writeFileSync(dir+'/runs.csv',csv.join('\n')+'\n');
const seconds=(performance.now()-start)/1000;result.counts.finalDatasetRuns=result.counts.totalOnRuns;result.counts.e11CorrectionRuns=50;result.counts.totalOnRuns+=50;result.timings.e11Correction=seconds;result.totalSeconds+=seconds;result.correction={scenario:'E11-M',reason:'medium comparison must use E5 baseline construction before applying its separate government-demolition event',runs:50,unaffected:'all37 axes, all7 policy samples and all other41 scenario formulas unchanged'};write('results',result);write('e11-m-correction',{runs:50,seconds,changes,scope:result.correction});console.log(JSON.stringify({runs:50,seconds,patchedCanonicalRows:patched,totalOnExecutions:result.counts.totalOnRuns,finalDatasetRuns:result.counts.finalDatasetRuns,governmentDemolitionPresentAll:true}));
