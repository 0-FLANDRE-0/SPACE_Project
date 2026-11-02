// Stable class-I icosahedral spherical Voronoi dual. No Three.js or DOM.
export const SURFACE_GENERATOR_VERSION=1;
export const SURFACE_ORIENTATION_ID='body-local-v1';
export const MAX_SURFACE_FREQUENCY=12;
export const SURFACE_RADIUS=1.025;
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
export const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export const normalize=a=>mul(a,1/Math.hypot(a.x,a.y,a.z));
export function checksum(text){let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return(h>>>0).toString(16).padStart(8,'0');}
const phi=(1+Math.sqrt(5))/2;
const vertices=[[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]].map(([x,y,z])=>normalize({x,y,z}));
const faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
const topologyCache=new Map();
const sphericalTriangleArea=(a,b,c)=>2*Math.atan2(Math.abs(dot(a,cross(b,c))),1+dot(a,b)+dot(b,c)+dot(c,a));
export function containsSurfacePoint(tile,point,epsilon=1e-10){return dot(tile.center,point)>=tile.cosRadius-epsilon&&tile.edgeNormals.every(n=>dot(n,point)>=-epsilon);}
export function findSurfaceTile(grid,point){const p=normalize(point);if(!Number.isFinite(p.x))return null;return grid.tiles.find(t=>containsSurfacePoint(t,p))??null;}
export function pickSurfaceTile(grid,origin,direction,radius=SURFACE_RADIUS){
  const d=normalize(direction),b=dot(origin,d),c=dot(origin,origin)-radius*radius,discriminant=b*b-c;
  if(discriminant<0)return null;const distance=-b-Math.sqrt(discriminant);if(distance<0)return null;
  const point=normalize(add(origin,mul(d,distance)));if(dot(point,sub(origin,mul(point,radius)))<=1e-10)return null;const tile=findSurfaceTile(grid,point);
  return tile?{tile,point,distance}:null;
}
function countEquator(grid){
  const angles=[0];
  for(const tile of grid.tiles)for(let i=0;i<tile.boundary.length;i++){
    const a=tile.boundary[i],b=tile.boundary[(i+1)%tile.boundary.length];
    if(Math.abs(a.y)<1e-10)angles.push((Math.atan2(a.z,a.x)+Math.PI*2)%(Math.PI*2));
    if(a.y*b.y<0){let p=normalize(cross(cross(a,b),{x:0,y:1,z:0}));if(dot(p,add(a,b))<0)p=mul(p,-1);angles.push((Math.atan2(p.z,p.x)+Math.PI*2)%(Math.PI*2));}
  }
  const sorted=[...new Set(angles.map(a=>a.toFixed(10)))].map(Number).sort((a,b)=>a-b),ids=new Set();
  for(let i=0;i<sorted.length;i++){const end=i===sorted.length-1?sorted[0]+Math.PI*2:sorted[i+1],a=(sorted[i]+end)/2;const tile=findSurfaceTile(grid,{x:Math.cos(a),y:0,z:Math.sin(a)});if(tile)ids.add(tile.index);}
  return ids.size;
}
export function generateSurfaceTopology(frequency){
  if(!Number.isInteger(frequency)||frequency<1||frequency>MAX_SURFACE_FREQUENCY)throw Error('표면 주파수는 1–12의 정수여야 합니다.');
  if(topologyCache.has(frequency))return topologyCache.get(frequency);
  const f=frequency,points=new Map(),triangles=[];
  for(const face of faces){
    const at=(i,j)=>{const weights=[f-i-j,i,j],key=face.map((v,k)=>[v,weights[k]]).filter(([,w])=>w).sort((a,b)=>a[0]-b[0]).map(([v,w])=>`${String(v).padStart(2,'0')}:${String(w).padStart(2,'0')}`).join('|');
      if(!points.has(key)){let p={x:0,y:0,z:0};face.forEach((v,k)=>{p=add(p,mul(vertices[v],weights[k]/f));});points.set(key,{key,center:normalize(p),incident:[],neighborKeys:new Set()});}return key;};
    const triangle=(keys)=>{let [a,b,c]=keys.map(k=>points.get(k).center);if(dot(cross(sub(b,a),sub(c,a)),a)<0){[keys[1],keys[2]]=[keys[2],keys[1]];[b,c]=[c,b];}const center=normalize(cross(sub(b,a),sub(c,a))),index=triangles.length;triangles.push({keys,center});for(const key of keys){const p=points.get(key);p.incident.push(index);for(const k of keys)if(k!==key)p.neighborKeys.add(k);}};
    for(let i=0;i<f;i++)for(let j=0;j<f-i;j++){triangle([at(i,j),at(i+1,j),at(i,j+1)]);if(i+j<f-1)triangle([at(i+1,j),at(i+1,j+1),at(i,j+1)]);}
  }
  const ordered=[...points.values()].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0),indexByKey=new Map(ordered.map((p,i)=>[p.key,i]));
  const tiles=ordered.map((p,index)=>{
    const center=p.center,reference=Math.abs(center.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0},u=normalize(cross(reference,center)),v=cross(center,u);
    const incident=[...p.incident].sort((a,b)=>Math.atan2(dot(triangles[a].center,v),dot(triangles[a].center,u))-Math.atan2(dot(triangles[b].center,v),dot(triangles[b].center,u)));
    const boundary=incident.map(i=>triangles[i].center),area=boundary.reduce((sum,a,i)=>sum+sphericalTriangleArea(center,a,boundary[(i+1)%boundary.length]),0);
    return {index,center,boundary,vertexIndices:incident,neighbors:[...p.neighborKeys].map(k=>indexByKey.get(k)).sort((a,b)=>a-b),edgeNormals:boundary.map((a,i)=>normalize(cross(a,boundary[(i+1)%boundary.length]))),cosRadius:Math.min(...boundary.map(a=>dot(center,a))),latitudeDegrees:Math.asin(center.y)*180/Math.PI,longitudeDegrees:Math.atan2(-center.z,center.x)*180/Math.PI,areaSteradians:area,areaWeight:area/(4*Math.PI),kind:boundary.length===5?'pentagon':'hexagon'};
  });
  const topology={frequency:f,tiles,vertices:triangles.map(t=>t.center),primalTriangles:triangles.map(t=>t.keys.map(k=>indexByKey.get(k)))};
  topology.equatorCellCount=countEquator(topology);
  topology.fingerprint=checksum(`${SURFACE_GENERATOR_VERSION}/${SURFACE_ORIENTATION_ID}/${f}/`+tiles.map(t=>[t.center.x,t.center.y,t.center.z,t.areaWeight].map(x=>x.toFixed(10)).join(',')+':'+t.vertexIndices.join(',')+':'+t.neighbors.join(',')).join(';'));
  topologyCache.set(f,topology);return topology;
}
export function surfaceResolution(body){
  if(!['planet','moon'].includes(body.kind))throw Error('행성과 위성만 표면 지도를 지원합니다.');
  if(body.surfaceResolutionOverride!==undefined){const f=body.surfaceResolutionOverride;generateSurfaceTopology(f);if(f<2)throw Error('실용 표면 해상도는 f≥2입니다.');return {frequency:f,target:null,capped:false,policy:'explicit-override'};}
  if(body.kind==='moon'){const target=Math.max(9,Math.round(12*Math.sqrt(body.satelliteDiameterWorldUnits/.8)));return choose(target,'satellite-diameter-min-f2');}
  // Planet Size 15 -> f=3 is a versioned calibration, independent of body identity.
  if(body.planetSize===15)return {frequency:3,target:15,capped:false,policy:'planet-equator-v1'};
  return choose(body.planetSize,'planet-equator-v1');
}
function choose(target,policy){if(!Number.isFinite(target)||target<=0)throw Error('표면 해상도 입력 크기가 올바르지 않습니다.');let best=null,max=0;
  for(let f=2;f<=MAX_SURFACE_FREQUENCY;f++){const count=generateSurfaceTopology(f).equatorCellCount;max=Math.max(max,count);const diff=Math.abs(count-target);if(!best||diff<best.diff)best={frequency:f,diff};}
  return {frequency:best.frequency,target,capped:target>max,policy};
}
export function createPlanetarySurfaceGrid(systemId,body){
  if(typeof systemId!=='string'||!systemId||typeof body.id!=='string'||!body.id)throw Error('표면 대상 ID가 필요합니다.');
  const resolution=surfaceResolution(body),base=generateSurfaceTopology(resolution.frequency),makeId=i=>`${encodeURIComponent(systemId)}:${encodeURIComponent(body.id)}:surface:${String(i).padStart(5,'0')}`;
  const tiles=base.tiles.map(t=>({...t,id:makeId(t.index),neighborIds:t.neighbors.map(makeId)}));
  return {systemId,bodyId:body.id,bodyKind:body.kind,type:'icosahedral-dual',generatorVersion:SURFACE_GENERATOR_VERSION,orientationId:SURFACE_ORIENTATION_ID,frequency:base.frequency,cellCount:tiles.length,equatorCellCount:base.equatorCellCount,gridFingerprint:checksum(`${encodeURIComponent(systemId)}/${encodeURIComponent(body.id)}/${base.fingerprint}`),resolution,tiles,vertices:base.vertices,byId:new Map(tiles.map(t=>[t.id,t]))};
}
