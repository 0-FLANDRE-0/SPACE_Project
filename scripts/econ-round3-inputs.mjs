import fs from 'node:fs';
import crypto from 'node:crypto';
export const sha256=x=>crypto.createHash('sha256').update(x).digest('hex');
export function readRound3Inputs(root='.'){
 const planets={},files={};
 for(const id of ['earth','moon','mars']){
  const file=`dist/data/planet-surfaces/sol-${id}-v2.json`,raw=fs.readFileSync(`${root}/${file}`),preset=JSON.parse(raw);files[file]=sha256(raw);
  const cells=Object.entries(preset.geology.cells),oreU=cells.reduce((n,[,c])=>n+c.deposits.filter(d=>d.resourceId==='ore').reduce((s,d)=>s+d.initialReserveU,0),0);
  const waterTiles=cells.filter(([,c])=>(c.terrain.waterFraction??0)>0).map(([k])=>k);
  const sources=(preset.hydrogenSources??[]).map(s=>({...s,oreEligible:(preset.geology.cells[s.tileId]?.deposits??[]).some(d=>d.resourceId==='ore'&&d.initialReserveU>0)}));
  planets[id]={oreU,waterTiles,sources,populationPersons:Object.values(preset.startingScenario.cells).reduce((s,c)=>s+c.populationPersons,0),cellCount:cells.length,waterHostTile:waterTiles[0]??null};
 }
 const runtimeFile='dist/src/industry-runtime.js',source=fs.readFileSync(`${root}/${runtimeFile}`,'utf8');files[runtimeFile]=sha256(source);
 // Read-only contract adapter, deliberately fails closed if the runtime changes.
 // Neither the unexported hydrogen constants nor the game runtime are patched.
 if(!source.includes('const maxH=85000/720*capacity.scale')||!source.includes('1+.15*hFactor')||!source.includes('100000/720*Math.min(1,oreQ/Math.max(1,capacityOreQ))'))throw Error('Industry hydrogen contract changed; audit adapter');
 return {planets,files,contract:{smeltHydrogenU:85,smeltBoost:.15,byproductMaximumU:100,origin:runtimeFile,contractHash:files[runtimeFile]}};
}
