# 민간 해체0U 원인 진단

2026-11-02 Asia/Seoul. PR15의1.2C/U·기존 E5-X·4차37축을 그대로 둔5시드×4후보를 재현했다. 새 정책은 모두 껐고, 관측 어댑터와 원래 R4 전체 행 SHA256이20/20 일치했다. 관측을 위해 행동 규칙을 바꾸지 않았다. 총40회20년 실행이다.

| 후보 | 종류 | 최대 정지 개월(5시드) | 해체 문턱 | 해체 판단 | 재시작 판단 |
|---|---|---:|---:|---:|---:|
| R4-N018 | industry | 25 | 30 | 0 | 105 |
| R4-N018 | electrolyzer | 1 | 30 | 0 | 10 |
| R4-N018 | legacyGrid | 0 | 30 | 0 | 0 |
| R4-N018 | powerBase | 0 | 30 | 0 | 0 |
| R4-N018 | powerModule | 0 | 30 | 0 | 0 |
| R4-N055 | industry | 25 | 32 | 0 | 105 |
| R4-N055 | electrolyzer | 1 | 32 | 0 | 10 |
| R4-N055 | legacyGrid | 0 | 32 | 0 | 0 |
| R4-N055 | powerBase | 0 | 32 | 0 | 0 |
| R4-N055 | powerModule | 0 | 32 | 0 | 0 |
| R4-N066 | industry | 25 | 30 | 0 | 105 |
| R4-N066 | electrolyzer | 1 | 30 | 0 | 10 |
| R4-N066 | legacyGrid | 0 | 30 | 0 | 0 |
| R4-N066 | powerBase | 0 | 30 | 0 | 0 |
| R4-N066 | powerModule | 0 | 30 | 0 | 0 |
| R4-rounded | industry | 25 | 30 | 0 | 105 |
| R4-rounded | electrolyzer | 1 | 30 | 0 | 10 |
| R4-rounded | legacyGrid | 0 | 30 | 0 | 0 |
| R4-rounded | powerBase | 0 | 30 | 0 | 0 |
| R4-rounded | powerModule | 0 | 30 | 0 | 0 |

광업·제련은 강제 생산 중단 월60–83에 전망 매출이0이 되어 정지 상태를 유지하지만,24개월 뒤 중단이 풀리면 합금 고가에서 기대 마진이 양수로 돌아와 재가동 판단이 먼저 성립한다. 기존 카운터는 재시작 월의 판단 전에도 먼저 증가하므로 직전 최대25이며, 실제 강제 중단24개월과 구별한다.30–32개월의 장기 정지 문턱에 닿지 않는다. 전해설비는 광업·제련과 다른 전망 원가를 쓰고 기동 가능한 경우 재시작하며, 기존 필수망은 인구가 있는 동안 최소 양의 기대 마진을 주는 기존 집계 규칙이다. 종류별 최대 정지/판단 횟수는 위 실측 표를 우선한다.

따라서 이 표본의0U는 해체 액션이 발생하지 않은 결과다. 실제 해체 견적/자본 반환 API가 막혀서 회수가 사라진 사례가 아니다. 최소 재현 테스트는 정지24개월·음수 전망→hold, 동일 설비 양수 전망→restart,30개월·음수 전망→dismantle을 검사한다. 회수를 늘리기 위해 문턱·예상 가격·마진을 변경하지 않았다.

코드: [R4 privateAction](../../../dist/src/economy-round4-facilities.js), [R4 expectedMargin/lifecycleDecisions/round4Events](../../../dist/src/economy-round4-model.js). [원시 월별 결정·최대값·해시](private-salvage-diagnostic.json). 기존 기대 마진은 실제 운영의 단기 유동성/전력 제약을 완전히 예측하는 최적화가 아니므로, 향후 의사결정 모형 개선은 별도 제안이다. 이번4.1에서는 이 규칙을 유지했다.
