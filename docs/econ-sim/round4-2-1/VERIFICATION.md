# ECON-SIM-4.2.1 검증·재현

작성 기준 **2026-11-07 Asia/Seoul**. 경제 합격0/2와 구현·회계·보존 검사 통과를 구분한다.

## 자동 검사와 재현

| 검사 | 실제 결과 | 증거 |
|---|---|---|
| 작업 전 기존 전체 |612/612|[baseline-tests.log](logs/baseline-tests.log)|
| 최종 전체 |기존612+신규21=633/633, fail/skip0|[tests.log](logs/tests.log), [new-tests.log](logs/new-tests.log)|
| 소스 문법 |107모듈 통과|[check.log](logs/check.log)|
| 이전 파일 보존 |기준1350개 현재SHA256·Git blob 일치|[preservation-manifest.json](preservation-manifest.json), [preservation.log](logs/preservation.log)|
| 정식 실행 |2610경로, 무결성 실패0|[results.json](results.json), [calibration.log](logs/calibration.log)|
| OFF再現 |1225경로, 오차0|각JSON행의offVerified·offReference|
| 독립 경로 재실행 |80 E0/무차단+24대표cut=104, 해시 동일|[verification.json](verification.json)|
| 공급 차단 전 동일성 |24대표의월0–60 핵심 경로 일치|[verification.json](verification.json)|
| 무차단 누적/12개월 재검사 |2580개 천체 경로, 정수Q 결과 일치|[verification.json](verification.json)|
| H-CUT95% 재검사 |360 ON쌍, 정수Q, 전해0|[verification.json](verification.json)|
| 거래시점 안전선 |3100개 기록된천체/소유자 요약의 최소잔여≥0|[verification.json](verification.json)|
| 수동 C원장 관측 |반올림·자력·첫시드 OFF/ON2실행, 원래 경로 동일|[cash-diagnostics.json](cash-diagnostics.json)|

OFF845개는 기존4.1 R41-rounded 아카이브 compact hash, 나머지380개는 동일 유상 준비·차단의 불변4.2 전체 핵심 월행 해시와 비교했다. 독립 재현의104개 및 수동 관측2개는 정식2610과 별도다. 성능60실행도 별도다. 기존 기준을 삭제하거나 실패 경로를 생략하지 않았다. 실험 초기 비용 추정 검토 후 실행을 새로 했으며, 위 수치는 최종 소스의 완결된 공식 실행만 가리킨다.

신규21개는 순증산 기준의 이전 문제 재현·제거된 축 거부·p*증분 비용·광석 부족·H0/부분/고가의기존 공정 대체·반응양자·현금 정수 경계·96h 및 광산 램프 불변·OFF 독립 핵심행 재현·레시피/물/소유 H 보존·기존수치 고정·실제 전해 건설 보류와 재개·자체H 사용의 현금 독립성·정확cut창·사전prefix·위조감사·전체이전파일·마지막12개월창·LHS층화·예상 증산O/M과 연료를 포함한 운영비 quote를 검증한다. [테스트 파일](../../../tests/economy-round4-2-1.test.js).

구현은 기존 자기 거래 매출 금지·C/U/에너지·산소질량·물배분·소유 H provenance 감사를 정산마다 실행한다. 안전선 quote는 회계 청구가 아니며, 실제 구매 후 현금이 보호 금액보다 낮으면 즉시 예외다. **이것은 이후의 모든 미래 지출 보호와 다르다.**

## 브라우저

Chromium `/usr/bin/chromium` + Playwright core. 실제 보고서 HTML을 읽고 아래화면에서 선택·6그래프·18격자·구호lane·수치일치·내보내기·스크롤·루트가로넘침0·44px터치영역을 검사했다. 모바일은 터치 에뮬레이션이다.

| 화면 | 증거 |
|---|---|
|1440×900 PC|[초기](screenshots/report-initial-1440.png), [선택후](screenshots/report-selected-1440.png)|
|844×390 가로|[초기](screenshots/report-initial-844.png), [선택후](screenshots/report-selected-844.png)|
|667×375 소형가로|[초기](screenshots/report-initial-667.png), [선택후](screenshots/report-selected-667.png)|
|390×844 세로|[초기](screenshots/report-initial-390.png), [선택후](screenshots/report-selected-390.png)|
|네트워크 차단|[오프라인](screenshots/report-offline.png)|

[브라우저 JSON](logs/report-browser.json) · [실행로그](logs/report-browser.log) · [검사코드](../../../tests/browser-economy-round4-2-1-report.mjs).

HTTP로는 보고서자체1건만 요청하고, 네트워크 차단 context에 HTML bytes를 넣은 검사는 외부요청0·오류0이었다. 실제native file://, 실물기기, Safari/Firefox까지 통과했다고 주장하지 않는다. DecompressionStream 지원 최신 브라우저가 필요하다. HTML약12MB, 첫시드488경로·55열·월0–240을 내장한다. 전체5시드의 최종/차단/무차단 월합금Q와 집계는 JSON/CSV다. 원자료 정밀도는 유지하고 표시용 월경로 복사본만 소수6자리다.

게임 런타임·UI가 모두 바이트 불변이므로 브라우저 검사는 새 보고서에 집중했다. 기존게임 전체 브라우저 회귀·새 저장 이관을 이번에 실행했다고 주장하지 않는다. 기존 산업·SCU·이동·탐사·UI1 회귀는 전체633테스트에 포함된다.

## 성능

정식 worker와 전체테스트 종료 뒤 종류별15번을 교차 측정했다. Node v24.19.0, AMD EPYC9V74, 노출병렬도4. 단일20년실행 시간이며 게임프레임률이 아니다.
| 종류 | 표본수 | p50 ms | p95 ms |
|---|---|---|---|
| round41 | 15 | 234.030 | 289.165 |
| round42 | 15 | 320.071 | 413.696 |
| round421Peace | 15 | 521.199 | 544.092 |
| round421Stress | 15 | 252.649 | 308.935 |

평시 p50은이번호스트의4.2대비약1.63배다. p95는15표본의nearest-rank 최대표본이다. 정식3worker wall time은403.67초이며 일부 단위검사가 병행된 시간도 포함한다. 단일실행 benchmark는작업종료후별도다.

## 재현 명령

저장소root, Node24계열. 새4.2.1 결과만 덮어쓴다. 보존manifest는 재생성하지 않는다. 이전버전 경로에 쓰지 않는다.

```bash
npm run check
npm test
node scripts/econ-round4-2-1-preserve.mjs
node scripts/econ-round4-2-1-calibrate.mjs --workers 3
node scripts/econ-round4-2-1-summarize.mjs
node scripts/econ-round4-2-1-verify.mjs
node scripts/econ-round4-2-1-diagnostics.mjs
node scripts/econ-round4-2-1-report.mjs
```

간이는 `node scripts/econ-round4-2-1-calibrate.mjs --quick --out artifacts/econ421-quick`이며 공식폴더에 간이결과를 쓸 수 없다. 전체 결과와 구분한다. 한국어 설명문은 원자료가 달라지면 사람이 비교해 갱신한다.

```bash
python3 -m http.server 5174 --bind 127.0.0.1
# 다른 터미널; 설치위치는 환경에 맞게 변경
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/usr/bin/chromium \
node tests/browser-economy-round4-2-1-report.mjs
```

repo에 브라우저 패키지 의존성을 추가하지 않았다. 보고서 자체는 별도패키지나 서버API가 필요없다. [변경 경로](CHANGED_FILES.md)·[원요청](REQUEST_KO.md)·[읽은 아카이브§24](ARCHIVE_24_KO.md)를 함께 확인한다.
