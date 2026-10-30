import { gameAUToWorld } from './game-space.js';
import { gamePositionToSector } from './hex-sectors.js';
import { add, mul } from './system-context.js';
const KIND_NAMES={star:'항성',planet:'행성',moon:'위성',belt:'소천체 영역'};
const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number(value).toLocaleString('ko-KR',{maximumFractionDigits:3});
export function placeContextPanel(anchor,width,height,viewport,{top=68,bottom=90,margin=12}={}) {
  const maxX=Math.max(margin,viewport.width-width-margin),maxY=Math.max(top,viewport.height-height-bottom);
  const gap=(anchor.pixelRadius??0)+16;
  let x=anchor.x+gap;
  if(x+width>viewport.width-margin)x=anchor.x-gap-width;
  const y=anchor.y-height*.4;
  return{x:Math.max(margin,Math.min(maxX,x)),y:Math.max(top,Math.min(maxY,y))};
}
export class ContextPanel {
  constructor(element,{onFocus,onClose,onSurface}) {this.element=element;this.onFocus=onFocus;this.onClose=onClose;this.onSurface=onSurface;this.selection=null;this.abort=new AbortController();element.addEventListener('click',e=>{if(e.target.closest('[data-surface]')&&this.selection?.kind==='body')onSurface?.(this.selection.bodyId);if(e.target.closest('[data-close]'))onClose();if(e.target.closest('[data-focus]')&&this.selection?.kind==='body')onFocus(this.selection.bodyId,element.querySelector('[data-focus-mode]')?.value??'surface');},{signal:this.abort.signal});}
  setSelection(selection,context) {
    this.selection=selection;this.context=context;this.position=null;this.lastContentUpdate=-Infinity;this.element.hidden=true;
    if(!selection){this.element.replaceChildren();return;}
    if(selection.kind==='sector') {
      this.element.innerHTML=`<div class="panel-heading"><span class="eyebrow">섹터</span><button data-close class="panel-close" aria-label="선택 해제">×</button></div><h2>${escape(selection.sector.id)}</h2><dl class="panel-values"><div><dt>중심에서의 링</dt><dd>${selection.sector.ring}</dd></div></dl><div class="sector-members"><span class="eyebrow">현재 천체</span><p data-members></p><p data-current-admin></p></div>`;
      return;
    }
    const body=context.bodyById.get(selection.bodyId);if(!body){this.element.hidden=true;return;}
    const rows=[];
    if(body.kind==='planet')rows.push(['Planet Size',body.planetSize]);
    if(body.kind==='star'&&body.starSize!==undefined)rows.push(['Star Size',body.starSize]);
    if(body.orbitGameAU)rows.push(['궤도 장반경',number(body.orbitGameAU)+' 게임 AU']);
    if(body.kind==='belt')rows.push(['영역',number(body.innerGameAU)+'–'+number(body.outerGameAU)+' 게임 AU']);
    if(body.parent)rows.push(['모행성',context.bodyById.get(body.parent)?.name??body.parent]);
    const detailRows=[];
    if(body.realRadiusKm)detailRows.push(['실제 반지름',number(body.realRadiusKm)+' km']);
    if(body.period)detailRows.push(['공전 주기',number(Math.abs(body.period))+' 일']);
    if(body.temperatureK)detailRows.push(['유효 온도',number(body.temperatureK)+' K']);
    const satellites=context.moons.filter(m=>m.parent===body.id);
    const orbitMode=!!body.orbitGameAU||satellites.length>0;
    this.element.innerHTML=`<div class="panel-heading"><span class="eyebrow">${escape(KIND_NAMES[body.kind]??body.kind)}</span><button data-close class="panel-close" aria-label="선택 해제">×</button></div><h2>${escape(body.name)}</h2><p class="panel-type">${escape(body.kind==='star'?[body.spectralType,body.stellarClass].filter(Boolean).join(' · '):body.type??KIND_NAMES[body.kind])}</p><dl class="panel-values">${rows.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><div class="panel-actions">${orbitMode?'<select data-focus-mode aria-label="확대 범위"><option value="surface">천체</option><option value="orbit">주변 궤도</option></select>':''}<button class="focus-button" data-focus>확대 <span>↗</span></button></div>${['planet','moon'].includes(body.kind)?'<button data-surface class="surface-open-button">표면 지도 ↗</button>':''}<p class="panel-sector" data-current-sector></p><p class="panel-sector" data-current-admin></p>${detailRows.length?`<details class="reference-details"><summary>천문 참고 정보</summary><dl>${detailRows.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></details>`:''}`;
  }
  update(viewer,days,seconds) {
    const selection=this.selection;if(!selection)return;
    let anchor;
    if(selection.kind==='body') {
      const body=this.context.bodyById.get(selection.bodyId);
      if(body.kind==='belt') {
        let point=selection.anchorWorld;
        if(!point){const center=body.centerGameAU??this.context.systemCenterGameAU,p=add(center,mul(this.context.sectorPlane.tangentU,(body.innerGameAU+body.outerGameAU)/2));point={x:gameAUToWorld(p.x),y:gameAUToWorld(p.y),z:gameAUToWorld(p.z)};}
        anchor=viewer.projectWorld(point);
      } else anchor=viewer.projectionFor(body.id);
    } else anchor=viewer.projectWorld(selection.sector.anchorWorld);
    const visible=!!anchor?.visible;
    this.element.hidden=!visible;if(!visible){this.position=null;return;}
    if(days-this.lastContentUpdate>.002||days<this.lastContentUpdate||this.lastContentUpdate===-Infinity){
      if(selection.kind==='sector') {
        const members=viewer.sectors.members(days,selection.sector.id);this.element.querySelector('[data-members]').textContent=members.length?members.map(b=>b.name).join(' · '):'현재 천체 없음';
      } else {
        const body=this.context.bodyById.get(selection.bodyId),sector=body.kind==='belt'?null:gamePositionToSector(this.context,this.context.gamePosition(body.id,days),viewer.sectors.grid);
        this.element.querySelector('[data-current-sector]').textContent=sector?'SECTOR  '+sector.id:'';
      }
      const currentSector=selection.kind==='sector'?selection.sector:this.context.bodyById.get(selection.bodyId).kind==='belt'?null:gamePositionToSector(this.context,this.context.gamePosition(selection.bodyId,days),viewer.sectors.grid);
      const region=currentSector?this.administration?.forSector(currentSector.id):null,field=this.element.querySelector('[data-current-admin]');if(field)field.textContent=region?`현재 위치 행정구: ${region.name} · ${region.id} · ${region.sectorIds.length}칸`:'현재 위치 행정구: 미지정';
      this.lastContentUpdate=days;
    }
    const size={width:this.element.offsetWidth,height:this.element.offsetHeight};
    const target=placeContextPanel(anchor,size.width,size.height,{width:viewer.width,height:viewer.height});
    const alpha=this.position?1-Math.exp(-seconds*16):1;
    this.position=this.position?{x:this.position.x,y:this.position.y}:target;
    this.position.x+=(target.x-this.position.x)*alpha;this.position.y+=(target.y-this.position.y)*alpha;
    // Clamp immediately after rotation/resize even while smoothing.
    this.position.x=Math.max(12,Math.min(viewer.width-size.width-12,this.position.x));this.position.y=Math.max(68,Math.min(viewer.height-size.height-90,this.position.y));
    this.element.style.transform=`translate3d(${Math.round(this.position.x)}px,${Math.round(this.position.y)}px,0)`;
  }
  dispose(){this.abort.abort();this.selection=null;this.element.replaceChildren();this.element.hidden=true;}
}
