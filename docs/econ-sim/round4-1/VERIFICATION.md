# ECON-SIM-4.1 검증·재현 기록

2026-11-02 Asia/Seoul. 코드 기준 PR15 `b04e3f117de303b84705ef1baa50d9521d960be2`, 문서 기준 PR14 `bdfa3eb5380e29ae779ef085bf26b525c70d2e65`. 게임 본체에 연결하지 않았다.

## 자동 검사와 보존

| 검사 | 실제 결과 | 증거 |
|---|---|---|
| 변경 전 `npm run check` | 81모듈 | [baseline-check.log](logs/baseline-check.log) |
| 변경 전 `npm test` | 455통과, 실패/skip0 | [baseline-tests.log](logs/baseline-tests.log) |
| 최종 `npm run check` | 83모듈 | [check.log](logs/check.log) |
| 최종 `npm test` | **487통과**, 실패/취소/skip0,48.378초 | [tests.log](logs/tests.log) |
| 원본 보존 | **875경로** SHA256 동일, DECISIONS 기존 접두부 동일 | [preservation.log](logs/preservation.log), [manifest](preservation-manifest.json) |
| R4 OFF/원본 궤적 | 4기반×22경로×5시드=440쌍, 원래 compact해시도 일치 | [off-replay.json](off-replay.json) |
| 독립 어댑터·최종 재현 | 526회: 불변 어댑터440+최종70+구호16 | [independent-verification.json](logs/independent-verification.json) |
| 민간 해체 진단 | 40회, 원래 R4와 관측 어댑터20쌍 전체 행 해시 일치 | [진단](PRIVATE_SALVAGE_KO.md), [로그](logs/private-diagnostic.log) |

기존455개 테스트는 수정하지 않았다. 새32개는 OFF/어댑터 결정성, 고정37축, 히스테리시스 경계, 모드별 보수 우선순위, 마지막 유예 월의 우선 복귀, G개월 유예와 정수 미납/실제 유상 상환, 재진입으로 유예 초기화 금지, 프리미엄/매입 한도/빈 재고·현금, 실제 SCU와 출발 전력, 소유자·행성 전체 공급지 하한,18격자/대표 충격, 정보/판정 분리, 민간 행동 최소 재현, 원장 변조, 전42경로 무결성 및 E11-M의 실제 정부 건설/해체를 다룬다.

기존 전체 테스트에서 저장 v1/v2/v3 이관/실패 격리·원문 보존, SCU 권위 시계·원광 lot·소재/C/Wh 보존, 기존 산업 생산·공식 지구 데이터도 다시 실행했다. 게임 저장 schema·localStorage 동작을 변경하지 않는다.

## 구현 중 발견한 반례와 수정 검증

1. **공급지 보호:** 출하 소유자가 정부이고 필수망은 민간 소유인 경우, 소유자 보수만 검사하면 천체 전체 하한을 놓칠 수 있었다. [수정 전 실패](logs/donor-reserve-before-fix.log)를 보존했다. 현재는 출하 소유자와 천체 전체 보수 비축을 함께 검사하며 실제 내용물+SCU 소재를 모두 차감한 후의 두 하한을 감사한다. 이 수정 뒤 전체 탐색을 다시 실행했다. 수정 전 완료 탐색은 `calibration-before-donor-fix.log`에 별도로 남겼고 최종 판정 자료에 사용하지 않는다.
2. **E11-M 대조 연결:** 초기 사건의 E5 기반 매핑이 빠져 정부 산업이 없고 해체도 발생하지 않는 반례를 [실패 검사](logs/e11-m-before-fix.log)로 확인했다. 신규 E11-M만 E5 초기 건설을 사용하게 고쳤다. [수정 후 검사](logs/e11-m-after-fix.log)와 **5안×2lane×5시드=50개 E11-M 경로**를 다시 실행했다. 모든 경로에서 월66 정부 해체 발주·실제 묶인 자본 반환이 발생한다. [수정 전 데이터](e11-m-before-fix.json), [수정 전후/추가50회](e11-m-correction.json), [수정 후 원시50개](e11-m-revalidation-runs.json).

나머지41경로의 함수 경로·정책값은 이 두 번째 수정으로 바뀌지 않는다. `correct-e11` 도구는 원래 자료를 숨기지 않고50개의 수정 행과 월 시계열·후보 집계를 갱신하며 추가 실행 수를 따로 센다. 현재 소스로 처음부터 탐색하면 이미 올바른 E11-M이므로 추가 수정은 no-op이다. 두 실패 로그는 개발 중 반례이며 최종487개 테스트의 실패 수와 혼동하지 않는다. 정부 시설만을 조달 대상으로 한 초기 초안 중단 로그와 smoke도 공식 표본에 포함하지 않는다.

## 실행 건수

| 공식 최종 데이터 단계 | 실제 고유 경로 |
|---|---:|
| H.4, 새 정책 OFF | 440 |
| 기존4기반×64개 새7축×대표/강한격자2×자력/구호2×5시드 | 5,120 |
| 기반별 검토안4×42경로×2lane×5시드 | 1,680 |
| 별도7축 반올림안×42×2×5 | 420 |
| 대표 모드2×구호4×4기반×5시드 | 160 |
| 극한8-arm×5시드 | 40 |
| H1.2 대조4기반×E0/E5-M×5 | 40 |
| **최종 CSV 고유 경로** | **7,900** |

E11-M 추가 재검증50회를 포함한 해당 최종 탐색의 **실제 ON 실행은7,950회**다. CSV는 동일 경로의 수정 전후를 중복 고유 경로로 세지 않고 수정 후 값을 가진다. 수정 전50개는 별도 JSON에 보존한다. 추가 관측65회(H45+정부 비축20), 민간 진단40회, 독립 검산526회, 성능45회, R4 OFF440쌍/880회도 각각 별도 기록했다. 이 숫자는 명시한 완료 절차의 범위이며 개발 중 smoke·중단/수정 전 전체 탐색·단위 테스트 안의 실행까지 합친 세션 총 실행 수라고 주장하지 않는다.

독립 검산은 전체440개 기존 경로를 **ON 어댑터/H1.2/정책OFF**로 다시 실행해, 단순 OFF 위임만 통과하는 우회를 막는다. 이어 최종5안×2lane×7경로 첫 시드70개 및 구호16개를 다시 실행해 최종 compact행 SHA256을 대조한다. 구호의 실제 매입/출발 재고·행성 전체 비축·소유자별 대금·SCU 소재/회수/전력은 [relief-ledger-evidence.json](relief-ledger-evidence.json)에 남겼다.

## 브라우저

Linux Chromium/Playwright에서 **1440×1000,844×390,667×375,390×844**를 검증했다.5검토안·42경로·8-arm 정책/11개 그래프·36개 격자 버튼, 후보/lane/충격 변경, E5-X의 실제 부족 모드 구간, 유한 SVG,44px 컨트롤, 본문 가로 넘침0과 마지막 내용 접근을 검사한다. 모바일 세 화면에서는 격자 버튼을 실제 `tap()`하여 lane/경로/곡선이 바뀌는지 확인했다. [브라우저 로그](logs/report-browser.log), [구조화 증거](logs/report-browser.json), [스크린샷](screenshots/).

단일 HTML을 별도 임시 디렉터리로 복사하고 새 `offline:true` context에서 HTML 바이트만 주입해 실행했다. 인접 JSON·CDN·폰트 없이 그래프·모드 전환이 작동하며 외부 요청/page·console 오류0이다. 이 환경의 관리 Chromium은 `file://` 직접 탐색을 정책으로 차단했다. 정책을 우회하지 않았으며 **일반 기기에서 파일 직접 열기까지 검증했다고 보고하지 않는다**. 실제 휴대폰·Safari/Firefox도 미실시다.

게임도 별도 서버의 원본 dist로 저장 초기화 회귀를 실행했다. [game-development-reset-browser.log](logs/game-development-reset-browser.log)는 PC/모바일3해상도에서 공식19천체·92셀·8,893POP, 광업/제련·편집, 새로고침 초기화·시험 재고 재지급, 타 프로젝트 저장 보존, 저장 접근 차단/삭제 실패를 확인했고 page·console 오류0이었다. 보고서 서버에서는 테스트에 필요한 HTML만 요청하며 새 보고서가 게임 진입점에 연결되지 않았음을 보존 검사와 함께 확인했다.

검증 흐름은 원시 시뮬레이션→inline JSON→SVG/격자→PC 클릭·모바일 탭→선택 경로 갱신이다. 서버/API/외부 데이터베이스는 없는 단일 문서다. 적용한 [vercel:verification](skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1/verification/SKILL.md)의 흐름 검증 범위를 이 경로로 한정했다. GitHub Actions의 별도 CI 성공은 주장하지 않는다.

## 재현

Node24, 저장소 루트. 기존 설정은 고정이며 출력은 새 round4-1 또는 artifacts 하위만 허용한다.

```sh
npm run check
npm test
node scripts/econ-round4-1-preserve.mjs
node scripts/econ-round4-1-calibrate.mjs --out docs/econ-sim/round4-1 --workers 3
node scripts/econ-round4-1-correct-e11.mjs
node scripts/econ-round4-1-diagnose.mjs
node scripts/econ-round4-1-supply.mjs
node scripts/econ-round4-1-verify.mjs
node scripts/econ-round4-1-report.mjs
```

기존37축의 LHS는 재실행하지 않는다. 개발 smoke는 `--quick --out artifacts/econ41-quick`이며 공식 폴더에 quick 출력을 쓰지 못하게 막았다. 새 소스의 전체 재현은 E11-M 추가50회가 필요 없어 실행 건수·시간 메타데이터가 달라질 수 있으나 최종 경로 해시는 동일해야 한다.

별도 터미널에서 보고서 서버와 브라우저를 실행한다.

```sh
python3 -m http.server 5174 --bind 127.0.0.1
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-economy-round4-1-report.mjs
```

성능의 Node/CPU/병렬도·p50/p95·벽시계는 [results.json](results.json)에 원시 값으로 보존한다. 단일20년 실행 시간이며 게임 FPS가 아니다. 과거 R3의59.8ms·R4의200ms는 역사적 측정이고, 이번 동일 호스트의 R4 대조와 섞지 않는다. 큰 정부 비축/필수망 집계/가격 마진/일반 수요의 해석 한계는 [구현](IMPLEMENTATION.md)과 [결과](REPORT_KO.md)를 따른다.
