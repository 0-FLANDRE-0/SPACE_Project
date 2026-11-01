# SCU-2 FOLLOW-UP-1 완료 보고

작성일 **2026-11-02 Asia/Seoul**. 첨부 지시서를 전체 읽고 PR #12의 최신 HEAD에서 후속 브랜치를 분리했다. 자동화 유휴 시간 소급 결함을 수정 전 재현했으며, 광석을 실제 산업 품질 로트에서 현지 봉인/개봉하도록 연결했다. 공식 자료·이전 경제 산출물·이전 보고서는 보존했다.

## 제출 기준과 범위

- 기준 PR: https://github.com/0-FLANDRE-0/SPACE_Project/pull/12
- 재확인 HEAD: `f2aa8a824020042d201c552d55f8f4a82ab2a6a6` ([조회 원문](logs/pr12-baseline.json)).
- 새 PR base: `feat/resource-cargo-scu-packaging`.
- 새 PR head: `feat/resource-cargo-scu-followup-1`.
- 새 PR URL 및 최종 commit SHA는 PR 생성 후 제출 응답/PR 메타데이터에 기재한다. 이 문서를 포함한 최종 트리의 SHA는 `git rev-parse HEAD`로 확인할 수 있다.
- **main과 PR12에는 병합하지 않는다.** ECON-SIM-4, 실제 배송 엔진/함선, 발전모듈 추가 및 포장 C·전력비 재보정을 수행하지 않았다.

## 실제 변경 파일

전체 파일명은 [CHANGED_FILES.md](CHANGED_FILES.md)에 기록했다. 주요 변경은 다음과 같다.

| 파일 | 변경 |
|---|---|
| `dist/src/packaging-clock.js` (신규) | 산업 정산 tick 기반 권위 시계, 과거/미래 및 선행 정산 거부 |
| `dist/src/container-automation.js` | 현재 시각 예약/설정/취소, startedMs, OFF·속도 변경 정산, 원광 자동 현대화 차단 |
| `dist/src/industry-packaging.js` | 매 tick 시계 동기화, 유휴 전체 복제 방지, 원광 현지 어댑터 진입점 |
| `dist/src/industry-runtime.js` | 현재 산업 v4, 생성 시 시계 연결; 기존 생산·건설 공식 유지 |
| `dist/src/ore-lot-manifest.js` (신규) | 출처·등급·난도 포함 단일 로트 명세/그룹 키/보관 보존식 |
| `dist/src/industry-ore-packaging.js` (신규) | 자유 로트와 소재/C/Wh/실물 장부를 함께 견적·원자적 커밋·개봉 |
| `dist/src/industry-ore-ledger.js` (신규) | 자유/봉인/전체 조회, 실제 지질/추출량 대조, 전체 원광 보존 검증 |
| `dist/src/container-state.js` | 로트별 그룹, custody 원장, 스키마별 검증 및 작업 시각 검증 |
| `dist/src/container-inventory.js` | manifest 원광의 generic 소비/원격 배송 우회 거부 |
| `dist/src/packaging-inventory.js`, `packaging-specs.js` | book v3/시계, 과거 book 검증 유지, 원광 현지 보관 이전량 검증 |
| `dist/src/industry-storage-v3.js` (신규), `industry-storage.js` | PR12 엄격한 v3 검증 보존, v1/v2/v3→v4, 원문 v3 백업/실패 격리 |
| `dist/src/earth-population-update.js`, `earth-population-local.js` | 현재 버전 지원, 명시적 로컬 인구 변경 후 시계/규격 공급자 유지 |
| `dist/src/industry-ui.js`, `dist/style.css` | 기존 재고 행 자유 품질/봉인량 분리, 새 저장 안내; 작은 가로 화면4px 여백 보정 |
| `scripts/verify-resource-unit-preservation.mjs`, 테스트 보존 helper | 원본 manifest를 그대로 두고 새 PR12 exact allow list 및 v3 재현 검사 추가 |
| 신규/기존 관련 테스트, v3 fixture5종, benchmark2종, 이 하위 문서·로그·스크린샷, `docs/DECISIONS.md` | 재현·회귀·원문 출처·실측·결정 기록 |

## 시계 결함과 수정 결과

수정 전 최소 재현: **500일 무작업 → 8SCU/h 설비 연결 → 수동32SCU 예약 → 1시간**. PR12는 예약 전 유휴500일을 작업 시간으로 계산해 **32SCU 완료**했다. 기대8SCU assertion이 실제 실패한 원시 로그를 남겼다. 수정 후 같은 테스트는 **8SCU/예약 중**, 4시간째32SCU 완료다.

현재 시각은 `settledTick × 3,600,000`으로 단일화하고 예약 순간 `startedMs`를 찍는다. OFF·처리능력 변경은 이전 구간을 먼저 정산한다. 취소 시 기존 실물/예약을 반환하고 재예약은 현재부터 시작한다. 분할 정산/동일 시각 중복/저장 왕복/행성·소유자 분리/분수 처리/과거·미래 시각을 검증했다. [수정 전 로그](logs/clock-before.log), [수정 후 로그](logs/clock-after.log), [설계](IMPLEMENTATION.md).

## 실제 원광 전후 예

공식 지구 프리셋으로500일 실제 채굴한 정부 low 로트. 광맥은 세 단계 모두 `sol/earth/r2-sol-earth-988ed46b-surface-77-0`, depositId `r2-sol-earth-988ed46b-surface-77-0`, 등급 **low**, 가공 난도 **41.072**다. 원광8U=32SCU, 컨테이너1개다.

| 상태 | 해당 자유 원광 | 해당 봉인 원광 | 해당 총 소유 원광 | 자유 합금 | 포장 예산C | 포장 전력Wh |
|---|---:|---:|---:|---:|---:|---:|
| 포장 전 |7,522.504U|0U|7,522.504U|8,658.969U|100|100,000|
| 봉인 중 |7,514.504U|8U|7,522.504U|8,658.519U|99|99,000|
| 개봉 후 |7,522.504U|0U|7,522.504U|8,658.924U|99|99,000|

합금은 내용물이 아닌 별도 구조재 **0.450U 차감 → 0.405U 회수/0.045U 손실**이다. C1/Wh1,000은 **명시적 테스트 규격**의 실제 지불이며 기본 설계값으로 채택하지 않았다. 광맥 잔량/추출량/품질 생성/기존 생산 이력은 포장과 개봉으로 바뀌지 않는다. medium/high도 실제 채굴 로트로 같은 왕복을 검증했다. 전체 JSON 예제는 [benchmark-ore.json의 example](benchmark-ore.json), 실제 앱 예제는 [browser-evidence.json](browser-evidence.json)이다.

`inv.ore`는 제련 가능한 자유 원광이다. 봉인8U는 제련이 사용하지 않는다. 현재 전체 검증은 `자유+봉인+제련 소비=실제 채굴량`, 로트별 custody/실물, 광맥 출처/난도, SCU 실물/묶인 소재/회수/손실/C/Wh를 함께 검사한다. 이 검증 전에 옛 projection으로 봉인 원광을 자유 재고처럼 복원하여 합격시키지 않는다. 개봉 후 기존 수율14/33/52%로 제련 가능한 것도 별도3종 검사했다.

## 저장과 안전 실패

실제 필수 시각/보관 필드 때문에 산업 **v4 / book v3**를 사용한다. PR12의 정상 **v3 파일5종**을 먼저 과거 validator로 검사한 뒤 변환한다. v1/v2 경로도 유지한다. v3에는 원래 시작 시각이 없으므로 이관 순간에서 재개하고 과거 유휴 시간을 추가하지 않는다. 기존 진행률/예약/실물/묶인 소재/회수 잔여는 보존한다.

원문은 버전별 전용 백업에 read-back 확인 후 활성화한다. 백업 차단/쓰기 실패/훼손/미등록 규격/시계 불일치는 상태 전체를 거부하고 원문·격리 상태를 유지한다. 개발 transient·자동 저장/복원 OFF·새로고침 초기화·명시적 JSON만 적용·타 프로젝트/보존 원문 유지 정책을 변경하지 않았다. [저장 명세](SAVE_SCHEMA.md).

## 검증 결과와 제한

- `npm run check`: **78 모듈 PASS** (기준73).
- `npm test`: **404 PASS / 0 FAIL / 0 SKIP**, 기존367 유지 + 신규37.
- 관련 브라우저7개 스크립트: PC와 모바일 가로/세로 PASS, page/console error0. 신규 실제 원광/시계/저장 경로는1440×1000,844×390,667×375,390×844 모두 검사했다.
- 원본238개 공식/ECON 파일, 새 PR12 보호712개 파일 SHA256 일치. v1 6종/v2 5종/v3 5종을 각 원래 코드로 재현했다. 공식19천체/92셀/8,893,000,000명 및750.125일 기존 산업 결과를 유지했다.
- 동일 하네스500일 유휴 평균:1계정17.799→19.049ms,19계정210.862→192.601ms. 정산 중 전체 장부 복제는 양쪽0회. 원광500U도63개 상자를2개 그룹으로 집계한다. 대량 합금10¹²U 견적은그룹1개/DP288상태다.
- 상세 명령/신규 테스트/스크린샷/원시 로그/성능은 [VERIFICATION.md](VERIFICATION.md).

지원 경계는 **현지 정부 단일 로트, 정수 컨테이너 전체 개봉**이다. 혼합/중복 로트, 내용물 부분 인출, 원광 자동 현대화, 민간 원광, 원격/가짜 배송 인도는 명시적으로 거부한다. 새 세대 해금만으로 기존 로트나 소재/회수율을 바꾸지 않는다. 전용 실행 폼과 실제 배송은 후속 연결 대상이며 기본 C/전력 미정은 그대로다. [후속 항목](FOLLOW_UP.md).

필수 구현/로컬 검증에서 미해결 실패는 없다. **실물 모바일/iOS Safari 및 독립 GitHub Actions는 미실시**다. 저장소에 CI workflow가 없어 로컬 제출 로그를 독립 CI PASS로 표현하지 않는다. 최적화 실측은 이 환경의 결과이며 모든 기기에 대한 성능 보장은 아니다.
