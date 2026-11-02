// Read-only derivation of review tables from the completed run, never a new search.
import fs from 'node:fs';
import path from 'node:path';
import {powerScale,upgradeScale} from '../dist/src/economy-round4-facilities.js';
const dir=path.resolve(process.argv[2]??'docs/econ-sim/round4');
if(dir!==path.resolve('docs/econ-sim/round4')&&!dir.startsWith(path.resolve('artifacts')+path.sep))throw Error('Only round4/artifacts output allowed');
const read=name=>JSON.parse(fs.readFileSync(dir+'/'+name+'.json'));
const candidateFile=read('candidates'),candidates=[...candidateFile.candidates,candidateFile.recommended],records=read('final-runs'),series=read('series'),reference=read('reference-series'),result=read('results'),finance=read('financial'),maximum=read('maximum-power-finance'),inputs=read('input-manifest');
const sum=a=>a.reduce((n,x)=>n+x,0),mean=a=>sum(a)/Math.max(1,a.length),max=a=>Math.max(...a),min=a=>Math.min(...a);
const f=(v,d=5)=>v===null?'미회수/해당 없음':typeof v==='number'?(v!==0&&Math.abs(v)<10**-d?v.toExponential(4):v.toLocaleString('ko-KR',{maximumFractionDigits:d})):String(v);
const table=(head,rows)=>'| '+head.join(' | ')+' |\n|'+head.map(()=> '---').join('|')+'|\n'+rows.map(r=>'| '+r.map(v=>f(v)).join(' | ')+' |').join('\n')+'\n';
const margins=candidates.map(c=>{
 const rows=records.filter(x=>x.id===c.id),peace=rows.filter(x=>x.peace),e0=rows.filter(x=>x.scenario==='E0'),e2=rows.filter(x=>x.scenario==='E2'),small=rows.filter(x=>x.scenario==='E2-S'),crisis=rows.filter(x=>x.scenario==='E5-X');
 return {id:c.id,priceDeviationSlack:.15-max(peace.map(x=>x.peacePriceDeviation)),meanPriceSlack:.08-max(peace.map(x=>Math.abs(x.meanRealAlloyPrice/inputs.macro.baseAlloyPrice-1))),inflationLowSlack:min(peace.map(x=>x.inflationMin))-.01,inflationHighSlack:.03-max(peace.map(x=>x.inflationMax)),budgetLowSlack:min(peace.map(x=>x.budgetRatio17))-1.1,budgetHighSlack:1.6-max(peace.map(x=>x.budgetRatio17)),colonyE0Slack:.01-max(e0.map(x=>x.colonyMaxAnnualUnserved)),colonyE2Slack:.1-max(e2.map(x=>x.colonyMaxAnnualUnserved)),colonyE2SSlack:.1-max(small.map(x=>x.colonyMaxAnnualUnserved)),industryPaybackSlackYears:4-max(e0.map(x=>x.industryPaybackYears)),hydrogenMarginMinC:min(e0.map(x=>x.hydrogenAtReferenceMarginC)),crisisRecoveredSeeds:crisis.filter(x=>x.checks.crisisRecovery).length,crisisEndHealthMin:min(crisis.map(x=>x.meanHealth20))};
});
let cm='# 최종 후보 전체 수치 — 채택 전 검토표\n\n2026-11-02 Asia/Seoul. ECON-SIM-4 탐색 결과 — 사용자 미결정. **세 근접 후보와 반올림안 모두 종합 미달**이다. 장단점은 같은 5시드의 해당 표본 안에서만 비교한다. 출력 표는 최대 소수8자리이며 [candidates.json](candidates.json)이 원래 정밀도의 권위 자료다. 매크로·R3 기준 전력 매개변수 전체는 [input-manifest.json](input-manifest.json)에 별도로 보존했다.\n\n## 전체 4차 매개변수와 원래 탐색 범위\n\n';
cm+=table(['항목','원래 범위/고정',...candidates.map(c=>c.id)],Object.keys(candidates[0].parameters).map(k=>[k,result.config.ranges[k]?.map(x=>f(x,8)).join(' ~ ')??'고정 가정/정책',...candidates.map(c=>typeof c.parameters[k]==='number'?f(c.parameters[k],8):c.parameters[k])]));
cm+='\n## 기준별 최저 여유\n\n양수는 기준 안, 음수는 미달이다. 확률·가격 편차·물가·연간 미공급의 여유는 비율값(0.01=1%p), 예산 배수는 배수 차, 회수는 년이다. 단위가 달라 이 표의 숫자를 서로 직접 순위 비교하지 않는다. 최저 가격 여유는 모든 평시 경로·시드의 최악값이다. E5-X 회복 성공 시드는 별도 개수다.\n\n';
cm+=table(['기준',...candidates.map(c=>c.id)],Object.keys(margins[0]).filter(k=>k!=='id').map(k=>[k,...margins.map(m=>m[k])]));
cm+='\n## 후보별 이점과 취약점\n\n';
for(const c of candidates){const r=c.parameters,e0=records.filter(x=>x.id===c.id&&x.scenario==='E0');cm+=`- **${c.id}**: 수전해 정격 처리량 ${f(2000*r.hydrogenCapacityScale)}U/월, 건설 C ${f(inputs.baselineEnergy.hydrogenModuleC*r.hydrogenCScale)}, 합금 ${f(inputs.baselineEnergy.hydrogenModuleAlloyU*r.hydrogenAlloyScale)}U. 1.2C/U 정격 출하 원가 평균 ${f(mean(e0.map(x=>x.hydrogenFullCostC)),6)}C/U, 보수율 지구/달/화성 ${[r.upkeep_earth,r.upkeep_moon,r.upkeep_mars].map(x=>f(x*100,3)+'%').join('/')}. E0/E2-S 전력은 이 표본에서 기준 안이지만 E2, 전쟁 회복, 일부 평시 최대 가격 편차, E5-X가 취약하다.\n`;}
cm+='\nN018은 세 근접안 중 수전해 정격 출하 원가가 낮고, N055/N066은 다른 설비비·처리량 가정의 민감 비교용이다. 거시/위기 성능이 거의 같아 안정형·성장형이라는 성격을 부여할 근거가 약하다. 반올림안은 가독성을 위한 별도 제안이며 최저 여유의 부호를 바꾸지 못했다.\n';
fs.writeFileSync(dir+'/CANDIDATES_KO.md',cm);
const supply=[];
for(const scenario of ['E0','E2','E2-S','E9','E11']){
 const a=records.filter(x=>x.id==='R4-rounded'&&x.scenario===scenario);
 supply.push({scenario,alloyExportMeanU:mean(a.map(x=>x.shippingAlloyU)),hydrogenExportMeanU:mean(a.map(x=>x.shippingHydrogenU)),shellLossMeanU:mean(a.map(x=>x.shellLossU)),packagingGWhMean:mean(a.map(x=>x.packagingEnergyGWh))});
}
let detail='# 수급·변곡점·금융 상세 — 사용자 미결정\n\n완료된 원시 실행을 재집계한 표다. 새 경제 탐색을 추가하거나 판정을 바꾸지 않는다.\n\n## 지구에서 실제 차감한 식민지 보급\n\n반올림안 각5시드·20년 누계의 평균이다. 내용물 수출과 컨테이너 순손실은 별도다. 모든 실제 출발지는 이 실험에서 지구이며 정부·민간 재고가 각각 차감된다. H 수출0은 수요가 없거나 현지 원천/초기 재고로 충족된 경로의 실측값이며 무료 H 공급을 뜻하지 않는다. 실험은 합금/H만 이동한다.\n\n';
detail+=table(['경로','합금 내용물 U','H 내용물 U','컨테이너 순손실 U','출발지 실제 포장 GWh'],supply.map(x=>[x.scenario,x.alloyExportMeanU,x.hydrogenExportMeanU,x.shellLossMeanU,x.packagingGWhMean]));
const colonies=[];
for(const scenario of ['E0','E2','E2-S','E9'])for(const id of ['moon','mars']){
 const rows=series['R4-rounded'][scenario].slice(1),a=records.filter(x=>x.id==='R4-rounded'&&x.scenario===scenario);
 colonies.push({scenario,planet:id,firstSeedDemandGWh:sum(rows.map(x=>x.planets[id].demandGWh)),firstSeedAvailableGenerationGWh:sum(rows.map(x=>x.planets[id].generationGWh)),firstSeedUnservedGWh:sum(rows.map(x=>x.planets[id].unservedGWh)),worstAnnualAllSeeds:max(a.flatMap(x=>x.annualUnserved[id]))});
}
detail+='\n## 달·화성 전력 수급\n\n수요·가용 발전·미공급 GWh는 econ-1의20년 누계이며, 마지막 연간 비율은 5시드×20년의 최악값이다. 가용 발전은 삭감·잉여를 포함하므로 소비와 같지 않다.\n\n';
detail+=table(['경로','천체','수요 GWh','가용 발전 GWh','미공급 GWh','최악 연간 미공급'],colonies.map(x=>[x.scenario,x.planet,x.firstSeedDemandGWh,x.firstSeedAvailableGenerationGWh,x.firstSeedUnservedGWh,f(x.worstAnnualAllSeeds*100,4)+'%']));
detail+='\n## 월별 변곡점: 같은 첫 시드의 3차 대조\n\n';
const transitions=[];
for(const [scenario,ref]of [['E0','E0'],['E2-S','E2'],['E5-X','E5'],['E6-R','E6']])for(const month of [24,60,84,120,144,240]){
 const a=series['R4-rounded'][scenario].find(x=>x.month===month),b=reference[ref].find(x=>x.month===month),frac=x=>sum(['moon','mars'].map(id=>x.planets[id].unservedGWh))/Math.max(1e-9,sum(['moon','mars'].map(id=>x.planets[id].demandGWh)));
 transitions.push({scenario,month,realAlloyPrice:a.realAlloyPrice,referenceAlloyPrice:b.realAlloyPrice,colonyUnserved:frac(a),referenceColonyUnserved:frac(b),earthHealth:a.planets.earth.health,paused:sum(Object.values(a.planets).map(x=>x.paused)),retired:sum(Object.values(a.planets).map(x=>x.dismantled))});
}
detail+=table(['경로','월','R4 합금가','R3 합금가','R4 식민지 미공급','R3 식민지 미공급','R4 지구 건전도','정지 수','해체 누계'],transitions.map(x=>[x.scenario,x.month,x.realAlloyPrice,x.referenceAlloyPrice,f(x.colonyUnserved*100,3)+'%',f(x.referenceColonyUnserved*100,3)+'%',x.earthHealth,x.paused,x.retired]));
detail+='\nE2-S는 초기 기존 망+수요40% 소형 핵분열을 실제 자원으로 발주하고 월36/120에 같은 부지 중/대로 늘리는 고정 정책이다. 초기 수요가 바뀌면 첫 모듈 수가 바뀌지만 매월 최적 투자를 푸는 정책은 아니다. E2의 큰 초기 공사 공백과 달리 초기에 작은 설비가 완공되어 이 표본에서 정전이 사라졌다. 공공 기본 대응도 별도 추가 가정이다. E5-X는 충격 이후 실물·건전도 악순환을 벗어나지 못하며, 후속 실험은 구호·수리 재고 예약을 별도 유상 정책으로 비교해야 한다. 현재 실패를 제거하지 않는다.\n';
detail+='\n## 같은 부지 증설과 직접 대형\n\n';
detail+=table(['종류','소→중→대 C','직접 대형 C','단계 경로 합금 U'],finance.upgrades.map(x=>[x.type,x.stagedC,x.directLargeC,x.stagedAlloyU]));
const r=candidates.at(-1).parameters,e=inputs.baselineEnergy,med=powerScale(e,r,'fusion','medium',240),add=upgradeScale(e,r,'fusion','medium','large',240),large=powerScale(e,r,'fusion','large',240),fusionUpgrade={path:'medium→large',stagedC:med.base.creditC+med.module.creditC+add.base.creditC+add.module.creditC,directC:large.base.creditC+large.module.creditC,stagedAlloyU:med.base.alloyU+med.module.alloyU+add.base.alloyU+add.module.alloyU};
detail+=`\n핵융합 소형은 금지하므로 소→중 표를 만들지 않았다. 해금 뒤 중→대 경로는 C ${f(fusionUpgrade.stagedC)}, 합금 ${f(fusionUpgrade.stagedAlloyU)}U이며 직접 대형 C는 ${f(fusionUpgrade.directC)}다. 각 추가 발전 구간의96h/H/C 기동 비용은 별도이며 기존 출력은 공사 중 감산한다. 위 C 표는 부지·모듈 건설 견적이며 가동 초과/정지 손실·기동·물가·금융비를 모두 포함한 NPV가 아니다. E10 paired arm이 월별 실제 발주를 비교한다.\n`;
const powerPayback=maximum.map(x=>{const a=powerScale(e,r,x.type,'large',240),investmentC=x.creditC+x.alloyU*inputs.macro.baseAlloyPrice+a.startC*x.modules+(a.buildHydrogenU+a.startHydrogenU)*x.modules*r.hydrogenPrice;return {...x,investmentC,orderPaybackYears:x.annualNetC>0?investmentC/x.annualNetC+(a.foundationMonths+a.months)/12:null};});
detail+='\n## 발전소 별도 투자 회수 — 최대 단지 전량 외부 판매\n\n이는 수요가 정격을 구매한다는 분석 경계다. 실제 시나리오의 자가 소비·민간/정부 전력 구매량과 다르다. 소/중/대 단독1기는 전 종류 순현금 음수여서 현금 회수가 없다.\n\n';
detail+=table(['종류','총 C환산 투자','연 순현금 C','주문부터 회수 년'],powerPayback.map(x=>[x.type,x.investmentC,x.annualNetC,x.orderPaybackYears]));
const solar=powerPayback.find(x=>x.type==='solar'),annualGWh=solar.averageGW*8760;
detail+=`\n태양광 최대 단지의 매출 ${f(solar.annualSalesC)}C/년보다 직접 운영비 ${f(solar.annualDirectC)}C/년이 크다. 합금 보수까지 더하면 순현금 ${f(solar.annualNetC)}C/년이다. 같은 기반 공유·보수율을 두고 매출만으로 손익을 맞추는 역산 CF는 ${f((solar.annualDirectC+solar.annualUpkeepU*inputs.macro.baseAlloyPrice)/(solar.annualSalesC/r.solarEarthCF))}로, 이번 .20–.30 범위 밖이다. 손익분기 전력 단가는 ${f((solar.annualDirectC+solar.annualUpkeepU*inputs.macro.baseAlloyPrice)/annualGWh,6)}C/GWh다. 설비투자 회수 전의 운전 손익 경계이며 실제 값 채택 제안이 아니다.\n`;
detail+='\n## 기준가와 실제 H 시장가의 차이\n\n1.2C/U는 기준가/원가 검증 가정이며 재고 반응 시장가는 내생적으로 변한다. E0 5시드의 실측 평균 가격과 정격 SCU 출하 원가를 함께 보며, 기준가 마진만으로 모든 신규 진입 수익을 보장하지 않는다.\n\n';
detail+=table(['후보','실제 평균 H가 C/U','1.2 기준 정격 출하 원가 C/U','실제 평균가-정격 출하 원가 C/U'],candidates.map(c=>{const a=records.filter(x=>x.id===c.id&&x.scenario==='E0');return [c.id,mean(a.map(x=>x.meanHydrogenPrice)),mean(a.map(x=>x.hydrogenFullCostC)),mean(a.map(x=>x.meanHydrogenPrice-x.hydrogenFullCostC))];}));
detail+='\n달의 수소 금융표는 지구와 같은 실험 망 단가를 넣은 **부지 비교 견적**이며 현지 수원이 없는 달에서 생산 가능하다는 뜻이 아니다. 화성도 실제 수원·시설·수요·전력 조건은 원시 시계열을 우선한다. `macroPassed`/`proposedReliabilityPassed` 등 R3 호환 필드는 원래 진단값으로 보존했으며 R4 최종 판정의 권위는 `checks`/`failures`/`passed`다.\n';
fs.writeFileSync(dir+'/DETAILS_KO.md',detail);
fs.writeFileSync(dir+'/details.json',JSON.stringify({source:'completed pipeline only; no additional 20-year runs',margins,supply,colonies,transitions,fusionUpgrade,powerPayback},null,2)+'\n');
console.log('PASS: complete candidate parameters, criterion slack, finite paid supply, monthly transitions and separate power finance tables derived');
