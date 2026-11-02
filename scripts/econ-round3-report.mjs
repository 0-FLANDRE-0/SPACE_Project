import fs from 'node:fs';
const root='docs/econ-sim/round3/',read=n=>JSON.parse(fs.readFileSync(root+n)),R=read('results.json'),C=read('candidates.json'),F=read('financial.json'),rows=read('final-runs.json'),paired=read('paired-experiments.json'),INF=read('infrastructure-counterfactual.json'),SEN=read('sensitivity.json'),B=read('broad-candidates.json'),SER=read('series.json'),REF=read('reference-series.json');
const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length),n=(x,d=2)=>x===null?'미회수':Number(x).toLocaleString('ko-KR',{maximumFractionDigits:d,minimumFractionDigits:d}),pct=(x,d=2)=>n(x*100,d)+'%',t=(headers,data)=>'| '+headers.join(' | ')+' |\n|'+headers.map(()=>'---').join('|')+'|\n'+data.map(r=>'| '+r.join(' | ')+' |').join('\n');
const VALUE=read('infrastructure-value.json');
const valueTable=t(['경로','누적 실질 GDP 손실 회피 C','실질 세수 차이 C','실질 재량예산 차이 C','최저 예비분 차이 GW'],['E1','E3'].map(s=>{const a=VALUE.rows.filter(r=>r.scenario===s);return [s,n(mean(a.map(r=>r.cumulativeRealGDPDifferenceC))),n(mean(a.map(r=>r.realTaxReceiptDifferenceC))),n(mean(a.map(r=>r.realDiscretionaryBudgetDifferenceC))),n(mean(a.map(r=>r.minimumHeadroomDifferenceGW)),3)];}));
const selected=rows.filter(r=>r.id==='R3-rounded'),sc=scenario=>selected.filter(r=>r.scenario===scenario),stat=(scenario,key)=>mean(sc(scenario).map(r=>r[key])),ps=(scenario,planet,key)=>mean(sc(scenario).map(r=>r.planetSummary[planet][key]));
const candidates=[...C.candidates,C.recommended],candidateStats=candidates.map(c=>{const a=rows.filter(r=>r.id===c.id),peace=a.filter(r=>r.peace),war=a.filter(r=>r.scenario.startsWith('S3-'));return {...c,peacePassed:peace.every(r=>r.macroPassed),peacePass:peace.filter(r=>r.macroPassed).length,peaceCount:peace.length,warPass:war.filter(r=>r.macroPassed).length,warCount:war.length};});
const financeTable=t(['방식','1기 단독 연 순현금 가정 C','1기 회수','최대 모듈 단지 연 순현금 C','최대 단지 회수(년)'],F.generationSingle.map((r,i)=>[r.type,n(r.annualNetC),'미회수',n(F.generationMaximum[i].annualNetC),n(F.generationMaximum[i].cashPaybackYears)]));
const parameterTable=t(['항목',...candidates.map(c=>c.id)],[
 ['직접 C 운영비/건설 C 연간',...candidates.map(c=>pct(c.energy.directAnnual))],['합금 유지보수/건설 U 연간',...candidates.map(c=>pct(c.energy.upkeepAnnual))],['초기 지구 전력 여유',...candidates.map(c=>pct(c.energy.gridReserve))],['기초 전기비/GDP',...candidates.map(c=>pct(c.energy.electricityGDPShare))],['광산:제련 용량 세트비',...candidates.map(c=>n(c.energy.mineRatio,3))],['H 모듈 C/100U·월',...candidates.map(c=>n(c.energy.hydrogenModuleC,0))],['중단 C 잔존',...candidates.map(c=>pct(c.energy.pausedCashFraction))],['중단 U 잔존',...candidates.map(c=>pct(c.energy.pausedAlloyFraction))]
]);
const checkTable=t(['후보','무결성','평시 선행 기준','전시 선행 기준','추가 공급안정성 제안','종합'],candidateStats.map(c=>[c.id,'80/80',c.peacePass+'/'+c.peaceCount,c.warPass+'/'+c.warCount,c.proposedReliabilityPassed?'충족':'미충족','부분 충족, 채택 아님']));
const fuelStats=[];for(const scenario of ['E1','E4'])for(const fuel of [.5,1,2.5]){const a=paired.filter(r=>r.experiment==='fusion-fuel'&&r.scenario===scenario&&r.fuel===fuel);fuelStats.push({scenario,fuel,market:mean(a.map(r=>r.meanHydrogenPrice)),cost:mean(a.map(r=>r.meanHydrogenCostC)),normalH:mean(a.map(r=>r.planetSummary.earth.normalHydrogenU)),fuelC:12*fuel*.4});}
const fuelTable=t(['경로','정상 H U/월 (실험)','20년 평균 H 가격 C/U','신규 H 생산 전원가 C/U','20년 핵융합 정상 H 합계 U','0.4 기준 정격1기 연 H비 C'],fuelStats.map(r=>[r.scenario,n(r.fuel,1),n(r.market,4),n(r.cost,4),n(r.normalH,1),n(r.fuelC,1)]));
const examples=[...B].sort((a,b)=>a.perScenario.E0.hydrogenCostC-b.perScenario.E0.hydrogenCostC),viable=examples.find(c=>c.perScenario.E0.meanHydrogenPrice>c.perScenario.E0.hydrogenCostC&&c.perScenario.E0.hydrogenCostC<.4),costly=examples.at(-1);
const hExamples=t(['탐색 예','E0 신규 H 전원가 C/U','E0 평균 시장 C/U','해석'],[viable?[viable.id,n(viable.perScenario.E0.hydrogenCostC,3),n(viable.perScenario.E0.meanHydrogenPrice,3),'0.4 이하 자생 가능 사례']:['해당 없음','','',''],[costly.id,n(costly.perScenario.E0.hydrogenCostC,3),n(costly.perScenario.E0.meanHydrogenPrice,3),'높은 건설비/운영비에서 신규 투자 불가'],['R3-rounded',n(stat('E0','meanHydrogenCostC'),3),n(stat('E0','meanHydrogenPrice'),3),'기존 설비의 단기 가동과 신규 투자 수익성을 구분']]);
const mixTable=t(['구성','전기 MWh/t-alloy','E0 평균 합금 C/U','E3 평균 미공급률','비교 실행'],['steelHeavy','mixed','nonferrousHeavy'].map((mix,i)=>{const a=paired.filter(r=>r.experiment==='metal-mix'&&r.industryMix===mix);return [mix,[2.025,3.575,5.9][i],n(mean(a.filter(r=>r.scenario==='E0').map(r=>r.meanRealAlloyPrice)),4),pct(mean(a.filter(r=>r.scenario==='E3').map(r=>r.earthUnservedFraction)),4),'4경로×5시드'];}));
const infTable=t(['경로','20년 미공급 회피 TWh','산업 전기가동률 회피 Δ','20년차 GDP 차이 C/년','국고 차이 C','실제 외부 판매 C'],['E1','E3'].map(s=>{const a=INF.filter(r=>r.scenario===s);return [s,n(mean(a.map(r=>r.avoidedUnservedGWh))/1000,3),pct(mean(a.map(r=>r.avoidedIndustryUnderutilization)),4),n(mean(a.map(r=>r.gdp20DifferenceC))),n(mean(a.map(r=>r.treasury20DifferenceC))),n(mean(a.map(r=>r.externalPowerSalesC)))];}));
const scenarioTable=t(['경로','평균 합금 C/U','지구 미공급','식민지 최대 미공급','H 가격 C/U','최저 건전도'],R.scope.final.map(s=>[s,n(stat(s,'meanRealAlloyPrice'),3),pct(stat(s,'earthUnservedFraction'),3),pct(stat(s,'colonyUnservedFraction'),3),n(stat(s,'meanHydrogenPrice'),3),n(Math.min(...sc(s).map(r=>r.minHealth)),2)]));
const e0=SER.E0[1].planets.earth.flow,wireHours=8760,metalT=20e6*.036/2.3*10;
const sell=stat('S1-sell','privateSets20')/stat('S1','privateSets20')-1;
const baseCPI=REF['OFF:S0'].at(-1).priceIndex,onCPI=REF['ON:S0'].at(-1).priceIndex;
const md=`# ECON-SIM-3 전력·산업 운영비 검증 — 사용자 미결정

2026-11-01 (Asia/Seoul). 기준 커밋 **${R.baselineCommit}**. 같은 \`feat/econ-calibration-sim\` / [PR #10](https://github.com/0-FLANDRE-0/SPACE_Project/pull/10)에 추가한다. 게임 본체·공식 지구/행성 데이터·기존1/2차 산출물은 변경하지 않는다. [오프라인 실행 HTML](report.html) · [원시 CSV](runs.csv) · [전체 결과 JSON](results.json).

## 먼저 볼 결과

**완전 합격 후보는0개다.** 넓은512개 중 평시 대조 기준${R.broad.macroPassed}개, 좁힌128개 중${R.narrow.macroPassed}개가 해당 탐색 범위에서 통과했다. 그러나 최종3개와 반올림안은 전체16경로×5시드 교차 검증에서 전시 가격 상승 하한20%를 충족하지 못했다. 반올림안은 전시 회복 기준도10건 중${R.rounded.failures.warRecovery??0}건 미달했다. 무결성320/320은 통과했다. 평시 가격·물가·예산은 ${candidateStats.map(c=>c.id+" "+c.peacePass+"/"+c.peaceCount).join(", ")}이다. 이 차이를 ‘최종 합격’으로 합치지 않았다.

추가 제안인 전력 미공급0.5% 이하/보수99% 이상을 함께 만족하는 후보도0개다. 이 숫자는 사용자 확정 기준이 아니며 별도 표기한다. 평시 E0의 식민지 최대 미공급은${pct(stat('E0','colonyUnservedFraction'),3)}, E2는${pct(stat('E2','colonyUnservedFraction'),3)}로, E0는 초기 여유5%가20년 인구 성장에 소진되는 문제다. E2의 큰 부족은 새 발전시설·저장의 높은 합금 보존 부담이 유한한 개척 재고를 소진하는 문제까지 겹친 결과다. 정상 지구 거시 기준을 만족해도 개척 경로가 안정하다고 볼 수 없다. 지구 정상 E0의 미공급은${pct(stat('E0','earthUnservedFraction'),3)}다.

핵융합 정상2.5U/월, 정격5/2.5/1.5GW, 모듈 수/공사기간은 유지했다. H0.5/1/2.5 비교는 별도 실험이며 기본값에 반영하지 않았다. 후보는 채택하지 않고 미결정으로 남긴다.

${checkTable}

## 실제 탐색 범위와 횟수

넓은512×3경로×5시드=${R.counts.broadRuns.toLocaleString()}회, OAT58×15=${R.counts.oatRuns}회, 좁힌128×9×5=${R.counts.narrowRuns.toLocaleString()}회다. 넓은 상위8개도9경로에서360회 재실행해 동일 범위에서 순위를 비교했다. 최종3개+반올림은4×16×5=320회, 선행4프로필 OFF/ON은280회이며 원본 직접 호출140회도 대조했다. 구성/연료 paired120회, 발전 반사실20회, 그림16회, 성능25회를 포함해 **${R.counts.totalRecordedRuns.toLocaleString()}회** 실행했다. 넓은 탐색에서 기존7경로와 나머지 E경로를 생략한 것은 비용을 줄이기 위한 예비 표본 설계이며 최종 검증에서는 생략하지 않았다.

${R.workers}개 CPU worker 수치 계산, 전체${n(R.timings.totalSeconds,2)}초. 단일20년 p50=${n(R.performance.p50Ms,2)}ms, p95=${n(R.performance.p95Ms,2)}ms. 선행2차2.77/4.21ms보다 느리며50ms 단일 실행 목표를p50에서${n(R.performance.p50Ms-50,2)}ms 초과했다. 다중 현금/물질 계정, 개별 모듈 상태/기동, 화성 명암 저장 사건, 월별 무결성 및 상세 스냅샷이 추가됐다. 독립 재현을 동시에 돌린 실제 벽시계 시간은10분 목표를 약${n(Math.max(0,R.timings.totalSeconds-600),1)}초 초과했다. 각 작업3 worker가4개 CPU를 공유한 측정이며 시간을 숨기기 위해 조건을 줄이지 않았다. 환경은${R.environment.node}, ${R.environment.cpu}; 이 측정은 일반 휴대폰 성능을 뜻하지 않는다.

## 검토 후보3개와 반올림안

${parameterTable}

모든 나머지 키·범위·상태·조건은 [설정](../../../scripts/econ-round3.config.json), [후보 JSON](candidates.json), [구현 문서](IMPLEMENTATION.md)에 있다. 반올림안은 탐색 키만 반올림했고 수소2.5·정격·지구8.12TW는 바꾸지 않았다. 별도 검증에서 전시 회복 실패가 늘었으므로 상위 원안과 동일한 안정성이라고 권하지 않는다.

${C.candidates[0].id}는 평시 지구 거시 기준을 충족하지만 높은 보수 부담으로 E2 개척 경로가 불안정하다. ${C.candidates.slice(1).map(c=>c.id).join("/")}는 낮은 합금 보수 부담의 대안이지만 평시 가격 편차를 일부 시드에서 충족하지 못한다. 전시 하한 실패는 셋 모두 같다. 선택된 원안/반올림 모두 수소 신규 설비의 수익성 문제와 긴 발전 회수기간이 남는다. ‘견고한 최종값3개를 확보했다’고 표현하지 않는다.

## 합금은 복수 산업의 추상 자원

철강/기타비철·특수금속/Al 전기 가정을1/3.5/14MWh/t로 나누고, 구성3종을 동일 설정/사건/시드에서 비교했다. 채굴·광석 전처리 전기는 별도로 더한다. 알루미늄14를 모든 합금에 적용하지 않는다. 이 구성비는 실제 산업 점유율의 예측이 아니며 자료가 부족한 기타 금속과 철강 전체 공정 경계는 탐색 가정이다.

${mixTable}

반올림안 첫 E0 월 상세 산업 전기는${n(e0.industryDemandGWh,2)}GWh, 지구8.12TW 월 부하의${pct(e0.industryDemandGWh/(8120*730),4)}다. 광산마다 발전소를 설치하지 않고 기존 행성망에 연결한다. 전체 지구 기준에 비해 작다는 결과를 바꾸려고 전력을 부풀리지 않았다.

현재 Y=2천만C·합금시장3.6%·2.3C/U·10t/U를 물리적으로 환산하면 상세 추적 금속은 약${n(metalT/1e6,2)}백만t/년이다. 이것이 실제 지구 전체 금속산업 생산량이라는 가정은 하지 않는다. 나머지 기존 도시/산업은8.12TW 배경 부하 안에 있다. 화폐·자원 단위와 현실 산업의 포괄 범위가 서로 다른 집계 단계임을 이후 게임 설계에서도 유지해야 한다.

## 산업과 발전의 투자 회수는 별도

광업14,500C/1,200U/6개월, 제련24,500C/3,150U/120H/8개월을 보존했다. 지구1:1 단독 산업의 전력·보수·직접 C 포함 회수는 주문부터 **${n(F.industry.actualOperatingOrderYears,2)}년**, 운영비0 대조는${n(F.industry.zeroOperatingOrderYears,2)}년이다. 성숙 생산${n(F.industry.mature.alloy,1)}U/월, 직접${n(F.industry.mature.directC,1)}C/월, 보수${n(F.industry.mature.upkeepU,2)}U/월, 전기${n(F.industry.mature.energyGWh,2)}GWh/월이다. 실비 포함 회수를1.5~3년에 강제하지 않았다. 부지환경/금융·송전비 제외이므로 시설별 실게임 견적은 다를 수 있다.

아래 발전 수익은 **전량 외부 판매·재료 전량 시장매입**의 단순 현금 회수 가정이다. 자체 재료는 실제 장부에서 현금 지출로 만들지 않고 U로 차감하며, 별도 전원가 평가에서만 기회비용을 쓴다. 단지 기반 공유 효과를1기와 최대 모듈 단지로 나눴다. 부지/해체/금융을 포함한 정식 LCOE가 아니다.

${financeTable}

1기 단독은 셋 모두 연 순현금이 음수다. 최대 기반 공유에서도 핵융합 약${n(F.generationMaximum[0].cashPaybackYears,1)}년, 핵분열 약${n(F.generationMaximum[1].cashPaybackYears,1)}년이며 태양광은 미회수다. 현재 잠정 태양광 C 건설비/운영비와 낮은 발전계수의 조합이 주원인이다. 사용자 승인 없이 건설비를 낮추거나 전기요금을 올려 흑자로 만들지 않았다. 발전비0.75/1/1.25와 기반1~4개월의 **재무 하위모형** 민감도는 [financial.json](financial.json)에 있다.

정부 시설은 현금 장사와 기반시설 가치를 구분한다. 같은 시드에서 정부 발전 신설만 뺀 반사실과 비교했다. 도시 수요·기존 전력·산업 전력은 동일하다.

${infTable}

추가20회 paired 재실행으로 사건 중 누적 손실·세수·예비분도 따로 산정했다. 핵심15,591회와 구분되는 보강 계산이며, 독립 전체 재현 실행도 별도다.

${valueTable}

누적 GDP는 월별 연간 GDP 차이를12로 나눈 합이다. 세수·재량예산은 CPI를 제거한 C이며 이미 실제 재정 흐름에 들어가는 값이므로 판매액에 다시 더하지 않는다. 예비분은 월 평균 에너지 차이를730h로 환산한 GW로, 임의 용량 가격을 부여하지 않았다.

E1 정상망에 발전을 추가하면 기존 공급을 대체해 전기 판매는 생기지만 정전/GDP 손실 회피는 거의 없다. E3에서는 실제 미공급/산업 저하를 일부 줄인다. 표의20년차 GDP 차이가0인 경우는 사건 종료 후 잠재 성장 경로에 복귀한 것이며 사건 중 회피 손실이 없었다는 뜻은 아니다. 회피 TWh, 산업 가동률 차이, 추가 보수 U·직접 C를 함께 보아야 한다. GDP 차이나 예비력을 전기 판매 현금으로 더하지 않았다. 미래 설계에서는 긴 수익 회수와 공공 예비력 구매/용량 대가를 별도로 검토할 수 있다.

## 행성별 전력망·식민지 모듈 규모

지구는8.12TW 기존 부하에 여유를 둔 집계 기존망이다. 상세 기존 산업/H 전기를 배경에서 뺀 뒤 다시 넣어 중복을 방지했다. 초기 소형 정착지 전력은2~8kW/인 가정으로 비교했다.4kW/인이면 달0.8GW/화성0.2GW다. 정격 기준 달에서 핵융합6.25배·핵분열3.125배·태양광1.875배, 화성에서25/12.5/7.5배다. 태양광은 평균 발전이 정격보다 낮아 단순 정격 과잉이 야간 공급 충분을 뜻하지 않는다.

${t(['천체','수요 범위 GW','핵융합 정격/수요','핵분열 정격/수요','태양광 정격/수요'],[['달','0.4~1.6','3.125~12.5배','1.563~6.25배','0.938~3.75배'],['화성','0.1~0.4','12.5~50배','6.25~25배','3.75~15배']])}

정격출력은 바꾸지 않았다. 개선안은 소규모 초기 기술/모듈을 **후속 별도 설계**로 두기, 초기 수요를 묶는 단계 건설, 저장·예비력과 발전의 역할 분리, 초기 보급망/유상 구호 정책이다. 큰 모듈을 감산하면 신규 투자비가 저절로 줄어들지는 않는다.

## 수소0.4의 가능 조건과 불가능 조건

0.4는 참고가이며 보장 가격/무한 재고가 아니다. 기존 광업 원천은 실제 지구2개, 달/화성0개다. 화성은 실제 수원 타일19의 전해 호스트만 가능하다. 달은 이 프리셋에서 수원 조건이 없어 전해를 만들 수 없다. 정부/민간 수소 생산의 호스트·원천·지급·전력 제약은 단위 검사로 각각 확인했다. 실제 수원 조건과 기초 전력이 없는 곳에 H를 생성하지 않는다.

${hExamples}

반올림 E0의 평균 시장${n(stat('E0','meanHydrogenPrice'),3)}C/U는 신규 설비 전원가${n(stat('E0','meanHydrogenCostC'),3)}보다 낮다. 기존 시설은 초기 자본이 이미 투입된 상태에서 단기 변동비를 감당하며 가동할 수 있으나 같은 조건의 신규 투자/장기 대체가 자생한다고 볼 수 없다. 넓은 표본에서0.4 이하의 원가·시장수익 사례도 별도로 찾았다. 수전해55→50kWh/kg 효율만으로 높은 건설비/직접 C 부담이 없어지지는 않는다.

### 정상 수소 소비 민감도 — 기본값 변경 없음

${fuelTable}

핵융합 정상 소비를 낮추면 직접 H비는 줄지만 수소 공급시설의 판매가격/투자 수익에는 불리할 수 있다. 제련 보조가 큰 수요라 영향이 단순 비례하지 않고 재고/공급 지연을 통해 달라진다. 위 수치는 동일 시드 묶음 평균이며 출력·최초 기동5U·건설5U·기동2,500C는 모두 동일하다. 정상 기본값은 계속 **2.5U/월**이다.

## 중단·부족·위기

반올림안 중단 직접 C 잔존은${pct(C.recommended.energy.pausedCashFraction)}, 보존 합금은${pct(C.recommended.energy.pausedAlloyFraction)}다. 가동 중에는 고정 C60%+가동률40%, 합금85%+가동률15%로 나눈다. E6의48~60개월 동안 정부 생산은 정지하고 완공 시설 보수는 계속된다. 냉간 복귀는 다시 기동 자원을 지불하며 일반 감산에는 기동비가 없다.

E3의 하루6시간 피크+기존 공급10% 고장은 산업 감산/GDP 저하를 만든다. E4는 수소 생산 중단과 기동 겹침, 외부 시동 전력0인 달을 포함하며 달의 자체 기동은 끝나지 않는다. E5는 실제 재고 징발+광업 중단 이후 전력/산업 보수 결손이 서로 악화되어 장기 함정에 빠진다. 반올림 지구 미공급${pct(stat('E5','earthUnservedFraction'),2)}, 최저 건전도0.1로 남았다. 자동 무료 복구/무한 보급으로 숨기지 않았다. 실제 수리 재료/C를 지급하는 회복 하위 검사는 통과했지만 E5 자체의 충분한 유상 구호 정책은 이번 버전에 없다.

${scenarioTable}

S1-sell의 민간 용량 변화는 S1 대비${pct(sell,2)}다. 선행 약−43.95%와 차이가 나는 이유는 그림자비용 대신 실제 현금·재료 지출, 과잉 생산의 판매/민간 재고·투자 조건을 넣었기 때문이다. 효과를 숨기거나 이전 수치를 새 모형에 강제하지 않았다. 정부 점유율/집중 지원/스트레스는 별도 정보 지표다.

## 선행 회귀와 보존

OFF는 선행 직접 실행과140/140 해시가 같고, rounded-4 첫 시드 S0 경로 해시 \`8d1ff9cf827461200f4831313449df1b44f334f2d42f4daa89835f14c045e71b\`를 보존했다. Round1 고정 해시는 기존 단위 검사에서 유지한다. 원본 소스/데이터의 바이트 보존 검사는 [VERIFICATION.md](VERIFICATION.md)에 기록한다.

OFF/ON은 구조가 다르므로 ON을 기존 합격으로 보고하지 않았다. 예를 들어 기존 rounded-4의 S0 최종 CPI는 OFF=${n(baseCPI,4)}, ON=${n(onCPI,4)}다. 동일 목표 발행 규칙이라 비슷한 CPI라도 개별 국고·민간 재고·공급원가 경로는 달라진다. 구 정부11.5%/민간10% 운영 프록시는 ON에서0이며 직접C/U/전기로 교체했다. C 거래를 GDP나 화폐발행으로 중복 계상하지 않았다.

## 민감도·한계·사용자 결정 사항

민감도 상위 축: ${SEN.slice(0,8).map(x=>x.parameter).join(', ')}. OAT는 한 축 양끝의 가격/미공급 변화 합산 점수로, 상호작용의 인과 순위라고 주장하지 않는다. 표본512/128와5개 공통 시드는 전체 모수·새 미래 시드의 안정성을 보장하지 않는다.

1. ${C.candidates.map(c=>c.id).join("/")}는 평시 근접안이며 전시 상승20% 하한과 모형의 완충 재고가 충돌한다. 기준을 바꾸거나 재고·전시 조달 정책을 바꾸는 결정이 필요하다. 이번에는 어느 쪽도 확정하지 않았다.
2. 직접 C ${pct(Math.min(...C.candidates.map(c=>c.energy.directAnnual)))}~${pct(Math.max(...C.candidates.map(c=>c.energy.directAnnual)))}, 보수 U ${pct(Math.min(...C.candidates.map(c=>c.energy.upkeepAnnual)))}~${pct(Math.max(...C.candidates.map(c=>c.energy.upkeepAnnual)))}로 후보 간 전략이 다르다. 보수10% 반올림안은 지구 평시30/30이지만 식민지 재료 결손과 전시 회복 실패가 남는다. 어느 안도 확정값으로 권고하지 않는다.
3. 정부 발전은 공공 용량/비상 기반시설 가치가 크다. 현재 잠정 C/U 비용과 요금에서 단독 모듈의 수익 회수는 어렵고, 태양광은 최대 기반 공유에서도 현금 손실이다. 가격/비용/공공 용량 대가의 목표를 별도 정해야 한다.
4. 수소0.4를 목표로 할지, 생산비·수급에 따라 더 높게 허용할지 결정해야 한다. 반올림안 신규 설비 비용은 약${n(stat("E0","meanHydrogenCostC"),2)}C/U라0.4 보장이 불가능하다. 연료0.5/1.0은 승인 전까지 민감도일 뿐이다.
5. 초기 식민지에서 큰 발전 모듈·긴 달의 밤·확장 자재 보급을 함께 설계해야 한다. 고정 출력을 임의 축소하지 않았다.

이 보고서는 섹터 송전·실제 물류망·개별 기업·연료주기·계절/위도 일사·공정열·연구/전투를 구현한 게임 패치가 아니다. 기존 공식 프리셋·지질·자원·인구·시계·저장·UI는 그대로다. [자료와 가정](SOURCES.md), [실행/회계 구조](IMPLEMENTATION.md), [원시 결과](results.json)를 함께 검토한다.
`;
fs.writeFileSync(root+'REPORT_KO.md',md);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function htmlTable(headers,data){return '<div class="table-scroll" tabindex="0"><table><thead><tr>'+headers.map(v=>'<th scope="col">'+esc(v)+'</th>').join('')+'</tr></thead><tbody>'+data.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
const captions={
 '01-macro':'지구·전체 경제: 반올림 대표시드. 위기 E5는 평시 판정 대상이 아닙니다.',
 '02-fiscal':'재량 예산과 실제 채권/발행을 구분한 국고·부채 경로.',
 '03-grid':'기존 산업을8.12TW 안에서 분해한 통합망. 가용량은 삭감 가능한 공급을 포함합니다.',
 '04-industry':'실제 전력·원료 제약에 따른 생산과 산업 전기 가동률.',
 '05-colonies':'달의 긴 밤과 화성12.33h 명암 저장을 구분했습니다. 미공급을 삭제하지 않았습니다.',
 '06-hydrogen':'0.4 기준가·실제 시장·신규 설비 전원가와 수요처를 분리했습니다.',
 '07-government-costs':'자체 합금 U를 가짜 현금 비용으로 만들지 않고 직접 C와 나눴습니다.',
 '08-paused':'E6 중단 구간. C는 크게 줄고 합금 보존은 계속됩니다.',
 '09-maintenance-crisis':'E5의 보수 결손·연쇄 붕괴. 외부 구호 없는 자동 회복은 없습니다.',
 '10-startup':'진행시간 기준 정확한96h 기동: 입력75GWh·발전180GWh·수소5U. 부족하면 벽시계 시간과 다릅니다.',
 '11-power-finance':'외부 전량 판매·재료 매입 가정. 현금 회수가 없는 막대는0년 수익이라는 뜻이 아닙니다.',
 '12-fuel-sensitivity':'정상 기본값은2.5U/월입니다. 0.5/1.0은 별도 실험입니다.',
 '13-metal-mixes':'전체 합금을 알루미늄으로 취급하지 않고3개 구성을 같은 시드에서 비교했습니다.',
 '14-oat':'OAT 측정 영향 상위10축. 절대 변화의 정규화 합이며 인과 순위가 아닙니다.',
 '15-colony-sizing':'모듈 정격과 평균 발전은 다릅니다. 정격을 낮추지 않고 과잉 크기를 평가했습니다.',
 '16-infrastructure':'미공급·누적 실질 GDP 손실 회피는 전기 판매 현금과 별도입니다. 사건 종료 후20년말 GDP가 같아도 사건 중 손실은 다를 수 있습니다.',
 '17-parallel-build':'행성 전체 정부 공사 할증·준공·겹친 기동. 기반 비용은 단지당 한 번입니다.',
 '18-war':'기존 전시 상승20~60% 범위와 새 경로의 차이. 기준 실패를 통과로 바꾸지 않았습니다.',
 '19-legacy-off-on':'선행 rounded-4 OFF/ON 대조입니다. 새 반올림안과 혼동하지 않습니다.',
 '20-government-selling':'국영 판매의 민간 투자/가격 효과를 S1과 비교했습니다.',
 '21-hydrogen-feasibility':'넓은512개 표본의 H 비용/가격. 녹색은 평균 시장가가 신규 비용 이상, 붉은색은 미만입니다.'
};
const figure=name=>'<figure><div class="plot-scroll" tabindex="0" aria-label="확대 그래프 가로 스크롤">'+fs.readFileSync(root+'charts/'+name+'.svg','utf8').replace(/<\?xml[^>]*>|<!DOCTYPE[\s\S]*?\]>/g,'').replace(/<!DOCTYPE[\s\S]*?>/g,'')+'</div><figcaption>'+esc(captions[name])+'</figcaption></figure>';
const checkHtml=htmlTable(['후보','무결성','평시','전시','추가 안정성'],candidateStats.map(c=>[c.id,'80/80',c.peacePass+'/'+c.peaceCount,c.warPass+'/'+c.warCount,c.proposedReliabilityPassed?'충족':'미충족']));
const paramHtml=htmlTable(['항목',...candidates.map(c=>c.id)],[['직접 C /년',...candidates.map(c=>pct(c.energy.directAnnual))],['합금 U /년',...candidates.map(c=>pct(c.energy.upkeepAnnual))],['기초 여유',...candidates.map(c=>pct(c.energy.gridReserve))],['전기비/GDP',...candidates.map(c=>pct(c.energy.electricityGDPShare))],['H 설비 C',...candidates.map(c=>n(c.energy.hydrogenModuleC,0))]]);
const fuelHtml=htmlTable(['경로','실험 U/월','시장 C/U','신규 원가 C/U','20년 정상 H'],fuelStats.map(r=>[r.scenario,n(r.fuel,1),n(r.market,3),n(r.cost,3),n(r.normalH,1)]));
const financeHtml=htmlTable(['방식','단독 연 순 C','최대 연 순 C','최대 회수 년'],F.generationSingle.map((r,i)=>[r.type,n(r.annualNetC),n(F.generationMaximum[i].annualNetC),n(F.generationMaximum[i].cashPaybackYears)]));
const sections=[
 ['summary','요약',`<p class="eyebrow">ECON-SIM-3 · 2026-11-01 · 사용자 미결정</p><h1>전력은 기반시설이고,<br>합금은 복수 산업입니다.</h1><p class="lead">정상 수소 <b>2.5U/월</b>과 고정 정격을 보존했습니다. 가격·전력·재고·운영비를 닫힌 장부에서 검증했습니다.</p><div class="cards"><div><b>0개</b><span>모든 기준 최종 합격</span></div><div><b>320/320</b><span>최종 경로 무결성</span></div><div><b>15,591회</b><span>수치 실행 · 5개 시드</span></div></div><p class="notice">평시 통과는 ${candidateStats.map(c=>c.id+" "+c.peacePass+"/"+c.peaceCount).join(", ")}입니다. 전시 가격 상승 하한과 식민지 공급 안정성 제안은 미달했습니다. <b>부분 충족을 최종 합격으로 표시하지 않았습니다.</b></p>${checkHtml}<p>게임 본체·공식 프리셋·기존1/2차는 보존했습니다. 이 문서는 외부 네트워크 없이 열리는 독립 보고서입니다. 수치 채택·main 병합은 하지 않았습니다.</p>${figure('01-macro')}${figure('19-legacy-off-on')}`],
 ['candidates','후보',`<h2>원안3개와 별도 반올림안</h2><p>모두 최종 미결정입니다. 각 후보를16경로×5시드로 재실행했습니다. 아래 후보 버튼은 표의 검증 결과를 바꾸며, 다른 탭 그림은 명시된 반올림 대표시드입니다.</p>${paramHtml}<div class="candidate-tabs" role="group" aria-label="후보 비교">${candidates.map((c,i)=>'<button data-candidate="'+i+'" aria-pressed="'+(i===3)+'">'+esc(c.id)+'</button>').join('')}</div><p id="candidate-description"></p><div id="candidate-results"></div>${figure('14-oat')}<p>범위·사건·오차·현금/비현금 구분은 구현 문서에 있습니다. 반올림은 기본값 채택을 뜻하지 않습니다.</p>`],
 ['power','전력',`<h2>행성 통합망과 독립 발전 재무</h2><p>지구8.12TW는 기존 산업을 포함합니다. 상세 산업을 배경에서 먼저 빼고 증가분만 더했습니다. 개별 광산마다 발전소를 강제하지 않습니다.</p><p>산업 회수: 운영비0 ${n(F.industry.zeroOperatingOrderYears)}년 / 실비 포함 ${n(F.industry.actualOperatingOrderYears)}년. 발전은 따로 계산합니다.</p>${financeHtml}<p class="notice">발전1기 단독은 셋 모두 연 순현금 음수입니다. 최대 기반 공유에서도 핵융합 ${n(F.generationMaximum[0].cashPaybackYears,1)}년, 핵분열 ${n(F.generationMaximum[1].cashPaybackYears,1)}년, 태양광 미회수입니다. 전량 외부 판매·재료 매입 가정이며 공공 가치를 현금 수익에 더하지 않았습니다.</p>${figure('03-grid')}${figure('05-colonies')}${figure('10-startup')}${figure('11-power-finance')}${figure('15-colony-sizing')}${figure('16-infrastructure')}`],
 ['hydrogen','수소·합금',`<h2>구성·가격·민감도를 나눠 비교</h2><p>철강/기타/Al 구성은80/15/5,60/25/15,30/40/30을 비교합니다. 각각2.025/3.575/5.900MWh/t-alloy이며 관측된 미래 점유율이 아닌 검증 가정입니다.</p><p>반올림 E0 평균 H ${n(stat('E0','meanHydrogenPrice'),3)}C/U에 비해 신규 전원가는${n(stat('E0','meanHydrogenCostC'),3)}입니다. 기존 설비의 단기 가동을 신규 투자 자생 가능성으로 해석하지 않습니다.</p>${fuelHtml}<p class="notice">0.5/1.0은 민감도만 수행했습니다. <b>기본2.5U/월을 유지합니다.</b> 건설5U와 기동5U도 바꾸지 않았습니다.</p>${figure('06-hydrogen')}${figure('12-fuel-sensitivity')}${figure('13-metal-mixes')}${figure('21-hydrogen-feasibility')}`],
 ['stress','위기·운영',`<h2>실제 부족과 중단 비용</h2><p>중단 C 잔존${pct(C.recommended.energy.pausedCashFraction)}, 합금${pct(C.recommended.energy.pausedAlloyFraction)}의 반올림안을 별도 검증했습니다. E5의 장기 보수 붕괴는 유상 구호 없이 복구되지 않습니다. 위기 E3~E8에 평시 가격 기준을 강제하지 않았습니다.</p>${figure('04-industry')}${figure('07-government-costs')}${figure('08-paused')}${figure('09-maintenance-crisis')}${figure('17-parallel-build')}${figure('18-war')}${figure('20-government-selling')}${figure('02-fiscal')}`],
 ['verification','검증·자료',`<h2>재현과 검증</h2><p>기준 <code>${R.baselineCommit}</code>, <a href="https://github.com/0-FLANDRE-0/SPACE_Project/pull/10">PR #10</a>.</p><p>넓은7680회 + OAT870회 + 좁힌5760회 + 확장360회 + 최종320회. 선행 OFF/ON280회와 원본140회는 별도입니다. 상세 횟수는 결과 JSON에 있습니다.</p><p>전체 ${n(R.timings.totalSeconds)}초.20년 단일 p50 ${n(R.performance.p50Ms)}ms / p95 ${n(R.performance.p95Ms)}ms. 선행2차보다 느리며50ms 목표를 약${n(Math.max(0,R.performance.p50Ms-50),1)}ms 초과했습니다. 독립 재현을 동시에 실행한 실제 측정입니다. 시간 측정은 결정성 해시에서 제외합니다.</p><p>OFF140/140이 원본과 동일하고, 최종320회 장부 무결성은 통과했습니다. 평시·전시 실패와 추가 안정성 제안은 별도 집계했습니다. 테스트·브라우저 실제 기록은 검증 문서에 있습니다.</p><div class="links"><a href="REPORT_KO.md">전체 한국어 보고서</a><a href="runs.csv">원시 실행 CSV</a><a href="results.json">결과 JSON</a><a href="candidates.json">후보 JSON</a><a href="VERIFICATION.md">검증 기록</a><a href="SOURCES.md">자료·가정</a><a href="IMPLEMENTATION.md">구현·재현</a></div><h3>사용자 결정이 필요한 것</h3><ol><li>전시 가격 하한과 완충 재고/조달 정책의 목표.</li><li>발전의 수익 투자와 공공 예비력 가치의 분리.</li><li>H0.4 목표와 신규 생산비의 차이 처리.</li><li>큰 초기 모듈·저장·유상 보급의 단계 설계.</li></ol><p>기준을 완화하거나 민감도 결과를 자동 적용하지 않았습니다. 실제 휴대폰 파일 앱/Safari 직접 열기는 별도 검증이 필요합니다.</p>`]
];
const data=candidateStats.map(c=>({id:c.id,peacePass:c.peacePass,peaceCount:c.peaceCount,warPass:c.warPass,warCount:c.warCount,scenarios:R.scope.final.map(s=>{const a=rows.filter(r=>r.id===c.id&&r.scenario===s);return [s,n(mean(a.map(r=>r.meanRealAlloyPrice)),3),pct(mean(a.map(r=>r.earthUnservedFraction)),3),pct(mean(a.map(r=>r.colonyUnservedFraction)),3),n(mean(a.map(r=>r.meanHydrogenPrice)),3)];})}));
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>SPACE_Project ECON-SIM-3 검증</title><style>
*{box-sizing:border-box}html{background:#080f1c;color:#dce6f5;font-family:system-ui,-apple-system,sans-serif;line-height:1.65}body{margin:0}a{color:#75d8ff}header{border-bottom:1px solid #2c3d58;background:#0c1728;padding:12px max(16px,calc((100vw - 1080px)/2))}header b{letter-spacing:.06em}header span{display:block;font-size:12px;color:#a5bad7}nav{display:flex;gap:6px;overflow:auto;position:sticky;top:0;z-index:5;background:#101e32;padding:8px max(12px,calc((100vw - 1080px)/2));border-bottom:1px solid #30405a}button{font:inherit;border:1px solid #3d5273;background:#14243a;color:#dce8fa;border-radius:8px;padding:9px 14px;min-height:44px;cursor:pointer;white-space:nowrap}button[aria-pressed=true]{background:#244f72;border-color:#73c6ee;color:white}button:focus-visible,a:focus-visible,.table-scroll:focus-visible{outline:2px solid #f9bf67;outline-offset:2px}main{max-width:1120px;margin:auto;padding:24px 20px 60px}section[hidden]{display:none}h1{font-size:clamp(27px,4vw,46px);line-height:1.25;letter-spacing:-.03em}h2{font-size:28px}h3{font-size:21px}p{max-width:100ch}code{overflow-wrap:anywhere;color:#aecbff;font-size:12px}.eyebrow{font-size:12px;color:#82ceee;letter-spacing:.08em}.lead{font-size:18px;color:#c4d3e7}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.cards>div{border:1px solid #304765;border-radius:12px;padding:16px;background:#122139}.cards b{display:block;font-size:28px;color:#7bd6ff}.cards span{font-size:12px;color:#b3c5dd}.notice{padding:15px 17px;border-left:3px solid #f9bf67;background:#242332;border-radius:5px}.table-scroll{max-width:100%;overflow:auto;border:1px solid #334762;border-radius:8px;margin:20px 0}table{border-collapse:collapse;min-width:620px;width:100%;font-size:13px}th,td{padding:10px 12px;border-bottom:1px solid #273a55;text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}th{background:#172b44;color:#adcde8}figure{margin:26px 0;padding:10px 10px 14px;border:1px solid #2a405f;background:#0d1524;border-radius:10px}.plot-scroll{max-width:100%;overflow-x:auto}figure svg{width:100%;height:auto;display:block}figcaption{padding:8px 10px 0;color:#adc3dc;font-size:13px}.candidate-tabs{display:flex;gap:8px;overflow:auto;padding-bottom:8px}.links{display:flex;flex-wrap:wrap;gap:12px;padding:18px;background:#122039;border-radius:10px}.links a{display:inline-flex;align-items:center;min-height:44px}footer{max-width:1080px;margin:auto;padding:22px;color:#8da7c7;border-top:1px solid #2c3e57;font-size:12px}@media(max-width:600px){main{padding:18px 12px 40px}h2{font-size:24px}.lead{font-size:16px}.cards{gap:7px}.cards>div{padding:10px}.cards b{font-size:22px}.cards span{font-size:11px}figure{padding:3px}figure svg{min-width:680px}.plot-scroll::before{content:"그래프는 좌우로 밀어 볼 수 있습니다";display:block;font-size:11px;color:#9db9d5;padding:8px}figcaption{font-size:12px}nav button{padding:8px 11px;font-size:13px}th,td{padding:9px}table{font-size:12px}}
</style></head><body><header><b>SPACE_Project / ECON-SIM-3</b><span>오프라인 검토 보고서 · 게임 기본값 미적용 · 정상 수소2.5U/월</span></header><nav aria-label="보고서 탐색">${sections.map(([id,title],i)=>'<button data-nav="'+id+'" aria-pressed="'+(i===0)+'">'+title+'</button>').join('')}</nav><main>${sections.map(([id,title,body],i)=>'<section id="'+id+'" data-panel="'+id+'"'+(i?' hidden':'')+' aria-label="'+title+'">'+body+'</section>').join('')}</main><footer>대표 그래프: R3-rounded / econ-1. 표는 별도 표시가 없으면5시드 평균입니다. 출처·미확정 가정·실패·범위는 전체 보고서에 공개합니다.</footer><script id="candidate-data" type="application/json">${JSON.stringify(data).replaceAll('<','\\u003c')}</script><script>
const candidates=JSON.parse(document.querySelector('#candidate-data').textContent);
for(const button of document.querySelectorAll('[data-nav]'))button.addEventListener('click',()=>{for(const b of document.querySelectorAll('[data-nav]'))b.setAttribute('aria-pressed',String(b===button));for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==button.dataset.nav;window.scrollTo({top:0});});
function showCandidate(i){const c=candidates[i];for(const button of document.querySelectorAll('[data-candidate]'))button.setAttribute('aria-pressed',String(+button.dataset.candidate===i));document.querySelector('#candidate-description').textContent=c.id+': 무결성80/80, 평시 '+c.peacePass+'/'+c.peaceCount+', 전시 '+c.warPass+'/'+c.warCount+'. 추가 공급안정성 제안 미충족. 최종 채택 아님.';const div=document.createElement('div');div.className='table-scroll';div.tabIndex=0;const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');for(const title of ['경로','평균 합금 C/U','지구 미공급','식민지 최대 미공급','H C/U']){const th=document.createElement('th');th.scope='col';th.textContent=title;tr.append(th);}head.append(tr);table.append(head);const body=document.createElement('tbody');for(const row of c.scenarios){const tr=document.createElement('tr');for(const v of row){const td=document.createElement('td');td.textContent=v;tr.append(td);}body.append(tr);}table.append(body);div.append(table);document.querySelector('#candidate-results').replaceChildren(div);}
for(const button of document.querySelectorAll('[data-candidate]'))button.addEventListener('click',()=>showCandidate(+button.dataset.candidate));showCandidate(3);
</script></body></html>`;
fs.writeFileSync(root+'report.html',html);console.log('Korean report and offline HTML written; '+Object.keys(captions).length+' inline charts; final complete passes=0');
