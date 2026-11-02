// ECON-SIM-4 only. Never registers or changes a game resource/recipe.
import {RESOURCE_DEFINITIONS,ResourceRegistry} from './resource-definitions.js';
import {ContainerRegistry} from './container-specs.js';
import {quoteContainerPlan} from './cargo-scu.js';
import {account,quantize as q} from './economy-energy-ledger.js';

export const ROUND4_RESOURCES=new ResourceRegistry();
for(const d of RESOURCE_DEFINITIONS.values())ROUND4_RESOURCES.register({...d});
for(const d of [
 {id:'water',name:'실험용 물',contentMassKgPerU:4500,cargoSCUPerU:4,storageMode:'bulk',requiresPackage:false},
 {id:'oxygen',name:'실험용 액체 산소',contentMassKgPerU:4000,cargoSCUPerU:4,storageMode:'packaged',requiresPackage:true,containmentType:'cryogenic'}
])ROUND4_RESOURCES.register({unit:'U',naturalDeposit:false,category:'simulator-fluid',...d});
export const ROUND4_PACK_REGISTRY={resources:ROUND4_RESOURCES,containers:new ContainerRegistry(ROUND4_RESOURCES)};
const cache=new Map();
export function physicalPackage(resourceId,amountQ){
 const key=resourceId+':'+amountQ;let plan=cache.get(key);
 if(!plan){plan=quoteContainerPlan(resourceId,amountQ,ROUND4_PACK_REGISTRY);if(cache.size>2048)cache.clear();cache.set(key,plan);}return plan;
}
export function packagingCost(resourceId,amountQ,r){
 if(!Number.isFinite(r.packCPerSCU)||!Number.isFinite(r.packKWhPerSCU)||!(r.packCPerSCU>0&&r.packKWhPerSCU>0))throw Error('Packaging costs must be explicit positive experiment inputs');
 const physical=physicalPackage(resourceId,amountQ);
 return {physical,creditC:physical.occupiedSCU*r.packCPerSCU,energyGWh:physical.occupiedSCU*r.packKWhPerSCU/1e6,alloyQ:physical.materialQ.alloy};
}
export function unitConversion(e){
 const oldKgPerU=10000,h=ROUND4_RESOURCES.get('hydrogen').contentMassKgPerU,w=ROUND4_RESOURCES.get('water').contentMassKgPerU;
 return {hydrogenMassRatio:oldKgPerU/h,hydrogenModuleU:e.hydrogenModuleU*oldKgPerU/h,electrolysisGWhPerU:e.electrolysisGWhPerU*h/oldKgPerU,waterIntakeU:e.waterIntakeU*oldKgPerU/w,waterTankU:e.waterTankU*oldKgPerU/w,oldHydrogenKgMonth:e.hydrogenModuleU*oldKgPerU};
}
export function hydrogenCost(p,e,r,{planet='earth',utilization=1,marketPrice=r.hydrogenPrice,packaged=true}={}){
 const h=ROUND4_RESOURCES.get('hydrogen').contentMassKgPerU,o=ROUND4_RESOURCES.get('oxygen').contentMassKgPerU,capacity=e.hydrogenModuleU*utilization;
 if(!(capacity>0))return {totalCPerU:null,marginCPerU:null,capacityU:0};
 const powerPrice=e.electricityGDPShare*p.bodies.earth.annualGDP/(e.earthBaseGW*8760),pack=packagingCost('hydrogen',q(capacity),r),lossScale=1/(1-r.boiloffMonthly);
 const components={electrolysisCPerU:r.electrolysisKWhKg*h/1e6*powerPrice,liquefactionCPerU:r.hydrogenLiquefactionKWhKg*h/1e6*powerPrice,oxygenLiquefactionCPerU:r.oxygenStored?r.oxygenLiquefactionKWhKg*o/1e6*powerPrice:0,storageElectricityCPerU:r.hydrogenStorageKWhKgMonth*h/1e6*powerPrice,
  equipmentRecoveryCPerU:(e.hydrogenModuleC+e.hydrogenModuleAlloyU*p.baseAlloyPrice)/(p.privateAmortizationYears*12*capacity),directCPerU:e.hydrogenModuleC*e.directAnnual/(12*capacity)+e.hydrogenVariableCPerU,
  upkeepCPerU:e.hydrogenModuleAlloyU*r['upkeep_'+planet]*p.baseAlloyPrice/(12*capacity),packDirectCPerU:packaged?pack.creditC/capacity:0,packElectricityCPerU:packaged?pack.energyGWh*powerPrice/capacity:0,
  packMaterialLossCPerU:packaged?(pack.alloyQ-(pack.physical.expectedRecoveryQ.alloy??0))/1000*p.baseAlloyPrice/capacity:0};
 const subtotal=Object.values(components).reduce((a,b)=>a+b,0);components.storageLossCPerU=subtotal*(lossScale-1);
 const total=Object.values(components).reduce((a,b)=>a+b,0);
 return {...components,totalCPerU:total,marginCPerU:marketPrice-total,capacityU:capacity,powerPriceCPerGWh:powerPrice,electrolysisMWhPerU:r.electrolysisKWhKg*h/1000,liquefactionMWhPerU:r.hydrogenLiquefactionKWhKg*h/1000,oxygenLiquefactionMWhPerU:r.oxygenLiquefactionKWhKg*o/1000,packagingBoundary:packaged?'SCU batch opened at recipient; net material loss included':'local connected tank/pipeline; no SCU shell',oxygenRevenueC:0};
}

// Immediate/unlimited transport is an experiment assumption. This is a closed
// simulator ledger operation, never the live game's delivery API.
export function transferRound4(book,request,r,{powerBudget,priceIndex=1,recovery={},trace=[]}={}){
 const {from,to,resourceId,amountQ,marketPriceC=0}=request;
 if(!['government','private'].includes(from?.owner)||!['government','private'].includes(to?.owner)||!Number.isFinite(priceIndex)||priceIndex<=0||!Number.isFinite(r.freightCPerSCU)||r.freightCPerSCU<0)throw Error('Shipment actor/price/freight');
 if(from.planet===to.planet||!Number.isSafeInteger(amountQ)||amountQ<=0)throw Error('Cross-body positive integer shipment required');
 if(!powerBudget||!Number.isFinite(powerBudget.remainingGWh)||powerBudget.remainingGWh<0)throw Error('Real grid packaging energy budget required');
 const fromEntity=from.ownerId??(from.owner==='government'?'human-government':from.planet+'/private-sector'),toEntity=to.ownerId??(to.owner==='government'?'human-government':to.planet+'/private-sector'),pack=packagingCost(resourceId,amountQ,r),changedOwner=fromEntity!==toEntity;
 if(changedOwner&&!(marketPriceC>0))throw Error('Ownership change requires an explicit market price');
 const freightC=pack.physical.occupiedSCU*r.freightCPerSCU,servicesQ=q((pack.creditC+freightC)*priceIndex),saleQ=changedOwner?Math.round(amountQ*marketPriceC*priceIndex):0;
 const src=account(from.planet,from.owner,resourceId),dst=account(to.planet,to.owner,resourceId),alloy=account(from.planet,from.owner,'alloy'),cash=account(from.planet,from.owner),buyer=account(to.planet,to.owner);
 // Content and shell both use alloy when resourceId is alloy.
 const neededAlloy=pack.alloyQ+(resourceId==='alloy'?amountQ:0),cashAvailable=book.get(cash)+(changedOwner?saleQ:0);
 if(book.get(src)<amountQ||book.get(alloy)<neededAlloy||cashAvailable<servicesQ||changedOwner&&book.get(buyer)<saleQ||powerBudget.remainingGWh+1e-12<pack.energyGWh)throw Error('Shipment stock/cash/packaging/power unavailable');
 // Every precondition above precedes any write. The standard physical plan's
 // pending game prices stay null; this experiment explicitly prices occupied SCU.
 if(changedOwner)book.move(buyer,cash,saleQ,'cross-owner-goods:C');
 const packed=account(from.planet,from.owner,'containerAlloy');book.ensure(packed);book.move(alloy,packed,pack.alloyQ,'SCU-shell-bond');book.move(src,dst,amountQ,'SCU-content-transfer');
 let returnedQ=0,lostQ=0;
 for(const g of pack.physical.groups){const recipe=ROUND4_PACK_REGISTRY.containers.recipe(g.containerSpecId,resourceId),m=recipe.materialInputs.find(x=>x.resourceId==='alloy'),key=to.planet+'/'+to.owner+'/'+g.containerSpecId,prior=recovery[key]??0,n=m.amountQ*g.count,numerator=BigInt(n)*BigInt(m.recoveryParts)+BigInt(prior),back=Number(numerator/1000000n);recovery[key]=Number(numerator%1000000n);returnedQ+=back;lostQ+=n-back;}
 if(returnedQ)book.move(packed,account(to.planet,to.owner,'alloy'),returnedQ,'SCU-shell-recovered');if(lostQ)book.sink(packed,lostQ,'SCU-shell-loss');
 if(servicesQ)book.move(cash,account(from.planet,'household'),servicesQ,'SCU-packaging-and-freight:C');
 powerBudget.remainingGWh=Math.max(0,powerBudget.remainingGWh-pack.energyGWh);powerBudget.usedGWh=(powerBudget.usedGWh??0)+pack.energyGWh;
 const record={...request,fromEntity,toEntity,changedOwner,occupiedSCU:pack.physical.occupiedSCU,requiredSCU:pack.physical.requiredSCU,containerCount:pack.physical.containerCount,alloyBondedQ:pack.alloyQ,returnedQ,lostQ,servicesC:servicesQ/1000,packDirectC:pack.creditC*priceIndex,freightC:freightC*priceIndex,goodsPaymentC:saleQ/1000,energyGWh:pack.energyGWh};trace.push(record);return record;
}
