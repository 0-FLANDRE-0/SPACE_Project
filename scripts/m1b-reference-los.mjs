import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createSystemContext} from '../dist/src/system-context.js';
import {orbitGraph,orbitPosition} from '../dist/src/orbit-model.js';
import {planMovement} from '../dist/src/ship-navigation.js';
import {SHIP_DESIGNS} from '../dist/src/ship-data.js';
import {add,mul,unit} from '../dist/src/ship-math.js';
const base='9ba37cee218018ccfb3a2167e3458b2e956bfd61',directory=fs.mkdtempSync(path.join(os.tmpdir(),'m1b-los-'));
try{
 const archive=execFileSync('git',['archive',base,'dist'],{maxBuffer:128*1024*1024});execFileSync('tar',['-xf','-','-C',directory],{input:archive});fs.writeFileSync(path.join(directory,'package.json'),'{"type":"module"}');
 const previous=await import(pathToFileURL(path.join(directory,'dist/src/ship-navigation.js'))),oldData=await import(pathToFileURL(path.join(directory,'dist/src/ship-data.js')));
 const body={id:'earth',name:'지구',kind:'planet',planetSize:15,positionGameAU:{x:0,y:0,z:0},spinHours:1e20},context=createSystemContext({systemId:'test',planets:[body]}),node=orbitGraph(context,body.id).nodes[0],position=orbitPosition(context,node,0),target=add(mul(unit(position),-100),{x:0,y:100,z:0}),pose={position,heading:unit(target),time:0,attachment:{bodyId:body.id,offset:position}},goal={kind:'point',at:()=>target};
 const summary=p=>{const i=p.stages.findIndex(s=>s.kind==='cruising'&&!s.bodyFixed);return{departureSeconds:p.stages[i].start,localExitSeconds:p.stages[i-2].start,arrivalSeconds:p.pose.time,localStages:p.stages.slice(0,i-2).length,exitPosition:p.waypoints.find(p=>p.kind==='los-exit')?.position,orbitLayers:p.waypoints.find(p=>p.kind==='los-exit')?.orbitPoints?.map(n=>n.layer)??null};};
 const scenarios=[];
 for(const [name,scale]of [['low-start',1],['shared-middle-start',1.3/1.05]]){const start=mul(position,scale),initial={...pose,position:start,attachment:{bodyId:body.id,offset:start}};const destination=name==='shared-middle-start'?mul(unit(position),-100):target,command={kind:'point',at:()=>destination};initial.heading=unit(destination);let old;try{old=summary(previous.planMovement(context,initial,command,oldData.SHIP_DESIGNS.explorer));}catch(error){old={error:error.message};}const next=summary(planMovement(context,initial,command,SHIP_DESIGNS.explorer));scenarios.push({name,body,pose:initial,target:destination,M1a:old,M1b:next});}
 const report={base,scenarios};fs.writeFileSync('docs/m1b/los-comparison.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

}finally{fs.rmSync(directory,{recursive:true,force:true});}
