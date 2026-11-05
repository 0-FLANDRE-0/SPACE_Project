import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const m=JSON.parse(fs.readFileSync('docs/ui1/preservation-manifest.json')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [p,hash]of Object.entries(m.files))assert.equal(sha(fs.readFileSync(p)),hash,p);
const allowed=new Set(['dist/index.html','dist/style.css',...['context-panel','draggable-sector-panel','main','orbit-view','planetary-surface-ui','scene','ship-layer','ship-ui','surface-distribution-ui','survey-ui'].map(n=>`dist/src/${n}.js`),'tests/helpers/resource-foundation-preservation.js',...['development-reset','industry','orbit-layers','planet-surface','scu-followup','surface-distributions','survey'].map(n=>`tests/browser-${n}.mjs`)]);
const paths=args=>execFileSync('git',args).toString().split('\0').filter(Boolean),old=new Set(paths(['ls-tree','-r','--name-only','-z',m.base]));
for(const p of new Set([...paths(['diff','--name-only','-z',m.base]),...paths(['ls-files','--others','--exclude-standard','-z'])])){if(old.has(p))assert.ok(allowed.has(p),'Unauthorized old-file change: '+p);else assert.match(p,/^(dist\/src\/ui1-(data|model|ui)\.js|tests\/(ui1\.test\.js|browser-ui1(-layout)?\.mjs|helpers\/continuous-surface\.mjs)|scripts\/ui1-preserve\.mjs|docs\/ui1\/)/);}
console.log(`PASS ${Object.keys(m.files).length} SHA256 protected files; all official presets, ECON1–4.1 and M1a/M1b/M2 artifacts unchanged.`);
console.log('PASS exact UI1 old/new file allowlist; industry v4, migrations, resource definitions, fleet/survey/orbit simulation and numerical rules unchanged.');
