# SPACE_Project UI-1 구현 보고

2026-11-05 (Asia/Seoul)

실행: https://space-project-sol-prototype.dagoku.chatgpt.site — **Sites 버전 15**, 기존 소유자 전용 접근 유지.

제출: https://github.com/0-FLANDRE-0/SPACE_Project/pull/20 — main 대상, 미병합.

[배포 출처](deployment.json): 테스트한 GitHub 커밋 `47551c4d9fdee27289ac081376fd170a313b729a`와 Sites 소스 `6f5ea8ccf80ce122c1e16e205e67532e721b899d`의 dist·호스팅 설정·package.json 트리/블롭 일치를 확인했다. 네이티브 배포 결과는 succeeded다.

## 기준과 범위

- 작업 브랜치: `feat/ui1-continuous-zoom`, PR 대상: `main`. 병합하지 않는다.
- 시작 커밋: `663ea9f3b84770a1b67a2c82598922ed9ecfd5a1`.
- M2 PR #19의 병합과 `879bfe69ec1ce5fcf6301825fb473eb47e85283b` 포함을 확인했다.
- 아카이브: `cc2ae8349a4e0a4d41c65c4b8509e68632060c54`; 보충 §20·§21과 관련 §22를 읽었다.
- [원문 지시서](REQUEST_KO.md), [표시 결정·임시값](DECISIONS_KO.md), [파일 보존 명세](preservation-manifest.json).
- 경제·물류·연구·전투·저장 규칙 및 천체·격자·함선·탐사 수치는 변경하지 않았다.

## 구현 결과

### 연속 확대와 입력

성계에서 행성에 접근하면 기존 M1b 단계(고→중→저→표면)를 따라간다. 표면 단계에 들어간 즉시 기존 SurfaceView가 생성되어 섹터 선택과 정부 산업 패널이 작동한다. 축소로 표면을 벗어나면 선택과 패널이 정리된다. 같은 행성권에서 더 축소하거나 팬하여 벗어나면 추종과 카드가 해제된다. 기존 히스테리시스 및 최소 거리 제한을 유지했다.

‘표면 지도’는 1.7 R로 자동 확대하는 지름길이다. M2 ‘정밀: 섹터 지정’도 같은 지름길을 사용한다. 숨겨진 옛 표면 상단 바와 복귀 버튼을 일반 조작에 사용하지 않는다. 별도의 표면용 카메라 저장/복원 상태도 제거했다.

M2 다중 선택 중에는 섹터가 우선이다. 그 외에는 함선 3D/아이콘, 활성 궤도점·라그랑주, 섹터 순서로 판정한다. 표면에서도 실제 함선과 이동 명령을 유지하며, 이동 중에는 기존 저궤도 그래프 점만 GPU로 표시한다. 별도의 표면 격자나 이동 엔진을 만들지 않았다.

### 행성 카드와 섹터 패널

카드는 이름·종류, 인구·섹터 수, 대략 탐사율·정밀 완료 수, 가동/정지/건설 시설 수를 표시한다. 실제 전력 부족 경고가 있을 때만 경고한다. 재고 수량은 자원 바에만 표시한다. 섹터를 고르면 카드 내용은 패널 머리글에 합쳐진다.

가로 패널은 헤더 아래에서 화면 하단까지 길게 배치하고, 시간 바와 함선 명령은 옆 빈 공간에 놓는다. 세로 패널은 하단의 최대 50% 높이를 사용하고 시간 바는 그 아래에 둔다. 독립 스크롤과 정부 구획·산업 상세 기능을 유지한다. 섹터를 사용하는 동안 함선 상세는 접고 하단 명령을 유지하며, 패널을 닫으면 상세를 복원한다. 함선 선택 시 탐사 범례도 빈 공간으로 옮기고 필요하면 내부에서 스크롤한다. 탐사/매장량/인구/시설 버튼은 패널 상단에 있으며, 카드에도 작은 전환을 제공한다.

패널이 열리면 `camera.setViewOffset()`으로 빈 영역의 중심에 행성을 투영한다. 카메라의 월드 위치와 OrbitControls.target은 옮기지 않는다. 패널 이동·화면 크기/방향 변경에도 다시 계산하며 닫으면 투영을 복원한다. 섹터와 함선 레이는 이 투영 행렬을 그대로 사용한다.

### 자원 바와 탐사 문구

크레딧과 인구는 국가 고정, 원광·합금·수소는 추종/선택 천체 또는 전체 합계다. 원광은 기존 장부의 자유+봉인 재고를 한 번씩 합산한다. 합금·수소는 기존 planetInventory 투영을 그대로 참조한다. 합계는 정수 Q를 BigInt로 합산해 JSON에는 문자열로 전달한다. 0.001 U도 표시할 수 있다.

월 변화는 기존 산업 UI와 같은 현재 게임월의 기록된 생산·소비 누계다. 월 경계는 기존 산업 화면과 동일하다. 원광은 채굴−제련 소비, 수소는 생산−소비다. 새 경제 계산이나 미래 예측은 없다. 크레딧 월간 원장은 없으므로 미집계로 표시하고, 금고 자체가 미설정이면 미정으로 표시한다.

펼침은 한 번에 하나이며 바깥/같은 버튼을 누르면 닫힌다. 천체별 재고·등급·기록 누계를 보여주며 행을 누르면 기존 focus로 이동한다. 크레딧은 국가 금고 하나이므로 가상의 천체별 금고를 만들지 않았다. 잔여물은 제외했고 미정의 물·산소·전략 자원은 숨긴다. 지질 실제값이나 개발자 검수 데이터는 읽지 않는다.

가능성 등급은 대략 탐사 작업이 시작된 후에만 표시한다. ‘매우 적음 / 적음 / 평균 수준 / 천체 평균보다 많음’으로 바꾸고 지도 범례도 맞췄다. 경계 0.35·0.85·1.4와 원래 탐사 계산은 바꾸지 않았다.

## 변경 파일

| 파일 | 수정 |
|---|---|
| `dist/src/ui1-data.js` | 표시 임시값, 자원 슬롯 예약, 비교 문구 |
| `dist/src/ui1-model.js` | 읽기 전용 재고/월 누계/인구 집계, 투영 계산 |
| `dist/src/ui1-ui.js` | 자원 바·펼침·행성 카드, 화면 배치와 렌즈 이동 |
| `dist/src/scene.js`, `planetary-surface-ui.js` | 확대 단계 기반 표면 생명주기, 지름길, 입력 순서 |
| `dist/src/ship-layer.js`, `ship-ui.js`, `orbit-view.js` | 표면 함선 선택/명령, 저궤도 이동점 유지 |
| `dist/src/surface-distribution-ui.js`, `survey-ui.js` | 공용 분포 버튼, M2 지름길, 비교 문구·표시 시점 |
| `dist/src/draggable-sector-panel.js`, `context-panel.js` | 새 HUD 경계 콜백 |
| `dist/src/main.js`, `dist/index.html`, `dist/style.css` | 초기화·해제, DOM 재배치와 반응형 배치 |
| `tests/ui1.test.js`, `tests/browser-ui1.mjs`, `tests/browser-ui1-layout.mjs` | 신규 집계·보안 경계·화면·입력 회귀 |
| `tests/helpers/continuous-surface.mjs` | 축소 종료와 근접 화면의 노출된 섹터 내부점 탐색 |
| 기존 브라우저 테스트 7개 | 숨겨진 복귀 버튼→축소, 공용 버튼 위치, 새 패널 높이/자동 확대 계약 반영 |
| `tests/helpers/resource-foundation-preservation.js` | draggable UI 파일의 정확한 변경 예외만 추가 |
| `scripts/ui1-preserve.mjs`, `docs/ui1/*` | SHA256·허용 파일 검사, 보고·로그·화면 |

기존 브라우저 테스트의 산업 공식, 보존, 저장 이관, 명령 결과 및 탐사 완료 검사는 유지했다. 가까운 시점에서 섹터 중심이 화면 밖에 있을 수 있어, 보이는 내부점과 주변 레이 일치를 검증하는 공용 선택 도우미를 사용한다. M2의 주기적 공개 탐사 갱신이 존재하므로 분포 성능 검사는 같은 순간의 연속 refresh가 버퍼를 재사용하는지 확인한다. 그래픽 자원 회귀는 M1b의 유한한 지연 생성 궤도 캐시를 먼저 준비한 뒤, 기존의 반복 진입 증가량 ≤1 및 단일 표면·캔버스 검사를 유지한다. 카메라 보존은 10⁻⁸ 이내로 검사한다. iframe 검사는 DOM과 실제 초기화 완료를 기다린 뒤 네이티브 권한 제한을 확인한다.

## 검증

검증 결과와 실행 명령은 최종 로그 및 `regression-results.json`, `browser-results.json`을 참조한다. 하드웨어 성능/FPS는 측정하지 않았다. Chromium SwiftShader에서 동작, 투영 좌표, 레이 판정, 겹침과 렌더 호출 수를 확인한다.

| 검사 | 결과 | 근거 |
|---|---|---|
| 기준 단위 테스트 | 577/577 통과 | [기준 로그](logs/baseline-tests.log) |
| 최종 단위 테스트 | **589/589 통과** (신규 12) | [최종 로그](logs/tests.log) |
| 구문 검사 | 103개 모듈 통과 | [로그](logs/syntax.log) |
| 보존 검사 | **547개 SHA256 일치**, 정확한 변경 허용 목록 통과 | [로그](logs/preservation.log) |
| 새 연속 확대 전체 흐름 | 4화면 통과 | [결과](browser-results.json), [로그](logs/browser-ui1.log) |
| 실제 HUD 배치·끌기·회전 | 4화면 통과, 자원/패널/시간/명령 겹침 0 | [기하 결과](layout-results.json), [로그](logs/browser-ui1-layout.log) |
| M1b 궤도·이동 | 4화면 통과, 이동점은 한 번의 추가 GPU 호출 | [결과](m1b-browser-results.json), [로그](logs/browser-m1b.log) |
| M2 탐사 전체 흐름 | 4화면 통과 | [결과](m2-browser-results.json), [로그](logs/browser-survey.log) |
| 산업/SCU/이관/초기화 | 각 회귀 통과 | [전체 10종 목록](regression-results.json) |
| 표면 편집·전체화면 | 19개 천체 + 임의 항성계 및 모바일 통과 | [렌더 결과](planet-surface-render-results.json), [로그](logs/browser-planet-surface.log) |
| 분포/일반 지도 | PC·모바일 회귀 통과 | [분포](logs/browser-surface-distributions.log), [지도](logs/browser-smoke.log) |
| 읽기 전용 HUD 비용 | 19천체 초기 상태 100회, 중앙값 약 0.14ms; 상태 변경 없음 | [범위와 측정값](logs/hud-benchmark.log) |

집계·정확한 Q 합계·봉인 광석 중복 방지·월 경계·미정 슬롯·실제값 미참조·무변경성을 신규 단위 테스트로 확인했다. 브라우저에서는 실제 마우스/터치, 함선/궤도점/다중 선택 우선순위, 렌즈 이동 중 레이 판정, 패널 열림/닫힘 시 월드 카메라/회전 기준점 보존, 달 지름길, DEV 네 도구와 새로고침 초기화를 검증했다. 브라우저 성능 로그의 SwiftShader FPS는 실제 기기 성능 수치로 해석하지 않는다.


## 화면

아래는 실제 Chromium 렌더링이다. 각 행은 같은 화면 크기에서 성계→궤도→표면으로 접근한다.

| 화면 | 성계/전체 자원 펼침 | 고/중/저 궤도 | 카드·표면 | 섹터·투영 이동 | 천체 자원 펼침 | 비교 문구/함선 명령 |
|---|---|---|---|---|---|---|
| 1440×900 | [성계](screenshots/system-1440.png) · [전체 원광](screenshots/system-ore-1440.png) | [고](screenshots/high-1440.png) · [중](screenshots/middle-1440.png) · [저](screenshots/low-1440.png) | [이동 전](screenshots/surface-1440.png) | [이동 후](screenshots/sector-shifted-1440.png) | [지구 원광](screenshots/earth-ore-1440.png) | [비교](screenshots/comparison-1440.png) · [명령](screenshots/layout-commands-1440.png) |
| 844×390 | [성계](screenshots/system-844.png) · [전체 원광](screenshots/system-ore-844.png) | [고](screenshots/high-844.png) · [중](screenshots/middle-844.png) · [저](screenshots/low-844.png) | [이동 전](screenshots/surface-844.png) | [이동 후](screenshots/sector-shifted-844.png) | [지구 원광](screenshots/earth-ore-844.png) | [비교](screenshots/comparison-844.png) · [명령](screenshots/layout-commands-844.png) |
| 667×375 | [성계](screenshots/system-667.png) · [전체 원광](screenshots/system-ore-667.png) | [고](screenshots/high-667.png) · [중](screenshots/middle-667.png) · [저](screenshots/low-667.png) | [이동 전](screenshots/surface-667.png) | [이동 후](screenshots/sector-shifted-667.png) | [지구 원광](screenshots/earth-ore-667.png) | [비교](screenshots/comparison-667.png) · [명령](screenshots/layout-commands-667.png) |
| 390×844 | [성계](screenshots/system-390.png) · [전체 원광](screenshots/system-ore-390.png) | [고](screenshots/high-390.png) · [중](screenshots/middle-390.png) · [저](screenshots/low-390.png) | [이동 전](screenshots/surface-390.png) | [이동 후](screenshots/sector-shifted-390.png) | [지구 원광](screenshots/earth-ore-390.png) | [비교](screenshots/comparison-390.png) · [명령](screenshots/layout-commands-390.png) |

추가 화면: `multi-select-*`(M2), `surface-ship-*`(실제 함선), `moon-surface-*`(위성), `resized-panel-390.png`(방향 전환).

## 실행과 조작

```sh
npm run dev
# http://localhost:5173
npm run check
npm test
node scripts/ui1-preserve.mjs
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-ui1.mjs
```

PC: 행성에 초점을 맞추거나 자원 펼침의 행성을 누르고 휠/+/−로 접근한다. 표면 섹터를 클릭하고 머리글로 패널을 끌 수 있다. 패널을 닫거나 축소하면 지도 공간이 복원된다. 함선 선택 후 ‘이동’으로 궤도점·라그랑주를 고른다.

모바일: 핀치/확대 버튼, 섹터 터치, 패널 제목 끌기와 같은 입력이다. 상단 자원 바와 추가 버튼 줄은 별도 터치를 받는다. 일반 화면에서 편집 기능은 숨기고 기존 7회 로고 제스처로 DEV에 진입한다.

## 남은 항목과 검증 한계

- 크레딧 월간 변화는 원천 기록 추가가 필요하다. UI1에서는 새 경제 계산을 만들지 않았다.
- 물·산소·전략 자원, 정거장/물류 재고, M3 이후 경제 연결은 런타임 계약이 정해진 뒤 연결한다.
- 세로 50% 패널, 카드 접힘, 경고 3개월 등의 값은 확정 게임 규칙이 아닌 표시 임시값이다.
- 실제 모바일 기기의 발열/FPS, 브라우저별·노치별 테스트는 별도 실기기 검증이 필요하다. 지정 해상도에서 Chromium 터치 입력을 검증했다.
- 네이티브 Sites 결과로 배포 성공을 확인하며, 보호된 라이브 사이트 브라우저 재검사는 별도로 통과했다고 주장하지 않는다.
