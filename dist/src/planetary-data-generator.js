import { createSurfaceTemplate, defaultGeology, defaultStartingCell, validateSurfaceTemplate, surfaceTypeFor } from './planetary-surface-model.js';
import { RESOURCE_DEFINITIONS, MAX_RESOURCE_U, MAX_POPULATION_PERSONS } from './resource-definitions.js';
import { GENERATION_PROFILES, DATA_GENERATOR_VERSION, recommendGenerationProfile, defaultGenerationSeed } from './planetary-generation-profiles.js';
export const RESOURCE_QUANTA_PER_U=1000;
export function resourceQuanta(value){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>MAX_RESOURCE_U)throw Error('자원 예산은 0–1e12 U의 유한 수여야 합니다.');
 const q=Math.round(value*RESOURCE_QUANTA_PER_U);if(Math.abs(value*RESOURCE_QUANTA_PER_U-q)>.00001)throw Error('자원 예산/고정 매장량은 0.001 U 단위로 맞추세요.');return q;
}
export function populationTarget(value){if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>MAX_POPULATION_PERSONS))throw Error('총 인구는 0–1e12의 정수 명수 또는 null이어야 합니다.');return value;}
// Keyed PRNG streams never depend on iteration/call order or the world clock.
export function keyedRandom(...keys){let h=2166136261;for(const c of JSON.stringify(keys)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}h+=0x6D2B79F5;let t=Math.imul(h^h>>>15,1|h);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;}
export function allocateInteger(total,items){
 if(!Number.isSafeInteger(total)||total<0)throw Error('배분 총량은 안전한 음이 아닌 정수여야 합니다.');
 const sorted=[...items].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);if(new Set(sorted.map(x=>x.id)).size!==sorted.length)throw Error('중복 배분 대상');
 if(sorted.some(x=>!Number.isFinite(x.weight)||x.weight<0))throw Error('배분 가중치 오류');
 const sum=sorted.reduce((n,x)=>n+x.weight,0);if(total>0&&sum<=0)throw Error('목표량을 배분할 유효한 대상이 없습니다.');
 const rows=sorted.map(x=>{const raw=sum?total*x.weight/sum:0;return {...x,n:Math.floor(raw),fraction:raw-Math.floor(raw)};});
 let remaining=total-rows.reduce((n,x)=>n+x.n,0);if(remaining<0||remaining>rows.length)throw Error('배분 수치 안전 한도 오류');
 const order=[...rows].sort((a,b)=>b.fraction-a.fraction||(a.id<b.id?-1:1));for(let i=0;i<remaining;i++)order[i].n++;
 return new Map(rows.map(x=>[x.id,x.n]));
}
const rounded=(n,d=6)=>Number(n.toFixed(d));
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
function smoothField(seed,point,key){let total=0;for(let k=0;k<5;k++){const a=keyedRandom(seed,key,k,'a')*Math.PI*2,b=keyedRandom(seed,key,k,'b')*2-1,r=Math.sqrt(1-b*b),axis={x:r*Math.cos(a),y:b,z:r*Math.sin(a)};total+=Math.sin(dot(point,axis)*(2+k*.6)+keyedRandom(seed,key,k,'phase')*6.28)/(k+1);}return total;}
function landFractions(grid,seed,target,mask){
 if(mask){if(mask.gridFingerprint!==grid.gridFingerprint||mask.fractions.length!==grid.cellCount)throw Error('지구 육지 마스크 격자 불일치');return new Map(grid.tiles.map(t=>{const n=mask.fractions[t.index];if(!Number.isFinite(n)||n<0||n>1)throw Error('육지 마스크 비율 오류');return [t.id,n];}));}
 const noise=new Map(grid.tiles.map(t=>[t.id,smoothField(seed,t.center,'continents')]));let low=-5,high=5;
 const fraction=(v,threshold)=>Math.max(0,Math.min(1,(v-threshold)*3+.5));
 for(let i=0;i<50;i++){const threshold=(low+high)/2,area=grid.tiles.reduce((n,t)=>n+t.areaWeight*fraction(noise.get(t.id),threshold),0);if(area>target)low=threshold;else high=threshold;}
 return new Map(grid.tiles.map(t=>[t.id,rounded(target===1?1:target===0?0:fraction(noise.get(t.id),(low+high)/2))]));
}
export function generatedDeposit(draft,tile,resourceId,quanta){return {depositId:`gen-${Math.floor(keyedRandom(draft.seed,draft.grid.systemId,draft.grid.bodyId,tile.id,resourceId,0)*2**32).toString(16)}-${tile.index}-${resourceId}`,resourceId,initialReserveU:quanta/RESOURCE_QUANTA_PER_U,extractionDifficulty:rounded(20+60*keyedRandom(draft.seed,tile.id,resourceId,'difficulty'),3),discoveryTier:Math.floor(keyedRandom(draft.seed,tile.id,resourceId,'discovery')*4),notes:'절차적 초기 매장지 · 미발견 기록은 별도'};}
export function generatePlanetSurfaceDraft({systemId,body,grid,seed=defaultGenerationSeed(systemId,body.id),generatorVersion=DATA_GENERATOR_VERSION,profileId=recommendGenerationProfile(body).id,earthMask=null,parameters={},resourceBudgetsU={},scenario={}}){
 if(generatorVersion!==DATA_GENERATOR_VERSION)throw Error('지원하지 않는 데이터 생성기 버전');if(grid.systemId!==systemId||grid.bodyId!==body.id)throw Error('생성 대상 격자 불일치');
 if(!['string','number'].includes(typeof seed)||String(seed).length>200||(typeof seed==='number'&&!Number.isFinite(seed)))throw Error('시드는 200자 이하 문자열/유한 숫자여야 합니다.');seed=String(seed);
 if(!Object.hasOwn(GENERATION_PROFILES,profileId))throw Error('알 수 없는 생성 프로필');const profile={...GENERATION_PROFILES[profileId],...parameters};
 for(const key of Object.keys(parameters))if(!['landTarget','temperatureK','latitudeCoolingK','habitability'].includes(key))throw Error('알 수 없는 환경 매개변수');
 const atmosphere=surfaceTypeFor(body)==='atmosphere';if(atmosphere!==(profileId==='gas-giant'))throw Error('대기 기준층/고체 프로필을 일치시키세요.');
 for(const [k,min,max]of [['landTarget',0,1],['temperatureK',0,100000],['latitudeCoolingK',0,100000],['habitability',0,1]]){const v=profile[k];if(v!==null&&(!Number.isFinite(v)||v<min||v>max))throw Error('환경 매개변수 범위: '+k);}
 if(!atmosphere&&profile.landTarget===null)throw Error('고체 표면의 목표 육지 비율이 필요합니다.');
 const budgets={};for(const [id,value]of Object.entries(resourceBudgetsU)){const r=RESOURCE_DEFINITIONS.get(id);if(!r?.naturalDeposit||r.unit!=='U')throw Error('등록된 자연 U 자원만 생성할 수 있습니다.');if(value!==null)resourceQuanta(value);if(atmosphere&&value>0)throw Error('대기층의 암석 매장지는 생성하지 않습니다.');budgets[id]=value;}
 const population=populationTarget(scenario.populationTotalPersons??null),urbanPolicy=scenario.urbanizationPolicy??'none';if(!['none','settled','sparse'].includes(urbanPolicy))throw Error('도시화 정책 오류');
 const centers=scenario.settlementTileIds??[];if(centers.some(id=>!grid.byId.has(id)))throw Error('없는 정착 중심 구역');
 const template=createSurfaceTemplate(grid,body),lands=atmosphere?null:landFractions(grid,seed,profile.landTarget,earthMask),weights={resources:{},population:{}},warnings=[];
 for(const resourceId of Object.keys(budgets).sort())weights.resources[resourceId]={};
 for(const tile of grid.tiles){const g=defaultGeology(body),s=defaultStartingCell(),land=lands?.get(tile.id)??null,latitude=Math.abs(tile.latitudeDegrees)/90,n=smoothField(seed,tile.center,'veins');
  g.terrain.landFraction=land;g.terrain.waterFraction=land===null?null:1-land;
  g.terrain.terrainType=atmosphere?'gas-atmosphere':profile.terrain==='ice'?'ice':profile.terrain==='vacuum-rock'?'vacuum-rock':land<.08?'ocean':land<.92?'mixed':latitude>.82?'ice':n>.65?'mountain':profile.terrain;
  g.environment.temperatureK=profile.temperatureK===null?null:rounded(Math.max(0,profile.temperatureK-profile.latitudeCoolingK*latitude**2+smoothField(seed,tile.center,'temperature')*4),3);
  g.environment.terrainObstacle=rounded(atmosphere?0:g.terrain.terrainType==='mountain'?.8:.25+.15*Math.tanh(n));g.environment.habitability=profile.habitability===null?null:rounded(profile.habitability*(1-.45*latitude));
  g.environment.atmosphereNotes='게임용 생성 프로필: '+profileId+' (기후 관측/물리 계산 아님)';
  for(const id of Object.keys(budgets))weights.resources[id][tile.id]=tile.areaWeight*(.2+Math.exp(n))*(1-g.environment.terrainObstacle*.3);
  const centerBoost=centers.length?1+30*Math.max(0,...centers.map(id=>dot(tile.center,grid.byId.get(id).center)))**16:1;
  weights.population[tile.id]=tile.areaWeight*(land===null?.1:land**2)*Math.max(.01,g.environment.habitability??.1)*(.2+Math.exp(smoothField(seed,tile.center,'settlement')))*centerBoost;
  // Explicit colony centers permit settlement on otherwise hostile/ocean worlds.
  if(centers.length)weights.population[tile.id]+=tile.areaWeight*.01*centerBoost;
  template.geology.cells[tile.id]=g;template.startingScenario.cells[tile.id]=s;
 }
 const draft={template,grid,body,seed,generatorVersion,profileId,weights,resourceBudgetsU:budgets,scenario:{...scenario,populationTotalPersons:population,urbanizationPolicy:urbanPolicy},source:earthMask?earthMask.source:{id:'procedural-v1',label:'절차적 게임 초기 데이터 · 실제 지질 자료 아님'},warnings};
 for(const [id,budget]of Object.entries(budgets))if(budget!==null){const shares=allocateInteger(resourceQuanta(budget),grid.tiles.map(t=>({id:t.id,weight:weights.resources[id][t.id]})));for(const t of grid.tiles){const g=template.geology.cells[t.id];g.deposits??=[];if(shares.get(t.id)>0)g.deposits.push(generatedDeposit(draft,t,id,shares.get(t.id)));}}
 if(population!==null){const shares=allocateInteger(population,grid.tiles.map(t=>({id:t.id,weight:weights.population[t.id]})));for(const t of grid.tiles){const s=template.startingScenario.cells[t.id];s.populationPersons=shares.get(t.id);s.civilizationId=scenario.civilizationId??null;}}
 applyUrbanization(template,draft,grid.tiles.map(t=>t.id));validateSurfaceTemplate(template,grid,body);return draft;
}
export function applyUrbanization(template,draft,ids){if(draft.scenario.urbanizationPolicy==='none'||draft.scenario.populationTotalPersons===null)return;const maximum=Math.max(1,...ids.map(id=>template.startingScenario.cells[id].populationPersons??0));for(const id of ids){const s=template.startingScenario.cells[id],p=s.populationPersons;if(p===null)continue;const intensity=Math.sqrt(p/maximum)*(draft.scenario.urbanizationPolicy==='sparse'?.4:.85);s.urbanizationRate=rounded(intensity);s.infrastructureLevel=p===0?0:Math.max(1,Math.min(5,Math.round(intensity*5)));}}
// Scheduler/cancellation are supplied by the caller; the generation core has no clock/DOM/I/O.
export async function generateSystemSurfaceDrafts({context,createGrid,settingsFor=()=>({}),yieldTask=async()=>{},isCancelled=()=>false}){const results=[];for(const body of [...context.planets,...context.moons]){await yieldTask();if(isCancelled())return {cancelled:true,results};try{const grid=createGrid(context.systemId,body);results.push({bodyId:body.id,ok:true,draft:generatePlanetSurfaceDraft({systemId:context.systemId,body,grid,...settingsFor(body)})});}catch(error){results.push({bodyId:body.id,ok:false,error:error.message});}}return {cancelled:false,results};}
