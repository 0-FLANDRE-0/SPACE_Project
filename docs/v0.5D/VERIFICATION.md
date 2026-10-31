# v0.5D 검증 기록

2026-10-31 (Asia/Seoul). [완료 보고·확정/잠정값·소유권](REVIEW.md), [사용자 지구 원본](sources/EARTH_SOURCE.md), [19개 수치/시드](preset-report.json).

## 자동 검사

- `npm run check`: **42개 소스 모듈** 문법 검사.
- `npm test`: **122개 통과, 실패/건너뜀0**. 기존99개를 유지하고 자원 계약23개를 추가했습니다.
- `node scripts/generate-sol-presets.mjs`: 원본 SHA 확인 →19개 v2 생성 → 각 파일 schema/대상/격자/자원/그룹/품질/참조 검증 → 실제 manifest 기록.
- `git diff --check`, 패키저 Python 문법과 브라우저 테스트 스크립트 문법 검사.

새 검사는 지구/금성/화성/달의 정확한 총량·형태별 U, 지구/금성 품질 가중평균·기대 합금수율, 동일 유형 안의 실제 개별 확률 편차, 0/100%와 불균등 가중치, 달 표면100/저80·화성 잠정 상대 품질, **지구 육지/대륙붕 광맥과 해저단괴 난도**, 실제 구면 광맥 연결, 같은 seed의 JSON해시·시각/random 비의존, 여러seed의 고정 예산/평균 보존, 랜덤24seed의 총량/평균 차별성, null/0·invalid 입력, 큰 배치 O(1) 질량/재현성/일련번호 차이, 합금14/33/52와 기술 입력 분리, 지구 SHA/모든 시나리오/terrain/env 보존, 단일 셀 식민지, manifest19/전역ID/H공급원/아스트로지늄 금지, v1→v2 왕복, known-only 조회/티어 보존, 로컬v1 우선/백업/Undo, 미리보기 원자성/인지 이관, 잘못된 참조/비유한수 거부, 큰 값의 십진quanta, 수동 대안 평균과 시나리오 전용 편집의 설정 보존을 확인합니다.

기존 격자·기본 데이터·천문 자료·게임 AU/크기·모델·시간 제어·210 AU 섹터 파일은 변경하지 않았습니다. 자원 로직은 세계 시계를 전혀 진행시키지 않습니다.

## 브라우저와 캡처

Chromium/Playwright, SwiftShader. PC1440×1000, 실제 터치 이벤트를 사용하는844×390/667×375 에뮬레이션입니다. 아래 로그에는 각 스크립트의 최종 PASS와 page/console error 검사가 들어 있습니다.

| 로그 | 범위 |
|---|---|
| [browser-smoke.log](browser-smoke.log) | 기존 천체 선택·가림·정보 탭·카메라/궤도·크기/텍스처·210AU·두 모바일/fixture |
| [browser-administration.log](browser-administration.log) | 행정 생성/연결/Undo/저장/복원·실제0.1/1/100× 시계·두 모바일 |
| [browser-surface.log](browser-surface.log) | 19개 기존 표면/오각형 선택·spin고정·v1편집/파일·PC/모바일 fullscreen·Esc·미지원/거부/iframe |
| [browser-generation.log](browser-generation.log) | 기존 v0.5C 자연/POP/예산·색지도·수동0/1명/[]보존·JSON/sidecar/reload·100×·취소/정리 |
| [browser-safety.log](browser-safety.log) | 복수선택 잔여 예산·교체 파일/로컬 백업·stale preview/worker 취소·quota 메모리 경로 |
| [browser-resources.log](browser-resources.log) | 실제 공식19로드, 일반모드 known-only, 지구 새정책/7지도/geometry, 고정 예산·개별 확률, preview불변/백업/적용/Undo, 잘못된 확률 거부, v1원본 실제import→이관→v2export/import/reload, 지구·금성·화성·달·목성·유로파, 랜덤 총량 차이, cancellation/dispose/개발자DOM정리, 두 모바일6천체/파일/전체화면 |

v0.5B/v0.5C 세 편집 브라우저 스크립트의 **초기 상태만** 빈manifest의 미설정v1 fixture로 명시했습니다. 이 스크립트들은 '미설정 템플릿에서 시작하는' 기존 단언과 모든 동작 검사를 유지합니다. v0.5D 공식 프리셋으로 기본 상태가 바뀐 부분을 테스트 setup에서 분리한 것이며 production manifest는19개입니다. 새 browser-resources는 manifest를 가로채지 않고 실제19개 파일/로더와 v1기존 로컬 우선 동작을 확인합니다. 로고7회 테스트는 좌표를 한 번 읽고 실제 click/tap7회를 보내며 제품의5초 제한은 바꾸지 않았습니다.

기존 Google Fonts가 간헐적으로 CORS 오류를 내는 것을 확인해 외부 폰트 import를 제거했습니다. 모든 브라우저 자산은 로컬에서 읽고 시스템 폰트를 사용합니다. 폰트 오류를 무시하도록 error 단언을 완화하지 않았습니다.

### PC

[지구 표면·해저단괴](screenshots/earth-surface-nodules.png) · [지구 연결 광맥](screenshots/earth-veins.png) · [품질 지도](screenshots/earth-quality.png) · [현재/예정 비교](screenshots/earth-resource-preview.png) · [금성](screenshots/venus-resource.png) · [화성](screenshots/mars-resource.png) · [달](screenshots/moon-resource.png) · [목성](screenshots/jupiter-resource.png) · [유로파](screenshots/europa-resource.png) · [랜덤 시험계](screenshots/random-resource.png).

### 모바일

- 844×390: [지구](screenshots/mobile-844-earth.png), [금성](screenshots/mobile-844-venus.png), [화성](screenshots/mobile-844-mars.png), [달](screenshots/mobile-844-moon.png), [목성](screenshots/mobile-844-jupiter.png), [유로파](screenshots/mobile-844-europa.png).
- 667×375: [지구](screenshots/mobile-667-earth.png), [금성](screenshots/mobile-667-venus.png), [화성](screenshots/mobile-667-mars.png), [달](screenshots/mobile-667-moon.png), [목성](screenshots/mobile-667-jupiter.png), [유로파](screenshots/mobile-667-europa.png).

![지구 시드 미리보기와 형태별 품질 평균](screenshots/earth-resource-preview.png)

![667×375 가로화면](screenshots/mobile-667-earth.png)

좁은 화면은 폼과 긴 설명/JSON을 내부 스크롤합니다. footer확인/취소/Undo는 하단 HUD 위에 유지하고 전체화면 버튼에 접근합니다. 실제 iPhone/Safari/Firefox·기기 GPU·OS 파일선택기 자체는 미검증입니다. Chromium의 표준 파일 입력/다운로드와 네이티브 Fullscreen은 실제 동작을 확인했습니다.

## 성능·한계

정수 배분은 광석 quanta 수와 무관하게 셀/매장지 수에 비례하고, 실제 생성/평균 검증은 Worker에서 수행합니다. 한 천체의 기존 색상 Mesh1개와 필요 시 광맥 연결 LineSegments1개를 사용합니다. 반복 모드/미리보기/취소 후 geometry가 기준 수준으로 돌아오고 canvas/편집기는1개입니다. 소프트웨어 렌더링의 기존 전체 지도 표본은 약4.3FPS였으며 동시 검사 부하를 포함하므로 모바일 기기 성능이나60FPS를 보장하지 않습니다.

지구 대륙붕은 육해혼합 광역 구역의 근사이며 실제 수심 검증이 아닙니다. 기본 품질 double평균 허용오차1e-6(테스트1e-10), 배치 대량 추첨은 bounded normal approximation입니다. 매우 희귀한 꼬리 분포의 정밀 이항 시뮬레이터는 미구현입니다. 실제 생산/고갈/경제/테라포밍/함선/연구를 실행하지 않습니다. 미래 잔량/재고/현재 기후는 원본과 분리합니다.

## 재현과 패키지

```sh
npm run dev
node scripts/generate-sol-presets.mjs
npm run check
npm test
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-smoke.mjs
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-administration.mjs
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-planet-surface.mjs
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-planet-generation.mjs
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-generation-safety.mjs
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-resources.mjs
python3 scripts/package-release.py
```

HTML ZIP에는 42모듈/두 자원·환경 Worker/19개v2와manifest/사용자v1원본/지구마스크/Three.js/표면이미지/라이선스/serve.py/SOURCE.json이 들어갑니다. 압축 해제 후 `python3 serve.py` (Windows `py serve.py`)、file:// 직접 실행은 지원하지 않습니다. 최종 ZIP의 CRC/소스 SHA/독립 서버에서 공식 로드와 Worker 미리보기를 별도로 검증합니다.

## v0.5D.1 — 광맥 집중도·성분별 품질 편차 보정

같은 `feat/v0.5d-resource-geology-grade-sol-presets` 브랜치/PR #6에 추가 커밋으로 반영합니다. [D.1 지시서](D1/REQUEST_KO.md), [천체별 전→후 표·지구 그룹별 셀/실제 U](D1/COMPARISON.md), [전 성분·A·k·예외 진단](D1/REPORT.json), [v0.5D25bc2ea 고정 비교 기준](D1/BASELINE.json).

- 지구: **광맥1그룹·2셀 → 3그룹·13셀**, 그룹당 최소3셀, 육지/대륙붕 후보40셀 중13셀 사용. 최대 셀 비중 약35.6%→10%, 최대 그룹100%→50%. 총량/25·65·10%/형태별 품질 평균은 그대로입니다.
- 공식19개 모두 단일 셀 ore≤10%, 2개 이상 광맥 그룹 각각≤광맥 예산50%를 **정수 quanta**로 검사했습니다. 예외 천체 허용 목록은 비어 있습니다. 수소 공급원도 원본과 같습니다.
- 고정 최소3/가변 최소2·최대6그룹, 최소3셀/그룹·후보25% 커버리지의 공용 규칙을 프로필로 분리했습니다. 가중치 분배에서 상한에 닿은 셀/그룹을 포화시키고 같은 형태의 잔여 후보로 정수 재분배합니다. 지구 시드10개 모두 기준을 만족하면서 그룹수/위치/길이가 달라졌습니다.
- 타이탄처럼 광맥 예산 quanta가 홀수인 경우2그룹으로50%씩 정확히 나눌 수 없습니다. 후보가 충분할 때3그룹 이상을 선택하므로 공식 데이터의 상한 예외로 처리하지 않았습니다. 임의 입력의 후보 부족/단일 quanta 예외 사유는 concentrationDiagnostics에 남기고 테스트합니다.
- 저·고 성분을 각각 중심화·정규화해 `A=min(0.05,0.75t,0.75(1−t))`까지 사용합니다. 중품질 범위 위반만 공통k로 줄이며 개별 clamp는 하지 않습니다. 공식 프리셋에서 k<1인 형태는 없고, 별도 합성 테스트에서 k<1·극단0/100%·단일 매장지를 확인했습니다.
- 지구 심층 고품질 **28.0642–38.0000%**, 금성 심층 고품질 **77.0000–85.6280%**로 확대됐으며 지정 가중평균33/82%를 유지합니다. 중품질은 지시서의 `1−저−고` 종속값이므로 두 편차의 합에 따라±5%p보다 클 수 있습니다. 모든 실제 중품질 범위도 REPORT.json에 기록합니다.
- 자원 generatorVersion2 / qualityJitterPolicy=per-component-v2 / maxDeviation0.05를 기록합니다. 기존 jitter는 기존 UI 호환용으로 **성분별 최대 편차 요청의 별칭**으로 남깁니다(최대0.05). 격자 generatorVersion1과 템플릿 schema2는 그대로입니다.
- 배치용 시드만resources-v2로 분리하고 총량/형태/타깃·수소 공급원의 키는resources-v1을 유지했습니다. 그래서 가변 천체의 기존 숫자도 deep-equal로 같습니다. 새로운ore ID로 초기 인지 참조를 재생성합니다.
- generator1인 기존 로컬 초안은 자동으로 덮어쓰지 않습니다. fill-unset의 완전 보호 결과도 원래 메타데이터를 그대로 유지합니다. 새 공식 배분은 자원→공식 프리셋 미리보기→확인/백업/적용으로 전환합니다.

### D.1 실제 검사

`npm run check` **43모듈**, `npm test` **131개(기존122+신규9)**. 상한/편차 폭/예산·평균·지구 원본/가변타깃·시나리오·수소 불변/시드10개/구형 로컬 보호와 두 독립 임시 폴더의 공식19개 **바이트 재현**을 검사했습니다. [단위 로그](D1/unit-tests.log).

기존 브라우저6개와 새 D.1 시각/구버전전환 검사 결과는 다음 로그에 보존합니다. 실제 iPhone/Safari/하드웨어 GPU는 미검증입니다. UI/격자/지형/시나리오/시계/전체화면 구조는 수정하지 않았습니다.

[지도](D1/browser-smoke.log) · [행정/시간](D1/browser-administration.log) · [표면](D1/browser-surface.log) · [기존 생성](D1/browser-generation.log) · [안전 경로](D1/browser-safety.log) · [자원](D1/browser-resources.log) · [D.1 지도/로컬 generator1 보호·명시적 전환](D1/browser-correction.log).

PC: [광맥](D1/screenshots/earth-veins-1440.png), [고품질 확률](D1/screenshots/earth-quality-1440.png).
844×390: [광맥](D1/screenshots/earth-veins-844.png), [고품질 확률](D1/screenshots/earth-quality-844.png).

사용자 최신 요청에 따라 D.1 HTML ZIP은 새로 만들지 않습니다. 기존 실행 사이트를 같은 접근 범위로 갱신합니다. 배포용 tar만 만들며 기존 D/C 등의 ZIP 링크는 과거 버전으로 유지합니다.
