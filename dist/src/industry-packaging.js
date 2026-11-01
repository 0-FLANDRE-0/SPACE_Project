// The only bridge between legacy inventory fields and the generic package book.
// No game recipe prices or power supply are invented here.
import {DEFAULT_PACKAGE_REGISTRY,scaledDecimal} from './packaging-specs.js';
import {createPackagingState,openPackagingAccount,packagingAccount,packagingAccountKey,packagedQuantityQ,quoteIncomingPackage,commitPack,consumePackagedResource,fundPackagingAccount,consumeFreeResource,transferPackagedResource} from './packaging-inventory.js';
import {advancePackagingQueue,planAutomaticPackaging} from './packaging-automation.js';
export const industryPackageRegistry=catalog=>catalog?.packageRegistry??DEFAULT_PACKAGE_REGISTRY;
export function attachIndustryPackageAccount(s,bodyId,ownerId,registry=DEFAULT_PACKAGE_REGISTRY){
 if(!s.packaging)throw Error('산업 포장 스키마 이관 필요');const inv=s.planetInventory[bodyId][ownerId],ctx={bodyId,ownerId},key=packagingAccountKey(ctx);
 if(!s.packaging.accounts[key])openPackagingAccount(s.packaging,ctx,{freeQ:{alloy:inv.alloy,residue:inv.residue,...inv.resourcesQ}},registry);
 return packagingAccount(s.packaging,ctx);
}
export function syncIndustryPackageView(s,ctx){const inv=s.planetInventory[ctx.bodyId][ctx.ownerId],a=packagingAccount(s.packaging,ctx);inv.alloy=a.freeQ.alloy??0;inv.residue=a.freeQ.residue??0;inv.hydrogen=packagedQuantityQ(a,'hydrogen');inv.resourcesQ={};for(const [id,n]of Object.entries(a.freeQ))if(!['alloy','residue','hydrogen'].includes(id))inv.resourcesQ[id]=n;for(const g of [...Object.values(a.groups),...a.automation.jobs.filter(j=>j.status==='reserved').flatMap(j=>j.escrow)])if(g.resourceId!=='hydrogen')inv.resourcesQ[g.resourceId]=(inv.resourcesQ[g.resourceId]??0)+g.amountQ;return inv;}
export function produceIndustryPackaged(s,catalog,ctx,resourceId,amountQ,{source='industry-source',legacy=false}={}){
 if(!amountQ)return {allowed:true,amountQ:0};const registry=industryPackageRegistry(catalog),spec=legacy?[...registry.specs.values()].find(s=>s.resourceId===resourceId&&s.compatibility):registry.latest(resourceId,ctx.ownerId,catalog?.availablePackageSpecs);
 if(!spec)return {allowed:false,reason:'승인 포장 규격 미결정'};
 if(spec.materialInputs.some(m=>m.resourceId==='ore'))return {allowed:false,reason:'광석 품질 lot을 보존하는 포장 소재 어댑터 미연결'};
 const quote=quoteIncomingPackage(s.packaging,registry,{...ctx,resourceId,amountQ,packageSpecId:spec.id,source,availablePackageSpecs:catalog?.availablePackageSpecs});
 if(!quote.allowed)return quote;const result=commitPack(s.packaging,quote);syncIndustryPackageView(s,ctx);return {allowed:true,...result};
}
export function consumeIndustryPackaged(s,catalog,ctx,resourceId,amountQ,reason){if(!amountQ)return {amountQ:0,returnedQ:{}};const result=consumePackagedResource(s.packaging,industryPackageRegistry(catalog),{...ctx,resourceId,amountQ,reason});syncIndustryPackageView(s,ctx);return result;}
export function availableIndustryPackagedQ(s,ctx,resourceId){return packagedQuantityQ(packagingAccount(s.packaging,ctx),resourceId,{includeReserved:false});}
export function produceIndustryBulk(s,catalog,ctx,resourceId,amountQ,{source='industry-output'}={}){if(!amountQ)return;fundPackagingAccount(s.packaging,industryPackageRegistry(catalog),{...ctx,resourceId,amountQ,source});syncIndustryPackageView(s,ctx);}
export function consumeIndustryBulk(s,catalog,ctx,resourceId,amountQ,reason){if(!amountQ)return;consumeFreeResource(s.packaging,industryPackageRegistry(catalog),{...ctx,resourceId,amountQ,reason});syncIndustryPackageView(s,ctx);}
export function transferIndustryPackage(s,catalog,{from,to,resourceId,amountQ}){const result=transferPackagedResource(s.packaging,industryPackageRegistry(catalog),{from,to,resourceId,amountQ});syncIndustryPackageView(s,from);syncIndustryPackageView(s,to);return result;}
export function fundIndustryPackaging(s,catalog,ctx,{creditC=0,energyWh=0}){
 const micros=scaledDecimal(creditC,1000000,'행성 포장 예산 C'),cash=s.governmentTreasuries[ctx.ownerId];if(micros&&(!Number.isFinite(cash)||Math.round(cash*1000000)<micros))throw Error('명시적 포장 예산 이체의 국고 부족');
 fundPackagingAccount(s.packaging,industryPackageRegistry(catalog),{...ctx,creditsMicroC:micros,energyWh,source:'explicit-planet-packaging-budget'});if(micros)s.governmentTreasuries[ctx.ownerId]=(Math.round(cash*1000000)-micros)/1000000;
}
export function advanceIndustryPackaging(s,catalog,tick){const registry=industryPackageRegistry(catalog);for(const a of Object.values(s.packaging.accounts)){if(!(a.automation.capacityQPerHour>0))continue;const ctx={bodyId:a.bodyId,ownerId:a.ownerId};advancePackagingQueue(s.packaging,registry,ctx,tick*3600000);planAutomaticPackaging(s.packaging,registry,ctx,{availablePackageSpecs:catalog.availablePackageSpecs,chunkQ:a.automation.batchQ??null});syncIndustryPackageView(s,ctx);}}
export function initializePackagingFromV1(s,catalog){
 s.packaging=createPackagingState();for(const [bodyId,owners]of Object.entries(s.planetInventory))for(const [ownerId,inv]of Object.entries(owners)){const hydrogen=inv.hydrogen;inv.resourcesQ={};attachIndustryPackageAccount(s,bodyId,ownerId,industryPackageRegistry(catalog));if(hydrogen){const result=produceIndustryPackaged(s,catalog,{bodyId,ownerId},'hydrogen',hydrogen,{source:'industry-migration',legacy:true});if(!result.allowed)throw Error(result.reason);}syncIndustryPackageView(s,{bodyId,ownerId});}
 return s;
}
