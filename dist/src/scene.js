import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SUN, PLANETS, MOONS, BELTS, BODY_BY_ID } from './data.js';
import { orbitalPoint, worldPosition, orbitEmphasis, bodyFrame, scaleForView } from './model.js';
import { glowTexture, random } from './textures.js';

const V = (p) => new THREE.Vector3(p.x, p.y, p.z);


export class SystemViewer {
  constructor(container, labels, onSelect, onFocus, surfaces) {
    this.container = container; this.labelsElement = labels; this.surfaces=surfaces;
    this.onSelect = onSelect; this.onFocus = onFocus;
    this.bodies = new Map(); this.orbits = new Map(); this.belts = new Map(); this.labels = new Map();
    this.pickables = []; this.selectedId = null; this.followId = null;
    this.showAxes=true; this.showLabels = true; this.showOrbits = true; this.simDays = 0;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#060a10');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer:true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(43, 1, 1e-8, 3000);
    this.camera.position.set(115, 135, 170);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = .07;
    this.controls.minDistance = 1e-7; this.controls.maxDistance = 440;
    this.controls.maxPolarAngle = Math.PI - .04; this.controls.minPolarAngle = .04;
    this.controls.zoomSpeed = .85; this.controls.rotateSpeed = .55;
    this.controls.addEventListener('start', () => { this.transition = null; });
    this.scene.add(new THREE.AmbientLight('#c2d4ed', 1.3));
    const sunLight = new THREE.PointLight('#fff1d7', 3.0, 0, 0);
    this.scene.add(sunLight);
    this.createStars(); this.createBody(SUN,0);
    PLANETS.forEach((body, i) => this.createBody(body, i + 11));
    MOONS.forEach((body, i) => this.createBody(body, i + 31));
    BELTS.forEach((belt, i) => this.createBelt(belt, 88 + i));
    this.createSelectionMarker(); this.createReferencePlane();
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    let down;
    this.renderer.domElement.addEventListener('pointerdown', e => { down = { x:e.clientX, y:e.clientY, button:e.button }; });
    this.renderer.domElement.addEventListener('click', e => {
      if (!down || down.button !== 0 || Math.hypot(e.clientX-down.x,e.clientY-down.y)>5) return;
      const rect=this.container.getBoundingClientRect();
      this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      this.raycaster.setFromCamera(this.pointer,this.camera);
      const hits=this.raycaster.intersectObjects(this.pickables,false);
      this.onSelect(hits[0]?.object.userData.bodyId ?? null);
    });
    this.renderer.domElement.addEventListener('dblclick', () => { if(this.selectedId) this.onFocus(this.selectedId); });
    this.renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
    this.resize();
    this.camera.position.copy(this.homePosition());
    this.controls.update();
  }

  resize() {
    const {width,height}=this.container.getBoundingClientRect();
    this.width=width; this.height=height;
    this.camera.aspect=width/height; this.camera.updateProjectionMatrix();
    this.controls.maxDistance=Math.max(260,150*Math.max(1,.95/this.camera.aspect)*1.7);
    this.renderer.setSize(width,height);
  }

  homePosition() {
    return new THREE.Vector3(46,54,68).multiplyScalar(Math.max(1,.95/this.camera.aspect));
  }

  createStars() {
    const rng=random(102); const count=5800;
    const vertices=new Float32Array(count*3); const colors=new Float32Array(count*3);
    for(let i=0;i<count;i++) {
      const theta=rng()*Math.PI*2, phi=Math.acos(2*rng()-1), r=650+rng()*700;
      vertices.set([r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta)],i*3);
      const value=.22+rng()*.5;
      colors.set([value*(.85+rng()*.15),value*(.9+rng()*.1),value],i*3);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const stars=new THREE.Points(geometry,new THREE.PointsMaterial({size:1.05,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.75,depthWrite:false}));
    this.scene.add(stars);
    // A few brighter stars, kept restrained so orbit paths remain readable.
    const brightGeometry=new THREE.BufferGeometry();
    brightGeometry.setAttribute('position',new THREE.BufferAttribute(vertices.slice(0,150),3));
    this.scene.add(new THREE.Points(brightGeometry,new THREE.PointsMaterial({color:'#b6c4d8',size:1.8,sizeAttenuation:false,transparent:true,opacity:.7,depthWrite:false})));
  }

  createBody(body) {
    const root=new THREE.Group(),visual=new THREE.Group(),axisFrame=new THREE.Group(),spin=new THREE.Group();
    root.add(visual);visual.add(axisFrame);axisFrame.add(spin);this.scene.add(root);
    const map=this.surfaces[body.id]??this.surfaces.moon;
    const material=body.id==='sun'
      ?new THREE.MeshBasicMaterial({map,color:'#ffe3a9',toneMapped:false})
      :new THREE.MeshStandardMaterial({map,roughness:.95,metalness:0,color:body.id==='earth'?'#e9f1ff':body.parent&&body.id!=='moon'?body.color:'#ffffff'});
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,64,40),material);
    mesh.userData.bodyId=body.id;this.pickables.push(mesh);spin.add(mesh);
    const axis=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-1.65,0),new THREE.Vector3(0,1.65,0)]),new THREE.LineDashedMaterial({color:'#8dbedb',transparent:true,opacity:.8,dashSize:.13,gapSize:.08,depthTest:false}));
    axis.computeLineDistances();axis.renderOrder=6;axisFrame.add(axis);axis.visible=false;
    if(body.id==='saturn') {
      const geometry=new THREE.RingGeometry(1.24,2.32,128);
      const pos=geometry.attributes.position,uv=geometry.attributes.uv;
      for(let i=0;i<pos.count;i++)uv.setXY(i,(Math.hypot(pos.getX(i),pos.getY(i))-1.24)/1.08,.5);
      const rings=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:this.surfaces.rings,side:THREE.DoubleSide,transparent:true,roughness:1,opacity:.9,depthWrite:false}));
      rings.rotation.x=-Math.PI/2;axisFrame.add(rings);
    }
    if(body.id==='earth') {
      const clouds=new THREE.Mesh(new THREE.SphereGeometry(1.012,48,32),new THREE.MeshStandardMaterial({color:'#ffffff',alphaMap:this.surfaces.clouds,transparent:true,opacity:.6,depthWrite:false,roughness:1}));
      spin.add(clouds);
    }
    if(['earth','neptune','uranus'].includes(body.id)) {
      const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(1.035,40,24),new THREE.ShaderMaterial({
        uniforms:{color:{value:new THREE.Color(body.id==='earth'?'#64acdf':'#679acb')}},
        vertexShader:`varying vec3 n;varying vec3 eye;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);eye=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
        fragmentShader:`uniform vec3 color;varying vec3 n;varying vec3 eye;void main(){float f=pow(1.0-abs(dot(normalize(n),normalize(eye))),3.0);gl_FragColor=vec4(color,f*.32);}`,
        transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      }));visual.add(atmosphere);
    }
    if(body.id==='sun') {
      this.sun=mesh;
      const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:'#ffc16d',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
      glow.scale.set(10,10,1);visual.add(glow);
    } else this.orbits.set(body.id,this.createOrbit(body));
    this.bodies.set(body.id,{root,visual,axisFrame,spin,mesh,body,axis,displayRadius:body.radius});
    this.makeLabel(body);
  }

  createOrbit(body) {
    const points=[]; for(let i=0;i<256;i++) points.push(V(orbitalPoint(body,i/256*Math.PI*2)));
    const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#9baec5',transparent:true,opacity:.10,depthWrite:false}));
    line.userData.bodyId=body.id;this.scene.add(line);return line;
  }

  createBelt(body,seed) {
    const rng=random(seed); const group=new THREE.Group();
    const material=new THREE.MeshStandardMaterial({color:body.color,roughness:1,transparent:true,opacity:body.id==='kuiper-belt'?.42:.65});
    const mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),material,body.count);
    const matrix=new THREE.Object3D();
    for(let i=0;i<body.count;i++) {
      const angle=rng()*Math.PI*2,r=body.inner+(body.outer-body.inner)*rng();
      const thickness=body.id==='kuiper-belt'?9:.45;
      matrix.position.set(Math.cos(angle)*r,(rng()-.5)*thickness,Math.sin(angle)*r);
      matrix.rotation.set(rng()*3,rng()*3,rng()*3);
      const s=(body.id==='kuiper-belt'?.012:.0015)+rng()*(body.id==='kuiper-belt'?.025:.003);
      matrix.scale.set(s,s*(.6+rng()),s);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.userData.bodyId=body.id;this.pickables.push(mesh);group.add(mesh);this.scene.add(group);
    const edges=[];
    for(const radius of [body.inner,body.outer]) {
      const pts=[];for(let i=0;i<256;i++)pts.push(new THREE.Vector3(Math.cos(i/256*Math.PI*2)*radius,0,Math.sin(i/256*Math.PI*2)*radius));
      const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:body.color,transparent:true,opacity:.04,depthWrite:false}));
      group.add(line);edges.push(line);
    }
    this.belts.set(body.id,{group,mesh,edges,body});
  }

  createReferencePlane() {
    this.referencePlane=new THREE.GridHelper(110,22,'#486175','#27374a');
    this.referencePlane.material.transparent=true;this.referencePlane.material.opacity=.15;this.referencePlane.material.depthWrite=false;
    this.referencePlane.visible=false;this.scene.add(this.referencePlane);
  }

  createSelectionMarker() {
    const points=[];for(let i=0;i<96;i++)points.push(new THREE.Vector3(Math.cos(i/96*Math.PI*2),Math.sin(i/96*Math.PI*2),0));
    this.marker=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#e5c38b',transparent:true,opacity:.75,depthTest:false}));
    this.marker.visible=false;this.marker.renderOrder=5;this.scene.add(this.marker);
  }

  makeLabel(body) {
    const element=document.createElement('button'); element.className=`body-label${body.parent?' moon':''}`;
    element.dataset.bodyId=body.id;element.setAttribute('aria-label',`${body.name} 선택`);
    element.innerHTML=`<span class="label-tick"></span><span>${body.name}</span><span class="label-en">${body.english}</span>`;
    element.addEventListener('click',()=>this.onSelect(body.id));
    element.addEventListener('dblclick',()=>this.onFocus(body.id));
    this.labelsElement.appendChild(element);this.labels.set(body.id,element);
  }

  select(id) {
    this.selectedId=id;
    for(const [bodyId,line] of this.orbits) {
      line.material.opacity=orbitEmphasis(bodyId,id);
      line.material.color.set(bodyId===id?'#e9c587':'#8fa6c0');
    }
    for(const [beltId,belt]of this.belts) {
      const selected=beltId===id;
      belt.mesh.material.opacity=selected?.95:beltId==='kuiper-belt'?.42:.65;
      belt.mesh.material.emissive.set(selected?'#67513a':'#000000');
      belt.mesh.material.emissiveIntensity=selected?.4:0;
      belt.edges.forEach(edge=>edge.material.opacity=selected?.7:.04);
    }
    for(const [bodyId,label]of this.labels) {label.classList.toggle('selected',bodyId===id);label.setAttribute('aria-pressed',String(bodyId===id));}
    this.marker.visible=!!id&&this.bodies.has(id);
  }

  beginTransition(target,distance,direction) {
    this.transition={target:target.clone(),startTarget:this.controls.target.clone(),startDistance:this.camera.position.distanceTo(this.controls.target),endDistance:distance,startDirection:this.camera.position.clone().sub(this.controls.target).normalize(),direction:direction.clone().normalize(),elapsed:0};
  }

  focus(id,mode='surface') {
    const body=BODY_BY_ID.get(id);if(!body)return;
    let followBody=body;
    if(mode==='orbit'&&body.parent)followBody=BODY_BY_ID.get(body.parent);
    const target=V(worldPosition(followBody.id,this.simDays));
    const extent=MOONS.filter(m=>m.parent===followBody.id).reduce((r,m)=>Math.max(r,m.orbit),followBody.radius??0);
    const distance=body.outer?body.outer*2.9:mode==='orbit'?Math.max(extent*3.5,followBody.radius*9):body.radius*7.5;
    this.followId=followBody.orbit?followBody.id:null;this.lastFollowTarget=null;
    this.controls.minDistance=(followBody.radius??.001)*1.2;
    this.beginTransition(target,distance,this.camera.position.clone().sub(this.controls.target));
  }

  home(inner=false) {
    this.followId=null;this.lastFollowTarget=null;this.controls.minDistance=1e-7;
    const position=inner?new THREE.Vector3(2.8,3.3,4.2):this.homePosition();
    this.beginTransition(new THREE.Vector3(),position.length(),position);
  }

  setView(view) {
    const direction=view==='top'?new THREE.Vector3(.001,1,.001):view==='side'?new THREE.Vector3(.1,.015,1):new THREE.Vector3(.48,.56,.71);
    this.beginTransition(this.controls.target,this.camera.position.distanceTo(this.controls.target),direction);
  }

  zoom(factor) {
    this.transition=null;
    const offset=this.camera.position.clone().sub(this.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,this.controls.minDistance,this.controls.maxDistance));
    this.camera.position.copy(this.controls.target).add(offset);this.controls.update();
  }

  update(days,realSeconds) {
    this.simDays=days;
    for(const [id,entry]of this.bodies) {
      entry.root.position.copy(V(worldPosition(id,days)));
      const frame=bodyFrame(entry.body,days);
      entry.axisFrame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(frame.x),V(frame.pole),V(frame.z)));
      entry.spin.rotation.y=frame.spin;
      const distance=this.camera.position.distanceTo(entry.root.position);
      const minPixels=id==='sun'?9:entry.body.parent?2.2:4;
      const minRadius=distance*Math.tan(this.camera.fov*Math.PI/360)*2/this.height*minPixels;
      // Keep true AU positions. Distant bodies use a capped visual marker only;
      // close views converge to the measured physical radius.
      const cap=id==='sun'?.08:entry.body.parent?entry.body.orbit*.08:Math.min(.5,entry.body.orbit*.045);
      entry.displayRadius=Math.max(entry.body.radius,Math.min(minRadius,cap));
      entry.visual.scale.setScalar(entry.displayRadius);
      const screenRadius=entry.displayRadius/distance*this.height/(2*Math.tan(this.camera.fov*Math.PI/360));
      entry.axis.visible=this.showAxes&&(id===this.selectedId||entry.body.parent===this.selectedId)&&screenRadius>5;
      const orbit=this.orbits.get(id);
      if(orbit) {
        if(entry.body.elements&&Math.abs(days-(orbit.userData.updatedDays??0))>.5) {
          const positions=orbit.geometry.attributes.position;
          for(let i=0;i<positions.count;i++) {
            const point=orbitalPoint(entry.body,i/positions.count*Math.PI*2,days);
            positions.setXYZ(i,point.x,point.y,point.z);
          }
          positions.needsUpdate=true;orbit.geometry.computeBoundingSphere();orbit.userData.updatedDays=days;
        }
        if(entry.body.parent)orbit.position.copy(V(worldPosition(entry.body.parent,days)));
        orbit.visible=this.showOrbits;
      }
    }
    for(const [id,belt]of this.belts) {
      belt.group.rotation.y=days*(id==='asteroid-belt'?.0009:.00005);
      belt.edges.forEach(edge=>edge.visible=this.showOrbits);
    }
    if(this.followId) {
      const newTarget=V(worldPosition(this.followId,days));
      const delta=newTarget.clone().sub(this.lastFollowTarget??newTarget);
      this.camera.position.add(delta);this.controls.target.add(delta);
      if(this.transition) {this.transition.target.add(delta);this.transition.startTarget.add(delta);}
      this.lastFollowTarget=newTarget;
    } else this.lastFollowTarget=null;
    if(this.transition) {
      const t=this.transition;t.elapsed+=realSeconds;
      const fraction=Math.min(t.elapsed/1.25,1),ease=fraction*fraction*(3-2*fraction);
      this.controls.target.lerpVectors(t.startTarget,t.target,ease);
      const direction=t.startDirection.clone().lerp(t.direction,ease).normalize();
      const distance=Math.exp(THREE.MathUtils.lerp(Math.log(t.startDistance),Math.log(t.endDistance),ease));
      this.camera.position.copy(this.controls.target).addScaledVector(direction,distance);
      if(fraction===1)this.transition=null;
    }
    this.controls.update();
    const selected=this.bodies.get(this.selectedId);
    if(selected) {
      this.marker.position.copy(selected.root.position);
      this.marker.quaternion.copy(this.camera.quaternion);
      const minRadius=this.camera.position.distanceTo(this.marker.position)*.009;
      this.marker.scale.setScalar(Math.max(selected.displayRadius*1.45,minRadius));
    }
    this.camera.updateMatrixWorld();
    this.scale=scaleForView(this.camera.position.distanceTo(this.controls.target),this.camera.fov,this.height);
    this.updateLabels();
    this.renderer.render(this.scene,this.camera);
  }

  updateLabels() {
    const cameraForward=new THREE.Vector3();this.camera.getWorldDirection(cameraForward);
    const occupied=[];
    const ordered=[...this.labels].sort(([a],[b])=>Number(b===this.selectedId)-Number(a===this.selectedId));
    for(const [id,label]of ordered) {
      const entry=this.bodies.get(id);const pos=entry.root.position;
      let visible=this.showLabels;
      const distance=this.camera.position.distanceTo(pos);
      if(entry.body.parent && !(entry.body.parent===this.selectedId || BODY_BY_ID.get(this.selectedId)?.parent===entry.body.parent || distance<entry.body.orbit*25))visible=false;
      if(pos.clone().sub(this.camera.position).dot(cameraForward)<=0)visible=false;
      const projected=pos.clone().project(this.camera);
      if(projected.z>1||projected.z< -1||Math.abs(projected.x)>1.1||Math.abs(projected.y)>1.1)visible=false;
      if(visible&&entry.body.parent) {
        const parent=this.bodies.get(entry.body.parent);
        const rayDirection=pos.clone().sub(this.camera.position).normalize();
        const ray=new THREE.Ray(this.camera.position,rayDirection);
        const hit=ray.intersectSphere(new THREE.Sphere(parent.root.position,parent.displayRadius*1.02),new THREE.Vector3());
        if(hit&&hit.distanceTo(this.camera.position)<distance)visible=false;
      }
      const px=(projected.x*.5+.5)*this.width,py=(-projected.y*.5+.5)*this.height;
      if(visible&&id!==this.selectedId&&occupied.some(p=>Math.abs(p.x-px)<70&&Math.abs(p.y-py)<19))visible=false;
      if(visible)occupied.push({x:px,y:py});
      label.hidden=!visible;
      // Explicit display is needed because .body-label uses display:flex.
      label.style.display=visible?'flex':'none';
      if(!visible)continue;
      const apparentRadius=entry.displayRadius/distance*this.height/(2*Math.tan(this.camera.fov*Math.PI/360));
      label.style.left=`${(projected.x*.5+.5)*this.width+Math.max(3,apparentRadius)}px`;
      label.style.top=`${(-projected.y*.5+.5)*this.height}px`;
    }
  }
}
