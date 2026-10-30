import { AdministrativeRegions, REGION_COLORS } from './administrative-regions.js';
const $=s=>document.querySelector(s);
export class AdministrativeRegionUI {
  constructor({viewer,panel,onError}){
    this.viewer=viewer;this.panel=panel;this.onError=onError;this.mode='exploration';this.editing=false;this.preview=new Set();this.abort=new AbortController();
    let storage=null;try{storage=localStorage;}catch{onError('로컬 저장에 접근할 수 없어 현재 탭에서만 편집됩니다.');}
    this.model=new AdministrativeRegions(viewer.sectors.grid,{storage,onError,onChange:()=>this.changed()});
    viewer.onEditSector=sector=>this.toggleCell(sector.id);
    $('#map-mode').addEventListener('change',e=>this.setMode(e.target.value),{signal:this.abort.signal});
    $('#admin-toggle').addEventListener('click',()=>{const drawer=$('#admin-drawer');if(!drawer.hidden){this.close();return;}drawer.hidden=false;$('#admin-toggle').setAttribute('aria-expanded',String(!drawer.hidden));},{signal:this.abort.signal});
    $('#admin-close').addEventListener('click',()=>this.close(),{signal:this.abort.signal});
    $('#admin-edit').addEventListener('click',()=>this.setEditing(!this.editing),{signal:this.abort.signal});
    $('#admin-clear').addEventListener('click',()=>{this.preview.clear();this.renderPreview();},{signal:this.abort.signal});
    $('#admin-ring-select').addEventListener('click',()=>{this.preview=new Set(this.model.idsForRing(Number($('#admin-ring').value)));this.renderPreview();},{signal:this.abort.signal});
    $('#admin-target').addEventListener('change',()=>{this.selectedId=$('#admin-target').value||null;this.viewer.sectors.administration.setSelected(this.selectedId);this.render();},{signal:this.abort.signal});
    for(const button of document.querySelectorAll('[data-admin-action]'))button.addEventListener('click',()=>this.apply(button.dataset.adminAction),{signal:this.abort.signal});
    this.connect();
  }
  connect(){this.viewer.sectors.administration.rebuild(this.model);this.viewer.sectors.administration.mode=this.mode;this.panel.administration=this.model;this.render();}
  setSystem(){this.mode='exploration';this.editing=false;this.preview.clear();this.selectedId=null;this.model.setGrid(this.viewer.sectors.grid);this.viewer.administrationEditing=false;$('#map-mode').value=this.mode;this.close();this.connect();}
  setMode(mode){this.mode=mode;this.viewer.sectors.administration.mode=mode;$('#map-mode').value=mode;$('#admin-toggle').hidden=mode!=='administration';if(mode==='exploration'){this.setEditing(false);this.close();}this.panel.lastContentUpdate=-Infinity;}
  close(){this.setEditing(false);$('#admin-drawer').hidden=true;$('#admin-toggle').setAttribute('aria-expanded','false');}
  setEditing(value){if(value&&this.viewer.surface){this.onError('표면 지도에서 돌아온 뒤 행정 셀을 편집하세요.');return;}this.editing=value;this.viewer.administrationEditing=value;$('#admin-edit').textContent=value?'편집 종료':'셀 편집 시작';$('#admin-edit').setAttribute('aria-pressed',String(value));$('#admin-editor').hidden=!value;$('#admin-drawer').classList.toggle('editing',value);if(value){this.viewer.select(null);this.viewer.sectors.setEnabled(true);$('#hex-toggle').setAttribute('aria-pressed','true');$('#hex-toggle').classList.add('active');}else{this.preview.clear();this.renderPreview();}$('#admin-hint').textContent=value?'셀을 눌러 추가·해제하세요. 변경은 적용 전까지 미리보기입니다.':'보기 상태 · 천체 선택이 우선합니다.';}
  toggleCell(id){if(!this.editing)return;this.preview.has(id)?this.preview.delete(id):this.preview.add(id);this.renderPreview();}
  renderPreview(){this.viewer.sectors.administration.setPreview([...this.preview]);const owned=[...this.preview].filter(id=>this.model.forSector(id));$('#admin-selection').textContent=`미리보기 ${this.preview.size}칸${owned.length?' · 기존 구역 소속 '+owned.length+'칸 (생성/추가 충돌 검사)':''}`;}
  syncFields(){const r=this.model.region(this.selectedId);$('#admin-name').value=r?.name??'';$('#admin-color').value=r?.color??REGION_COLORS[0];}
  renderInfo(){const r=this.model.region(this.selectedId);$('#admin-info').textContent=r?`${r.id} · ${r.sectorIds.length}칸 · 링 ${Math.min(...r.sectorIds.map(id=>this.model.grid.byId.get(id).ring))}–${Math.max(...r.sectorIds.map(id=>this.model.grid.byId.get(id).ring))}`:'구역을 선택하거나 새 구역을 만드세요.';}
  render(){
    $('#admin-target').replaceChildren(new Option('대상 구역 선택',''),...this.model.regions.map(r=>new Option(r.name,r.id)));$('#admin-target').value=this.selectedId??'';
    $('#admin-absorb').replaceChildren(new Option('흡수할 인접 구역',''),...this.model.regions.filter(r=>r.id!==this.selectedId).map(r=>new Option(r.name,r.id)));
    $('#admin-ring').replaceChildren(...Array.from({length:this.model.grid.ringCount+1},(_,i)=>new Option('기초 육각 '+i+'링',i)));
    $('#admin-color').replaceChildren(...REGION_COLORS.map((c,i)=>new Option(['청록','청회','황금','자주','연두'][i],c)));
    $('#admin-recover').hidden=!this.model.storageBlocked&&!this.model.quarantined.has(this.model.systemId);this.syncFields();this.renderInfo();this.renderPreview();$('#admin-count').textContent=this.model.regions.length+'개 행정구역';
  }
  changed(){if(!this.model.region(this.selectedId))this.selectedId=null;this.viewer.sectors.administration.rebuild(this.model);this.viewer.sectors.administration.setSelected(this.selectedId);this.render();this.panel.lastContentUpdate=-Infinity;}
  apply(action){
    try{
      const ids=[...this.preview],id=this.selectedId;let created;
      if(action==='create')created=this.model.create(ids,$('#admin-name').value,$('#admin-color').value);
      if(action==='add')this.model.add(id,ids);
      if(action==='remove')this.model.remove(id,ids);
      if(action==='update')this.model.update(id,{name:$('#admin-name').value,color:$('#admin-color').value});
      if(action==='merge')this.model.merge(id,[$('#admin-absorb').value]);
      if(action==='delete')this.model.delete(id);
      if(action==='undo')this.model.undo();
      if(action==='recover')this.model.resetInvalidStorage();
      if(created)this.selectedId=created;
      this.preview.clear();this.viewer.sectors.administration.setSelected(this.selectedId);this.render();$('#admin-error').textContent=this.model.saveError?'편집됨 · 로컬 저장 실패':'적용했습니다.';
    }catch(error){$('#admin-error').textContent=error.message;}
  }
  observeSelection(selection){if(!this.editing&&(!selection||selection.kind!=='sector')){this.selectedId=null;this.viewer.sectors.administration.setSelected(null);this.render();}if(selection?.kind==='sector'&&this.mode==='administration'){const r=this.model.forSector(selection.sector.id);this.selectedId=r?.id??null;this.viewer.sectors.administration.setSelected(this.selectedId);this.render();}}
  dispose(){this.abort.abort();this.viewer.onEditSector=null;}
}
