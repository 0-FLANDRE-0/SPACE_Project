# 산업 저장 v1 → v2 이관과 개발 초기화

## 버전과 원본 보호

산업 `schemaVersion`은2, 내부 패키징 book은1이다. 기존 키 `space-project:industry:v1:<systemId>` 및 `:fixture`는 유지한다. 이 키의 `v1`은 역사적 **저장 namespace**이며 payload 버전과 구분한다. 기존 키를 일괄 삭제/새 키로 무검증 복제하는 정책은 추가하지 않았다.

원본 v1 백업 키는 다음과 같다.

```text
space-project:resource-unit-packaging:backup:v1:<encodeURIComponent(원래 산업 키)>:<원문 fingerprint>[:충돌 번호]
```

fingerprint는 키 탐색 보조이며 보안 서명이 아니다. 같은 키의 실제 원문을 비교하고 다르면 새 충돌 번호를 붙여 양쪽을 보존한다. 예전 백업을 덮어쓰지 않는다. 저장 직후 읽어서 원문과 같은지 확인한다. 백업 불가/용량 부족이면 이관 결과를 활성화하지 않는다.

이 namespace는 기존 `industry`/`surface`/`administration` 시험 저장 삭제 대상 밖이다. **이번 요청의 필수 원본 백업**을 새로고침에도 남기기 위한 선택이다. 게임 진행 자동 저장을 재활성화한 것이 아니다. 다른 웹사이트·프로젝트 저장값은 건드리지 않으며 `localStorage.clear()`를 사용하지 않는다.

## 단계별 처리

1. 엄격한 JSON 파싱 및 기존 `validateIndustryStateV1` 실행. 미등록 필드/버전/서명·매장·재정·시계·품질 lot 손상은 이 단계에서 거부한다.
2. 원본을 복제해 버전2와 packaging/resourcesQ만 추가한다. 모든 기존 수소 Q를 소재{}인 `hydrogen-legacy-unpriced-v1`에 넣는다. 기존 광석 lot, 채굴/생산 기록, 원천 잔량, 국고, 시계, 이벤트는 유지한다.
3. v2 엄격 검증: 모든 캐시 합계와 원장 보존식 및 기존 산업 보존식을 검사한다. `industryLegacyProjection`은 패키징의 실제 투입·회수·이전/소비·명시 공급/예산을 제거한 비교 좌표로 기존 v1 검증을 계속 실행한다. v1 구조 이관 직후에는 이 projection이 원본과 **모든 필드에서 정확히 동일**하다.
4. **미리보기만으로는 저장 접근/백업/활성화하지 않는다.** 사용자의 수동 적용 시 원문을 별도 키에 백업하고 검증된 상태만 활성화한다. 같은 파일을 다시 적용하면 현재 상태를 교체할 뿐 패키지/시험 재고를 더 지급하지 않는다.
5. opt-in persistent `IndustryStore` 생성 시에는 성공적인 백업과 v2 primary 쓰기 후에만 활성화한다. primary 쓰기에 실패하면 원래 primary/백업을 남기고 blocked 상태로 격리한다. 검증된 변환본을 `quarantinedState`로 보존할 수 있으나 시뮬레이션에 활성화하지 않는다.

`migrateIndustryV1ToV2` 자체는 순수 구조 변환 함수다. 외부 활성화는 반드시 `IndustryStore`의 backup-before-activation 경로를 사용해야 한다. `replace`는 preview 원문/변환본의 서명을 확인하며 수정된 preview는 거부한다. 명시적으로 신뢰할 수 있는 v2 상태를 직접 교체하는 개발 API에는 v1 원문이 없으므로 v1 이관으로 취급하지 않는다.

## 라이브 실행의 정책

라이브 UI는 여전히 `transient:true`로 생성된다. 실행/새로고침 시 공식 프리셋에서 새 상태를 만들며 localStorage 산업 저장을 읽거나 자동 이관하지 않는다. 자동 저장도 없다. 건설/생산/편집은 현재 탭에서 동작한다. 기존 SPACE_Project 시험 키 정리와 최신 지구92섹터/8,893,000,000명 사용은 그대로다.

v1 JSON을 **명시적으로 가져와 적용할 때만** `importBackupStorage:()=>window.localStorage`를 호출한다. 저장소 접근이 차단되어도 새 게임 실행은 가능하고 v2 수동 import는 메모리에서 가능하다. 단, 백업을 필수로 하는 v1 적용은 차단되며 현재 진행은 변하지 않는다. 현재 UI의 세이브 호환을 위해 잘못된 JSON을 자동 수정하는 우회는 없다. 기존 허용된 지구 인구 서명 이관은 버전1/2에 대해서만 유지하며 공식 데이터는 쓰지 않는다.

개발 초기 재고는 기존 합금10,000U/수소500U/정부100,000C다. 초기화 함수가 이미 이관/불러온 상태에 재진입해도 재지급하지 않는다. 새 시험 캠페인을 명시적으로 시작할 때만 새 시험 재고가 지급된다. 일반/fixture 캠페인 종류·저장 키가 서로 다르면 교체하지 않는다.

## 보존 증거

[fixture provenance](../../tests/fixtures/resource-packaging-provenance.json)에는 원래 f4bc5e4 코드로 생성한 초기/일반/건설180.125일/생산700.125일/750.125일/실제19천체 초기 상태6개의 SHA-256을 기록했다. `node scripts/verify-resource-unit-preservation.mjs`는 git의 원래 runtime/initializer를 읽어 **다시 계산한 산업 상태와 이6개를 비교**하며 파일을 재작성하지 않는다. 경제 시뮬레이션은 실행하지 않는다.

신규 런타임으로700.125일 저장을 이관한 후750.125일까지 진행한 결과는 원래 런타임의 전체 기존 필드와 정확히 동일하다. 별도로 실제 브라우저19천체 카탈로그에서 원문 백업, 반복 적용, legacy 소비 회수0, v2 export/import, 백업 거부, 손상 서명, 새로고침 초기화와 원본/타 프로젝트 보존을 검증한다.
