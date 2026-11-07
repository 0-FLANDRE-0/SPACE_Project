# ECON-SIM-4.2.1 실제 변경 파일

기존 추적파일 **1,350개 수정·삭제0개**. 기준은 PR #21 HEAD `97e9252320d3e5217e6aad80aab313baa1b1d268`이다. 아래 경로만 추가했다.

| 추가 영역 | 변경 내용 |
|---|---|
| `dist/src/economy-round4-2-1-model.js` | 정적 후속 정산, 순증산·가용시간 배분·선택적 H/전해 투자 현금 안전선, 기존 물/원장 회계 재사용 |
| `dist/src/economy-round4-2-1-policy.js` |3축 임시 범위·고정값·추가산출/비용 p*·정수 반응·남은시간 기존 보조·현금 정수 보호 |
| `scripts/econ-round4-2-1.config.json` |기준커밋·아카이브·단일기반·LHS32/기준안·5시드/240개월·가정 |
| `scripts/econ-round4-2-1-inputs.mjs` |고정 R41-rounded 입력·출력 경로 제한 |
| `scripts/econ-round4-2-1-analysis.mjs` |기존 기준/SCU 원가 재사용·모든12개월창/누적 비교·현금/물/시간/자가소비 지표 |
| `scripts/econ-round4-2-1-calibrate.mjs` |선별·후보/반올림·전체 OFF/ON·차단·동일기술 무차단·원자료/시계열/CSV |
| `scripts/econ-round4-2-1-verify.mjs` |독립재생·사전prefix·정수 생산비·거래안전선·교차 성능 |
| `scripts/econ-round4-2-1-diagnostics.mjs` |원래경로를 바꾸지 않는 첫시드 정부 C원장 추적 |
| `scripts/econ-round4-2-1-summarize.mjs` |5시드 표·전체 판정·0/0/순증산 정보 구분 |
| `scripts/econ-round4-2-1-report.mjs` |외부 의존 없는 단일HTML·6그래프·488경로·18격자·PC/모바일/내보내기 |
| `scripts/econ-round4-2-1-preserve.mjs` |전체 기준파일 SHA256/Git blob 및 새경로 허용목록 |
| `tests/economy-round4-2-1.test.js` |신규21 단위/통합 검사 |
| `tests/browser-economy-round4-2-1-report.mjs` |4해상도·터치·수치·차단/무차단 선택·오프라인 회귀 |
| `docs/econ-sim/round4-2-1/` |원요청·아카이브§24·보존/입력·결과·한국어 보고·HTML·로그/스크린샷 |

게임·M3·프리셋·이전 경제 결과/기준·기존 테스트는 수정하지 않았다. CSV/JSON에는 전체 정밀도가 있으며 단일HTML만으로 보고서를 열 수 있다. 기존 game 실행 링크나 배포를 바꾸지 않았고 ZIP을 만들지 않았다.

총 **56개 새 파일**. [기계 판독 목록](CHANGED_FILES.json) · [보존 로그](logs/preservation.log).

- [dist/src/economy-round4-2-1-model.js](../../../dist/src/economy-round4-2-1-model.js)
- [dist/src/economy-round4-2-1-policy.js](../../../dist/src/economy-round4-2-1-policy.js)
- [docs/econ-sim/round4-2-1/ARCHIVE_24_KO.md](ARCHIVE_24_KO.md)
- [docs/econ-sim/round4-2-1/CHANGED_FILES.json](CHANGED_FILES.json)
- [docs/econ-sim/round4-2-1/CHANGED_FILES.md](CHANGED_FILES.md)
- [docs/econ-sim/round4-2-1/IMPLEMENTATION.md](IMPLEMENTATION.md)
- [docs/econ-sim/round4-2-1/REPORT_KO.md](REPORT_KO.md)
- [docs/econ-sim/round4-2-1/REQUEST_KO.md](REQUEST_KO.md)
- [docs/econ-sim/round4-2-1/VERIFICATION.md](VERIFICATION.md)
- [docs/econ-sim/round4-2-1/candidates.json](candidates.json)
- [docs/econ-sim/round4-2-1/cash-diagnostics.json](cash-diagnostics.json)
- [docs/econ-sim/round4-2-1/final-runs.json](final-runs.json)
- [docs/econ-sim/round4-2-1/h-cut.json](h-cut.json)
- [docs/econ-sim/round4-2-1/input-manifest.json](input-manifest.json)
- [docs/econ-sim/round4-2-1/logs/baseline-tests.log](logs/baseline-tests.log)
- [docs/econ-sim/round4-2-1/logs/calibration.log](logs/calibration.log)
- [docs/econ-sim/round4-2-1/logs/cash-diagnostics.log](logs/cash-diagnostics.log)
- [docs/econ-sim/round4-2-1/logs/check.log](logs/check.log)
- [docs/econ-sim/round4-2-1/logs/exported-summary.json](logs/exported-summary.json)
- [docs/econ-sim/round4-2-1/logs/new-tests.log](logs/new-tests.log)
- [docs/econ-sim/round4-2-1/logs/preservation.log](logs/preservation.log)
- [docs/econ-sim/round4-2-1/logs/report-browser.json](logs/report-browser.json)
- [docs/econ-sim/round4-2-1/logs/report-browser.log](logs/report-browser.log)
- [docs/econ-sim/round4-2-1/logs/report-build.log](logs/report-build.log)
- [docs/econ-sim/round4-2-1/logs/summary.log](logs/summary.log)
- [docs/econ-sim/round4-2-1/logs/tests.log](logs/tests.log)
- [docs/econ-sim/round4-2-1/logs/verification.log](logs/verification.log)
- [docs/econ-sim/round4-2-1/no-cut-controls.json](no-cut-controls.json)
- [docs/econ-sim/round4-2-1/policy-search.json](policy-search.json)
- [docs/econ-sim/round4-2-1/preservation-manifest.json](preservation-manifest.json)
- [docs/econ-sim/round4-2-1/report.html](report.html)
- [docs/econ-sim/round4-2-1/results.json](results.json)
- [docs/econ-sim/round4-2-1/runs.csv](runs.csv)
- [docs/econ-sim/round4-2-1/screenshots/report-initial-1440.png](screenshots/report-initial-1440.png)
- [docs/econ-sim/round4-2-1/screenshots/report-initial-390.png](screenshots/report-initial-390.png)
- [docs/econ-sim/round4-2-1/screenshots/report-initial-667.png](screenshots/report-initial-667.png)
- [docs/econ-sim/round4-2-1/screenshots/report-initial-844.png](screenshots/report-initial-844.png)
- [docs/econ-sim/round4-2-1/screenshots/report-offline.png](screenshots/report-offline.png)
- [docs/econ-sim/round4-2-1/screenshots/report-selected-1440.png](screenshots/report-selected-1440.png)
- [docs/econ-sim/round4-2-1/screenshots/report-selected-390.png](screenshots/report-selected-390.png)
- [docs/econ-sim/round4-2-1/screenshots/report-selected-667.png](screenshots/report-selected-667.png)
- [docs/econ-sim/round4-2-1/screenshots/report-selected-844.png](screenshots/report-selected-844.png)
- [docs/econ-sim/round4-2-1/series.json](series.json)
- [docs/econ-sim/round4-2-1/summary.json](summary.json)
- [docs/econ-sim/round4-2-1/verification.json](verification.json)
- [scripts/econ-round4-2-1-analysis.mjs](../../../scripts/econ-round4-2-1-analysis.mjs)
- [scripts/econ-round4-2-1-calibrate.mjs](../../../scripts/econ-round4-2-1-calibrate.mjs)
- [scripts/econ-round4-2-1-diagnostics.mjs](../../../scripts/econ-round4-2-1-diagnostics.mjs)
- [scripts/econ-round4-2-1-inputs.mjs](../../../scripts/econ-round4-2-1-inputs.mjs)
- [scripts/econ-round4-2-1-preserve.mjs](../../../scripts/econ-round4-2-1-preserve.mjs)
- [scripts/econ-round4-2-1-report.mjs](../../../scripts/econ-round4-2-1-report.mjs)
- [scripts/econ-round4-2-1-summarize.mjs](../../../scripts/econ-round4-2-1-summarize.mjs)
- [scripts/econ-round4-2-1-verify.mjs](../../../scripts/econ-round4-2-1-verify.mjs)
- [scripts/econ-round4-2-1.config.json](../../../scripts/econ-round4-2-1.config.json)
- [tests/browser-economy-round4-2-1-report.mjs](../../../tests/browser-economy-round4-2-1-report.mjs)
- [tests/economy-round4-2-1.test.js](../../../tests/economy-round4-2-1.test.js)
