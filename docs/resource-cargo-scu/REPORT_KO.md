# RESOURCE-CARGO-2 / SCU PACKAGING-2 구현 보고

PR #11의 최신 HEAD가 `58b6b0c6d17e35988e3580cc247e11083b741d21`임을 작업 전과 제출 전 확인하고 별도 `feat/resource-cargo-scu-packaging` 브랜치에서 구현했다. 기존 PR/main은 수정·병합하지 않는다. 최종 PR/커밋 링크는 제출 메시지에서 제공한다.

**U 자원량과 SCU 공간을 분리했다. 포장 C/전력비 보정·ECON-SIM-4·실제 함선/섹터 배송은 구현/실행하지 않았다. 미정 비용은 null로 유지한다.**

## 1. 실제 변경 파일

| 파일 | 변경 |
|---|---|
| `dist/src/resource-definitions.js` |ore/alloy4SCU/U,H8SCU/U, 미정은null. SCU 전용 용량 API. 구U 공간 API를 명시 폐기 |
| `dist/src/packaging-common.js` 신규 |불변 데이터/정수/안전 곱셈/정밀도 공통 검사 |
| `dist/src/container-specs.js` 신규 |7개 외형 규격, 정식 구조재 표/90% 회수, 독립 세대·해금·특수 보관/C/전력 경계 |
| `dist/src/packaging-specs.js` |산업 보관과 SCU 컨테이너를 분리한 레지스트리/export |
| `dist/src/cargo-scu.js` 신규 |순수 SCU/부분 적재/소재/예상 회수/비용 상태, 정확한 자동 조합·큰 물량 집계·미래 목적함수 훅 |
| `dist/src/container-state.js` 신규 |실제 개수·적재·묶인 소재·현지 잔여·회수 나머지·예약·인도 참조의 strict 검증 |
| `dist/src/container-inventory.js` 신규 |견적/커밋, 동종 내용물+소재 차감, 정수 개봉/소비, 재사용/재포장, receiver, 외부 도착 확인 원장 정산 |
| `dist/src/packaging-inventory.js` |book2/SCU 계정, 전체 물질·비용·질량 보존과 산업 보관 합계 연결, 무제한 수소 free 언패키징 차단 |
| `dist/src/container-automation.js` 신규 |자동 현대화 예약/처리 SCU·시간/취소/보호·예측·순편익 대기 |
| `dist/src/packaging-automation.js` |SCU 현대화 API 명시 export, 기존 산업 보관 회귀 유지 |
| `dist/src/cargo-logistics-contract.js` 신규 |실제 격자 인접/공급망 면제, 최종 목적지/배송 ID/운송 중 보관 경계 순수 계약 |
| `dist/src/industry-packaging.js` |실제 산업 U 캐시/SCU 포장·개봉·소비·큐/quote 연결. ore lot 미연결 명시 보류 |
| `dist/src/industry-runtime.js` |산업schema3, 컨테이너 해금 주입. 기존 시설/생산/U 계약 유지 |
| `dist/src/industry-storage-v2.js` 신규 |PR #11의 strict v2 검증 보존 |
| `dist/src/industry-storage.js` |v2→v3, v1→v3, 원문 보존/격리. 실패한 캠페인은quarantinedState만 보존 |
| `dist/src/earth-population-update.js` |기존 허용 인구 서명 이관에v3 추가. 공식 인구 데이터는 변경 없음 |
| `dist/src/industry-ui.js` |기존 U/레이아웃 유지, quoteCargo 확장 API와v1/v2 수동 이관 안내 |
| `tests/cargo-scu.test.js`, `tests/cargo-industry-logistics.test.js` 신규 |SCU/자원 보존/정수 개봉/조합/자동화/이관/산업/물류 경계46개 검사 |
| `tests/browser-cargo-scu.mjs` 신규 |실제19천체의 SCU 확장 API/v2 원문 백업/v3 활성화/초기화 |
| 기존 resource-units/industry-packaging/industry/earth-population 테스트 및 browser-resource-packaging |폐기된 공간/현재 버전/격리 계약을 갱신. 기존 계산 검사는 유지 |
| `tests/fixtures/industry-v2-*.json` 신규5개 |실제 PR #11 v2의 초기/건설/생산/일반/19천체 저장 자료 |
| `scripts/verify-resource-unit-preservation.mjs` |기존 감사 유지+정확한 변경 허용 목록/PR #11 전체 보존/구v2 재현 |
| `scripts/benchmark-cargo-scu.mjs` 신규 |경제 모델 없이 순수 조합 성능 측정 |
| `docs/resource-cargo-scu/`, `docs/DECISIONS.md` |새 계약/스키마/본 보고/검증/미정·후속/기존 전제 대체표/로그/실측/캡처 |

## 2. 실제 작동하는 부분

**공간/소재 데이터:**1SCU=1.953125m³,1/2/4/8/16/24/32SCU, 합금25/45/85/160/270/370/450Q/개,90% 회수를 적용했다. 광석/합금10,000kg/U, 수소500kg/U와 모든 기존 U 수량은 유지했다. 합금은 여러 산업용 금속을 합친 추상 자원이다.

**원장 거래:** 명시적으로 확정된 테스트 C/Wh와 실제 재고를 제공하면 포장/소비/개봉/회수/재포장/예약/취소가 동작한다. 합금 내용물8U를32SCU에 포장할 때8.450U 차감, 수취 개봉8.405U, 손실0.045U를 확인했다. 소재는 실제 개수에 묶고 개봉된 정수 컨테이너만 회수한다. 일부 소비의 잔여는 현지 버퍼에 두어 연속 소비하며 수소는 유한한 합법적 receiver를 요구한다.

**중복 방지:** 이미 적합한 컨테이너는 추가 제작/과금하지 않고 일부만 있으면 부족분만 새로 포장한다. 전체 조합은 새것/재사용 개수와 실제 점유/예상 묶인 소재·회수를 함께 반환하며 새 소재 차감과 구소재 회수를 구분한다. 견적 위조/수정/재사용·원격 회수·미도착/중복 인도·부족 자원 중간 차감을 거부한다. 빈 컨테이너 자산/일련번호는 없다.

**세대/자동화:** 구형과 신형은 공존하고 구형부터 개봉한다. 해금 즉시 재고/소재가 바뀌지 않는다. 현대화는 실제 escrow/소재·C·Wh 예약, 처리 SCU/시간과 소비 예측/순편익/필수 자원을 요구한다. 기본ON이지만 미정이면 대기한다.

**현행 산업/저장:** 기존 산업 보관과 새 컨테이너 원장은 같은 물질·비용 장부와 U 캐시에 연결했다. 수소 생산/소비/제련/건설/원광 품질 lot/원천/시계는 보존한다. v1/v2는 strict 검증 후 빈 SCU 도메인만 추가해v3에 연결한다. 실제 원문 백업/반복 이관/fixture 격리/새로고침 초기화와 저장소 차단을 확인했다. 실패한 이관은 정상state에 노출하지 않는다.

## 3. 현재 순수 견적/계약에 한정된 부분

- 모든 확정 자원에 대한 물리 SCU/컨테이너/소재/예상 회수 견적. 현재 기본 비용은 미정이므로 **견적을 내도 실행 보류**다.
- 실제 구형 격자에 기반한 같은 섹터/인접 연결 면제, 원래 출발지·최종 목적지, 동일 배송 ID와inTransit 경계. 실제 이동 처리는 없다.
- UI의 `spacePrototype.industry.quoteCargo` 확장 API. 기존 패널/재고 U와 모바일 크기를 유지하고 새 컨테이너 관리 화면을 만들지 않았다.
- ore의4SCU/U 물리 견적은 가능하지만 실제 산업 포장은 품질 lot 어댑터가 없어 명시 보류한다. generic free ore로 lot을 잃지 않는다.

## 4. 의도적으로 미정인 부분

컨테이너 직접 C/Wh, 극저온 추가 C/Wh, 별도 하역/계속되는 냉각·보관 비용, 추가 특수 소재, 실제 처리 설비 능력/소비 예측/순편익, 수소 가격, residue/물/산소/특수 자원의 물리 규격은 확정하지 않았다. null을0으로 바꾸지 않았다.

기본 게임 수소는 과거 소재0/회수0인 `hydrogen-legacy-unpriced-v1` 산업 보관이다. 이를 유료8SCU 컨테이너로 간주하지 않는다. 새로운 구조재 표는 적용했지만 기본 포장 C/전력이 null인 동안 정식 SCU 컨테이너를 무료로 만들 수 없다. 테스트용 C/Wh/receiver/도착 공급자는 공식 비용이나 실제 설비가 아니다.

## 5. 후속 연결

실제 함선·sector 배송의 출발 차감/운송 중 보관/도착 인도·권한·공급망·receiver, 창고/함선 한도·하중/3D 적재, 원광 lot 운송, 연구 해금 및 민간 금융, 승인 비용 목적함수/설비는 후속이다. 새 컨테이너의 원장 인도는 외부 delivered 확인이 있어야 하며 실제 게임에 배송 공급자를 구현하지 않았다.

최적화 훅은 제공하지만 C/Wh/운임까지 포함한 완전한 경제 최적화는 아니다. 실제 원가/가격과 ECON-SIM-4 탐색·재보정은 하지 않았다. 과거 ECON3의 물9U→수소1U+산소8U 문제도 유지한다. 수소1U500kg 기준 물약4,500kg→수소500kg+산소약4,000kg이며 물/산소 U와 공정/포장 비용 분리가 후속이다.

## 6. 검증과 성능

- `npm run check`:73모듈 통과.
- `npm test`:**367/367**, 실패0/skip0. 기준321개+신규46개.
- 허용 크기127개 부분집합×1~32SCU 목표4,064건을 전 조합 열거와 비교했다.32SCU당 소재450/540/640/680Q,24+8의530Q와 실제 손실·회수, 부분 적재/정수 개봉/1,000회 미량 소비를 확인했다.
- 기존238개 공식/ECON 해시, PR #11의673개 기존 파일, 원래6개v1 및5개v2 상태 재현을 통과했다.16개 기존 파일의 정확한 허용 목록만 바꾼다. 공식 프리셋·인구·지질·시설 정책·ECON1/2/3 소스/원시 결과를 보존했다.
- Chromium 관련6개 스크립트 통과, PC/844×390/667×375/390×844에서 기존 지도·터치·패널·산업을 확인했고 새 SCU 견적과v2→v3 파일 흐름도 확인했다. page/console 오류0.
- 합금1조U/4조SCU/컨테이너1250억 개도 **그룹1개·DP288상태**,20회 평균약0.45ms/최대약0.70ms였다. 모든127개 허용 집합의 같은 대량 견적은 합계약10.8ms였다. 실제 환경 실측이며 모바일 전기종 보장은 아니다.

현재 실패/skip은 없다. 실제 Android/iOS 하드웨어/Safari·실제 배송·실제 원가/전력망은 시험하지 않았다. 미래 비표준 SCU/U의 다차원/과도한 DP는 명시 거부하며 아직 모든 미래 자원에 대한 최적화 인증이 아니다.

자세한 [API/계약](IMPLEMENTATION.md), [저장 schema](SAVE_SCHEMA.md), [검증 명령·로그·캡처·실측](VERIFICATION.md), [미정/후속](FOLLOW_UP.md)를 함께 제공한다.
