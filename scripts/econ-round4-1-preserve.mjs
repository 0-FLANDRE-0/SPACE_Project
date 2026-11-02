import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const manifest=JSON.parse(fs.readFileSync('docs/econ-sim/round4-1/preservation-manifest.json')),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const [file,hash]of Object.entries(manifest.files)){assert.equal(sha(fs.readFileSync(file)),hash,file);assert.equal(sha(execFileSync('git',['show',manifest.base+':'+file],{maxBuffer:128*1024*1024})),hash,file+' baseline');}
const prefix=execFileSync('git',['show',manifest.base+':docs/DECISIONS.md']);assert.equal(sha(prefix),manifest.decisionsPrefixHash);assert.ok(fs.readFileSync('docs/DECISIONS.md').subarray(0,prefix.length).equals(prefix),'DECISIONS append-only');
const paths=execFileSync('git',['ls-tree','-r','--name-only',manifest.base],{encoding:'utf8'}).trim().split('\n');assert.deepEqual(paths.filter(x=>x!=='docs/DECISIONS.md').sort(),Object.keys(manifest.files).sort());
for(const file of execFileSync('git',['diff','--name-only',manifest.base],{encoding:'utf8'}).trim().split('\n').filter(Boolean))if(paths.includes(file))assert.equal(file,'docs/DECISIONS.md');
const modified=execFileSync('git',['diff','--name-only',manifest.base],{encoding:'utf8'}).trim().split('\n'),untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n');
for(const file of new Set([...modified,...untracked].filter(x=>x&&!paths.includes(x))))assert.ok(/^(dist\/src\/economy-round4-1-[^/]+\.js|scripts\/econ-round4-1[^/]+|tests\/(economy-round4-1\.test\.js|browser-economy-round4-1-report\.mjs)|docs\/econ-sim\/round4-1\/)/.test(file),'New file outside scope: '+file);
for(const [file,hash]of Object.entries(manifest.archive.files))assert.equal(sha(execFileSync('git',['show',manifest.archive.commit+':'+file],{maxBuffer:128*1024*1024})),hash);
console.log(`PASS ${Object.keys(manifest.files).length} PR15 files SHA256-identical (game, official presets, saves, ECON1–4 sources/tests/results); DECISIONS prefix preserved`);
console.log('PASS archive read at '+manifest.archive.commit+' without merge; only new Round4.1 paths and append-only decision update permitted');
