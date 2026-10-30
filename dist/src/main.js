import { SUN, PLANETS, MOONS, BELTS, BODY_BY_ID, EPOCH } from './data.js';
import { Simulation, axialTilt } from './model.js';
import { SystemViewer } from './scene.js';
import { loadSurfaceMaps } from './textures.js';
import { bodyDiameterGameAU, starDiameterGameAU } from './game-space.js';

const $=selector=>document.querySelector(selector);
const simulation=new Simulation();
const byId=id=>BODY_BY_ID.get(id);
let viewer;
let toastTimeout;
function toast(message) {$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').classList.remove('visible'),2400);}

function row(body) {
  const moons=MOONS.filter(m=>m.parent===body.id);
  return `<button class="body-row" data-select="${body.id}" title="${body.name} 선택" aria-pressed="false"><span class="body-swatch ${body.id}" style="background:${body.color}"></span><span class="body-row-text"><span class="body-name">${body.name}</span><span class="body-english">${body.english}</span></span><span class="row-end">${moons.length?`${moons.length} ☾`:'<svg><use href="#i-chevron"/></svg>'}</span></button>${moons.length?`<div class="moon-rows" data-moons="${body.id}" hidden>${moons.map(m=>`<button class="moon-row" data-select="${m.id}" aria-pressed="false"><span class="moon-dot" style="background:${m.color}"></span>${m.name}</button>`).join('')}</div>`:''}`;
}
$('#body-list').innerHTML=row(SUN)+'<div class="list-separator"></div>'+PLANETS.map(row).join('')+'<div class="list-separator"></div>'+BELTS.map(row).join('');
$('#body-list').addEventListener('click',event=>{const button=event.target.closest('[data-select]');if(button)select(button.dataset.select);});
$('#body-list').addEventListener('dblclick',event=>{const button=event.target.closest('[data-select]');if(button)focus(button.dataset.select);});

function stat(label,value,unit='') {return `<div class="stat"><dt>${label}</dt><dd>${value}${unit?`<small>${unit}</small>`:''}</dd></div>`;}
function showDetails(id) {
  const body=byId(id);const panel=$('#details');panel.classList.toggle('overview',!body);panel.classList.remove('expanded');
  if(!body) {
    panel.innerHTML=`<div class="detail-top"><span class="eyebrow">SYSTEM OVERVIEW</span><span class="live-dot"></span></div><div class="detail-title"><h3>태양계</h3><span class="english">SOL</span></div><div class="detail-type"><span class="tiny" style="background:#dfbd80"></span>G2V · 황색 주계열성</div><svg class="overview-graphic" viewBox="0 0 180 64"><ellipse cx="90" cy="32" rx="80" ry="25" transform="rotate(-10 90 32)"/><ellipse cx="90" cy="32" rx="58" ry="18" transform="rotate(-10 90 32)"/><ellipse cx="90" cy="32" rx="34" ry="11" transform="rotate(-10 90 32)"/><circle cx="90" cy="32" r="6" fill="#dfbd80"/><circle cx="142" cy="38" r="3" fill="#a2bacf"/><circle cx="62" cy="27" r="2" fill="#8eb3d9"/><circle cx="16" cy="51" r="2.5" fill="#b9a98d"/></svg><p class="detail-description">하나의 항성, 여덟 개의 행성.<br>아직 쓰이지 않은 우리의 이야기.</p><dl class="detail-stats">${stat('행성','08')}${stat('표시된 위성',String(MOONS.length).padStart(2,'0'))}</dl><p class="overview-hint">천체를 선택하면 상세 정보와<br>해당 천체의 공전 궤도가 나타납니다.</p><div class="detail-bottom"><span>SECTOR 001</span><span class="state"><span class="live-dot"></span>관측 중</span></div>`;
    return;
  }
  const moons=MOONS.filter(m=>m.parent===id);
  const isBelt=BELTS.some(b=>b.id===id);
  let gameStats,referenceStats;
  if(body.kind==='star') {
    gameStats=stat('Star Size',body.starSize)+stat('게임 표시 지름',starDiameterGameAU(body),'AU');
    referenceStats=stat('유효 온도',body.temperatureK.toLocaleString(),'K')+stat('분광형',body.spectralType)+stat('실제 반지름',body.realRadiusKm.toLocaleString(),'km')+stat('태양 반지름 기준',body.realRadiusSolar,'R☉');
  } else if(isBelt) {
    gameStats=stat('게임 거리 범위',`${body.innerGameAU}–${body.outerGameAU}`,'AU')+stat('표시 입자 수',body.count.toLocaleString(),'개');
    referenceStats=stat('실제 참고 범위',`${body.realInnerAU}–${body.realOuterAU}`,'실제 AU');
  } else {
    gameStats=stat(body.parent?'모행성 중심 장반경':'태양 중심 장반경',body.orbitGameAU,'AU')+(body.parent?stat('위성 게임 지름',bodyDiameterGameAU(body),'AU'):stat('Planet Size · 지름',body.planetSize,'AU'));
    referenceStats=stat('실제 공전 주기',Math.abs(body.period).toLocaleString('en-US',{maximumFractionDigits:2}),'일')+stat('궤도 경사',Math.abs(body.inclination).toFixed(2),'°')+stat('자전축 기울기',axialTilt(body).toFixed(2),'°')+stat('실제 자전 주기',Math.abs(body.spinHours).toFixed(2),'시간')+stat('실제 반지름',body.realRadiusKm.toLocaleString(),'km')+stat('실제 궤도 장반경',body.realOrbitAU.toLocaleString('en-US',{maximumFractionDigits:5}),'실제 AU');
  }
  const satelliteLinks=moons.length?`<div class="satellite-links" aria-label="${body.name}의 위성">${moons.map(m=>`<button data-select="${m.id}">${m.name}</button>`).join('')}</div>`:'';
  panel.innerHTML=`<div class="detail-top"><span class="eyebrow">${body.parent?'SATELLITE':isBelt?'SMALL BODIES':'CELESTIAL BODY'}</span><div class="detail-heading-actions"><button class="detail-expand" data-expand aria-expanded="false" title="상세 정보 펼치기">자세히</button><button class="detail-close" data-clear title="선택 해제" aria-label="선택 해제"><svg><use href="#i-cross"/></svg></button></div></div><div class="detail-title"><h3>${body.name}</h3><span class="english">${body.english}</span></div><div class="detail-type"><span class="tiny" style="background:${body.color}"></span>${body.type}</div><p class="detail-description">${body.description}</p><div class="stats-heading game-heading">게임 공간 · AU</div><dl class="detail-stats game-stats">${gameStats}</dl><div class="stats-heading reference-heading">천문학 참고 · 현실 측정값</div><dl class="detail-stats reference-stats">${referenceStats}</dl>${satelliteLinks}<button class="detail-action" data-focus="${id}"><svg><use href="#i-focus"/></svg>${isBelt?'영역 중심으로 보기':body.parent?'위성 표면 보기':'천체 표면 보기'}<span style="margin-left:auto;color:#5e7184;font-size:9px">F</span></button>${!isBelt&&id!=='sun'?`<button class="detail-action orbit-action" data-focus-orbit="${id}"><svg><use href="#i-orbit"/></svg>주변 궤도 보기</button>`:''}<div class="detail-bottom"><span>${moons.length?`${moons.length} SATELLITES`:'SOL / HOME SYSTEM'}</span><span class="state"><span class="live-dot"></span>${isBelt?'영역 선택됨':'궤도 선택됨'}</span></div>`;
}

function select(id) {
  if(!simulation.select(id))return;
  if(viewer) {viewer.followId=null;viewer.lastFollowTarget=null;viewer.transition=null;viewer.select(id);}
  const body=byId(id);
  document.querySelectorAll('[data-select]').forEach(button=>{const active=button.dataset.select===id;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('[data-moons]').forEach(element=>{element.hidden=!(element.dataset.moons===id||element.dataset.moons===body?.parent);});
  $('#map-title').textContent=body?.name??'모항성계';
  $('#map-subtitle').textContent=body?`${body.english} / ${body.type}`:'우리의 첫 번째 항성계';
  showDetails(id);
  $('#details').scrollTop=0;
}
function focus(id) {if(!viewer)return;if(simulation.selectedId!==id)select(id);viewer.lastFollowTarget=null;viewer.focus(id);toast(`${byId(id).name} 주변으로 카메라 이동`);}
$('#details').addEventListener('click',event=>{const satellite=event.target.closest('[data-select]');if(satellite){select(satellite.dataset.select);return;}const expand=event.target.closest('[data-expand]');if(expand){const expanded=$('#details').classList.toggle('expanded');expand.setAttribute('aria-expanded',String(expanded));expand.textContent=expanded?'접기':'자세히';}if(event.target.closest('[data-clear]'))select(null);const orbitButton=event.target.closest('[data-focus-orbit]');if(orbitButton){viewer.lastFollowTarget=null;viewer.focus(orbitButton.dataset.focusOrbit,'orbit');toast('주변 궤도로 시점 이동');}const button=event.target.closest('[data-focus]');if(button)focus(button.dataset.focus);});
function togglePause() {
  simulation.paused=!simulation.paused;
  $('#pause').innerHTML=`<svg><use href="#i-${simulation.paused?'play':'pause'}"/></svg>`;
  $('#pause').setAttribute('aria-label',simulation.paused?'시간 재개':'일시정지');
  $('#pause').setAttribute('aria-pressed',String(simulation.paused));
  $('#time-state').textContent=simulation.paused?'일시정지':'시간 흐르는 중';
  $('.time-indicator .live-dot').style.background=simulation.paused?'#dfbd80':'';
}
$('#pause').addEventListener('click',togglePause);
document.querySelectorAll('[data-speed]').forEach(button=>button.addEventListener('click',()=>{simulation.speed=Number(button.dataset.speed);document.querySelectorAll('[data-speed]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});}));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{viewer?.setView(button.dataset.view);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===button));}));
$('#reset-view').addEventListener('click',()=>home());
$('#inner-system').addEventListener('click',()=>{select(null);viewer?.home(true);toast('내행성 영역 · 게임 AU');});
function home() {select(null);viewer?.home();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='perspective'));}
$('#zoom-in').addEventListener('click',()=>viewer?.zoom(.78));$('#zoom-out').addEventListener('click',()=>viewer?.zoom(1.28));
function toggleButton(id,callback) {$(id).addEventListener('click',()=>{const button=$(id);const active=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(active));button.classList.toggle('active',active);callback(active);});}
toggleButton('#toggle-labels',value=>{if(viewer)viewer.showLabels=value;});
toggleButton('#toggle-orbits',value=>{if(viewer)viewer.showOrbits=value;});
toggleButton('#toggle-plane',value=>{if(viewer)viewer.referencePlane.visible=value;});
toggleButton('#toggle-axes',value=>{if(viewer)viewer.showAxes=value;});
$('#help').addEventListener('click',()=>$('#help-dialog').showModal());
$('#close-help').addEventListener('click',()=>$('#help-dialog').close());
$('#help-dialog').addEventListener('click',e=>{if(e.target===$('#help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.addEventListener('keydown',event=>{
  if(event.target.matches('input,textarea,select')||$('#help-dialog').open)return;
  if(event.code==='Space'&&!event.target.closest('button,a')){event.preventDefault();togglePause();}
  if(event.key.toLowerCase()==='h')home();
  if(event.key.toLowerCase()==='f'&&simulation.selectedId)focus(simulation.selectedId);
  if(event.key==='Escape')select(null);
});
showDetails(null);
try {
  const surfaces=await loadSurfaceMaps();
  viewer=new SystemViewer($('#viewport'),$('#labels'),select,focus,surfaces);
  // Kept explicit for prototype inspection and meaningful browser regression checks.
  window.spacePrototype={simulation,viewer,select,focus,home};
  viewer.update(0,0);
  $('#loading').classList.add('hidden');
  let last=performance.now();let uiElapsed=0;
  const epoch=new Date(EPOCH).getTime();
  function frame(now) {
    const seconds=Math.min((now-last)/1000,.1);last=now;
    if(!document.hidden)simulation.advance(seconds);
    viewer.update(simulation.days,seconds);uiElapsed+=seconds;
    if(uiElapsed>.15) {
      const scale=viewer.scale;
      $('#scale-label').textContent=scale.value.toLocaleString('ko-KR',{maximumFractionDigits:3})+' '+scale.unit;
      $('#scale-bar').style.width=scale.pixels+'px';
      $('#scale-mode').textContent='게임 거리 · AU';
      $('#scale').dataset.unit=scale.unit;
      uiElapsed=0;
      const date=new Date(epoch+simulation.days*86400000);
      $('#sim-date').textContent=`${date.getUTCFullYear()}.${String(date.getUTCMonth()+1).padStart(2,'0')}.${String(date.getUTCDate()).padStart(2,'0')}`;
      const delta=viewer.camera.position.clone().sub(viewer.controls.target);
      const angle=Math.round(Math.asin(delta.y/delta.length())*180/Math.PI);
      $('#camera-angle').textContent=`고도 ${angle>=0?'+':''}${angle}°`;
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',()=>{last=performance.now();});
  requestAnimationFrame(frame);
} catch(error) {
  console.error(error);
  $('#loading').innerHTML='<p>3D 지도를 시작할 수 없습니다.<br>페이지를 새로고침하고 WebGL과 하드웨어 가속 설정을 확인해주세요.</p>';
  toast('3D 렌더러 초기화 실패');
}
