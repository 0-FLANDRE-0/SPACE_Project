import { quantileDistribution, facilityDistribution, FACILITY_MAP_COLORS, DISTRIBUTION_COLORS } from './surface-distribution-model.js';
import { confirmedOreAtTile } from './resource-knowledge.js';
import { personsToPOP } from './resource-definitions.js';
const $=s=>document.querySelector(s),names={ore:'매장량(알려진)',population:'인구 분포',facilities:'시설 분포'};
export class SurfaceDistributions {
 constructor(surface){this.surface=surface;this.mode=null;this.layers=new Map();this.dirty=true;this.revision=0;this.abort=new AbortController();for(const b of document.querySelectorAll('[data-surface-distribution]'))b.addEventListener('click',()=>{this.mode=this.mode===b.dataset.surfaceDistribution?null:b.dataset.surfaceDistribution;this.dirty=true;this.refresh();surface.renderInfo();},{signal:this.abort.signal});}
 reset(){this.mode=null;this.layers.clear();this.lastEntry=null;this.lastTemplate=null;this.dirty=true;this.refresh();}
 invalidate(){this.dirty=true;this.refresh();}
 setDeveloperLayer(owner,colors,connections=null){if(colors)this.layers.set(owner,{colors,connections});else this.layers.delete(owner);this.dirty=true;this.refresh();}
 release(owner){this.layers.delete(owner);this.dirty=true;this.refresh();}
 refresh(){const s=this.surface,view=s.viewer.surface;for(const b of document.querySelectorAll('[data-surface-distribution]'))b.setAttribute('aria-pressed',String(this.mode===b.dataset.surfaceDistribution));if(!s.entry||!view){$('#surface-distribution-legend').hidden=true;return;}
  if(this.lastEntry!==s.entry||this.lastTemplate!==s.entry.template){this.lastEntry=s.entry;this.lastTemplate=s.entry.template;this.dirty=true;}if(!this.dirty)return;this.dirty=false;
  const privateLayer=this.layers.get('resources')??this.layers.get('generation');if(privateLayer||this.mode!=='facilities')view.setFacilityOutlines(null);if(privateLayer){view.setAuthoringColors(privateLayer.colors,{opacity:1});view.setAuthoringConnections(privateLayer.connections);$('#surface-distribution-legend').hidden=true;return;}
  if(!this.mode){view.setAuthoringColors(null);view.setAuthoringConnections(null);$('#surface-distribution-legend').hidden=true;return;}
  const runtime=s.industry?.store?.state,template=s.entry.template,values=new Map();this.values=values;this.revision++;
  if(this.mode==='facilities'){const data=facilityDistribution(runtime,s.entry.body.id);this.facilities=data.tiles;view.setAuthoringColors(null);view.setAuthoringConnections(null);view.setFacilityOutlines(data.tiles);this.legend(Object.entries(FACILITY_MAP_COLORS).map(([state,color])=>({color,text:({construction:'건설 중',rampup:'가동 준비',active:'가동 중',stopped:'정지/고갈'})[state]})),'정부 런타임 시설 · 초기 메타데이터 제외');return;}
  view.setFacilityOutlines(null);for(const t of s.entry.grid.tiles)values.set(t.id,this.mode==='population'?personsToPOP(template.startingScenario.cells[t.id]?.populationPersons??null):confirmedOreAtTile(template,t.id,{runtime}).value);
  const scale=quantileDistribution(values);this.scale=scale;view.setAuthoringColors(scale.colors,{opacity:1});view.setAuthoringConnections(null);const unit=this.mode==='population'?'POP':'U',fmt=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:this.mode==='population'?6:3});
  this.legend([{color:DISTRIBUTION_COLORS.unknown,text:`미확인·미설정 ${scale.unknownCount}구역`},{color:DISTRIBUTION_COLORS.zero,text:`확인된 0 ${scale.zeroCount}구역`},...scale.bands.map(b=>({color:b.color,text:`${fmt(b.min)}${b.max===b.min?'':'–'+fmt(b.max)} ${unit}`}))],'행성 내 상대 분포');
 }
 legend(items,subtitle){const box=$('#surface-distribution-legend');box.hidden=false;box.replaceChildren();const title=document.createElement('strong');title.textContent=names[this.mode];const p=document.createElement('small');p.textContent=subtitle;box.append(title,p);if(this.mode==='population'&&this.surface.entry.body.id==='earth'){const source=document.createElement('small'),officialPopulation=this.surface.entry.officialPopulation,official=officialPopulation&&Object.keys(officialPopulation).length===92&&Object.entries(officialPopulation).every(([id,n])=>this.surface.entry.template.startingScenario.cells[id]?.populationPersons===n);source.textContent=official?'GHSL E2025 비율 · ©EU 2023 · 총8,893 POP':'현재 탭의 인구 시나리오 · 새로고침 초기화';box.append(source);}for(const item of items){const row=document.createElement('span'),color=document.createElement('i');color.style.background=item.color;row.append(color,document.createTextNode(item.text));box.append(row);}}
 dispose(){this.abort.abort();this.layers.clear();}
}
