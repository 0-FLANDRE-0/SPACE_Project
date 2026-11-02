// Extra paired replays to value outage avoidance without labelling it sales.
import fs from 'node:fs';
import {simulateEnergyEconomy} from '../dist/src/economy-energy-model.js';
import {readRound3Inputs} from './econ-round3-inputs.mjs';
const dir='docs/econ-sim/round3/',e=JSON.parse(fs.readFileSync(dir+'candidates.json')).recommended.energy,p=JSON.parse(fs.readFileSync('docs/econ-sim/round2/candidates.json')).recommended.parameters,config=JSON.parse(fs.readFileSync('scripts/econ-round3.config.json')),inputs=readRound3Inputs(),rows=[];
for(const scenario of ['E1','E3'])for(const seed of config.seeds){
 const on=simulateEnergyEconomy(p,e,inputs,{scenario,seed}),off=simulateEnergyEconomy(p,e,inputs,{scenario,seed,disableGovernmentPower:true});
 let cumulativeRealGDPDifferenceC=0,realTaxReceiptDifferenceC=0,realDiscretionaryBudgetDifferenceC=0;
 const headroomOn=[],headroomOff=[];
 for(let i=1;i<=240;i++){
  const a=on.rows[i],b=off.rows[i],af=a.planets.earth.flow,bf=b.planets.earth.flow;
  cumulativeRealGDPDifferenceC+=(a.realGDP-b.realGDP)/12;
  const extraBudget=af.budgetC/a.priceIndex-bf.budgetC/b.priceIndex;realDiscretionaryBudgetDifferenceC+=extraBudget;realTaxReceiptDifferenceC+=extraBudget/p.strategyShare;
  headroomOn.push((af.generationGWh-af.demandGWh)/730);headroomOff.push((bf.generationGWh-bf.demandGWh)/730);
 }
 rows.push({scenario,seed,cumulativeRealGDPDifferenceC,realTaxReceiptDifferenceC,realDiscretionaryBudgetDifferenceC,minimumHeadroomDifferenceGW:Math.min(...headroomOn)-Math.min(...headroomOff),meanHeadroomDifferenceGW:headroomOn.reduce((s,x,i)=>s+x-headroomOff[i],0)/240,externalPowerSalesC:on.state.planets.earth.total.governmentExternalSalesC,avoidedUnservedGWh:off.state.planets.earth.total.unservedGWh-on.state.planets.earth.total.unservedGWh});
}
fs.writeFileSync(dir+'infrastructure-value.json',JSON.stringify({additionalExecutedRuns:20,meaning:'GDP는 월별 연율차/12 누계. 세수/재량예산은 물가 조정 C. GDP·예비력은 현금 매출에 더하지 않음. 예비분은 월 평균 에너지 환산 GW이며 피크 용량시장 가격이 아님.',rows},null,2)+'\n');console.log('20 additional paired replays: cumulative real GDP/tax/strategy-budget and reserve headroom, separately from sales.');
