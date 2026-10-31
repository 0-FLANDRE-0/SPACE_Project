import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createSolContext} from '../dist/src/system-context.js';
import {createPlanetarySurfaceGrid} from '../dist/src/planetary-surface-grid.js';
import {IndustryCatalog,orderConstruction,advanceIndustry} from '../dist/src/industry-runtime.js';
import {IndustryStore} from '../dist/src/industry-storage.js';
import {initializeIndustryFixture} from '../dist/src/industry-fixture.js';
import {MINING} from '../dist/src/industry-policy.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const base=process.env.BASE_URL||'http://127.0.0.1:5173',oldEarth=JSON.parse(execFileSync('git',['show','ec242b3:dist/data/planet-surfaces/sol-earth-v2.json'],{maxBuffer:10*1024*1024})),pkg=JSON.parse(await fs.readFile('dist/data/planet-surfaces/earth-population-e1.json')),context=createSolContext(),catalog=new IndustryCatalog('sol'),errors=[];
for(const body of [...context.planets,...context.moons])catalog.register({body,grid:createPlanetarySurfaceGrid('sol',body),template:body.id==='earth'?oldEarth:JSON.parse(await fs.readFile(`dist/data/planet-surfaces/sol-${body.id}-v2.json`))});
const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},store=new IndustryStore(catalog,{storage,fixture:true});initializeIndustryFixture(store);const source=[...catalog.hydrogen.values()].find(h=>store.state.hydrogenKnowledge.human.includes(h.key));orderConstruction(store.state,catalog,{bodyId:'earth',tileId:source.tileId,slot:0,type:MINING});advanceIndustry(store.state,catalog,650.125);store.persist();const oldState=JSON.parse(store.export()),raw=JSON.stringify(oldState),key=store.key,surfaceKey='space-project:surface:v1:sol:earth';
const normalise=s=>{const copy=structuredClone(s);delete copy.sourceSignatures.earth;delete copy.days;return copy;};
async function setup(viewport,{local=false,bad=false}={}){const c=await browser.newContext({viewport,hasTouch:viewport.width<1000,isMobile:viewport.width<1000,acceptDownloads:true});const state=structuredClone(oldState);if(bad)state.sourceSignatures.moon='unknown';const input=JSON.stringify(state);await c.addInitScript(({key,input,surfaceKey,oldEarth,local})=>{localStorage.setItem(key,input);if(local)localStorage.setItem(surfaceKey,JSON.stringify(oldEarth));},{key,input,surfaceKey,oldEarth,local});const p=await c.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.goto(base+'/?dev=1',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.spacePrototype);await p.locator('#pause').click();await p.evaluate(()=>spacePrototype.industry.switchCampaign(true));return {c,p,input};}
try{
 for(const viewport of [{width:1440,height:1000},{width:844,height:390},{width:390,height:844}]){
  const {c,p}=await setup(viewport,{local:true});
  assert.equal(await p.evaluate(()=>spacePrototype.industry.store.blocked),false);
  for(const k of [key,key+':population-e1:backup',surfaceKey,surfaceKey+':backup'])assert.equal(await p.evaluate(k=>localStorage.getItem(k),k),null);
  const fresh=await p.evaluate(()=>structuredClone(spacePrototype.industry.store.state));
  assert.equal(fresh.sourceSignatures.earth,pkg.after.templateSignature);assert.equal(fresh.days,0);assert.deepEqual(fresh.facilityInstances,{});assert.deepEqual(fresh.oreRemaining,{});assert.equal(fresh.governmentTreasuries.human,100000);
  assert.equal(await p.evaluate(()=>Object.values(spacePrototype.surfaceUI.entry.template.startingScenario.cells).reduce((n,c)=>n+c.populationPersons,0)),8893000000);
  assert.equal(await p.evaluate(()=>spacePrototype.surfaceUI.populationUI),undefined);assert.equal(await p.locator('#surface-population-update').isVisible(),false);
  // Retained compatibility code is tested with an isolated Map adapter. It is
  // never attached to the live app or the browser's persistent storage.
  const legacy=await p.evaluate(async({oldState,oldEarth,pkg})=>{
   const {IndustryStore}=await import('./src/industry-storage.js');
   const {SurfaceDrafts}=await import('./src/planetary-surface-io.js');
   const cat=spacePrototype.industry.catalog,raw=JSON.stringify(oldState),key='space-project:industry:v1:sol:fixture',map=new Map([[key,raw]]),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
   const migrated=new IndustryStore(cat,{storage,fixture:true,populationUpdate:pkg});
   const record=cat.bodies.get('earth'),surfaceKey='space-project:surface:v1:sol:earth';storage.setItem(surfaceKey,JSON.stringify(oldEarth));
   const drafts=new SurfaceDrafts({storage}),entry=await drafts.load(record.grid,record.body);
   return {state:migrated.state,backup:storage.getItem(key+':population-e1:backup'),blocked:migrated.blocked,template:entry.template,liveTransient:spacePrototype.industry.store.transient};
  },{oldState,oldEarth,pkg});
  assert.equal(legacy.blocked,false);assert.equal(legacy.backup,raw);assert.deepEqual(normalise(legacy.state),normalise(oldState));assert.deepEqual(legacy.template,oldEarth);assert.equal(legacy.liveTransient,true);
  await c.close();console.log(`PASS: ${viewport.width} old population drafts/campaigns discarded; fresh official92 cells and fixture; retained legacy migration isolated from app storage`);
 }
 const blocked=await setup({width:844,height:390},{bad:true});assert.equal(await blocked.p.evaluate(()=>spacePrototype.industry.store.blocked),false);assert.equal(await blocked.p.evaluate(k=>localStorage.getItem(k),key),null);assert.equal(await blocked.p.evaluate(k=>localStorage.getItem(k+':population-e1:backup'),key),null);await blocked.c.close();assert.deepEqual(errors,[]);console.log('PASS: incompatible old trial state removed without migration; no browser errors');
}finally{await browser.close();}
