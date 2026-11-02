# v0.5E.1 완료·검증 보고

2026-11-01 (KST). 기준 PR #7 `ec242b3`. [변경 파일·조작·저장 정책](IMPLEMENTATION.md), [실제 인구 자료 출처](POPULATION_SOURCE.md), [92셀 전/후 배분](POPULATION_COMPARISON.md), [기계 판독 수치](POPULATION_REPORT.json)를 함께 제공한다.

## 결과

- `npm run check`: **55개 소스 모듈** 통과 — [로그](syntax-check.log).
- `npm test`: **171개 통과**, 실패/취소/건너뜀0. 기존151개를 유지하고 인구·이관11/분포·드래그9개를 추가 — [로그](unit-tests.log).
- Chromium/Playwright **11개 스크립트 통과**, page/console error0. 1440×1000,844×390,667×375,390×844에서 실제 클릭/터치/스크롤/드래그와 기존 산업 루프를 검증했다.
- 실제 원본 래스터 집계 두 번, 최대 잔여 배분 및 전체19개 프리셋 생성기의 별도 출력 재현이 모두 바이트 일치 — [재현 검사](reproducibility.json).
- 지구 총인구 **8,893,000,000명=8,893 POP**,92ID 그대로.19개 실제0,82개 값 변경. 지구의 인구 외 필드와 다른18개 프리셋·사용자 지구 원본은 불변이다. 산업 생산/정책/천문/시계 모듈도 바이트 불변이다.

## 실제 브라우저 흐름

| 스크립트 | 확인 내용 | 로그 |
|---|---|---|
| browser-surface-distributions | 일반3모드·수치/색상·공개 인지·POP·시설 상태,4해상도 드래그/초기화/회전,카메라/선택/산업 보존,DEV 우선순위/동일 버퍼,실제2프레임 사이 불필요 재생성 없음 | [로그](browser-surface-distributions.log) |
| browser-population-migration | 실제 v0.5E 산업 저장 자동 백업/서명1회 이관,원본 로컬 초안 우선,모바일 인구92필드만 미리보기·동의·두 백업·적용,다른 천체 불일치 격리 | [로그](browser-population-migration.log) |
| browser-smoke | 기존3D 지도·궤도·선택·카메라·주입 항성계·배속·모바일 드래그/핀치 | [로그](browser-smoke.log) |
| browser-administration | 기존 행정 편집·연결성·원자적 거부·모바일·저장 | [로그](browser-administration.log) |
| browser-planet-surface | 기존8행성/11위성·표면 편집·파일·격자·회전 고정·모바일·전체화면/실패/iframe | [로그](browser-planet-surface.log) |
| browser-planet-generation | 생성 worker·미리보기·수동값·레이어·예산·파일·모바일 | [로그](browser-planet-generation.log) |
| browser-generation-safety | 범위·잔여 예산·백업·stale 거부·취소·quota | [로그](browser-generation-safety.log) |
| browser-resources | 실제19프리셋·인지·원본 지도·편집/이관·파일·세 천체 추가·모바일 | [로그](browser-resources.log) |
| browser-resource-correction | D.1 광맥/품질·기존 generator1 로컬 보존·공식 미리보기·백업 | [로그](browser-resource-correction.log) |
| browser-industry | 4해상도 구획·건설·완공·채굴/제련·수소 토글·증설/개량·JSON/재로드 | [로그](browser-industry.log) |
| browser-industry-safety | 19카탈로그·산업 파일 검증/백업/복원·quota 메모리 유지·손상 원본 다운로드 | [로그](browser-industry-safety.log) |

기존 편집 버튼의 DEV 이동에 맞춰 테스트도 실제 DEV 드로어를 여는 경로로 변경했다. 원본 보존 검사는 허용된 인구 필드만 구버전으로 복원해 종전 나머지 비교를 유지하고, 새 검사가 실제 인구·출처·합계·이관을 따로 확인한다. 테스트 삭제/무조건 초기화/숨은 지질의 공개 지도 재사용을 하지 않았다.

소프트웨어 렌더러에서 고정150/400ms가 실제 프레임 갱신보다 짧을 수 있어 지도 이동/레이블 갱신 검사는 실제 조건을 기다리도록 변경했다. 같은 최종 assertion을 유지했다. 초기 HUD 이벤트 준비 전 클릭 가능 시점은 로딩 해제를 늦춰 해결했다.

## 인구 데이터와 저장 검증

- 실제 GHS-POP E2025 1km GeoTIFF를 읽고30,434,204 양수 픽셀을 원래 구면 경계로 배정했다. 후보4개 사용은 가속일 뿐 실제 수락은 구면 반공간 검사이며 fallback/중복 배정0이다. 날짜변경선 경계5개 픽셀의 인구도 보존했다.
- 인구 자료의 합8,191,988,536.304918을 목표8,893,000,000으로 BigInt 최대 잔여 배분한다. 동률은 ID 순. 격자 면적을 다시 곱하지 않았다.
- 최종 상위 구역은 남중국/서인도·파키스탄/히말라야·벵골 주변의 넓은 섹터에 나타난다. 실제 지구 지도와 기본 표면/인구 모드 화면을 확인했고,92셀 해상도를 도시 단위 추정으로 표현하지 않았다.
- 인구만 수정했을 때 구 산업 서명 검증이 실패하는 것을 먼저 재현한 뒤,8d236561→52cbc980의 특정 공식 인구 전환만 백업 후 허용했다. 실제 구버전 캠페인으로 시설/슬롯/재고/원천잔량/품질배치/이력/시계/fixture 구분 보존 및 다시 로드해도 재지급·중복 생산 없음,다른 천체/지질/미지원 schema 격리를 검사했다.
- 사용자 로컬 초안은 새 정적 인구보다 우선했다. 명시적 적용만 인구92필드와 대응 산업 서명을 함께 바꿨다. 두 번째 주키 저장 실패의 보상 쓰기,백업 quota 실패 시 원본/메모리 보존도 단위·브라우저로 검사했다.
- 수량 분포는0/null/동률/한두 값/동일값/극단치/NaN/Infinity/음수 경계를 검사했다. 공개 자원 집계는 숨은 값만1e9→1e12로 바꿔도 같고,티어100%/원천 없음/확인0만으로 검정이라고 오판하지 않았다.

## 전후·화면 캡처46장

변경 전은 임시 분리 checkout의 실제 `ec242b3`를 로컬 HTTP로 실행해 캡처했다. 이전 버전에는 일반 분포3모드가 없어 비교용으로 DEV 매장량/인구 지도와 건설 화면을 사용했다.

| 비교 | 이전 v0.5E | v0.5E.1 |
|---|---|---|
| 지구 원본 매장량 대비 | [노란색에 몰린 이전 지도](screenshots/before-earth-developer-ore-1440.png) | [분위수·단계색·범례](screenshots/earth-developer-ore-1440.png) |
| 지구 인구 분포 | [이전 DEV 인구](screenshots/before-earth-developer-population-1440.png) | [실제 GHSL 비율의 일반 POP 지도](screenshots/earth-population-1440.png) |
| 시설 표시 | [이전 건설 탭](screenshots/before-earth-construction-1440.png) | [실제 건설 중 외곽](screenshots/earth-facilities-construction-1440.png) / [가동 후](screenshots/earth-facilities-active-1440.png) |

| 해상도 | 인구 | 알려진 매장량 | 시설 | 이동 패널 |
|---|---|---|---|---|
|1440×1000|[이미지](screenshots/earth-population-1440.png)|[이미지](screenshots/earth-known-ore-1440.png)|[이미지](screenshots/earth-facilities-active-1440.png)|[이미지](screenshots/dragged-panel-1440.png)|
|844×390|[이미지](screenshots/earth-population-844.png)|[이미지](screenshots/earth-known-ore-844.png)|[이미지](screenshots/earth-facilities-active-844.png)|[이미지](screenshots/dragged-panel-844.png)|
|667×375|[이미지](screenshots/earth-population-667.png)|[이미지](screenshots/earth-known-ore-667.png)|[이미지](screenshots/earth-facilities-active-667.png)|[이미지](screenshots/dragged-panel-667.png)|
|390×844|[이미지](screenshots/earth-population-390.png)|[이미지](screenshots/earth-known-ore-390.png)|[이미지](screenshots/earth-facilities-active-390.png)|[이미지](screenshots/dragged-panel-390.png)|

| 천체 | 자원 | 인구 | 시설 |
|---|---|---|---|
|화성PC|[이미지](screenshots/mars-ore-1440.png)|[이미지](screenshots/mars-population-1440.png)|[이미지](screenshots/mars-facilities-1440.png)|
|달PC|[이미지](screenshots/moon-ore-1440.png)|[이미지](screenshots/moon-population-1440.png)|[이미지](screenshots/moon-facilities-1440.png)|
|화성세로|[이미지](screenshots/mars-ore-390.png)|[이미지](screenshots/mars-population-390.png)|[이미지](screenshots/mars-facilities-390.png)|
|달세로|[이미지](screenshots/moon-ore-390.png)|[이미지](screenshots/moon-population-390.png)|[이미지](screenshots/moon-facilities-390.png)|

[모바일 로컬 인구 미리보기](screenshots/local-population-preview-390.png), [구 산업 자동 이관PC](screenshots/migrated-industry-1440.png), [모바일 이관](screenshots/migrated-industry-844.png). [전체46개 캡처](screenshots/).

## 제한과 후속 사항

- 실제 iPhone/Safari/Android 하드웨어 GPU·노치 실기기는 미검증이다. 터치는 Chromium 에뮬레이션이다. SwiftShader에서 측정한 FPS를 실기기 성능으로 주장하지 않는다.
- 인구 자료는2025 epoch 모형 분포이며1km 중심점 배정 근사다. 지구 총8,893 POP는 사용자의2100 시나리오 값이다. 실제2026 인구/도시 단위/2100 예측 정확도를 주장하지 않는다.
- 섹터 도시화율을 그대로 둔 결과 가중 전체 도시화율이51.293690%가 됐다. 도시화·기반시설의 공간 분포 조정은 후속 결정이며 이번에 자동 수정하지 않았다.
- 현행 자원 스키마에는 음성 조사 증거가 없어 자원 부재의 검정 표시를 임의 생성하지 않는다. 일반 무인지/확인 소진 셀은 회색이다.
- 수동 두 키 저장은 일반 실패의 rollback·원본 백업을 검사했다. 강제 종료가 두 쓰기 사이에 일어나는 창은 DB 원자성을 주장하지 않고 보존된 두 백업으로 복구하는 한계로 남긴다.
- 기존 산업의 미정 취소/교체/철거/정식 재정/운영수요 정책과 별도 개발 캠페인을 유지한다. 경제/전력/연구/물류/함선/새 배속/오프라인 진행을 추가하지 않았다.
- 기존 사이트 접근 범위를 유지하고 후속 PR만 제출한다. main은 병합하지 않으며 신규 ZIP도 만들지 않는다.
