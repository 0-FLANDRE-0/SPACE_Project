# 저장 스키마와 이관

현재 산업 **v4 / packaging book v3**. 필수 추가 필드는 루트 `clockMs`, SCU 작업 `startedMs`, 계정 `scu.oreCustody`다. 원광 봉인 그룹만 선택적 `lotManifest`를 갖는다. 이름만 바꾸는 호환 처리가 아니라 과거 v1/v2/v3를 각 동결된 validator로 먼저 검사한다.

| 입력 | 처리 |
|---|---|
| 산업 v1 | 기존 검증 → 회수0 미가격화 호환 수소 → 빈 SCU/보관 장부, 현재 정산 시계 |
| 산업 v2 / book v1 | 기존 검증 → 기존 포장 보존, 빈 SCU/보관 장부, 현재 정산 시계 |
| PR12 산업 v3 / book v2 | `industry-storage-v3.js` 검증 → 기존 실물/예약/진행률/회수/C/Wh 보존, 새 빈 원광 보관 장부, 현재 정산 시계에서 작업 재개 |
| 산업 v4 / book v3 | 전체 시계·manifest·원광/소재 보존 검증, 정확한 왕복 |
| 알 수 없는 버전/필드/훼손 | 전체 거부, 원문 유지, 정상 활성 상태와 분리 |

v3에는 예약 시작 시각이 없으므로 과거의 관측 불가능한 경과 시간을 보충하지 않는다. 이관 순간의 현재 정산 시각으로 `lastMs/startedMs`를 정렬하고 기존 정수 진행률·예약 실물·유효한 작업 분수는 유지한다. 유휴 분수는 0으로 정리한다. 이관 전 파일은 수정하지 않는다. 실제 PR12 코드로 생성했던 5종 v3 fixture를 Git의 원본 코드로 다시 생성하여 바이트/구조를 별도로 검증한다.

원문 백업 키:

- v1: `space-project:resource-unit-packaging:backup:v1:<encoded-key>:<fingerprint>[:collision]`
- v2: `space-project:resource-cargo-scu:backup:v2:<encoded-key>:<fingerprint>[:collision]`
- v3: `space-project:resource-cargo-scu:backup:v3:<encoded-key>:<fingerprint>[:collision]`

백업 read-back 검증 후에만 이관 상태를 활성화한다. 다른 원문과 키 충돌 시 덮어쓰지 않는다. 백업 실패나 opt-in 영속 저장의 기본 키 쓰기 실패 시 원문과 격리 상태를 남기고 새 시험 재고를 자동 지급하지 않는다. 현재 개발 실행은 계속 transient이며 자동 읽기/쓰기/이관을 하지 않는다. 명시적 구버전 JSON 가져오기만 백업을 요구한다. 현재 v4 수동 왕복은 storage 차단 환경에서도 가능하다. 개발 새로고침 초기화는 위 원문 백업 및 타 프로젝트 저장을 지우지 않는다.

테스트 전용 유료 규격을 포함한 저장은 같은 규격을 제공해야 읽을 수 있다. 등록되지 않은 규격이나 null 기본 비용으로 생성된 실물로 가장하는 저장은 거부한다. 이를 정식 규격/가격 승인으로 간주하지 않는다.
