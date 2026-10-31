import { personsToPOP } from './resource-definitions.js';
export const DISTRIBUTION_COLORS=Object.freeze({zero:'#080C13',unknown:'#626A77',positive:['#142C45','#245B85','#328BB5','#4DB9DA','#99E7FF']});
const valid=v=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0);
export function quantileDistribution(values){
 const all=[...values.values()];if(!all.every(valid))throw Error('분포 값은 null 또는 음수 없는 유한 수여야 합니다.');
 const positives=all.filter(v=>v>0).sort((a,b)=>a-b),unique=[...new Set(positives)];
 const limits=unique.length<5?unique:[...new Set([.2,.4,.6,.8,1].map(p=>positives[Math.ceil(p*positives.length)-1]))];
 const bands=limits.map((upper,i)=>{const members=positives.filter(v=>v<=upper&&(i===0||v>limits[i-1]));return {min:members[0],max:upper,count:members.length,color:DISTRIBUTION_COLORS.positive[limits.length===1?4:Math.round(i/(limits.length-1)*4)]};});
 const colors=new Map([...values].map(([id,value])=>[id,value===null?DISTRIBUTION_COLORS.unknown:value===0?DISTRIBUTION_COLORS.zero:bands.find(b=>value<=b.max).color]));
 return {colors,bands,zeroCount:all.filter(v=>v===0).length,unknownCount:all.filter(v=>v===null).length,min:positives[0]??null,max:positives.at(-1)??null};
}
export function absoluteDistribution(values,maximum){
 if(!Number.isFinite(maximum)||maximum<=0||[...values.values()].some(v=>!valid(v)||v!==null&&v>maximum))throw Error('절대 분포 범위 오류');
 return {colors:new Map([...values].map(([id,v])=>[id,v===null?DISTRIBUTION_COLORS.unknown:v===0?DISTRIBUTION_COLORS.zero:DISTRIBUTION_COLORS.positive[Math.min(4,Math.ceil(v/maximum*5)-1)]])),bands:Array.from({length:5},(_,i)=>({min:i*maximum/5,max:(i+1)*maximum/5,color:DISTRIBUTION_COLORS.positive[i]})),zeroCount:[...values.values()].filter(v=>v===0).length,unknownCount:[...values.values()].filter(v=>v===null).length};
}
export function formatPOP(persons){if(persons===null||persons===undefined)return '미설정';if(!Number.isSafeInteger(persons)||persons<0)throw Error('인구 명수는 음수 없는 안전 정수');return personsToPOP(persons).toLocaleString('ko-KR',{maximumFractionDigits:6})+' POP';}
export const FACILITY_MAP_COLORS={construction:'#e4bd65',rampup:'#91dbf5',active:'#65cbb5',stopped:'#5b6777'};
export function facilityDistribution(runtime,bodyId,ownerId='human'){
 const tiles=new Map();for(const f of Object.values(runtime?.facilityInstances??{})){if(f.bodyId!==bodyId||f.ownerId!==ownerId)continue;if(!tiles.has(f.tileId))tiles.set(f.tileId,[]);tiles.get(f.tileId).push({id:f.id,type:f.type,status:f.status});}
 return {tiles,colors:new Map([...tiles].map(([id,list])=>{const status=['construction','active','rampup','stopped'].find(s=>list.some(f=>f.status===s));return [id,FACILITY_MAP_COLORS[status]];}))};
}
