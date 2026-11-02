# 검증 기록 — v0.5A

검증일: 2026-10-30 (Asia/Seoul). 기준: v0.4 `b303764`. 작업 브랜치 `feat/v0.5-admin-regions-time-control`. [v0.4 기록](../v0.4/VERIFICATION.md), [완료 보고](REVIEW.md).

## 자동 검사

- `npm run check`: 소스 모듈 **18개 문법 검사 통과**.
- `npm test`: **56개 통과, 실패·건너뜀 0**. 기존 36개를 삭제하지 않고 행정 모델 12개·시간 제어 8개 추가.
- `git diff --check`: 통과.
- v0.4와 `hex-sectors.js`, `game-space.js`, `astronomy-data.js`, `selection.js`, `validation.js` 비교: 변경 없음. `data.js`는 시간 환산 상수 한 줄만 변경. `model.js`의 천체력·자전 수식 유지.

행정 모델은 미지정 경계, 4칸 연결, 중복 없는 실제 변 분류, 구멍의 내·외 경계, 중복/비연결/다른 시스템 ID의 원자적 거부, 대상 ID 유지 합병, 연결이 끊기는 제거 차단, 메타데이터·삭제·Undo, 단조 ID, 확장 불변성, 시스템별 저장, 손상/구버전 원본 보존·명시적 백업 복구, 저장 실패의 메모리 유지까지 검사합니다.

시간 모델은 60초×1×=게임600초, 전체 10개 프리셋, 잘못된 속도/상한 거부, 프레임 분할 동등성, 일시정지, 상한/요청 분리·복원, UTC 윤일/연도 경계, 정상 전경 지연의 전량 누적, 숨김 복귀와 60초 이상 대기 신호를 검사합니다. 원래 시간 테스트의 상대적 분할 검증도 그대로 통과합니다. 항성계 전환 시 days를 0으로 기대하던 기존 테스트는 단일 세계 시계를 보존하도록 기대값을 바꾸어 유지했습니다.

## 실제 브라우저

Chromium/Playwright + 소프트웨어 SwiftShader. PC 1440×1000, 터치 에뮬레이션 844×390·667×375. API/DB는 없으며 서버는 정적 자산만 제공합니다. 저장은 브라우저 localStorage입니다.

**기존 지도 회귀:** `tests/browser-smoke.mjs`의 v0.4 전체 시나리오 통과. 천체 선택 시 자동 줌 없음, 팝업 추적/화면 제한/가림, 실제 천체와 달 보조 선택, 섹터 선택, 드래그·핀치, 소행성대 강조, 기준 평면/축/측면 시점, 지도/고리/고정 크기, 3개 시스템 전환/DOM·GPU 정리, 도움말·배속을 유지했습니다. 속도 버튼에 접근하는 경로만 새 메뉴에 맞게 갱신했습니다.

**새 행정/시간 흐름:** `tests/browser-administration.mjs` 통과.

- 실제 캔버스에서 태양과 겹친 중심 셀을 편집 모드로 선택하고 연결된 4칸 생성.
- 이름 변경·Undo·인접 셀 추가·제거·두 구역 통합·삭제. 연결을 끊는 제거는 UI 오류를 표시하며 원상태 유지.
- 내부 < 미지정 경계 < 외곽 알파 검사, 편집 시만 전체 경계 generation 증가.
- 탐사→행정→탐사 전환 시 기본 경계 복구. 지도 모드 전환은 선택 천체·카메라를 유지하고, 행정 모드에서는 중앙 셀의 별도 기본 강조선을 숨겨 내부선 위계를 보존. 새로고침 후 동일 행정 JSON 복원, 시계는 기본 1×.
- 1링 전체 6칸 선택·구멍 있는 구역 생성. 중앙은 미지정이고 내곽 경계 유지.
- 0.1×/1×/100×에서 실제 performance.now 경과와 게임 초를 비교. 각각 현실의 1/10/1,000배로 진행. 일시정지 증가 0, UTC 시·분·초 표시.
- 이동·경사 다중 항성 시험계에서 실제 셀 클릭과 구역 경계 일치. Sol 저장과 격리.
- 반복 편집·삭제·시스템 전환 후 canvas 1개, GPU geometry 수가 기준 수준으로 복귀.
- 두 모바일 화면에서 실제 터치 생성, 드래그/다중 터치 핀치가 편집·통합을 일으키지 않음. 스크롤 드로어·닫기·배속 메뉴 접근, 수평 오버플로 없음.
- 도구를 접으면 편집 모드 종료. 스크롤 중에도 드로어 제목/닫기 고정.
- 두 스크립트 모두 미처리 JavaScript 예외·콘솔 오류 없음.

로그: [기존 지도](browser-regression.log), [행정·시간](browser-administration.log), [순수 검사](unit-tests.log).

브라우저 visibility 숨김의 시간 누적 계약은 순수 ForegroundClock 테스트로 검증했습니다. 실제 OS 절전·모바일 앱 전환은 실기기 검증하지 않았습니다. 시간 배율의 브라우저 검사는 실제 전경 경과시간을 사용합니다.

## 성능 관찰

행정 데이터가 없는 기본 탐사 화면은 기존과 같은 **draw call 55 / 삼각형 172,850**입니다. 새 행정 모드에서는 내부/기본/외곽/면/선택/미리보기를 소수의 배치 레이어로 추가합니다. 호버/프레임마다 전체 경계를 재생성하지 않습니다. 반복 전환 시 geometry 정리도 브라우저에서 검사합니다. 짧은 소프트웨어 렌더링의 FPS로 실제 모바일 성능 향상을 주장하지 않습니다.

## 실행 패키지와 배포

`scripts/package-release.py`는 커밋 SHA를 기록한 HTML ZIP과 `.openai/hosting.json + dist` 배포 아카이브를 만듭니다. ZIP은 `index.html`, src/assets/vendor, 라이선스, `serve.py`, 실행 안내를 포함하며 자기 자신이나 `.git`, 자격증명, 브라우저 저장 상태는 포함하지 않습니다. 압축 검사와 별도 압축 해제 서버의 HTTP 로딩을 확인합니다.

기존 사이트의 접근 범위를 유지합니다. GitHub main 병합과 별개로 같은 검증 커밋을 Sites 소스 저장소의 설정된 배포 브랜치에 전송하고 저장 버전을 배포합니다. 최종 배포 결과와 실행·ZIP 링크는 PR 및 완료 응답에 제공합니다.

## 재현

```sh
npm run dev
npm run check
npm test
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-smoke.mjs
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-administration.mjs
python3 scripts/package-release.py
```

## 한계

실제 모바일 GPU·Safari/Firefox·장기 메모리·OS 절전 복귀는 미검증입니다. 큰 격자의 무한 확장 부하는 검증하지 않았습니다. localStorage는 사용자 브라우저/도메인 범위이고 전체 게임 저장·서버 동기화가 아닙니다. 함선·전투·경제·인구·건설·정책·연구·안개·오프라인 진행은 구현하지 않았습니다.
