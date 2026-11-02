import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {readRound3Inputs,sha256} from './econ-round3-inputs.mjs';
import {simulateRound41Economy} from '../dist/src/economy-round4-1-model.js';
import {compact41} from './econ-round4-1-analysis.mjs';
const dir='docs/econ-sim/round4-1',read=name=>JSON.parse(fs.readFileSync(dir+'/'+name+'.json')),result=read('results'),manifest=read('input-manifest'),candidates=read('candidates'),records=read('final-runs'),off=read('off-replay'),inputs=readRound3Inputs(),begin=performance.now(),checks=[],evidence=[];let runs=0;
const baseById=new Map(manifest.baseCandidates.map(x=>[x.id,x])),policy=result.config.policy;
// ALL-OFF delegation was tested by the main run. Independently exercise the
// ON adapter at R4 settings across EVERY archived path, detecting accidental
// changes in the separately preserved settlement bodies as well.
for(const row of off){
 const base=baseById.get(row.baseId),x=simulateRound41Economy(manifest.macro,manifest.baselineEnergy,inputs,{round4:base.parameters,round41:{...policy,triageEnabled:false,hydrogenPrice:1.2},scenario:row.scenario,seed:row.seed});runs++;
 const hash=sha256(JSON.stringify(x.rows.map(({round41,...rest})=>rest)));assert.equal(hash,row.fullHash,'ON adapter must match archived R4 at unchanged controls');assert.equal(row.fullHash,row.offHash);assert.equal(row.compactHash,row.archivedCompactHash);checks.push({kind:'unchanged-adapter',baseId:base.id,scenario:row.scenario,seed:row.seed,hash,equal:true});
 if(runs%88===0)console.log('Exact unchanged adapter paths '+runs+'/'+off.length);
}
for(const candidate of [...candidates.finalists,candidates.rounded])for(const lane of ['self','relief'])for(const scenario of ['E0','E2-S','E5-M','E5-M-L70-S12-D2','E5-X','E6-R','E11-M']){
 const seed=result.config.seeds[0],base=baseById.get(candidate.baseId),p41={...candidate.policy,marketRelief:lane==='relief',importRelief:lane==='relief'},x=simulateRound41Economy(manifest.macro,manifest.baselineEnergy,inputs,{round4:base.parameters,round41:p41,scenario,seed});runs++;
 const expected=records.find(r=>r.id===candidate.id&&r.lane===lane&&r.scenario===scenario&&r.seed===seed);assert.ok(expected);const hash=sha256(JSON.stringify(compact41(x.rows)));assert.equal(hash,expected.pathHash);checks.push({kind:'final-path',id:candidate.id,lane,scenario,seed,hash,equal:true});
}
const matrices=[...read('relief-matrix'),...read('extreme-matrix')].filter(x=>x.summary.baseId==='R4-rounded');
for(const arm of matrices){const base=baseById.get(arm.summary.baseId),scenario=arm.records[0].scenario,seed=result.config.seeds[0],x=simulateRound41Economy(manifest.macro,manifest.baselineEnergy,inputs,{round4:base.parameters,round41:arm.summary.policy,scenario,seed});runs++;const expected=arm.records.find(x=>x.seed===seed),hash=sha256(JSON.stringify(compact41(x.rows)));assert.equal(hash,expected.pathHash);evidence.push({arm:arm.summary.id,scenario,seed,hash,market:x.state.relief41.market,imports:x.state.relief41.imports,mode:x.state.relief41.mode,grace:x.state.relief41.grace,sourceStocks20:Object.fromEntries(['moon','mars'].map(id=>[id,{governmentAlloyQ:x.state.book.get(`${id}/government/alloy`),privateAlloyQ:x.state.book.get(`${id}/private/alloy`)}]))});}
assert.equal(records.length,5*42*5*2);assert.equal(off.length,4*22*5);assert.equal(result.counts.finalDatasetRuns??result.counts.totalOnRuns,fs.readFileSync(dir+'/runs.csv','utf8').trim().split('\n').length-1);assert.equal(result.counts.totalOnRuns,(result.counts.finalDatasetRuns??result.counts.totalOnRuns)+(result.counts.e11CorrectionRuns??0));assert.equal(result.counts.integrityFailures,0);assert.ok(records.every(x=>x.integrity));
const axes=candidates.fixed37Axes;assert.equal(axes.length,37);for(const base of manifest.baseCandidates){assert.equal(sha256(JSON.stringify(base.parameters)),base.sha256);for(const c of [...candidates.finalists,candidates.rounded].filter(x=>x.baseId===base.id))for(const k of axes)assert.equal(base.parameters[k],candidates.baseParameters.find(x=>x.id===base.id).parameters[k]);}
const series=read('series');assert.equal(series.columns.length,22);for(const profile of Object.values(series.profiles))for(const rows of Object.values(profile)){assert.equal(rows.length,241);for(const row of rows)assert.ok(row.every(v=>v===null||typeof v==='boolean'||Number.isFinite(v)));}
console.log(execFileSync(process.execPath,['scripts/econ-round4-1-preserve.mjs'],{encoding:'utf8'}).trim());
fs.writeFileSync(dir+'/relief-ledger-evidence.json',JSON.stringify(evidence,null,2)+'\n');
const verification={runs,seconds:(performance.now()-begin)/1000,unchangedAdapterPaths:off.length,finalPaths:checks.filter(x=>x.kind==='final-path').length,reliefEvidencePaths:evidence.length,allEqual:true,checks};fs.writeFileSync(dir+'/logs/independent-verification.json',JSON.stringify(verification,null,2)+'\n');console.log(JSON.stringify({...verification,checks:undefined}));
