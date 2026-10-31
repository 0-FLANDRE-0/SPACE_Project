import {planEarthPopulation} from '../dist/src/earth-population-update.js';
import { join as joinPath } from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { createSolContext } from '../dist/src/system-context.js';
import { createPlanetarySurfaceGrid } from '../dist/src/planetary-surface-grid.js';
import { generatePlanetSurfaceDraft } from '../dist/src/planetary-data-generator.js';
import { generateBodyResources, canonicalResourceConfiguration } from '../dist/src/body-resource-generator.js';
import { migrateSurfaceV1 } from '../dist/src/planetary-resource-model.js';
import { validateSurfaceTemplate, defaultStartingCell } from '../dist/src/planetary-surface-model.js';
import { summarizeOre } from '../dist/src/resource-contract.js';
import { PROVISIONAL_SCENARIOS } from '../dist/src/body-resource-profiles.js';
const outputRoot=process.env.SOL_PRESET_OUTPUT_ROOT??'.';await fs.mkdir(joinPath(outputRoot,'dist/data/planet-surfaces'),{recursive:true});await fs.mkdir(joinPath(outputRoot,'docs/v0.5D'),{recursive:true});
const context=createSolContext(),sourceBytes=await fs.readFile('dist/data/planet-surfaces/sources/earth-urban75-v1.json'),sourceHash=crypto.createHash('sha256').update(sourceBytes).digest('hex');
if(sourceHash!=='5c9cbdffc357183cfce5414090710f65bbdb14214c146f2bafae0f848c9de6f4')throw Error('지구 사용자 원본 checksum 불일치');
const populationUpdate=JSON.parse(await fs.readFile('dist/data/planet-surfaces/earth-population-e1.json'));
const earthSource=JSON.parse(sourceBytes),templates={},report={earthSourceSha256:sourceHash,bodies:[]};
for(const body of [...context.planets,...context.moons]){
 const grid=createPlanetarySurfaceGrid('sol',body),worldSeed=`sol:${body.id}:resources:v1`,source=body.id==='earth'?structuredClone(earthSource):generatePlanetSurfaceDraft({systemId:'sol',body,grid,seed:`sol:${body.id}:baseline:v1`}).template,next=migrateSurfaceV1(source,grid,body),settings=canonicalResourceConfiguration('sol',body,worldSeed),result=generateBodyResources({systemId:'sol',body,grid,worldSeed,policy:settings.totalOreU!==undefined?'fixedBudget':'proceduralBudget',settings,landFractionsByTile:Object.fromEntries(grid.tiles.map(t=>[t.id,source.geology.cells[t.id].terrain.landFraction]))});
 for(const tile of grid.tiles){const g=next.geology.cells[tile.id];g.deposits=[...(g.deposits??[]).filter(d=>d.resourceId!=='ore'),...result.cells[tile.id]];}
 next.resourceConfiguration=result.configuration;next.hydrogenSources=result.hydrogenSources;next.migration.notes='템플릿 v2, 자원 생성기1→2 집중도/편차 보정. 기존 총량/형태/품질 타깃과 지형·시나리오 보존, 새 ore ID로 초기 인지 참조 재생성.';
 const colony=PROVISIONAL_SCENARIOS[body.id];if(colony){const center=grid.tiles.find(t=>Math.abs(t.latitudeDegrees)<15&&t.longitudeDegrees>0)??grid.tiles[0];for(const t of grid.tiles){const s=defaultStartingCell();s.populationPersons=t.id===center.id?colony.populationPersons:0;if(t.id===center.id)Object.assign(s,{civilizationId:'human',urbanizationRate:colony.urbanizationRate,infrastructureLevel:colony.infrastructureLevel});next.startingScenario.cells[t.id]=s;}next.startingScenario.role='잠정 2100 식민지: 총인구/단일 위치 조정 가능';}
 if(body.id==='earth'||colony){const records=Object.values(next.geology.cells).flatMap(g=>(g.deposits??[]).filter(d=>d.discoveryTier<=2).map(d=>({depositId:d.depositId,detectedFraction:body.id==='earth'?.9:colony.knowledgeDetected,confirmedFraction:body.id==='earth'?.7:colony.knowledgeConfirmed,gradeConfidence:body.id==='earth'?.6:.15,estimatedGradeProbabilities:null})));next.initialResourceKnowledge=[{civilizationId:'human',tiers:[{tier:0,surveyProgress:1}],deposits:records}];}
 validateSurfaceTemplate(next,grid,body);if(body.id==='earth'){if(JSON.stringify(next.startingScenario)!==JSON.stringify(earthSource.startingScenario))throw Error('지구 시작 시나리오 변경 금지');for(const t of grid.tiles){const a=structuredClone(next.geology.cells[t.id]),b=structuredClone(earthSource.geology.cells[t.id]);delete a.deposits;delete b.deposits;if(JSON.stringify(a)!==JSON.stringify(b))throw Error('지구 지형/환경 변경 금지');}}
 if(body.id==='earth')next.startingScenario=planEarthPopulation(next,populationUpdate).startingScenario;
 const path=`./data/planet-surfaces/sol-${body.id}-v2.json`;await fs.writeFile(joinPath(outputRoot,'dist',path.slice(2)),JSON.stringify(next,null,2)+'\n');templates[`sol:${body.id}`]=path;report.bodies.push({bodyId:body.id,seed:worldSeed,certainty:next.resourceConfiguration.certainty,cells:grid.cellCount,populationConfiguredCells:Object.values(next.startingScenario.cells).filter(s=>s.populationPersons!==null).length,colonyTileIds:colony?Object.entries(next.startingScenario.cells).filter(([,s])=>s.populationPersons>0).map(([id])=>id):[],populationPersons:Object.values(next.startingScenario.cells).reduce((n,s)=>n+(s.populationPersons??0),0),hydrogenSources:next.hydrogenSources.length,...summarizeOre(next)});
}
await fs.writeFile(joinPath(outputRoot,'dist/data/planet-surfaces/index.json'),JSON.stringify({schemaVersion:1,templates},null,2)+'\n');await fs.writeFile(joinPath(outputRoot,'docs/v0.5D/preset-report.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS: 19 validated Sol v2 snapshots; source SHA256 '+sourceHash);
