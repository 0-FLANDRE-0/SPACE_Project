# 검증 — 2026-11-02 Asia/Seoul

기준: PR12 `f2aa8a824020042d201c552d55f8f4a82ab2a6a6`. Node v24.19.0, Linux, `/usr/bin/chromium`, Playwright Core. 실제 브라우저는 로컬 정적 서버와 Three.js/SwiftShader를 사용했다. 서버 API/DB가 없는 앱이므로 검증 경계는 **UI/명시적 JSON → 실제 산업 상태/SCU 장부 → 전체 validator → 재고 표시·새로고침**이다.

## 수정 전 재현과 수정 후

생산 코드 수정 전에 `tests/repro-scu-clock.mjs`를 작성하여 실행했다. 전체 단위 테스트에 포함시키기 위해 이후 본문 변경 없이 `repro-scu-clock.test.js`로 이름을 바꿨다.

| 동일 조건 | 1시간 후 처리 | 상태 | 테스트 |
|---|---:|---|---|
| PR12, 500일 유휴 후 8SCU/h로 32SCU 수동 예약 | 32SCU | completed | 1 FAIL, exit1 |
| 수정 후 같은 재현 | 8SCU | reserved | 1 PASS |
| 실제 앱 후속 브라우저 | 8SCU → 4시간째 32SCU | reserved → completed | 4 viewport |

원시 로그: [수정 전](logs/clock-before.log), [수정 후](logs/clock-after.log). 과거 `lastMs=0`에서 현재로 한꺼번에 정산하던 원인을 제거했다. 단순히 시계를 1로 시작하거나 현재 시각 인자를 항상0으로 고정한 수정이 아니다.

## 전체 자동 검증

- 기준 `npm run check`: **73 source modules PASS**; 기준 `npm test`: **367 PASS / 0 FAIL / 0 SKIP** ([기준 check](logs/baseline-check.log), [기준 test](logs/baseline-tests.log)).
- 최종 `npm run check`: **78 source modules PASS** ([로그](logs/check.log)).
- 최종 `npm test`: **404 PASS / 0 FAIL / 0 SKIP**, 신규 **37개**, 약34.19초 ([로그](logs/tests.log)).
- 모든 기존 수치 검증 유지. 기존 127개 허용 규격 조합×1~32SCU, 대량 집계, 합금 내용/소재 별도 차감, 수소 호환/수취, 구형 우선, 회수 정수·분수, 취소·비용 보류·장부 훼손 검사가 포함된다.

신규 행동 케이스:

| 파일 | 개수 | 핵심 |
|---|---:|---|
| `tests/repro-scu-clock.test.js` | 1 | 500일 수동 예약 최소 재현 |
| `tests/scu-followup-clock.test.js` | 10 | 처리능력 늦게 연결, 자동 계획, OFF/ON, 취소/재예약, 속도 변경, 분할 정산, 분수, 저장 왕복, 과거/미래/중복 거부, 여러 주체, 유휴 복제0 |
| `tests/scu-followup-ore.test.js` | 15 | 명시 정책, 공식 자료로 실제 채굴한 세 등급, 8U 및 .001U, 일부 상자 전체 개봉, 다른 광맥, 혼합/부분/원격 거부, null 비용, 부족/위조/재사용/훼손, 세대, 현재 저장 |
| `tests/scu-followup-smelting.test.js` | 3 | 봉인 제련 차단, 개봉 후 기존14/33/52% 수율 |
| `tests/scu-followup-storage.test.js` | 8 | 진짜 PR12 v3 5종, 훼손/백업·기본키 실패 격리, 구형 예약 이관, 현재 시각 훼손 |

원광 수율 분리 검사는 **테스트 메모리에서만** 실제 지질 구조의 유한2,000U 광맥/단일 품질/난도0을 만들어 전량 채굴·봉인하고 광산을 고갈시킨 뒤 실행한다. 공식 혼합 분포·난도는 수정하지 않았다. 각8U 개봉 후 합금1.120/2.640/4.160U와 나머지 잔여물, 원광 총량·광맥 추출 이력을 검사한다. 별도로 공식 프리셋에서 실제 채굴된 low/medium/high 및 실제 난도41.072를 포장/개봉한다.

초기 테스트 작성 과정의 `clock-tests.log`, `ore-tests.log`는 최종 결과가 아니다. 분할 시간 입력의 부동소수점 표현, 그룹 선택 구조분해 및 최적화기의 정상 대체 규격 선택을 반영하도록 테스트 입력을 바로잡았다. 최종 결과는 `tests.log`; 시계 결함 수정 전 재현은 별도 `clock-before.log`로 남겼다. 테스트를 skip/삭제하여 통과시키지 않았다.

## 브라우저 회귀

실행 공통 환경:

```sh
npm run dev
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-scu-followup.mjs
```

| 스크립트 / 원시 로그 | 화면 | 검증 |
|---|---|---|
| [browser-scu-followup](logs/browser-followup.log) | 1440×1000,844×390,667×375,390×844 | 실제 UI 채굴, 현지 원광8U 봉인/개봉, 소재450/405/45Q, compact 패널, 현재 manifest 저장/훼손 거부, v3 원문 백업/이관/실패 원자성, 500일 시계, 초기화 |
| [browser-industry](logs/browser-industry.log) | 위4종 | 지도 마우스/터치, 구획 선택, 건설/생산/증설/개량, 뒤로/닫기, 카메라 격리, 수동 내보내기/복원 |
| [browser-cargo-scu](logs/browser-cargo.log) | PC,844×390 | 기존 합금/수소32SCU 견적, pending 비용, v2 원문/이관/차단 |
| [browser-resource-packaging](logs/browser-resource-packaging.log) | PC,844×390 | 실제19천체, 기존 수소 보관, v1 원문/이관/차단, 저장 초기화 |
| [browser-industry-safety](logs/browser-industry-safety.log) | PC,844×390 | 저장 차단/훼손, 자동 복원 없음 |
| [browser-development-reset](logs/browser-development-reset.log) | PC,844×390,390×844 및 차단 환경 | 최신92셀/인구·자원, 시험 채굴·제련·편집, 자동 읽기/쓰기0, 타 프로젝트 보존 |
| [browser-population-migration](logs/browser-population-migration.log) | PC,844×390,390×844 | 구인구 초안 자동 사용 금지, 최신8,893,000,000명, 보존된 수동 이관 분리 |

각 스크립트의 page error / console error **0**. 원광 실제 실행에는 브라우저 메모리에만 주입한 유료 테스트 규격(1 C/용기,1 kWh/용기)을 사용한다. 앱 기본 규격 C/전력 null은 새로고침 후 재검사한다. 전용 포장 폼이나 실제 배송 UI를 검증한 것으로 주장하지 않는다. 모바일은 Chromium touch emulation이며 실물 기기/iOS Safari는 미실시다.

667×375에서 봉인 주석 추가 후 3.09px 넘침을 발견해 플롯 및 재고 구분 여백4px을 줄였다. 패널 크기와40px 터치 버튼은 유지했다. 스크린샷을 실제 열어 육안으로 확인하고 패널/요약/텍스트 바운딩 박스를 검사한다. [전체 브라우저 데이터](browser-evidence.json), [PC](screenshots/ore-sealed-1440.png), [844](screenshots/ore-sealed-844.png), [667](screenshots/ore-sealed-667.png), [세로](screenshots/ore-sealed-390.png).

## 성능

ECON 재보정 없이 물리 연산 시간만 측정했다. 아래 두 값은 같은 `scripts/benchmark-scu-followup.mjs`를 archived PR12 dist와 현재 dist에 각각5회 실행한 평균이다. 브라우저/전체 테스트 실행을 끝낸 뒤 비교했다.

| 유휴500일 | PR12 평균 | 현재 평균 | 정산 중 전체 복제 |
|---|---:|---:|---:|
| 1계정 |17.799ms|19.049ms|양쪽0회|
| 19계정 |210.862ms|192.601ms|양쪽0회|

1계정은 약1.25ms 증가했고19계정은 약18.26ms 감소했다. 소수 반복의 환경/JIT 편차를 포함하며 모든 기기에서의 속도 향상을 주장하지 않는다. 매시간 원장 전체 복제를 추가하지 않았다는 계측/회귀 검증이 핵심이다. 수정 전 최초 측정은 [benchmark-before](benchmark-before.json), 동일 하네스 비교는 [before](benchmark-controlled-before.json)/[after](benchmark-controlled-after.json).

실제 채굴 원광5회 평균([JSON](benchmark-ore.json)):

| 원광 | 상자/그룹 | 견적 | 커밋 | 전체 개봉·검증 |
|---|---|---:|---:|---:|
|.001U|1/1|2.659ms|2.381ms|4.032ms|
|8U|1/1|1.311ms|1.812ms|2.934ms|
|500U|63/2|1.339ms|2.006ms|5.252ms|

기존 대량 견적 하네스도 새 결과 파일에 실행했다. 합금10¹²U →125,000,000,000개 컨테이너를 **그룹1개/DP288상태**로 견적하며 평균0.421ms. 127개 허용 조합 전체 최대288상태 ([JSON](benchmark-large-cargo.json)). 원광은 단일 출처별 full/partial 최대2그룹이다. 상자별 객체 배열을 생성하지 않는다.

## 파일 보존 / 독립 CI

`node scripts/verify-resource-unit-preservation.mjs`: [원시 로그](logs/preservation.log). 원본 manifest는 수정하지 않았다. 새 PR12 manifest의 정확한21개 기존 수정 경로 외 **712개** 파일 SHA256 일치, 이전 원본238개 공식/ECON 파일 일치, 원본 코드로 v1 6종/v2 5종/v3 5종 fixture 재구성 일치. 19천체/92셀/8,893,000,000명 및750.125일 산업 궤적 회귀를 유지한다.

GitHub Actions workflow가 저장소에 없어 별도 CI PASS는 확보하지 않았다. 위 결과는 실제 로컬 Node/Chromium 제출 로그이며 독립 CI 또는 실물 모바일 테스트로 표현하지 않는다. [환경/서버/CI 조회 증거](logs/environment-evidence.json)에는 Chromium154, HTTP응답3,896건/4xx·5xx0건, GitHub Actions 실행0건을 기록했다.

원시 Node assertion 로그의 들여쓰기/빈 줄 공백은 그대로 보존했다. 코드·문서 공백 검사는 `git diff --cached --check -- . ":(exclude)docs/resource-cargo-scu/followup-1/logs/*.log"`로 로그를 제외해 통과했다.
