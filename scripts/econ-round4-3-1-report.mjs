import fs from "node:fs";
import crypto from "node:crypto";
import { gzipSync } from "node:zlib";
import { ROOT431 as root, read431 } from "./econ-round4-3-1-inputs.mjs";
const summary = read431(root + "/summary.json"),
  series = Object.fromEntries(
    ["half", "zero", "full"].map((k) => [
      k,
      read431(`${root}/series-${k}.json`),
    ]),
  );
// Display paths only: same six-decimal chart compression as43; raw JSON remains exact.
for (const profile of Object.values(series))
  for (const rows of Object.values(profile.paths))
    for (const row of rows)
      for (let i = 0; i < row.length; i++)
        if (typeof row[i] === "number") row[i] = Math.round(row[i] * 1e6) / 1e6;
const build = Object.fromEntries(
  ["summary.json", "run-source-manifest.json", "performance.json"].map((f) => [
    f,
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(root + "/" + f))
      .digest("hex"),
  ]),
);
const payload = gzipSync(
  JSON.stringify({
    summary,
    series,
    chartPrecisionDecimals: 6,
    build,
    performance: read431(root + "/performance.json"),
  }),
  { level: 9 },
).toString("base64");
const html = String.raw`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SPACE · ECON-SIM-4.3.1 생명유지 비축</title><link rel="icon" href="data:,"><style>
:root{color-scheme:dark;--bg:#0c1522;--panel:#142236;--line:#314157;--text:#dce6f1;--muted:#9cb0c7;--gold:#f6c56b;--blue:#7fbfff;--green:#83d3b0;--red:#ef9b9b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.6 system-ui,-apple-system,sans-serif}main{max-width:1460px;margin:auto;padding:24px}h1{font-size:clamp(23px,3vw,35px);line-height:1.3;margin:6px 0 14px}h2{font-size:18px;margin:0 0 12px}p{margin:8px 0}.eyebrow{color:var(--gold);letter-spacing:2px;font-size:11px}.note,small{color:var(--muted);font-size:12px;overflow-wrap:anywhere}.banner{border-left:4px solid var(--gold);padding:14px;background:#1d2d40;margin:18px 0}.stats,.controls,.charts{display:grid;gap:12px}.stats{grid-template-columns:repeat(4,minmax(0,1fr));margin:16px 0}.stat,section,.chart{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;min-width:0}section{margin:16px 0}.stat b{display:block;color:var(--gold);font-size:23px}.controls{grid-template-columns:1fr 1fr 2fr}label{color:var(--muted);font-size:12px}select,button,summary{font:inherit;background:#1a304a;border:1px solid #455d77;color:var(--text);border-radius:5px;min-height:44px;padding:8px 12px}select{width:100%;max-width:100%}button,summary{cursor:pointer}button[aria-pressed=true]{border-color:var(--gold);color:var(--gold);background:#344052}.buttons,.legend{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.legend{font-size:11px;gap:16px}.legend i{display:inline-block;width:20px;height:3px;vertical-align:middle;margin-right:4px}.charts{grid-template-columns:repeat(2,minmax(0,1fr))}.chart{margin:0;padding:12px}.chart svg{display:block;width:100%;height:auto;min-height:170px}.chart p{font-size:11px;color:var(--muted)}.table-scroll{max-width:100%;overflow:auto;border:1px solid var(--line);border-radius:4px}table{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap}th,td{padding:8px 10px;text-align:right;border-bottom:1px solid var(--line)}th:first-child,td:first-child{text-align:left}thead{background:#1d3049}details{margin-top:10px}footer{margin:25px 0;color:var(--muted);font-size:12px}@media(max-width:900px){main{padding:14px}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.charts{grid-template-columns:1fr}section{padding:12px}.chart{padding:9px}.controls{grid-template-columns:1fr 1fr}.controls label:last-child{grid-column:1/-1}}@media(orientation:landscape) and (max-height:500px){main{padding:12px}.controls{grid-template-columns:1fr 1fr 2fr}.controls label:last-child{grid-column:auto}.stats{grid-template-columns:repeat(4,minmax(0,1fr))}.stat{padding:10px}.stat b{font-size:19px}}
</style><main><header><div class="eyebrow">SPACE PROJECT · ECONOMY LAB / 4.3.1</div><h1>6개월의 비축과 독립된 산소 공급</h1><p class="note">고정 R4.3 반올림안 · 5시드 · 240개월 · 2026-11-07 Asia/Seoul</p><p class="banner">오프라인 검증이며 게임에 적용하지 않았습니다. 국가 단일 금고와 기존 수소·얼음 수치는 고정했습니다. 식민지 물·산소 비축, 전용 산소 발생기와 감면 뒤 세율을 비교합니다. 새 비용과 여유율은 임시입니다.</p></header><div id="loading" class="banner">내장 데이터를 여는 중입니다…</div><div id="app" hidden><p id="answer" class="banner"></p><div id="stats" class="stats"></div><section><h2>월 경로 · 1번 시드의 실제 공급과 비축</h2><div class="controls"><label>감면 후 식민지 세율<select id="tax"><option value="half">12.5% · 기본(국가의 절반)</option><option value="zero">0% · 비교</option><option value="full">25% · 비교</option></select></label><label>천체<select id="planet"><option value="moon">달</option><option value="mars">화성</option><option value="earth">지구</option></select></label><label>시나리오<select id="scenario"></select></label></div><div class="buttons"><button data-lane="self" aria-pressed="true">자력 기준</button><button data-lane="relief" aria-pressed="false">구호 포함 기준</button></div><p id="scope" class="note"></p><div class="legend"><span><i style="background:var(--gold)"></i>수소 환원 ON</span><span><i style="background:var(--blue)"></i>OFF / 기존 공정</span><span><i style="background:var(--green)"></i>비축 목표 / 산소 충족률</span></div><div id="charts" class="charts"></div><details><summary>E5-M 18격자 선택</summary><div id="grid" class="buttons"></div></details></section>
<section><h2>선택 경로 · 5시드의 생명유지와 비용</h2><p class="note">충족률은 설립 후12개월 유예 뒤 최저 월입니다. 전용 발생기는 H-CUT 대상에서 제외되지만 실제 물·전력·유지비를 지불해야 합니다. 수소 부산물은 월말 현지 재고에 더하며 산소 매출은 없습니다.</p><div id="info" class="table-scroll"></div></section>
<section><h2>세율 3안 · 평시 E2-S의 식민지 재정·투자</h2><p class="note">5년 감면 이후 12.5% / 0% / 25%입니다. 순재정은 실제 세수−해당 천체 국가 지출이며 공기업 매출을 세수로 세지 않습니다. 인구 성장률은 기존 외생값이므로 세율에 따른 이주 효과는 이 모델에서 계산하지 않습니다.</p><div id="tax-table" class="table-scroll"></div></section>
<section><h2>최초 비축 충전 · E2-S</h2><p class="note">각 비축이 처음 목표에 도달한 월과 그때까지의 비용입니다. 저장·발생기는 생명유지와 비축에 함께 사용되므로 표의 현금 비용은 공유 설비 직접 현금액이며 순수 추가 비축비가 아닙니다. 마지막 열은 자원 조달·물류·다른 공유 시설까지 포함한 해당 천체의 실제 국가 지출 총액입니다. 물 재고 취득가 평가와 전력 요금 평가를 현금 지출에 다시 합산하지 않습니다. 달과 화성의 기존 초기 물 조건은 다릅니다.</p><div id="fill" class="table-scroll"></div></section>
<section><h2>연간 순재정과 국가 금고</h2><p id="annual-scope" class="note"></p><div id="annual" class="table-scroll"></div></section>
<section><h2>수소 경제와 4.3 대비 변화</h2><p class="note">고정4.3의 세율0%·비축/전용 발생기 없음과 이번 기본 세율12.5%를 비교합니다. 여러 변경을 함께 적용한 결과이므로 순수한 비축 단독 효과로 해석하지 않습니다.</p><div id="comparison" class="table-scroll"></div></section>
<section><h2>극한 충격 · 생명유지 정보 지표</h2><p class="note">E4·E5·E5-X·E6·E11은 생명유지 합격 판정에서 제외합니다. 아래 연속 완전 충족 기간은 기존 공급과 비축을 함께 사용한 결과입니다. 기간 전체 충족은 관측 종료이며 비축만으로 그 기간을 버텼다는 뜻이 아닙니다. 충격 직전 비축이 미충전인 경우와 충격 종료 후 회복 구간의 미달도 전체 최저치로 표시합니다.</p><div id="extreme" class="table-scroll"></div></section>
<section><h2>기준별 판정</h2><p class="note">4.1 기준은 국가 금고 기준으로 유지합니다. 생명유지는 평시 E0·E2-S, E5-M 18격자를 포함한 중간 충격과 H-CUT에서 유예 뒤 매월99% 이상이어야 합니다. 새 지시서의 지구 생산 순증 기준은 E0이며 준비 무차단 대조의 순증은 정보로 남겼습니다.</p><div id="criteria" class="table-scroll"></div><div id="criteria-detail" class="table-scroll" style="margin-top:12px"></div></section>
<section><h2>검증·원자료</h2><div id="performance" class="table-scroll"></div><p class="note">이 화면은 게임 FPS가 아닌 오프라인20년 실행 결과입니다. 원장·기존 파일 보존·독립 재현과 Chromium 보고서 조작 검증의 상세 범위는 VERIFICATION.md에 있습니다.</p><button id="export">선택 경로 JSON 내보내기</button><p class="note">화성 초기 민간 물200,000U 유지 · 임시 얼음 매장량 달100만U/화성1,000만U · 저장비·발생기 여유율·세율 절반 계수는 임시 · 게임/M3·물류 배송·식량·산소 시장·새 금융 구제는 범위 밖</p></section></div><footer>SPACE PROJECT · ECON-SIM-4.3.1 · 외부 요청 없이 내장 데이터로 동작합니다. 그래프·선택 경로 월값은 소수6자리 반올림이며 표·판정·원자료 JSON은 원정밀도입니다.</footer></main><script id="payload" type="application/octet-stream">__PAYLOAD__</script><script>
(async()=>{try{
const bytes=Uint8Array.from(atob(document.querySelector('#payload').textContent.trim()),c=>c.charCodeAt(0)),raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text(),data=JSON.parse(raw),s=data.summary;
window.report431=data;let lane='self';
const $=id=>document.getElementById(id),fmt=(x,n=2)=>x==null?'없음':Number.isFinite(x)?x.toLocaleString('ko-KR',{maximumFractionDigits:n}):String(x),pct=x=>x==null?'해당 없음':fmt(x*100,3)+'%',modeName=k=>({half:'12.5%',zero:'0%',full:'25%'}[k]),esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),table=(id,heads,rows)=>{$(id).innerHTML='<table><thead><tr>'+heads.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';};
const path=(tax,world,enabled)=>{const z=data.series[tax],rows=z.paths[lane+'/'+world+'/'+enabled];return rows?.map(r=>Object.fromEntries(z.columns.map((k,i)=>[k,r[i]])))??[];},getCase=(tax,world,enabled=true)=>s.cases.find(c=>c.taxMode===tax&&c.lane===lane&&c.scenario===world&&c.enabled===enabled);
const colors=['#f6c56b','#7fbfff','#83d3b0','#ef9b9b'];
function chart(title,lines,shade,note){
 const all=lines.flatMap(l=>l.values.map(v=>v?.[1]).filter(Number.isFinite));let hi=Math.max(0,...all),lo=Math.min(0,...all);if(hi===lo)hi=lo+1;
 const labels=[lo,(lo+hi)/2,hi].map(v=>fmt(v,2)),left=Math.max(65,Math.max(...labels.map(x=>x.length))*7.3+10),w=600,h=245,right=18,top=18,bottom=33,x=m=>left+(m/240)*(w-left-right),y=v=>h-bottom-(v-lo)/(hi-lo)*(h-top-bottom);
 const mark=shade?'<rect x="'+x(shade[0])+'" y="'+top+'" width="'+(x(shade[1])-x(shade[0]))+'" height="'+(h-top-bottom)+'" fill="#ef9b9b" opacity=".12"/>':'';
 const axes=[0,.5,1].map((f,i)=>{const v=lo+f*(hi-lo);return '<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#314157"/><text x="'+(left-9)+'" y="'+(y(v)+4)+'" fill="#9cb0c7" font-size="11" text-anchor="end">'+esc(labels[i])+'</text>';}).join('');
 const paths=lines.map((l,i)=>'<path d="'+l.values.filter(v=>Number.isFinite(v[1])).map((v,j)=>(j?'L':'M')+x(v[0]).toFixed(2)+','+y(v[1]).toFixed(2)).join(' ')+'" fill="none" stroke="'+colors[i]+'" stroke-width="1.8"'+(l.dash?' stroke-dasharray="5 4"':'')+'/>').join('');
 return '<figure class="chart"><h2>'+esc(title)+'</h2><svg viewBox="0 0 600 245" role="img" aria-label="'+esc(title)+'">'+mark+axes+paths+'<text x="'+left+'" y="237" fill="#9cb0c7" font-size="11">0개월</text><text x="'+(w-right)+'" y="237" fill="#9cb0c7" font-size="11" text-anchor="end">240개월</text></svg><p>'+lines.map((l,i)=>'<span style="color:'+colors[i]+'">'+esc(l.name)+'</span>').join(' · ')+'</p><p>'+esc(note??'')+'</p></figure>';
}
function draw(){
 const tax=$('tax').value,body=$('planet').value,world=$('scenario').value,on=path(tax,world,'ON'),off=path(tax,world,'OFF'),c=getCase(tax,world),b=c.bodies[body],peace=getCase(tax,'E2-S');
 const line=(rows,k,name,dash=false)=>({name,dash,values:rows.map(r=>[r.month,r[k]])});
 let shade=null;if(c.cut)shade=[60,60+c.cut.duration];else if(['E4','E6'].includes(world))shade=[48,world==='E4'?84:60];else if(world.startsWith('E5')||world==='E11')shade=[60,60+b.shock.duration];
 document.body.dataset.path=tax+'/'+lane+'/'+world+'/'+body;
 $('scope').textContent='월 경로: econ-1 / '+(lane==='self'?'자력':'구호 포함')+' / '+modeName(tax)+' / '+world+' / '+body+' · 표는5시드 평균, 최저 충족률은 모든 시드/월의 최저 · 생명유지 '+(c.lifeRequired?'필수 판정':'정보 지표');
 $('charts').innerHTML=[
  chart('국가 단일 금고 · C',[line(on,'nationC','ON'),line(off,'nationC','OFF')],shade,'천체별 금고를 합산한 중복 잔액이 아닙니다.'),
  chart('물 비축 · U',[line(on,body+'_waterReserveU','ON 실제'),line(off,body+'_waterReserveU','OFF 실제'),line(on,body+'_waterTargetU','인구×6개월 목표',true)],shade),
  chart('산소 비축 · U',[line(on,body+'_oxygenReserveU','ON 실제'),line(off,body+'_oxygenReserveU','OFF 실제'),line(on,body+'_oxygenTargetU','인구×6개월 목표',true)],shade),
  chart('생명유지 월 충족률',[line(on,body+'_waterFraction','ON 물'),line(off,body+'_waterFraction','OFF 물'),line(on,body+'_oxygenFraction','ON 산소'),line(off,body+'_oxygenFraction','OFF 산소')],shade,'설립 후12개월 유예 뒤99%가 기준입니다.'),
  chart('전용 산소 발생기 · 전력 GWh',[line(on,body+'_dedicatedPowerGWh','ON'),line(off,body+'_dedicatedPowerGWh','OFF')],shade,'일반 수소 전해 차단과 분리된 실제 보호 부하입니다.'),
  chart('전용 발생기 물 취수 · U',[line(on,body+'_dedicatedWaterU','ON'),line(off,body+'_dedicatedWaterU','OFF')],shade,'같은 U의 산소와 수소 부산물을 만듭니다. 질량 단위는 다릅니다.'),
  chart('천체 월 순재정 · C',[line(on,body+'_netFiscalC','ON'),line(off,body+'_netFiscalC','OFF')],shade,'실제 세수−해당 천체 국가 지출. 내부 지원금 수입은 없습니다.'),
  chart('합금 생산 · U',[line(on,body+'_producedU','ON'),line(off,body+'_producedU','OFF')],shade,'비축·생명유지 비용을 지불한 동일 구조의 비교입니다.'),
 ].join('');
 const q=s.qualification.find(q=>q.taxMode===tax&&q.lane===lane);
 $('answer').textContent='선택 세율 '+modeName(tax)+' / '+(lane==='self'?'자력':'구호 포함')+' 전체 '+(q.passed?'합격':'미달')+' · '+(q.passed?'필수 조건을 모두 충족했습니다.':'미달 항목: '+Object.keys(q.failures).join(', '))+'. 극한 충격의 생명유지는 정보로 보고합니다.';
 $('stats').innerHTML=[['정식 실행',fmt(s.totalRuns,0)+'회'],['무결성 실패',fmt(s.integrityFailures,0)+'건'],['평시 식민지20년 지출',fmt(peace.national.colonySpendingC,0)+'C'],['선택 경로 물 / 산소 최저',pct(b.waterMinimum)+' / '+pct(b.oxygenMinimum)]].map(([a,b])=>'<div class="stat"><small>'+esc(a)+'</small><b>'+esc(b)+'</b></div>').join('');
 table('info',['항목','값'],[
 ['월 물 / 산소 최저',pct(b.waterMinimum)+' / '+pct(b.oxygenMinimum)],['99% 미달 월 합계(5시드)',b.waterBelow99Months+' / '+b.oxygenBelow99Months],['전용 발생기20년 물 / 산소 / 수소 부산물 U',fmt(b.dedicated.waterU)+' / '+fmt(b.dedicated.oxygenU)+' / '+fmt(b.dedicated.hydrogenU)],['전용 발생기 전력 GWh',fmt(b.dedicated.powerGWh)],['발생기 건설 / 유지·변동 현금 C',fmt(b.dedicated.capitalC)+' / '+fmt(b.dedicated.maintenanceC+b.dedicated.variableC)],['발생기 전력 요금 평가 C(현금에 추가 합산 금지)',fmt(b.dedicated.powerValueC)],['발생기 건설 / 보수 합금 U',fmt(b.dedicated.capitalAlloyU)+' / '+fmt(b.dedicated.maintenanceAlloyU)],['비축 인출 물 / 산소 U',fmt(b.reserve.waterDrawU)+' / '+fmt(b.reserve.oxygenDrawU)],['저장고 건설 / 유지 현금 C',fmt(b.reserve.tankCapitalC)+' / '+fmt(b.reserve.tankMaintenanceC)],['순재정 / 공기업 포함 현금 기여 C',fmt(b.netFiscalC)+' / '+fmt(b.cashContributionC)],['종료 민간 얼음 / 일반 전해 모듈',fmt(b.privateIceModules)+' / '+fmt(b.privateElectroModules)],['국가 최저 / 종료 평균 C',fmt(c.national.minimumTreasuryC)+' / '+fmt(c.national.endingTreasuryC)]
 ]);
 table('tax-table',['세율','천체','20년 세수C','국가 지출C','순재정C','흑자 첫해(5시드)','민간 얼음/전해','종료 인구','합금U'],['half','zero','full'].flatMap(t=>['moon','mars'].map(id=>{const b=getCase(t,'E2-S').bodies[id];return[modeName(t),id,fmt(b.taxC),fmt(b.spendingC),fmt(b.netFiscalC),b.firstPositiveFiscalYears.map(x=>x??'없음').join('/'),fmt(b.privateIceModules)+' / '+fmt(b.privateElectroModules),fmt(b.populationEnd,0),fmt(b.alloyU)];})));
 table('fill',['천체','비축','충전 시드','최초월 범위','저장 건설/유지C','발생기 건설/운영C','공유 물 구매C','물 재고 평가C','충전까지 해당 천체 전체 실제 지출C'],['moon','mars'].flatMap(id=>['water','oxygen'].map(k=>{const f=peace.bodies[id].firstFill[k];return[id,k,f.completedSeeds+'/5',fmt(f.minimumMonth,0)+'–'+fmt(f.maximumMonth,0),fmt(f.tankCapitalC)+' / '+fmt(f.tankMaintenanceC),fmt(f.dedicatedCapitalC)+' / '+fmt(f.dedicatedOperatingCashC),fmt(f.allLifeWaterPurchasesC),fmt(f.reserveWaterAcquisitionValueC),fmt(f.bodyActualSpendingC)];})));
 $('annual-scope').textContent=world+' / '+body+' / '+modeName(tax)+' / '+(lane==='self'?'자력':'구호 포함')+' · 5시드 평균 · 흑자 첫해: '+b.firstPositiveFiscalYears.map(x=>x??'없음').join('/');
 table('annual',['연도','세수C','지출C','순재정C','공기업 포함 현금 기여C','국가 종료C'],b.annualFiscal.map((a,i)=>[a.year,fmt(a.taxC),fmt(a.spendingC),fmt(a.netTaxC),fmt(a.cashNetC),fmt(c.national.annual[i].treasuryC)]));
 const old=s.comparison.find(a=>a.scenario===world&&a.lane===lane);table('comparison',['지표','4.3','4.3.1 기본12.5%'],old?[
 ['물 최저',pct(old.old.bodies[body].waterMinimum),pct(old.current.bodies[body].waterMinimum)],['산소 최저',pct(old.old.bodies[body].oxygenMinimum),pct(old.current.bodies[body].oxygenMinimum)],['20년 천체 순재정C',fmt(old.old.bodies[body].netFiscalC),fmt(old.current.bodies[body].netFiscalC)],['국가 종료C',fmt(old.old.nationalEndC),fmt(old.current.national.endingTreasuryC)],['지구 H 마진C/U',fmt(s.comparison.find(a=>a.scenario==='E0'&&a.lane===lane).old.bodies.earth.margin,6),fmt(getCase('half','E0').bodies.earth.margin,6)],['지구 신규 전해 회수년',fmt(s.comparison.find(a=>a.scenario==='E0'&&a.lane===lane).old.bodies.earth.paybackYears,3),fmt(getCase('half','E0').bodies.earth.paybackYears,3)],['E0 지구 ON/OFF',fmt(s.comparison.find(a=>a.scenario==='E0'&&a.lane===lane).old.bodies.earth.productionRatio,8),fmt(getCase('half','E0').bodies.earth.productionComparison.totalRatioMean,8)]
 ]:[['선택 경로 비교','이전 표는 E0/E2-S/E5-M/E5-X/달·화성9개월 차단에 제공','세율 선택과 별개로 기본12.5%를 비교합니다.']]);
 table('extreme',['충격','천체','직전 물/산소 충전','완전 충족 연속월(최소)','관측기간','전기간 충족 시드','충격창 물/산소 최저','유예 후 전체 물/산소 최저','물/산소 인출월(최대)'],['E4','E5','E5-X','E6','E11'].flatMap(world=>['moon','mars'].map(id=>{const z=getCase(tax,world).bodies[id].shock;return[world,id,pct(z.openingWaterTargetFraction)+' / '+pct(z.openingOxygenTargetFraction),z.fullyServedPrefixMin,z.duration,z.allWindowServedSeeds+'/5',pct(z.minWater)+' / '+pct(z.minOxygen),pct(getCase(tax,world).bodies[id].waterMinimum)+' / '+pct(getCase(tax,world).bodies[id].oxygenMinimum),z.waterDrawMonthsMax+' / '+z.oxygenDrawMonthsMax];})));
 table('criteria',['세율','기준','전체 판정','미달 항목'],s.qualification.map(q=>[modeName(q.taxMode),q.lane,q.passed?'합격':'미달',Object.entries(q.failures).map(([k,v])=>k+':'+v).join(', ')||'없음']));
 const detail=s.criteriaSummary.find(c=>c.taxMode===tax&&c.lane===lane);
 table('criteria-detail',['기준','충족 / 검사','조건'],[
 ['기존4.1 필수 경로',detail.legacyPassing+' / '+detail.legacyRequired,'기존 기준 유지'],['E0 H 시장 마진',detail.marginPassing+' / 5','≥0C/U'],['E0 신규 전해 회수',detail.paybackPassing+' / 5','≤4년'],['E0 지구 순증',detail.earthGainPassing+' / 5','ON/OFF>1'],['필수 생명유지 ON',detail.lifePassing+' / '+detail.lifeConditions,'유예 뒤 매월≥99%'],['대조 OFF 생명유지',detail.offLifePassing+' / '+detail.offLifeConditions,'대조 정보'],['국가 음수월',detail.negativeMonths,'0'],['무결성',detail.integrityPassing+' / '+detail.runs,'실패0']]);
 window.current431={case:c,body:b,peace,old,rows:on,off};
}
 $('scenario').innerHTML=Object.keys(data.series.half.paths).filter(k=>k.startsWith('self/')&&k.endsWith('/ON')).map(k=>k.split('/')[1]).map(k=>'<option value="'+esc(k)+'">'+esc(k)+'</option>').join('');$('scenario').value='E2-S';
 for(const id of ['tax','planet','scenario'])$(id).addEventListener('change',draw);
 for(const b of document.querySelectorAll('[data-lane]'))b.onclick=()=>{lane=b.dataset.lane;for(const x of document.querySelectorAll('[data-lane]'))x.setAttribute('aria-pressed',String(x===b));draw();};
 $('grid').innerHTML=Object.keys(data.series.half.paths).filter(k=>k.startsWith('self/E5-M-L')&&k.endsWith('/ON')).map(k=>k.split('/')[1]).map(k=>'<button data-scenario="'+k+'">'+k+'</button>').join('');for(const b of $('grid').querySelectorAll('button'))b.onclick=()=>{$('scenario').value=b.dataset.scenario;draw();};
 table('performance',['모델 / 시나리오','20년 p50 ms','p95 ms','회수'],Object.entries(data.performance.performance).map(([k,v])=>[k,fmt(v.p50Ms),fmt(v.p95Ms),v.samples]));
 $('export').onclick=()=>{const blob=new Blob([JSON.stringify({build:data.build,scope:$('scope').textContent,...window.current431},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='SPACE-ECON-4.3.1-selected.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 $('loading').hidden=true;$('app').hidden=false;draw();document.body.dataset.ready='true';
}catch(e){window.report431Error=String(e);document.querySelector('#loading').textContent='보고서 로드 오류: '+e;}})();
</script></html>`;
fs.writeFileSync(root + "/report.html", html.replace("__PAYLOAD__", payload));
console.log(
  "Self-contained HTML " + fs.statSync(root + "/report.html").size + " bytes",
);
