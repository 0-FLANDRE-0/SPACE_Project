import * as THREE from 'three';
import {orbitGraph,orbitLinePositions} from './orbit-model.js';
import {M1A_TUNING as T} from './ship-data.js';
import {SURFACE_RADIUS} from './planetary-surface-grid.js';
import {disposeShipTree} from './ship-meshes.js';
const colors={high:'#8ac7e5',middle:'#dfc48e',low:'#8ed0ae',surface:'#9cb7c7'};
export class OrbitLayerView {
  constructor(viewer){this.viewer=viewer;this.entries=new Map();this.caption=document.createElement('div');this.caption.className='orbit-caption';this.caption.setAttribute('role','status');viewer.container.parentElement.append(this.caption);}
  create(bodyId){const entry=this.viewer.bodies.get(bodyId),graph=orbitGraph(this.viewer.context,bodyId),root=new THREE.Group(),layers=new Map();entry.spin.add(root);
    for(const [layer,factor]of [...Object.entries(T.orbitRadiusMultipliers),['surface',SURFACE_RADIUS]]){const positions=orbitLinePositions(graph,factor);
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:colors[layer],transparent:true,opacity:.5,depthTest:true,depthWrite:false}));root.add(lines);
      let points=null;if(layer!=='surface'){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(graph.grid.vertices.flatMap(p=>[p.x*factor,p.y*factor,p.z*factor]),3));points=new THREE.Points(g,new THREE.PointsMaterial({color:colors[layer],size:6,sizeAttenuation:false,depthTest:true,depthWrite:false}));root.add(points);}layers.set(layer,{lines,points});}
    const value={root,layers,graph};this.entries.set(bodyId,value);return value;
  }
  update(state,targetMode){for(const e of this.entries.values())e.root.visible=false;this.caption.hidden=!state.bodyId||!!this.viewer.surface;if(this.viewer.surface){if(targetMode&&state.bodyId){const e=this.entries.get(state.bodyId)??this.create(state.bodyId);e.root.visible=true;for(const [name,l]of e.layers){l.lines.visible=false;if(l.points)l.points.visible=name==='low';}}return;}if(this.caption.hidden)return;
    const e=this.entries.get(state.bodyId)??this.create(state.bodyId);e.root.visible=true;const order=['high','middle','low','surface'],index=order.indexOf(state.layer),faint=order[index-1];for(const [name,layer]of e.layers){layer.lines.visible=name===state.layer||name===faint;layer.lines.material.opacity=name===state.layer?.48:.065;if(layer.points)layer.points.visible=name===state.layer&&targetMode;}
    this.caption.textContent=`${e.graph.body.name} · ${{high:'고궤도',middle:'중궤도',low:'저궤도',surface:'표면 섹터'}[state.layer]}`;this.caption.dataset.layer=state.layer;
  }
  dispose(){for(const e of this.entries.values())disposeShipTree(e.root);this.entries.clear();this.caption.remove();}
}
