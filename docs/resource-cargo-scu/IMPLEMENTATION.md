# RESOURCE-CARGO-2 / SCU PACKAGING-2 구현 계약

기준 PR #11 `58b6b0c6d17e35988e3580cc247e11083b741d21`, 별도 브랜치 `feat/resource-cargo-scu-packaging`. [지시서](REQUEST_KO.md)의 새 공간 계약이 이전 RESOURCE-UNIT-1보다 우선한다. ECON-SIM-4·C/전력비 보정·실제 배송은 구현하지 않는다.

## 1. 대체되는 계약

| 과거 계약 / 역사 문서 | 이번 계약 |
|---|---|
| 모든 자원1U=화물/보관1U | U는 자원량. 공간은 자원별 SCU/U와 실제 컨테이너 외형 SCU |
| `cargoUnitsPerU===1`, `cargoQuantityU` | `cargoSCUPerU`, `resourceCargoSCU`, `quoteCargoSCU`; 구 함수는 명시 오류를 내는 폐기 API |
| 벌크 자원은 포장 불가 | 일반 산업 벌크 재고는 유지하고 장거리 준비 시 SCU 컨테이너 포장 가능 |
| 수소만 패키징 | 모든 물질의 SCU 운송 포장 지원. 수소 산업용 보관/극저온 요구는 별도 |
| 내용물 U에 비례한 포장재 회수 | SCU 컨테이너는 실제 개봉한 **정수 개수**의 전체 소재를 회수 |
| 수소8SCU당 합금0.05U라는 과거 설명 후보 | 표준8SCU 컨테이너는 합금0.160U. 과거 per-U 레시피 테스트는 역사적 산업 보관 회귀용이며 SCU 레시피가 아님 |

기존 `docs/resource-unit-packaging/`는 이전 커밋의 역사 기록으로 보존한다. 새 게임 공간 정의는 이 문서와 `docs/resource-cargo-scu/`를 따른다.

## 2. 자원 / 외형 / 제작 소재

| 자원 | 내용물 kg/U | SCU/U | 비고 |
|---|---:|---:|---|
| ore |10,000|4|잠정 벌크 물류 기준, 원광 종류별 내부 체적 인증 아님|
| alloy |10,000|4|여러 산업용 금속을 통합한 추상 자원|
| hydrogen |500|8|극저온 보관/단열/구조를 포함한 외형 공간|
| residue / 미등록 특수 자원 |null/미정|null/미정|추정하지 않으며 실제 화물 견적 거부|
| credits |해당 없음|해당 없음|화폐 C, 포장/화물 제외|

`1SCU=1.953125m³`는 정확한 외부 부피다. 내부 유효 공간100%, 하중/가속·구조 강도 인증을 뜻하지 않는다. 실제 화물 질량은 내용물+기록된 묶인 소재만 합산한다. 별도의 무질량 냉각 장치나 미정 특수 소재 질량을 만들어 넣지 않는다.

| SCU | 치수 m | 합금 Q/개 | 합금 U/개 | 회수율 |
|---:|---|---:|---:|---:|
|1|1.25×1.25×1.25|25|0.025|90%|
|2|2.5×1.25×1.25|45|0.045|90%|
|4|2.5×2.5×1.25|85|0.085|90%|
|8|2.5×2.5×2.5|160|0.160|90%|
|16|5×2.5×2.5|270|0.270|90%|
|24|7.5×2.5×2.5|370|0.370|90%|
|32|10×2.5×2.5|450|0.450|90%|

`STANDARD_CONTAINERS` / `ContainerRegistry`에 불변 규격 ID로 등록한다. 초기 ID는 `standard-<size>scu-gen1`이다. 기본 직접 C/전력은 null이다. 극저온/특수 보관 추가 `materialInputs` 및 직접 C/전력도 데이터로 확장한다. 현재 확정된 추가 특수 소재는 없으며 특수 C/전력은 null이다.

컨테이너 소재는 자유 bulk 자원의 배열이다. 내용물 합금과 구조재 합금을 별도 차감하므로 자기 내용물 포장이 가능하다. 반면 소재 입력 자체를 다시 패키징해야 하는 재귀/중첩 포장은 거부한다. 중복 소재·미등록/미정 물리 자원·상충 회수율·잘못된 치수/크기·음수·불변 ID 재발급을 거부한다.

## 3. 모듈과 두 패키징 도메인

- `resource-definitions.js`: 물리 질량, SCU/U, 엄격한 자원 등록과 SCU 용량 API. `TONNES_PER_RESOURCE_U=10`은 원래 광석/합금 및 동결된 ECON의 역사적 기준으로 유지한다.
- `packaging-common.js`: 불변 데이터·정수·안전 곱셈·정밀도 공통 검사.
- `container-specs.js`: 내용물과 독립된 컨테이너 외형/세대/소재/비용/특수 보관 정의. `packaging-specs.js`가 이를 export하고 기존 `PackageRegistry.containers`에 연결한다.
- `cargo-scu.js`: 순수 공간/조합/소재/회수/비용 상태 견적.
- `container-state.js`: 규격/내용물/적재량별 묶음, 실제 개수·소재·회수 나머지·현지 버퍼·예약의 검증.
- `container-inventory.js`: 포장/재사용/개봉/소비/재포장 및 도착 확인에 따른 원장 인도 정산.
- `container-automation.js`: 기술 현대화 큐. `packaging-automation.js`에서 명시적인 SCU 이름으로 export한다.
- `cargo-logistics-contract.js`: 실제 구형 격자의 인접 공급망/최종 목적지/배송 신원/운송 중 보관 경계에 대한 순수 계약. 이동 엔진 아님.
- `industry-packaging.js`: U 합계 캐시, 실제 산업 재고와 SCU 준비/개봉/소비 연결. `industry-ui.js`의 `quoteCargo`는 미래 상세 UI용 읽기 API이며 새 물류 화면은 없다.

기존 per-U `quotePack`/산업 보관 레시피/legacy 수소는 산업용 보관 도메인으로 남긴다. 이를 SCU 운송 컨테이너로 인정하지 않는다. 장거리 컨테이너에는 아래의 명시적인 `quoteContainer*` API를 사용한다.

## 4. 순수 SCU / 자동 조합 API

```js
resourceCargoSCU('alloy',8);       // 32SCU
resourceCargoSCU('hydrogen',4);    // 32SCU
quoteCargoSCU([
  {resourceId:'alloy',quantityU:8},
  {resourceId:'hydrogen',quantityU:4},
  {resourceId:'ore',quantityU:9}
],{capacitySCU:100});             // 100SCU, 초과 시 오류
quoteContainerPlan('alloy',8000,registry,{
  ownerId:'human', allowedContainerSizes:[1,2,4,8,16,24,32],
  availableContainerSpecs:null, capacitySCU:100
}); // Q 입력. 32SCU×1 / 소재450Q / 회수405Q / 손실45Q
```

`quoteCargoSCU`는 내용물에 필요한 공간, `quoteContainerPlan`은 실제 **부분 적재 컨테이너의 전체 외형**까지 계산한다. 반환은 `requiredSCU`, `occupiedSCU`, `wasteSCU`, `containerCount`, 규격별 `combinations`/적재 `groups`, `materialQ`, 예상 회수/손실/잔여, C/Wh 및 `pendingCosts`다. 미정 비용은 null과 `status:'pending-cost-input'`, 실행 불가로 표시한다. `0`은 명시한 값 또는 이미 지불한 컨테이너의 추가 제작이 없는 재사용 결과에서만 발생한다.

기본 목표는 소재 Q의 가중합 최소 → 외형 SCU/낭비 최소 → 컨테이너 수 최소 → 안정적인 규격 순서다. `materialWeights`의 기본값1은 소재량 비교 기준이며 시장가격이 아니다. C/전력/운임을 포함한 완전한 비용 최적화를 주장하지 않는다. 미래 `objectivePolicy:{id,scoreContainer}` 순수 주입 훅으로 승인된 비용 목적함수를 연결할 수 있다. 그 경우에도 null C/전력을 무료로 실행하지 않는다. 영속 큐의 사용자 정의 함수 저장/정책 레지스트리는 후속이며 현재 해당 큐 요청은 거부한다.

작은 물량은 정수 적재 용량의 정확한 DP를 쓴다. 큰 물량은 최소 소재/용량 비율의 기준 규격과 나머지 DP로 집계한다. 비기준 규격을 일정 개수 이상 쓰면 동일 용량의 기준 규격으로 교환할 수 있다는 경계로 잔여 탐색량을 제한한다. 따라서 큰 것부터 넣는 탐욕법이 아니며, 예를 들어48SCU에24/32만 허용하면24×2의740Q를32×2의900Q보다 우선한다.15SCU 한도에서는16SCU 최저 소재 선택을 포기하고 실제 맞는15SCU 조합을 찾는다.

현재4/8SCU/U와 표준 크기는 정확하게 처리한다. 미래 비정상적으로 세분된 SCU/U 때문에 DP 경계가250,000상태를 넘거나 정수 Q/외형 SCU에 별도 다차원 최적화가 필요하면 명시적으로 거부한다. 불완전한 근사를 최적이라고 반환하지 않는다.

## 5. 원자적 포장 / 개봉 / 회수

```js
const request={bodyId:'earth',ownerId:'human',resourceId:'alloy',amountQ:8000};
const quote=quoteContainerPack(book,registry,request);
// 기본 공식 레시피는 비용 null이므로 quote.allowed=false.
// 테스트에서만 별도 ID에 C/Wh와 실제 자유 재고를 명시 제공한다.
if(quote.allowed)commitContainerPack(book,quote);
```

견적은 원장을 바꾸지 않으며 실행은 불투명 견적 토큰과 원장/규격/해금 결과를 재확인한다. 위조·수정·오래된 견적·재사용은 거부한다. 미정 비용·내용물/소재·C/Wh 부족·수취 경로 실패는 전체 상태를 유지한다. 입력이 손상된 원장인지 먼저 검사하여 개봉으로 손상 필드를 지우는 우회도 차단한다.

- 합금8U를32SCU 한 개에 포장하면 **내용물8,000Q + 구조재450Q**를 같은 자유 합금에서 별도 차감한다. `contents=fillQ×count`, `bondedMaterialsQ.alloy=450`을 따로 보존한다.
- 컨테이너는 `resourceId|containerSpecId|fillQ`별 개수로 묶는다. 같은 규격/적재량을 병합하고 대부분 규격마다 가득 찬 묶음+마지막 부분 묶음만 존재한다. 개별 일련번호/빈 컨테이너 재고는 없다.
- `quoteContainerUnpack`/`unpackContainerResource`: 실제 개봉한 전체 컨테이너의 내용물과 소재 회수를 반영한다. 합금8U+회수0.405U, 손실0.045U다.
- `consumeContainerResource`: 요청량만 실제 소비하되 개봉은 정수 개수다. 남은 내용물은 `scu.openedQ`의 현지 버퍼로 남아 연속 소비한다. 이미 개봉된 버퍼를 먼저 쓰므로0.001U 반복 소비 때마다 새 컨테이너를 열거나 소재를 비례 생성하지 않는다.
- 수소/특수 보관 자원은 `configureContainerReceiver`로 연결한 실제 소비자/탱크/배관의 binding과 유한 용량을 요구한다. 필요한 잔여 보관이 없으면 실패한다. 일반 free hydrogen으로 풀지 않는다. 구형 산업 보관 API의 무조건 `unpack:true`도 금지했다.
- 회수 나머지는 소유자·규격·소재별 정수 누계로 저장한다.1SCU25Q의90%=22.5Q에서 우선22Q/나머지0.5Q를 기록하고 다음 개봉과 합산한다. 같은 계정/규격에서 반복과 일괄 소비의 회수·손실·나머지가 일치한다. 서로 다른 소비자 사이에 이미 개봉한 소재의 소수 회수 권리를 임의 이동하지 않는다.
- `quoteContainerRepackage`/`commitContainerRepackage`: 실제 구형 소재를 회수하고 신형 소재·C/Wh를 다시 지불하며 내용물을 보존한다. 기술 해금만으로 기존 소재/회수율을 소급 변경하지 않는다.

기존 규격으로 이미 운송 가능한 컨테이너는 재사용한다. 일부 기존 화물만 있으면 그 부분을 쓰고 부족한 내용물만 새로 포장한다. 원래 legacy 수소는 컨테이너가 아니므로 새 포장이 필요하지만 과거 묶인 소재는0이고 가짜 회수도0이다. 기본 게임의 SCU 비용이 null인 동안 이를 무료 유료 컨테이너로 바꿀 수 없다.

원장 보존식은 자원별 `자유+산업 보관+컨테이너 내용물+묶인 소재+현지 버퍼+실제 소비+손실 = 초기+명시 공급+이전 유입−유출`이다. 현금/전력, 제작/이전/개봉 개수, 규격별 실제 소재 및 회수 잔여도 별도 대조한다. 포장 소재는 외형 SCU를 이중 점유하지 않으며 질량에는 포함한다.

## 6. 자동 조합과 기술 현대화의 분리

새 수송 준비의 자동 조합은 `quoteContainerPlan`이다. 구세대 현대화는 별도 `configureContainerAutomation` / `reserveContainerRepackageJob` / `advanceContainerQueue` / `cancelContainerRepackageJob` / `planContainerModernization`이다.

현대화는 기본ON이지만 비용·설비 SCU/시간·처리 묶음·선행 소비·순편익·여유 자원이 없으면 보류한다. 실제 정수 컨테이너를 escrow에 예약하고 보수적인 소재/예산을 보호한다. 요청된 실제 처리 SCU를 완료해야만 재포장을 확정한다. 부분 진행 중 취소하면 같은 구형 실물과 소재가 돌아오며 아직 회수/과금하지 않는다. 새 설비를 늦게 연결해도 과거 idle 시간을 공짜 처리량으로 지급하지 않는다. 산업의 같은 시계에 연결하되 기본 처리 능력은 null이다.

## 7. 미래 물류 경계와 현재 산업

`requiresSCUPackaging`은 같은 섹터는 면제, 실제 구형 격자의1링 이웃이면서 연결된 공급망만 면제한다. 원래 출발지/최종 목적지 기준이며2링 이상/다른 천체는 필수다. `ShipmentContractRegistry`는 동일 배송 ID의 끝점 변경을 막고, 각 leg를 넣어도 원래 장거리 계약은 면제되지 않는다. 인접 면제는 운송 시간·연료·운임 면제가 아니다.

`assertDeliveryBoundary`는 planned/origin, in-transit/shipment, delivered/destination의 차감·인도 경계를 검사한다. 실제 dispatch/항로/도착 처리는 없다. 기존 `transferPackagedResource`는 역사적 원장 도구로 남고 UI에 배송으로 노출하지 않는다. 새 `transferContainerGroups`는 **외부 공급자의 일치하는 delivered 확인** 없으면 실행을 거부한다. 참조 재사용도 막는다. 테스트는 가상 도착 공급자를 주입하며 실제 게임에는 그 공급자가 없다. 원장 정산을 무료 순간 배송이라고 부르지 않는다.

일반 산업 생산은 계속 벌크 U와 수소 산업 보관을 사용하며 자동 컨테이너 제작을 하지 않는다. 산업 U 합계 캐시는 실제 자유/보관/SCU 내용물/현지 버퍼/예약에서 파생된다. 건설에는 자유/가용 소재만 사용한다. 수소의 기존 산업 보관과 SCU 컨테이너는 중복 소재를 부과하지 않는다. 광석은 모든 물리/레시피 견적을 지원하지만 live 산업 운송 포장은 **품질 lot 어댑터 미연결**로 보류한다. 기존 lot을 generic free ore로 복제하지 않는다.

포장 직접 C/Wh 및 특수 보관 추가 C/Wh는 명시된 입력만 다룬다. 실제 운송·하역 서비스·계속되는 냉각/보관의 비용 모델은 구현하지 않았으며 무료라고 확정한 것이 아니다. 현재 기본 비용 null 때문에 정식 SCU 거래 자체가 보류된다. 후속 비용 경계는 ECON-SIM-4/물류 공급자와 연결해야 한다.
