import { RESOURCE_DEFINITIONS, MAX_RESOURCE_U, MAX_POPULATION_PERSONS } from './resource-definitions.js';
export const SURFACE_SCHEMA_VERSION=1;
export const TERRAIN_TYPES=Object.freeze({land:'육상',ocean:'해양',mixed:'혼합',ice:'얼음',desert:'사막',mountain:'산악','vacuum-rock':'진공 암석','gas-atmosphere':'가스 대기'});
export const clone=value=>structuredClone(value);
const ensure=(condition,message)=>{if(!condition)throw Error(message);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function keys(object,allowed,label){ensure(plain(object),label+'는 객체여야 합니다.');for(const key of Object.keys(object))ensure(allowed.includes(key),label+'의 알 수 없는 필드: '+key);}
function numeric(value,min,max,label,integer=false){ensure(value===null||(typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max&&(!integer||Number.isSafeInteger(value))),label+`는 미설정(null) 또는 ${min}–${max}${integer?' 정수':''}여야 합니다.`);}
function text(value,label,max=1000){ensure(value===null||(typeof value==='string'&&value.length<=max),label+' 문자열이 올바르지 않습니다.');}
function identifier(value,label){ensure(value===null||(typeof value==='string'&&/^[a-zA-Z0-9_:.-]{1,100}$/.test(value)),label+' ID가 올바르지 않습니다.');}
export const surfaceTypeFor=body=>body.surfaceType??(/가스|거대|giant/i.test(body.type??'')?'atmosphere':'solid');
export function defaultGeology(body){return {surfaceType:surfaceTypeFor(body),terrain:{terrainType:null,landFraction:null,waterFraction:null},environment:{temperatureK:null,radiationLevel:null,terrainObstacle:null,habitability:null,atmosphereNotes:null},deposits:null};}
export function defaultStartingCell(){return {populationPersons:null,urbanizationRate:null,infrastructureLevel:null,civilizationId:null,ownerFactionId:null,controllerFactionId:null,knowledge:null,facilities:null};}
export function gridDefinition(grid){return {type:grid.type,generatorVersion:grid.generatorVersion,frequency:grid.frequency,orientationId:grid.orientationId,cellCount:grid.cellCount,gridFingerprint:grid.gridFingerprint};}
export function createSurfaceTemplate(grid,body){return {schemaVersion:SURFACE_SCHEMA_VERSION,kind:'planet-surface-template',systemId:grid.systemId,bodyId:grid.bodyId,bodyKind:grid.bodyKind,grid:gridDefinition(grid),geology:{cells:{}},startingScenario:{year:2100,civilizationId:body.surfaceScenarioMetadata?.civilizationId??null,role:body.surfaceScenarioMetadata?.role??null,cells:{}}};}
export function resolvedSurfaceCell(template,grid,body,id){ensure(grid.byId.has(id),'존재하지 않는 표면 셀입니다.');return {geography:grid.byId.get(id),geology:clone(template.geology.cells[id]??defaultGeology(body)),scenario:clone(template.startingScenario.cells[id]??defaultStartingCell())};}
function validateGeology(g,body,depositIds){
 keys(g,['surfaceType','terrain','environment','deposits'],'지질');ensure(['solid','liquid','atmosphere'].includes(g.surfaceType),'표면 유형이 올바르지 않습니다.');if(surfaceTypeFor(body)==='atmosphere')ensure(g.surfaceType==='atmosphere','가스/얼음 거대행성은 대기 기준 레이어를 사용합니다.');
 keys(g.terrain,['terrainType','landFraction','waterFraction'],'지형');ensure(g.terrain.terrainType===null||Object.hasOwn(TERRAIN_TYPES,g.terrain.terrainType),'등록되지 않은 지형 유형입니다.');const {landFraction:land,waterFraction:water}=g.terrain;numeric(land,0,1,'육지 비율');numeric(water,0,1,'물 비율');
 if(g.surfaceType==='atmosphere')ensure(land===null&&water===null,'대기 구역의 육지/물 비율은 null이어야 합니다.');else ensure((land===null&&water===null)||(land!==null&&water!==null&&Math.abs(land+water-1)<1e-9),'육지와 물 비율을 함께 입력하고 합계 1로 맞추세요.');
 keys(g.environment,['temperatureK','radiationLevel','terrainObstacle','habitability','atmosphereNotes'],'환경');numeric(g.environment.temperatureK,0,100000,'온도 K');numeric(g.environment.radiationLevel,0,1e9,'방사선');numeric(g.environment.terrainObstacle,0,1,'지형 장애');numeric(g.environment.habitability,0,1,'거주 적합성');text(g.environment.atmosphereNotes,'대기 메모');
 ensure(g.deposits===null||(Array.isArray(g.deposits)&&g.deposits.length<=64),'매장지는 null 또는 최대 64개 배열입니다.');
 for(const d of g.deposits??[]){keys(d,['depositId','resourceId','initialReserveU','extractionDifficulty','discoveryTier','notes'],'매장지');identifier(d.depositId,'매장지');ensure(d.depositId&&!depositIds.has(d.depositId),'매장지 ID가 없거나 천체 안에서 중복됩니다.');depositIds.add(d.depositId);const resource=RESOURCE_DEFINITIONS.get(d.resourceId);ensure(resource?.naturalDeposit===true&&resource.unit==='U','등록된 자연 매장 자원만 가능합니다 (alloy/크레딧 금지).');numeric(d.initialReserveU,0,MAX_RESOURCE_U,'원래 매장량 U');ensure(d.initialReserveU!==null,'매장량을 입력하세요. 미확정 매장지는 만들지 않습니다.');numeric(d.extractionDifficulty??null,0,100,'채굴 난도');numeric(d.discoveryTier??null,0,5,'발견 단계',true);text(d.notes??null,'매장 메모');}
}
function validateStarting(s,geology){
 keys(s,['populationPersons','urbanizationRate','infrastructureLevel','civilizationId','ownerFactionId','controllerFactionId','knowledge','facilities'],'초기 시나리오 셀');numeric(s.populationPersons,0,MAX_POPULATION_PERSONS,'인구',true);numeric(s.urbanizationRate,0,1,'도시화율');numeric(s.infrastructureLevel,0,5,'기반시설',true);for(const k of ['civilizationId','ownerFactionId','controllerFactionId'])identifier(s[k],k);
 ensure(s.knowledge===null||(Array.isArray(s.knowledge)&&s.knowledge.length<=64),'초기 지식은 null 또는 문명별 배열입니다.');const civs=new Set();
 for(const k of s.knowledge??[]){keys(k,['civilizationId','basicSurveyProgress','detailedSurveyProgress','discoveredDepositIds'],'문명별 지식');identifier(k.civilizationId,'지식 문명');ensure(k.civilizationId&&!civs.has(k.civilizationId),'지식 문명은 중복되지 않아야 합니다.');civs.add(k.civilizationId);numeric(k.basicSurveyProgress,0,1,'기초 조사');numeric(k.detailedSurveyProgress,0,1,'정밀 조사');ensure(Array.isArray(k.discoveredDepositIds)&&new Set(k.discoveredDepositIds).size===k.discoveredDepositIds.length,'발견 매장지 목록이 잘못되었습니다.');for(const id of k.discoveredDepositIds)ensure((geology.deposits??[]).some(d=>d.depositId===id),'발견 기록이 없는 매장지를 참조합니다.');}
 ensure(s.facilities===null||(Array.isArray(s.facilities)&&s.facilities.length<=128),'시설 메타데이터는 null 또는 배열입니다.');const facilities=new Set();for(const f of s.facilities??[]){keys(f,['id','typeId','notes'],'시설 메타데이터');identifier(f.id,'시설');identifier(f.typeId,'시설 종류');ensure(f.id&&f.typeId&&!facilities.has(f.id),'시설 ID/종류를 지정하고 중복을 제거하세요.');facilities.add(f.id);text(f.notes??null,'시설 메모');}
}
export function validateSurfaceTemplate(data,grid,body){
 keys(data,['schemaVersion','kind','systemId','bodyId','bodyKind','grid','geology','startingScenario'],'표면 파일');ensure(data.schemaVersion===SURFACE_SCHEMA_VERSION&&data.kind==='planet-surface-template','지원하지 않는 표면 스키마/종류입니다.');ensure(data.systemId===grid.systemId&&data.bodyId===grid.bodyId&&data.bodyKind===body.kind,'다른 항성계/천체의 파일입니다.');
 keys(data.grid,Object.keys(gridDefinition(grid)),'격자');for(const [key,value]of Object.entries(gridDefinition(grid)))ensure(data.grid[key]===value,'격자 정의 불일치: '+key+' (마이그레이션 없이 적용할 수 없습니다).');
 keys(data.geology,['cells'],'지질');keys(data.startingScenario,['year','civilizationId','role','cells'],'시작 시나리오');ensure(data.startingScenario.year===2100,'시작 시나리오 연도는 2100 메타데이터입니다. 천문 epoch는 변경하지 않습니다.');identifier(data.startingScenario.civilizationId,'시나리오 문명');text(data.startingScenario.role,'시나리오 역할',100);
 for(const cells of [data.geology.cells,data.startingScenario.cells]){ensure(plain(cells)&&Object.keys(cells).length<=grid.cellCount,'셀 데이터가 올바르지 않습니다.');for(const id of Object.keys(cells))ensure(grid.byId.has(id),'존재하지 않는 표면 셀: '+id);}
 const depositIds=new Set();for(const g of Object.values(data.geology.cells))validateGeology(g,body,depositIds);
 for(const [id,s]of Object.entries(data.startingScenario.cells))validateStarting(s,data.geology.cells[id]??defaultGeology(body));
 return true;
}
export function summarizePopulation(template){const values=Object.values(template.startingScenario.cells).map(s=>s.populationPersons).filter(v=>v!==null);return {configuredCells:values.length,configuredPopulationPersons:values.reduce((a,b)=>a+b,0),complete:values.length===template.grid.cellCount};}
