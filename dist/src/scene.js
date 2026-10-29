import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SUN, PLANETS, MOONS, BELTS, BODY_BY_ID } from './data.js';
import { orbitalPoint, worldPosition, orbitEmphasis } from './model.js';
import { planetTexture, glowTexture, ringTexture, random } from './textures.js';

const V = (p) => new THREE.Vector3(p.x, p.y, p.z);
const ORIGIN = new THREE.Vector3();

export class SystemViewer {
  constructor(container, labels, onSelect, onFocus) {
    this.container = container; this.labelsElement = labels;
    this.onSelect = onSelect; this.onFocus = onFocus;
    this.bodies = new Map(); this.orbits = new Map(); this.belts = new Map(); this.labels = new Map();
    this.pickables = []; this.selectedId = null; this.followId = null;
    this.showLabels = true; this.showOrbits = true; this.simDays = 0;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#060a10');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(43, 1, .02, 3000);
    this.camera.position.set(115, 135, 170);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = .07;
    this.controls.minDistance = .9; this.controls.maxDistance = 440;
    this.controls.maxPolarAngle = Math.PI - .04; this.controls.minPolarAngle = .04;
    this.controls.zoomSpeed = .85; this.controls.rotateSpeed = .55;
    this.controls.addEventListener('start', () => { this.transition = null; });
    this.scene.add(new THREE.AmbientLight('#b4c7ed', .9));
    const sunLight = new THREE.PointLight('#fff1d7', 3.0, 0, 0);
    this.scene.add(sunLight);
    this.createStars(); this.createSun();
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
    this.controls.maxDistance=Math.max(440,260*Math.max(1,.95/this.camera.aspect)*1.7);
    this.renderer.setSize(width,height);
  }

  homePosition() {
    return new THREE.Vector3(115,135,170).multiplyScalar(Math.max(1,.95/this.camera.aspect));
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

  createSun() {
    const material=new THREE.ShaderMaterial({
      uniforms:{time:{value:0}},
      vertexShader:`varying vec3 vPos; varying vec3 vNormal; varying vec3 vEye; void main(){vPos=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vEye=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float time;varying vec3 vPos;varying vec3 vNormal;varying vec3 vEye;float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}void main(){vec3 p=vPos*17.0;float grain=hash(floor(p+time*.2));float waves=sin(p.x*.6+sin(p.y*.7)+time*.1)*sin(p.z*.5+sin(p.y));float edge=pow(max(dot(normalize(vNormal),normalize(vEye)),0.0),.38);vec3 c=mix(vec3(1.0,.31,.035),vec3(1.0,.77,.31),edge);c*=.88+grain*.15+waves*.08;gl_FragColor=vec4(c,1.0);}`,
      toneMapped:false,
    });
    this.sun=new THREE.Mesh(new THREE.SphereGeometry(SUN.radius,64,40),material);
    this.sun.userData.bodyId='sun'; this.pickables.push(this.sun); this.scene.add(this.sun);
    this.bodies.set('sun',{mesh:this.sun,root:this.sun,body:SUN});
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:'#ffc16d',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
    glow.scale.set(38,38,1); this.scene.add(glow);
    this.makeLabel(SUN);
  }

  createBody(body,seed) {
    const root=new THREE.Group(); const material=new THREE.MeshStandardMaterial({map:planetTexture(body,seed),roughness:1,metalness:0});
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(body.radius,48,32),material);
    mesh.rotation.z = body.id === 'uranus' ? 1.70 : body.id==='earth' ? .41 : body.id==='saturn' ? .47 : .05;
    mesh.userData.bodyId=body.id; this.pickables.push(mesh); root.add(mesh); this.scene.add(root);
    if(body.id==='saturn') {
      const geometry=new THREE.RingGeometry(body.radius*1.35,body.radius*2.25,128);
      const position=geometry.attributes.position, uv=geometry.attributes.uv;
      for(let i=0;i<position.count;i++) { const r=Math.hypot(position.getX(i),position.getY(i));uv.setXY(i,(r-body.radius*1.35)/(body.radius*.9),.5); }
      const rings=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:ringTexture(),side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));
      rings.rotation.x=Math.PI/2; const tilt=new THREE.Group(); tilt.rotation.z=.47; tilt.add(rings);root.add(tilt);
    }
    if(body.id==='earth'||body.id==='neptune') {
      const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(body.radius*1.04,40,24),new THREE.ShaderMaterial({
        uniforms:{color:{value:new THREE.Color(body.id==='earth'?'#5b9fe6':'#5589f4')}},
        vertexShader:`varying vec3 n;varying vec3 eye;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);eye=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
        fragmentShader:`uniform vec3 color;varying vec3 n;varying vec3 eye;void main(){float f=pow(1.0-abs(dot(normalize(n),normalize(eye))),3.0);gl_FragColor=vec4(color,f*.4);}`,
        transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.AdditiveBlending,
      }));root.add(atmosphere);
    }
    const orbit=this.createOrbit(body); this.bodies.set(body.id,{mesh,root,body}); this.orbits.set(body.id,orbit);
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
      const thickness=body.id==='kuiper-belt'?3.2:1.4;
      matrix.position.set(Math.cos(angle)*r,(rng()-.5)*thickness,Math.sin(angle)*r);
      matrix.rotation.set(rng()*3,rng()*3,rng()*3);
      const s=(body.id==='kuiper-belt'?.045:.055)+rng()*.10;
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
    this.referencePlane=new THREE.GridHelper(260,26,'#486175','#27374a');
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

  focus(id) {
    const body=BODY_BY_ID.get(id);if(!body)return;
    const radius=body.radius ?? body.outer;
    const distance=body.parent?Math.max(body.orbit*3.6,5):body.orbit?Math.max(radius*14,MOONS.filter(m=>m.parent===id).reduce((r,m)=>Math.max(r,m.orbit*3.3),0),12):radius*3.3;
    const target=body.parent?V(worldPosition(body.parent,this.simDays)):V(worldPosition(id,this.simDays));
    this.followId=body.parent?body.parent:body.orbit?id:null;
    const direction=this.camera.position.clone().sub(this.controls.target).normalize();
    this.transition={target,position:target.clone().addScaledVector(direction,distance),remaining:1};
  }

  home() {
    this.followId=null;
    this.transition={target:new THREE.Vector3(),position:this.homePosition(),remaining:1};
  }

  setView(view) {
    const distance=this.camera.position.distanceTo(this.controls.target);
    const direction=view==='top'?new THREE.Vector3(.001,1,.001):view==='side'?new THREE.Vector3(.1,.015,1):new THREE.Vector3(.48,.56,.71);
    this.transition={target:this.controls.target.clone(),position:this.controls.target.clone().addScaledVector(direction.normalize(),distance),remaining:1};
  }

  zoom(factor) {
    this.transition=null;
    const offset=this.camera.position.clone().sub(this.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,this.controls.minDistance,this.controls.maxDistance));
    this.camera.position.copy(this.controls.target).add(offset);this.controls.update();
  }

  update(days,realSeconds) {
    this.simDays=days;
    this.sun.material.uniforms.time.value=days;
    for(const [id,entry]of this.bodies) {
      if(id==='sun')continue;
      entry.root.position.copy(V(worldPosition(id,days)));
      const rotationPeriod=entry.body.spinHours?entry.body.spinHours/24:entry.body.period;
      entry.mesh.rotation.y=(days/rotationPeriod*Math.PI*2)%(Math.PI*2);
      const orbit=this.orbits.get(id);
      if(entry.body.parent)orbit.position.copy(V(worldPosition(entry.body.parent,days)));
      orbit.visible=this.showOrbits;
    }
    for(const [id,belt]of this.belts) {
      belt.group.rotation.y=days*(id==='asteroid-belt'?.0009:.00005);
      belt.edges.forEach(edge=>edge.visible=this.showOrbits);
    }
    if(this.followId) {
      const newTarget=V(worldPosition(this.followId,days));
      const delta=newTarget.clone().sub(this.lastFollowTarget??newTarget);
      this.camera.position.add(delta);this.controls.target.add(delta);
      if(this.transition) {this.transition.target.add(delta);this.transition.position.add(delta);}
      this.lastFollowTarget=newTarget;
    } else this.lastFollowTarget=null;
    if(this.transition) {
      const alpha=1-Math.exp(-realSeconds*6);
      this.camera.position.lerp(this.transition.position,alpha);this.controls.target.lerp(this.transition.target,alpha);
      this.transition.remaining-=realSeconds;
      if(this.transition.remaining<=0||this.camera.position.distanceTo(this.transition.position)<.005)this.transition=null;
    }
    this.controls.update();
    const selected=this.bodies.get(this.selectedId);
    if(selected) {
      this.marker.position.copy(selected.root.position);
      this.marker.quaternion.copy(this.camera.quaternion);
      const minRadius=this.camera.position.distanceTo(this.marker.position)*.009;
      this.marker.scale.setScalar(Math.max(selected.body.radius*1.45,minRadius));
    }
    this.camera.updateMatrixWorld();
    this.updateLabels();
    this.renderer.render(this.scene,this.camera);
  }

  updateLabels() {
    const cameraForward=new THREE.Vector3();this.camera.getWorldDirection(cameraForward);
    for(const [id,label]of this.labels) {
      const entry=this.bodies.get(id);const pos=entry.root.position;
      let visible=this.showLabels;
      const distance=this.camera.position.distanceTo(pos);
      if(entry.body.parent && !(entry.body.parent===this.selectedId || BODY_BY_ID.get(this.selectedId)?.parent===entry.body.parent || distance<25))visible=false;
      if(pos.clone().sub(this.camera.position).dot(cameraForward)<=0)visible=false;
      const projected=pos.clone().project(this.camera);
      if(projected.z>1||projected.z< -1||Math.abs(projected.x)>1.1||Math.abs(projected.y)>1.1)visible=false;
      if(visible&&entry.body.parent) {
        const parent=this.bodies.get(entry.body.parent);
        const rayDirection=pos.clone().sub(this.camera.position).normalize();
        const ray=new THREE.Ray(this.camera.position,rayDirection);
        const hit=ray.intersectSphere(new THREE.Sphere(parent.root.position,parent.body.radius*1.02),new THREE.Vector3());
        if(hit&&hit.distanceTo(this.camera.position)<distance)visible=false;
      }
      label.hidden=!visible;
      // Explicit display is needed because .body-label uses display:flex.
      label.style.display=visible?'flex':'none';
      if(!visible)continue;
      const apparentRadius=entry.body.radius/distance*this.height/(2*Math.tan(this.camera.fov*Math.PI/360));
      label.style.left=`${(projected.x*.5+.5)*this.width+Math.max(3,apparentRadius)}px`;
      label.style.top=`${(-projected.y*.5+.5)*this.height}px`;
    }
  }
}
