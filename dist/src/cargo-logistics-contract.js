// Future logistics boundaries only: these functions never move inventory.
import {deepFreeze,safeId} from './packaging-common.js';
const endpoint=p=>{if(!p||!safeId(p.systemId)||!safeId(p.bodyId)||!safeId(p.sectorId))throw Error('물류 천체/섹터 ID 필요');return p;};
const same=(a,b)=>a.systemId===b.systemId&&a.bodyId===b.bodyId&&a.sectorId===b.sectorId;
export function createShipmentContract({shipmentId,ownerId,origin,ultimateDestination}){if(!safeId(shipmentId)||!safeId(ownerId))throw Error('배송/소유자 ID 필요');endpoint(origin);endpoint(ultimateDestination);return deepFreeze({shipmentId,ownerId,origin:structuredClone(origin),ultimateDestination:structuredClone(ultimateDestination),continuousDelivery:true});}
export function requiresSCUPackaging({shipment,grid,localNetworkConnected=false,leg=null,resolveShipment=null}){
 if(resolveShipment){const canonical=resolveShipment(shipment?.shipmentId);if(JSON.stringify(canonical)!==JSON.stringify(shipment))throw Error('원래 배송 계약 위조/최종 목적지 변경');shipment=canonical;}
 if(!shipment?.continuousDelivery||!safeId(shipment.shipmentId))throw Error('원래 출발지/최종 목적지의 연속 배송 계약 필요');const a=endpoint(shipment.origin),b=endpoint(shipment.ultimateDestination);
 if(a.systemId!==b.systemId||a.bodyId!==b.bodyId)return true;
 if(!grid||grid.systemId!==a.systemId||grid.bodyId!==a.bodyId)throw Error('실제 행성 구형 격자 필요');const from=grid.byId.get(a.sectorId),to=grid.byId.get(b.sectorId);if(!from||!to)throw Error('실제 격자에 없는 배송 섹터');
 if(leg){endpoint(leg.from);endpoint(leg.to);if(![a,b].some(p=>same(p,leg.from))||![a,b].some(p=>same(p,leg.to)))return true;}
 if(same(a,b))return false;
 const adjacent=from.neighborIds.includes(b.sectorId)&&to.neighborIds.includes(a.sectorId),connected=typeof localNetworkConnected==='function'?localNetworkConnected(a,b,shipment.shipmentId):localNetworkConnected;
 return !(adjacent&&connected===true);
}
export function assertDeliveryBoundary({phase,custody,sourceDebited,destinationCredited}){
 const expected={planned:['origin',false,false],'in-transit':['shipment',true,false],delivered:['destination',true,true]}[phase];
 if(!expected||custody!==expected[0]||sourceDebited!==expected[1]||destinationCredited!==expected[2])throw Error('운송 중 보관과 행성 도착 재고를 혼동한 인도 계약');return true;
}
// Canonical planning identities prevent a caller from replacing A→D by A→B
// under the same shipment ID. This registry owns no cargo and runs no delivery.
export class ShipmentContractRegistry {
 #contracts=new Map();
 register(input){const contract=createShipmentContract(input),old=this.#contracts.get(contract.shipmentId);if(old){if(JSON.stringify(old)!==JSON.stringify(contract))throw Error('기존 배송의 출발지/최종 목적지 변경 금지');return old;}this.#contracts.set(contract.shipmentId,contract);return contract;}
 get(id){const contract=this.#contracts.get(id);if(!contract)throw Error('미등록 원래 배송 계약');return contract;}
}
