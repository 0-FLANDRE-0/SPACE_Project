import { clone, resolvedSurfaceCell, validateSurfaceTemplate } from './planetary-surface-model.js';
import { allocateInteger, resourceQuanta, generatedDeposit, applyUrbanization, populationTarget } from './planetary-data-generator.js';
export const GENERATION_FIELDS=['terrain','environment','deposits','population','urbanization'];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function summarizeSurfaceData(template,grid,body){const resourcesU={},resourceQuantaTotals={},populations=[],cells=grid.tiles.map(t=>resolvedSurfaceCell(template,grid,body,t.id));let depositCount=0;for(const c of cells){for(const d of c.geology.deposits??[]){resourcesU[d.resourceId]=(resourcesU[d.resourceId]??0)+d.initialReserveU;resourceQuantaTotals[d.resourceId]=(resourceQuantaTotals[d.resourceId]??0)+Math.round(d.initialReserveU*1000);depositCount++;}if(c.scenario.populationPersons!==null)populations.push(c.scenario.populationPersons);}return {resourcesU,resourceQuantaTotals,depositCount,populationPersons:populations.reduce((a,b)=>a+b,0),populationConfiguredCells:populations.length};}
export function planSurfaceGeneration({template,draft,scope='all',selectedIds=[],fields=GENERATION_FIELDS,policy='fill-unset'}){
 const {grid,body}=draft;validateSurfaceTemplate(template,grid,body);validateSurfaceTemplate(draft.template,grid,body);
 if(!['all','selected','unset'].includes(scope)||!['fill-unset','overwrite'].includes(policy)||!fields.length||fields.some(f=>!GENERATION_FIELDS.includes(f)))throw Error('생성 범위/필드/쓰기 정책 오류');
 if(scope==='unset'&&policy!=='fill-unset')throw Error('미설정 범위는 미설정만 채우기 정책을 사용하세요.');
 if(new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>!grid.byId.has(id)))throw Error('선택 구역 ID 오류');
 const ids=scope==='selected'?[...selectedIds]:grid.tiles.map(t=>t.id);if(!ids.length)throw Error('선택한 표면 구역이 없습니다.');const selected=new Set(ids),next=clone(template),changes=[],warnings=[...draft.warnings];let protectedValues=0;
 const before=new Map(grid.tiles.map(t=>[t.id,resolvedSurfaceCell(template,grid,body,t.id)]));
 const eligible=(id,value)=>selected.has(id)&&(policy==='overwrite'||value===null);
 const record=(id,path,previous,value)=>{if(!equal(previous,value))changes.push({id,path,previous:clone(previous),next:clone(value)});};
 const write=(id,object,key,value,path)=>{if(value===null)return;const old=object[key];if(eligible(id,old)){record(id,path,old,value);object[key]=clone(value);}else if(selected.has(id)&&old!==null)protectedValues++;};
 for(const id of ids){const previous=before.get(id),g=clone(previous.geology),s=clone(previous.scenario),generated=draft.template.geology.cells[id];next.geology.cells[id]=g;next.startingScenario.cells[id]=s;
  if(fields.includes('terrain')){write(id,g.terrain,'terrainType',generated.terrain.terrainType,'terrain.terrainType');if(g.surfaceType!=='atmosphere'){const old=[g.terrain.landFraction,g.terrain.waterFraction],value=[generated.terrain.landFraction,generated.terrain.waterFraction];if(policy==='overwrite'||old.every(v=>v===null)){record(id,'terrain.landWaterPair',old,value);[g.terrain.landFraction,g.terrain.waterFraction]=value;}else protectedValues++;}}
  if(fields.includes('environment'))for(const key of Object.keys(g.environment))write(id,g.environment,key,generated.environment[key],'environment.'+key);
  if(fields.includes('population')&&draft.scenario.populationTotalPersons!==null&&draft.scenario.civilizationId!==undefined)write(id,s,'civilizationId',draft.scenario.civilizationId,'scenario.civilizationId');
 }
 // Budgets always refer to the WHOLE planet. Outside/protected cells consume the target first.
 if(fields.includes('deposits')){
  const available=ids.filter(id=>eligible(id,before.get(id).geology.deposits));
  for(const id of ids)if(!available.includes(id)&&before.get(id).geology.deposits!==null)protectedValues++;
  const budgets=Object.entries(draft.resourceBudgetsU).filter(([,v])=>v!==null);
  if(budgets.length){const generated=new Map(available.map(id=>[id,[]]));for(const [resourceId,target]of budgets){let fixed=0;for(const t of grid.tiles)if(!generated.has(t.id))for(const d of before.get(t.id).geology.deposits??[])if(d.resourceId===resourceId)fixed+=resourceQuanta(d.initialReserveU);
    const remainder=resourceQuanta(target)-fixed;if(remainder<0)throw Error(resourceId+': 보존할 기존 매장량이 행성 전체 목표를 초과합니다.');
    const shares=allocateInteger(remainder,available.map(id=>({id,weight:draft.weights.resources[resourceId][id]})));for(const id of available)if(shares.get(id)>0)generated.get(id).push(generatedDeposit(draft,grid.byId.get(id),resourceId,shares.get(id)));
   }
   for(const [id,deposits]of generated){const old=before.get(id).geology.deposits;
    // Unrequested resource species are never erased by a requested budget replacement.
    const untouched=(old??[]).filter(d=>!budgets.some(([r])=>r===d.resourceId));const value=[...untouched,...deposits];record(id,'deposits',old,value);next.geology.cells[id].deposits=value;}
  }
 }
 if(fields.includes('population')&&draft.scenario.populationTotalPersons!==null){const total=populationTarget(draft.scenario.populationTotalPersons),available=ids.filter(id=>eligible(id,before.get(id).scenario.populationPersons)),fixed=grid.tiles.filter(t=>!available.includes(t.id)).reduce((n,t)=>n+(before.get(t.id).scenario.populationPersons??0),0);
  if(fixed>total)throw Error('보존할 기존 인구가 행성 전체 인구 목표를 초과합니다.');const shares=allocateInteger(total-fixed,available.map(id=>({id,weight:draft.weights.population[id]})));
  for(const id of ids){if(!available.includes(id)){protectedValues++;continue;}const value=shares.get(id);record(id,'scenario.populationPersons',before.get(id).scenario.populationPersons,value);next.startingScenario.cells[id].populationPersons=value;}
 }
 if(fields.includes('urbanization')){const proposed=clone(next);applyUrbanization(proposed,draft,ids);for(const id of ids)for(const key of ['urbanizationRate','infrastructureLevel'])write(id,next.startingScenario.cells[id],key,proposed.startingScenario.cells[id][key],'scenario.'+key);}
 validateSurfaceTemplate(next,grid,body);
 // Do not materialize untouched sparse cells just because they were previewed.
 for(const id of ids){if(!template.geology.cells[id]&&equal(next.geology.cells[id],before.get(id).geology))delete next.geology.cells[id];if(!template.startingScenario.cells[id]&&equal(next.startingScenario.cells[id],before.get(id).scenario))delete next.startingScenario.cells[id];}
 const summary=summarizeSurfaceData(next,grid,body),changedCells=new Set(changes.map(c=>c.id)).size;
 for(const [r,target]of Object.entries(draft.resourceBudgetsU))if(fields.includes('deposits')&&target!==null&&summary.resourceQuantaTotals[r]!==resourceQuanta(target)&&!(target===0&&!summary.resourceQuantaTotals[r]))throw Error('자원 전체 예산 검증 실패: '+r);
 if(fields.includes('population')&&draft.scenario.populationTotalPersons!==null&&summary.populationPersons!==draft.scenario.populationTotalPersons)throw Error('인구 전체 합계 검증 실패');
 if(ids.length<grid.cellCount)warnings.push('선택 범위 밖의 고정값을 뺀 행성 전체 목표의 잔여량만 배분합니다. 범위 밖 미설정 값은 유지합니다.');
 if(policy==='overwrite')warnings.push('덮어쓰기: 확인 후 현재 템플릿 전체를 백업합니다. 지식 참조가 깨지는 교체는 거부합니다.');
 return {nextTemplate:next,baseJSON:JSON.stringify(template),changes,changedCells,changedFields:changes.length,protectedValues,targetCellCount:ids.length,summary,warnings,policy,source:draft.source,settings:{seed:draft.seed,profileId:draft.profileId,generatorVersion:draft.generatorVersion,scope,selectedIds:[...selectedIds],fields:[...fields],policy,resourceBudgetsU:clone(draft.resourceBudgetsU),scenario:clone(draft.scenario)}};
}
