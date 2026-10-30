import { Simulation } from './model.js';
import { SystemViewer } from './scene.js';
import { createSolContext } from './system-context.js';
import { ContextPanel } from './context-panel.js';
import { loadSurfaceMaps } from './textures.js';
const $=s=>document.querySelector(s);
let context=createSolContext(),selection=null,viewer=null,toastTimer;
const simulation=new Simulation(context.bodyById);
const panel=new ContextPanel($('#context-panel'),{onClose:()=>viewer?.select(null),onFocus:(id,mode)=>viewer?.focus(id,mode)});
function closeSettings(){$('#settings').hidden=true;$('#settings-toggle').setAttribute('aria-expanded','false');}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2000);}
function onSelection(value){selection=value;simulation.select(value?.kind==='body'?value.bodyId:null);panel.setSelection(value,context);$('#body-picker').value=value?.kind==='body'?value.bodyId:'';}
function renderContextHeader(){
  $('#system-name').textContent=context.displayName;$('#system-code').textContent=context.systemId.toUpperCase();document.title='SPACE · '+context.displayName;
  $('#body-picker').replaceChildren(new Option('천체 선택',''),...context.allBodies.map(body=>new Option(body.name,body.id)));
  const grid=viewer?.sectors.grid;if(grid)$('#grid-diagnostics').textContent=`${grid.radiusGameAU} 게임 AU / ${grid.ringCount}링 / ${grid.sectorCount}칸\n관리 반경 ${grid.extent.paddedRadiusGameAU.toFixed(1)} AU`;
}
async function setSystem(value){
  let next=value;
  if(typeof value==='string'){
    const {SYSTEM_FACTORIES}=await import('./fixtures/systems.js');if(!SYSTEM_FACTORIES[value])throw new Error('Unknown fixture');next=SYSTEM_FACTORIES[value]();
  }
  context=next;selection=null;simulation.setSystem(context);panel.setSelection(null,context);viewer.setSystemContext(context);closeSettings();$('#hover-sector').hidden=true;renderContextHeader();
}
function home(inner=false){viewer.select(null);viewer.home(inner);closeSettings();}
function togglePause(){simulation.paused=!simulation.paused;$('#pause').innerHTML=`<svg><use href="#i-${simulation.paused?'play':'pause'}"/></svg>`;$('#pause').setAttribute('aria-label',simulation.paused?'시간 재개':'일시정지');$('#pause').setAttribute('aria-pressed',String(simulation.paused));$('#time-status').classList.toggle('paused',simulation.paused);$('#time-status span').textContent=simulation.paused?'일시정지':'진행 중';}
$('#pause').addEventListener('click',togglePause);
$('#home').addEventListener('click',()=>home());$('#inner-view').addEventListener('click',()=>home(true));
$('#settings-toggle').addEventListener('click',()=>{const open=$('#settings').hidden;$('#settings').hidden=!open;$('#settings-toggle').setAttribute('aria-expanded',String(open));});$('#settings-close').addEventListener('click',closeSettings);
$('#body-picker').addEventListener('change',e=>{viewer.select(e.target.value||null);closeSettings();});
$('#hex-toggle').addEventListener('click',()=>{const enabled=$('#hex-toggle').getAttribute('aria-pressed')!=='true';$('#hex-toggle').setAttribute('aria-pressed',String(enabled));$('#hex-toggle').classList.toggle('active',enabled);viewer.sectors.setEnabled(enabled);$('#hover-sector').hidden=true;});
$('#zoom-in').addEventListener('click',()=>viewer?.zoom(.78));$('#zoom-out').addEventListener('click',()=>viewer?.zoom(1.28));
for(const button of document.querySelectorAll('[data-speed]'))button.addEventListener('click',()=>{simulation.speed=Number(button.dataset.speed);for(const other of document.querySelectorAll('[data-speed]')){const active=other===button;other.classList.toggle('active',active);other.setAttribute('aria-pressed',String(active));}});
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{viewer.setView(button.dataset.view);closeSettings();});
for(const [id,key]of [['show-labels','showLabels'],['show-orbits','showOrbits'],['show-axes','showAxes'],['show-plane','showReferencePlane']])$('#'+id).addEventListener('change',e=>{viewer[key]=e.target.checked;});
$('#help').addEventListener('click',()=>{closeSettings();$('#help-dialog').showModal();});$('#close-help').addEventListener('click',()=>$('#help-dialog').close());
document.addEventListener('keydown',e=>{
  if($('#help-dialog').open||e.target.closest('input,select,textarea'))return;
  if(e.code==='Space'&&!e.target.closest('button,summary')){e.preventDefault();togglePause();}
  if(e.key.toLowerCase()==='h')home();
  if(e.key==='Escape'){closeSettings();viewer?.select(null);}
});
try {
  const surfaces=await loadSurfaceMaps(context.surfaceFiles);
  viewer=new SystemViewer($('#viewport'),context,{labels:$('#labels'),surfaces,onSelection,onHover:sector=>{$('#hover-sector').hidden=!sector;if(sector)$('#hover-sector').textContent=sector.id+' · R'+sector.ring;}});
  renderContextHeader();$('#loading').hidden=true;
  const params=new URLSearchParams(location.search);
  if(params.has('dev')){
    $('#developer-controls').hidden=false;
    const {SYSTEM_FACTORIES}=await import('./fixtures/systems.js');$('#system-picker').replaceChildren(...Object.entries(SYSTEM_FACTORIES).map(([key,factory])=>new Option(factory().displayName,key)));
    $('#system-picker').addEventListener('change',e=>setSystem(e.target.value).catch(error=>{console.error(error);toast('시험계 전환 실패');}));
    if(params.has('system')){await setSystem(params.get('system'));$('#system-picker').value=params.get('system');}
  }
  window.spacePrototype={simulation,viewer,panel,get context(){return context;},get selection(){return selection;},setSystem,select:id=>viewer.select(id),focus:(id,mode)=>viewer.focus(id,mode),home};
  let last=performance.now(),uiElapsed=0;
  function frame(now){
    if(viewer.disposed)return;const seconds=Math.min((now-last)/1000,.1);last=now;
    if(!document.hidden)simulation.advance(seconds);viewer.update(simulation.days,seconds);panel.update(viewer,simulation.days,seconds);uiElapsed+=seconds;
    if(uiElapsed>.15){uiElapsed=0;const date=new Date(Date.parse(context.epochISO)+simulation.days*86400000);$('#sim-date').textContent=`${date.getUTCFullYear()}.${String(date.getUTCMonth()+1).padStart(2,'0')}.${String(date.getUTCDate()).padStart(2,'0')}`;$('#scale-label').textContent=viewer.scale.value.toLocaleString('ko-KR',{maximumFractionDigits:3})+' AU';$('#scale-bar').style.width=viewer.scale.pixels+'px';}
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',()=>{last=performance.now();});
  window.addEventListener('pagehide',()=>{panel.dispose();viewer.dispose();for(const texture of Object.values(surfaces))texture.dispose();});
  requestAnimationFrame(frame);
}catch(error){console.error(error);$('#loading').innerHTML='<p>지도를 시작할 수 없습니다.<br>페이지를 새로고침하고 WebGL·하드웨어 가속 설정을 확인해주세요.</p>';}
