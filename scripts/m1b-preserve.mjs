import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const manifest=JSON.parse(fs.readFileSync('docs/m1b/preservation-manifest.json')),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),paths=args=>execFileSync('git',args).toString().split('\0').filter(Boolean);
for(const [file,hash]of Object.entries(manifest.files))assert.equal(sha(fs.readFileSync(file)),hash,file);
const prefix=execFileSync('git',['show',manifest.base+':docs/DECISIONS.md']);assert.equal(sha(prefix),manifest.decisionsPrefixSha256);assert.ok(fs.readFileSync('docs/DECISIONS.md').equals(prefix));
const old=new Set(paths(['ls-tree','-r','--name-only','-z',manifest.base]));
for(const file of new Set([...paths(['diff','--name-only','-z',manifest.base]),...paths(['ls-files','--others','--exclude-standard','-z'])])){
 if(old.has(file))assert.ok(manifest.allowedChanges.includes(file),'Unexpected mutation: '+file);
 else assert.match(file,/^(dist\/src\/(orbit-[^/]+|lagrange-model)\.js|tests\/(orbit-layers\.test\.js|browser-orbit-layers\.mjs)|scripts\/m1b-[^/]+\.mjs|docs\/m1b\/)/);
}
console.log(`PASS ${Object.keys(manifest.files).length} baseline files SHA256-identical: official presets, surface grids, geology/population, industry/SCU/saves, ECON1–4.1 and M1a reports/screenshots.`);
console.log('PASS exact integration/test-calibration allowlist, new-file scope and unchanged baseline DECISIONS; M1b decisions isolated to avoid concurrent main documentation conflict.');
