// Pure physical/material quotation. No stock changes, market prices or routes.
import {resourceCargoRatio,materialResource} from './resource-definitions.js';
import {deepFreeze,integer,checkedProduct,safeId} from './packaging-common.js';
const gcd=(a,b)=>{while(b)[a,b]=[b,a%b];return a;};
const add=(o,k,n)=>{o[k]=integer((o[k]??0)+n,'화물 합계');};
const compare=(a,b)=>{if(!b)return -1;for(const k of ['cost','scu','count'])if(a[k]!==b[k])return a[k]-b[k];for(let i=a.counts.length-1;i>=0;i--)if(a.counts[i]!==b.counts[i])return b.counts[i]-a.counts[i];return 0;};
function ratioCompare(a,b){
 let d=BigInt(a.cost)*BigInt(b.cap)-BigInt(b.cost)*BigInt(a.cap);if(d)return d<0n?-1:1;
 d=BigInt(a.spec.sizeSCU)*BigInt(b.cap)-BigInt(b.spec.sizeSCU)*BigInt(a.cap);if(d)return d<0n?-1:1;
 return b.cap-a.cap||a.spec.id.localeCompare(b.spec.id);
}
export function containerCapacityQ(resourceId,spec,resources){
 const perQ=resourceCargoRatio(resourceId,1,resources);const q=BigInt(spec.sizeSCU)*perQ.denominator/perQ.numerator;
 if(q<1n||q>1000000000000000n)throw Error('컨테이너 적재 Q 범위/규격 미지원');return Number(q);
}
export function quoteContainerPlan(resourceId,amountQ,registry,{
 ownerId='human',availableContainerSpecs=null,allowedContainerSizes=null,
 minGeneration=1,capacitySCU=Infinity,materialWeights={},objectivePolicy=null
}={}){
 integer(amountQ,'내용물 Q',1e15);if(!amountQ)throw Error('양수 화물 필요');
 if(capacitySCU!==Infinity&&(!Number.isSafeInteger(capacitySCU)||capacitySCU<0))throw Error('컨테이너 외형 SCU 용량 오류');
 for(const n of Object.values(materialWeights)){integer(n,'소재 목적함수 가중치');if(!n)throw Error('양수 소재 목적함수 필요');}
 if(objectivePolicy&&(!safeId(objectivePolicy.id)||typeof objectivePolicy.scoreContainer!=='function'))throw Error('객관함수 정책 인터페이스 오류');
 const containers=registry.containers??registry,resources=containers.resources,ratio=resourceCargoRatio(resourceId,amountQ,resources);
 for(const id of Object.keys(materialWeights))materialResource(id,resources,{configured:true});
 const specs=containers.available(ownerId,availableContainerSpecs,{allowedContainerSizes,minGeneration});if(!specs.length)throw Error('해금된 승인 컨테이너 없음');
 const coins=specs.map(spec=>{const recipe=containers.recipe(spec.id,resourceId);let cost=0;for(const m of recipe.materialInputs)cost=integer(cost+checkedProduct(m.amountQ,materialWeights[m.resourceId]??1,'소재 목적함수'),'목적함수');if(!cost)throw Error('실물 소재 목적함수0');const materialScore=cost;if(objectivePolicy)cost=integer(objectivePolicy.scoreContainer({spec,recipe}),'주입된 객관함수 점수');return {spec,recipe,cost,materialScore,capacityQ:containerCapacityQ(resourceId,spec,resources)};});
 if(capacitySCU!==Infinity&&coins.some(c=>BigInt(c.capacityQ)*BigInt(coins[0].spec.sizeSCU)!==BigInt(coins[0].capacityQ)*BigInt(c.spec.sizeSCU)))throw Error('정수 Q와 외형 공간의 다차원 최적화가 필요한 SCU/U 조합: 별도 정책 필요');
 const divisor=coins.reduce((n,c)=>gcd(n,c.capacityQ),0);for(const c of coins)c.cap=c.capacityQ/divisor;
 const target=Number((BigInt(amountQ)+BigInt(divisor)-1n)/BigInt(divisor)),maxCap=Math.max(...coins.map(c=>c.cap));
 const anchor=coins.reduce((best,c)=>ratioCompare(c,best)<0?c:best),anchorIndex=coins.indexOf(anchor),b=anchor.cap;
 // In an optimum each non-anchor coin needs fewer than b/gcd(cap,b)
 // copies: replace that many by cap/gcd(cap,b) anchors at equal capacity.
 // This bounds the residual DP independently of shipment size, and is exact.
 const nonAnchorBound=coins.reduce((n,c)=>n+(c===anchor?0:checkedProduct(b/gcd(c.cap,b)-1,c.cap,'정확 최적화 경계')),0);
 const bulk=Math.max(0,Math.floor((target-nonAnchorBound-maxCap)/b)),remaining=target-checkedProduct(bulk,b,'대량 기준 용량');
 const limit=remaining+maxCap-1;if(!Number.isSafeInteger(limit)||limit>250000)throw Error('정확 컨테이너 최적화 상태 한도 초과: 물리 규격/허용 크기 검토 필요');
 const dp=Array(limit+1).fill(null);dp[0]={cost:0,scu:0,count:0,counts:coins.map(()=>0)};
 for(let cap=1;cap<=limit;cap++)for(let i=0;i<coins.length;i++){
  const c=coins[i],prior=dp[cap-c.cap];if(!prior)continue;
  const x={cost:integer(prior.cost+c.cost,'DP 소재'),scu:integer(prior.scu+c.spec.sizeSCU,'DP SCU'),count:prior.count+1,counts:[...prior.counts]};x.counts[i]++;if(compare(x,dp[cap])<0)dp[cap]=x;
 }
 let selected=null;for(let cap=remaining;cap<=limit;cap++)if(dp[cap]&&dp[cap].scu+bulk*anchor.spec.sizeSCU<=capacitySCU&&compare(dp[cap],selected)<0)selected=dp[cap];if(!selected)throw Error('정수 Q를 담는 컨테이너 조합 없음');
 const counts=[...selected.counts];counts[anchorIndex]+=bulk;
 let left=amountQ,occupiedSCU=0,containerCount=0,creditsMicroC=0,energyWh=0,weightedMaterialQ=0;
 const materialQ={},recoveryNumerators={},combinations=[],groups=[],pendingCosts=new Set();
 for(let i=coins.length-1;i>=0;i--){const c=coins[i],count=counts[i];if(!count)continue;
  occupiedSCU=integer(occupiedSCU+checkedProduct(count,c.spec.sizeSCU,'총 SCU'),'총 SCU');containerCount=integer(containerCount+count,'컨테이너 수');weightedMaterialQ=integer(weightedMaterialQ+checkedProduct(count,c.materialScore,'소재 목표'),'소재 목표');
  const full=Math.min(count,Math.floor(left/c.capacityQ));if(full){groups.push({resourceId,containerSpecId:c.spec.id,fillQ:c.capacityQ,count:full});left-=checkedProduct(full,c.capacityQ,'적재 내용물');}
  if(count>full){if(count-full!==1||left<=0||left>c.capacityQ)throw Error('최적 조합의 빈 컨테이너/적재 불일치');groups.push({resourceId,containerSpecId:c.spec.id,fillQ:left,count:1});left=0;}
  combinations.push({containerSpecId:c.spec.id,sizeSCU:c.spec.sizeSCU,count});
  for(const m of c.recipe.materialInputs){const n=checkedProduct(count,m.amountQ,'전체 소재');add(materialQ,m.resourceId,n);const total=(recoveryNumerators[m.resourceId]??0n)+BigInt(n)*BigInt(m.recoveryParts);recoveryNumerators[m.resourceId]=total;}
  for(const k of c.recipe.pendingCosts)pendingCosts.add(c.spec.id+':'+k);
  if(c.recipe.directMicroC!==null)creditsMicroC=integer(creditsMicroC+checkedProduct(count,c.recipe.directMicroC,'C'),'C');
  if(c.recipe.energyWh!==null)energyWh=integer(energyWh+checkedProduct(count,c.recipe.energyWh,'전력'),'전력');
 }
 if(left)throw Error('내용물 적재 누락');if(occupiedSCU>capacitySCU)throw Error('실제 컨테이너 외형 SCU 용량 초과');
 const expectedRecoveryQ={},recoveryRemainderParts={},expectedLossQ={};for(const [id,n]of Object.entries(recoveryNumerators)){expectedRecoveryQ[id]=Number(n/1000000n);recoveryRemainderParts[id]=Number(n%1000000n);expectedLossQ[id]=materialQ[id]-expectedRecoveryQ[id];}
 const requiredSCU=Number(ratio.numerator)/Number(ratio.denominator),pending=[...pendingCosts].sort();
 return deepFreeze({status:pending.length?'pending-cost-input':'ready',allowed:!pending.length,resourceId,amountQ,requiredSCU,occupiedSCU,wasteSCU:occupiedSCU-requiredSCU,containerCount,combinations,groups,materialQ,expectedRecoveryQ,recoveryRemainderParts,expectedLossQ,creditsMicroC:pending.some(x=>x.endsWith('directCostCPerContainer'))?null:creditsMicroC,energyWh:pending.some(x=>x.endsWith('electricityKWhPerContainer'))?null:energyWh,pendingCosts:pending,objective:objectivePolicy?'injected:'+objectivePolicy.id:'weighted-material-Q / occupied-SCU / count / stable-size-order',objectiveScore:integer(selected.cost+checkedProduct(bulk,anchor.cost,'주입 목표'),'목표 합계'),weightedMaterialQ,optimizer:{exact:true,dpStates:limit+1,aggregatedAnchorCount:bulk}});
}
