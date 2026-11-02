# 저장 schema3와 개발 실행

## 구조

산업 payload `schemaVersion:3`, 공통 패키징 book `schemaVersion:2`다. 기존 저장 namespace `space-project:industry:v1:<system>[:fixture]`는 유지한다. 키의v1과 payload 버전은 별개다.

각 `bodyId|ownerId` 계정에는 기존 산업 보관 필드와 새 `scu`가 있다.

```text
scu.groups[resourceId|containerSpecId|fillQ]
  resourceId, containerSpecId, fillQ, count, bondedMaterialsQ
scu.openedQ[resourceId]               현지 개봉 잔여 내용물
scu.receivers[resourceId]              bindingId, kind, capacityQ
scu.counters[resourceId|specId]        제작/수취/이전/개봉/소재/C/Wh/회수 나머지
scu.appliedTransfers[]                외부 인도 정산의 중복 방지 참조
scu.automation                       ON/능력/예측/순편익/예약 큐/시간 잔여
```

내용물과 구조재가 같은 alloy여도 각각 계산한다. count와fillQ로 실물 컨테이너를 집계하고 빈 컨테이너·개별 객체는 없다. 예약 escrow도 소유자의 총량에 포함한다. `planetInventory`는 한 경로에서만 동기화하는 U 캐시이며 strict 검증에서 실제 원장 합계와 일치해야 한다.

자유 수소 저장은 허용하지 않는다. 수소 개봉 잔여는 법적 receiver의 용량 안에서만 `openedQ`에 남는다. 부정 수량·잘못된 규격·알 수 없는 필드·소재/비용/개수/회수/이전 장부 불일치는 거부한다. 산업 원광의 출처/품질 lot은 기존 배열과 품질별 합계를 그대로 유지한다.

## v2 → v3

`industry-storage-v2.js`는 PR #11의 엄격한 v2 검증을 보존한다. `migrateIndustryV2ToV3`는 이를 먼저 실행한 뒤 복제본의 산업 버전3/book버전2와 계정별 **빈 SCU 도메인**만 추가한다. 기존 legacy/유료 산업 보관 묶음·소재·나머지·재고·시설·국고·원천·시계·기록은 바꾸지 않는다. 컨테이너나 소재를 새로 지급하지 않는다.

v1은 보존된v1 검증을 거쳐 `migrateIndustryV1ToV3`로 직접 현재 버전에 연결한다. 수소는 여전히 과거 소재{}/회수0인 산업 호환 보관이며 정식 SCU 포장이 아니다. 손상된 v1/v2를 자동 수정하지 않는다.

원본 백업은 이전 기능을 재사용한다.

- v1: `space-project:resource-unit-packaging:backup:v1:<encoded key>:<fingerprint>[:collision]`
- v2: `space-project:resource-cargo-scu:backup:v2:<encoded key>:<fingerprint>[:collision]`

원문이 다르면 덮어쓰지 않고, 실제 백업을 다시 읽어 일치하는지 확인한 뒤만 활성화한다. 미리보기는 I/O나 활성화를 하지 않는다. 수동 적용 시 백업 불가면 현재 진행을 유지한다. 정상/fixture 종류가 다르면 교체하지 않는다. 반복 적용은 교체이며 재고 추가/시험 재정 재지급이 아니다. 현재v3 수동 import는 메모리에서 가능하다.

persistent opt-in 초기 이관의 백업/primary 쓰기가 실패하면 `blocked:true`이고 실패한 변환본은 **quarantinedState에만** 보존한다. 정상 `state`는 새 초기 상태로 남아 실패한 캠페인을 노출하지 않으며 초기 fixture 재지급/산업 진행도 차단한다. 이는 이전 PR의 실패 변환본을 state에도 두던 동작을 이번 요구에 맞춰 수정한 것이다.

## 개발 실행 유지

UI는 `transient:true`다. 시작/새로고침 시 공식 프리셋에서 새 게임 상태를 만들며 구 localStorage 캠페인을 자동으로 불러오거나 이관하지 않는다. 자동 저장도 없다. 이전 시험 진행은 초기화되지만 명시 수동 이관의 원문 백업은 별도 namespace에서 보존한다. 저장소가 차단되어도 초기 실행은 가능하다. 다른 프로젝트 데이터나 Git 공식 프리셋은 변경하지 않는다.

새 fixture는 v3로 재생성할 수 있고 기존 시험 재고100,000C/합금10,000U/수소500U를 그대로 사용한다. 새로운 SCU 컨테이너는0개다. 기존5개v2 fixture는 PR #11 코드로 생성한 자료이며 보존 감사가 원래 커밋의 모듈로 다시 이관해 원본과 비교한다. 구6개v1 fixture와 기존750.125일 산업 궤적 비교도 유지한다.
