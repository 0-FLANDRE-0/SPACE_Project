# ECON-SIM-4.3.1 검증·재현

2026-11-07 Asia/Seoul. 아래는 실제 수행 범위다. 모든 기존 테스트·자료와 게임 파일은 보존한다.

| 검사 | 결과 |
| --- | --- |
| npm run check | 117소스 통과 |
| npm test | 745 / 745 통과, 생략0(기존707+신규38) |
| 정식 시뮬레이션 | 3660 실행,5시드·240개월, 무결성0 |
| 독립 새 경로 재현 | 196 원해시 일치 |
| 불변43 결과 재현 | 56 원해시 일치 |
| 차단 전0~60개월 | 72 경로 일치 |
| 수동 거래 trace | 4 원래 경로와 해시 일치 |
| 연간 재정 감사 | 219600 천체년,정수 세수−지출·누적·흑자 첫해 |
| 생산 OFF/ON 재분석 | 5490 천체 쌍 |
| 생명유지 판정 | 9600 조건 |
| 일반 H-CUT 전해0 | 1080 경로 |
| 종료 비축 감사 | 14640 자원계정 |
| 국가 음수 | 0 |
| 기존 파일 보존 | 1540 SHA256와 기준Git blob 동일 |
| 브라우저 | 154.0.8037.57;1440×900/844×390/667×375/390×844 |
| 오프라인 HTML | HTML 단독·외부 요청0·오류0·내장 산출물 해시 일치 |

정식 실행 전 소규모/개발 중 시도는 판정에 포함하지 않았다. 첫 전체 시도는 개장 시점 생명유지 사용이 같은 월 회수 물보다 빨랐던 회귀를 발견해 중단했다. 수정 전 실패 로그와 수정 후 통과 로그를 남기고 최종 소스로3,660개 전체를 다시 실행했다. 이전43 자료를 다시 쓰지 않았다.

검증은 매월 원장의 통화·실물·자본합금·SCU·H 회수 출처·물/H/O 질량·유한 얼음·비축 부분집합·국가 재정 대사를 실행한다. 정식 입력과 소스 SHA를 동결했고 독립 재현은 명시한 부분집합이다. 이전43 전체3,340개를 전부 재실행했다고 주장하지 않는다.

그래프·선택 월 경로는 소수6자리 표시용 반올림이며 원자료 JSON/CSV와 표/판정 값은 원정밀도다. 브라우저는8그래프·18격자·연간20행·세율3안·천체/시나리오/자력/구호 선택·차단 음영·정확한 수치·44px 조작·JSON내보내기·SVG 라벨 범위·루트 가로 넘침·오프라인 동작을 확인했다. 게임 전체 브라우저 회귀, 실제 모바일 기기, Safari/Firefox, 네이티브 file:// 정책은 이번에 검사하지 않았다.

## 재현 명령

```sh
npm run check
npm test
node scripts/econ-round4-3-1-preserve.mjs
node scripts/econ-round4-3-1-calibrate.mjs
node scripts/econ-round4-3-1-verify.mjs
node scripts/econ-round4-3-1-summarize.mjs
node scripts/econ-round4-3-1-performance.mjs
node scripts/econ-round4-3-1-report.mjs
python3 -m http.server 5174 --bind 127.0.0.1
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-economy-round4-3-1-report.mjs
node scripts/econ-round4-3-1-document.mjs
```

브라우저/서버 경로는 이 검증 환경의 설치 위치다. PC 브라우저로 `/docs/econ-sim/round4-3-1/report.html`을 연다. HTML은 모든 데이터를 내장한다. 빠른 개발용 실행은 `--quick --out artifacts/econ431-check`로 공식 결과를 덮어쓰지 않는다. 성능 측정은 다른 자체 시뮬레이션·테스트가 끝난 뒤 실행한다.

## 캡처

- [초기 1440×900](screenshots/initial-1440.png) · [선택/차단 상세](screenshots/selected-1440.png)
- [초기 844×390](screenshots/initial-844.png) · [선택/차단 상세](screenshots/selected-844.png)
- [초기 667×375](screenshots/initial-667.png) · [선택/차단 상세](screenshots/selected-667.png)
- [초기 390×844](screenshots/initial-390.png) · [선택/차단 상세](screenshots/selected-390.png)

## 성능

| 시나리오 | p50 ms | p95 ms | 표본 |
| --- | --- | --- | --- |
| round43E0 | 592.92 | 799.58 | 15 |
| round431E0 | 1,168.69 | 1,227.76 | 15 |
| round431E2S | 1,137.01 | 1,182.92 | 15 |
| round431E5X | 780.28 | 833.66 | 15 |

총60회 순차 교대,같은 호스트·원시 ms 보관. 정식 배치 시간은 테스트 등 동시 부하를 포함할 수 있어 조용한 별도 측정과 구분한다. 이 수치를 게임FPS나 실기기 성능으로 해석하지 않는다.
