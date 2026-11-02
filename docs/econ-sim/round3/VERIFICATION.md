# ECON-SIM-3 검증 기록

2026-11-01 (Asia/Seoul). 기준 `aff438089e1551e71309403f1f144ac7def99e0f`, 기존 PR #10의 증분이다. 수치 결과가 원시 파일→보고서→PC/모바일 표시로 이어지는 흐름과 기존 게임의 산업/초기화 회귀를 확인했다. 이 실험에는 새 API·인증·서버 저장 경로가 없다.

## 자동 검사

| 검사 | 실제 결과 | 증거 |
|---|---|---|
| `npm run check` | 소스60개 통과 | [syntax.log](logs/syntax.log) |
| `npm test` | **276/276**, 실패/건너뜀0. 기존216+신규60 | [unit-tests.log](logs/unit-tests.log) |
| 기존 계약·수율·램프업 | 광업6개월/제련8개월, 고정 C/U/H·기존 처리량 재사용 | 새54개 모델 테스트 및6개 분석 테스트 |
| 핵융합 기동 | 96h 입력75/발전180GWh/H5U, 24h 발전0. 부족하면 지연 | 단위 검사, 완공2모듈150/360GWh/H10U 실장 검사 |
| 계정/물질/에너지 | 각 월 비음수 정수 C/U 장부, 현금 총합=M, MV=PY, 광석=합금+잔재, H 수원·전력 제약, 저장 수지 | 모델 내부 월별 검사, 독립 CSV/시계열 검사 |
| 실제 수리·중단 | 유지 U 지속, C 감액, 결손 건강 저하, 실제 U/C 지급 후만 복구, 냉간 재기동 | 관련 테스트 및 E5/E6 원시 시계열 |
| 정부/민간·행성 분리 | 자기 발전 매출0, 로컬 유상 거래, 지구 합금 대여 금지, 유한 운송·운임 | 단위/돌연변이 검사 |
| 전체 최종 경로 | 후보4개×16경로×5시드=**320/320 무결성** | [final-runs.json](final-runs.json) |

경제 기준을 통과한 것과 코드 검사를 통과한 것은 다르다. 최종 평시 대조는 R3-N089 30/30, R3-N067 19/30, R3-N002 6/30, R3-rounded 30/30이다. 전시 가격 상승 하한이 미달하고, 반올림안은 전시 회복4건도 미달했다. 추가 공급 안정성 제안 역시 미충족이다. 따라서 **최종 종합 합격0개**이며 이를 테스트 실패를 지워 통과시킨 것으로 보고하지 않는다.

## 오류 주입:8/8 탐지

`node scripts/econ-round3-mutants.mjs`는 격리한 복사본만 수정한다. 원본에 오류를 넣지 않는다. 각 변형의 구문이 유효하고 지정한 실제 단위 검사가 실패했는지 확인했다.

1. 전력0인 수전해 강제 생산.
2. H0인 핵융합 최대출력.
3. 중단 합금 보존0.
4. 외부 입력 없는96h 자동 기동.
5. 정부 자기 소비 허위 전기 매출.
6. 실비 위에 구 운영비 프록시 재청구.
7. 빈 식민지에서 지구 합금 빌려 건설.
8. 저장 방전 효율을 뒤집어 에너지 생성.

[전체 결과](logs/mutations.json), [요약](logs/mutations.log), 같은 폴더의8개 `mutant-*.log`에 실제 실패 근거가 있다. ‘이런 오류를 가정했다’는 서술만으로 검증을 대신하지 않았다.

## 독립 판정·보존·재현

`node scripts/econ-round3-verify.mjs`가 원시 CSV **14,990행**의 평시·전시 판정 플래그를 별도로 재계산하고 전부 일치함을 검사했다. 각 단계 행 수7680/870/5760/360/320, 최종16경로/5시드, 별도 종합 플래그를 대조했다. 대표16경로를 다시 실행해 모든 월의 시계열 해시가 일치했다. 월별 공개 시계열의 현금 총합/MV=PY/음수 재고/광석 변환/자기 매출0도 독립 검사했다.

기준 커밋에서 기존 추적 파일 **547개**를 바이트 비교했다. DECISIONS의 미결정 결과 추가만 별도 허용하며, 게임 소스·공식19개 프리셋·지구92셀 인구·지질/광맥/자원/품질·기존 테스트·기존1/2차 보고서/CSV/JSON/스크립트는 전부 동일하다. `input-manifest.json`은 실제 입력·소스 해시 및 원천/수원 요약을 보관한다.

선행4프로필×7경로×5시드의 OFF140회는 원본 직접 호출140회와 동일하다. ON140회와 섞어 선행 통과라고 표시하지 않았다. Round2 golden:

`8d1ff9cf827461200f4831313449df1b44f334f2d42f4daa89835f14c045e71b`

동일 전체 설정을 `artifacts/econ3-reproduction`에 다시 실행했다. **수치14개 파일**이 바이트 동일하고, legacy-off-on JSON은 `pairMs`를 제외하면 동일하다. results는 성능/시간 필드만 제외하고 전부 같다. 원시 CSV SHA-256:

`7932ee12c129e171c9d07cd7f8f9e54e24f4f989d038adc44fe9553cecd2c71b`

대표 시계열 파일 SHA-256:

`1cc6fec83017f4929e4b3729cf9f8b2716f78cb46289943b152e8e9c693430cd`

[독립 검사 상세](logs/independent-verification.json), [검사 로그](logs/independent-verification.log), [전체 재현 로그](logs/reproduction.log). 그림21개도 별도 재생성하여 바이트 동일함을 확인했다([SVG 해시](logs/chart-reproduction.json)). 입력 어댑터는 기존 비공개 H 상수를 복사해서 조용히 사용하는 대신 소스 패턴과 해시가 달라지면 검토를 요구하도록 실패한다.

## 횟수와 성능

주 탐색/교차/대조/그림/성능은15,591회, 동일 설정 전체 재현도15,591회다. 이후 공공 가치 누계를 구하기 위한 `econ-round3-infrastructure.mjs`는20회 추가 paired 재실행이며 원시 주 탐색 수에 몰래 포함하지 않았다. 이 보강은 누적 실질 GDP/세수/재량예산/예비분을 외부 전기 판매와 분리한다. 별도 단위·돌연변이·대표 재생 검사는 위 명령의 각 로그로 구분한다.

주 탐색610.00초, 독립 재현611.27초. 두 작업은 각각3개 CPU worker로4개 CPU를 공유하며 동시에 실행했다. 주 실행 단일20년25회 p50 59.83ms/p95 80.14ms, 재현 p50 60.93ms/p95 66.72ms. 기존2차2.77/4.21ms보다 느리다. 다중 장부·개별 기동·화성 저장 사건·상세 스냅샷이 추가됐다.50ms 단일 목표와10분 전체 목표를 초과했다(주 탐색 약10.0초 초과). 동시 재현의 CPU 경합을 포함한 실제 값이며20년 전체를 시간별 반복한 것은 아니다.

## PC·모바일 실제 Chromium

오프라인 보고서를 Playwright/Chromium에서 **1440×1000,844×390,667×375,390×844**로 검사했다.6개 탐색 버튼,4개 후보×16경로 표,21개 인라인 SVG, 모바일 터치, 표/그래프 내부 가로 스크롤, 문서 전체 가로 넘침 없음, 페이지 오류0·외부 HTTP 요청0이다.

관리형 Chromium은 `file:` 직접 탐색을 차단한다. 정책을 바꾸지 않고 정확히 같은 HTML을 `page.setContent`로 오프라인 렌더했다. 실기기 파일 앱/Safari 직접 열기는 **미검증**이다. HTML의 본문·그림·후보 조작에는 외부 라이브러리/데이터 다운로드가 필요 없다. 부속 문서/원시 자료 링크는 함께 보관한 경로 또는 저장소에서 연다.

[실제 로그](logs/report-browser.log), [기기/화면 목록](logs/report-browser.json), [PC 요약](screenshots/summary-1440.png), [모바일 요약](screenshots/summary-390.png), [모바일 전력 그림](screenshots/chart-grid-390.png), [가로 화면 후보](screenshots/candidates-667.png). 실제 스크린샷을 열어 숫자·레이블·축·버튼·스크롤 가독성을 확인했다. 모바일 그림을 지나치게 축소하는 대신 내부 가로 스크롤로 축 크기를 보존했다.

기존 `tests/browser-development-reset.mjs`도 실제 로컬 게임 서버에서 실행했다.1440×1000/844×390/390×844에서 최신92셀 인구8,893POP·자원, 광업/제련 건설과 생산·편집, 새로고침 초기화, 캠페인 시험 재고 재지급, 타 프로젝트 localStorage 보존, 자동 읽기/쓰기0을 확인했다. 저장소 접근 차단·개별 삭제 실패 두 조건에서도 시작과 생산이 가능했다. 페이지/콘솔 오류0. [회귀 로그](logs/game-development-reset-browser.log).

기존 모든 브라우저 스크립트를 재실행한 것은 아니다. 변경하지 않은 카메라/천체/행정 등 전체 브라우저 묶음을 통과했다고 주장하지 않는다. 현재 전체 단위276개와 위 실제 브라우저 회귀/보고서 검사를 수행했다.

## 재현 명령

```sh
npm run check
npm test
node scripts/econ-round3-calibrate.mjs --workers 4
node scripts/econ-round3-calibrate.mjs --out artifacts/econ3-reproduction --workers 4
node scripts/econ-round3-verify.mjs
node scripts/econ-round3-infrastructure.mjs
node scripts/econ-round3-mutants.mjs
python3 scripts/econ-round3-plots.py
node scripts/econ-round3-report.mjs
```

브라우저는 `PLAYWRIGHT_MODULE`과 `CHROMIUM_EXECUTABLE`로 설치 경로를 지정한 뒤 `node tests/browser-economy-round3-report.mjs`를 실행한다. 게임 회귀는 `npm run dev`로 로컬5173을 연 뒤 `node tests/browser-development-reset.mjs`. 실제 실행 환경에서는 `/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs`, `/usr/bin/chromium`을 사용했다.

게임 통합·배포·수치 채택·main 병합·강제 푸시·ZIP은 수행하지 않는다. 상위/반올림 수치의 채택과 별도 설계 변경은 사용자 미결정이다.
