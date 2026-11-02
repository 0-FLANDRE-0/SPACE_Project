import fs from 'node:fs';
import {createSolContext} from '../dist/src/system-context.js';
import {lagrangeDestinations,lagrangePosition} from '../dist/src/lagrange-model.js';
import {orbitGraph} from '../dist/src/orbit-model.js';
const context=createSolContext(),points=lagrangeDestinations(context),epochs=[0,30,100,365,1000],adjustments=[];
for(const days of epochs)for(const point of points){const result=lagrangePosition(context,point,days*86400,{diagnostics:true});if(result.adjustments.length)adjustments.push({id:point.id,days,adjustments:result.adjustments});}
const grids=[...context.planets,...context.moons].map(b=>{const g=orbitGraph(context,b.id);return{bodyId:b.id,frequency:g.grid.frequency,verticesPerLayer:g.count,totalVertices:g.nodes.length,gridFingerprint:g.grid.gridFingerprint};});
fs.writeFileSync('docs/m1b/geometry-audit.json',JSON.stringify({grids,lagrangePoints:points.length,offsets:points.filter(p=>p.index===1).map(p=>({bodyId:p.bodyId,distanceGameAU:p.offsetGameAU})),epochs,checkedPositions:points.length*epochs.length,adjustments},null,2)+'\n');console.log(`${grids.length} bodies; ${points.length} Lagrange points; ${points.length*epochs.length} position checks; ${adjustments.length} pushed positions`);
