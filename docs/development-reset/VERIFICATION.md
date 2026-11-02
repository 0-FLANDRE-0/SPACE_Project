# 개발 저장 초기화 검증

2026-11-01 (KST), PR #8 `035831b` 기반. Chromium `/usr/bin/chromium`, Playwright Core, SwiftShader 환경입니다. 실기기/Safari는 검증하지 않았습니다.

## 자동 검사

- `npm run check`: 소스56모듈 통과 ([로그](logs/space-reset-check.log)).
- `npm test`: 기존171개 + 신규9개 = **180개 통과**, 실패/건너뜀0 ([로그](logs/space-reset-unit-final.log)). 기존 저장/이관 테스트도 그대로 유지합니다.
- `git diff --exit-code 035831b -- dist/data dist/src/industry-runtime.js dist/src/industry-policy.js dist/src/model.js dist/src/time-control.js`: 변경0. 단위 테스트도 공식 JSON·원본 지구·생산/비용/천문/시계 파일의 바이트 동일성을 검사합니다.

## 요청 A–G 실제 브라우저 검사

`tests/browser-development-reset.mjs`에서 1440×1000, 844×390, 390×844와 저장소 차단/개별 삭제 실패 환경을 검사했습니다 ([로그](logs/space-reset-browser.log)).

| 조건 | 확인 결과 |
|---|---|
| A. 구 저장값보다 최신 공식 데이터 | 유효한 구 지구 JSON·손상 산업/행정 데이터 등8개 키를 실행 전에 삽입. 모두 삭제, 공식 인구와 자원 필드 전체 일치 |
| B. 지구 인구 | 92개 ID별 최신 명수 전체 대조·합계8,893 POP |
| C. 같은 탭 시험 | 실제 DEV 시나리오와 건설 버튼으로 광업/제련 건설. 700게임일 정산 후 채굴·수소회수·제련 생산 및 장부 검증. 표면1명 편집/행정 생성도 유지 |
| D. 새로고침 초기화 | 시설/재고/채굴잔량/생산기록 초기화, 시간 초기값, 공식 표면 전체 복원·행정0 |
| E. 개발 캠페인 재진입 | 새 상태·시간0·100,000 C/합금10,000 U/수소500 U 재지급. 재건설 후 재진입도 동일 |
| F. 다른 프로젝트 보존 | 다른 프로젝트·유사 접두사·설정 sentinel3개 값 그대로. 자동 getItem/setItem 호출0, 전용 removeItem만 |
| 저장소 불가 | localStorage getter SecurityError·개별 removeItem 실패 각각 실제 시작/최신 데이터/건설·생산 정상 |
| 자동 저장 비활성 | 10초 주기 경과 update에 persist 스파이0회, 조작·새로고침/종료 포함 Storage 읽기/쓰기0 |

## 기존 브라우저 회귀

**기존11개 회귀 + 신규 초기화1개 = Chromium/Playwright12개 스크립트 전체 통과**했습니다. PC1440×1000, 모바일 터치844×390·667×375·390×844를 검사했으며 최종 실행에서 page/console 오류0입니다.

| 스크립트 | 검사 |
|---|---|
| `browser-development-reset.mjs` | 요청 A–G, 저장소 차단/삭제 실패, 자동 저장0회 |
| `browser-smoke.mjs` | 전체 지도·카메라·천체/위성/섹터 선택·모바일·자원 해제 |
| `browser-administration.mjs` | 행정 생성/수정/병합/삭제/Undo·시간·초기화 |
| `browser-planet-surface.mjs` | 19천체 선택/편집·수동 파일·초기화·전체화면 |
| `browser-planet-generation.mjs` | 실제 Worker·미리보기/적용/Undo·예산·수동 파일 |
| `browser-generation-safety.mjs` | 선택영역/초과 예산·낡은 미리보기 거부·취소·메모리 Undo |
| `browser-resources.mjs` | 공식19·자원7지도·예산/품질·수동 v1/v2·터치 |
| `browser-resource-correction.mjs` | 광맥 제한·구 로컬 폐기·명시적 파일만 적용 |
| `browser-industry.mjs` | 4해상도 실제 건설/광업/제련/증설/개량·초기화·수동 복원 |
| `browser-industry-safety.mjs` | 엄격한 수동 JSON 검증·저장소 실패 독립·손상 키 폐기 |
| `browser-surface-distributions.mjs` | 4해상도 일반3지도·정보 패널 드래그/제한·DEV 격리 |
| `browser-population-migration.mjs` | 구 인구 저장 폐기·공식92셀·격리 Map에서 legacy 이관 보존 |

각 스크립트의 실행 로그는 이 디렉터리의 `logs/`에 보관합니다. 최종 통과 로그에 page/console 오류가 없습니다.

실행 예:

```sh
npm run dev
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-development-reset.mjs
```

브라우저 회귀는 영구 저장 기대값만 새 정책에 맞추고 선택·카메라·편집·광업/제련·증설/개량·파일 수동 조작을 유지합니다. 기존 인구 서명 이관은 브라우저의 격리된 Map 어댑터에서 검사하고 라이브 앱은 초기화되는지 따로 검사합니다.

초기 회귀 실행에서는 영구 저장을 기대하던 검증을 새 정책에 맞게 수정했습니다. 전체 지도 검사의 완료된 PC 페이지가 모바일과 소프트웨어 GPU 자원을 계속 공유해 시작 대기30초 초과가 발생했습니다. 기존 PC 해제 검증을 모바일 검사 앞으로 옮기고 페이지를 닫은 뒤 전체 스크립트를 다시 실행해 통과했습니다. 로고 제스처는 실제 클릭을 유지하면서 불필요한 안정화 대기를 줄였습니다. 테스트 삭제·기능 검사 생략은 없습니다.

## 화면 증거

- [PC 광업·제련 시험 후](screenshots/production-1440.png)
- [PC 새 초기 개발 시나리오](screenshots/fresh-fixture-1440.png)
- [모바일 가로 새 초기 상태](screenshots/fresh-fixture-844.png)
- [모바일 세로 새 초기 상태](screenshots/fresh-fixture-390.png)

실제 캡처를 열어 행성 지도와 소형3영역 패널·빈 건설구획·초기 재고가 보이는지 확인했습니다.

## 범위와 한계

삭제 권한 자체가 차단된 키는 브라우저에 남을 수 있으나 앱은 불러오지 않습니다. 초기화는 해당 실행 origin의 알려진 SPACE_Project 키에만 적용합니다. 다른 origin의 저장소에는 접근하지 않습니다. 구 JSON의 자동 서명 호환/마이그레이션은 사용하지 않으므로 수동 가져오기도 최신 공식 원본과 맞지 않으면 검증에서 거부합니다. 같은 탭 Undo/JSON 수동 내보내기로 시험 결과를 보관할 수 있습니다.
