import { AdministrativeRegionView } from './administrative-region-view.js';
import * as THREE from 'three';
import { gameAUToWorld } from './game-space.js';
import { createHexGrid, gridLineSegments, axialVertices, axialToPlane, worldPositionToSector, gamePositionToSector } from './hex-sectors.js';
const V=p=>new THREE.Vector3(p.x,p.y,p.z);

export class SectorView {
  constructor(scene,context) {this.scene=scene;this.enabled=true;this.fade=1;this.generation=0;this.setContext(context);}
  setContext(context) {
    if(this.root)this.dispose();
    this.context=context;this.grid=createHexGrid(context);this.generation++;
    this.root=new THREE.Group();this.root.name='hex-sector-layer';
    this.root.position.copy(V(context.sectorPlane.originGameAU).multiplyScalar(gameAUToWorld(1)));
    const {tangentU,tangentV,normal}=context.sectorPlane;
    this.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(tangentU),V(tangentV),V(normal)));
    this.scene.add(this.root);
    const positions=[];
    for(const edge of gridLineSegments(this.grid))for(const p of edge)positions.push(gameAUToWorld(p.u),gameAUToWorld(p.v),-.02);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#698fa5',transparent:true,opacity:.17,depthWrite:false,depthTest:true}));this.root.add(this.lines);this.administration=new AdministrativeRegionView(this.root,this.grid);
    const points=axialVertices(0,0,this.grid.radiusGameAU).map(p=>new THREE.Vector3(gameAUToWorld(p.u),gameAUToWorld(p.v),0));
    const borderGeometry=new THREE.BufferGeometry().setFromPoints(points);
    this.center=new THREE.LineLoop(borderGeometry,new THREE.LineBasicMaterial({color:'#7aadae',transparent:true,opacity:.27,depthWrite:false}));this.root.add(this.center);
    this.hover=new THREE.LineLoop(borderGeometry,new THREE.LineBasicMaterial({color:'#a1ced4',transparent:true,opacity:.7,depthWrite:false}));this.root.add(this.hover);
    this.selection=new THREE.LineLoop(borderGeometry,new THREE.LineBasicMaterial({color:'#e6c58e',transparent:true,opacity:.9,depthWrite:false}));this.root.add(this.selection);
    const shape=new THREE.Shape();points.forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();
    this.fill=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:'#bca275',transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false}));
    this.fill.position.z=-.04;this.root.add(this.fill);
    this.plane=new THREE.Plane().setFromNormalAndCoplanarPoint(V(normal),V(context.sectorPlane.originGameAU).multiplyScalar(gameAUToWorld(1)));
    this.hoverId=null;this.selectedId=null;this.hover.visible=false;this.selection.visible=false;this.fill.visible=false;
  }
  place(layer,sector) {const p=axialToPlane(sector.q,sector.r,this.grid.radiusGameAU);layer.position.x=gameAUToWorld(p.u);layer.position.y=gameAUToWorld(p.v);}
  select(sector) {
    this.selectedId=sector?.id??null;this.selection.visible=!!sector;this.fill.visible=!!sector;
    if(sector){this.place(this.selection,sector);this.place(this.fill,sector);}
  }
  setHover(sector) {this.hoverId=sector?.id??null;this.hover.visible=!!sector&&sector.id!==this.selectedId;if(sector)this.place(this.hover,sector);}
  setEnabled(value) {this.enabled=value;this.root.visible=value;this.setHover(null);}
  pick(ray) {
    if(!this.enabled||this.fade<.05||Math.abs(ray.direction.dot(this.plane.normal))<1e-6)return null;
    const hit=ray.intersectPlane(this.plane,new THREE.Vector3());if(!hit)return null;
    const sector=worldPositionToSector(this.context,hit,this.grid);
    return sector?{...sector,anchorWorld:{x:hit.x,y:hit.y,z:hit.z}}:null;
  }
  update(distanceGameAU) {
    const radius=this.grid.radiusGameAU;
    this.fade=THREE.MathUtils.clamp((distanceGameAU-radius*.35)/(radius*1.1),0,1);
    this.root.visible=this.enabled&&this.fade>.01;
    this.lines.visible=this.administration.mode==='exploration';this.center.visible=this.lines.visible;this.administration.update(this.fade);this.lines.material.opacity=.17*this.fade;this.center.material.opacity=.27*this.fade;
    this.hover.material.opacity=.7*this.fade;this.selection.material.opacity=.9*this.fade;this.fill.material.opacity=.055*this.fade;
  }
  members(days,sectorId) {
    return this.context.allBodies.filter(body=>body.kind!=='belt'&&gamePositionToSector(this.context,this.context.gamePosition(body.id,days),this.grid)?.id===sectorId);
  }
  dispose() {
    if(!this.root)return;
    this.administration?.dispose();
    const geometries=new Set(),materials=new Set();this.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.root.removeFromParent();this.root=null;
  }
}
