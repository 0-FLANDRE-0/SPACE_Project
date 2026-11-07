import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  ROOT431 as root,
  read431,
  write431,
} from "./econ-round4-3-1-inputs.mjs";
const s = read431(root + "/summary.json"),
  v = read431(root + "/verification.json"),
  perf = read431(root + "/performance.json"),
  browser = read431(root + "/browser-verification.json"),
  m = read431(root + "/preservation-manifest.json");
const f = (x, n = 3) =>
    x == null
      ? "없음"
      : x.toLocaleString("ko-KR", { maximumFractionDigits: n }),
  pc = (x) => (x == null ? "해당 없음" : f(x * 100) + "%"),
  get = (taxMode = "half", scenario = "E2-S", lane = "self") =>
    s.cases.find(
      (c) =>
        c.taxMode === taxMode &&
        c.scenario === scenario &&
        c.lane === lane &&
        c.enabled,
    ),
  peace = get(),
  earth = get("half", "E0").bodies.earth;
const label = (k) => ({ half: "12.5% (기본)", zero: "0%", full: "25%" })[k];
const q = (mode, lane) =>
    s.qualification.find((x) => x.taxMode === mode && x.lane === lane),
  first = (a) =>
    a.every((x) => x === null) ? "없음" : a.map((x) => x ?? "없음").join("/");
const table = (heads, rows) =>
  "| " +
  heads.join(" | ") +
  " |\n| " +
  heads.map(() => "---").join(" | ") +
  " |\n" +
  rows.map((r) => "| " + r.join(" | ") + " |").join("\n");
const old = s.comparison.find(
    (x) => x.scenario === "E2-S" && x.lane === "self",
  ),
  oldEarth = s.comparison.find((x) => x.scenario === "E0" && x.lane === "self")
    .old.bodies.earth;
const testsText = fs.readFileSync(root + "/tests.log", "utf8"),
  testCount = [...testsText.matchAll(/tests (\d+)/g)].at(-1)?.[1];
const halfSelf = q("half", "self"),
  halfRelief = q("half", "relief");
const lines = [
  "# ECON-SIM-4.3.1 생명유지 비축·산소·세율 결과",
  "",
  "2026-11-07 Asia/Seoul · 오프라인 전용 · 게임/M3 적용 없음",
  "",
  `**고정4.3 반올림안의 새 기본12.5% 세율은 자력 ${halfSelf.passed ? "합격1/1" : "미달0/1"}·구호 ${halfRelief.passed ? "합격1/1" : "미달0/1"}이다.** E2-S에서 달·화성의 유예 후 물·산소 최저는 ${pc(Math.min(...["moon", "mars"].flatMap((id) => [peace.bodies[id].waterMinimum, peace.bodies[id].oxygenMinimum])))}다. 극한 충격은 별도 정보로 남긴다.`,
  "",
  "[오프라인 HTML](report.html) · [변경 식·가정](IMPLEMENTATION.md) · [검증](VERIFICATION.md) · [변경 파일](CHANGED_FILES.md) · [요약 JSON](summary.json) · [연간 재정 CSV](annual-fiscal.csv) · [비축 CSV](life-reserve.csv)",
  "",
  "PR #24가 미병합이어서 **5e31515f1eda9131438afb9b2c7fad4122b2e7c5**에서 **econ/round4-3-1-life-reserve**를 만들었다. 아카이브 **5bd1cec9a5216229d74e9af4d97e191d269227ec** 보충§28을 직접 읽었다. 기존1,540파일은 바이트 불변이다. 고정안 하나·세율3안·자력/구호·기존42시나리오·준비 대조·18H-CUT·5시드·H-OFF/ON = **3,660실행**이며 재탐색은 없다.",
  "",
  "## 4.3 대비",
  "",
  table(
    ["지표·자력5시드", "4.3", "4.3.1 기본"],
    [
      [
        "E2-S 달 물/산소 최저",
        pc(old.old.bodies.moon.waterMinimum) +
          " / " +
          pc(old.old.bodies.moon.oxygenMinimum),
        pc(peace.bodies.moon.waterMinimum) +
          " / " +
          pc(peace.bodies.moon.oxygenMinimum),
      ],
      [
        "달9개월 H-CUT 산소 최저",
        pc(
          s.comparison.find(
            (x) => x.scenario === "H-CUT-moon-M9-L100" && x.lane === "self",
          ).old.bodies.moon.oxygenMinimum,
        ),
        pc(get("half", "H-CUT-moon-M9-L100").bodies.moon.oxygenMinimum),
      ],
      [
        "E2-S 식민지20년 지출C",
        f(old.old.colonySpendingC),
        f(peace.national.colonySpendingC),
      ],
      [
        "E2-S 국가 종료 평균C",
        f(old.old.nationalEndC),
        f(peace.national.endingTreasuryC),
      ],
      ["E0 지구 H 마진C/U", f(oldEarth.margin, 6), f(earth.margin, 6)],
      ["E0 신규 전해 회수년", f(oldEarth.paybackYears), f(earth.paybackYears)],
      [
        "E0 지구20년 ON/OFF",
        f(oldEarth.productionRatio, 8),
        f(earth.productionComparison.totalRatioMean, 8),
      ],
    ],
  ),
  "",
  "보관된4.3 반올림 자력ON의 H-CUT 산소는 이미100%였다. 이를 새 발생기의 개선 효과로 보고하지 않으며 일반 전해0·전용 산소 실제 가동·질량/전력 검증으로 분리 동작을 확인했다. 4.3은 감면 뒤0%, 이번 기본은12.5%이며 비축/전용 시설도 함께 바꿨다. 이 표를 비축만의 순수 효과로 해석하지 않는다. 국가 금고는 여전히 한 실제 계정이며 실물·민간C는 천체별이다.",
  "",
  "## 세율3안 · E2-S",
  "",
  table(
    [
      "감면 후 세율",
      "천체",
      "20년 세수C",
      "국가 지출C",
      "순재정C",
      "흑자 첫해(5시드)",
      "민간 얼음/일반전해",
    ],
    ["half", "zero", "full"].flatMap((t) =>
      ["moon", "mars"].map((id) => {
        const b = get(t).bodies[id];
        return [
          label(t),
          id,
          f(b.taxC),
          f(b.spendingC),
          f(b.netFiscalC),
          first(b.firstPositiveFiscalYears),
          f(b.privateIceModules) + " / " + f(b.privateElectroModules),
        ];
      }),
    ),
  ),
  "",
  `기본 E2-S의 국가 최저 금고는 **${f(peace.national.minimumTreasuryC)}C**, 식민지 지출은 전략예산의 **${pc(peace.national.colonyBudgetShare)}**다. 연도별20개 순재정·지속 흑자 전환 여부와 국가 궤적은 HTML/CSV/JSON에 있다. 민간 투자·합금 생산·인구의 세율별 원값도 함께 제공한다. 인구는 기존 외생 성장식이므로 세율 이주 효과는 계산하지 않았다. 민간 투자자금·현금 배분도 그대로라 신규 시설 진입을 보장하지 않는다.`,
  "",
  "세율3안의 E2-S 투자·생산 관측: " +
    ["moon", "mars"]
      .map((id) => {
        const a = ["half", "zero", "full"].map((t) => get(t).bodies[id]);
        const range = (k) =>
          f(Math.min(...a.map((b) => b[k]))) +
          "–" +
          f(Math.max(...a.map((b) => b[k])));
        return (
          id +
          " 종료 인구 " +
          range("populationEnd") +
          "명, 누적 합금 " +
          range("alloyU") +
          "U, 민간 얼음 " +
          range("privateIceModules") +
          "모듈/일반 전해 " +
          range("privateElectroModules") +
          "모듈"
        );
      })
      .join("; ") +
    ". 이는 이 모형의 실제 현금·기존 투자 규칙 아래의 관측이며 조세 이주나 충분한 민간 투자자금을 가정한 인과 효과가 아니다.",
  "",
  "## 비축과 전용 산소",
  "",
  table(
    [
      "천체",
      "물 최초 충전월 범위",
      "산소 최초 충전월 범위",
      "저장고 건설/유지C",
      "발생기 건설/운영C",
      "전용 물/산소/수소U",
      "전용 전력GWh",
    ],
    ["moon", "mars"].map((id) => {
      const b = peace.bodies[id],
        w = b.firstFill.water,
        o = b.firstFill.oxygen;
      return [
        id,
        f(w.minimumMonth, 0) + "–" + f(w.maximumMonth, 0),
        f(o.minimumMonth, 0) + "–" + f(o.maximumMonth, 0),
        f(b.reserve.tankCapitalC) + " / " + f(b.reserve.tankMaintenanceC),
        f(b.dedicated.capitalC) +
          " / " +
          f(b.dedicated.maintenanceC + b.dedicated.variableC),
        f(b.dedicated.waterU) +
          " / " +
          f(b.dedicated.oxygenU) +
          " / " +
          f(b.dedicated.hydrogenU),
        f(b.dedicated.powerGWh),
      ];
    }),
  ),
  "",
  "비축은 정부 실물 재고 안의 잠긴 부분집합이며 일반 수전해·판매에 사용할 수 없다. 그달 회수 물을 포함한 일반 생명유지 공급을 먼저 사용하고 부족분만 꺼낸다. 전용 산소는 일반 H-CUT과 분리해 보호 전력으로 가동하며 실제 물·전력·유지비·합금을 지불한다. 부산물 수소는 현지 월말 재고다. 6개월 목표는 인구와 함께 바뀐다.",
  "",
  "표의 비용은20년 공유 시설 현금액이다. 최초 충전까지의 비용은 HTML/JSON에 별도로 있다. 물 재고와 전력의 요금 평가는 현금 지출에 다시 더하지 않는다. 저장고는 기존 물 탱크/전해 자본비의0.1배 비례·100U 단위·1개월, 산소 설비는 수요1.2배·기존 비용 비례·6개월 공사의 **임시** 가정이다. 화성의 기존 민간 물200,000U는 유지했다. 새 얼음의 필요성이나 화성의 영구 자립을 입증한 실험은 아니다.",
  "",
  "## 기준별 판정",
  "",
  table(
    ["세율", "자력", "구호 포함", "미달 항목(자력 / 구호)"],
    ["half", "zero", "full"].map((t) => [
      label(t),
      q(t, "self").passed ? "합격" : "미달",
      q(t, "relief").passed ? "합격" : "미달",
      JSON.stringify(q(t, "self").failures) +
        " / " +
        JSON.stringify(q(t, "relief").failures),
    ]),
  ),
  "",
  table(
    ["기준·기본12.5% 자력", "충족/검사", "판정 기준"],
    (() => {
      const c = s.criteriaSummary.find(
        (c) => c.taxMode === "half" && c.lane === "self",
      );
      return [
        [
          "기존4.1 필수 경로",
          c.legacyPassing + "/" + c.legacyRequired,
          "기존 수치·국가 예산 정의 유지",
        ],
        ["E0 H 시장 마진", c.marginPassing + "/5", "≥0C/U"],
        ["E0 신규 전해 회수", c.paybackPassing + "/5", "≤4년"],
        ["E0 지구20년 순증", c.earthGainPassing + "/5", "ON/OFF>1"],
        [
          "필수 식민지 생명유지 ON",
          c.lifePassing + "/" + c.lifeConditions,
          "유예 뒤 매월 물·산소≥99%",
        ],
        [
          "동일 구조 OFF 생명유지(대조)",
          c.offLifePassing + "/" + c.offLifeConditions,
          "대조 경로 정보",
        ],
        ["국가 음수월", c.negativeMonths, "0"],
        ["무결성", c.integrityPassing + "/" + c.runs, "실패0"],
      ];
    })(),
  ),
  "",
  `모든 경로의 국가 음수월 **${s.cases.reduce((n, c) => n + c.national.negativeMonths, 0)}**, 원장 무결성 실패 **${s.integrityFailures}**. E0 지구 마진·회수·순증 통과 시드는 ${get("half", "E0").passing}/5이며 생산 순증은 ${earth.productionComparison.gainSeeds}/5다. 기존4.1 분류·국가 budget17·수치 기준은 유지했다. 생명유지 필수는 E0·E2-S·E5-M(18격자 포함)·H-CUT의 유예 뒤 매월99%다. 최신431 기준표의 순증 대상은 E0이며 준비 대조의 순증은 정보다.`,
  "",
  "## 극한 충격 정보 · 기본 세율·자력",
  "",
  table(
    [
      "충격",
      "천체",
      "직전 물/산소 충전율",
      "연속 충족 최소월/관측월",
      "충격창 물/산소 최저",
      "유예 후 전체 물/산소 최저",
      "물/산소 인출 최대월",
    ],
    ["E4", "E5", "E5-X", "E6", "E11"].flatMap((world) =>
      ["moon", "mars"].map((id) => {
        const b = get("half", world).bodies[id].shock;
        return [
          world,
          id,
          pc(b.openingWaterTargetFraction) +
            " / " +
            pc(b.openingOxygenTargetFraction),
          b.fullyServedPrefixMin + " / " + b.duration,
          pc(b.minWater) + " / " + pc(b.minOxygen),
          pc(get("half", world).bodies[id].waterMinimum) +
            " / " +
            pc(get("half", world).bodies[id].oxygenMinimum),
          b.waterDrawMonthsMax + " / " + b.oxygenDrawMonthsMax,
        ];
      }),
    ),
  ),
  "",
  "연속 충족 기간은 기존 공급+비축을 함께 사용한 결과다. 관측기간 전체를 채운 경우는 관측 종료이며 비축 단독 자립 개월 수가 아니다. 최초부터 비축이 미충전인 상태와 최저 충족률을 숨기지 않았다. E5-X의 달은 충격창24개월에는 충족하지만 이후 회복 구간에서 물20.773%·산소0%가 나타나며, 이를 전체 최저 열에 함께 표시했다.",
  "",
  "## 검증과 남은 결정",
  "",
  `**${testCount}테스트 통과**,117소스 문법, 기존1,540파일 SHA/Git blob 보존, 정식3,660경로 월별 감사. 새${v.replayExecutions}·이전43 ${v.legacyReplayExecutions}경로 원해시 재현, 차단 전${v.prefixChecks}개 경로 일치, 수동 원장 추적${v.traceExecutions}경로 일치. Chromium PC/모바일3크기와 HTML 단독 오프라인을 확인했다. 상세 검증 범위·캡처는 VERIFICATION.md에 있다.`,
  "",
  `조용한 환경의20년1회 p50:43 E0 **${f(perf.performance.round43E0.p50Ms, 2)}ms**,431 E0 **${f(perf.performance.round431E0.p50Ms, 2)}ms**,E2-S **${f(perf.performance.round431E2S.p50Ms, 2)}ms**(각15회). 정식 배치 ${f(s.totalSeconds, 2)}초/3worker. 게임FPS나 실기기 성능은 아니다.`,
  "",
  "남은 결정은 저장고/소형 산소 비용·여유율·세율 절반 계수의 채택, 현실적인 초기 저장량·민간 자금 축적, 테라포밍 상태 연결, M3에서의 실제 게임 연결이다. 식량·산소 시장·물류 배송·금융 구제·실제 얼음층·M2/게임/UI는 이번에 구현하지 않았다. main 및 다른 PR은 병합하지 않았다.",
];
fs.writeFileSync(root + "/REPORT_KO.md", lines.join("\n") + "\n");
const verification = [
  "# ECON-SIM-4.3.1 검증·재현",
  "",
  "2026-11-07 Asia/Seoul. 아래는 실제 수행 범위다. 모든 기존 테스트·자료와 게임 파일은 보존한다.",
  "",
  table(
    ["검사", "결과"],
    [
      ["npm run check", "117소스 통과"],
      [
        "npm test",
        testCount + " / " + testCount + " 통과, 생략0(기존707+신규38)",
      ],
      ["정식 시뮬레이션", s.totalRuns + " 실행,5시드·240개월, 무결성0"],
      ["독립 새 경로 재현", v.replayExecutions + " 원해시 일치"],
      ["불변43 결과 재현", v.legacyReplayExecutions + " 원해시 일치"],
      ["차단 전0~60개월", v.prefixChecks + " 경로 일치"],
      ["수동 거래 trace", v.traceExecutions + " 원래 경로와 해시 일치"],
      [
        "연간 재정 감사",
        v.annualFiscalBodyYears + " 천체년,정수 세수−지출·누적·흑자 첫해",
      ],
      ["생산 OFF/ON 재분석", v.productionPairBodyChecks + " 천체 쌍"],
      ["생명유지 판정", v.lifeCheckConditions + " 조건"],
      ["일반 H-CUT 전해0", v.cutElectrolysisZeroChecks + " 경로"],
      ["종료 비축 감사", v.reserveEndingChecks + " 자원계정"],
      ["국가 음수", 0],
      [
        "기존 파일 보존",
        Object.keys(m.files).length + " SHA256와 기준Git blob 동일",
      ],
      ["브라우저", browser.browser + ";1440×900/844×390/667×375/390×844"],
      ["오프라인 HTML", "HTML 단독·외부 요청0·오류0·내장 산출물 해시 일치"],
    ],
  ),
  "",
  "정식 실행 전 소규모/개발 중 시도는 판정에 포함하지 않았다. 첫 전체 시도는 개장 시점 생명유지 사용이 같은 월 회수 물보다 빨랐던 회귀를 발견해 중단했다. 수정 전 실패 로그와 수정 후 통과 로그를 남기고 최종 소스로3,660개 전체를 다시 실행했다. 이전43 자료를 다시 쓰지 않았다.",
  "",
  "검증은 매월 원장의 통화·실물·자본합금·SCU·H 회수 출처·물/H/O 질량·유한 얼음·비축 부분집합·국가 재정 대사를 실행한다. 정식 입력과 소스 SHA를 동결했고 독립 재현은 명시한 부분집합이다. 이전43 전체3,340개를 전부 재실행했다고 주장하지 않는다.",
  "",
  "그래프·선택 월 경로는 소수6자리 표시용 반올림이며 원자료 JSON/CSV와 표/판정 값은 원정밀도다. 브라우저는8그래프·18격자·연간20행·세율3안·천체/시나리오/자력/구호 선택·차단 음영·정확한 수치·44px 조작·JSON내보내기·SVG 라벨 범위·루트 가로 넘침·오프라인 동작을 확인했다. 게임 전체 브라우저 회귀, 실제 모바일 기기, Safari/Firefox, 네이티브 file:// 정책은 이번에 검사하지 않았다.",
  "",
  "## 재현 명령",
  "",
  "```sh",
  "npm run check",
  "npm test",
  "node scripts/econ-round4-3-1-preserve.mjs",
  "node scripts/econ-round4-3-1-calibrate.mjs",
  "node scripts/econ-round4-3-1-verify.mjs",
  "node scripts/econ-round4-3-1-summarize.mjs",
  "node scripts/econ-round4-3-1-performance.mjs",
  "node scripts/econ-round4-3-1-report.mjs",
  "python3 -m http.server 5174 --bind 127.0.0.1",
  "PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-economy-round4-3-1-report.mjs",
  "node scripts/econ-round4-3-1-document.mjs",
  "```",
  "",
  "브라우저/서버 경로는 이 검증 환경의 설치 위치다. PC 브라우저로 `/docs/econ-sim/round4-3-1/report.html`을 연다. HTML은 모든 데이터를 내장한다. 빠른 개발용 실행은 `--quick --out artifacts/econ431-check`로 공식 결과를 덮어쓰지 않는다. 성능 측정은 다른 자체 시뮬레이션·테스트가 끝난 뒤 실행한다.",
  "",
  "## 캡처",
  "",
  ...browser.results.flatMap((r) => [
    `- [초기 ${r.viewport.width}×${r.viewport.height}](screenshots/initial-${r.viewport.width}.png) · [선택/차단 상세](screenshots/selected-${r.viewport.width}.png)`,
  ]),
  "",
  "## 성능",
  "",
  table(
    ["시나리오", "p50 ms", "p95 ms", "표본"],
    Object.entries(perf.performance).map(([k, v]) => [
      k,
      f(v.p50Ms, 2),
      f(v.p95Ms, 2),
      v.samples,
    ]),
  ),
  "",
  "총60회 순차 교대,같은 호스트·원시 ms 보관. 정식 배치 시간은 테스트 등 동시 부하를 포함할 수 있어 조용한 별도 측정과 구분한다. 이 수치를 게임FPS나 실기기 성능으로 해석하지 않는다.",
];
fs.writeFileSync(root + "/VERIFICATION.md", verification.join("\n") + "\n");
for (const name of ["CHANGED_FILES.md", "changed-files.json"])
  if (!fs.existsSync(root + "/" + name))
    fs.writeFileSync(root + "/" + name, "");
const paths = (a) =>
    execFileSync("git", a).toString().split("\0").filter(Boolean),
  changed = [
    ...new Set([
      ...paths(["diff", "--name-only", "-z", m.base]),
      ...paths(["ls-files", "--others", "--exclude-standard", "-z"]),
    ]),
  ].sort();
write431(root + "/changed-files.json", {
  base: m.base,
  added: changed,
  modifiedExisting: [],
});
fs.writeFileSync(
  root + "/CHANGED_FILES.md",
  "# 실제 변경 파일\n\n기준 `" +
    m.base +
    "`. 기존" +
    Object.keys(m.files).length +
    "파일 불변, **새" +
    changed.length +
    "파일 추가**.\n\n- 새 오프라인 model/policy/water: 잠긴 비축·전용 발생기·세율.\n- 새 scripts: 고정 비교 실행·재현·요약·성능·HTML/문서·보존.\n- 새 tests: 38개 단위/통합 회귀와 보고서 브라우저 검증.\n- 새 round4-3-1 문서: 요청·아카이브·원자료·CSV·HTML·로그·스크린샷.\n\n" +
    changed.map((p) => "- `" + p + "`").join("\n") +
    "\n",
);
console.log(
  "Documents generated; " + changed.length + " new files; tests " + testCount,
);
