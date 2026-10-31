import { allocateInteger } from './planetary-data-generator.js';
import { resourceRandom as rng } from './ore-quality.js';

export function allocateCappedInteger(total,items){
 if(!Number.isSafeInteger(total)||total<0||items.some(x=>!Number.isSafeInteger(x.cap)||x.cap<0))throw Error('정수 분배 용량 오류');
 if(items.reduce((n,x)=>n+x.cap,0)<total)throw Error('매장지 용량이 예산보다 작습니다.');
 const result=new Map(items.map(x=>[x.id,0]));let remaining=total,open=items.filter(x=>x.cap>0);
 while(remaining){const proposal=allocateInteger(remaining,open.map(x=>({id:x.id,weight:x.weight}))),saturated=open.filter(x=>proposal.get(x.id)>x.cap);
  if(!saturated.length){for(const x of open)result.set(x.id,proposal.get(x.id));break;}
  const ids=new Set(saturated.map(x=>x.id));for(const x of saturated){result.set(x.id,x.cap);remaining-=x.cap;}open=open.filter(x=>!ids.has(x.id));
 }
 return result;
}

function connectedTriples(grid,ids,seed){const set=new Set(ids),unique=new Map();for(const id of ids){const neighbors=grid.byId.get(id).neighborIds.filter(n=>set.has(n));for(let a=0;a<neighbors.length;a++)for(let b=a+1;b<neighbors.length;b++){const triple=[id,neighbors[a],neighbors[b]].sort();unique.set(triple.join('|'),triple);}}
 return [...unique.values()].sort((a,b)=>rng(seed,'triple',...a)-rng(seed,'triple',...b)||(a.join() < b.join()?-1:1));}
function packTriples(triples,count){const chosen=[],used=new Set();function search(start){if(chosen.length===count)return chosen.map(x=>[...x]);for(let i=start;i<triples.length;i++){const t=triples[i];if(t.some(id=>used.has(id)))continue;t.forEach(id=>used.add(id));chosen.push(t);const found=search(i+1);if(found)return found;chosen.pop();t.forEach(id=>used.delete(id));}return null;}return search(0);}
export function planConnectedVeins(grid,tiles,seed,policy,budgetPolicy){
 const minimum=budgetPolicy==='fixed'?policy.minimumFixedGroups:policy.minimumProceduralGroups,n=tiles.length,exceptions=[],ids=tiles.map(t=>t.id),triples=connectedTriples(grid,ids,seed),requested=minimum+Math.floor(rng(seed,'vein-count-v2')*(policy.maximumGroups-minimum+1));
 let groups=null,count=Math.min(requested,Math.floor(n/policy.minimumGroupCells));while(count>0&&!groups){groups=packTriples(triples,count);if(!groups)count--;}
 if(!groups){groups=[];const available=new Set(ids);for(const root of [...ids].sort((a,b)=>rng(seed,'fallback',a)-rng(seed,'fallback',b))){if(!available.has(root)||groups.length>=policy.maximumGroups)continue;const members=[root];available.delete(root);for(const id of grid.byId.get(root).neighborIds)if(available.has(id)&&members.length<policy.minimumGroupCells){members.push(id);available.delete(id);}groups.push(members);}}
 if(groups.length<minimum)exceptions.push(`후보 ${n}셀의 연결성/수량으로 최소 ${minimum}개 그룹을 구성할 수 없음`);
 const used=new Set(groups.flat()),unused=new Set(ids.filter(id=>!used.has(id))),requiredCoverage=Math.ceil(n*policy.minimumCoverage),target=Math.min(n,Math.max(requiredCoverage,groups.length*policy.minimumGroupCells)+Math.floor(rng(seed,'coverage-extra')*Math.max(1,n*.25)));
 let step=0;while(used.size<target){let frontier=[];for(let g=0;g<groups.length;g++)for(const id of new Set(groups[g].flatMap(id=>grid.byId.get(id).neighborIds)))if(unused.has(id))frontier.push({g,id});if(!frontier.length)break;const undersized=frontier.filter(x=>groups[x.g].length<policy.minimumGroupCells);if(undersized.length)frontier=undersized;frontier.sort((a,b)=>rng(seed,'grow',step,a.g,a.id)-rng(seed,'grow',step,b.g,b.id));const {g,id}=frontier[0];groups[g].push(id);used.add(id);unused.delete(id);step++;}
 if(groups.some(g=>g.length<policy.minimumGroupCells))exceptions.push(`후보 연결성/수량으로 그룹당 최소 ${policy.minimumGroupCells}셀 불가`);
 if(used.size<requiredCoverage)exceptions.push(`분리된 후보 연결성으로 최소 커버리지 ${requiredCoverage}/${n}셀 도달 불가`);
 return {groups,diagnostics:{candidateCells:n,requiredCoverage,veinCells:used.size,groupCount:groups.length,minimumGroupCells:groups.length?Math.min(...groups.map(g=>g.length)):0,exceptions}};
}

export function allocateResourcePositions({positionsByKind,budgets,totalQuanta,cellIds,policy,seed}){
 const allocated={},exceptions=[],totalRequested=Object.values(budgets).reduce((a,b)=>a+b,0),nominalCap=Math.floor(totalQuanta*policy.maximumCellShare),baseCap=Math.max(nominalCap,cellIds.length?Math.ceil(totalRequested/cellIds.length):0),remaining=new Map(cellIds.map(id=>[id,baseCap]));
 if(baseCap>nominalCap&&totalRequested)exceptions.push('후보 셀 수/0.001 U 정밀도 때문에 전체 10% 셀 상한의 수학적 총용량 부족');
 for(const kind of ['vein','deep','surface']){const budget=budgets[kind],rows=positionsByKind[kind];if(!budget){allocated[kind]=new Map();continue;}if(!rows.length)throw Error('남은 예산을 배분할 미설정 셀이 없습니다.');
  if(kind==='deep'){let capacity=rows.reduce((n,x)=>n+remaining.get(x.id),0);const present=new Set(rows.map(x=>x.id));for(const id of cellIds.filter(id=>!present.has(id)).sort((a,b)=>rng(seed,'deep-expand',a)-rng(seed,'deep-expand',b))){if(capacity>=budget)break;rows.push({id,g:0,weight:1/cellIds.length});capacity+=remaining.get(id);}}
  let capacity=rows.reduce((n,x)=>n+remaining.get(x.id),0);if(capacity<budget){exceptions.push(`${kind}: 허용 후보/연결성 부족으로 같은 형태 내 셀 상한 완화 필요`);const increase=Math.ceil((budget-capacity)/rows.length);for(const row of rows)remaining.set(row.id,remaining.get(row.id)+increase);}
  let shares;if(kind==='vein'){const groups=[...new Set(rows.map(x=>x.g))],nominalGroupCap=groups.length>=2?Math.floor(budget*policy.maximumGroupShare):budget;
   const groupItems=groups.map(g=>{const members=rows.filter(x=>x.g===g);return {id:String(g),weight:members.reduce((n,x)=>n+x.weight,0),cap:Math.min(nominalGroupCap,members.reduce((n,x)=>n+remaining.get(x.id),0))};});
   if(groupItems.reduce((n,x)=>n+x.cap,0)<budget){exceptions.push('연결 그룹 수/셀 용량/정수 정밀도로 50% 광맥 그룹 상한 불가');for(const item of groupItems)item.cap=rows.filter(x=>String(x.g)===item.id).reduce((n,x)=>n+remaining.get(x.id),0);}
   const groupAmounts=allocateCappedInteger(budget,groupItems);shares=new Map();for(const g of groups){const parts=allocateCappedInteger(groupAmounts.get(String(g)),rows.filter(x=>x.g===g).map(x=>({...x,cap:remaining.get(x.id)})));for(const [id,n]of parts)shares.set(id,n);}
  }else shares=allocateCappedInteger(budget,rows.map(x=>({...x,cap:remaining.get(x.id)})));
  for(const [id,n]of shares)remaining.set(id,remaining.get(id)-n);allocated[kind]=shares;
 }
 return {allocated,exceptions,nominalCellCapQuanta:nominalCap};
}
