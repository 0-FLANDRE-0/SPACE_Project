// The only bridge between legacy inventory fields and the generic package book.
// No game recipe prices or power supply are invented here.
import {containerQuantityQ,containerGroups} from './container-state.js';
import {quoteContainerPlan} from './cargo-scu.js';
import {quoteContainerPack,commitContainerPack,consumeContainerResource,unpackContainerResource} from './container-inventory.js';
import {advanceContainerQueue,planContainerModernization} from './container-automation.js';
import {DEFAULT_PACKAGE_REGISTRY,scaledDecimal} from './packaging-specs.js';
import {createPackagingState,openPackagingAccount,packagingAccount,packagingAccountKey,packagedQuantityQ,quoteIncomingPackage,commitPack,consumePackagedResource,fundPackagingAccount,consumeFreeResource,transferPackagedResource,atomicPackagingChange} from './packaging-inventory.js';
import {advancePackagingQueue,planAutomaticPackaging} from './packaging-automation.js';
export const industryPackageRegistry=catalog=>catalog?.packageRegistry??DEFAULT_PACKAGE_REGISTRY;
export function attachIndustryPackageAccount(s,bodyId,ownerId,registry=DEFAULT_PACKAGE_REGISTRY){
 if(!s.packaging)throw Error('산업 포장 스키마 이관 필요');const inv=s.planetInventory[bodyId][ownerId],ctx={bodyId,ownerId},key=packagingAccountKey(ctx);
 if(!s.packaging.accounts[key])openPackagingAccount(s.packaging,ctx,{freeQ:{alloy:inv.alloy,residue:inv.residue,...inv.resourcesQ}},registry);
 return packagingAccount(s.packaging,ctx);
}
export function syncIndustryPackageView(s,ctx){const inv=s.planetInventory[ctx.bodyId][ctx.ownerId],a=packagingAccount(s.packaging,ctx);inv.alloy=(a.freeQ.alloy??0)+containerQuantityQ(a,'alloy');inv.residue=(a.freeQ.residue??0)+containerQuantityQ(a,'residue');inv.hydrogen=packagedQuantityQ(a,'hydrogen');inv.resourcesQ={};for(const [id,n]of Object.entries(a.freeQ))if(!['alloy','residue','hydrogen'].includes(id))inv.resourcesQ[id]=n;for(const g of [...Object.values(a.groups),...a.automation.jobs.filter(j=>j.status==='reserved').flatMap(j=>j.escrow)])if(g.resourceId!=='hydrogen')inv.resourcesQ[g.resourceId]=(inv.resourcesQ[g.resourceId]??0)+g.amountQ;for(const g of containerGroups(a))if(!['hydrogen','alloy','residue'].includes(g.resourceId))inv.resourcesQ[g.resourceId]=(inv.resourcesQ[g.resourceId]??0)+g.fillQ*g.count;for(const [id,q]of Object.entries(a.scu.openedQ))if(!['hydrogen','alloy','residue'].includes(id))inv.resourcesQ[id]=(inv.resourcesQ[id]??0)+q;return inv;}
export function produceIndustryPackaged(s,catalog,ctx,resourceId,amountQ,{source='industry-source',legacy=false}={}){
 if(!amountQ)return {allowed:true,amountQ:0};const registry=industryPackageRegistry(catalog),spec=legacy?[...registry.specs.values()].find(s=>s.resourceId===resourceId&&s.compatibility):registry.latest(resourceId,ctx.ownerId,catalog?.availablePackageSpecs);
 if(!spec)return {allowed:false,reason:'승인 포장 규격 미결정'};
 if(spec.materialInputs.some(m=>m.resourceId==='ore'))return {allowed:false,reason:'광석 품질 lot을 보존하는 포장 소재 어댑터 미연결'};
 const quote=quoteIncomingPackage(s.packaging,registry,{...ctx,resourceId,amountQ,packageSpecId:spec.id,source,availablePackageSpecs:catalog?.availablePackageSpecs});
 if(!quote.allowed)return quote;const result=commitPack(s.packaging,quote);syncIndustryPackageView(s,ctx);return {allowed:true,...result};
}
export function consumeIndustryPackaged(s,catalog,ctx,resourceId,amountQ,reason){if(!amountQ)return {amountQ:0,returnedQ:{}};const registry=industryPackageRegistry(catalog),a=packagingAccount(s.packaging,ctx),legacy=Object.values(a.groups).filter(g=>g.resourceId===resourceId).reduce((n,g)=>n+g.amountQ,0);let result;if(legacy>=amountQ)result=consumePackagedResource(s.packaging,registry,{...ctx,resourceId,amountQ,reason});else result=atomicPackagingChange(s.packaging,registry,w=>{if(legacy)consumePackagedResource(w,registry,{...ctx,resourceId,amountQ:legacy,reason});return consumeContainerResource(w,registry,{...ctx,resourceId,amountQ:amountQ-legacy,reason});});syncIndustryPackageView(s,ctx);return result;}
export function availableIndustryPackagedQ(s,ctx,resourceId){return packagedQuantityQ(packagingAccount(s.packaging,ctx),resourceId,{includeReserved:false});}
export function produceIndustryBulk(s,catalog,ctx,resourceId,amountQ,{source='industry-output'}={}){if(!amountQ)return;fundPackagingAccount(s.packaging,industryPackageRegistry(catalog),{...ctx,resourceId,amountQ,source});syncIndustryPackageView(s,ctx);}
export function consumeIndustryBulk(s,catalog,ctx,resourceId,amountQ,reason){if(!amountQ)return;consumeFreeResource(s.packaging,industryPackageRegistry(catalog),{...ctx,resourceId,amountQ,reason});syncIndustryPackageView(s,ctx);}
export function transferIndustryPackage(s,catalog,{from,to,resourceId,amountQ}){const result=transferPackagedResource(s.packaging,industryPackageRegistry(catalog),{from,to,resourceId,amountQ});syncIndustryPackageView(s,from);syncIndustryPackageView(s,to);return result;}
export function fundIndustryPackaging(s,catalog,ctx,{creditC=0,energyWh=0}){
 const micros=scaledDecimal(creditC,1000000,'행성 포장 예산 C'),cash=s.governmentTreasuries[ctx.ownerId];if(micros&&(!Number.isFinite(cash)||Math.round(cash*1000000)<micros))throw Error('명시적 포장 예산 이체의 국고 부족');
 fundPackagingAccount(s.packaging,industryPackageRegistry(catalog),{...ctx,creditsMicroC:micros,energyWh,source:'explicit-planet-packaging-budget'});if(micros)s.governmentTreasuries[ctx.ownerId]=(Math.round(cash*1000000)-micros)/1000000;
}
export function advanceIndustryPackaging(s,catalog,tick){const registry=industryPackageRegistry(catalog);for(const old of Object.values(s.packaging.accounts)){const ctx={bodyId:old.bodyId,ownerId:old.ownerId};if(old.automation.capacityQPerHour>0){advancePackagingQueue(s.packaging,registry,ctx,tick*3600000);const a=packagingAccount(s.packaging,ctx);planAutomaticPackaging(s.packaging,registry,ctx,{availablePackageSpecs:catalog.availablePackageSpecs,chunkQ:a.automation.batchQ??null});}if(old.scu.automation.capacitySCUPerHour>0){advanceContainerQueue(s.packaging,registry,ctx,tick*3600000);planContainerModernization(s.packaging,registry,ctx,{availableContainerSpecs:catalog.availableContainerSpecs});}syncIndustryPackageView(s,ctx);}}
export function initializePackagingFromV1(s,catalog){
 s.packaging=createPackagingState();for(const [bodyId,owners]of Object.entries(s.planetInventory))for(const [ownerId,inv]of Object.entries(owners)){const hydrogen=inv.hydrogen;inv.resourcesQ={};attachIndustryPackageAccount(s,bodyId,ownerId,industryPackageRegistry(catalog));if(hydrogen){const result=produceIndustryPackaged(s,catalog,{bodyId,ownerId},'hydrogen',hydrogen,{source:'industry-migration',legacy:true});if(!result.allowed)throw Error(result.reason);}syncIndustryPackageView(s,{bodyId,ownerId});}
 return s;
}

// Preparation only; these APIs do not dispatch/deliver a shipment.
const industryContainerQuotes=new WeakMap();
export function quoteIndustryCargoSCU(catalog,{bodyId,resourceId,amountQ,ownerId='human',...options}){
 if(!catalog.bodies.has(bodyId))throw Error('등록되지 않은 산업 천체');const registry=industryPackageRegistry(catalog);return quoteContainerPlan(resourceId,amountQ,registry,{ownerId,availableContainerSpecs:catalog.availableContainerSpecs,...options});
}
export function quoteIndustryContainerPack(s,catalog,request){
 const registry=industryPackageRegistry(catalog),physical=quoteIndustryCargoSCU(catalog,request);
 if(request.resourceId==='ore'||physical.groups.some(g=>registry.containers.recipe(g.containerSpecId,g.resourceId).materialInputs.some(m=>m.resourceId==='ore')))return {...physical,allowed:false,status:'blocked-ore-lot-adapter',reason:'광석 출처/품질 lot 운송 포장 어댑터 미연결'};
 const quote=quoteContainerPack(s.packaging,registry,{...request,ownerId:request.ownerId??'human',availableContainerSpecs:catalog.availableContainerSpecs,...(request.availableContainerSpecs?{availableContainerSpecs:request.availableContainerSpecs}:{})});industryContainerQuotes.set(quote,{catalog,bodyId:request.bodyId,ownerId:request.ownerId??'human'});return quote;
}
export function commitIndustryContainerPack(s,catalog,ctx,quote){const origin=industryContainerQuotes.get(quote);if(!origin||origin.catalog!==catalog||origin.bodyId!==ctx.bodyId||origin.ownerId!==ctx.ownerId)throw Error('산업 견적 천체/소유자/카탈로그 불일치');const result=commitContainerPack(s.packaging,quote);syncIndustryPackageView(s,ctx);return result;}
export function unpackIndustryContainer(s,catalog,request){const result=unpackContainerResource(s.packaging,industryPackageRegistry(catalog),request);syncIndustryPackageView(s,request);return result;}
