# ECON-SIM-4 실제 검증 기록

2026-11-02 Asia/Seoul. 기준 PR13 `edc0d4257dad9cd46622fc8b00f039b68479b601`, PR14 문서만 `5760cbc8b079ca78060b56755eb084c872b13ddc`에서 직접 읽었다. **코드·원장 검증 통과와 경제 합격을 구별한다. 종합 경제 합격 후보는0개다.**

## 자동 검사

| 검사 | 실제 결과 | 원시 증거 |
|---|---|---|
| 변경 전 `npm run check` | 78개 모듈 | [baseline-check.log](logs/baseline-check.log) |
| 변경 전 `npm test` | 404 통과, 실패/skip0 | [baseline-tests.log](logs/baseline-tests.log) |
| 구현 후 `npm run check` | 81개 모듈 | [check.log](logs/check.log) |
| 구현 후 `npm test` | 기존404+신규51=455 통과, 실패/skip/취소0,39.12초 | [tests.log](logs/tests.log) |
| 돌연변이 | 9/9 검출(KILLED) | [mutations.json](logs/mutations.json), [원시 로그](logs/mutations.log) |
| 원본 보존 | PR13의795개 경로 SHA256 동일; DECISIONS 기존 접두부 동일 | [preservation.log](logs/preservation.log), [manifest](preservation-manifest.json) |
| 독립 재현 | OFF80+ON28=108회20년 재실행, 모든 해시 일치; 역사적 원본16경로도 일치 | [independent-verification.json](logs/independent-verification.json) |
| 원시 결과 건수 | ON CSV12,160행, 최종440행, 무결성 실패0 | 위 독립 검증 및 [results.json](results.json) |

기존 테스트는 한 줄도 수정하지 않았다. 저장 v1/v2/v3→현재 이관·원문 보존/격리, SCU 권위 시계·원광 lot·소재 회수, 기존 산업 회귀도 기존 전체 테스트 안에서 실행했다. 새 시뮬레이터는 게임 저장 어댑터를 호출하지 않으며 게임 schema를 변경하지 않는다.

신규51개 사례는 단위/양론, kg 능력 보존 환산과 설비 변경 분리, H 원가 경계, 최소 용기와 실제 occupiedSCU, 소유자별 C·출발 재고·전력의 원자적 차감, 긍정 보수율/환경별 범위, 규모 비용/공기·연구 제한,96h 기동/H quanta, 추가분만 유상 증설,2일/4일 재가동 적분·한 번 청구, 부족 시 우선순위, 장기 손실 민간 판단, 실제 자본만 해체, 무상 생성/원장 변조 탐지, 모든22경로20년 무결성, OFF/결정성 및 추가 정책의 비용을 다룬다.

돌연변이는 원본이 아닌 `artifacts/econ4-mutants/`의 격리 복사본에만 넣었다. 무상 출발 재고·SCU 소재 미차감·투입 초과 해체 회수·정지 합금0·무료 재시작·잘못된 전해 양론·소형 융합 조기 허용·우선순위 역전·requiredSCU 비용 부과를 각각 관련 검사로 검출했다. 돌연변이의 선택적 test-name 필터에서 제외된 사례 수는 전체455개의 skip 수와 혼동하지 않는다.

## 경제 탐색 실행 범위

| 단계 | 조합/경로/시드 | ON20년 실행 |
|---|---|---:|
| 원래 범위 LHS | 512×3×5 | 7,680 |
| OAT | 74×3×5 | 1,110 |
| 조건부 집중 | 128×4×5 | 2,560 |
| 상위 확장 | 8×4×5 | 160 |
| 후보3+반올림 전체 | 4×22×5 | 440 |
| 분리 대조 | 15종, 경로별5시드 | 210 |
| 합계 | 원시 [runs.csv](runs.csv) | **12,160** |

별도로 파이프라인에서 OFF80쌍(기존 직접+새 OFF위임=160회), 성능15회를 실행했다. [supplement.json](supplement.json)은 공공 인프라20+복구 원인35+실제 H 이용률20+동일 호스트 성능30=105회를 추가 기록한다. 독립 감사는108회다. 이 숫자는 완료된 최종 파이프라인/보강/감사의 범위이며, 개발 중 소규모 smoke와 중단한 초기 탐색을 최종 표본에 섞지 않는다. `calibration-initial-aborted.log`는 민간 발전의35기 기반 공유/공사 지연을 바로잡기 전 중단 로그로 보존했으며 그 결과는 최종 후보 선정에 쓰지 않았다.

독립 재현의 예: S0/econ-1 OFF 해시 `c0c88a7437f6ec235326db575f540700ac5734c00de707f24ea251a790f0ee98`, 반올림안 E0/econ-1 ON compact 해시 `2cdc3312b37abdf468e4fdd2264a2e0b2caff0381766b96dba2fd246b4d995cf`. OFF는 전체 원래 행, ON은 공개 compact 행의 JSON 직렬화 SHA256이므로 두 형식의 해시를 직접 비교하지 않는다. 역사적16경로는 기존 round3/series.json의 정밀도를 그대로 비교했다.

## 브라우저와 단일 HTML

Playwright와 Chromium으로 **1440×1000 /844×390 /667×375 /390×844**에서 실행했다. 4개 후보·22개 경로·14개 그래프·각241점, 후보/경로 변경이 실제 SVG 경로를 바꾸는지, R3 표시 전환, 유한 좌표,44px 선택 컨트롤, 본문 가로 넘침0, 마지막 내용 접근을 검사했다. R3에 없는 정지/해체/건전도는 거짓 대조선을 만들지 않는다. [브라우저 증거](logs/report-browser.json), [원시 로그](logs/report-browser.log), [스크린샷](screenshots/).

복사한 HTML 한 파일의 바이트를 **새 offline:true 브라우저 context**에 주입해 실행하고 E11로 조작했다. 인접 JSON/CDN/폰트 없이 동작했으며 page/console 오류0·외부 네트워크 요청0이다. 이 환경의 관리 Chromium은 `file://` 접근을 `ERR_BLOCKED_BY_ADMINISTRATOR`로 막았다. 정책은 변경하지 않았으며 **일반 사용자의 파일 직접 열기까지 통과했다고 주장하지 않는다**. 단일 문서 내부 실행과 네트워크 독립성을 검증한 결과다.

게임 회귀도 별도 실제 서버의 unchanged dist로 실행했다. [browser-development-reset 로그](logs/game-development-reset-browser.log)는 PC1440×1000·모바일844×390/390×844에서 과거 키 삭제, 최신 공식19천체/지구92셀·8,893POP, 광업/제련·편집 현재 탭 작동, 새로고침 초기화·시험재고 재지급, 타 프로젝트 저장 보존, 자동읽기/쓰기0을 확인했다. 저장 접근 차단/삭제 실패 두 경우도 통과했고 page/console 오류0이다.

실제 모바일 기기·iOS Safari·Firefox·GitHub Actions의 실행 결과는 제공하지 않는다. 이번 브라우저 증거는 Linux Chromium 터치/뷰포트 에뮬레이션이다. 적용 스킬: [vercel:verification](skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1/verification/SKILL.md) — 보고서 원시 데이터→내장 JSON→SVG→사용자 조작 경로를 확인했다.

## 성능

Node v24.19.0, Linux x64, AMD EPYC9V74, 노출 병렬도4, worker3. 최종 탐색 벽시계808.353초. 파이프라인15회 R4 p50=187.913ms/p95=273.817ms다. 보강 동일 호스트·교대15회씩에서 R3 p50=64.753ms/p95=105.201ms, R4 p50=200.596ms/p95=228.630ms였다. 역사적 R3 보고값59.8ms와 현재 실측을 구별한다. R4는 전체 자본/소재/현금 감사·개별 기동·실제 포장을 추가해 약3.10배 느려졌다. 이것은 해당 환경의 단일20년 실행이며 실제 게임 프레임 성능이 아니다.

## 재현 명령

저장소 루트에서 Node24로 실행한다. 결과를 다시 만들면 round4 신규 산출물만 갱신되며 기존1–3차 출력은 덮어쓰지 않는다. 일반 검토는 원시 검증/테스트만 실행해도 된다.

```sh
npm run check
npm test
node scripts/econ-round4-preserve.mjs
node scripts/econ-round4-verify.mjs
node scripts/econ-round4-mutants.mjs
node scripts/econ-round4-calibrate.mjs --out docs/econ-sim/round4 --workers 3
node scripts/econ-round4-supplement.mjs
node scripts/econ-round4-details.mjs
node scripts/econ-round4-report.mjs
```

탐색기는 `scripts/econ-round4.config.json`을 명시적으로 읽는다. `--out`은 round4 또는 artifacts 아래 신규 디렉터리에 한정하며, 원래 넓은 범위와 시드를 보존해 재현한다.

보고서 서버와 브라우저는 별도 터미널로 실행한다. Playwright/Chromium 경로는 환경에 맞게 지정하며 저장소 의존성·lockfile을 바꾸지 않는다.

```sh
python3 -m http.server 5174
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-economy-round4-report.mjs
python3 -m http.server 5175 --directory dist
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs CHROMIUM_EXECUTABLE=/usr/bin/chromium BASE_URL=http://127.0.0.1:5175 node tests/browser-development-reset.mjs
```

시뮬레이터의 월 경계 건설 의사결정, H 실제 신규 판매 보장 부재, 고정 식민지 투자 정책, E6-R 동일 산출 비교가 분석 하한인 점 등은 [구현 한계](IMPLEMENTATION.md)와 [상세](DETAILS_KO.md)에 공개했다. 어떤 탐색값도 공식 게임 설정으로 적용하지 않았다.
