import {bindIndustryPackagingClock} from './packaging-clock.js';
import { IndustryCatalog, templateSignature } from './industry-runtime.js';
import { validateIndustryState } from './industry-storage.js';
import { validateSurfaceTemplate } from './planetary-surface-model.js';
import { planEarthPopulation, assertPopulationOnlyChange, writePreservedBackup } from './earth-population-update.js';
// Explicitly confirmed two-key transaction. All validation precedes writes;
// preserved backups and compensating writes keep a failed operation recoverable.
export function applyLocalEarthPopulation({entry,industry,populationPackage,storage}){
 if(!storage||industry.store.blocked)throw Error('유효한 산업 저장과 원본 백업 저장소가 필요합니다.');
 const before=entry.template,next=planEarthPopulation(before,populationPackage),oldCatalog=industry.catalog,oldState=industry.store.state;
 if(templateSignature(before)!==oldCatalog.bodies.get('earth')?.signature||oldState.sourceSignatures.earth!==templateSignature(before))throw Error('표면 초안과 산업 원본이 다릅니다. 적용하지 않고 보존합니다.');
 validateSurfaceTemplate(next,entry.grid,entry.body);assertPopulationOnlyChange(before,next,populationPackage);
 const catalog=new IndustryCatalog(oldCatalog.systemId,{packageRegistry:oldCatalog.packageRegistry,availablePackageSpecs:oldCatalog.availablePackageSpecs,availableContainerSpecs:oldCatalog.availableContainerSpecs});for(const [id,b]of oldCatalog.bodies)catalog.register({...b,template:id==='earth'?next:b.template});
 const state=structuredClone(oldState);state.sourceSignatures.earth=catalog.bodies.get('earth').signature;validateIndustryState(state,catalog);
 const surfaceKey=entry.key,industryKey=industry.store.key,beforeSurfaceRaw=storage.getItem(surfaceKey),beforeIndustryRaw=storage.getItem(industryKey),suffix=':population-e1:'+templateSignature(before)+':backup';
 writePreservedBackup(storage,surfaceKey+suffix,beforeSurfaceRaw??JSON.stringify(before));writePreservedBackup(storage,industryKey+suffix,beforeIndustryRaw??JSON.stringify(oldState));
 const surfaceText=JSON.stringify(next),industryText=JSON.stringify(state);let surfaceWritten=false,industryWritten=false;
 try{storage.setItem(surfaceKey,surfaceText);surfaceWritten=true;storage.setItem(industryKey,industryText);industryWritten=true;}
 catch(error){try{if(surfaceWritten){if(beforeSurfaceRaw===null&&storage.removeItem)storage.removeItem(surfaceKey);else storage.setItem(surfaceKey,beforeSurfaceRaw??JSON.stringify(before));}if(industryWritten){if(beforeIndustryRaw===null&&storage.removeItem)storage.removeItem(industryKey);else storage.setItem(industryKey,beforeIndustryRaw??JSON.stringify(oldState));}}catch{industry.store.blocked=true;industry.store.error='인구 업데이트 저장 복원 실패. 보존된 surface/industry 백업으로 복구하세요.';}throw error;}
 entry.template=next;entry.previous=null;entry.source='명시적으로 공식 인구만 적용한 로컬 초안';entry.blocked=false;entry.saveError=null;industry.catalog=catalog;industry.store.catalog=catalog;industry.store.state=bindIndustryPackagingClock(state);industry.store.raw=industryText;industry.store.error=null;industry.dirty=true;return {next,state,surfaceBackupKey:surfaceKey+suffix,industryBackupKey:industryKey+suffix};
}
