// Read-only complete-tree audit. No original data/model/test/report rewriting.
import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import crypto from 'node:crypto';
const base='edc0d4257dad9cd46622fc8b00f039b68479b601',manifest=JSON.parse(fs.readFileSync('docs/econ-sim/round4/preservation-manifest.json')),digest=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(manifest.baselineCommit,base);for(const [file,hash]of Object.entries(manifest.files)){assert.equal(digest(fs.readFileSync(file)),hash,file);assert.equal(digest(execFileSync('git',['show',base+':'+file],{maxBuffer:128*1024*1024})),hash,file+' baseline');}
const before=execFileSync('git',['show',base+':docs/DECISIONS.md']);assert.ok(fs.readFileSync('docs/DECISIONS.md').subarray(0,before.length).equals(before),'DECISIONS must only append');
const existing=execFileSync('git',['ls-tree','-r','--name-only',base],{encoding:'utf8'}).trim().split('\n');assert.deepEqual(existing.filter(f=>f!=='docs/DECISIONS.md').sort(),Object.keys(manifest.files).sort());
for(const file of execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split('\n').filter(Boolean))if(existing.includes(file))assert.equal(file,'docs/DECISIONS.md','Changed protected file: '+file);
console.log(`PASS: ${Object.keys(manifest.files).length} original PR13 paths SHA256-identical, including all game/official data, prior models/scripts/tests/artifacts; DECISIONS prefix preserved`);
for(const [file,hash]of Object.entries(manifest.archive.files)){const raw=execFileSync('git',['show',manifest.archive.commit+':'+file],{maxBuffer:128*1024*1024});assert.equal(digest(raw),hash,file);}
console.log('PASS: PR14 archive read directly at '+manifest.archive.commit+'; no merge or archive copy into code branch');
