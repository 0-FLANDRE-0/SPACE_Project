# RESOURCE-UNIT-1 / PACKAGING-1 검증

실행일2026-11-01. 기준 `f4bc5e46ad8952b8f6eb981692b32ef94ee1fc08`. Node24.19.0 / Linux / Chromium headless + SwiftShader / playwright-core. 로컬 정적 HTTP 서버를 사용했으며 외부 배포·ECON-SIM-4 탐색은 실행하지 않았다.

## 자동 검증

| 검사 | 실제 결과 | 증거 |
|---|---|---|
| 기준 `npm run check` |60모듈 통과 |[baseline-check.log](logs/baseline-check.log)|
| 기준 `npm test` |276/276, 실패0/skip0 |[baseline-tests.log](logs/baseline-tests.log)|
| 최종 `npm run check` |65모듈 통과 |[check.log](logs/check.log)|
| 최종 `npm test` |**321/321**, 실패0/skip0 |[tests.log](logs/tests.log)|
| 동결 파일 감사 |238개 현재/원래 git SHA-256 일치 |[preservation.log](logs/preservation.log)|
| 원래 v1 상태 재현 |6/6 스냅샷 전체 필드 일치 |동일 preservation.log 및 [provenance](../../tests/fixtures/resource-packaging-provenance.json)|
| 공백 오류 |`git diff --check` 통과 |제출 전 실행|

신규 단위/통합 검사45개는 `resource-units-packaging.test.js`23개와 `industry-packaging.test.js`22개다. 자원 질량/단일 공간, 정수 Q 경계,100UH 실제5U 소재 차감 및4.5U 회수/0.5U 손실, 명시 C/전력, 임의 다른 내용물+신규 소재2종, 회수0/1/중간값,1,000회 미량 거래, 묶음 병합, 부분 소비, 견적 재사용/위조/오래된 상태, 부족 시 완전 불변, 여러 세대/해금, 계정 이전/회수 현지 귀속을 검사한다.

큐는 실제 소재/예산 예약, 필수 자유 재고 보호, 부분 진행/취소, 동일 시간 분할, JSON round-trip, 미정 비용/예측/설비의 대기, 예약 변조, 단일 처리 라인, 과거 idle 시간의 무상 처리 방지를 검사한다. 저장은 진짜 v1의 정확한 이관/기존 산업 궤적, 반복 import와 재지급 방지, 정상/fixture 분리, 손상 필드/서명/합계 차단, 백업 및 primary 쓰기 실패, 충돌 시 양쪽 원문 보존, 격리, transient 초기화를 검사한다. 새 v2에서 음수 국고 상계 위조·민간 원광 조작·품질 lot 우회도 거부한다.

## Chromium 실제 사용자 흐름

| 스크립트 | 범위와 결과 | 로그 |
|---|---|---|
| `browser-resource-packaging.mjs` |1440×1000 /844×390. 실제19천체, 임시 호환 UI, v1 미리보기/원문 백업/수동 적용/반복 적용, legacy 회수0, v2 다운로드/재적용, 백업 거부 시 기존 상태 보존, 손상 서명, 새로고침 초기화 및 백업/타 프로젝트 보존. 통과 |[로그](logs/browser-resource-packaging.log)|
| `browser-industry.mjs` |1440×1000 /844×390 /667×375 /390×844. 실제 지도/터치, compact3영역, 건설/완공/생산/증설/개량, 수소 자동/해제, 뒤로/닫기, JSON export/import. 통과 |[로그](logs/browser-industry.log)|
| `browser-industry-safety.mjs` |엄격한 import/확인, 원천 조작 거부, v2 메모리 import의 저장 쓰기 장애 독립성, 손상된 구시험키 제거, 일반 모드 개발 조작 숨김. 통과 |[로그](logs/browser-industry-safety.log)|
| `browser-development-reset.mjs` |PC/모바일 가로/세로, 공식92섹터/8,893,000,000명/지질, 현행 광업·제련·편집, 새로고침 초기화, 시험 재고 재지급, 타 프로젝트 보존, 자동 읽기/쓰기0, 저장소 차단/삭제 실패. 통과 |[로그](logs/browser-development-reset.log)|
| `browser-population-migration.mjs` |PC/모바일 가로/세로, 구인구 초안/시험 캠페인 폐기, 최신 공식 인구와 시험 캠페인, legacy 이관 격리, 알 수 없는 구시험 상태 차단. 통과 |[로그](logs/browser-population-migration.log)|

다섯 스크립트 모두 page/console 오류0을 확인했다. 정적 서버→모듈/공식 JSON→실제 산업 상태→표시 및 수동 JSON→엄격 검증→백업→활성화 흐름을 확인했다. 별도 API/DB를 사용하는 앱이 아니므로 해당 서버 경계는 없다. 자원/산업 UI 변경은 기존 패널 내부 문구에 한정하며 지도/카메라 동작과 모바일 패널의 기존 크기 제한을 유지한다. 실제 Android/iOS 기기의 브라우저 또는 Safari 실행은 하지 않았다.

## 실제 스크린샷

- [PC 미가격화 호환 설명](screenshots/compatibility-1440.png)
- [844×390 임시 호환 문구와 노출된 지도](screenshots/compatibility-844.png)
- [PC 제련 및 행성 재고](screenshots/production-1440.png)
- [667×375 제련](screenshots/production-667.png)
- [390×844 제련](screenshots/production-390.png)

위 이미지는 실제 테스트 화면이다. 모바일에서 설명 영역 내부를 스크롤해도 나머지 지도와 우측 구획/재고가 남는 것을 확인했다. 재고 표시는 기존처럼 U 합계다.

## 재현 명령

```bash
npm run check
npm test
node scripts/verify-resource-unit-preservation.mjs
# 별도 터미널
npm run dev
```

브라우저 스크립트는 Playwright 또는 playwright-core와 Chromium을 준비한 뒤 실행한다. 이번 환경에서 사용한 설정은 다음과 같다.

```bash
export PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs
export CHROMIUM_EXECUTABLE=/usr/bin/chromium
node tests/browser-resource-packaging.mjs
node tests/browser-industry.mjs
node tests/browser-industry-safety.mjs
node tests/browser-development-reset.mjs
node tests/browser-population-migration.mjs
```

`BASE_URL` 미지정 시 `http://127.0.0.1:5173`을 사용한다. 실제 열기: `http://localhost:5173/?dev=1`. DEV의 산업 개발 시나리오에서 정부 구획을 선택해 광업/제련을 지시하고 전략 배속으로 진행할 수 있다. 저장/불러오기는 파일 메뉴의 명시 조작이며 자동 저장은 없다.

## 보존 검사 갱신의 이유와 범위

이전 ECON1/2 작업의 두 테스트는 **기존 dist 전체 바이트 동결**을 요구했다. 이번 사용자가 산업/저장/자원 모듈 변경을 명시적으로 요청했으므로 그 조건과 충돌했다. 두 테스트의 마지막 전체 파일 보존 assertion만 `tests/helpers/resource-foundation-preservation.js`의 정확한6개 본체 모듈/2개 테스트 파일 목록을 제외하도록 바꿨다. 나머지 원본 게임 파일은 계속 비교한다. 경제 계산/해시/판정 테스트는 수정/삭제/skip하지 않았다.

추가 검사는 원래 git의 두 ECON 테스트에서 해당 보존 assertion과 helper import만 제거한 텍스트가 현재와 **정확히 동일**함을 확인한다. 별도로238개 공식 데이터/경제 모델·스크립트·설정·원시 결과·보고서·브라우저/미변경 테스트를 현재와 기준 git 양쪽의 SHA-256으로 검사한다. 보호 manifest의 기존 해시를 새 경제 결과로 갱신한 것이 아니다.

기존 npm 회귀 테스트에 포함된 경제 모델 단위/골든 검사는 실행했지만 독립적인 ECON-SIM-4 구현/20년 경제 재검증·탐색·가격 재보정은 실행하지 않았다. 과거 ECON3 입력 manifest가 가리키는 공유 런타임/자원 파일 해시는 **그 당시 커밋의 기록**이며 이번 새 커밋의 해시라고 주장하지 않는다.
