// Physical timing/conservation only; not ECON-SIM-4. Can run the identical idle
// harness against an archived PR12 dist via SCU_BENCH_ROOT for controlled comparison.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {performance} from 'node:perf_hooks';
const root=path.resolve(process.env.SCU_BENCH_ROOT||'.'),module=name=>import(pathToFileURL(path.join(root,'dist/src',name+'.js'))),{createSolContext}=await module('system-context'),{createPlanetarySurfaceGrid}=await module('planetary-surface-grid'),{IndustryCatalog,createIndustryState,ownerInventory,advanceIndustry}=await module('industry-runtime'),sol=createSolContext(),rows=[];
for(const accounts of [1,19]){
 const c=new IndustryCatalog('sol');for(const body of sol.allBodies.filter(b=>['planet','moon'].includes(b.kind)).slice(0,accounts))c.register({body,grid:createPlanetarySurfaceGrid('sol',body),template:JSON.parse(fs.readFileSync(path.join(root,`dist/data/planet-surfaces/sol-${body.id}-v2.json`)))});
 const times=[],cloneCalls=[];for(let i=0;i<5;i++){const s=createIndustryState(c);for(const id of c.bodies.keys())ownerInventory(s,id);const clone=globalThis.structuredClone;let calls=0;globalThis.structuredClone=(...args)=>{calls++;return clone(...args);};const start=performance.now();try{advanceIndustry(s,c,500);}finally{times.push(performance.now()-start);cloneCalls.push(calls);globalThis.structuredClone=clone;}}
 rows.push({accounts,days:500,repetitions:5,meanMs:times.reduce((a,b)=>a+b,0)/5,maxMs:Math.max(...times),structuredClones:cloneCalls});
}
console.log(JSON.stringify({node:process.version,root:process.env.SCU_BENCH_ROOT?'archived PR12':'current FOLLOW-UP-1',rows},null,2));
