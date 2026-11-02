// Physical container optimization benchmark only. No economy/price simulation.
import {performance} from 'node:perf_hooks';
import {PackageRegistry,STANDARD_CONTAINERS} from '../dist/src/packaging-specs.js';
import {quoteContainerPlan} from '../dist/src/cargo-scu.js';
const registry=new PackageRegistry(),rows=[];
for(const amountQ of [1,1000,8000,12000,1000000,1000000000000,1000000000000000]){
 quoteContainerPlan('alloy',amountQ,registry);const times=[];let quote;
 for(let i=0;i<20;i++){const start=performance.now();quote=quoteContainerPlan('alloy',amountQ,registry);times.push(performance.now()-start);}
 rows.push({quantityU:amountQ/1000,requiredSCU:quote.requiredSCU,containerCount:quote.containerCount,groupCount:quote.groups.length,dpStates:quote.optimizer.dpStates,meanMs:times.reduce((n,x)=>n+x,0)/times.length,maxMs:Math.max(...times),materialAlloyU:quote.materialQ.alloy/1000});
}
const start=performance.now();let maxStates=0;
for(let mask=1;mask<128;mask++){const allowedContainerSizes=STANDARD_CONTAINERS.filter((_,i)=>mask&(1<<i)).map(x=>x.sizeSCU),q=quoteContainerPlan('alloy',1000000000000000,registry,{allowedContainerSizes});maxStates=Math.max(maxStates,q.optimizer.dpStates);}
console.log(JSON.stringify({node:process.version,platform:process.platform,objective:'material only; C/energy pending; exact anchor + residual DP',repetitions:20,rows,all127AllowedSetsAt1e12U:{elapsedMs:performance.now()-start,maxDpStates:maxStates}},null,2));
