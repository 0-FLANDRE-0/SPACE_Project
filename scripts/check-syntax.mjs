import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(p.endsWith('.js'))files.push(p);}}
walk('dist/src');for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
console.log(`Syntax checks passed: ${files.length} source modules.`);
