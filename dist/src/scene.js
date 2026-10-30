import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { orbitEmphasis, scaleForView } from './model.js';
import { bodyRadiusWorldUnits, gameAUToWorld, worldToGameAU } from './game-space.js';
import { calculateManagedExtent, bodySystemExtentGameAU } from './system-context.js';
import { assistedBodySelection } from './selection.js';
import { glowTexture, random } from './textures.js';
import { SectorView } from './sector-view.js';
import { axialToPlane } from './hex-sectors.js';
const V=p=>new THREE.Vector3(p.x,p.y,p.z);
const gameV=p=>V(p).multiplyScalar(gameAUToWorld(1));

function disposeTree(root) {
  if(!root)return;
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.userData.ownedTexture)textures.add(o.userData.ownedTexture);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.removeFromParent();
}
export class SystemViewer {
  constructor(container,systemContext,{labels,surfaces,onSelection=()=>{},onHover=()=>{}}) {
    this.container=container;this.labelsElement=labels;this.surfaces=surfaces;this.onSelection=onSelection;this.onHover=onHover;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#060a10');
    this.renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.renderer.domElement.setAttribute('aria-hidden','true');container.appendChild(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(43,1,.01,gameAUToWorld(100000));
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.07;
    this.controls.maxPolarAngle=Math.PI-.04;this.controls.minPolarAngle=.04;this.controls.zoomSpeed=.85;this.controls.rotateSpeed=.55;
    this.controls.addEventListener('start',()=>{this.transition=null;});
    this.scene.add(new THREE.AmbientLight('#c2d4ed',1.3));
    this.showReferencePlane=false;this.showAxes=false;this.showLabels=true;this.showOrbits=true;this.simDays=0;this.abort=new AbortController();
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.installInput();this.resize();this.setSystemContext(systemContext);
  }
  installInput() {
    const canvas=this.renderer.domElement,options={signal:this.abort.signal};let down=null,moved=false;
    canvas.addEventListener('pointerdown',e=>{moved=false;down=e.isPrimary?{x:e.clientX,y:e.clientY,button:e.button,pointerType:e.pointerType}:null;},options);
    canvas.addEventListener('click',e=>{
      if(!down||moved||down.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>=5)return;
      if(this.administrationEditing){const sector=this.pickSectorAt(e.clientX,e.clientY);if(sector)this.onEditSector?.(sector);return;}
      const body=this.pickAt(e.clientX,e.clientY,down.pointerType);
      if(body){this.select(body,this.lastBodyHitWorld);return;}
      const sector=this.pickSectorAt(e.clientX,e.clientY);
      if(sector)this.selectSector(sector);else this.select(null);
    },options);
    canvas.addEventListener('pointermove',e=>{
      if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>=5)moved=true;
      if(e.pointerType==='touch'||e.buttons){this.sectors.setHover(null);this.onHover(null);return;}
      const body=this.pickAt(e.clientX,e.clientY,e.pointerType),sector=body?null:this.pickSectorAt(e.clientX,e.clientY);
      this.sectors.setHover(sector);this.onHover(sector);canvas.style.cursor=body?'pointer':sector?'crosshair':'grab';
    },options);
    canvas.addEventListener('pointerleave',()=>{this.sectors?.setHover(null);this.onHover(null);},options);
    canvas.addEventListener('pointercancel',()=>{down=null;},options);
    canvas.addEventListener('contextmenu',e=>e.preventDefault(),options);
  }
  setSystemContext(context) {
    this.contextAbort?.abort();this.contextAbort=new AbortController();if(this.bodies?.size===0)this.bodyGeometry?.dispose();
    disposeTree(this.worldRoot);disposeTree(this.backgroundRoot);this.labelsElement.replaceChildren();
    this.administrationEditing=false;this.context=context;this.validation=context.validation??null;this.extent=calculateManagedExtent(context);this.bodies=new Map();this.orbits=new Map();this.belts=new Map();this.labels=new Map();this.lights=new Map();this.pickables=[];
    this.selectedId=null;this.selectedSector=null;this.followId=null;this.lastFollowTarget=null;this.transition=null;this.simDays=0;
    this.worldRoot=new THREE.Group();this.scene.add(this.worldRoot);this.bodyGeometry=new THREE.SphereGeometry(1,64,40);
    for(const body of [...context.stars,...context.planets,...context.moons])this.createBody(body);
    context.belts.forEach((body,i)=>this.createBelt(body,88+i));this.createBackground();this.createMarker();this.createReferencePlane();
    if(this.sectors)this.sectors.setContext(context);else this.sectors=new SectorView(this.scene,context);
    this.camera.up.copy(V(context.sectorPlane.normal));this.controls.target.copy(gameV(context.sectorPlane.originGameAU));
    this.resize();this.controls.minDistance=this.centerMinDistance();this.camera.position.copy(this.homePosition());this.controls.update();
    this.update(0,0);this.onSelection(null);this.onHover(null);
  }
  resize() {
    const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;
    this.width=width;this.height=height;this.camera.aspect=width/height;
    if(this.extent){this.controls.maxDistance=gameAUToWorld(Math.max(this.sectors?.grid.radiusGameAU??100,this.extent.paddedRadiusGameAU)*15/Math.min(1,this.camera.aspect));this.camera.far=gameAUToWorld(Math.max(10000,this.extent.paddedRadiusGameAU*100));}
    this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);
  }
  createBackground() {
    this.backgroundRoot=new THREE.Group();this.backgroundRoot.position.copy(gameV(this.context.systemCenterGameAU));this.scene.add(this.backgroundRoot);
    const rng=random(102),count=5800,vertices=new Float32Array(count*3),colors=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const theta=rng()*Math.PI*2,phi=Math.acos(2*rng()-1),r=gameAUToWorld(Math.max(1000,this.extent.paddedRadiusGameAU*18)+rng()*this.extent.paddedRadiusGameAU*9);
      vertices.set([r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta)],i*3);
      const c=.22+rng()*.5;colors.set([c*(.85+rng()*.15),c*(.9+rng()*.1),c],i*3);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    this.backgroundRoot.add(new THREE.Points(geometry,new THREE.PointsMaterial({size:1.05,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.75,depthWrite:false})));
  }
  createBody(body) {
    const root=new THREE.Group(),visual=new THREE.Group(),axisFrame=new THREE.Group(),spin=new THREE.Group();
    const radiusWorldUnits=bodyRadiusWorldUnits(body);visual.scale.setScalar(radiusWorldUnits);root.add(visual);visual.add(axisFrame);axisFrame.add(spin);this.worldRoot.add(root);
    const map=this.surfaces[body.surfaceTextureKey]??null;
    const material=body.kind==='star'?new THREE.MeshBasicMaterial({map,color:body.surfaceTint??body.color??'#ffe3a9',toneMapped:false}):new THREE.MeshStandardMaterial({map,roughness:.95,metalness:0,color:body.surfaceTint??(map?'#ffffff':body.color??'#aab8c5')});
    const mesh=new THREE.Mesh(this.bodyGeometry,material);mesh.userData.bodyId=body.id;this.pickables.push(mesh);spin.add(mesh);
    const axis=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-1.65,0),new THREE.Vector3(0,1.65,0)]),new THREE.LineDashedMaterial({color:'#8dbedb',transparent:true,opacity:.8,dashSize:.13,gapSize:.08,depthTest:false}));axis.computeLineDistances();axis.renderOrder=6;axisFrame.add(axis);axis.visible=false;
    if(body.rings){
      const {innerRadiusMultiplier:inner,outerRadiusMultiplier:outer,textureKey}=body.rings;
      const geometry=new THREE.RingGeometry(inner,outer,128),p=geometry.attributes.position,uv=geometry.attributes.uv;
      for(let i=0;i<p.count;i++)uv.setXY(i,(Math.hypot(p.getX(i),p.getY(i))-inner)/(outer-inner),.5);
      const rings=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:this.surfaces[textureKey],side:THREE.DoubleSide,transparent:true,roughness:1,opacity:.9,depthWrite:false}));rings.rotation.x=-Math.PI/2;axisFrame.add(rings);
    }
    if(body.cloudTextureKey&&this.surfaces[body.cloudTextureKey])spin.add(new THREE.Mesh(new THREE.SphereGeometry(1.012,48,32),new THREE.MeshStandardMaterial({color:'#ffffff',alphaMap:this.surfaces[body.cloudTextureKey],transparent:true,opacity:.6,depthWrite:false,roughness:1})));
    if(body.atmosphereColor){
      visual.add(new THREE.Mesh(new THREE.SphereGeometry(1.035,40,24),new THREE.ShaderMaterial({uniforms:{color:{value:new THREE.Color(body.atmosphereColor)}},vertexShader:`varying vec3 n;varying vec3 eye;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);eye=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform vec3 color;varying vec3 n;varying vec3 eye;void main(){float f=pow(1.0-abs(dot(normalize(n),normalize(eye))),3.0);gl_FragColor=vec4(color,f*.32);}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})));
    }
    if(body.kind==='star'){
      const texture=glowTexture(),glow=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:body.lightColor??body.color??'#ffc16d',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,opacity:.6}));glow.userData.ownedTexture=texture;glow.scale.set(5,5,1);visual.add(glow);
      const light=new THREE.PointLight(body.lightColor??'#fff1d7',3,0,0);this.worldRoot.add(light);this.lights.set(body.id,light);
    }
    if(body.orbitGameAU){const points=Array.from({length:256},(_,i)=>gameV(this.context.orbitPoint(body,i/256*Math.PI*2)));const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#9baec5',transparent:true,opacity:.10,depthWrite:false}));this.worldRoot.add(line);this.orbits.set(body.id,line);}
    this.bodies.set(body.id,{root,visual,axisFrame,spin,mesh,body,axis,radiusWorldUnits});this.makeLabel(body);
  }
  createBelt(body,seed){
    const rng=random(seed),group=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:body.color??'#b7a48c',roughness:1,transparent:true,opacity:.6});
    const mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),material,body.count??800),matrix=new THREE.Object3D();
    for(let i=0;i<mesh.count;i++){
      const angle=rng()*Math.PI*2,r=gameAUToWorld(body.innerGameAU+(body.outerGameAU-body.innerGameAU)*rng());matrix.position.set(Math.cos(angle)*r,(rng()-.5)*gameAUToWorld((body.outerGameAU-body.innerGameAU)*.25),Math.sin(angle)*r);matrix.rotation.set(rng()*3,rng()*3,rng()*3);const s=.1+rng()*.3;matrix.scale.set(s,s*(.6+rng()),s);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);
    }
    const plane=this.context.sectorPlane;group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(plane.tangentU),V(plane.normal),V(plane.tangentV).negate()));group.position.copy(gameV(body.centerGameAU??this.context.systemCenterGameAU));
    mesh.instanceMatrix.needsUpdate=true;mesh.userData.bodyId=body.id;this.pickables.push(mesh);group.add(mesh);this.worldRoot.add(group);
    const edges=[];for(const radius of [body.innerGameAU,body.outerGameAU]){const points=Array.from({length:256},(_,i)=>new THREE.Vector3(Math.cos(i/256*Math.PI*2)*gameAUToWorld(radius),0,Math.sin(i/256*Math.PI*2)*gameAUToWorld(radius)));const edge=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:body.color??'#a2b7c8',transparent:true,opacity:.04,depthWrite:false}));group.add(edge);edges.push(edge);}
    this.belts.set(body.id,{group,mesh,edges,body});
  }
  createReferencePlane(){
    this.referencePlane=new THREE.GridHelper(gameAUToWorld(Math.max(1,this.extent.paddedRadiusGameAU)*2),40,'#486175','#27374a');
    const p=this.context.sectorPlane;
    this.referencePlane.position.copy(gameV(p.originGameAU));
    this.referencePlane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(p.tangentU),V(p.normal),V(p.tangentV).negate()));
    this.referencePlane.material.transparent=true;this.referencePlane.material.opacity=.15;this.referencePlane.material.depthWrite=false;
    this.referencePlane.visible=this.showReferencePlane;this.worldRoot.add(this.referencePlane);
  }
  createMarker(){const points=Array.from({length:96},(_,i)=>new THREE.Vector3(Math.cos(i/96*Math.PI*2),Math.sin(i/96*Math.PI*2),0));this.marker=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#e5c38b',transparent:true,opacity:.75,depthTest:false}));this.marker.visible=false;this.marker.renderOrder=5;this.worldRoot.add(this.marker);}
  makeLabel(body){const label=document.createElement('button');label.className='body-label'+(body.parent?' moon':'');label.dataset.bodyId=body.id;label.setAttribute('aria-label',body.name+' 선택');label.textContent=body.name;label.addEventListener('click',()=>this.select(body.id),{signal:this.contextAbort.signal});this.labelsElement.appendChild(label);this.labels.set(body.id,label);}
  select(id,anchorWorld=null){
    if(id!==null&&!this.context.bodyById.has(id))return;
    this.selectedId=id;this.selectedSector=null;this.followId=null;this.lastFollowTarget=null;this.transition=null;this.sectors.select(null);
    for(const[bodyId,line]of this.orbits){line.material.opacity=orbitEmphasis(bodyId,id,this.context.bodyById);line.material.color.set(bodyId===id?'#e9c587':'#8fa6c0');}
    for(const[beltId,belt]of this.belts){const selected=beltId===id;belt.mesh.material.emissive.set(selected?'#67513a':'#000000');belt.mesh.material.emissiveIntensity=selected?.4:0;belt.edges.forEach(e=>e.material.opacity=selected?.7:.04);}
    for(const[bodyId,label]of this.labels){label.classList.toggle('selected',bodyId===id);label.setAttribute('aria-pressed',String(bodyId===id));}
    this.marker.visible=!!id&&this.bodies.has(id);this.onSelection(id?{kind:'body',bodyId:id,anchorWorld,systemId:this.context.systemId}:null);
  }
  selectSector(sector){this.select(null);this.selectedSector=sector;this.sectors.select(sector);this.onSelection({kind:'sector',sector,systemId:this.context.systemId});}
  centerMinDistance(){const center=gameV(this.context.sectorPlane.originGameAU);const enclosing=[...this.bodies.values()].filter(e=>e.body.kind==='star'&&e.root.position.distanceTo(center)<e.radiusWorldUnits).map(e=>e.radiusWorldUnits*1.2);return Math.max(gameAUToWorld(.1),...enclosing);}
  homeDirection(){const p=this.context.sectorPlane;return V(p.tangentU).multiplyScalar(.48).addScaledVector(V(p.normal),.56).addScaledVector(V(p.tangentV),-.71).normalize();}
  homePosition(){const gridRadius=Math.max(...this.sectors.grid.sectors.map(s=>{const p=axialToPlane(s.q,s.r,this.sectors.grid.radiusGameAU);return Math.hypot(p.u,p.v)+this.sectors.grid.radiusGameAU;}));const radius=Math.max(gridRadius,this.extent.paddedRadiusGameAU);const distance=gameAUToWorld(radius/Math.sin(this.camera.fov*Math.PI/360)*1.04/Math.min(1,this.camera.aspect));return gameV(this.context.sectorPlane.originGameAU).addScaledVector(this.homeDirection(),distance);}
  beginTransition(target,distance,direction,minimum=this.controls.minDistance){const startDistance=this.camera.position.distanceTo(this.controls.target);this.controls.minDistance=Math.min(startDistance,minimum);this.transition={target:target.clone(),startTarget:this.controls.target.clone(),startDistance,endDistance:distance,startDirection:this.camera.position.clone().sub(this.controls.target).normalize(),direction:direction.clone().normalize(),elapsed:0,minimum};}
  focus(id,mode='surface'){
    const body=this.context.bodyById.get(id);if(!body)return;let targetBody=body;if(mode==='orbit'&&body.parent)targetBody=this.context.bodyById.get(body.parent);
    const target=gameV(this.context.gamePosition(targetBody.id,this.simDays)),radius=bodyRadiusWorldUnits(body),extent=gameAUToWorld(bodySystemExtentGameAU(this.context,targetBody,this.simDays));
    const distance=body.kind==='belt'?gameAUToWorld(body.outerGameAU)*2.9:mode==='orbit'?Math.max(extent*3.5,bodyRadiusWorldUnits(targetBody)*9):radius*7.5;
    this.followId=body.kind==='belt'?null:targetBody.id;this.lastFollowTarget=this.followId?target.clone():null;
    let direction=this.camera.position.clone().sub(this.controls.target).normalize();
    if(body.parent&&mode==='surface'){const parent=this.context.bodyById.get(body.parent),parentPos=gameV(this.context.gamePosition(parent.id,this.simDays));if(target.clone().addScaledVector(direction,distance).distanceTo(parentPos)<bodyRadiusWorldUnits(parent)*1.1)direction=target.clone().sub(parentPos).normalize();}
    this.beginTransition(target,distance,direction,Math.max(.1,bodyRadiusWorldUnits(targetBody)*1.2));
  }
  home(inner=false){this.followId=null;this.lastFollowTarget=null;const target=gameV(this.context.sectorPlane.originGameAU);let distance=this.homePosition().distanceTo(target);if(inner&&this.context.planets.length){const innerBodies=[...this.context.planets].sort((a,b)=>a.orbitGameAU-b.orbitGameAU).slice(0,Math.ceil(this.context.planets.length/2));const extent=Math.max(...innerBodies.map(b=>b.orbitGameAU*(1+(b.eccentricity??0))+bodySystemExtentGameAU(this.context,b)));distance=gameAUToWorld(extent)*3.15/Math.min(1,this.camera.aspect);}this.beginTransition(target,distance,this.homeDirection(),this.centerMinDistance());}
  setView(view){const p=this.context.sectorPlane,direction=view==='top'?V(p.normal).addScaledVector(V(p.tangentU),.002):view==='side'?V(p.tangentV).negate().addScaledVector(V(p.normal),.015).addScaledVector(V(p.tangentU),.1):this.homeDirection();this.beginTransition(this.controls.target,this.camera.position.distanceTo(this.controls.target),direction);}
  zoom(factor){this.transition=null;const offset=this.camera.position.clone().sub(this.controls.target);offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,this.controls.minDistance,this.controls.maxDistance));this.camera.position.copy(this.controls.target).add(offset);this.controls.update();}
  update(days,seconds){
    if(this.disposed)return;this.simDays=days;
    for(const[id,e]of this.bodies){e.root.position.copy(gameV(this.context.gamePosition(id,days)));const frame=this.context.frameAt(e.body,days);e.axisFrame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(frame.x),V(frame.pole),V(frame.z)));e.spin.rotation.y=frame.spin;if(this.lights.has(id))this.lights.get(id).position.copy(e.root.position);const radiusPx=e.radiusWorldUnits/this.camera.position.distanceTo(e.root.position)*this.height/(2*Math.tan(this.camera.fov*Math.PI/360));e.axis.visible=this.showAxes&&(id===this.selectedId||e.body.parent===this.selectedId)&&radiusPx>5;const orbit=this.orbits.get(id);if(orbit){orbit.position.copy(gameV(this.context.orbitCenter(e.body,days)));orbit.visible=this.showOrbits;if(e.body.jplElements&&Math.abs(days-(orbit.userData.updatedDays??0))>.5){const positions=orbit.geometry.attributes.position;for(let i=0;i<positions.count;i++){const p=this.context.orbitPoint(e.body,i/positions.count*Math.PI*2,days);positions.setXYZ(i,gameAUToWorld(p.x),gameAUToWorld(p.y),gameAUToWorld(p.z));}positions.needsUpdate=true;orbit.geometry.computeBoundingSphere();orbit.userData.updatedDays=days;}}}
    for(const belt of this.belts.values()){belt.mesh.rotation.y=days*(belt.body.rotationRate??.0001);belt.edges.forEach(e=>e.visible=this.showOrbits);}
    if(this.followId){const target=gameV(this.context.gamePosition(this.followId,days)),delta=target.clone().sub(this.lastFollowTarget??target);this.camera.position.add(delta);this.controls.target.add(delta);if(this.transition){this.transition.target.add(delta);this.transition.startTarget.add(delta);}this.lastFollowTarget=target;}
    if(this.transition){const t=this.transition;t.elapsed+=seconds;const fraction=Math.min(t.elapsed/1.25,1),ease=fraction*fraction*(3-2*fraction);this.controls.target.lerpVectors(t.startTarget,t.target,ease);const direction=t.startDirection.clone().lerp(t.direction,ease).normalize(),distance=Math.exp(THREE.MathUtils.lerp(Math.log(t.startDistance),Math.log(t.endDistance),ease));this.camera.position.copy(this.controls.target).addScaledVector(direction,distance);if(fraction===1){this.controls.minDistance=t.minimum;this.transition=null;}}
    this.controls.update();this.camera.updateMatrixWorld();this.scene.updateMatrixWorld();this.projections=this.screenCandidates();
    const selected=this.bodies.get(this.selectedId);this.marker.visible=!!selected&&!!this.projections.find(p=>p.id===this.selectedId)?.visible;if(selected){this.marker.position.copy(selected.root.position);this.marker.quaternion.copy(this.camera.quaternion);this.marker.scale.setScalar(Math.max(selected.radiusWorldUnits*1.45,this.camera.position.distanceTo(selected.root.position)*.009));}
    const distance=worldToGameAU(this.camera.position.distanceTo(this.controls.target));this.scale=scaleForView(distance,this.camera.fov,this.height,this.width<=700?70:110);this.sectors.update(distance);this.referencePlane.visible=this.showReferencePlane;this.updateLabels();this.renderer.render(this.scene,this.camera);
  }
  screenCandidates(){const forward=new THREE.Vector3();this.camera.getWorldDirection(forward);return[...this.bodies].map(([id,e])=>{const relative=e.root.position.clone().sub(this.camera.position),depth=relative.length(),projected=e.root.position.clone().project(this.camera);let visible=relative.dot(forward)>0&&projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1;if(visible){const ray=new THREE.Ray(this.camera.position,relative.normalize());for(const[otherId,other]of this.bodies){if(otherId===id)continue;const hit=ray.intersectSphere(new THREE.Sphere(other.root.position,other.radiusWorldUnits),new THREE.Vector3());if(hit&&hit.distanceTo(this.camera.position)<depth-e.radiusWorldUnits){visible=false;break;}}}return{id,visible,depth,x:(projected.x*.5+.5)*this.width,y:(-projected.y*.5+.5)*this.height,pixelRadius:e.radiusWorldUnits/depth*this.height/(2*Math.tan(this.camera.fov*Math.PI/360))};});}
  setRay(clientX,clientY){const r=this.container.getBoundingClientRect();this.pointer.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);return{x:clientX-r.left,y:clientY-r.top};}
  pickAt(clientX,clientY,pointerType='mouse'){const point=this.setRay(clientX,clientY),hits=this.raycaster.intersectObjects(this.pickables,false),body=hits.find(hit=>this.bodies.has(hit.object.userData.bodyId));if(body){this.lastBodyHitWorld={x:body.point.x,y:body.point.y,z:body.point.z};return body.object.userData.bodyId;}this.lastBodyHitWorld=hits[0]?{x:hits[0].point.x,y:hits[0].point.y,z:hits[0].point.z}:null;return assistedBodySelection(point,this.screenCandidates(),pointerType==='touch'?18:12)??hits[0]?.object.userData.bodyId??null;}
  pickSectorAt(x,y){this.setRay(x,y);return this.sectors.pick(this.raycaster.ray);}
  projectionFor(id){return this.projections?.find(p=>p.id===id)??null;}
  projectWorld(position){const p=V(position).project(this.camera);return{x:(p.x*.5+.5)*this.width,y:(-p.y*.5+.5)*this.height,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1,pixelRadius:0};}
  updateLabels(){const occupied=[];const entries=[...this.labels].sort(([a],[b])=>Number(b===this.selectedId)-Number(a===this.selectedId));for(const[id,label]of entries){const e=this.bodies.get(id),p=this.projectionFor(id);let visible=this.showLabels&&p?.visible;if(e.body.parent&&e.body.parent!==this.selectedId&&this.context.bodyById.get(this.selectedId)?.parent!==e.body.parent&&p.depth>gameAUToWorld(e.body.orbitGameAU)*25)visible=false;const width=e.body.parent?70:110;let x=p.x+p.pixelRadius+10;if(x+width>this.width-8)x=p.x-p.pixelRadius-width-10;if(visible&&id!==this.selectedId&&occupied.some(o=>x<o.x+o.width&&x+width>o.x&&Math.abs(o.y-p.y)<21))visible=false;if(visible)occupied.push({x,y:p.y,width});label.hidden=!visible;label.style.display=visible?'block':'none';if(visible){label.style.left=x+'px';label.style.top=p.y+'px';}}}
  dispose(){if(this.disposed)return;this.disposed=true;this.abort.abort();this.contextAbort.abort();if(this.bodies.size===0)this.bodyGeometry.dispose();this.resizeObserver.disconnect();this.controls.dispose();this.sectors.dispose();disposeTree(this.worldRoot);disposeTree(this.backgroundRoot);this.labelsElement.replaceChildren();this.renderer.dispose();this.renderer.domElement.remove();for(const map of [this.bodies,this.orbits,this.belts,this.labels,this.lights])map.clear();this.pickables=[];this.projections=[];this.selectedId=null;this.selectedSector=null;this.followId=null;}
}
