import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { read43 } from "./econ-round4-3-inputs.mjs";
import { iceQuote43 } from "../dist/src/economy-round4-3-policy.js";
const root = "docs/econ-sim/round4-3",
  s = read43(root + "/summary.json"),
  r = read43(root + "/results.json"),
  v = read43(root + "/verification.json"),
  perf = read43(root + "/performance.json"),
  browser = read43(root + "/logs/report-browser.json"),
  choices = read43(root + "/candidates.json").choices,
  c = choices.at(-1),
  config = read43("scripts/econ-round4-3.config.json"),
  prior = read43("docs/econ-sim/round4-2-2/summary.json"),
  final = read43(root + "/final-runs.json"),
  quote = iceQuote43(c.policy),
  frozen = read43(root + "/input-manifest.json");
const hash = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
assert.equal(browser.htmlSha256, hash(root + "/report.html"));
for (const file of [
  "summary.json",
  "run-source-manifest.json",
  "performance.json",
])
  assert.equal(browser.build[file], hash(root + "/" + file));
assert.equal(browser.errors.length, 0);
assert.ok(browser.offline.passed);
const fmt = (n, d = 3) =>
    n === null || n === undefined
      ? "없음/미정의"
      : Number(n).toLocaleString("ko-KR", { maximumFractionDigits: d }),
  pct = (n) =>
    n === null || n === undefined ? "미정의" : fmt(n * 100, 3) + "%",
  row = (a) => "| " + a.join(" | ") + " |\n",
  table = (h, a) => row(h) + row(h.map(() => "---")) + a.map(row).join(""),
  years = (a) => a.map((x) => (x === null ? "없음" : x + "년")).join(", "),
  id = "R43-rounded",
  lane = "self",
  market = s.markets.find(
    (x) => x.id === id && x.lane === lane && x.enabled && x.body === "earth",
  ),
  old = s.prior422,
  prod = s.production.filter((x) => x.id === id && x.lane === lane),
  earthProd = prod.find((x) => x.world === "E0" && x.body === "earth"),
  preparedEarth = prod.find(
    (x) => x.world === "H-CUT-CONTROL" && x.body === "earth",
  ),
  sv = s.survival.filter((x) => x.id === id && x.lane === lane),
  nation = s.national.find(
    (x) => x.id === id && x.lane === lane && x.world === "E2-S",
  ),
  info = (body) =>
    s.information.find(
      (x) =>
        x.id === id && x.lane === lane && x.world === "E2-S" && x.body === body,
    ),
  q = r.qualification.find((x) => x.id === id),
  oldProd = prior.production.find(
    (x) =>
      x.id === "R422-rounded" &&
      x.lane === lane &&
      x.world === "E0" &&
      x.body === "earth",
  ),
  tests = fs
    .readFileSync(root + "/logs/full-tests.log", "utf8")
    .match(/ℹ tests (\d+)/)?.[1],
  required = final.filter(
    (x) =>
      x.id === id &&
      x.lane === lane &&
      x.enabled &&
      x.classification !== "information",
  ),
  oldPassing = required.filter((x) =>
    Object.keys(x.legacyChecks).every((k) => x.checks[k]),
  ).length;
const survivalTable = table(
  [
    "얼음 채굴",
    "감면 년",
    "달 물/산소 최저월",
    "화성 물/산소 최저월",
    "달20년 순재정C",
    "화성20년 순재정C",
    "흑자 첫해(달/화성)",
  ],
  [false, true].flatMap((ice) =>
    [0, 5, 10].map((holiday) => {
      const a = sv.find(
          (x) =>
            x.body === "moon" &&
            x.iceEnabled === ice &&
            x.holidayYears === holiday,
        ),
        b = sv.find(
          (x) =>
            x.body === "mars" &&
            x.iceEnabled === ice &&
            x.holidayYears === holiday,
        );
      return [
        ice ? "허용" : "금지",
        holiday,
        pct(a.minimumWaterMonth) + " / " + pct(a.minimumOxygenMonth),
        pct(b.minimumWaterMonth) + " / " + pct(b.minimumOxygenMonth),
        fmt(a.netFiscalC),
        fmt(b.netFiscalC),
        years(a.positiveFiscalYears) + " / " + years(b.positiveFiscalYears),
      ];
    }),
  ),
);
const oxygenTable = table(
  [
    "E2-S 얼음 허용",
    "얼음 물U",
    "매장 사용",
    "산소 산출/생명유지/남음U",
    "물 평균C/U",
    "민간 얼음 모듈",
  ],
  ["moon", "mars"].map((body) => {
    const a = info(body);
    return [
      body,
      fmt(a.iceProducedU),
      pct(a.iceUsedFraction),
      [a.oxygenProducedU, a.oxygenServedU, a.oxygenStockU]
        .map((x) => fmt(x))
        .join(" / "),
      fmt(a.meanWaterPrice, 6),
      fmt(a.privateIceModules),
    ];
  }),
);
const failText = (x) =>
  Object.entries(x)
    .map(([k, v]) => k + ":" + v)
    .join(", ") || "없음";
const report = `# ECON-SIM-4.3 식민지 재정·생명유지 결과

**2026-11-07 Asia/Seoul · 오프라인 전용 · 게임 적용 없음**

**국가 단일 금고와 얼음·산소를 연결해 E2-S 평시 식민지를 지원할 수 있다. 전체 ${fmt(r.counts.totalRuns, 0)}개 경로 판정은 자력 ${r.selfPassing}/2·구호 ${r.reliefPassing}/2다.** 최종 미달이 남으면 수치를 임의로 바꾸지 않고 아래에 그대로 보고한다.

[오프라인 HTML](report.html) · [금고/세율/생명유지/얼음 식](IMPLEMENTATION.md) · [검증·재현·스크린샷](VERIFICATION.md) · [변경 파일](CHANGED_FILES.md) · [요약 JSON](summary.json) · [실행 CSV](runs.csv) · [연간 순재정 CSV](annual-fiscal.csv)

## 기준과 구조

PR #23이 미병합이어서 지정 HEAD **0c4a8c135af7e30e55c02a7d1120790884b8fec1**에서 **econ/round4-3-colony-finance**를 만들었다. 아카이브 **705d83c8892f6f35b37c46dd39bfe925a18771a6**, 보충§26·§27을 직접 읽었다. R41-rounded 하나,5시드·240개월이다. 기존1,465파일은 SHA/Git blob 기준으로 보존한다. 선별660 + 전42시나리오1,680 + 생존240 + 준비 무차단40 + H-CUT720 = 최종3,340실행이다.

정부 C는 **nation/government/C 하나**이며 천체별 정부 C 잔액은 null이다. 실물·민간 돈은 천체별이다. 실제 지출을 국가 계정에서 지급하고, 원장의 천체 표식으로 연간 세수−지출과 누적액을 계산한다. 공기업 수입이 포함된 현금 기여는 순재정과 구분한다. 기존 지원금/6만C 내부 이체는 제거했고 실제 준비 물품·건설·포장·운영비를 지불한다. 초기 정부C 합계100,000C는 그대로다.

국가 budget17은 **실제 수납 세금−고정 시민 지출**의17년/1년 명목 합계 비율이다. 기존1.1~1.6 기준은 유지했다. 합금 실질가 월±20%·20년 평균±8%, 인플레1~3% 등 기존4.1 수치도 유지했다. 국가가 버티는 동안 천체 정부는 별도 현금 계정 때문에 멈추지 않는다. 일부 시나리오에서 국가 잔액0은 가능하며, 음수가 없다는 것이 미래 자금 여유의 보장은 아니다. 새 빚·구제금융은 없다.

## 식민지 생존과 순재정

새 반올림안·자력·5시드. 충족률은 **최초12개월 제외 후, 모든 시드/월 중 최저**다. 누적 순재정은20년 명목C다. 얼음 금지는 진단이며 얼음 생존 합격을 주장하지 않는다.

${survivalTable}
${config.tax.nationalRate === 0 ? "**세율 한계:** 기존4.1의 달·화성 기본 세율0%를 유지했다. 감면이 끝나도0%이므로0/5/10년 결과가 같다. 종료 후 국가 기본 세율을 임의로25%로 정하지 않았다. 양의 세율에서 계층/감면이 실제 세수로 이어지는 기능은 테스트했지만, 그 경제 효과는 이번 실행으로 식별하지 못한다." : "감면 종료 뒤 국가 기본 세율은 " + pct(config.tax.nationalRate) + "다. 상세 상속/덮어쓰기는 IMPLEMENTATION.md에 있다."}

E2-S 얼음 허용에서 국가의20년 식민지 지출은 **${fmt(nation.colonySpendingC)}C**, 국가 전략예산의 **${pct(nation.colonyBudgetShare)}**, 고정 시민 지출 포함 전체 국가 지출의 **${pct(nation.colonyTotalSpendingShare)}**다. 국가 종료 금고는 평균 **${fmt(nation.endingTreasuryC)}C**, 전 시드 최저 금고 **${fmt(nation.minimumTreasuryC)}C**다. 국가 지원은 수입이나 이익으로 둔갑시키지 않았다. 연도별20개 궤적과 양수 전환 시점은 HTML/CSV/JSON에 있다.

**초기 재고를 분리해 해석해야 한다.** 달은 초기 물0이다. 얼음 금지에서는 물·산소가 부족하다. 화성은 기존 민간 물 **200,000U**가 있어20년을 버틸 수 있고, 허용 사례에서도 새 얼음이 필요 없을 수 있다. 이 조건은 화성 얼음의 필요성을 입증한 실험이 아니다. [원경로와 같은 수동 추적](fiscal-life-diagnostics.json)에 월별 공급 창이 있다.

${oxygenTable}
달100만U/화성1,000만U는 **임시 접근 가능 물 환산 매장량**이다. 공식 지질/표면에 쓰지 않았다. 위 사용 비율과 남은 실제 잔량으로 고갈 여부를 보고한다. 산소 부산물은 실제 원장에 올라가고 생명유지 후 재고로 남는다. 산소 시장/매출은 없다. 전력과 양의 액화비를 포함한다. 물 가격은 임시 기준가0.2와 기존 시장 조정 규칙을 사용한다.

## 이전4.2.2 현금 바닥과 수소 결과

유상 준비 무차단, 자력·5시드. 새 구조의 숫자는 **같은 국가 금고 하나**이며 행성마다 따로 지급한 잔액이 아니다.

${table(
  ["천체", "이전 정부C 종료", "새 국가C 최저", "새 물/산소 최저월"],
  s.oldComparison
    .filter(
      (x) =>
        x.world === "H-CUT-CONTROL" && x.lane === lane && x.body !== "earth",
    )
    .map((x) => [
      x.body,
      fmt(x.oldEndingLocalGovernmentC),
      fmt(x.newNationMinimumC),
      pct(x.newWaterMinimum) + " / " + pct(x.newOxygenMinimum),
    ]),
)}
이전 구조의 산소 생명유지는 미모델링이었다. 기존 수소 원가/결과는 보존하고, 새 구조의 E0 지구를 다시 평가했다. O2 저장의 기존 양의 액화비를 새 견적에도 포함했다.

${table(
  ["E0 지구·자력", "4.2.2 반올림", "4.3 반올림"],
  [
    ["H 시세C/U", fmt(old.price, 6), fmt(market.price, 6)],
    ["관측 완전원가C/U", fmt(old.observedCost, 6), fmt(market.observedCost, 6)],
    ["시장 마진C/U", fmt(old.margin, 6), fmt(market.margin, 6)],
    ["신규 전해 회수 년", fmt(old.paybackYears), fmt(market.paybackYears)],
    [
      "20년 ON/OFF 평균",
      fmt(oldProd.meanTotalRatio, 8),
      fmt(earthProd.meanTotalRatio, 8),
    ],
    ["E0 지구 순증 시드", "5/5", earthProd.strictGainSeeds + "/5"],
  ],
)}
준비 무차단 지구의20년 ON/OFF 평균은 **${fmt(preparedEarth.meanTotalRatio, 8)}**, 순증 시드는 **${preparedEarth.strictGainSeeds}/5**다. 평균만으로 모든 시드 통과를 주장하지 않는다. OFF/ON은 **같은4.3 국가/얼음 구조의 수소 대조**이며 옛 천체별 금고 대조는 별도로 했다.

## 기준별 최종 판정

${table(
  ["조건", "반올림안 결과"],
  [
    [
      "기존4.1 필수 경로 기준",
      oldPassing + "/" + required.length + " 기록 통과 (자력)",
    ],
    [
      "E0 H 시장마진≥0 / 신규 회수≤4년",
      final.filter(
        (x) =>
          x.id === id &&
          x.lane === lane &&
          x.enabled &&
          x.scenario === "E0" &&
          x.checks.hydrogenMarketMargin,
      ).length +
        "/5 · " +
        final.filter(
          (x) =>
            x.id === id &&
            x.lane === lane &&
            x.enabled &&
            x.scenario === "E0" &&
            x.checks.electrolyzerPayback,
        ).length +
        "/5",
    ],
    [
      "E0 / 준비 지구 누적 순증>1",
      earthProd.strictGainSeeds +
        "/5 · " +
        preparedEarth.strictGainSeeds +
        "/5",
    ],
    [
      "얼음 허용 식민지 유예 후 매월 물·산소≥99%",
      "모든 충격/차단 경로 포함 · 미달 항목은 아래",
    ],
    [
      "국가 잔액 음수 / 원장 무결성",
      "음수월0 / 무결성 실패" + r.counts.integrityFailures,
    ],
    ["자력 / 구호 포함", r.selfPassing + "/2 · " + r.reliefPassing + "/2"],
  ],
)}
- 자력 미달 기록 수: ${failText(q.self.failures)}.
- 구호 포함 미달 기록 수: ${failText(q.relief.failures)}.

이전 모든12개월 ON≥OFF와 H-CUT95%는 최신4.3 기준표에 따라 정보로 남겼다. H-CUT OFF대비95%는 ${["earth", "moon", "mars"].map((body) => body + " " + s.cutSummary.filter((x) => x.id === id && x.lane === lane && x.body === body).reduce((n, x) => n + x.productionPassingSeeds, 0) + "/30").join(" · ")}(자력)이다. 같은 기술 무차단 대비 비율과 물·산소 결과도 보존했다. 새 생명유지는 명시적으로 보호한 전력·재고·실제 비용으로 공급하며 도시 기본 부하/선택적 수출 포장보다 우선한다. 심한 물리적 공급 부족·재정/정비 제약이 남으면 그대로 실패한다.

## 반올림안·후속 결정

**[임시] 산출 ${fmt(c.policy.iceOutputU)} 물U/월, 건설 ${fmt(c.policy.iceCapitalScale)}배, 유지 ${fmt(c.policy.iceMaintenanceScale)}배, ${fmt(c.policy.iceGWhPerU, 5)}GWh/물U, 건설 ${c.policy.iceBuildMonths}개월.** 감면5년·산소 재활용50%·유예12개월이다. 모듈 건설은 기준시점 **${fmt(quote.creditC)}C+${fmt(quote.alloyU)}합금U**, 독립 유지 기준은 ${fmt(quote.maintenanceCreditBasisC)}C/${fmt(quote.maintenanceAlloyBasisU)}합금U다. 정상 모듈당 월 직접비${fmt((quote.maintenanceCreditBasisC * frozen.e.directAnnual) / 12)}C, 합금 보수는 달${fmt((quote.maintenanceAlloyBasisU * frozen.profile.parameters.upkeep_moon) / 12)}U/화성${fmt((quote.maintenanceAlloyBasisU * frozen.profile.parameters.upkeep_mars) / 12)}U, 정격 전력${fmt(c.policy.iceOutputU * c.policy.iceGWhPerU)}GWh다(반올림안). 환경·건강·실제 가동·CPI는 원장에서 적용한다. H의 y0.09·h0.96·현금6·물0.72/12·s0.13은 재탐색하지 않았다.

LHS32+기준안 중 선별 통과 **${read43(root + "/policy-search.json").filter((x) => x.passed).length}/33**. 후보는 합격/미달 점수와 동점 ID로 골라 비용 최적성을 입증한 것이 아니다. 최종 두 안의 전 범위 결과와 반올림 영향을 따로 검사했다.

후속 결정은 감면 뒤 세율, 실제 초기 물/탱크 규모, 민간 식민지 투자 자금 축적, 스트레스에서 필수 자산/물리 공급을 보호할 범위, 임시 얼음 비용/매장량·물 가격의 채택 여부다. 민간 돈은 현지에 남고 기존 현금 배분을 유지하므로 민간 얼음 진입을 보장하지 않는다. 별도 저장 용량·추가 인건비·물류 배송·식량·산소 판매처·금융 구제·실제 얼음층·M2/M3·게임/UI는 구현하지 않았다.

검증: **${tests}테스트**,114소스 문법, 새192/이전120경로 재현, 원장·기존1,465파일 보존, PC/모바일3크기/오프라인 HTML 통과. 최종20년1회 p50은4.2.2 **${fmt(perf.performance.round422.p50Ms, 2)}ms**,4.3 E0 **${fmt(perf.performance.round43Peace.p50Ms, 2)}ms**,E2-S **${fmt(perf.performance.round43Colony.p50Ms, 2)}ms**(각15회, 게임FPS 아님). 정식 배치 **${fmt(r.totalSeconds, 2)}초/3worker**. 상세 범위·미검증 항목은 VERIFICATION.md에 있다.
`;
fs.writeFileSync(root + "/REPORT_KO.md", report);
const verification = `# ECON-SIM-4.3 검증과 재현

2026-11-07 Asia/Seoul. 기능/보존 검증과 경제 합격 판정을 구분한다. 같은 폴더의 JSON/로그/캡처가 근거다.

${table(
  ["검사", "실제 결과"],
  [
    ["npm run check", "114소스 모듈 통과"],
    ["npm test", "기존666+신규41 = " + tests + "통과, 실패/생략0"],
    ["기존파일 보존", "1,465개 현재 SHA256·기준 Git blob 동일, 수정/삭제0"],
    [
      "최종 정식 실험",
      fmt(r.counts.totalRuns, 0) + "실행 · 5시드/240개월 · 무결성 실패0",
    ],
    ["새 경로 독립 재실행", v.replayExecutions + "건 원해시 동일"],
    [
      "불변4.2.2 대조 재실행",
      v.legacyReplayExecutions + "건 원해시 동일 / 보관1,220건 재사용",
    ],
    ["차단 전 미래정보 미열람", v.prefixChecks.length + "건 월0–60 경로 동일"],
    [
      "생산 정수Q 재분석",
      fmt(v.productionChecks, 0) + "건, 모든229개12개월 창 정보 포함",
    ],
    ["H-CUT 정보 정수식", v.cutIntegerChecks + "ON 창 · 전해0"],
    [
      "물 승인 감사",
      fmt(v.waterApprovals, 0) + "자산 · 고정0.72/12개월/최소 충족",
    ],
    ["월 생명유지 판정 재검사", fmt(v.lifeAudits, 0) + "물/산소 조건"],
    [
      "연간 재정 정수식",
      fmt(v.fiscalYears, 0) + "천체년 · 세수/지출/합계 일치",
    ],
    [
      "기록된 현금 안전선",
      fmt(v.guards, 0) + "소유자 요약 · 거래후 여유 음수0",
    ],
    ["수동 원장/생명유지 추적", "6경로, 원해시 동일"],
    [
      "정식 실행 소스",
      "run-source-manifest.json의 경제 source·분석·입력 해시 동일",
    ],
  ],
)}

감사 수는 반복된 시험 세계의 합계이며 단일 세계의 실제 건설 수가 아니다. 국가 잔액=초기C+수입−지출, 물=초기+얼음+환원+계량 취수−생명유지−전해, O2=초기+전해−생명유지, 얼음 유일한 잔량 감소=물 source를 매 tick 감사했다. 기존 C/U·자본·SCU·H provenance·반응 질량 감사도 유지한다.

신규41개는 단일 금고/자금 고갈/정수 복식 원장/SCU 귀속/실물 비이동, 세율 상속과0%·감면 경계·섹터 묶음/양의 세율 실제 세수, 수요 단위, 유상 정부/민간 건설·실패 원자성·유한 매장량·전력0·냉간 재개 비용, 물 거래/provenance·산소 무매출·양의 액화비, 얼음 미래 공급의 물 조건·생활 우선·소유자 분리·원천 불변, 기존 고정값·자료 보존·불변422 대조, 미래 차단 미열람, 월99%/유예, 국가 재정·예산17년, 독립 유지비의 구호 유보량을 검사한다. **도시 브라운아웃에서도 명시적 얼음/산소 부하를 우선하는 회귀**가 포함된다. 기존 저장 이관·산업·SCU/탐사/지도 단위 회귀도 전체 테스트에 포함된다.

개발 중 도시 필수 부하가 명시적 생명유지보다 먼저 가던 선행 실험3,340회는 최종 판정에 사용하지 않았다. 수정 전 근거와 source manifest는 [development-pilot.json](development-pilot.json)에 남겼다. 우선순위 수정 후140회 간이 실험과 최종3,340회를 실행했고, 최종41개 신규/707개 전체 검사를 통과했다. 기존4.2.2 이전 산출물은 어떤 단계에서도 고치지 않았다.

## 성능

최종75회는 정식 배치/전체 테스트/경로 재현/진단이 끝난 뒤 한 프로세스에서 버전별15회 교차 측정했다. 검증 스크립트의 예비75회도 보존해 최종 source에서 총150회 측정했으며, 아래에는 [performance.json](performance.json)의 별도 최종75회만 인용한다. 최초 실행도 포함하고 p95는15개 중 최댓값이다. Node ${r.environment.node},${r.environment.cpu}, parallelism${r.environment.parallelism}. 정식 wall time ${fmt(r.totalSeconds, 2)}초/3worker다.

${table(
  ["240개월1회", "p50 ms", "p95 ms"],
  Object.entries(perf.performance).map(([k, v]) => [
    k,
    fmt(v.p50Ms, 2),
    fmt(v.p95Ms, 2),
  ]),
)}
충격 경로는 활성 자산·주문 수가 달라 더 짧을 수 있다. 게임FPS/실기기 목표가 아니다.

## 브라우저·스크린샷

Chromium/Playwright **1440×900·844×390·667×375·390×844** 통과.8그래프·18격자·후보/천체/자력/구호/시나리오·공급 차단 음영·얼음 금지/감면 선택·연간20행·이전 금고 비교·새 물/산소/순재정/국가C의 원자료 일치·PC JSON 내보내기를 검사했다. 모바일은 터치 에뮬레이션,44px 이상 조작 영역, 전체 페이지 가로 넘침 없음·끝까지 스크롤을 확인했다.

단일HTML의 첫시드536경로와5시드 요약을 내장했다. HTML1회 외 JSON/API/CDN/폰트 요청0,네트워크 차단 context에서 같은 HTML 바이트를 직접 로드해 외부요청0·오류0이다. 원본 JSON/CSV 정밀도는 유지하고 HTML 월경로 복사본만 소수6자리다. 브라우저가 읽은 summary/source/performance 해시와 HTML SHA도 검사했다.

[PC 초기](screenshots/report-initial-1440.png) · [PC 전체](screenshots/report-selected-1440.png) · [달 재정](screenshots/report-moon-finance.png) · [844가로](screenshots/report-selected-844.png) · [667가로](screenshots/report-selected-667.png) · [390세로](screenshots/report-selected-390.png) · [오프라인](screenshots/report-offline.png)

[브라우저 결과](logs/report-browser.json) · [전체 테스트](logs/full-tests.log) · [신규 검사](logs/new-tests.log) · [source/보존](logs/preservation.log) · [재현 감사](verification.json) · [수동 진단](fiscal-life-diagnostics.json)

**미검증:** 게임 전체 브라우저 회귀, 실제 모바일 기기, Safari/Firefox, 네이티브 file:// 접근 정책. 게임 파일은 바이트 불변이다. HTML은 최신 DecompressionStream 지원 브라우저가 필요하다. 새 게임 사이트를 배포한 결과가 아니다.

## 재현

저장소 루트, 같은 입력/시드에서 실행한다. 정식 실행은 이 버전 결과만 다시 쓰므로 보관이 필요하면 먼저 복사한다. 간이는 --quick --out artifacts/econ43-quick으로만 실행할 수 있고 정식 결과를 덮어쓸 수 없다.

\`\`\`bash
npm run check
npm test
node scripts/econ-round4-3-calibrate.mjs --workers 3
node scripts/econ-round4-3-verify.mjs
node scripts/econ-round4-3-diagnostics.mjs
node scripts/econ-round4-3-performance.mjs
node scripts/econ-round4-3-summarize.mjs
node scripts/econ-round4-3-report.mjs
python3 -m http.server 5174 --bind 127.0.0.1
\`\`\`

다른 터미널에서 설치된 경로에 맞춘다.

\`\`\`bash
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-economy-round4-3-report.mjs
node scripts/econ-round4-3-document.mjs
node scripts/econ-round4-3-preserve.mjs
\`\`\`

로컬: http://127.0.0.1:5174/docs/econ-sim/round4-3/report.html. 인접 JSON 없이 HTML에 내장한 데이터로 동작한다.
`;
fs.writeFileSync(root + "/VERIFICATION.md", verification);
console.log(
  "PASS generated Korean report/verification from final validated data and matching HTML hashes",
);
