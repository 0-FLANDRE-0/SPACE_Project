import { refreshAlternativeResourceConfiguration } from './resource-contract.js';
import { clone, createSurfaceTemplate, resolvedSurfaceCell, validateSurfaceTemplate } from './planetary-surface-model.js';
export const surfaceStorageKey=grid=>`space-project:surface:v1:${encodeURIComponent(grid.systemId)}:${encodeURIComponent(grid.bodyId)}`;
// Strict parser preserves the distinction between duplicate IDs and last-key wins.
export function parseSurfaceJSON(text){
 if(typeof text!=='string'||text.length>5*1024*1024)throw Error('JSON 파일은 최대 5 MiB입니다.');let i=0;
 const whitespace=()=>{while(/\s/.test(text[i]??'')&&i<text.length)i++;};
 const string=()=>{const start=i++;while(i<text.length){const c=text[i++];if(c==='\\'){i++;continue;}if(c==='"')return JSON.parse(text.slice(start,i));}throw Error('닫히지 않은 JSON 문자열입니다.');};
 const value=(depth=0)=>{if(depth>32)throw Error('JSON 중첩이 너무 깊습니다.');whitespace();const c=text[i];
  if(c==='"')return string();
  if(c==='{'||c==='['){const object=c==='{',result=object?Object.create(null):[],seen=new Set(),end=object?'}':']';i++;whitespace();if(text[i]===end){i++;return result;}while(i<text.length){whitespace();let key;if(object){if(text[i]!=='"')throw Error('JSON 키는 문자열이어야 합니다.');key=string();if(seen.has(key))throw Error('중복 JSON 키/셀 ID: '+key);seen.add(key);whitespace();if(text[i++]!==':')throw Error('JSON 콜론이 없습니다.');}const v=value(depth+1);if(object)result[key]=v;else result.push(v);whitespace();if(text[i]===end){i++;return result;}if(text[i++]!==',')throw Error('JSON 구분자가 잘못되었습니다.');}throw Error('닫히지 않은 JSON 구조입니다.');}
  const literal=/^(true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));if(!literal)throw Error('JSON 값이 올바르지 않습니다.');i+=literal[0].length;return JSON.parse(literal[0]);};
 const result=value();whitespace();if(i!==text.length)throw Error('JSON 끝에 잘못된 문자가 있습니다.');return result;
}
export function importSurfaceJSON(text,grid,body){const data=parseSurfaceJSON(text);validateSurfaceTemplate(data,grid,body);return clone(data);}
export class SurfaceDrafts {
 constructor({storage=null,onWarning=()=>{},fetcher=null}={}){this.storage=storage;this.onWarning=onWarning;this.fetcher=fetcher;this.entries=new Map();this.manifestPromise=null;}
 async load(grid,body){const key=surfaceStorageKey(grid);if(this.entries.has(key))return this.entries.get(key);let template=createSurfaceTemplate(grid,body),blocked=false,source='미설정 기본 템플릿';
  if(this.fetcher){try{this.manifestPromise??=this.fetcher('./data/planet-surfaces/index.json').then(r=>{if(!r.ok)throw Error('manifest HTTP '+r.status);return r.json();});const manifest=await this.manifestPromise;if(manifest.schemaVersion!==1)throw Error('정적 manifest 버전 불일치');const path=manifest.templates?.[`${encodeURIComponent(grid.systemId)}:${encodeURIComponent(grid.bodyId)}`];if(path){const r=await this.fetcher(path);if(!r.ok)throw Error('preset HTTP '+r.status);template=importSurfaceJSON(await r.text(),grid,body);source='정적 프리셋: '+path;}}catch(error){this.onWarning('정적 표면 프리셋을 읽지 못해 미설정 기본값을 사용합니다: '+error.message);}}
  try{const raw=this.storage?.getItem(key);if(raw){template=importSurfaceJSON(raw,grid,body);source='유효한 로컬 초안 (정적 프리셋보다 우선)';}}catch(error){blocked=true;this.onWarning('로컬 표면 원본을 보존합니다. 현재 탭 편집은 내보내기로 백업하세요: '+error.message);}
  const entry={key,grid,body,template,previous:null,blocked,source,saveError:null};this.entries.set(key,entry);return entry;
 }
 persist(entry,explicitReplacement=false){try{if(entry.blocked&&!explicitReplacement)throw Error('손상/구버전 원본 보존 중');if(!this.storage)throw Error('브라우저 저장소 사용 불가');if(explicitReplacement){const raw=this.storage.getItem(entry.key),backup=raw??(entry.previous?JSON.stringify(entry.previous):null);if(backup)this.storage.setItem(entry.key+':backup',backup);}this.storage.setItem(entry.key,JSON.stringify(entry.template));entry.blocked=false;entry.saveError=null;return true;}catch(error){entry.saveError=error.message;this.onWarning('표면 편집은 메모리에만 유지됩니다. JSON으로 백업하세요: '+error.message);return false;}}
 commit(entry,next,{replace=false}={}){validateSurfaceTemplate(next,entry.grid,entry.body);entry.previous=clone(entry.template);entry.template=clone(next);entry.source='현재 작성/편집 초안';return this.persist(entry,replace);}
 applyCell(entry,id,geology,scenario){const next=clone(entry.template);next.geology.cells[id]=clone(geology);next.startingScenario.cells[id]=clone(scenario);if(JSON.stringify(entry.template.geology.cells[id]?.deposits??null)!==JSON.stringify(geology.deposits))refreshAlternativeResourceConfiguration(next);return this.commit(entry,next);}
 undo(entry){if(!entry.previous)throw Error('되돌릴 표면 적용이 없습니다.');const previous=entry.previous;validateSurfaceTemplate(previous,entry.grid,entry.body);entry.template=clone(previous);entry.previous=null;return this.persist(entry);}
 cell(entry,id){return resolvedSurfaceCell(entry.template,entry.grid,entry.body,id);}
 export(entry){validateSurfaceTemplate(entry.template,entry.grid,entry.body);return JSON.stringify(entry.template,null,2);}
 preview(entry,text){return importSurfaceJSON(text,entry.grid,entry.body);}
}
