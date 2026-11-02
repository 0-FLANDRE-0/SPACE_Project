import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const manifest=JSON.parse(fs.readFileSync('docs/m1a/preservation-manifest.json')),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const [file,hash]of Object.entries(manifest.files))assert.equal(sha(fs.readFileSync(file)),hash,file);
const prefix=execFileSync('git',['show',manifest.base+':docs/DECISIONS.md']);assert.equal(sha(prefix),manifest.decisionsPrefixSha256);assert.ok(fs.readFileSync('docs/DECISIONS.md').subarray(0,prefix.length).equals(prefix),'DECISIONS append-only');
const tracked=execFileSync('git',['ls-tree','-r','--name-only',manifest.base],{encoding:'utf8'}).trim().split('\n'),changes=execFileSync('git',['diff','--name-only',manifest.base],{encoding:'utf8'}).trim().split('\n'),untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n');
for(const file of new Set([...changes,...untracked].filter(Boolean))){if(tracked.includes(file))assert.ok(manifest.allowedChanges.includes(file)||file==='docs/DECISIONS.md','Unexpected existing-file mutation: '+file);else assert.match(file,/^(dist\/src\/ship-[^/]+\.js|tests\/(ship-movement\.test\.js|browser-ship-movement\.mjs)|scripts\/m1a-preserve\.mjs|docs\/m1a\/)/,'Unexpected new file: '+file);}
console.log(`PASS ${Object.keys(manifest.files).length} baseline files SHA256-identical: all official presets, geology/population, industry/SCU, manual save migrations, ECON1–4.1 sources/results/tests.`);
console.log('PASS exact M1a integration allowlist; DECISIONS prefix preserved; no prior PR or archive files modified.');
