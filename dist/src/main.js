import {ContinuousHUD} from './ui1-ui.js';
import {SurveyRuntime} from './survey-runtime.js';
import {SurveyUI} from './survey-ui.js';
import {resetDevelopmentStorage} from './development-session.js';
import { IndustryUI } from './industry-ui.js';
import { PlanetarySurfaceUI } from './planetary-surface-ui.js';
import { DeveloperMode } from './developer-mode.js';
import { FullscreenControl } from './fullscreen-control.js';
import { ForegroundClock, formatGameDate, BASE_GAME_SECONDS_PER_REAL_SECOND } from './time-control.js';
import { AdministrativeRegionUI } from './administrative-region-ui.js';
import { Simulation } from './model.js';
import { SystemViewer } from './scene.js';
import { createSolContext } from './system-context.js';
import { ContextPanel } from './context-panel.js';
import { loadSurfaceMaps } from './textures.js';
import { ShipFleet } from './ship-fleet.js';
import { ShipUI } from './ship-ui.js';
const $=s=>document.querySelector(s);
const developmentReset=resetDevelopmentStorage(()=>window.localStorage);
let context=createSolContext(),selection=null,viewer=null,administration=null,surfaceUI=null,developer=null,fullscreen=null,industry=null,toastTimer;
let fleet=null,shipUI=null,survey=null,surveyUI=null,ui1=null,industryIdentity=null;
const foregroundClock=new ForegroundClock(performance.now(),!document.hidden);
const simulation=new Simulation(context.bodyById);
const worldEpochISO=context.epochISO;
const panel=new ContextPanel($('#context-panel'),{onClose:()=>viewer?.select(null),onSurface:id=>surfaceUI?.open(id),onFocus:(id,mode)=>viewer?.focus(id,mode)});
function closeSettings(){$('#settings').hidden=true;$('#settings-toggle').setAttribute('aria-expanded','false');}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2000);}
function onSelection(value){selection=value;simulation.select(value?.kind==='body'?value.bodyId:null);panel.setSelection(value?.kind==='ship'?null:value,context);$('#body-picker').value=value?.kind==='body'?value.bodyId:'';administration?.observeSelection(value);surfaceUI?.observeSelection(value);shipUI?.observeSelection(value);}
function installFleet(){surveyUI?.dispose();survey?.dispose();shipUI?.dispose();fleet=new ShipFleet(context,{now:simulation.days*86400});shipUI=new ShipUI(viewer,fleet,simulation,{notify:toast,sync:()=>advanceClock(performance.now())});industryIdentity=industry?.store?.state;survey=new SurveyRuntime(fleet,industry.catalog,{runtime:industry.store.state,onAdvance:t=>{if(t/86400>=industry.store.state.days)industry.advance(t/86400);},onEvent:e=>toast(({ 'rough-complete':'대략 탐사 완료','sector-complete':'섹터 정밀 탐사 완료','queue-complete':'전체 탐사 대기열 완료','route-blocked':'탐사 이동 경로 중단'})[e.kind]+' · '+context.bodyById.get(e.bodyId).name)});surveyUI=new SurveyUI({runtime:survey,shipUI,surface:surfaceUI,simulation,sync:()=>advanceClock(performance.now()),notify:toast});industry.onTimeAdvance=days=>{const result=survey.advanceTo(days*86400,{pauseOnArrival:false,pauseOnCompletion:false});simulation.days=result.time/86400;};if(selection?.kind==='ship')viewer.select(null);}
function renderContextHeader(){
  $('#system-name').textContent=context.displayName;$('#system-code').textContent=context.systemId.toUpperCase();document.title='SPACE · '+context.displayName;
  $('#body-picker').replaceChildren(new Option('천체 선택',''),...context.allBodies.map(body=>new Option(body.name,body.id)));
  const grid=viewer?.sectors.grid;if(grid)$('#grid-diagnostics').textContent=`${grid.radiusGameAU} 게임 AU / ${grid.ringCount}링 / ${grid.sectorCount}칸\n관리 반경 ${grid.extent.paddedRadiusGameAU.toFixed(1)} AU`;
}
async function setSystem(value){
  surfaceUI?.exit(false);
  let next=value;
  if(typeof value==='string'){
    const {SYSTEM_FACTORIES}=await import('./fixtures/systems.js');if(!SYSTEM_FACTORIES[value])throw new Error('Unknown fixture');next=SYSTEM_FACTORIES[value]();
  }
  advanceClock(performance.now());surveyUI?.dispose();surveyUI=null;survey?.dispose();survey=null;shipUI?.dispose();shipUI=null;fleet=null;context=next;selection=null;simulation.setSystem(context);panel.setSelection(null,context);viewer.setSystemContext(context);administration?.setSystem();foregroundClock.setVisible(!document.hidden,performance.now());closeSettings();$('#developer-drawer').hidden=true;$('#developer-tools').setAttribute('aria-expanded','false');$('#hover-sector').hidden=true;await industry?.load(context);installFleet();renderContextHeader();if(typeof value==='string')$('#system-picker').value=value;
}
function home(inner=false){surveyUI?.cancelSelection();surfaceUI?.waiters.splice(0).forEach(w=>w.resolve(null));surfaceUI?.exit(false);ui1?.closePopup();if(shipUI)shipUI.layer.followId=null;viewer.select(null);viewer.home(inner);closeSettings();}
function renderPause(){ $('#pause').innerHTML=`<svg><use href="#i-${simulation.paused?'play':'pause'}"/></svg>`;$('#pause').setAttribute('aria-label',simulation.paused?'시간 재개':'일시정지');$('#pause').setAttribute('aria-pressed',String(simulation.paused));$('#time-status').classList.toggle('paused',simulation.paused);$('#time-status span').textContent=simulation.paused?'일시정지':'진행 중';}
function advanceClock(now){const seconds=foregroundClock.sample(now);if(fleet){if(industryIdentity!==industry?.store?.state||simulation.days*86400<fleet.now-1e-6)installFleet();if(simulation.days*86400>fleet.now+1e-6)survey.advanceTo(simulation.days*86400,{pauseOnArrival:false,pauseOnCompletion:false});const result=survey.advanceTo(fleet.now+simulation.gameSecondsFor(seconds));simulation.days=result.time/86400;if(result.paused){simulation.paused=true;renderPause();}}else simulation.advance(seconds);industry?.advance(simulation.days);if(foregroundClock.suspended)toast('긴 대기에서 복귀했습니다. 대기 시간은 정산하지 않습니다.');return seconds;}
function renderSpeed(){const speed=simulation.effectiveSpeed;$('#speed-menu-toggle').textContent=speed+'× ▴';$('#speed-description').textContent=`${speed}× = 현실 1초당 게임 ${speed*BASE_GAME_SECONDS_PER_REAL_SECOND}초 · UTC`;for(const b of document.querySelectorAll('[data-speed]')){const active=Number(b.dataset.speed)===speed;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}}
function togglePause(){advanceClock(performance.now());simulation.paused=!simulation.paused;renderPause();}
$('#pause').addEventListener('click',togglePause);
$('#home').addEventListener('click',()=>home());$('#inner-view').addEventListener('click',()=>home(true));
$('#settings-toggle').addEventListener('click',()=>{const open=$('#settings').hidden;if(open){$('#developer-drawer').hidden=true;$('#developer-tools').setAttribute('aria-expanded','false');}$('#settings').hidden=!open;$('#settings-toggle').setAttribute('aria-expanded',String(open));});$('#settings-close').addEventListener('click',closeSettings);
$('#body-picker').addEventListener('change',e=>{viewer.select(e.target.value||null);closeSettings();});
$('#hex-toggle').addEventListener('click',()=>{const enabled=$('#hex-toggle').getAttribute('aria-pressed')!=='true';$('#hex-toggle').setAttribute('aria-pressed',String(enabled));$('#hex-toggle').classList.toggle('active',enabled);viewer.sectors.setEnabled(enabled);$('#hover-sector').hidden=true;});
$('#zoom-in').addEventListener('click',()=>viewer?.zoom(.78));$('#zoom-out').addEventListener('click',()=>viewer?.zoom(1.28));
$('#speed-menu-toggle').addEventListener('click',()=>{const open=$('#speed-menu').hidden;$('#speed-menu').hidden=!open;$('#speed-menu-toggle').setAttribute('aria-expanded',String(open));});
for(const button of document.querySelectorAll('[data-speed]'))button.addEventListener('click',()=>{advanceClock(performance.now());simulation.setRequestedSpeed(Number(button.dataset.speed));renderSpeed();$('#speed-menu').hidden=true;$('#speed-menu-toggle').setAttribute('aria-expanded','false');});
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{viewer.setView(button.dataset.view);closeSettings();});
for(const [id,key]of [['show-labels','showLabels'],['show-orbits','showOrbits'],['show-axes','showAxes'],['show-plane','showReferencePlane']])$('#'+id).addEventListener('change',e=>{viewer[key]=e.target.checked;});
$('#help').addEventListener('click',()=>{closeSettings();$('#help-dialog').showModal();});$('#close-help').addEventListener('click',()=>$('#help-dialog').close());
document.addEventListener('keydown',e=>{
  if($('#help-dialog').open||e.target.closest('input,select,textarea'))return;
  if(e.code==='Space'&&!e.target.closest('button,summary')){e.preventDefault();togglePause();}
  if(e.key.toLowerCase()==='h')home();
  if(e.key.toLowerCase()==='c'&&shipUI?.selectedId){e.preventDefault();shipUI.cancel();}
  if(e.key==='Escape'&&(document.fullscreenElement||performance.now()-(fullscreen?.lastExit??-Infinity)<500))return;
  if(e.key==='Escape'&&surfaceUI?.selectedId){if(industry?.selectedSlot!==null){industry.selectedSlot=null;industry.dirty=true;industry.render();}else surfaceUI.selectTile(null);return;}
  if(e.key==='Escape'){surfaceUI?.exit(true);closeSettings();$('#speed-menu').hidden=true;administration?.close();viewer?.select(null);}
});
try {
  const surfaces=await loadSurfaceMaps(context.surfaceFiles);
  viewer=new SystemViewer($('#viewport'),context,{labels:$('#labels'),surfaces,onSelection,onHover:sector=>{$('#hover-sector').hidden=!sector;if(sector)$('#hover-sector').textContent=sector.id+' · R'+sector.ring;}});
  administration=new AdministrativeRegionUI({viewer,panel,onError:toast});
  renderContextHeader();renderSpeed();foregroundClock.setVisible(!document.hidden,performance.now());
  const params=new URLSearchParams(location.search);let developerSystems;
  const ensureDeveloperSystems=()=>developerSystems??=(async()=>{const {SYSTEM_FACTORIES}=await import('./fixtures/systems.js');$('#system-picker').replaceChildren(...Object.entries(SYSTEM_FACTORIES).map(([key,factory])=>new Option(factory().displayName,key)));$('#system-picker').addEventListener('change',e=>setSystem(e.target.value).catch(error=>{console.error(error);toast('시험계 전환 실패');}));})();
  surfaceUI=new PlanetarySurfaceUI({viewer,panel,administration,notify:toast,isDeveloper:()=>developer?.enabled??false});
  developer=new DeveloperMode({logo:$('#developer-gesture'),button:$('#developer-tools'),drawer:$('#developer-drawer'),exit:$('#developer-exit'),onOpen:closeSettings,onChange:enabled=>{$('#developer-controls').hidden=!enabled;surfaceUI.setDeveloper(enabled);if(enabled)ensureDeveloperSystems().catch(error=>toast(error.message));}});
  industry=new IndustryUI(surfaceUI,simulation,{notify:toast,sync:()=>advanceClock(performance.now())});
  await industry.load(context);
  installFleet();
  ui1=new ContinuousHUD({viewer,surface:surfaceUI,industry,getSurvey:()=>survey,getShipUI:()=>shipUI});
  $('#map').append($('#help-dialog'));
  fullscreen=new FullscreenControl($('#map'),$('#fullscreen-toggle'),{notify:toast,onResize:()=>requestAnimationFrame(()=>viewer.resize())});
  developer.setEnabled(params.has('dev'));
  if(params.has('dev')){await ensureDeveloperSystems();if(params.has('system')){await setSystem(params.get('system'));$('#system-picker').value=params.get('system');}}
  $('#loading').hidden=true;
  window.spacePrototype={developmentReset,simulation,industry,viewer,panel,administration,surfaceUI,developer,fullscreen,foregroundClock,get fleet(){return fleet;},get shipUI(){return shipUI;},get survey(){return survey;},get surveyUI(){return surveyUI;},get ui1(){return ui1;},get context(){return context;},get selection(){return selection;},setSystem,select:id=>viewer.select(id),focus:(id,mode)=>viewer.focus(id,mode),home};
  let uiElapsed=0;
  function frame(now){
    if(viewer.disposed)return;const elapsed=advanceClock(now),seconds=Math.min(elapsed,.1);
    industry.update(now);viewer.update(simulation.days,seconds);shipUI?.update();surveyUI?.update(now);ui1?.update(now);if(surfaceUI.active)panel.element.hidden=true;else panel.update(viewer,simulation.days,seconds);uiElapsed+=seconds;
    if(uiElapsed>.15){uiElapsed=0;$('#sim-date').textContent=formatGameDate(worldEpochISO,simulation.days);renderSpeed();$('#scale-label').textContent=viewer.scale.value.toLocaleString('ko-KR',{maximumFractionDigits:3})+' AU';$('#scale-bar').style.width=viewer.scale.pixels+'px';}
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',()=>{foregroundClock.setVisible(!document.hidden,performance.now());});
  window.addEventListener('pagehide',()=>{advanceClock(performance.now());surveyUI?.dispose();surveyUI=null;survey?.dispose();survey=null;shipUI?.dispose();ui1?.dispose();industry.dispose();surfaceUI.dispose();developer.dispose();fullscreen.dispose();administration.dispose();panel.dispose();viewer.dispose();for(const texture of Object.values(surfaces))texture.dispose();});
  requestAnimationFrame(frame);
}catch(error){console.error(error);$('#loading').innerHTML='<p>지도를 시작할 수 없습니다.<br>페이지를 새로고침하고 WebGL·하드웨어 가속 설정을 확인해주세요.</p>';}
