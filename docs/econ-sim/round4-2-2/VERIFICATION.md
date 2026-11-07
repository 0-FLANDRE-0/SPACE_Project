# ECON-SIM-4.2.2 검증·재현

2026-11-07 Asia/Seoul. **기능/원장 검증 통과와 경제 최종 합격0을 구분한다.** 원자료는 같은 폴더에 있다. 새 파일만 추가했으며 기존 결과를 다시 쓰지 않았다.

## 자동 검사

| 검사 | 실제 결과 |
|---|---|
| `npm run check` | 110소스 모듈 통과 |
| `npm test` | 기존633+신규33 = **666통과**, 실패/생략0 |
| 신규 스크립트·브라우저 테스트 문법 | 9개 통과 |
| 이전 파일 SHA256·기준 Git blob 비교 | **1,406개 동일**, 기존 파일 수정0 |
| 정식 배치 | **2,780실행**, 5시드·240개월, 무결성 실패0 |
| OFF 대조 | **1,230건**, 4.1 아카이브845 + 불변4.2.1 핵심행385 |
| 독립 대표 재실행 | E0/준비무차단80 +9개월·손실100% 대표차단24 = **104건**, 원래 경로해시 동일 |
| 미래정보 누출 검사 | 대표24건의 월0–60 경로가 같은 기술 무차단과 정확히 동일 |
| 비차단 생산 재분석 | **2,580건**, 각240개월·229개12개월 창을 정수Q로 원자료 재검사 |
| H-CUT 재분석 | ON360건, OFF대비95% 정수식·차단 전해0 검사 |
| 거래 현금 안전선 | 기록된2,624소유자 요약의 최소 거래후 여유≥0 |
| 신규 물 승인 감사 | **20,346자산**: 분율·N·검사월수·최소충족·양의 설계취수·완공시점 검사 |
| 물 보류 감사 | **380제안**, 소유자·월 중복없는84,740회 시도와 첫 견적 합계 일치 |
| 수동 C원장 진단 | 반올림/첫시드/자력 준비무차단 OFF/ON2건, 추적 전후 원경로 동일 |

20,346·380·84,740은 최종/준비/차단의 반복된 시험 세계를 합산한 감사 건수이며, 단일 게임 세계의 실제 건설·보류 수가 아니다. 물 승인 감사는 주문 당시 저장한 판단 근거를 검사한다. 미래의 실제 물 확보나 모든 비용 지급을 보장한 결과가 아니다.

신규33개는 실제 광석 부족의 기존 실패 재현, y의 용량 불변, 실측 p*와 대체H, H0·부분 공급·비경제, 보너스 전력/유지비0, 램프·가열, 다섯 축 범위, 정수 질량/provenance, 고정 수치, 물 부족·재고 소진·완공 이후 전기간·생활 우선·소유자 분리·공유취수·이미 예약한 설비·유한H·자기승인 금지·읽기전용, 보류 중복, OFF 회귀, 미래차단 미열람, 현금 안전선 및 자료 보존을 다룬다. 기존 저장·이관·산업·SCU 단위 회귀도 전체 테스트 안에 포함된다. 새 오프라인 모형은 브라우저 저장을 읽거나 쓰지 않는다.

상세: [verification.json](verification.json), [전체 테스트 로그](logs/full-tests.log), [신규 검사](logs/new-tests.log), [문법](logs/check.log), [보존](logs/preservation.log), [원장 추적](cash-diagnostics.json).

## 성능

정식 배치430.05초,3 worker. 그 작업과 전체 테스트가 끝난 뒤 단일 프로세스에서 버전별15회씩 교차 실행했다. 벤치마크75건은 정식 배치 건수와 별도다. Node v24.19.0 / AMD EPYC 9V74 / parallelism4. 최초 실행도 포함한다. p95는15표본의 상위 순서통계(최댓값)다.

| 동일호스트 240개월1회 | p50 ms | p95 ms |
|---|---:|---:|
| 불변4.1 |223.82|297.01|
| 불변4.2 |322.38|405.31|
| 불변4.2.1 |496.81|568.52|
| 4.2.2 E0 |493.54|532.00|
| 4.2.2 E5-X |239.50|300.51|

충격 경로는 돌아가는 산업·주문 수가 달라 평시보다 짧을 수 있다. 게임FPS나 기기 성능 목표를 뜻하지 않는다. 전체 원시75개 시간은 verification.json에 있다.

## 브라우저·시각 확인

Chromium/Playwright, **1440×900·844×390·667×375·390×844** 통과. 각 화면에서 후보·천체·lane·시나리오, E5-M18격자, H-CUT 음영/무차단 무음영,6그래프, 페이지 가로 넘침 없음,44px 이상 조작 영역, 모바일 에뮬레이션 터치, 요약값/새 수율·물 지표/원자료 일치, 바닥까지 스크롤을 검사했다. PC JSON 내보내기도 통과했다.

단일HTML12,381,924바이트에 첫시드488월경로와5시드 요약을 내장했다. 서버에서 HTML1회만 요청하고 인접 JSON/API/CDN/폰트를 요청하지 않았다. **네트워크 차단 context에서 같은 HTML 바이트를 직접 로드해 외부 요청0·오류0**을 검증했다. 원본 JSON/CSV는 전체 정밀도이며 HTML에 복사하는 월경로만 소수6자리다.

PC·세로 모바일 초기 화면과 달 물 정보 화면을 실제 이미지로 열어 확인했다. 전체 화면 캡처도 남겼다.

- [PC 초기](screenshots/report-initial-1440.png) · [PC 선택 전체](screenshots/report-selected-1440.png) · [달 물 보류](screenshots/report-moon-water.png)
- [844 가로](screenshots/report-selected-844.png) · [667 가로](screenshots/report-selected-667.png) · [390 세로](screenshots/report-selected-390.png)
- [오프라인](screenshots/report-offline.png) · [브라우저 결과](logs/report-browser.json)

**검증하지 않은 범위:** 게임 런타임 전체 브라우저 회귀, 실제 모바일 기기, Safari/Firefox, 네이티브 `file://` 보안 정책. 게임 파일은 바이트 불변이다. HTML은 최신 `DecompressionStream` 지원 브라우저가 필요하다. 별도 공개 사이트를 배포하지 않았고 게임 실행 링크의 동작을 이번 결과로 주장하지 않는다.

## 재현 명령

저장소 루트에서 실행한다. 새 스크립트는 기존 결과 폴더를 출력 대상으로 허용하지 않는다. 정식 재실행은 이 버전 결과만 덮어쓰므로 보관이 필요하면 먼저 복사한다. `--quick --out artifacts/econ422-quick`은 Git에서 무시되는 별도 폴더에서88경로만 간이 검증하며 정식 판정의 근거가 아니다. `--quick`만으로 정식 결과를 덮어쓸 수 없다.

```bash
npm run check
npm test
node scripts/econ-round4-2-2-calibrate.mjs --workers 3
node scripts/econ-round4-2-2-summarize.mjs
node scripts/econ-round4-2-2-verify.mjs
node scripts/econ-round4-2-2-diagnostics.mjs
node scripts/econ-round4-2-2-report.mjs
node scripts/econ-round4-2-2-preserve.mjs
python3 -m http.server 5174 --bind 127.0.0.1
```

다른 터미널에서, 설치된 Playwright와 Chromium 경로에 맞춘다.

```bash
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/usr/bin/chromium \
node tests/browser-economy-round4-2-2-report.mjs
```

로컬 보고서: `http://127.0.0.1:5174/docs/econ-sim/round4-2-2/report.html`. 제공한 HTML만 복사해도 인접 결과 파일 없이 내장 데이터로 열린다(네이티브 파일 접근 정책은 위 미검증 범위 참고).
