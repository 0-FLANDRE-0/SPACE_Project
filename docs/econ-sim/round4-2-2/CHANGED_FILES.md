# 실제 변경 파일

기준 `3f277ea6857ccfbbe5a78a854dd4d1b704b75b04`. 기존 파일 수정·삭제 **0개**, 새 파일 **59개**다. 목록은 [changed-files.json](changed-files.json)과 같다.

| 새 파일 | 주요 변경 |
|---|---|
| `dist/src/economy-round4-2-2-policy.js` | 수율 이익·실제 광석 p*·월 작업시간 분할·고정/임시 값 검증 |
| `dist/src/economy-round4-2-2-water.js` | 소유자별 완공 이후 물 확보 예측, 기존/예정 설비·생활·공유 취수·유한H 예약 |
| `dist/src/economy-round4-2-2-model.js` | 정적 오프라인 커널, 실제 수율 질량 정산·물 건설 보류/승인·관측·현금 유지 |
| `scripts/econ-round4-2-2.config.json` | 고정 R41 기반, 다섯 임시 축 범위·시드·기간·선별 조건 |
| `scripts/econ-round4-2-2-inputs.mjs` | 불변 입력·계보·전용 출력 경로·해시 |
| `scripts/econ-round4-2-2-analysis.mjs` | 정수 생산비, 수율/광석/물 보류 지표, 필수 지구 순증 판정 |
| `scripts/econ-round4-2-2-calibrate.mjs` | LHS32·두 세계 선별·후보/반올림 정식2780실행·이전 OFF 대조 |
| `scripts/econ-round4-2-2-summarize.mjs` | 5시드 요약·4.2.1 비교·직접 수율 증가와 최종 순공급/실질가 구분 |
| `scripts/econ-round4-2-2-verify.mjs` | 재현·미래정보·생산창·물 승인/보류·현금·75회 성능 검사 |
| `scripts/econ-round4-2-2-diagnostics.mjs` | 원래 경로를 바꾸지 않는 C원장·물 보류/승인 추적 |
| `scripts/econ-round4-2-2-preserve.mjs` | 기존1406파일 SHA/Git blob와 새 파일 범위 검사 |
| `scripts/econ-round4-2-2-report.mjs` | 데이터 내장 단일HTML 생성,6그래프·정보·시나리오·모바일/내보내기 |
| `tests/economy-round4-2-2.test.js` | 신규33 단위·모형 회귀 |
| `tests/browser-economy-round4-2-2-report.mjs` | PC·모바일3크기·오프라인·수율/물 정보·내보내기 회귀 |
| `docs/econ-sim/round4-2-2/` | 요청·아카이브 근거·불변/입력 manifest·전체 JSON/CSV·요약·검증·원장·HTML·로그·캡처·한국어 문서 |

## 추가 경로 전체

- `dist/src/economy-round4-2-2-model.js`
- `dist/src/economy-round4-2-2-policy.js`
- `dist/src/economy-round4-2-2-water.js`
- `docs/econ-sim/round4-2-2/ARCHIVE_24_25_KO.md`
- `docs/econ-sim/round4-2-2/CHANGED_FILES.md`
- `docs/econ-sim/round4-2-2/IMPLEMENTATION.md`
- `docs/econ-sim/round4-2-2/REPORT_KO.md`
- `docs/econ-sim/round4-2-2/REQUEST_KO.md`
- `docs/econ-sim/round4-2-2/VERIFICATION.md`
- `docs/econ-sim/round4-2-2/candidates.json`
- `docs/econ-sim/round4-2-2/cash-diagnostics.json`
- `docs/econ-sim/round4-2-2/changed-files.json`
- `docs/econ-sim/round4-2-2/final-runs.json`
- `docs/econ-sim/round4-2-2/h-cut.json`
- `docs/econ-sim/round4-2-2/input-manifest.json`
- `docs/econ-sim/round4-2-2/logs/baseline-tests.log`
- `docs/econ-sim/round4-2-2/logs/browser.log`
- `docs/econ-sim/round4-2-2/logs/calibration.log`
- `docs/econ-sim/round4-2-2/logs/check.log`
- `docs/econ-sim/round4-2-2/logs/diagnostics.log`
- `docs/econ-sim/round4-2-2/logs/exported-summary.json`
- `docs/econ-sim/round4-2-2/logs/full-tests.log`
- `docs/econ-sim/round4-2-2/logs/new-tests.log`
- `docs/econ-sim/round4-2-2/logs/preservation.log`
- `docs/econ-sim/round4-2-2/logs/quick.log`
- `docs/econ-sim/round4-2-2/logs/report-browser.json`
- `docs/econ-sim/round4-2-2/logs/report-build.log`
- `docs/econ-sim/round4-2-2/logs/script-syntax.log`
- `docs/econ-sim/round4-2-2/logs/verification.log`
- `docs/econ-sim/round4-2-2/no-cut-controls.json`
- `docs/econ-sim/round4-2-2/policy-search.json`
- `docs/econ-sim/round4-2-2/preservation-manifest.json`
- `docs/econ-sim/round4-2-2/report.html`
- `docs/econ-sim/round4-2-2/results.json`
- `docs/econ-sim/round4-2-2/runs.csv`
- `docs/econ-sim/round4-2-2/screenshots/report-initial-1440.png`
- `docs/econ-sim/round4-2-2/screenshots/report-initial-390.png`
- `docs/econ-sim/round4-2-2/screenshots/report-initial-667.png`
- `docs/econ-sim/round4-2-2/screenshots/report-initial-844.png`
- `docs/econ-sim/round4-2-2/screenshots/report-moon-water.png`
- `docs/econ-sim/round4-2-2/screenshots/report-offline.png`
- `docs/econ-sim/round4-2-2/screenshots/report-selected-1440.png`
- `docs/econ-sim/round4-2-2/screenshots/report-selected-390.png`
- `docs/econ-sim/round4-2-2/screenshots/report-selected-667.png`
- `docs/econ-sim/round4-2-2/screenshots/report-selected-844.png`
- `docs/econ-sim/round4-2-2/series.json`
- `docs/econ-sim/round4-2-2/summary.json`
- `docs/econ-sim/round4-2-2/verification.json`
- `scripts/econ-round4-2-2-analysis.mjs`
- `scripts/econ-round4-2-2-calibrate.mjs`
- `scripts/econ-round4-2-2-diagnostics.mjs`
- `scripts/econ-round4-2-2-inputs.mjs`
- `scripts/econ-round4-2-2-preserve.mjs`
- `scripts/econ-round4-2-2-report.mjs`
- `scripts/econ-round4-2-2-summarize.mjs`
- `scripts/econ-round4-2-2-verify.mjs`
- `scripts/econ-round4-2-2.config.json`
- `tests/browser-economy-round4-2-2-report.mjs`
- `tests/economy-round4-2-2.test.js`
