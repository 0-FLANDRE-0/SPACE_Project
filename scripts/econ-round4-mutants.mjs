import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=process.cwd(),out=path.join(root,'docs/econ-sim/round4/logs'),base=path.join(root,'artifacts/econ4-mutants');fs.mkdirSync(base,{recursive:true});
const mutants=[
 {id:'free-cross-body-stock',file:'economy-round4-units.js',from:"book.move(src,dst,amountQ,'SCU-content-transfer');",to:"book.source(dst,amountQ,'mutant-free-material');",test:'same-government cross-body shipment'},
 {id:'unpackaged-transfer',file:'economy-round4-units.js',from:'alloyQ:physical.materialQ.alloy',to:'alloyQ:0',test:'same-government cross-body shipment'},
 {id:'over-unity-salvage',file:'economy-round4-model.js',from:'returnedQ=Math.floor(amountQ*s.r.salvageFraction)',to:'returnedQ=amountQ+1',test:'dismantling pays C'},
 {id:'free-parked-alloy',file:'economy-round4-facilities.js',from:'pausedAlloyFraction:r.pausedAlloyFraction',to:'pausedAlloyFraction:0',test:'normal and parked upkeep'},
 {id:'free-restart',file:'economy-round4-model.js',from:'const cost=restartCharge(a,s.r).creditC*s.priceIndex',to:'const cost=0',test:'an actual industrial restart'},
 {id:'wrong-electrolysis',file:'economy-round4-model.js',from:"s.book.source(account(b.id,a.owner,'oxygen'),n,'electrolysis-oxygen')",to:"s.book.source(account(b.id,a.owner,'oxygen'),n*8,'electrolysis-oxygen')",test:'simulator water/oxygen units'},
 {id:'early-small-fusion',file:'economy-round4-facilities.js',from:"size==='small'||size==='medium'",to:"size==='medium'",test:'small fusion is unavailable'},
 {id:'inverted-priority',file:'economy-round4-facilities.js',from:"a.kind==='legacyGrid'||a.essential?0:",to:"a.kind==='legacyGrid'||a.essential?3:",test:'scarce alloy pays essential'},
 {id:'required-instead-of-occupied',file:'economy-round4-units.js',from:'creditC:physical.occupiedSCU*r.packCPerSCU',to:'creditC:physical.requiredSCU*r.packCPerSCU',test:'minimum .001U packing'}
];
const results=[];for(const m of mutants){
 const dir=path.join(base,m.id);fs.mkdirSync(dir,{recursive:true});
 for(const f of ['dist/src','dist/data/planet-surfaces','scripts/econ-round3-inputs.mjs','scripts/econ-round4.config.json','docs/econ-sim/round2/candidates.json','docs/econ-sim/round3/candidates.json','tests/economy-round4.test.js']){const target=path.join(dir,f);fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(path.join(root,f),target,{recursive:true});}
 fs.writeFileSync(path.join(dir,'package.json'),'{"type":"module"}\n');const file=path.join(dir,'dist/src',m.file),source=fs.readFileSync(file,'utf8');if(source.split(m.from).length!==2)throw Error('Unique mutation anchor required: '+m.id);fs.writeFileSync(file,source.replace(m.from,m.to));
 const syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(syntax.status!==0)throw Error('Invalid syntax mutant');const run=spawnSync(process.execPath,['--test','--test-name-pattern',m.test,'tests/economy-round4.test.js'],{cwd:dir,encoding:'utf8'}),log=run.stdout+run.stderr,killed=run.status!==0&&/fail 1/.test(log)&&!/SyntaxError|ERR_MODULE_NOT_FOUND/.test(log);
 fs.writeFileSync(out+'/mutant-'+m.id+'.log',log.split('\n').map(x=>x.trimEnd()).join('\n'));results.push({id:m.id,test:m.test,syntaxValid:true,killed,exitCode:run.status});console.log(m.id+': '+(killed?'KILLED':'SURVIVED'));if(!killed)throw Error('Mutant survived');
}fs.writeFileSync(out+'/mutations.json',JSON.stringify({mutants:results.length,killed:results.filter(x=>x.killed).length,results},null,2)+'\n');
