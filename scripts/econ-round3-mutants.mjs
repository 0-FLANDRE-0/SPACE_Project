// Isolated source mutation tests. The real model/game files are never patched.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),out=path.join(root,'docs/econ-sim/round3/logs'),base=path.join(root,'artifacts/econ3-mutants');fs.mkdirSync(base,{recursive:true});fs.mkdirSync(out,{recursive:true});
const mutants=[
 {id:'zero-power-electrolysis',file:'dist/src/economy-energy-model.js',from:'return {industryRatio,hPlans,hydrogenRatio:industryRatio};',to:'return {industryRatio,hPlans,hydrogenRatio:1};',test:'no electricity gives no electrolysis'},
 {id:'zero-h-full-fusion',file:'dist/src/economy-energy-facilities.js',from:'availableHydrogenU/normalHydrogenU*5*monthHours',to:'Infinity',test:'normal fusion uses output-proportional'},
 {id:'free-paused-upkeep',file:'dist/src/economy-energy-facilities.js',from:'stopped?p.pausedAlloyFraction:',to:'stopped?0:',test:'stopped facilities retain high alloy'},
 {id:'free-96h-startup',file:'dist/src/economy-energy-facilities.js',from:'if(startPrimitive(end).input-start.input>externalGWh+1e-10)',to:'if(false)',test:'96 wall hours without external power'},
 {id:'government-self-sale',file:'dist/src/economy-energy-model.js',from:'b.flow.governmentExternalSalesC+=sales;',to:'b.flow.governmentSelfSalesC+=govSelf*tariff;b.flow.governmentExternalSalesC+=sales;',test:'government self generation never'},
 {id:'duplicate-old-proxy',file:'dist/src/economy-energy-model.js',from:'upkeep(s,b);',to:"upkeep(s,b);pay(s,b.id,'government','household',s.tech.totalInvestmentC*s.p.governmentOperatingRate/12,'mutant-old-proxy');",test:'legacy operating proxies have zero effect'},
 {id:'borrow-earth-stock',file:'dist/src/economy-energy-model.js',from:"function stock(s,planet,owner,resource){return s.book.get(account(planet,owner,resource))/1000;}",to:"function stock(s,planet,owner,resource){return s.book.get(account(planet!=='earth'&&resource==='alloy'?'earth':planet,owner,resource))/1000;}",test:'an empty colony cannot borrow Earth alloy'},
 {id:'free-storage-energy',file:'dist/src/economy-energy-facilities.js',from:'socGWh*efficiency);',to:'socGWh/efficiency);',test:'storage cannot create energy'}
];
const results=[];
for(const mutant of mutants){
 const dir=path.join(base,mutant.id);fs.mkdirSync(dir,{recursive:true});
 for(const f of ['dist/src','dist/data/planet-surfaces','scripts/econ-round3-inputs.mjs','scripts/econ-round3.config.json','docs/econ-sim/round2/candidates.json','tests/economy-energy-model.test.js']){const target=path.join(dir,f);fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(path.join(root,f),target,{recursive:true});}
 fs.writeFileSync(path.join(dir,'package.json'),'{"type":"module"}\n');
 const target=path.join(dir,mutant.file),source=fs.readFileSync(target,'utf8');if(source.split(mutant.from).length!==2)throw Error('Mutation anchor must occur once: '+mutant.id);
 fs.writeFileSync(target,source.replace(mutant.from,mutant.to));
 const syntax=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});if(syntax.status!==0)throw Error('Invalid syntax mutant '+mutant.id);
 const run=spawnSync(process.execPath,['--test','--test-name-pattern',mutant.test,'tests/economy-energy-model.test.js'],{cwd:dir,encoding:'utf8'}),log=run.stdout+run.stderr;
 fs.writeFileSync(path.join(out,'mutant-'+mutant.id+'.log'),log.split('\n').map(line=>line.trimEnd()).join('\n'));
 const killed=run.status!==0&&/fail 1/.test(log)&&!/SyntaxError|ERR_MODULE_NOT_FOUND/.test(log);results.push({id:mutant.id,test:mutant.test,syntaxValid:true,killed,exitCode:run.status});
 console.log(mutant.id+': '+(killed?'KILLED':'SURVIVED'));if(!killed)throw Error('Mutation survived: '+mutant.id);
}
fs.writeFileSync(path.join(out,'mutations.json'),JSON.stringify({mutants:results.length,killed:results.filter(r=>r.killed).length,results},null,2)+'\n');
