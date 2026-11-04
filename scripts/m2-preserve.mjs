import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const m=JSON.parse(fs.readFileSync('docs/m2/preservation-manifest.json')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [path,hash]of Object.entries(m.files))assert.equal(sha(fs.readFileSync(path)),hash,path);
const allowed=new Set(['dist/src/scene.js','dist/src/industry-runtime.js','dist/src/industry-ui.js','dist/src/main.js','dist/src/planetary-surface-ui.js','dist/src/resource-knowledge.js','dist/src/ship-data.js','dist/src/ship-fleet.js','dist/src/ship-ui.js','dist/src/surface-distribution-ui.js','dist/style.css','tests/helpers/resource-foundation-preservation.js']);
const paths=args=>execFileSync('git',args).toString().split('\0').filter(Boolean),old=new Set(paths(['ls-tree','-r','--name-only','-z',m.base]));
for(const p of new Set([...paths(['diff','--name-only','-z',m.base]),...paths(['ls-files','--others','--exclude-standard','-z'])])){if(old.has(p))assert.ok(allowed.has(p),'Unauthorized old-file change: '+p);else assert.match(p,/^(dist\/src\/survey-[^/]+\.js|tests\/(survey\.test\.js|browser-survey\.mjs)|scripts\/m2-[^/]+\.mjs|docs\/m2\/)/);}
for(const p of ['dist/src/industry-storage.js','dist/src/industry-storage-v1.js','dist/src/industry-storage-v2.js','dist/src/industry-storage-v3.js','dist/src/industry-policy.js','docs/DECISIONS.md'])assert.equal(sha(fs.readFileSync(p)),sha(execFileSync('git',['show',m.base+':'+p])));
console.log(`PASS ${Object.keys(m.files).length} official/preset/grid/ECON/M1a/M1b SHA256 checks; v4 schema, migration, mining policy and previous DECISIONS byte-identical.`);console.log('PASS exact M2 integration allowlist; numerical ECON assertions and historical outputs unchanged.');
