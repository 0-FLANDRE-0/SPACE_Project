import { worldToGameAU } from './game-space.js';
import { calculateManagedExtent, planePositionToGame, gamePositionToPlane } from './system-context.js';

// Global, fixed across ALL systems: center -> vertex (also side length), in game AU.
export const HEX_SECTOR_RADIUS_GAME_AU=210;
export const HEX_DIRECTIONS=Object.freeze([[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]);
const EDGE_NEIGHBORS=[[0,1],[-1,1],[-1,0],[0,-1],[1,-1],[1,0]];
export const hexRing=(q,r)=>Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r));
export const sectorCountForRings=R=>1+3*R*(R+1);
export const sectorId=(systemId,q,r)=>`${systemId}:${q}:${r}`;
export function axialToPlane(q,r,radius=HEX_SECTOR_RADIUS_GAME_AU) {return {u:Math.sqrt(3)*radius*(q+r/2),v:1.5*radius*r};}
export function axialVertices(q,r,radius=HEX_SECTOR_RADIUS_GAME_AU) {
  const c=axialToPlane(q,r,radius);
  return Array.from({length:6},(_,i)=>({u:c.u+Math.cos(Math.PI/6+i*Math.PI/3)*radius,v:c.v+Math.sin(Math.PI/6+i*Math.PI/3)*radius}));
}
export function planeToAxial(u,v,radius=HEX_SECTOR_RADIUS_GAME_AU) {
  const q=(Math.sqrt(3)/3*u-v/3)/radius,r=2/3*v/radius;
  let best=null;
  // Nine lattice candidates, deterministic ties: inner ring, then q, then r.
  for(let dq=-1;dq<=1;dq++)for(let dr=-1;dr<=1;dr++) {
    const Q=Math.round(q)+dq,R=Math.round(r)+dr,c=axialToPlane(Q,R,1);
    const d=(c.u-u/radius)**2+(c.v-v/radius)**2;
    const candidate={q:Q===0?0:Q,r:R===0?0:R,d,ring:hexRing(Q,R)};
    if(!best||d<best.d-1e-10||(Math.abs(d-best.d)<=1e-10&&(candidate.ring<best.ring||(candidate.ring===best.ring&&(Q<best.q||(Q===best.q&&R<best.r))))))best=candidate;
  }
  return {q:best.q,r:best.r};
}
export function axialCoordinates(R,onlyOuter=false) {
  if(!Number.isInteger(R)||R<0)throw new Error('Ring count must be a nonnegative integer');
  const result=[];
  for(let q=-R;q<=R;q++)for(let r=Math.max(-R,-q-R);r<=Math.min(R,-q+R);r++)if(!onlyOuter||hexRing(q,r)===R)result.push({q,r});
  return result.sort((a,b)=>hexRing(a.q,a.r)-hexRing(b.q,b.r)||a.q-b.q||a.r-b.r);
}
export function boundaryEdges(R,radius=HEX_SECTOR_RADIUS_GAME_AU) {
  const result=[];
  for(const {q,r}of axialCoordinates(R,true)) {
    const vertices=axialVertices(q,r,radius);
    EDGE_NEIGHBORS.forEach(([dq,dr],i)=>{if(hexRing(q+dq,r+dr)>R)result.push([vertices[i],vertices[(i+1)%6]]);});
  }
  return result;
}
const coverCache=new Map();
// Exact minimum distance from origin to ANY exposed boundary segment, including
// inward notches. A disk inside this radius is completely covered by the union.
export function coveredDiskRadius(R,radius=HEX_SECTOR_RADIUS_GAME_AU) {
  if(!coverCache.has(R)) {
    const distances=boundaryEdges(R,1).map(([a,b])=>{
      const dx=b.u-a.u,dy=b.v-a.v,t=Math.max(0,Math.min(1,-(a.u*dx+a.v*dy)/(dx*dx+dy*dy)));
      return Math.hypot(a.u+t*dx,a.v+t*dy);
    });
    coverCache.set(R,Math.min(...distances));
  }
  return coverCache.get(R)*radius;
}
export function findMinimalRingCount(extent,radius=HEX_SECTOR_RADIUS_GAME_AU) {
  const required=typeof extent==='number'?extent:extent.paddedRadiusGameAU;
  if(!Number.isFinite(required)||required<0||!Number.isFinite(radius)||radius<=0)throw new Error('Invalid sector extent/radius');
  let R=Math.max(0,Math.floor(required/(radius*1.5))-1);
  while(coveredDiskRadius(R,radius)+1e-8<required)R++;
  while(R>0&&coveredDiskRadius(R-1,radius)+1e-8>=required)R--;
  return R;
}
export function sectorCoordsToCenter(context,q,r,radius=HEX_SECTOR_RADIUS_GAME_AU) {
  const p=axialToPlane(q,r,radius);return planePositionToGame(context.sectorPlane,p.u,p.v);
}
export function createHexGrid(context,radius=HEX_SECTOR_RADIUS_GAME_AU,minimumRings=0) {
  const extent=calculateManagedExtent(context),ringCount=Math.max(minimumRings,findMinimalRingCount(extent,radius));
  const sectors=axialCoordinates(ringCount).map(({q,r})=>({id:sectorId(context.systemId,q,r),q,r,ring:hexRing(q,r),radiusGameAU:radius,centerGameAU:sectorCoordsToCenter(context,q,r,radius)}));
  return {systemId:context.systemId,radiusGameAU:radius,ringCount,sectorCount:sectors.length,extent,coveredRadiusGameAU:coveredDiskRadius(ringCount,radius),sectors,byId:new Map(sectors.map(s=>[s.id,s]))};
}
export function gamePositionToSector(context,position,grid=null) {
  const local=gamePositionToPlane(context.sectorPlane,position),radius=grid?.radiusGameAU??HEX_SECTOR_RADIUS_GAME_AU;
  const {q,r}=planeToAxial(local.u,local.v,radius),ring=hexRing(q,r);
  const maximum=grid?.ringCount??findMinimalRingCount(calculateManagedExtent(context),radius);
  if(ring>maximum)return null;
  return {id:sectorId(context.systemId,q,r),q,r,ring,radiusGameAU:radius,centerGameAU:sectorCoordsToCenter(context,q,r,radius)};
}
export const worldPositionToSector=(context,positionWorld,grid=null)=>gamePositionToSector(context,{x:worldToGameAU(positionWorld.x),y:worldToGameAU(positionWorld.y),z:worldToGameAU(positionWorld.z)},grid);
export function getSectorNeighbors(context,q,r,grid=null) {
  return HEX_DIRECTIONS.map(([dq,dr])=>{const Q=q+dq,R=r+dr;return {id:sectorId(context.systemId,Q,R),q:Q,r:R,ring:hexRing(Q,R),centerGameAU:sectorCoordsToCenter(context,Q,R,grid?.radiusGameAU),inside:!grid||hexRing(Q,R)<=grid.ringCount};});
}
export function growHexGrid(context,previous,minimumRings=previous.ringCount) {
  if(previous.systemId!==context.systemId)throw new Error('Cannot reuse another system grid');
  return createHexGrid(context,previous.radiusGameAU,Math.max(previous.ringCount,minimumRings));
}
export function gridLineSegments(grid) {
  const segments=[];
  for(const sector of grid.sectors) {
    const v=axialVertices(sector.q,sector.r,grid.radiusGameAU);
    EDGE_NEIGHBORS.forEach(([dq,dr],i)=>{const q=sector.q+dq,r=sector.r+dr;if(hexRing(q,r)>grid.ringCount||sector.q<q||(sector.q===q&&sector.r<r))segments.push([v[i],v[(i+1)%6]]);});
  }
  return segments;
}
