# ECON-SIM-4.2 실제 변경 파일

기준 `2af4b7450bf5399d9c5cfe9f229ea8a5d02eec4f`에서 기존 추적 파일 수정·삭제 **0개**. 아래 파일만 추가했다. [기준1,287파일 보존 목록](preservation-manifest.json)과 [최종 보존 로그](logs/preservation.log)를 함께 확인한다.

| 추가 영역 | 주요 수정 사항 |
|---|---|
| `dist/src/economy-round4-2-model.js` | 기존 생성자와 독립 정적 정산 어댑터, 이중 공정, 소유자별 H/물 회계, 유상 H-CUT 시험, 비활성 재현, 수동 원가 관측기 |
| `dist/src/economy-round4-2-policy.js` | 새 임시 범위·히스테리시스·엄격 진입 손익·전환 비용·램프·반응 질량·차단 입력 검사 |
| `scripts/econ-round4-2.config.json` | 시작·아카이브 커밋,9축LHS64/5시드/240개월, 새 기준·임시 가정 |
| `scripts/econ-round4-2-inputs.mjs` | 기존 불변 입력 읽기·해시·판정lane·출력 경로 |
| `scripts/econ-round4-2-analysis.mjs` | 기존 기준 재사용, 시장 SCU원가/회수·소유자 원가·차단/전환/물 지표 |
| `scripts/econ-round4-2-calibrate.mjs` | 결정적 LHS·선별·전 시나리오 OFF/ON·H-CUT·민감도·JSON/CSV |
| `scripts/econ-round4-2-replay.mjs` | 공개 OFF 전체 재현 및 기존 아카이브 비교 |
| `scripts/econ-round4-2-verify.mjs` | 관측기 무영향·대표 경로 재생·정수95%·성능 |
| `scripts/econ-round4-2-cut-control.mjs` | 같은 기술의 무차단 대조·사전prefix 일치·원인 해석 |
| `scripts/econ-round4-2-summarize.mjs` | 필수 기존 기준과 전체 새 기준 구분,5시드 평균·사전 환원/사후 진입 구분 |
| `scripts/econ-round4-2-report.mjs` | 외부 의존0 단일 오프라인HTML,6그래프·격자·PC/모바일·유상 차단 대조표 |
| `scripts/econ-round4-2-preserve.mjs` | 기존 모든 Git blob/SHA256 보존 및 새 파일 경로 허용목록 |
| `tests/economy-round4-2.test.js` | 신규23 단위·통합 회귀 검사 |
| `tests/browser-economy-round4-2-report.mjs` | PC/모바일 터치·수치·내보내기·네트워크0 오프라인 보고서 회귀 |
| `docs/econ-sim/round4-2/` | 원요청·기준해시·실험 입력/후보/전체결과/시계열·한국어 보고서3종·단일HTML·로그·스크린샷 |

다음은 산출물과 검증 로그를 포함한 전체 추가 경로다. 용량이 큰 `series.json`은 전체 정밀도 첫시드 월경로이고 `final-runs.json`/`h-cut.json`은 전체5시드 원자료다. HTML만으로 실행할 수 있으며 인접 JSON을 요청하지 않는다. GitHub의 큰 파일 표시 제한으로 raw다운로드가 필요할 수 있다. ZIP·게임 배포 파일은 만들지 않았다.

총 **63개 새 파일**. 기계 판독 목록은 [CHANGED_FILES.json](CHANGED_FILES.json).

- [dist/src/economy-round4-2-model.js](../../../dist/src/economy-round4-2-model.js)
- [dist/src/economy-round4-2-policy.js](../../../dist/src/economy-round4-2-policy.js)
- [docs/econ-sim/round4-2/CHANGED_FILES.json](CHANGED_FILES.json)
- [docs/econ-sim/round4-2/CHANGED_FILES.md](CHANGED_FILES.md)
- [docs/econ-sim/round4-2/IMPLEMENTATION.md](IMPLEMENTATION.md)
- [docs/econ-sim/round4-2/REPORT_KO.md](REPORT_KO.md)
- [docs/econ-sim/round4-2/REQUEST_KO.md](REQUEST_KO.md)
- [docs/econ-sim/round4-2/VERIFICATION.md](VERIFICATION.md)
- [docs/econ-sim/round4-2/candidates.json](candidates.json)
- [docs/econ-sim/round4-2/final-runs.json](final-runs.json)
- [docs/econ-sim/round4-2/h-cut-controls.json](h-cut-controls.json)
- [docs/econ-sim/round4-2/h-cut.json](h-cut.json)
- [docs/econ-sim/round4-2/industry-observer.json](industry-observer.json)
- [docs/econ-sim/round4-2/input-manifest.json](input-manifest.json)
- [docs/econ-sim/round4-2/logs/baseline-tests.log](logs/baseline-tests.log)
- [docs/econ-sim/round4-2/logs/calibration.log](logs/calibration.log)
- [docs/econ-sim/round4-2/logs/check.log](logs/check.log)
- [docs/econ-sim/round4-2/logs/cut-controls.log](logs/cut-controls.log)
- [docs/econ-sim/round4-2/logs/exported-summary.json](logs/exported-summary.json)
- [docs/econ-sim/round4-2/logs/model-smoke.log](logs/model-smoke.log)
- [docs/econ-sim/round4-2/logs/new-tests.log](logs/new-tests.log)
- [docs/econ-sim/round4-2/logs/off-replay.log](logs/off-replay.log)
- [docs/econ-sim/round4-2/logs/preservation.log](logs/preservation.log)
- [docs/econ-sim/round4-2/logs/quick-v2.log](logs/quick-v2.log)
- [docs/econ-sim/round4-2/logs/quick.log](logs/quick.log)
- [docs/econ-sim/round4-2/logs/report-browser.json](logs/report-browser.json)
- [docs/econ-sim/round4-2/logs/report-browser.log](logs/report-browser.log)
- [docs/econ-sim/round4-2/logs/report-build.log](logs/report-build.log)
- [docs/econ-sim/round4-2/logs/summary.log](logs/summary.log)
- [docs/econ-sim/round4-2/logs/tests.log](logs/tests.log)
- [docs/econ-sim/round4-2/logs/verification.log](logs/verification.log)
- [docs/econ-sim/round4-2/off-replay.json](off-replay.json)
- [docs/econ-sim/round4-2/policy-search.json](policy-search.json)
- [docs/econ-sim/round4-2/preservation-manifest.json](preservation-manifest.json)
- [docs/econ-sim/round4-2/report.html](report.html)
- [docs/econ-sim/round4-2/results.json](results.json)
- [docs/econ-sim/round4-2/runs.csv](runs.csv)
- [docs/econ-sim/round4-2/screenshots/report-initial-1440.png](screenshots/report-initial-1440.png)
- [docs/econ-sim/round4-2/screenshots/report-initial-390.png](screenshots/report-initial-390.png)
- [docs/econ-sim/round4-2/screenshots/report-initial-667.png](screenshots/report-initial-667.png)
- [docs/econ-sim/round4-2/screenshots/report-initial-844.png](screenshots/report-initial-844.png)
- [docs/econ-sim/round4-2/screenshots/report-offline.png](screenshots/report-offline.png)
- [docs/econ-sim/round4-2/screenshots/report-selected-1440.png](screenshots/report-selected-1440.png)
- [docs/econ-sim/round4-2/screenshots/report-selected-390.png](screenshots/report-selected-390.png)
- [docs/econ-sim/round4-2/screenshots/report-selected-667.png](screenshots/report-selected-667.png)
- [docs/econ-sim/round4-2/screenshots/report-selected-844.png](screenshots/report-selected-844.png)
- [docs/econ-sim/round4-2/series.json](series.json)
- [docs/econ-sim/round4-2/summary.json](summary.json)
- [docs/econ-sim/round4-2/verification.json](verification.json)
- [docs/econ-sim/round4-2/water-sensitivity.json](water-sensitivity.json)
- [docs/econ-sim/round4-2/water-source-evidence.json](water-source-evidence.json)
- [scripts/econ-round4-2-analysis.mjs](../../../scripts/econ-round4-2-analysis.mjs)
- [scripts/econ-round4-2-calibrate.mjs](../../../scripts/econ-round4-2-calibrate.mjs)
- [scripts/econ-round4-2-cut-control.mjs](../../../scripts/econ-round4-2-cut-control.mjs)
- [scripts/econ-round4-2-inputs.mjs](../../../scripts/econ-round4-2-inputs.mjs)
- [scripts/econ-round4-2-preserve.mjs](../../../scripts/econ-round4-2-preserve.mjs)
- [scripts/econ-round4-2-replay.mjs](../../../scripts/econ-round4-2-replay.mjs)
- [scripts/econ-round4-2-report.mjs](../../../scripts/econ-round4-2-report.mjs)
- [scripts/econ-round4-2-summarize.mjs](../../../scripts/econ-round4-2-summarize.mjs)
- [scripts/econ-round4-2-verify.mjs](../../../scripts/econ-round4-2-verify.mjs)
- [scripts/econ-round4-2.config.json](../../../scripts/econ-round4-2.config.json)
- [tests/browser-economy-round4-2-report.mjs](../../../tests/browser-economy-round4-2-report.mjs)
- [tests/economy-round4-2.test.js](../../../tests/economy-round4-2.test.js)
