import {UI1_TUNING as T} from './ui1-data.js';
import {industryOreInventory} from './industry-ore-ledger.js';
import {RESOURCE_DEFINITIONS} from './resource-definitions.js';
const q=n=>BigInt(Number.isSafeInteger(n)?n:0),sum=values=>values.reduce((n,v)=>n+BigInt(v??0),0n).toString();
export function resourceBasis(context,{followId=null,selectedId=null}={}){return[followId,selectedId].find(id=>['planet','moon'].includes(context.bodyById.get(id)?.kind))??null;}
export function populationFor(record,ownerId='human'){const cells=Object.values(record.template.startingScenario.cells),known=cells.filter(c=>Number.isFinite(c.populationPersons)&&(!c.civilizationId||c.civilizationId===ownerId));return known.length?known.reduce((n,c)=>n+c.populationPersons,0):null;}
export function comparisonLabel(roughProgress,rank){return roughProgress>0?T.comparisonLabels[rank]??null:null;}
export function resourceWarning(amountQ,deltaQ,months=T.warningMonths){if(deltaQ===null||BigInt(deltaQ)>=0n)return null;return BigInt(amountQ)<-BigInt(deltaQ)*BigInt(months)?'low':'negative';}
export function resourceSnapshot(state,catalog,{basisId=null,ownerId='human',registry=RESOURCE_DEFINITIONS}={}){
 const month=Math.floor(Math.max(0,state.settledTick-1)/720),rows=[];
 const optional=T.futureResources.filter(r=>registry.has(r.id)),strategic=[...registry.values()].filter(r=>r.unit==='U'&&(r.strategic===true||r.category==='strategic'));
 for(const [id,record]of catalog.bodies){
  const inv=state.planetInventory[id]?.[ownerId],ore=industryOreInventory(state,{bodyId:id,ownerId}),grades=Object.fromEntries(Object.entries(ore.totalQ).map(([g,n])=>[g,q(n).toString()])),amounts={ore:sum(Object.values(grades)),alloy:q(inv?.alloy).toString(),hydrogen:q(inv?.hydrogen).toString()},deltas={ore:0n,alloy:0n,hydrogen:0n};
  for(const h of state.productionHistory.filter(h=>h.month===month&&h.bodyId===id&&h.ownerId===ownerId)){deltas.ore+=q(h.oreQ)-q(h.processedQ);deltas.alloy+=q(h.alloyQ);deltas.hydrogen+=q(h.hydrogenQ)-q(h.hydrogenConsumedQ);}
  for(const r of optional){amounts[r.id]=q(inv?.resourcesQ?.[r.id]).toString();deltas[r.id]=null;}
  const strategicTypes=strategic.map(r=>({id:r.id,name:r.name,amountQ:q(inv?.resourcesQ?.[r.id]).toString()}));if(strategic.length){amounts.strategic=sum(strategicTypes.map(r=>r.amountQ));deltas.strategic=null;}
  const facilities=Object.values(state.facilityInstances).filter(f=>f.bodyId===id&&f.ownerId===ownerId),powerWarning=facilities.some(f=>/전력.*부족|정전/.test(f.stopReason??''));
  rows.push({bodyId:id,name:record.body.name,populationPersons:populationFor(record,ownerId),amounts,deltas:Object.fromEntries(Object.entries(deltas).map(([k,v])=>[k,v===null?null:v.toString()])),grades,strategicTypes,powerWarning,facilities:{active:facilities.filter(f=>['active','rampup'].includes(f.status)).length,stopped:facilities.filter(f=>f.status==='stopped').length,construction:facilities.filter(f=>f.status==='construction').length}});
 }
 const basis=rows.find(r=>r.bodyId===basisId),selected=basis?[basis]:rows,ids=['ore','alloy','hydrogen',...optional.map(r=>r.id),...(strategic.length?['strategic']:[])],resources=ids.map(id=>{const amountQ=sum(selected.map(r=>r.amounts[id])),deltaQ=selected.some(r=>r.deltas[id]===null)?null:sum(selected.map(r=>r.deltas[id]));return{id,amountQ,deltaQ,warning:resourceWarning(amountQ,deltaQ)};});
 const populations=rows.filter(r=>r.populationPersons!==null);return{basisId:basis?.bodyId??null,basisName:basis?.name??'전체',month,creditC:state.governmentTreasuries[ownerId]??null,creditDeltaC:null,populationPersons:populations.length?populations.reduce((n,r)=>n+r.populationPersons,0):null,rows,resources,powerWarning:selected.some(r=>r.powerWarning)};
}
export function panelFreeRegion({width,height,panel,top=0,bottom=height,margin=T.viewportMargin,portrait=width<=T.portraitMaxWidth&&height>width}){if(!panel)return null;return portrait?{left:margin,right:width-margin,top,bottom:Math.max(top,Math.min(bottom,panel.top-T.freeRegionGap))}:{left:Math.min(width-margin,panel.right+T.freeRegionGap),right:width-margin,top,bottom};}
export function projectionOffset(width,height,region){if(!region)return{x:0,y:0};return{x:width/2-(region.left+region.right)/2,y:height/2-(region.top+region.bottom)/2};}
export function easeProjection(current,target,seconds,tau=T.projectionEaseSeconds){const f=1-Math.exp(-Math.max(0,seconds)/tau);return{x:Math.abs(target.x-current.x)<.02?target.x:current.x+(target.x-current.x)*f,y:Math.abs(target.y-current.y)<.02?target.y:current.y+(target.y-current.y)*f};}
