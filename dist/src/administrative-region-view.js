import * as THREE from 'three';
import { gameAUToWorld } from './game-space.js';
import { administrativeEdges } from './administrative-regions.js';
import { axialVertices } from './hex-sectors.js';
const positionsFor=edges=>edges.flatMap(e=>e.points.flatMap(p=>[gameAUToWorld(p.u),gameAUToWorld(p.v),-.015]));
const geometryFor=positions=>new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
export class AdministrativeRegionView {
  constructor(parent,grid){this.grid=grid;this.root=new THREE.Group();parent.add(this.root);this.generation=0;this.mode='exploration';this.layers={};this.selectedId=null;this.previewIds=[];this.fade=1;}
  clear(){while(this.root.children.length){const o=this.root.children[0];o.geometry?.dispose();o.material?.dispose();this.root.remove(o);}this.layers={};}
  line(name,positions,color,opacity){const layer=new THREE.LineSegments(geometryFor(positions),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false,depthTest:true}));layer.userData.opacity=opacity;this.root.add(layer);this.layers[name]=layer;return layer;}
  rebuild(model){
    this.clear();this.model=model;this.edges=administrativeEdges(this.grid,model.assignments);this.generation++;
    this.line('internal',positionsFor(this.edges.filter(e=>e.kind==='internal')),'#698fa5',.028);
    this.line('base',positionsFor(this.edges.filter(e=>e.kind==='base-boundary')),'#698fa5',.17);
    this.line('boundary',positionsFor(this.edges.filter(e=>e.kind==='admin-boundary')),'#9dc6c4',.55);
    const vertices=[],colors=[];
    for(const region of model.regions){const color=new THREE.Color(region.color);for(const id of region.sectorIds){const cell=this.grid.byId.get(id),points=axialVertices(cell.q,cell.r,this.grid.radiusGameAU),center=points.reduce((p,v)=>({u:p.u+v.u/6,v:p.v+v.v/6}),{u:0,v:0});for(let i=0;i<6;i++)for(const p of[center,points[i],points[(i+1)%6]]){vertices.push(gameAUToWorld(p.u),gameAUToWorld(p.v),-.04);colors.push(color.r,color.g,color.b);}}}
    const g=geometryFor(vertices);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const fill=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.075,side:THREE.DoubleSide,depthWrite:false}));fill.userData.opacity=.075;this.root.add(fill);this.layers.fill=fill;
    this.line('selected',[],'#eed39e',.85);this.line('preview',[],'#e6d6ae',.9);this.setSelected(this.selectedId);this.setPreview(this.previewIds);this.update(this.fade);
  }
  replaceLine(name,positions){const layer=this.layers[name];if(!layer)return;layer.geometry.dispose();layer.geometry=geometryFor(positions);}
  setSelected(id){this.selectedId=id;if(!this.edges)return;this.replaceLine('selected',positionsFor(this.edges.filter(e=>e.kind!=='internal'&&(this.model.assignments.get(e.a)===id||this.model.assignments.get(e.b)===id)&&id)));}
  setPreview(ids){this.previewIds=[...ids];const selected=new Set(ids);this.replaceLine('preview',positionsFor((this.edges??[]).filter(e=>selected.has(e.a)||selected.has(e.b))));}
  update(fade){this.fade=fade;this.root.visible=this.mode==='administration';for(const layer of Object.values(this.layers))layer.material.opacity=layer.userData.opacity*fade;}
  dispose(){this.clear();this.root.removeFromParent();}
}
