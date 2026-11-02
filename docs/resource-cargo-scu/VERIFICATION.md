# RESOURCE-CARGO-2 검증 결과

실행일2026-11-01(한국 시간 기준). 기준 PR #11 `58b6b0c6d17e35988e3580cc247e11083b741d21`. Linux / Node24.19.0 / headless Chromium + SwiftShader / playwright-core, 로컬 정적 HTTP 서버에서 실행했다. ECON-SIM-4·가격/전력비 재보정·실제 배송은 실행하지 않았다.

## 자동 검사

| 검사 | 실제 결과 | 증거 |
|---|---|---|
| 기준 `npm run check` |65모듈 통과|[로그](logs/baseline-check.log)|
| 기준 `npm test` |321/321, 실패0/skip0|[로그](logs/baseline-tests.log)|
| 최종 `npm run check` |73모듈 통과|[로그](logs/check.log)|
| 최종 `npm test` |**367/367**, 실패0/skip0|[로그](logs/tests.log)|
| 신규 SCU/산업/물류 계약 검사 |46/46|[대상 검사 로그](logs/cargo-tests.log)|
| 보존 감사 |기존238개 해시/6개v1 궤적 + PR #11 파일673개 보호/5개v2 재현|[로그](logs/preservation.log)|
| 공백 검사 |`git diff --check` 통과|제출 전 실행|

신규 `cargo-scu.test.js`29개, `cargo-industry-logistics.test.js`17개다. 과거 공간 계약 테스트는 새 SCU 계약으로 바꾸고, 버전/격리 테스트도 새 요구에 맞게 조정했다. 기존 산업·경제 계산 검사를 삭제/skip하지 않았다.

검사 내용:

- 정확한 SCU 외부 치수/부피/표준 제작량, kg/U 유지, SCU/U와0.001U 경계,100SCU 한도, 통화/미정 자원/잘못된 규격 거부.
- **허용 크기의 모든127개 부분집합 ×1~32SCU 목표 =4,064건**에서 모든 정수 컨테이너 조합을 열거한 독립 결과와 목적값/SCU/개수를 비교. 자동 탐욕법이 놓치는48SCU의24×2 및15SCU 용량 제한도 검증.
- 합금8U+구조재0.450U의 별도 차감, 목적지8.405U/손실0.045U,4/8/16SCU 조합의 서로 다른 소재 부담, 실제 묶인 소재에만 회수.
- 부분 적재의 전체 컨테이너 비용, 정수 개봉과 현지 잔여 버퍼,1,000번0.001U 소비의 일괄 결과 일치, 회수 나머지·개수/재정/전력 장부.
- 부족 자원/전력/현금·미정 비용·수취 경로·손상 상태·위조/재사용/오래된 견적의 원자적 거부. 이미 포장된 화물과 일부 기존 화물을 중복 과금하지 않음. 복수 임의 소재 및 alloy로alloy 포장.
- 구세대/신세대 공존·구형 우선 개봉·현재 해금된 규격·재포장/예약/취소·시간 분할/JSON round-trip·과거 idle 시간 무상 지급 방지·필수 재고/순편익 대기.
- v2의 초기/건설/생산/일반 저장 전체 기존 필드 보존, v1·v2에서750.125일 기존 산업 결과 일치, 백업/primary 실패 때 격리만 보존, 반복 적용/fixture 재지급 방지, 손상된 저장 사전 차단.
- 실제 산업 재고에서 SCU 합금/수소 포장·개봉·소비의 전체 캠페인 보존, receiver 실패 때 산업 보관까지 부분 차감하지 않음, ore 물리 견적과 live lot 어댑터 보류.
- 실제 구형 격자 이웃/공급망, 최종 목적지/배송 ID 위조·인접 분할 회피 차단, inTransit 목적지 사전 반영 거부, 외부 도착 확인 없는 새 원장 인도 및 같은 확인의 재사용 거부.

## 보존

[manifest](preservation-manifest.json)는 PR #11의673개 파일 SHA-256과 변경을 허용한 **정확한16개 기존 파일 경로**를 기록한다. 새 모듈/새 문서는 별도다. 모든 경제 모델/설정/원시 결과/보고서/기존 공식 프리셋·인구·지질/정책, 과거 RESOURCE-UNIT-1 보고서/캡처는 보존했다. 미허용 기존 파일 변경은 감사에서 실패한다.

기존 감사의238개 공식/ECON 해시도 원래 f4bc5e4와 비교한다. 새 데이터로 해시나 경제 결과를 덮어쓴 것이 아니다. 이전v1 스냅샷6개는 원래f4bc5e4 runtime/initializer로 재현한다. v2 스냅샷5개는 원래 PR #11의 resource/spec/inventory/automation/industry/storage 모듈을 git에서 읽어 다시 생성한 결과와 비교한다. 파일 재생성/덮어쓰기는 하지 않는다.

이전의 전체 본체 동결 테스트가 허용한6개 원래 모듈 외 새 SCU 변경은 PR #11의 별도16경로 허용 목록에서 감시한다. 과거 ECON 계산·수치 판정·골든 경로 테스트는 그대로다. npm 기존 회귀 검사를 실행했지만 독립 ECON-SIM-4 탐색/장기 재검증·비용 보정은 하지 않았다. 이전 경제 입력 manifest는 그 당시 커밋의 기록이며 새 공유 런타임과 동일한 해시라고 주장하지 않는다.

## Chromium 실제 흐름

| 스크립트 | 실제 범위 / 결과 | 로그 |
|---|---|---|
| `browser-cargo-scu.mjs` |1440×1000/844×390. 실제 UI 확장 API에서 합금8U/수소4U 각각32SCU·합금450Q·null C/Wh·상태 불변, v2 미리보기/원문 백업/v3 적용/컨테이너 추가0/백업 거부/손상 재고/내보내기/새로고침. 통과|[로그](logs/browser-cargo-scu.log)|
| `browser-industry.mjs` |1440×1000/844×390/667×375/390×844. 실제 지도/터치/작은3영역 패널/건설/완공/생산/증설/개량/뒤로/닫기/파일. 통과|[로그](logs/browser-industry.log)|
| `browser-resource-packaging.mjs` |PC/모바일 가로, 기존v1의 정확한 원문 백업/현재v3 적용·반복·legacy 회수0·불러오기 거부/새로고침. 통과|[로그](logs/browser-resource-packaging.log)|
| `browser-industry-safety.mjs` |출처/재고 조작 거부, 명시적 확인, 현재v3 메모리 import의 저장 쓰기 차단 독립성, 구시험 키 제거/개발 조작 숨김. 통과|[로그](logs/browser-industry-safety.log)|
| `browser-development-reset.mjs` |PC/가로/세로, 최신92섹터/8,893,000,000명·지질/실제 광업·제련·편집, 새로고침/재지급, 다른 프로젝트 보존, 자동 읽기/쓰기0, 저장소 차단/삭제 실패. 통과|[로그](logs/browser-development-reset.log)|
| `browser-population-migration.mjs` |PC/가로/세로, 구인구/저장 폐기·최신 공식 데이터·시범 캠페인, 기존 허용 인구 서명 이관 격리. 통과|[로그](logs/browser-population-migration.log)|

여섯 스크립트 모두 page/console 오류0이다. 정적 모듈/공식 JSON 요청→실제 산업 상태→기존 U 패널, 명시적 JSON→strict 검증→백업→v3 활성화의 경계를 확인했다. API/DB 백엔드나 Vercel 배포를 쓰는 앱이 아니므로 해당 검사는 없다. 실제 Android/iOS 기기·Safari, 실제 항로/배송, 실제 발전망/포장 원가/ECON-SIM-4는 시험하지 않았다.

실제 화면:

- [PC 산업 패널](screenshots/scu-industry-1440.png), [844×390 산업 패널](screenshots/scu-industry-844.png)
- [PC 제련](screenshots/production-1440.png), [667×375 제련](screenshots/production-667.png), [390×844 제련](screenshots/production-390.png)
- [PC 임시 보관 설명](screenshots/compatibility-1440.png), [844×390 임시 보관 설명](screenshots/compatibility-844.png)

기존 레이아웃/재고 U를 유지하며 새로운 물류 UI를 추가하지 않았다. SCU는 `spacePrototype.industry.quoteCargo(...)` 확장 API에서 검증했다.

## 성능

[실측 JSON](benchmark.json), Node24.19.0/Linux, 각 물량20회. 결과는 벤치마크 당시 환경의 측정이며 모든 모바일 기기의 시간 보장은 아니다.

| 합금 U | SCU | 컨테이너 수 | 실제 집계 그룹 | DP상태 | 평균 ms |
|---:|---:|---:|---:|---:|---:|
|0.001|0.004|1|1|33|약0.30|
|8|32|1|1|64|약0.12|
|1,000|4,000|125|1|288|약0.25|
|1,000,000,000,000|4,000,000,000,000|125,000,000,000|1|288|약0.45|

마지막1조U 케이스 최대약0.70ms, 모든127개 허용 조합의 같은 대량 견적은 합계약10.8ms/최대288DP상태였다. 정확한 값은JSON에 있다. 컨테이너1250억 개 객체를 생성하지 않고 개수 한 건으로 집계한다. 벤치마크는 물리 조합 계산이며 경제 시뮬레이션이 아니다.

## 재현

```bash
npm run check
npm test
node scripts/verify-resource-unit-preservation.mjs
node scripts/benchmark-cargo-scu.mjs
npm run dev
```

브라우저는 별도 서버와 Playwright/Chromium을 준비한 뒤 실행한다. 이번 환경:

```bash
export PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs
export CHROMIUM_EXECUTABLE=/usr/bin/chromium
node tests/browser-cargo-scu.mjs
node tests/browser-industry.mjs
node tests/browser-resource-packaging.mjs
node tests/browser-industry-safety.mjs
node tests/browser-development-reset.mjs
node tests/browser-population-migration.mjs
```

기본 BASE_URL은 `http://127.0.0.1:5173`이다. DEV 산업 개발 시나리오에서 기존 시설을 건설하고 생산을 시험한다. 새 화물 화면/실제 배송 명령은 없다.
