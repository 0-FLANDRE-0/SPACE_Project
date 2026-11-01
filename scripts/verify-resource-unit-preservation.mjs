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
function originalModule(file,overrides={}){
 const source=execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'}).replace(/from\s*(['"])(\.\.?\/[^'"]+)\1/g,(_,q,spec)=>`from ${q}${overrides[spec]??new URL(spec,pathToFileURL(path.resolve(file))).href}${q}`);
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
