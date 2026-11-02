# v0.5E 검증 및 완료 보고

2026-11-01 (KST). 기준 PR #6 `47c062b`. 구현 범위와 잠정 수치는 [IMPLEMENTATION.md](IMPLEMENTATION.md), 사용자 승인/UI 보강은 [UI_SUPPLEMENT_KO.md](UI_SUPPLEMENT_KO.md)에 기록했다.

## 자동 검사

- `npm run check`: 소스 48개 모듈 구문 검사.
- `npm test`: 151개 통과, 실패/취소/건너뜀 0. 기존 131개를 유지하고 산업 20개를 추가했다.
- [구문 로그](syntax-check.log), [단위 회귀 로그](unit-tests.log).
- 산업 검사: 일반/개발 캠페인 분리·재지급 방지, 슬롯·면적, 미발견 자원 비노출·차단, 정확한 기본 비용과 중복 차감 거부, 80 경계의 연속 난도, 채굴/품질/수소 질량 보존, 시간 묶음·저장/로드·100× 일관성, 같은 행성 lot 소비/출처, 고정 합금/잔여물 수율, 무수소 제련, 부분 수소의 중간 보너스, 증설 중 기존 생산, 구형 개량 대상, 손상 저장 격리/백업, 저장 위변조 검증, 수소 원천 없음/미확인/광석 고갈, 재고 수용 한도 선검사, 다중 시설의 같은 매장지 잔량 공유.

## 원본 보존

산업 단위 검사에서 정적 `sol-*-v2.json` 19개를 `git show 47c062b:...`와 바이트 단위로 비교한다. `git diff --exit-code 47c062b -- dist/data`도 변경 없음이다. 지구 92, 화성/달 42 셀, 19개 격자와 원천 예산·품질·수소 원천·환경·2100 시나리오를 보존한다. 원본 지구 자료와 v1/v2 로컬 저장키도 유지한다. 천문 데이터/공전·자전 코드, 게임 AU/Planet Size/Star Size는 변경하지 않았다.

## Chromium / Playwright

`/usr/bin/chromium` + Playwright, SwiftShader 소프트웨어 렌더러로 실행했다. 브라우저별 완료 로그를 함께 제공한다.

```sh
npm run dev
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-industry.mjs
```

| 스크립트 | 검증 범위 | 로그 |
|---|---|---|
| `browser-smoke.mjs` | 기존 지도·궤도·선택·시스템 전환·카메라·배속 | [로그](browser-smoke.log) |
| `browser-administration.mjs` | 행정구역 편집·원자적 거부·모바일·저장 | [로그](browser-administration.log) |
| `browser-planet-surface.mjs` | 표면·개발자 도구·격자·JSON·전체화면·모바일 | [로그](browser-planet-surface.log) |
| `browser-planet-generation.mjs` | 생성 worker·레이어·미리보기·보존·파일·모바일 | [로그](browser-planet-generation.log) |
| `browser-generation-safety.mjs` | 선택 범위·잔여 예산·백업·취소·저장 실패 | [로그](browser-generation-safety.log) |
| `browser-resources.mjs` | 실제 19개 기본 프리셋·품질·인지·편집·이관·모바일 | [로그](browser-resources.log) |
| `browser-resource-correction.mjs` | D.1 광맥 분포/품질 지도·기존 로컬 초안 보존 | [로그](browser-resource-correction.log) |
| `browser-industry.mjs` | 네 해상도의 실제 지도 클릭/탭·패널·생산 루프·투자·복원 | [로그](browser-industry.log) |
| `browser-industry-safety.mjs` | 산업 파일 검증·백업·복원·quota·손상 격리·일반 모드 | [로그](browser-industry-safety.log) |

산업 UI는 구획 재선택/뒤로가기/전체 닫기, 잠긴 구획 표시, 취소 미정 버튼, 실제 건설 지시·완공·생산, 수소 자동/미사용, 증설·구형 개량, 게임 시계·잔량의 재로드를 검사한다. 패널 내부의 실제 터치 스크롤은 카메라에 영향을 주지 않고, 외부 드래그는 지도를 회전시킨다. 정보창 선택의 카메라 이동 격리 검사에서만 관성을 끄고 위치를 비교했으며 기존 지도 검사에서는 원래 관성/핀치를 검증했다.

고정 우측 생산/재고가 패널 경계 안에 들어오는지 기하 검사로 검증한다. 시간별 수치 갱신은 버튼 DOM을 유지하여 자동 저장/생산 갱신 중 포커스·터치가 끊기지 않게 했다. 좌측만 독립 스크롤하며 지도·표면 격자를 추가 분할하지 않는다.

## 실제 캡처

| 화면 | 패널 크기 | 일반 정보 | 건설 중 | 제련 시설 | 증설·개량 후 |
|---|---|---|---|---|---|
| PC 1440×1000 | 590×450 | [이미지](screenshots/sector-1440.png) | [이미지](screenshots/construction-1440.png) | [이미지](screenshots/smelter-1440.png) | [이미지](screenshots/facility-1440.png) |
| 가로 844×390 | 약 376×220 / 너비44.5% | [이미지](screenshots/sector-844.png) | [이미지](screenshots/construction-844.png) | [이미지](screenshots/smelter-844.png) | [이미지](screenshots/facility-844.png) |
| 가로 667×375 | 약 297×205 / 너비44.5% | [이미지](screenshots/sector-667.png) | [이미지](screenshots/construction-667.png) | [이미지](screenshots/smelter-667.png) | [이미지](screenshots/facility-667.png) |
| 세로 390×844 | 약 362×363 / 높이43% | [이미지](screenshots/sector-390.png) | [이미지](screenshots/construction-390.png) | [이미지](screenshots/smelter-390.png) | [이미지](screenshots/facility-390.png) |

## 제한과 후속 결정

- 실기기 iPhone/Safari·Android/GPU·안전 영역 하드웨어는 미검증이다. 터치는 Chromium 에뮬레이션이다. 소프트웨어 렌더러 성능 수치를 모바일 실기기 FPS로 해석하지 않는다.
- 정식 시작 재정·재고/수소 조사 정책이 미정이므로 일반 캠페인에서 임의 자원을 지급하지 않는다. 개발 캠페인은 별도 저장/표시/명시적 진입으로 전체 루프를 시험한다.
- 슬롯 배정·개방, 접근 단계·깊이, 환경/효율/준비기간, 규모/장비 투자, 경험 확산은 구성 가능한 시범값이다.
- 취소·환불·교체·철거·추가 슬롯 해금은 정책 미정이다. 관련 시설 버튼은 사유와 함께 비활성 상태다. 운영비/전력/인력은 null이며 차감하지 않는다.
- 기존 캠페인의 표면 원본 서명이 바뀌면 자동 이행하지 않고 보존·격리한다. 개발자 지질 편집과 캠페인 원천의 명시적 이행 정책은 후속 작업이다.
- 경제는 단일 `human` 정부를 운영한다. 소유권별 자료를 분리했지만 타 정부·민간 경제, 물류·연구·전투·새 배속·오프라인 진행은 구현하지 않는다.
- 한 번의 정산 요청은 최대 1,000게임일이며 개발 진행 명령은 30/180일이다. 고정 정산은 시간당이므로 UI는 최대 한 시간의 정산 대기분을 가질 수 있다.
- 요청대로 신규 ZIP은 만들지 않는다. 기존 버전 다운로드는 보존한다. GitHub main에는 병합하지 않는다.
