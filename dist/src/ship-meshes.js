import * as THREE from 'three';
import {shipDisplayLength} from './ship-data.js';

// Section geometry from the user's archived M1 shape study, +Z = bow.
function loft(stations,material){const positions=[],quad=(a,b,c,d)=>positions.push(...a,...b,...c,...a,...c,...d),ring=s=>[[-s.w/2,s.bot,s.z],[s.w/2,s.bot,s.z],[s.w/2,s.top,s.z],[-s.w/2,s.top,s.z]];for(let i=0;i<stations.length-1;i++){const a=ring(stations[i]),b=ring(stations[i+1]);for(let k=0;k<4;k++)quad(a[k],a[(k+1)%4],b[(k+1)%4],b[k]);}const a=ring(stations[0]),b=ring(stations.at(-1));quad(a[0],a[3],a[2],a[1]);quad(b[0],b[1],b[2],b[3]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return new THREE.Mesh(g,material);}
function beam(a,b,width,material){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),mesh=new THREE.Mesh(new THREE.BoxGeometry(width,width,p.distanceTo(q)),material);mesh.position.copy(p).add(q).multiplyScalar(.5);mesh.lookAt(q);return mesh;}
export function createShipMesh(ship){
  const root=new THREE.Group(),hull=new THREE.MeshStandardMaterial({color:'#adbdc8',metalness:.4,roughness:.5,flatShading:true}),dark=new THREE.MeshStandardMaterial({color:'#53697c',metalness:.45,roughness:.5}),trim=new THREE.MeshStandardMaterial({color:'#f1d5a3',roughness:.4}),glow=new THREE.MeshBasicMaterial({color:'#6addff'});
  if(ship.designId==='explorer'){
    root.add(loft([{z:-30,w:14,top:4.5,bot:-4.5},{z:12,w:14,top:4.5,bot:-4.5},{z:18,w:11,top:4.5,bot:-4.5},{z:30,w:5,top:0,bot:-4.5}],hull));
    for(const s of [-1,1]){root.add(beam([0,.25,30],[1.4*s,4.75,18],.6,trim));root.add(beam([1.4*s,4.75,18],[7*s,4.75,-30],.6,trim));}
    root.add(loft([{z:-31.5,w:11,top:3.5,bot:-3.5},{z:-30,w:12,top:4,bot:-4}],dark));const engine=new THREE.Mesh(new THREE.BoxGeometry(10,6,.4),glow);engine.position.z=-31.6;root.add(engine);
  }else{
    root.add(loft([{z:70,w:26,top:8,bot:-8},{z:86,w:24,top:7.5,bot:-7.5},{z:90,w:16,top:6,bot:-6}],hull),loft([{z:-80,w:34,top:13,bot:-13},{z:-48,w:34,top:13,bot:-13},{z:-40,w:22,top:9,bot:-9}],hull));
    const h=2.2;for(const x of [-h,h])for(const y of [-h,h])root.add(beam([x,y,-40],[x,y,70],.7,dark));
    for(let z=-40;z<70;z+=10){for(const x of [-h,h]){root.add(beam([x,-h,z],[x,h,z+10],.42,dark));root.add(beam([x,h,z],[x,-h,z+10],.42,dark));}for(const y of [-h,h]){root.add(beam([-h,y,z],[h,y,z+10],.42,dark));root.add(beam([h,y,z],[-h,y,z+10],.42,dark));}}
    const engine=new THREE.Mesh(new THREE.BoxGeometry(26,18,.4),glow);engine.position.z=-80.4;root.add(engine);const bay=new THREE.Mesh(new THREE.BoxGeometry(9,6,.3),dark);bay.position.z=90.2;root.add(bay);
  }
  // Normalize the complete geometry (including engines), not only the hull.
  const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3()),actual=box.max.z-box.min.z;for(const child of root.children)child.position.sub(center);
  root.scale.setScalar(shipDisplayLength(ship.design.lengthMeters)/actual);
  const selectionMaterial=new THREE.LineBasicMaterial({color:'#ffe3a0',depthTest:true,transparent:true,opacity:1});
  root.traverse(object=>{if(!object.isMesh)return;object.userData.shipId=ship.id;const edge=new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry,24),selectionMaterial);edge.visible=false;edge.userData.shipOutline=true;object.add(edge);});
  root.userData.selectionMaterial=selectionMaterial;return root;
}
export function disposeShipTree(root){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}
