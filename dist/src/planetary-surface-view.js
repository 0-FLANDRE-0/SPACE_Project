import * as THREE from 'three';
import { SURFACE_RADIUS, pickSurfaceTile, normalize, add, mul } from './planetary-surface-grid.js';
const V=p=>new THREE.Vector3(p.x,p.y,p.z);
const geometry=positions=>new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
export class PlanetarySurfaceView {
 constructor(entry,grid){this.entry=entry;this.body=entry.body;this.grid=grid;this.root=new THREE.Group();this.root.name='planetary-surface-layer';entry.spin.add(this.root);this.cameraLocal={value:new THREE.Vector3()};this.selectedId=null;this.fade=1;
  const positions=[];
  for(const tile of grid.tiles)for(let i=0;i<tile.boundary.length;i++)if(tile.vertexIndices[i]<tile.vertexIndices[(i+1)%tile.boundary.length])this.edge(positions,tile.boundary[i],tile.boundary[(i+1)%tile.boundary.length]);
  this.lines=new THREE.LineSegments(geometry(positions),this.material('#91bdc9',.38));this.root.add(this.lines);
  this.highlight=new THREE.LineSegments(geometry([]),this.material('#f2d79e',.95));this.root.add(this.highlight);
  this.fill=new THREE.Mesh(geometry([]),new THREE.MeshBasicMaterial({color:'#e4bb76',transparent:true,opacity:.13,side:THREE.FrontSide,depthWrite:false}));this.root.add(this.fill);
 }
 material(color,opacity){const material=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:true,depthWrite:false});material.onBeforeCompile=shader=>{shader.uniforms.surfaceCameraLocal=this.cameraLocal;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 surfaceLocalPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nsurfaceLocalPosition=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 surfaceLocalPosition;\nuniform vec3 surfaceCameraLocal;').replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(dot(surfaceLocalPosition,surfaceCameraLocal-surfaceLocalPosition)<=0.0)discard;');};return material;}
 edge(array,a,b){for(let i=0;i<4;i++){const p=normalize(add(mul(a,1-i/4),mul(b,i/4))),q=normalize(add(mul(a,1-(i+1)/4),mul(b,(i+1)/4)));array.push(p.x*SURFACE_RADIUS,p.y*SURFACE_RADIUS,p.z*SURFACE_RADIUS,q.x*SURFACE_RADIUS,q.y*SURFACE_RADIUS,q.z*SURFACE_RADIUS);}}
 setSelected(id){this.selectedId=id;const tile=this.grid.byId.get(id),positions=[],triangles=[];if(tile){for(let i=0;i<tile.boundary.length;i++){const a=tile.boundary[i],b=tile.boundary[(i+1)%tile.boundary.length];this.edge(positions,a,b);this.triangle(triangles,tile.center,a,b,3);}}
  this.highlight.geometry.dispose();this.fill.geometry.dispose();this.highlight.geometry=geometry(positions);this.fill.geometry=geometry(triangles);
 }
 setAuthoringColors(colors){
  if(!colors){if(this.authoring){this.authoring.geometry.dispose();this.authoring.material.dispose();this.authoring.removeFromParent();this.authoring=null;}return;}
  if(!this.authoring){const positions=[];this.authoringSpans=[];for(const tile of this.grid.tiles){const start=positions.length;for(let i=0;i<tile.boundary.length;i++)this.triangle(positions,tile.center,tile.boundary[i],tile.boundary[(i+1)%tile.boundary.length],2);this.authoringSpans.push({id:tile.id,start,count:positions.length-start});}
   const g=geometry(positions);g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(positions.length),3));this.authoring=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.72,depthWrite:false,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));this.authoring.name='surface-authoring-colors';this.root.add(this.authoring);}
  const attribute=this.authoring.geometry.getAttribute('color'),rgb=attribute.array;for(const span of this.authoringSpans){const color=new THREE.Color(colors.get(span.id));for(let i=span.start;i<span.start+span.count;i+=3){rgb[i]=color.r;rgb[i+1]=color.g;rgb[i+2]=color.b;}}attribute.needsUpdate=true;
 }
 setAuthoringConnections(pairs){if(this.connections){this.connections.geometry.dispose();this.connections.material.dispose();this.connections.removeFromParent();this.connections=null;}if(!pairs)return;const points=[];for(const [a,b]of pairs)this.edge(points,a,b);this.connections=new THREE.LineSegments(geometry(points),this.material('#bcf7dd',.95));this.root.add(this.connections);}
 triangle(positions,a,b,c,depth){if(depth){const ab=normalize(add(a,b)),bc=normalize(add(b,c)),ca=normalize(add(c,a));for(const t of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])this.triangle(positions,...t,depth-1);}else for(const p of[a,b,c])positions.push(p.x*SURFACE_RADIUS,p.y*SURFACE_RADIUS,p.z*SURFACE_RADIUS);}
 pick(ray){if(this.fade<.05)return null;const inverse=new THREE.Matrix4().copy(this.entry.spin.matrixWorld).invert(),local=ray.clone().applyMatrix4(inverse);return pickSurfaceTile(this.grid,local.origin,local.direction);}
 update(camera,height){this.entry.spin.updateWorldMatrix(true,false);this.cameraLocal.value.copy(this.entry.spin.worldToLocal(camera.position.clone()));const pixels=this.entry.radiusWorldUnits/camera.position.distanceTo(this.entry.root.position)*height/(2*Math.tan(camera.fov*Math.PI/360));this.fade=THREE.MathUtils.clamp((pixels-35)/50,0,1);this.root.visible=this.fade>.01;this.lines.material.opacity=.38*this.fade;this.highlight.material.opacity=.95*this.fade;this.fill.material.opacity=.13*this.fade;}
 dispose(){for(const o of this.root.children){o.geometry.dispose();o.material.dispose();}this.root.removeFromParent();}
}
