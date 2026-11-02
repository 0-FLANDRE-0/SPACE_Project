import {industryExpectation,setPayback} from '../dist/src/economy-model.js';
import {POWER_TYPES,industryCapacity,alloyElectricityMWhPerT} from '../dist/src/economy-energy-facilities.js';
const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length),sum=a=>a.reduce((s,x)=>s+x,0),max=a=>Math.max(...a),min=a=>Math.min(...a);
export function industryFinance(p,e){
 const tech=industryExpectation(p),investmentC=tech.creditC+tech.alloyInputU*p.baseAlloyPrice+tech.hydrogenInputU*.4;
 const powerPrice=e.electricityGDPShare*p.bodies.earth.annualGDP/(e.earthBaseGW*8760);
 let ore=0,net=0,breakEvenYears=null,totalEnergyGWh=0;const flows=[];
 for(let month=0;month<600;month++){
  const mine=industryCapacity({sets:1,completedMonth:6,month,difficulty:p.difficulty,processingDifficulty:p.processingDifficulty}),smelt=industryCapacity({sets:1,completedMonth:8,month,difficulty:p.difficulty,processingDifficulty:p.processingDifficulty});
  ore+=mine.mineU;const processed=Math.min(ore,smelt.processU),alloy=processed*tech.yieldFraction;ore-=processed;
  const energyGWh=(mine.mineU*10*e.mineMWhPerT+processed*10*e.feedMWhPerT+alloy*10*alloyElectricityMWhPerT(e.industryMix))/1000+(month>=6?e.industryFixedMW*.73:0);
  const activeC=(month>=6?14500:0)+(month>=8?24500:0),activeU=(month>=6?1200:0)+(month>=8?3150:0);
  const directC=activeC*e.directAnnual/12,upkeepU=activeU*e.upkeepAnnual/12,gross=alloy*p.baseAlloyPrice,profit=gross-directC-upkeepU*p.baseAlloyPrice-energyGWh*powerPrice;
  const prev=net;net+=profit;totalEnergyGWh+=energyGWh;if(breakEvenYears===null&&net>=investmentC)breakEvenYears=(month+(investmentC-prev)/profit)/12;
  if(month>=120&&month<132)flows.push({alloy,energyGWh,directC,upkeepU,gross,profit});
 }
 const mature=Object.fromEntries(Object.keys(flows[0]).map(k=>[k,mean(flows.map(x=>x[k]))]));
 return {investmentC,zeroOperatingOrderYears:setPayback({...p,hydrogenPrice:.4},{operatingRate:0}).fromOrderYears,actualOperatingOrderYears:breakEvenYears,mature,unitFullCostC:(mature.directC+mature.upkeepU*p.baseAlloyPrice+mature.energyGWh*powerPrice+investmentC/(p.privateAmortizationYears*12))/mature.alloy,assumptions:'단독 1:1 단지, 실질가격2.3·전력100%·수소보조OFF. 합금 자체소비는 기회비용, 현금과 구분; 부지환경계수1, 금융비용 제외'};
}
export function generationFinance(p,e,{modules=1,salesFraction=1,fusionFuelU=2.5,capexScale=1,foundationMonths=e.costs.foundationMonths}={}){
 const price=e.electricityGDPShare*p.bodies.earth.annualGDP/(e.earthBaseGW*8760),rows=[];
 for(const [type,d]of Object.entries(POWER_TYPES)){
  const count=modules==='maximum'?d.maxModules:modules;if(count>d.maxModules)continue;
  const base=e.costs[type].base,mod=e.costs[type].module,creditC=(base.creditC+mod.creditC*count)*capexScale,alloyU=(base.alloyU+mod.alloyU*count)*capexScale;
  const buildH=type==='fusion'?5*count:0,startH=type==='fusion'?5*count:0,startC=type==='fusion'?2500*count:0;
  const ratedGW=d.ratedGW*count,averageGW=ratedGW*(type==='solar'?e.solarEarthCF:type==='fission'?e.fissionAvailability:1),annualGWh=averageGW*8760;
  const directC=creditC*e.directAnnual,upkeepU=alloyU*e.upkeepAnnual,hydrogenU=type==='fusion'?fusionFuelU*count*12:0,fuelServicesC=type==='fission'?annualGWh*e.fissionFuelCPerGWh:0;
  const salesC=annualGWh*price*salesFraction,fullOperatingC=directC+upkeepU*p.baseAlloyPrice+hydrogenU*.4+fuelServicesC,investmentC=creditC+alloyU*p.baseAlloyPrice+(buildH+startH)*.4+startC+(type==='fusion'?75*price*count:0);
  const netC=salesC-fullOperatingC,cashPaybackYears=netC>0?investmentC/netC+(foundationMonths+d.months)/12:null;
  rows.push({type,modules:count,ratedGW,averageGW,annualGWh,priceCPerGWh:price,salesFraction,creditC,alloyU,buildHydrogenU:buildH,startHydrogenU:startH,startC,investmentC,directAnnualC:directC,upkeepAnnualU:upkeepU,hydrogenAnnualU:hydrogenU,fuelServicesAnnualC:fuelServicesC,annualSalesC:salesC,annualFullOperatingC:fullOperatingC,annualNetC:netC,cashPaybackYears,grossPaybackYears:investmentC/Math.max(1e-12,salesC),levelized30YearCPerGWh:(investmentC/30+fullOperatingC)/annualGWh});
 }
 return rows;
}
export function energyMetrics(result,p,e,criteria,{seed,scenario}={}){
 const rows=result.rows,r=rows.slice(1),end=rows.at(-1),state=result.state,earth=r.map(x=>x.planets.earth),peace=['S0','S1','S2','E0','E1','E2'].includes(scenario),war=['S3-debt','S3-money'].includes(scenario),yearlyInflation=r.filter(x=>x.month>=12).map(x=>x.priceIndex/rows[x.month-12].priceIndex-1);
 const peacePriceDeviation=max(r.map(x=>Math.abs(x.realAlloyPrice/p.baseAlloyPrice-1))),meanRealAlloyPrice=mean(r.map(x=>x.realAlloyPrice));
 const budget=(a,b)=>sum(r.filter(x=>x.month>a&&x.month<=b).map(x=>x.planets.earth.flow.budgetC)),budget17=budget(192,204)/Math.max(1e-12,budget(0,12));
 const planetSummary={};for(const id of ['earth','moon','mars']){const b=state.planets[id],t=b.total;planetSummary[id]={unservedFraction:t.unservedGWh/Math.max(1,t.demandGWh),unservedGWh:t.unservedGWh,upkeepFraction:t.upkeepPaidU/Math.max(.001,t.upkeepRequiredU),minHealth:t.healthMin,meanIndustryUtilization:mean(r.map(x=>x.planets[id].industryUtilization)),hydrogenProducedU:t.hydrogenProducedU,hydrogenUsedU:t.hydrogenUsedU,hydrogenByproductU:t.hydrogenByproductU,hydrogenElectrolysisU:t.hydrogenElectrolysisU,startInputGWh:t.startInputGWh,startGenerationGWh:t.startGenerationGWh,startHydrogenU:t.startHydrogenU,normalHydrogenU:t.normalHydrogenU,startC:t.startC,repairU:t.repairU,repairC:t.repairC,powerUnpaidC:t.powerUnpaidC,externalPowerSalesC:t.governmentExternalSalesC,governmentSelfSalesC:t.governmentSelfSalesC,governmentPowerDirectC:t.governmentPowerDirectC,governmentPowerUpkeepU:t.governmentPowerUpkeepU,governmentPowerGWh:t.governmentPowerGWh,constructionC:t.constructionC,constructionAlloyU:t.constructionAlloyU};}
 const prices=r.filter(x=>x.month>p.warStartMonth&&x.month<=p.warStartMonth+p.warDurationMonths).map(x=>x.realAlloyPrice),warPeak=max(prices)/p.baseAlloyPrice-1;
 let recoveryYears=null;for(let m=p.warStartMonth+p.warDurationMonths;m<=240-12;m++){if(rows.slice(m,m+12).every(x=>Math.abs(x.realAlloyPrice/p.baseAlloyPrice-1)<=.1)){recoveryYears=(m-(p.warStartMonth+p.warDurationMonths))/12;break;}}
 const checks={integrity:true};const margins={integrity:1};
 if(peace){
  const values={priceDeviation:[criteria.peacePriceDeviation-peacePriceDeviation,criteria.peacePriceDeviation],meanPrice:[criteria.meanPriceDeviation-Math.abs(meanRealAlloyPrice/p.baseAlloyPrice-1),criteria.meanPriceDeviation],inflationLow:[min(yearlyInflation)-criteria.inflationMin,.02],inflationHigh:[criteria.inflationMax-max(yearlyInflation),.02],budgetLow:[budget17-criteria.budget17Min,.5],budgetHigh:[criteria.budget17Max-budget17,.5]};
  for(const [k,[v,d]]of Object.entries(values)){checks[k]=v>=-1e-8;margins[k]=v/d;}
 }
 if(war){checks.warPeakLow=warPeak>=criteria.warPeakMin;checks.warPeakHigh=warPeak<=criteria.warPeakMax;checks.warRecovery=recoveryYears!==null&&recoveryYears<=criteria.warRecoveryYearsMax;}
 const macroPassed=Object.values(checks).every(Boolean),t=state.planets.earth.total;
 const reliabilityPassed=Object.values(planetSummary).every(b=>b.unservedFraction<=criteria.peaceUnservedFractionMax&&b.upkeepFraction>=criteria.peaceUpkeepFractionMin);
 return {seed,scenario,integrity:true,macroPassed,peace,proposedReliabilityPassed:reliabilityPassed,passed:macroPassed&&(!peace||reliabilityPassed),robustness:min(Object.values(margins)),checks,planetSummary,realGDP20:end.realGDP,priceIndex20:end.priceIndex,treasury20:end.treasuryC,debt20:end.debtC,peacePriceDeviation,meanRealAlloyPrice,inflationMin:min(yearlyInflation),inflationMax:max(yearlyInflation),budgetRatio17:budget17,warPeak,recoveryYears,warProcuredU:t.warAlloyU,governmentShare17:mean(earth.slice(192,204).map(b=>b.flow.governmentProducedU/Math.max(1,b.flow.producedU))),governmentSoldU:t.governmentSoldU,governmentAlloySalesC:t.governmentSaleC,privateSets20:end.planets.earth.privateSets,governmentSets20:end.planets.earth.governmentSets,meanHydrogenPrice:mean(r.map(x=>x.hydrogenPrice)),minHydrogenPrice:min(r.map(x=>x.hydrogenPrice)),maxHydrogenPrice:max(r.map(x=>x.hydrogenPrice)),meanIndustryCostC:mean(earth.filter(b=>b.industryUnitCostC>0).map(b=>b.industryUnitCostC)),meanHydrogenCostC:mean(earth.filter(b=>b.hydrogenUnitCostC>0).map(b=>b.hydrogenUnitCostC)),endHydrogenPrice:end.hydrogenPrice,hydrogenProducerMarginC:mean(earth.filter(b=>b.hydrogenUnitCostC>0).map(b=>b.hydrogenPrice-b.hydrogenUnitCostC)),earthUnservedFraction:planetSummary.earth.unservedFraction,colonyUnservedFraction:Math.max(planetSummary.moon.unservedFraction,planetSummary.mars.unservedFraction),upkeepPaidFraction:t.upkeepPaidU/Math.max(1,t.upkeepRequiredU),minHealth:t.healthMin,repairU:t.repairU,repairC:t.repairC,starts:state.normalStarts,startSubsteps:state.bootSubsteps,explicitProxyC:0};
}
export function aggregate(id,energy,records){
 const peace=records.filter(r=>r.peace),stress=records.filter(r=>!r.peace),macroPassed=records.every(r=>r.macroPassed),integrity=records.every(r=>r.integrity),failures={};
 for(const r of records)for(const [k,v]of Object.entries(r.checks))if(!v)failures[k]=(failures[k]??0)+1;
 const minMargin=min(records.map(r=>r.robustness)),reliabilityPenalty=mean(peace.map(r=>Math.max(0,r.colonyUnservedFraction-.005)+Math.max(0,r.earthUnservedFraction-.005)));
 const reliabilityPassed=peace.every(r=>r.proposedReliabilityPassed),perScenario={};
 for(const scenario of new Set(records.map(r=>r.scenario))){const subset=records.filter(r=>r.scenario===scenario);perScenario[scenario]={runs:subset.length,macroPassed:subset.every(r=>r.macroPassed),proposedReliabilityPassed:subset.every(r=>r.proposedReliabilityPassed),meanRealPrice:mean(subset.map(r=>r.meanRealAlloyPrice)),gdp20:mean(subset.map(r=>r.realGDP20)),earthUnservedFraction:mean(subset.map(r=>r.earthUnservedFraction)),colonyUnservedFraction:mean(subset.map(r=>r.colonyUnservedFraction)),minHealth:min(subset.map(r=>r.minHealth)),meanHydrogenPrice:mean(subset.map(r=>r.meanHydrogenPrice)),hydrogenCostC:mean(subset.map(r=>r.meanHydrogenCostC)),privateSets20:mean(subset.map(r=>r.privateSets20))};}
 return {id,energy,integrity,macroPassed,proposedReliabilityPassed:reliabilityPassed,passed:macroPassed&&reliabilityPassed,robustness:minMargin-reliabilityPenalty,minimumMacroMargin:minMargin,runCount:records.length,passingRuns:records.filter(r=>r.passed).length,stressRuns:stress.length,failures,perScenario};
}
