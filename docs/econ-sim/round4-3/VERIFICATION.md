# ECON-SIM-4.3 검증과 재현

2026-11-07 Asia/Seoul. 기능/보존 검증과 경제 합격 판정을 구분한다. 같은 폴더의 JSON/로그/캡처가 근거다.

| 검사 | 실제 결과 |
| --- | --- |
| npm run check | 114소스 모듈 통과 |
| npm test | 기존666+신규41 = 707통과, 실패/생략0 |
| 기존파일 보존 | 1,465개 현재 SHA256·기준 Git blob 동일, 수정/삭제0 |
| 최종 정식 실험 | 3,340실행 · 5시드/240개월 · 무결성 실패0 |
| 새 경로 독립 재실행 | 192건 원해시 동일 |
| 불변4.2.2 대조 재실행 | 120건 원해시 동일 / 보관1,220건 재사용 |
| 차단 전 미래정보 미열람 | 24건 월0–60 경로 동일 |
| 생산 정수Q 재분석 | 2,940건, 모든229개12개월 창 정보 포함 |
| H-CUT 정보 정수식 | 360ON 창 · 전해0 |
| 물 승인 감사 | 27,338자산 · 고정0.72/12개월/최소 충족 |
| 월 생명유지 판정 재검사 | 10,240물/산소 조건 |
| 연간 재정 정수식 | 160,800천체년 · 세수/지출/합계 일치 |
| 기록된 현금 안전선 | 8,706소유자 요약 · 거래후 여유 음수0 |
| 수동 원장/생명유지 추적 | 6경로, 원해시 동일 |
| 정식 실행 소스 | run-source-manifest.json의 경제 source·분석·입력 해시 동일 |


감사 수는 반복된 시험 세계의 합계이며 단일 세계의 실제 건설 수가 아니다. 국가 잔액=초기C+수입−지출, 물=초기+얼음+환원+계량 취수−생명유지−전해, O2=초기+전해−생명유지, 얼음 유일한 잔량 감소=물 source를 매 tick 감사했다. 기존 C/U·자본·SCU·H provenance·반응 질량 감사도 유지한다.

신규41개는 단일 금고/자금 고갈/정수 복식 원장/SCU 귀속/실물 비이동, 세율 상속과0%·감면 경계·섹터 묶음/양의 세율 실제 세수, 수요 단위, 유상 정부/민간 건설·실패 원자성·유한 매장량·전력0·냉간 재개 비용, 물 거래/provenance·산소 무매출·양의 액화비, 얼음 미래 공급의 물 조건·생활 우선·소유자 분리·원천 불변, 기존 고정값·자료 보존·불변422 대조, 미래 차단 미열람, 월99%/유예, 국가 재정·예산17년, 독립 유지비의 구호 유보량을 검사한다. **도시 브라운아웃에서도 명시적 얼음/산소 부하를 우선하는 회귀**가 포함된다. 기존 저장 이관·산업·SCU/탐사/지도 단위 회귀도 전체 테스트에 포함된다.

개발 중 도시 필수 부하가 명시적 생명유지보다 먼저 가던 선행 실험3,340회는 최종 판정에 사용하지 않았다. 수정 전 근거와 source manifest는 [development-pilot.json](development-pilot.json)에 남겼다. 우선순위 수정 후140회 간이 실험과 최종3,340회를 실행했고, 최종41개 신규/707개 전체 검사를 통과했다. 기존4.2.2 이전 산출물은 어떤 단계에서도 고치지 않았다.

## 성능

최종75회는 정식 배치/전체 테스트/경로 재현/진단이 끝난 뒤 한 프로세스에서 버전별15회 교차 측정했다. 검증 스크립트의 예비75회도 보존해 최종 source에서 총150회 측정했으며, 아래에는 [performance.json](performance.json)의 별도 최종75회만 인용한다. 최초 실행도 포함하고 p95는15개 중 최댓값이다. Node v24.19.0,AMD EPYC 9V74 80-Core Processor, parallelism4. 정식 wall time 542.46초/3worker다.

| 240개월1회 | p50 ms | p95 ms |
| --- | --- | --- |
| round41 | 231.39 | 356.06 |
| round422 | 500.14 | 643.65 |
| round43Peace | 590.71 | 773.32 |
| round43Colony | 584.43 | 676.01 |
| round43Stress | 306.5 | 395.45 |

충격 경로는 활성 자산·주문 수가 달라 더 짧을 수 있다. 게임FPS/실기기 목표가 아니다.

## 브라우저·스크린샷

Chromium/Playwright **1440×900·844×390·667×375·390×844** 통과.8그래프·18격자·후보/천체/자력/구호/시나리오·공급 차단 음영·얼음 금지/감면 선택·연간20행·이전 금고 비교·새 물/산소/순재정/국가C의 원자료 일치·PC JSON 내보내기를 검사했다. 모바일은 터치 에뮬레이션,44px 이상 조작 영역, 전체 페이지 가로 넘침 없음·끝까지 스크롤을 확인했다.

단일HTML의 첫시드536경로와5시드 요약을 내장했다. HTML1회 외 JSON/API/CDN/폰트 요청0,네트워크 차단 context에서 같은 HTML 바이트를 직접 로드해 외부요청0·오류0이다. 원본 JSON/CSV 정밀도는 유지하고 HTML 월경로 복사본만 소수6자리다. 브라우저가 읽은 summary/source/performance 해시와 HTML SHA도 검사했다.

[PC 초기](screenshots/report-initial-1440.png) · [PC 전체](screenshots/report-selected-1440.png) · [달 재정](screenshots/report-moon-finance.png) · [844가로](screenshots/report-selected-844.png) · [667가로](screenshots/report-selected-667.png) · [390세로](screenshots/report-selected-390.png) · [오프라인](screenshots/report-offline.png)

[브라우저 결과](logs/report-browser.json) · [전체 테스트](logs/full-tests.log) · [신규 검사](logs/new-tests.log) · [source/보존](logs/preservation.log) · [재현 감사](verification.json) · [수동 진단](fiscal-life-diagnostics.json)

**미검증:** 게임 전체 브라우저 회귀, 실제 모바일 기기, Safari/Firefox, 네이티브 file:// 접근 정책. 게임 파일은 바이트 불변이다. HTML은 최신 DecompressionStream 지원 브라우저가 필요하다. 새 게임 사이트를 배포한 결과가 아니다.

## 재현

저장소 루트, 같은 입력/시드에서 실행한다. 정식 실행은 이 버전 결과만 다시 쓰므로 보관이 필요하면 먼저 복사한다. 간이는 --quick --out artifacts/econ43-quick으로만 실행할 수 있고 정식 결과를 덮어쓸 수 없다.

```bash
npm run check
npm test
node scripts/econ-round4-3-calibrate.mjs --workers 3
node scripts/econ-round4-3-verify.mjs
node scripts/econ-round4-3-diagnostics.mjs
node scripts/econ-round4-3-performance.mjs
node scripts/econ-round4-3-summarize.mjs
node scripts/econ-round4-3-report.mjs
python3 -m http.server 5174 --bind 127.0.0.1
```

다른 터미널에서 설치된 경로에 맞춘다.

```bash
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-economy-round4-3-report.mjs
node scripts/econ-round4-3-document.mjs
node scripts/econ-round4-3-preserve.mjs
```

로컬: http://127.0.0.1:5174/docs/econ-sim/round4-3/report.html. 인접 JSON 없이 HTML에 내장한 데이터로 동작한다.
