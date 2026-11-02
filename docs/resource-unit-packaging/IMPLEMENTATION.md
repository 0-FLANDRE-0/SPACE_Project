# RESOURCE-UNIT-1 / PACKAGING-1 구현 계약

기준 커밋 `f4bc5e46ad8952b8f6eb981692b32ef94ee1fc08`, 선행 브랜치 `feat/econ-calibration-sim`, 구현 브랜치 `feat/resource-unit-packaging-foundation`. [요청 원문](REQUEST_KO.md)의 범위를 적용한다. ECON-SIM-4, 경제 탐색·재보정·후보 채택은 구현하지 않는다.

## 자원과 공간

| 자원 | 내용물 kg/U | 보관 | 공간 |
|---|---:|---|---:|
| ore | 10,000 | bulk | 1U/U |
| alloy | 10,000 | bulk / 여러 산업용 금속의 추상 자원 | 1U/U |
| hydrogen | 500 | packaged | 1U/U |
| residue | null / 미정 | bulk / 기존 산업 잔여물 | 1U/U |
| credits | 해당 없음 | 화폐 C | 해당 없음 |

`ResourceRegistry`는 중복 ID·잘못된 단위·음수 질량·불일치 저장 방식·화물 배수를 거부한다. 등록된 정의는 불변이다. 미정 자원은 null을 보존하며 물리적 패키징/화물 거래 전에 명시적으로 거부한다. `resourceContentMassKg(id, quantityU)`는 내용물 질량만 계산한다. `cargoQuantityU(entries,{capacityU})`는 정수 Q 합계로 계산한 U만 사용한다. 묶인 포장재는 패키지의 공간에 포함되고 별도 용량을 추가하지 않는다. `packageContentAndMaterialMassKg(account,registry)`는 실제 자유 자원·내용물·묶인 소재의 질량을 합산하며 질량 미정 재료가 실제로 있으면 오류를 낸다. SI 부피 상수는 없다.

`TONNES_PER_RESOURCE_U=10`은 기존 광석/합금 및 동결된 ECON 모델의 역사적 기준으로 남겼다. 새 수소 질량 변환에서 이 상수를 사용하지 않는다. 핵융합 2.5U/월=1,250kg/월, 기동/건설 각5U=2,500kg, 제련85U=42,500kg, 광업100U=50,000kg, 제련 건설120U=60,000kg이다. 기존 U 계약 자체를 환산하거나 변경하지 않는다.

## 모듈 경계

- `resource-definitions.js`: 확장형 자원 정의, 자원별 질량, 단일 U 용량.
- `packaging-specs.js`: 불변 규격, 소재 배열, 개별 회수율, 승인/활성화/해금, 순환 검증. 기본 유료 규격은 **없다**.
- `packaging-inventory.js`: 행성·소유자별 원장, 순수 견적, 원자적 커밋, 소비/회수/이전/재포장, 정수 보존 검사.
- `packaging-automation.js`: 설정, 소재·예산 예약, 보관 중인 내용물, 취소, 처리량/시간 정산, 자동 개선 보류/계획.
- `industry-packaging.js`: 산업과 범용 원장을 연결하는 유일한 어댑터. 산업 재고 캐시 동기화, 현지 예산 이체, 생산/소비/이전.
- `industry-runtime.js`, `industry-fixture.js`: 기존 건설·광업 부산물·제련·초기 시험 재고가 공통 API를 사용한다. 광석 품질 lot은 기존 경로를 유지한다.
- `industry-storage-v1.js`: 기존 엄격한 v1 검증을 별도 보존. `industry-storage.js`: v2 검증/구조 이관/백업.

## 범용 규격과 실행 예시

아래는 **테스트 전용 수치**다. 50Q 소재/1,000Q 내용물, 회수90%, 2C/U, 1.5kWh/U를 실제 게임 기본값으로 등록하지 않는다.

```js
import {PackageRegistry} from './packaging-specs.js';
import {
  createPackagingState, openPackagingAccount, quotePack, commitPack,
  consumePackagedResource, quoteRepackage, commitRepackage,
  transferPackagedResource, validatePackagingState
} from './packaging-inventory.js';
const registry=new PackageRegistry();
registry.register({
  id:'test-h-gen1', resourceId:'hydrogen', generation:1,
  materialInputs:[{resourceId:'alloy', amountQPer1000Q:50, recoveryRate:0.9}],
  directCostCPerU:2, electricityKWhPerU:1.5,
  unlockedBy:null, approved:true
});
registry.activate('test-h-gen1');
const book=createPackagingState(), ctx={bodyId:'earth', ownerId:'human'};
openPackagingAccount(book,ctx,{
  freeQ:{hydrogen:100000,alloy:10000},
  creditsMicroC:1000000000, energyWh:1000000
},registry); // 명시적인 외부 입력을 제공하는 테스트이며 게임의 무료 공급이 아니다.
const quote=quotePack(book,registry,{
  ...ctx, resourceId:'hydrogen', amountQ:100000, packageSpecId:'test-h-gen1'
});
if(quote.allowed)commitPack(book,quote);
consumePackagedResource(book,registry,{...ctx,resourceId:'hydrogen',amountQ:100000});
validatePackagingState(book,registry);
```

결과는 소재5U 차감, 소비 후4.5U 현지 자유 재고 반환,0.5U 손실,200C/150kWh 실제 차감이다. 전력·C·질량이 null이면 정식 규격을 활성화할 수 없다. 규격 ID의 레시피는 변경할 수 없으며 새 세대에는 새 ID를 발급한다. 미등록 소재를 참조하는 초안은 보관할 수 있지만 활성화는 거부한다. 자기 참조·간접 순환·음수·중복 소재도 거부한다.

`quotePack(book,registry,request)`/`quoteRepackage(...)`는 상태를 바꾸지 않는다. 반환 견적은 해당 런타임의 불투명 토큰이다. `commitPack(book,quote)`/`commitRepackage`는 최신 상태에서 다시 검증하고 전체 거래를 커밋한다. 직렬화/위조·재사용·오래된 견적은 거부한다. 부족하거나 실패하면 live book 전체가 변하지 않는다. 산업 광업의 incoming supply는 승인된 패키징 성공 후에만 유한 수소 원천을 차감한다.

`consumePackagedResource`는 구세대→동세대 규격 ID 순으로 소비하고 실제 기록된 소재만 회수한다. `transferPackagedResource(book,registry,{from,to,resourceId,amountQ})`는 내용물과 잔여 묶인 소재·규격 ID를 함께 옮긴다. 두 계정은 사전에 열어야 한다. 무료 행성 물류망/배송 일정/거래 시장은 구현하지 않는다.

## 원장과 보존 불변식

계정 키는 `bodyId|ownerId`이며 모든 조작에 두 값을 요구한다. 개별 탱크 객체 없이 규격별 묶음을 병합한다. `freeQ`는 자유 재고, `groups[specId]`는 내용물 Q와 `bondedMaterialsQ`, `counters`는 누적 포장·과금·회수, `ledger`는 공급·소비·손실·이전·비용의 보존 장부다. 예약된 패키지는 job escrow로 잠시 이동하되 합계와 질량에는 계속 포함한다.

자원별 `자유 + 패키지 내용물 + 묶인 소재 + 실제 손실 + 소비 = 초기 + 명시 공급 + 이전 유입 − 이전 유출`을 검사한다. 별도로 자유 소재 출입=실제 회수−실제 포장 투입, 손실=회수 카운터 손실, C/전력 잔액=초기+공급−실제 비용, 전 계정 이전 유입=유출을 검사한다.

수량은 기존1U=1,000Q, C는 microC(10⁻⁶C), 에너지는 Wh 정수다. 중간 곱은 BigInt로 계산한다. 포장재와 비용은 **규격별 누적 포장량의 올림**으로 과금하므로 미량 포장을 반복해도 공짜 소재/전력이 생기지 않는다. 회수는 소유자·규격·재료별 누적 나머지를 저장해 작은 소비를 반복해도 동일 계정의 일괄 소비와 일치한다. 남은 소재의 부분 분배는 내림, 마지막 소비 시 전량 분배한다. 다른 소유자로 이전할 때 이미 소비한 소재의 회수 나머지는 원래 소비자 장부에 남고 실제 잔여 묶인 소재만 이동한다. 이 경우 소비자별 정수 양자화에 따른 보수적 손실이 있을 수 있으며 물질을 추가 생성하지 않는다.

`planetInventory[bodyId][ownerId].hydrogen`은 모든 수소 묶음/예약 합계의 캐시다. `syncIndustryPackageView`만 갱신하며 v2 검증에서 정확한 일치를 요구한다. 자유 합금/잔여물도 같은 경로로 동기화한다. `resourcesQ`는 추가 자원 캐시다. 캐시를 직접 고쳐 부족분을 자동 보충하지 않는다. 기존 원광 `inventoryLots`의 출처/품질/가공 난도와 매장/채굴 장부는 유지한다.

## 자동 개선과 현지 예산

기본 `enabled:true`이지만 정식 규격, 설비 처리능력(`capacityQPerHour`), 처리 묶음(`batchQ`), 선행 소비 예측(`forecastConsumptionQ`), 직접 비용과 기회비용을 뺀 순편익 판단(`benefitMicroCPerU`), 자유 소재·C·Wh가 없으면 대기 사유를 기록한다. 현재 게임에서는 해당 수치들을 확정하지 않았으므로 유료 개선이 자동 실행되지 않는다.

- `configurePackagingAutomation(book,registry,ctx,options)`로 명시 입력을 연결한다.
- `reserveRepackageJob(book,registry,request)`는 실제 구형 내용물을 예약하고 최소 보장 회수량을 뺀 신형 소재·C·Wh를 예약한다. 필수 `protectedFreeQ`를 침범하지 않는다. 동일 계정은 하나의 처리 라인을 사용한다.
- `advancePackagingQueue(book,registry,ctx,toMs)`는 단조 시간과 명시 처리량에 따라 진행한다. 예약된 묶음이 모두 처리된 시점에 비용/회수/신형 묶음을 원자적으로 확정한다. 무한히 큰 일괄 변환 대신 호출자가 정한 유한 묶음을 처리한다. 시간 분할의 결과는 동일하다. 새 작업을 예약하기 전에 idle 시계를 현재 시점까지 진행해야 한다. 산업 어댑터는 기존 작업/idle 시계 정산 후 새 작업을 예약하여 과거 대기 시간을 새 작업에 지급하지 않는다.
- `cancelRepackageJob`는 원래 규격/소재/내용물을 그대로 반환한다. 처리 도중 취소해도 아직 확정되지 않은 비용이나 회수를 발생시키지 않는다.
- `planAutomaticPackaging`은 곧 사용할 물량을 남기고 최신 승인/해금 규격에 대해 경제성이 주입된 경우에만 작업을 예약한다. 실제 미래 경제성 계산기는 후속 연결이다.

`fundIndustryPackaging(state,catalog,ctx,{creditC,energyWh})`는 정부 국고에서 명시적으로 현지 포장 예산을 빼서 적립한다. 계정별로 같은 국고를 복제하지 않는다. energyWh는 호출자가 실제 공급할 입력이며 게임 발전망 생성 기능이 아니다. 산업의 `advanceIndustry`는 처리능력이 설정된 계정만 같은 산업 시계로 큐를 진행한다. 민간 재정 공급자는 아직 게임에 연결하지 않았다.

## 현재 호환 경로와 확장 한계

기본 규격은 `hydrogen-legacy-unpriced-v1` 하나다. 세대0, 승인된 정식 기술 아님, 가격/전력 null, 묶인 소재{}, 소비 회수0이다. 구세이브·초기 시험 재고는 나중에 정식 규격이 있어도 이 규격으로 이관한다. 신규 광업만 현재 해금된 최신 정식 규격이 있으면 그 입력을 실제 지불하고, 정식 규격 자체가 없으면 임시 경로를 사용한다. 유료 규격의 입력이 부족하다고 무료 호환으로 우회하지 않는다. UI는 U 합계를 유지하고 미가격화 임시 호환임을 설명한다.

범용 엔진은 임의 가스/액체 및 여러 소재를 처리한다. 단, 산업의 원광은 품질 lot 장부에 있으므로 **산업 어댑터에서 ore를 포장재로 쓰는 규격은 명시적으로 보류**한다. 원광을 단순 숫자로 복제하거나 lot 출처를 버리지 않고 차감/회수하는 후속 어댑터가 필요하다. 범용 엔진의 명시 입력 테스트에서는 ore를 일반 bulk 소재로 사용할 수 있다. 행성 저장 용량의 실제 시설별 한도, 함선 적재, 수전해/융합 실시간 게임 통합은 이번에 구현하지 않는다.
