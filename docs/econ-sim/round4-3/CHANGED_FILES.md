# 실제 변경 파일

기준0c4a8c135af7e30e55c02a7d1120790884b8fec1. 기존1,465파일 수정·삭제 **0개**, 새 파일 **75개**다. [전체 경로 JSON](changed-files.json)과 같다.

| 파일/그룹 | 주요 동작 |
|---|---|
| dist/src/economy-round4-3-ledger.js | 실제 국가C 하나, 천체/SCU별 재정 태그, 원장 보존 |
| dist/src/economy-round4-3-policy.js | 채택H 고정값 검증, 세율 계층, 사람당 물/O2 단위, 독립 얼음 비용 |
| dist/src/economy-round4-3-water.js | 완공 뒤 물 조건의 얼음·생활·소유자·유한 잔량 예측 |
| dist/src/economy-round4-3-model.js | 오프라인 정산, 국가 지급·생활 우선 전력/물/O2·유상 얼음/물 시장·보존 감사 |
| scripts/econ-round4-3.config.json | R41 기반, 얼음5축, 임시 매장량·세율0·수요/판정 설정 |
| scripts/econ-round4-3-inputs.mjs | 불변 입력/고정H 대조와 전용 출력 경로 |
| scripts/econ-round4-3-analysis.mjs | 국가 예산17년, 월 생존·연간 순재정·산소/얼음·H 경제 지표 |
| scripts/econ-round4-3-calibrate.mjs | LHS32+기준, 후보/반올림 전 시나리오·생존6변형·H-CUT·동일정책 H쌍 |
| scripts/econ-round4-3-summarize.mjs | 5시드 통계·국가 부담·이전422 현금 대조 |
| scripts/econ-round4-3-verify.mjs | 새/이전 경로 재현, 사전 동일성, 재정·수량·물 승인·안전선 검사 |
| scripts/econ-round4-3-diagnostics.mjs | 원경로 불변 수동 재정/생명유지6경로 추적 |
| scripts/econ-round4-3-performance.mjs | 독립 최종75회 단일 실행 성능 |
| scripts/econ-round4-3-report.mjs | 자료 내장 오프라인HTML,8그래프·연간 표·생존·구조 대조·내보내기 |
| scripts/econ-round4-3-document.mjs | 실제 결과·해시 검증에서 한국어 보고서/검증 문서 생성 |
| scripts/econ-round4-3-preserve.mjs | 기존1465 SHA/Git blob·새파일 전용 범위 검사 |
| tests/economy-round4-3.test.js | 신규41 단위/모형/실제 세수/스트레스 우선순위 회귀 |
| tests/browser-economy-round4-3-report.mjs | PC·모바일3크기·오프라인·원자료/HTML 해시·SVG 라벨 가시성 회귀 |
| docs/econ-sim/round4-3/ | 지시/아카이브·manifest·전체 JSON/CSV·요약·원장·HTML·보고서·로그·스크린샷 |

## 새 경로 전체

- `dist/src/economy-round4-3-ledger.js`
- `dist/src/economy-round4-3-model.js`
- `dist/src/economy-round4-3-policy.js`
- `dist/src/economy-round4-3-water.js`
- `docs/econ-sim/round4-3/ARCHIVE_26_27_KO.md`
- `docs/econ-sim/round4-3/CHANGED_FILES.md`
- `docs/econ-sim/round4-3/IMPLEMENTATION.md`
- `docs/econ-sim/round4-3/REPORT_KO.md`
- `docs/econ-sim/round4-3/REQUEST_KO.md`
- `docs/econ-sim/round4-3/VERIFICATION.md`
- `docs/econ-sim/round4-3/annual-fiscal.csv`
- `docs/econ-sim/round4-3/candidates.json`
- `docs/econ-sim/round4-3/changed-files.json`
- `docs/econ-sim/round4-3/development-pilot.json`
- `docs/econ-sim/round4-3/final-runs.json`
- `docs/econ-sim/round4-3/fiscal-life-diagnostics.json`
- `docs/econ-sim/round4-3/h-cut.json`
- `docs/econ-sim/round4-3/input-manifest.json`
- `docs/econ-sim/round4-3/legacy-verification.json`
- `docs/econ-sim/round4-3/logs/baseline-tests.log`
- `docs/econ-sim/round4-3/logs/browser.log`
- `docs/econ-sim/round4-3/logs/calibration.log`
- `docs/econ-sim/round4-3/logs/check.log`
- `docs/econ-sim/round4-3/logs/diagnostics.log`
- `docs/econ-sim/round4-3/logs/document.log`
- `docs/econ-sim/round4-3/logs/exported-summary.json`
- `docs/econ-sim/round4-3/logs/full-tests.log`
- `docs/econ-sim/round4-3/logs/model-smoke.log`
- `docs/econ-sim/round4-3/logs/new-tests.log`
- `docs/econ-sim/round4-3/logs/performance.log`
- `docs/econ-sim/round4-3/logs/preservation.log`
- `docs/econ-sim/round4-3/logs/quick.log`
- `docs/econ-sim/round4-3/logs/report-browser.json`
- `docs/econ-sim/round4-3/logs/report-build.log`
- `docs/econ-sim/round4-3/logs/script-syntax.log`
- `docs/econ-sim/round4-3/logs/summary.log`
- `docs/econ-sim/round4-3/logs/verification.log`
- `docs/econ-sim/round4-3/no-cut-controls.json`
- `docs/econ-sim/round4-3/performance.json`
- `docs/econ-sim/round4-3/policy-search.json`
- `docs/econ-sim/round4-3/preservation-manifest.json`
- `docs/econ-sim/round4-3/report.html`
- `docs/econ-sim/round4-3/results.json`
- `docs/econ-sim/round4-3/run-source-manifest.json`
- `docs/econ-sim/round4-3/runs.csv`
- `docs/econ-sim/round4-3/screenshots/report-initial-1440.png`
- `docs/econ-sim/round4-3/screenshots/report-initial-390.png`
- `docs/econ-sim/round4-3/screenshots/report-initial-667.png`
- `docs/econ-sim/round4-3/screenshots/report-initial-844.png`
- `docs/econ-sim/round4-3/screenshots/report-moon-finance.png`
- `docs/econ-sim/round4-3/screenshots/report-offline.png`
- `docs/econ-sim/round4-3/screenshots/report-selected-1440.png`
- `docs/econ-sim/round4-3/screenshots/report-selected-390.png`
- `docs/econ-sim/round4-3/screenshots/report-selected-667.png`
- `docs/econ-sim/round4-3/screenshots/report-selected-844.png`
- `docs/econ-sim/round4-3/search-runs.json`
- `docs/econ-sim/round4-3/series-index.json`
- `docs/econ-sim/round4-3/series-rounded.json`
- `docs/econ-sim/round4-3/series-selected.json`
- `docs/econ-sim/round4-3/summary.json`
- `docs/econ-sim/round4-3/survival-runs.json`
- `docs/econ-sim/round4-3/verification.json`
- `scripts/econ-round4-3-analysis.mjs`
- `scripts/econ-round4-3-calibrate.mjs`
- `scripts/econ-round4-3-diagnostics.mjs`
- `scripts/econ-round4-3-document.mjs`
- `scripts/econ-round4-3-inputs.mjs`
- `scripts/econ-round4-3-performance.mjs`
- `scripts/econ-round4-3-preserve.mjs`
- `scripts/econ-round4-3-report.mjs`
- `scripts/econ-round4-3-summarize.mjs`
- `scripts/econ-round4-3-verify.mjs`
- `scripts/econ-round4-3.config.json`
- `tests/browser-economy-round4-3-report.mjs`
- `tests/economy-round4-3.test.js`
