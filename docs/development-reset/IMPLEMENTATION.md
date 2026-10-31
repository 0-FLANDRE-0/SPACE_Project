# 개발용 저장 초기화 패치

2026-11-01 (KST). 기준: PR #8 최신 `035831ba6545f8428d82eb78bab8dab09f9aee2d`. 작업 브랜치: `feat/development-session-reset`. main과 선행 PR은 병합하지 않습니다.

## 동작

앱 시작 시 전용 시험 키를 먼저 정리한 뒤 최신 정적 manifest/19개 프리셋과 초기 시나리오에서 새 상태를 만듭니다. 프리셋 요청은 `cache: no-store`입니다. 지구는 공식 92셀·8,893 POP를 그대로 사용합니다.

산업·표면·행정 실행 어댑터는 `transient: true`입니다. 저장값 읽기, 자동 쓰기/백업, 호환성 검사와 인구 자동 이관을 건너뜁니다. 주기/조작/종료 저장도 제거했습니다. 건설·생산·표면 편집·행정 편집·Undo는 현재 탭 메모리에서 작동하며, 항성계 전환 때도 같은 탭 상태를 유지합니다. 새로고침은 시간과 진행을 초기화합니다.

개발 캠페인에 다시 진입하면 새 산업 상태와 시간0을 만들고 기존 시험 지급량인 지구 100,000 C·합금10,000 U·수소500 U를 새로 제공합니다. 동일 인스턴스의 중복 초기화로 재고를 재지급하지 않습니다.

JSON 내보내기는 수동으로 유지합니다. 가져오기는 파일 선택·검증·확인 후 현재 탭에만 적용합니다. 내보낸 파일의 자동 검색/복원은 없습니다. 표면 v1→v2 자원 변환도 명시적 미리보기/확인 조작으로만 가능합니다. 기존 저장·인구 이관 클래스/테스트는 보존하되 앱 실행 경로에는 연결하지 않습니다.

## 초기화 대상 키

키의 값은 읽지 않고 이름만 열거합니다. 정확한 계열 이름 또는 바로 뒤가 `:`인 키만 삭제합니다.

| 대상 계열 | 포함 예시 |
|---|---|
| `space-project:industry` 및 `space-project:industry:*` | `v1:sol`, `v1:sol:fixture`, `v1:sol:fixture:population-e1:backup`, 구버전·수동 교체 백업 |
| `space-project:surface` 및 `space-project:surface:*` | `v1:sol:earth`, `v0:sol:earth:backup`, `v1:sol:earth:population-e1:8d236561:backup`, 다른 천체 초안 |
| `space-project:administration` 및 `space-project:administration:*` | `v1`, `v0:backup`, 기타 구버전·백업 |

`localStorage.clear()`는 사용하지 않습니다. `other-project:save`, `space-project:industry-other:v1`, `space-project:surface-tools`, `space-project:settings` 등은 변경하지 않습니다. 저장소 접근·열거가 막히거나 개별 삭제가 실패해도 초기 실행과 생산을 계속합니다. 삭제 불가능한 원본이 남아 있어도 앱은 읽지 않습니다.

## 실제 구현 변경 파일

| 파일 | 수정 |
|---|---|
| `dist/src/development-session.js` (신규) | 전용 키 판정·시작 전 정리·저장소 예외 격리 |
| `dist/src/main.js` | 모델 생성 전 정리, 항성계 전환 저장 제거, 정리 결과 진단 |
| `dist/src/industry-ui.js` | 메모리 세션, 신규 캠페인, 자동 저장/불러오기·인구 이관 연결 제거, 수동 파일 |
| `dist/src/industry-storage.js` | transient 모드: 저장값/서명 이관/백업 건너뛰기, 명시적 JSON 검증만 |
| `dist/src/industry-fixture.js` | 인스턴스별 초기 지급 1회, transient 저장 호출 없음 |
| `dist/src/planetary-surface-io.js` | transient 모드·최신 정적 요청·공식 인구 출처 스냅샷 |
| `dist/src/planetary-surface-ui.js` | 메모리 초안 사용, 인구 이관 UI 연결 제거, 수동 JSON/안내 |
| `dist/src/planetary-resource-ui.js`, `planetary-generation-ui.js` | 자동 백업 다운로드/저장 대신 메모리 Undo·현재 탭 안내 |
| `dist/src/administrative-regions.js`, `administrative-region-ui.js` | 메모리 편집·Undo·항성계 상태, 저장 읽기/쓰기 없음 |
| `dist/src/surface-distribution-ui.js` | 현재 공식 인구 스냅샷으로 출처 표시, 이관 패키지 의존 제거 |
| `dist/index.html` | 새로고침 초기화 안내, 저장 버튼 비활성·수동 JSON UI |
| `tests/development-session.test.js`, `browser-development-reset.mjs` (신규) | 키 범위·불가 저장소·새 상태·같은 탭 생산·새로고침·재진입·불변 데이터 |
| 기존 브라우저10개 | 영구 저장 기대값을 새 초기화 정책으로 변경, 기존 편집/건설/생산/선택/파일 검증 유지 |
| `README.md`, `docs/DECISIONS.md`, `docs/VERIFICATION.md`, 이 디렉터리 | 현재 정책·실제 검증·증거 |

변경한 기존 브라우저 파일: `browser-administration.mjs`, `browser-generation-safety.mjs`, `browser-industry-safety.mjs`, `browser-industry.mjs`, `browser-planet-generation.mjs`, `browser-planet-surface.mjs`, `browser-population-migration.mjs`, `browser-resource-correction.mjs`, `browser-resources.mjs`, `browser-smoke.mjs`. 완료한 PC 페이지는 모바일 검사 전에 해제해 소프트웨어 GPU 자원 경합을 줄입니다. 삭제한 테스트는 없습니다. 기존 legacy 저장/이관은 단위 테스트와 브라우저의 격리된 Map 어댑터에서 검증합니다.

## 변경하지 않은 데이터와 규칙

`dist/data/planet-surfaces/*.json`, 원본 `sources/earth-urban75-v1.json`, `industry-runtime.js`, `industry-policy.js`, `model.js`, `time-control.js`는 PR #8과 바이트 동일합니다. 공식 인구/지질/광맥/매장량/품질/섹터ID, 광업·제련 공식과 건설 비용을 수정하지 않았습니다. 신규 ZIP도 만들지 않습니다.

검증 명령·결과·스크린샷: [VERIFICATION.md](VERIFICATION.md).
