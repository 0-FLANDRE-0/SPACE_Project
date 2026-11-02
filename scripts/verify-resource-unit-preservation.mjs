// Read-only preservation audit. No ECON calibration or artifact regeneration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createSolContext} from '../dist/src/system-context.js';
import {createPlanetarySurfaceGrid} from '../dist/src/planetary-surface-grid.js';
const manifest=JSON.parse(fs.readFileSync('docs/resource-unit-packaging/preservation-manifest.json')),base=manifest.baselineCommit;
const digest=raw=>crypto.createHash('sha256').update(raw).digest('hex');
for(const [file,hash]of Object.entries(manifest.files)){
 assert.equal(digest(fs.readFileSync(file)),hash,file);
 assert.equal(digest(execFileSync('git',['show',`${base}:${file}`],{maxBuffer:128*1024*1024})),hash,file+' baseline');
}
console.log(`PASS: ${Object.keys(manifest.files).length} official data / ECON1–3 source, configuration, artifacts and untouched tests match ${base}`);
const provenance=JSON.parse(fs.readFileSync('tests/fixtures/resource-packaging-provenance.json'));
for(const [file,hash]of Object.entries(provenance.fixtures))assert.equal(digest(fs.readFileSync(file)),hash,file);
function originalModule(file,overrides={},revision=base){
 const source=execFileSync('git',['show',`${revision}:${file}`],{encoding:'utf8'}).replace(/from\s*(['"])(\.\.?\/[^'"]+)\1/g,(_,q,spec)=>`from ${q}${overrides[spec]??new URL(spec,pathToFileURL(path.resolve(file))).href}${q}`);
 return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
}
const runtimeURL=originalModule('dist/src/industry-runtime.js'),old=await import(runtimeURL),fixture=await import(originalModule('dist/src/industry-fixture.js',{'./industry-runtime.js':runtimeURL}));
const sol=createSolContext();function catalog(full=false){const c=new old.IndustryCatalog('sol');for(const body of sol.allBodies.filter(b=>full?['planet','moon'].includes(b.kind):['earth','moon','mars','venus','jupiter'].includes(b.id))){c.register({body,grid:createPlanetarySurfaceGrid('sol',body),template:JSON.parse(fs.readFileSync(`dist/data/planet-surfaces/sol-${body.id}-v2.json`))});}return c;}
const read=name=>JSON.parse(fs.readFileSync(`tests/fixtures/industry-v1-${name}.json`));
function initial(c){const store={state:old.createIndustryState(c,0,{fixture:true}),catalog:c,transient:true,persist(){return true;}};fixture.initializeIndustryFixture(store);return store.state;}
const c=catalog(),s=initial(c);assert.deepEqual(s,read('initial'));assert.deepEqual(old.createIndustryState(c),read('normal'));
old.orderConstruction(s,c,{bodyId:'earth',tileId:'sol:earth:surface:00077',slot:0,type:'government_mining_complex'});
old.orderConstruction(s,c,{bodyId:'earth',tileId:'sol:earth:surface:00000',slot:0,type:'government_smelting_complex'});
old.advanceIndustry(s,c,180.125);assert.deepEqual(s,read('construction'));
old.advanceIndustry(s,c,700.125);assert.deepEqual(s,read('production'));
old.advanceIndustry(s,c,750.125);assert.deepEqual(s,read('after750'));
assert.deepEqual(initial(catalog(true)),read('sol-full'));
console.log('PASS: all6 v1 fixtures exactly reproduce using the original baseline runtime and original fixture initializer, including full19 Sol and750.125-day industrial trajectory; no fixtures rewritten');

// RESOURCE-CARGO-2 additionally protects the complete PR #11 tree except the
// exact authorized refactor/test paths. Past reports and hashes remain records.
const scuManifest=JSON.parse(fs.readFileSync('docs/resource-cargo-scu/preservation-manifest.json'));
const followup=JSON.parse(fs.readFileSync('docs/resource-cargo-scu/followup-1/preservation-manifest.json'));
const baselineFiles=execFileSync('git',['ls-tree','-r','--name-only',scuManifest.baselineCommit],{encoding:'utf8'}).trim().split('\n');
assert.deepEqual(baselineFiles.filter(f=>!scuManifest.allowedChanges.includes(f)).sort(),Object.keys(scuManifest.files).sort());
for(const [file,hash]of Object.entries(scuManifest.files))if(!followup.allowedChanges.includes(file))assert.equal(digest(fs.readFileSync(file)),hash,file);
const changed=execFileSync('git',['diff','--name-only',scuManifest.baselineCommit],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const file of changed)if(baselineFiles.includes(file))assert.ok(scuManifest.allowedChanges.includes(file)||followup.allowedChanges.includes(file),'Unapproved baseline change: '+file);
for(const [file,hash]of Object.entries(scuManifest.v2Fixtures))assert.equal(digest(fs.readFileSync(file)),hash,file);
const prior=scuManifest.baselineCommit,urls={};
for(const file of ['resource-definitions.js','packaging-specs.js','packaging-inventory.js','packaging-automation.js','industry-packaging.js','industry-runtime.js','industry-storage.js'])urls['./'+file]=originalModule('dist/src/'+file,urls,prior);
const oldV2=await import(urls['./industry-storage.js']),runtimeV2=await import(urls['./industry-runtime.js']);
function priorCatalog(full){const c=new runtimeV2.IndustryCatalog('sol');for(const body of sol.allBodies.filter(b=>full?['planet','moon'].includes(b.kind):['earth','moon','mars','venus','jupiter'].includes(b.id)))c.register({body,grid:createPlanetarySurfaceGrid('sol',body),template:JSON.parse(fs.readFileSync(`dist/data/planet-surfaces/sol-${body.id}-v2.json`))});return c;}
for(const name of ['initial','construction','production','normal','sol-full'])assert.deepEqual(oldV2.migrateIndustryV1ToV2(read(name),priorCatalog(name==='sol-full')),JSON.parse(fs.readFileSync(`tests/fixtures/industry-v2-${name}.json`)));
console.log(`PASS: ${Object.keys(scuManifest.files).length} PR #11 manifest paths / ${scuManifest.allowedChanges.length} historical exceptions retained; FOLLOW-UP-1 exceptions independently enforced below; five actual v2 fixtures reproduce using the original PR #11 modules; no economic recalibration`);
// FOLLOW-UP-1 adds its own exact PR12 allow list; historical manifests are never
// rewritten. Every remaining PR12 path, including both old manifests, is hashed.
const f3=execFileSync('git',['ls-tree','-r','--name-only',followup.baselineCommit],{encoding:'utf8'}).trim().split('\n');
assert.deepEqual(f3.filter(f=>!followup.allowedChanges.includes(f)).sort(),Object.keys(followup.files).sort());
for(const [file,hash]of Object.entries(followup.files)){assert.equal(digest(fs.readFileSync(file)),hash,file);assert.equal(digest(execFileSync('git',['show',followup.baselineCommit+':'+file],{maxBuffer:128*1024*1024})),hash,file+' PR12');}
for(const file of execFileSync('git',['diff','--name-only',followup.baselineCommit],{encoding:'utf8'}).trim().split('\n').filter(Boolean))if(f3.includes(file))assert.ok(followup.allowedChanges.includes(file),'Unapproved PR12 change: '+file);
for(const [file,hash]of Object.entries(followup.v3Fixtures))assert.equal(digest(fs.readFileSync(file)),hash,file);
const u3={};for(const file of ['resource-definitions.js','packaging-common.js','container-specs.js','cargo-scu.js','container-state.js','packaging-specs.js','packaging-inventory.js','packaging-automation.js','industry-packaging.js','industry-runtime.js','industry-storage.js'])u3['./'+file]=originalModule('dist/src/'+file,u3,followup.baselineCommit);
const originalV3=await import(u3['./industry-storage.js']);
for(const name of ['initial','construction','production','normal','sol-full'])assert.deepEqual(originalV3.migrateIndustryV2ToV3(JSON.parse(fs.readFileSync(`tests/fixtures/industry-v2-${name}.json`)),priorCatalog(name==='sol-full')),JSON.parse(fs.readFileSync(`tests/fixtures/industry-v3-${name}.json`)));
console.log(`PASS: ${Object.keys(followup.files).length} PR12 files match SHA256; ${followup.allowedChanges.length} exact existing paths authorized; five genuine v3 fixtures reproduce with original PR12 code; previous manifests/reports unchanged`);
