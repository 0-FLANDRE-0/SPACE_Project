import { HEX_DIRECTIONS, axialVertices, hexRing } from './hex-sectors.js';
export const ADMIN_SCHEMA_VERSION=1;
export const ADMIN_STORAGE_KEY='space-project:administration:v1';
export const REGION_COLORS=Object.freeze(['#80b8a8','#91afd0','#c6ab7d','#bd97b6','#b5bf86']);
const clone=value=>JSON.parse(JSON.stringify(value));
const requireValue=(ok,message)=>{if(!ok)throw new Error(message);};
export function connectedSectorIds(ids,grid){
  if(!ids.length)return false;
  const pending=new Set(ids),queue=[ids[0]];pending.delete(ids[0]);
  for(let i=0;i<queue.length;i++){const cell=grid.byId.get(queue[i]);if(!cell)return false;for(const[dq,dr]of HEX_DIRECTIONS){const id=`${grid.systemId}:${cell.q+dq}:${cell.r+dr}`;if(pending.delete(id))queue.push(id);}}
  return pending.size===0;
}
export function validateAdministrativeState(state,grid){
  requireValue(state&&Array.isArray(state.regions),'행정 저장 형식이 올바르지 않습니다.');
  requireValue(Number.isSafeInteger(state.nextRegionSerial)&&state.nextRegionSerial>0,'구역 일련번호가 잘못되었습니다.');
  const regionIds=new Set(),assigned=new Set();let maxSerial=0;
  for(const r of state.regions){
    requireValue(r.systemId===grid.systemId&&typeof r.id==='string'&&r.id.startsWith(grid.systemId+':admin:'),'다른 항성계의 구역입니다.');
    const serial=Number(r.id.slice((grid.systemId+':admin:').length));requireValue(Number.isSafeInteger(serial)&&serial>0&&r.id===`${grid.systemId}:admin:${serial}`&&!regionIds.has(r.id),'구역 ID가 잘못되었거나 중복됩니다.');maxSerial=Math.max(maxSerial,serial);regionIds.add(r.id);
    requireValue(typeof r.name==='string'&&r.name.trim().length>0&&r.name.length<=40,'구역 이름은 1–40자여야 합니다.');requireValue(REGION_COLORS.includes(r.color),'지원하지 않는 구역 색입니다.');
    requireValue(Array.isArray(r.sectorIds)&&r.sectorIds.length>0,'행정구역은 최소 한 칸이어야 합니다.');
    for(const id of r.sectorIds){requireValue(grid.byId.has(id),'존재하지 않는 기초 섹터: '+id);requireValue(!assigned.has(id),'이미 다른 구역에 속하거나 중복된 섹터: '+id);assigned.add(id);}
    requireValue(connectedSectorIds(r.sectorIds,grid),'공유 변으로 연결된 섹터만 구역으로 묶을 수 있습니다.');
  }
  requireValue(state.nextRegionSerial>maxSerial,'구역 일련번호가 이전 ID를 재사용합니다.');return true;
}
export function classifySharedEdge(a,b,assignments){
  const A=assignments.get(a),B=b?assignments.get(b):null;
  if(A&&B&&A===B)return 'internal';
  return A||B?'admin-boundary':'base-boundary';
}
// Unique edges, including the INNER boundary of a legal ring-shaped region.
export function administrativeEdges(grid,assignments){
  const edgeNeighbors=[[0,1],[-1,1],[-1,0],[0,-1],[1,-1],[1,0]],edges=[];
  for(const cell of grid.sectors){const points=axialVertices(cell.q,cell.r,grid.radiusGameAU);edgeNeighbors.forEach(([dq,dr],i)=>{const otherId=`${grid.systemId}:${cell.q+dq}:${cell.r+dr}`,other=grid.byId.get(otherId);if(other&&(cell.q>other.q||(cell.q===other.q&&cell.r>other.r)))return;edges.push({a:cell.id,b:other?.id??null,points:[points[i],points[(i+1)%6]],kind:classifySharedEdge(cell.id,other?.id,assignments)});});}
  return edges;
}
export class AdministrativeRegions {
  constructor(grid,{storage=null,onChange=()=>{},onError=()=>{}}={}){this.storage=storage;this.onChange=onChange;this.onError=onError;this.histories=new Map();this.quarantined=new Set();this.systems=Object.create(null);this.load();this.setGrid(grid);}
  load(){
    try{const raw=this.storage?.getItem(ADMIN_STORAGE_KEY);if(!raw)return;const d=JSON.parse(raw);requireValue(d.schemaVersion===ADMIN_SCHEMA_VERSION&&d.systems&&typeof d.systems==='object'&&!Array.isArray(d.systems),'지원하지 않는 저장 버전 또는 형식입니다.');this.systems=Object.assign(Object.create(null),clone(d.systems));}
    catch(error){this.loadError=error.message;this.storageBlocked=true;this.onError('행정 저장을 읽지 못했습니다. 원본을 보존합니다: '+error.message);}
  }
  setGrid(grid){
    this.grid=grid;this.systemId=grid.systemId;this.selectedRegionId=null;
    if(this.quarantined.has(this.systemId))this.state={regions:[],nextRegionSerial:1};
    else try{const saved=this.systems[this.systemId]??{regions:[],nextRegionSerial:1};validateAdministrativeState(saved,grid);this.state=clone(saved);}
    catch(error){this.quarantined.add(this.systemId);this.state={regions:[],nextRegionSerial:1};this.onError('이 항성계의 저장을 격리했습니다. 원본은 보존됩니다: '+error.message);}
    this.reindex();
  }
  reindex(){this.assignments=new Map(this.state.regions.flatMap(r=>r.sectorIds.map(id=>[id,r.id])));}
  get regions(){return this.state.regions;}
  region(id){return this.regions.find(r=>r.id===id)??null;}
  forSector(id){return this.region(this.assignments.get(id));}
  idsForRing(ring){return this.grid.sectors.filter(s=>hexRing(s.q,s.r)===ring).map(s=>s.id);}
  transaction(edit){
    requireValue(!this.storageBlocked&&!this.quarantined.has(this.systemId),'손상/구버전 저장을 보존 중입니다. 원본 백업 후 이 항성계 저장을 초기화하세요.');
    const next=clone(this.state),result=edit(next);validateAdministrativeState(next,this.grid);
    const history=this.histories.get(this.systemId)??[];history.push(clone(this.state));if(history.length>20)history.shift();this.histories.set(this.systemId,history);
    this.state=next;this.systems[this.systemId]=clone(next);this.reindex();this.persist();this.onChange();return result;
  }
  persist(){try{this.storage?.setItem(ADMIN_STORAGE_KEY,this.serialize());this.saveError=null;}catch(error){this.saveError=error.message;this.onError('저장 실패: 이번 편집은 현재 탭에만 남습니다. '+error.message);}}
  serialize(){return JSON.stringify({schemaVersion:ADMIN_SCHEMA_VERSION,systems:this.systems});}
  create(sectorIds,name,color=REGION_COLORS[0]){return this.transaction(s=>{const id=`${this.systemId}:admin:${s.nextRegionSerial++}`;s.regions.push({id,systemId:this.systemId,name:name.trim(),color,sectorIds:[...sectorIds]});return id;});}
  update(id,{name,color}={}){return this.transaction(s=>{const r=s.regions.find(r=>r.id===id);requireValue(r,'구역을 선택하세요.');if(name!==undefined)r.name=name.trim();if(color!==undefined)r.color=color;});}
  add(id,sectorIds){return this.transaction(s=>{const r=s.regions.find(r=>r.id===id);requireValue(r,'대상 구역을 선택하세요.');requireValue(sectorIds.length>0,'추가할 칸을 선택하세요.');r.sectorIds.push(...sectorIds);});}
  remove(id,sectorIds){return this.transaction(s=>{const r=s.regions.find(r=>r.id===id);requireValue(r,'대상 구역을 선택하세요.');requireValue(sectorIds.length>0&&sectorIds.every(x=>r.sectorIds.includes(x)),'대상 구역에 속한 제거할 칸을 선택하세요.');r.sectorIds=r.sectorIds.filter(x=>!sectorIds.includes(x));});}
  merge(targetId,absorbedIds){return this.transaction(s=>{const target=s.regions.find(r=>r.id===targetId);requireValue(target&&absorbedIds.length>0&&!absorbedIds.includes(targetId)&&new Set(absorbedIds).size===absorbedIds.length,'서로 다른 통합 대상 구역을 선택하세요.');const occupied=new Set(target.sectorIds);for(const id of absorbedIds){const r=s.regions.find(r=>r.id===id);requireValue(r,'흡수할 구역이 없습니다.');requireValue(connectedSectorIds([...occupied,...r.sectorIds],this.grid),'인접한 구역만 통합할 수 있습니다.');r.sectorIds.forEach(x=>occupied.add(x));}target.sectorIds=[...occupied];s.regions=s.regions.filter(r=>!absorbedIds.includes(r.id));});}
  delete(id){return this.transaction(s=>{requireValue(s.regions.some(r=>r.id===id),'삭제할 구역을 선택하세요.');s.regions=s.regions.filter(r=>r.id!==id);});}
  undo(){requireValue(!this.storageBlocked&&!this.quarantined.has(this.systemId),'원본 백업 후 손상된 저장을 초기화하세요.');const history=this.histories.get(this.systemId);requireValue(history?.length,'되돌릴 편집이 없습니다.');const old=history.pop();old.nextRegionSerial=Math.max(old.nextRegionSerial,this.state.nextRegionSerial);validateAdministrativeState(old,this.grid);this.state=old;this.systems[this.systemId]=clone(old);this.reindex();this.persist();this.onChange();}
  resetInvalidStorage(){
    // Explicit recovery only: keep the original under a separate backup key.
    const raw=this.storage?.getItem(ADMIN_STORAGE_KEY);if(raw)this.storage?.setItem(ADMIN_STORAGE_KEY+':backup',raw);
    if(this.storageBlocked){this.systems=Object.create(null);this.histories.clear();}else delete this.systems[this.systemId];
    this.storageBlocked=false;this.quarantined.delete(this.systemId);this.setGrid(this.grid);this.persist();this.onChange();
  }
}
