// Independent result classification + replay/hash preservation audit.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {simulateEnergyEconomy} from '../dist/src/economy-energy-model.js';import {readRound3Inputs,sha256} from './econ-round3-inputs.mjs';
const root='docs/econ-sim/round3/',read=n=>JSON.parse(fs.readFileSync(root+n)),result=read('results.json'),config=JSON.parse(fs.readFileSync('scripts/econ-round3.config.json')),c=config.criteria,candidates=read('candidates.json'),p=JSON.parse(fs.readFileSync('docs/econ-sim/round2/candidates.json')).recommended.parameters;
const lines=fs.readFileSync(root+'runs.csv','utf8').trim().split('\n'),headers=lines.shift().split(','),runs=lines.map(line=>Object.fromEntries(line.split(',').map((v,i)=>[headers[i],v])));
const phases={};for(const r of runs){phases[r.phase]=(phases[r.phase]??0)+1;assert.equal(r.integrity,'true');let expected=true;
 if(r.peace==='true')expected=+r.peacePriceDeviation<=c.peacePriceDeviation+1e-8&&Math.abs(+r.meanRealAlloyPrice/2.3-1)<=c.meanPriceDeviation+1e-8&&+r.inflationMin>=c.inflationMin-1e-8&&+r.inflationMax<=c.inflationMax+1e-8&&+r.budgetRatio17>=c.budget17Min-1e-8&&+r.budgetRatio17<=c.budget17Max+1e-8;
 if(r.scenario.startsWith('S3-'))expected=+r.warPeak>=c.warPeakMin&&+r.warPeak<=c.warPeakMax&&r.recoveryYears!==''&&+r.recoveryYears<=c.warRecoveryYearsMax;
 assert.equal(r.macroPassed,String(expected),'independent macro flag '+r.id+'/'+r.scenario+'/'+r.seed);
 assert.equal(r.passed,String(expected&&(r.peace!=='true'||r.proposedReliabilityPassed==='true')));
}
assert.deepEqual(phases,{broad:7680,oat:870,narrow:5760,extended:360,final:320});
const final=read('final-runs.json');for(const candidate of [...candidates.candidates,candidates.recommended]){const records=final.filter(r=>r.id===candidate.id);assert.equal(records.length,80);for(const scenario of result.scope.final){assert.equal(new Set(records.filter(r=>r.scenario===scenario).map(r=>r.seed)).size,5);}assert.ok(records.every(r=>r.integrity));assert.equal(candidate.macroPassed,records.every(r=>r.macroPassed));}
const manifest=read('input-manifest.json');for(const [file,hash]of Object.entries(manifest.files))assert.equal(sha256(fs.readFileSync(file)),hash,'input drift '+file);
// Every pre-existing tracked file, including game sources, both prior reports,
// official presets, old tests and policies, is byte-identical except the append
// to DECISIONS. New experiment files are absent from the base tree by design.
const tracked=execFileSync('git',['ls-tree','-r','--name-only',result.baselineCommit],{encoding:'utf8'}).trim().split('\n');let preserved=0;
for(const file of tracked){if(file==='docs/DECISIONS.md')continue;const original=execFileSync('git',['show',result.baselineCommit+':'+file],{maxBuffer:100*1024*1024});assert.deepEqual(fs.readFileSync(file),original,'pre-existing file changed '+file);preserved++;}
const series=read('series.json'),inputs=readRound3Inputs(),replayHashes={};
for(const scenario of result.scope.final){const replay=simulateEnergyEconomy(p,candidates.recommended.energy,inputs,{scenario,seed:config.seeds[0],months:240});assert.equal(sha256(JSON.stringify(replay.rows)),sha256(JSON.stringify(series[scenario])),'representative replay '+scenario);replayHashes[scenario]=sha256(JSON.stringify(replay.rows));
 for(const r of series[scenario]){const cash=Object.values(r.planets).reduce((s,b)=>s+b.governmentC+b.privateC+b.householdC,0);assert.ok(Math.abs(cash-r.moneyC)<.00001);assert.ok(Math.abs(r.moneyC*p.velocity-r.priceIndex*r.realGDP)<.01);for(const b of Object.values(r.planets)){assert.ok(b.governmentAlloyU>=0&&b.privateAlloyU>=0&&b.governmentHydrogenU>=0&&b.privateHydrogenU>=0);assert.equal(b.flow.governmentSelfSalesC,0);assert.ok(Math.abs(b.flow.processedU-b.flow.producedU-b.flow.residueU)<.01);}}
}
let reproduction=null;const other='artifacts/econ3-reproduction/';
if(fs.existsSync(other+'results.json')){
 const identical=[];for(const file of ['runs.csv','series.json','reference-series.json','candidates.json','broad-candidates.json','narrow-candidates.json','final-runs.json','financial.json','paired-experiments.csv','paired-experiments.json','sensitivity.csv','sensitivity.json','infrastructure-counterfactual.json','input-manifest.json']){assert.equal(sha256(fs.readFileSync(root+file)),sha256(fs.readFileSync(other+file)),'full reproduction '+file);identical.push(file);}
 const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>k!=='pairMs').map(([k,v])=>[k,normalize(v)])):x;
 assert.deepEqual(normalize(read('legacy-off-on.json')),normalize(JSON.parse(fs.readFileSync(other+'legacy-off-on.json'))));
 const a=read('results.json'),b=JSON.parse(fs.readFileSync(other+'results.json'));for(const k of ['timings','performance']){delete a[k];delete b[k];}assert.deepEqual(a,b);
 reproduction={identicalFiles:identical,legacyComparison:'identical excluding pairMs',results:'identical excluding performance/timings'};
}
const audit={csvRows:runs.length,phases,independentlyCheckedMacroFlags:runs.length,finalIntegrityRuns:320,finalAllCandidateScenarios:16,finalSeeds:5,preservedTrackedFiles:preserved,baseCommit:result.baselineCommit,replayedRepresentativeScenarios:16,replayHashes,reproduction};
fs.writeFileSync(root+'logs/independent-verification.json',JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));
