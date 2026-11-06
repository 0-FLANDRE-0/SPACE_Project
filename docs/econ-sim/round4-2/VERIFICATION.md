# ECON-SIM-4.2 검증 보고서

작성 기준 2026-11-07 Asia/Seoul. 시작 커밋 `2af4b7450bf5399d9c5cfe9f229ea8a5d02eec4f`. 이번 결과는 오프라인 검증이며 합격0/6을 숨기거나 게임 수치를 바꾸지 않았다.

## 1. 자동 검사

| 검사 | 실제 결과 | 증거 |
|---|---|---|
| 수정 전 기존 전체 테스트 |589/589 통과|[baseline-tests.log](logs/baseline-tests.log)|
| 최종 전체 테스트 |612/612 통과, skip0/fail0|[tests.log](logs/tests.log)|
| 소스 문법 검사 |105모듈 통과|[check.log](logs/check.log)|
| 신규 모델 단위·통합 검사 |23개 포함|[테스트 파일](../../../tests/economy-round4-2.test.js)|
| 기준 파일 보존 |1,287개 SHA256·Git blob 동일|[preservation-manifest.json](preservation-manifest.json), [preservation.log](logs/preservation.log)|
| 공개 OFF 재현 |2,100쌍/4,200실행, 오차0|[off-replay.json](off-replay.json)|
| 최종 adapter-OFF |2,520경로 전부 기존 compact 해시 일치|[final-runs.json](final-runs.json)의 legacyHash|
| 정식 실행 |8,815경로, 무결성 실패0|[results.json](results.json)|
| 수동 관측기·대표 경로 재실행 |120+72=192경로, 해시 차이0|[verification.json](verification.json)|
| H-CUT 정수95% 재검사 |1,080건 일치, 현지 전해 산출0|[verification.json](verification.json)|
| 동일기술 무차단 대조 |120무차단+72대표cut=192실행,72개 전구간prefix 일치|[h-cut-controls.json](h-cut-controls.json)|
| 성능 |종류별15번, 총45번|[verification.json](verification.json)|

원장 검사는 모든 정산에서 기존 C/U·기동·에너지 감사와 새 H/물 provenance·산소 질량 감사를 실행한다. 예외를 무시하거나 실패 경로를 필터링하지 않았으며, 실패 시 batch가 중단되게 했다. `integrityFailures=0`은 경제 합격이 아니다.

신규 테스트는 비활성 공개 API/복사 커널 재현, 잘못된 입력 거부, 히스테리시스 경계, 동일 월 이중 비용 방지, 비경제적 전환 금지, 전환비와96h 냉간 처리 구별, 광산 회복 불변, 반응 산소 질량, 수소 보조 중복 방지, H0/일부H 기존 공정 작업 대체, 물 우선 배분/재고 보존, 자체 생산 H provenance와 자기 매출 금지, 데이터 조작 감사, 폐기 자산 포함 이동12개월 전환 횟수, tick60 정확 창, 유상 식민지 재고 준비,37기존 값/인구/정상핵융합 고정, LHS 층화/반올림, 보존, 수동 관측기 무영향을 다룬다.

## 2. 이전 결과 보존과 재현 범위

`preservation-manifest.json`은 시작 커밋의 모든 추적 파일1,287개를 기록한다. 현재 파일 SHA256뿐 아니라 `git show baseline:path` 원문과도 비교한다. 변경 허용은 새4.2 모델·스크립트·테스트·새결과 폴더뿐이다. 기존 테스트를 삭제하거나 보존 목록에서 제외하지 않았다. 기존 프리셋, 지구 인구/자원,37개R4·7개R4.1 축, 과거 산출물, DECISIONS, UI를 고치지 않았다.

공개 OFF의 2,100쌍은5기반×42시나리오×2lane×5시드이다. R4.1 현재 실행/새 공개OFF의 전체 월행 해시가 같고, 기존 아카이브 compact41 해시도 같다. 별도로 최종6검토안의2,520 adapter-OFF경로를 같은 아카이브에 비교했다. H-CUT의 OFF는 새 시험 준비/차단이 붙으므로 옛 평시 아카이브와 같다고 주장하지 않는다. 대신 같은 준비·차단에서 OFF/ON을 짝지었다.

최종 192재실행은 E0 전체120경로를 수동 관측기와 함께 재생하고, 대표6시나리오×6검토안×2lane의 첫시드72경로를 재생했다. 1,080 H-CUT ON의 생산비는 합금0.001U 정수 Q에 대해 `ON*100 >= OFF*95`로 검증했다.

## 3. 브라우저·오프라인 보고서

Chromium `/usr/bin/chromium`, Playwright core로 아래 해상도를 실제 실행했다. 모바일3종은 터치 에뮬레이션이며 실물 휴대전화 인증이 아니다.

| 해상도 | 검사 | 스크린샷 |
|---|---|---|
|1440×900|PC 선택·6그래프·18격자·구호lane·JSON내보내기|[초기](screenshots/report-initial-1440.png), [선택 후 전체](screenshots/report-selected-1440.png)|
|844×390|모바일가로 터치선택·스크롤·표 수평스크롤 격리|[초기](screenshots/report-initial-844.png), [선택 후](screenshots/report-selected-844.png)|
|667×375|소형가로 동일 흐름|[초기](screenshots/report-initial-667.png), [선택 후](screenshots/report-selected-667.png)|
|390×844|모바일세로 동일 흐름|[초기](screenshots/report-initial-390.png), [선택 후](screenshots/report-selected-390.png)|
|오프라인1440×900|네트워크 차단 context에 단일HTML bytes를 넣어 로드·선택·6그래프|[오프라인](screenshots/report-offline.png)|

전 해상도에서 루트 가로 넘침0, 유효 수치 SVG, 선택안/천체/충격/lane 전환, 주요 터치 높이44px 이상, H-CUT 음영·표와 수치 일치를 검사했다. HTTP로는 HTML 자체1건만 요청했고, 오프라인은 HTTP요청0건이다. 브라우저 runtime/console error0. [구조화 로그](logs/report-browser.json), [실행 로그](logs/report-browser.log), [검사 스크립트](../../../tests/browser-economy-round4-2-report.mjs).

직접 파일 bytes를 읽어 오프라인 로드한 것을 검사했으며 이 관리형 환경의 native `file://` 접근이나 Safari/Firefox·실기기까지 통과했다고 주장하지 않는다. 최신 DecompressionStream 지원 브라우저가 필요하다. HTML은 약22MB이며 첫 로드 때 내장 압축 데이터를 푸는 시간이 든다. raw JSON/CSV의 정밀도는 줄이지 않았고 HTML 표시용 복사본만 소수6자리로 줄였다. 첫시드1,080경로를 내장하며 전체5시드별 곡선은 내장하지 않았다. 5시드 전체 집계·해시는 원자료에 있다.

게임 source가 전부 바이트 불변이므로 이번 브라우저 검사는 **새 보고서**에 집중했다. 기존 게임의 함선·지도·산업화면 브라우저 전체 회귀를 이번에 다시 실행했다고 보고하지 않는다. 기존612단위/통합 테스트에는 산업·SCU·이동·탐사·UI1 회귀가 포함된다. 저장 이관 코드는 이번에 새로 만들거나 실행 경로에 연결하지 않았다.

## 4. 성능

다른 경제 worker 작업 종료 후 같은 호스트의 단일20년 실행을15개씩 교차 측정했다. Node v24.19.0, AMD EPYC9V74, 노출 병렬도4.
| 종류 | 횟수 | p50 ms | p95 ms |
|---|---|---|---|
| round41 | 15 | 226.073 | 297.038 |
| round42Peace | 15 | 308.730 | 336.456 |
| round42Stress | 15 | 172.464 | 213.358 |

p95는15표본의 nearest-rank 최상위 표본이다. E0 p50 비율은 약1.37이며 O/M·자산 수에 따라 다른 충격의 실행 시간이 더 짧을 수 있다. 정식 LHS/전 시나리오/H-CUT/민감도8,815실행은3worker로893.60초였다. 성능값은 재실행 시 호스트 부하에 따라 변하고 게임 프레임률을 의미하지 않는다.

## 5. 재현 명령

저장소 root에서 Node24 계열을 사용한다. 전체 산출물 재생은 새4.2 결과 폴더만 덮어쓰며 이전 산출물에 쓰지 않는다. preservation-manifest는 재생성하지 않고 기준과 비교한다.

```bash
npm run check
npm test
node scripts/econ-round4-2-preserve.mjs
node scripts/econ-round4-2-replay.mjs
node scripts/econ-round4-2-calibrate.mjs --workers 3
node scripts/econ-round4-2-verify.mjs
node scripts/econ-round4-2-cut-control.mjs
node scripts/econ-round4-2-summarize.mjs
node scripts/econ-round4-2-report.mjs
```

간이 실행은 `node scripts/econ-round4-2-calibrate.mjs --quick --out artifacts/econ42-quick`이다. 간이 실행을 정식8,815결과로 바꾸지 않는다. 사람이 작성한 한국어 보고서는 새 실행 수치가 바뀌면 원자료와 비교해 갱신해야 한다.

브라우저 검사는 저장소 root를 서비스한다(게임dist서버와 별개).

```bash
python3 -m http.server 5174 --bind 127.0.0.1
# 다른 터미널; Playwright 패키지와 Chromium의 실제 설치 위치를 지정
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/usr/bin/chromium \
node tests/browser-economy-round4-2-report.mjs
```

브라우저 테스트는 외부 npm 패키지를 repo 의존성에 추가하지 않았다. 다른 환경에서는 `PLAYWRIGHT_MODULE`/`CHROMIUM_EXECUTABLE`을 설치 위치에 맞춘다. 보고서 자체는 이 패키지가 필요하지 않다.

## 6. 판정·한계

경제 최종 합격0/6, 무결성0실패, 보존/테스트/보고서 동작 검증을 서로 구분했다. N055·N066 시장 수익성, 공식 H-CUT95%, 전환 진동이 미달이다. 일부 시드에서 차단 직전 환원이 없거나 정식 복귀가 없다는 제약도 그대로 보고했다. 같은 기술 무차단 대조는 인과 해석을 돕지만95% 기준을 대신하지 않는다. 임시 수치의 게임 적용·M3·새물류·발전모듈·추진제·비축정책은 검증 대상도 구현 대상도 아니다.
