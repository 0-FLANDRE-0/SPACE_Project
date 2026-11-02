# 사용자 제공 지구 원본과 변경 범위

원본: `dist/data/planet-surfaces/sources/earth-urban75-v1.json` (첨부 ZIP의 assets/SPACE_surface_sol_earth_schema1_urban75.json을 바이트 그대로 보존).

SHA-256: `5c9cbdffc357183cfce5414090710f65bbdb14214c146f2bafae0f848c9de6f4`.

원본 schema1, sol/earth, 92셀, fingerprint7d4c00a6. ore78300000000 U, 인구8893000000명, 인구 가중 도시화율 약75%. 전체 startingScenario와 각 geology 셀에서 deposits를 제외한 모든 필드는 공식 v2 결과와 deep-equal 검사합니다. 공식 ore78600000000 U는 기존 원본을 재편성한 값이며 순증300000000 U입니다. 품질별 원천 매장량을 따로 저장하지 않습니다.

v2의 추가 자원 설정·잠재 수소 공급원·초기 인지 기록은 별도 키입니다. 기존 startingScenario를 바꾸지 않습니다. 사용자 원본의 섹터별 매장량을 확정 분포로 간주하지 않고 새 시드·면적·육해 배치 정책으로 재배분했습니다.

추가 사용자 정책: 광맥형은 주로 육지·대륙붕. 해양 표면형은 해저 단괴로 채굴/발견 난도를 높임. 현재의 Natural Earth 육해 마스크에는 수심이 없으므로 대륙붕은 육지비율≥0.2의 육해혼합 광역 구역으로 근사합니다. 물비율≥0.7의 표면형에 extractionDifficulty≥80, discoveryTier≥3을 적용합니다. 이 수치들은 임시 튜닝값이며 정책만 사용자 확정입니다.
