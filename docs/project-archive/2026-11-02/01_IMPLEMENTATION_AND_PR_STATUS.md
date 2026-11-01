# 01. GitHub 개발·검증 이력 및 현재 구현 상태

**확인일:** 2026-11-02 KST · [저장소](https://github.com/0-FLANDRE-0/SPACE_Project) · 최신 확인 HEAD `edc0d4257dad9cd46622fc8b00f039b68479b601` ([PR #13](https://github.com/0-FLANDRE-0/SPACE_Project/pull/13)).

## 브랜치 체인/병합 현황

최신 확인 시 PR #1~#13 모두 **Open, 미병합**. 기능이 누적되는 각 후속 브랜치는 직전 PR 브랜치를 기준으로 하며 `main`은 최신 통합 런타임이 아님. 브랜치/PR 번호는 역사 기록이고 작업 재개 전 HEAD를 다시 조회해야 함.

| PR | 주요 기능 | 상태 | 코드·보고서 구별 |
|---:|---|---|---|
| [#1](https://github.com/0-FLANDRE-0/SPACE_Project/pull/1) | v0.3 게임 AU·크기/배치 | 구현 제출 | 월드 좌표/거리 |
| [#2](https://github.com/0-FLANDRE-0/SPACE_Project/pull/2) | v0.4 공용 항성계 HUD·고정 육각 섹터 | 구현 제출 | 항성계 평면 지도 |
| [#3](https://github.com/0-FLANDRE-0/SPACE_Project/pull/3) | v0.5A 행정구역·10:1 세계시계·배속 | 구현 제출 | 실시간 UI/시간 |
| [#4](https://github.com/0-FLANDRE-0/SPACE_Project/pull/4) | v0.5B 구면 행성·위성 표면지도/편집 | 구현 제출 | 독립 표면 좌표 |
| [#5](https://github.com/0-FLANDRE-0/SPACE_Project/pull/5) | v0.5C 지질·환경·인구 생성기 | 구현 제출 | 데이터 생성/검수 |
| [#6](https://github.com/0-FLANDRE-0/SPACE_Project/pull/6) | v0.5D.1 Sol 19천체·광맥/품질/분포 보정 | 구현 제출 | 정적 프리셋 |
| [#7](https://github.com/0-FLANDRE-0/SPACE_Project/pull/7) | v0.5E 정부 시설 슬롯·광업·제련 | 구현 제출 | 실제 개발 산업 런타임 |
| [#8](https://github.com/0-FLANDRE-0/SPACE_Project/pull/8) | v0.5E.1 지구 인구·지도3모드·패널 | 구현 제출 | 지구92셀 인구8,893,000,000 |
| [#9](https://github.com/0-FLANDRE-0/SPACE_Project/pull/9) | 개발 세션 초기화·자동 저장 끄기 | 구현 제출 | 수동 JSON 입출력 별도 |
| [#10](https://github.com/0-FLANDRE-0/SPACE_Project/pull/10) | ECON-SIM-1/2/3 | **오프라인 검증 완료** | 비용값 미채택, 게임 전력망 미통합 |
| [#11](https://github.com/0-FLANDRE-0/SPACE_Project/pull/11) | RESOURCE-UNIT-1 / PACKAGING-1 | 구현 제출 | 역사적 1U 공간 계약은 #12가 대체 |
| [#12](https://github.com/0-FLANDRE-0/SPACE_Project/pull/12) | RESOURCE-CARGO-2 / SCU PACKAGING-2 | 구현 제출 | U/SCU 분리·컨테이너7종·회수·자동조합 |
| [#13](https://github.com/0-FLANDRE-0/SPACE_Project/pull/13) | SCU-2 FOLLOW-UP-1 | **현재 최신 구현** | 시계 버그 수정·현지 광석 로트 봉인/개봉 |

## 문서 전용 PR #14 — 기능 구현 PR과 구별

- [PR #14](https://github.com/0-FLANDRE-0/SPACE_Project/pull/14)는 **PR #13 HEAD를 기반으로 작성한 문서 전용 아카이브**다. 최신 **기능 코드 HEAD는 여전히 PR #13**이고 PR #14가 새로운 게임 시스템을 구현한 것은 아님.
- 초기 아카이브 11개 Markdown에 **[05A 선체/장갑/LOS](05A_HULL_FORMS_ARMOR_LOS_DETAIL.md)**·**[04A 반응로](04A_REACTOR_TECH_AND_UPGRADES.md)**·**[02A 테크트리 감사](02A_TECH_TREE_AI_ENHANCED_SOURCE.md)**·**[10 Claude 보충](10_CLAUDE_DISCUSSION_SUPPLEMENT.md)**을 추가해 현재 **15개 Markdown**, 별도로 [AI 보강 JSON 원문](sources/SPACE_Project_연구테크트리_AI보강시안_2026-10-31.json)을 보존했다. 이 브랜치의 [docs/DECISIONS.md](../../DECISIONS.md)도 동기화했다.
- 변경 내용은 함급 9개 명칭, 같은 함급 안의 복수 고정 선체 형식/면별 장갑 최대치, LOS 가시성과 경사 장갑 관통 경로 구별, HAC 길이 구상·건조비 잠정 상태, 테크트리 JSON 구조 원문 재확인 등 **문서 보강만**이다. 경제 후보 채택·함선 전투 구현·기존 PR 병합은 진행하지 않음.
- 실게임 빌드/테스트 개수 **404 PASS**는 PR #13의 이전 **제출 로그**다. PR #14 문서 보강이 별도 기능 테스트나 독립 CI를 통과했다는 뜻이 아니다.

## Claude 보충·AI 테크트리 원문 수록 (2026-11-02, 문서만)

- 사용자가 제공한 **[10 Claude 논의 보충](10_CLAUDE_DISCUSSION_SUPPLEMENT.md)** 원문을 변경 없이 보존해 최신 사용자 결정/구상/Claude 제안을 분리했다.
- [AI 테크트리 보강 JSON](sources/SPACE_Project_연구테크트리_AI보강시안_2026-10-31.json)을 **UTF-8 원문 그대로** 보존하고 [02A 구조 감사](02A_TECH_TREE_AI_ENHANCED_SOURCE.md) 작성. **3분류/19분야/12시대/45노드/72연결**, 구형13노드·20연결 보존/지식 K 재제안.
- 연구소1개/천체·연구 슬롯/협력, 보호막·8단계 드라이브, 발전3체급, 시설 연간 합금 보수2~5%/재가동, 화물선/궤도·추가 ECON4 판정 등을 아카이브와 `docs/DECISIONS.md`에 기록했다.
- 이번 변경은 **문서/JSON 기획 자료만**. PR #13 HEAD가 최신 실게임 기능 코드이며 현재 코드 테스트 404 PASS는 **과거 제출 로그**로만 표시한다. 연구·배송·전투·정식 전력망/재가동 기능을 구현했다고 주장하지 않는다.

## 주요 기준 커밋

- ECON-SIM-1/2/3: PR #10 `f4bc5e46ad8952b8f6eb981692b32ef94ee1fc08`.
- 포장 기반: PR #11 `58b6b0c6d17e35988e3580cc247e11083b741d21`.
- SCU 분리: PR #12 `f2aa8a824020042d201c552d55f8f4a82ab2a6a6`.
- SCU 보완: PR #13 `edc0d4257dad9cd46622fc8b00f039b68479b601`.
- 해당 아카이브는 PR #13 HEAD에서 파생된 **문서 전용 별도 브랜치**를 사용. 기존 PR과 `main` 소스 변경/병합 없음.

## #13 실제 확인 사항과 품질 증거

- [완료 보고](https://github.com/0-FLANDRE-0/SPACE_Project/blob/edc0d4257dad9cd46622fc8b00f039b68479b601/docs/resource-cargo-scu/followup-1/REPORT_KO.md), [검증·원시 로그](https://github.com/0-FLANDRE-0/SPACE_Project/blob/edc0d4257dad9cd46622fc8b00f039b68479b601/docs/resource-cargo-scu/followup-1/VERIFICATION.md), [후속 미정](https://github.com/0-FLANDRE-0/SPACE_Project/blob/edc0d4257dad9cd46622fc8b00f039b68479b601/docs/resource-cargo-scu/followup-1/FOLLOW_UP.md).
- **[코드 확인]** `dist/src/packaging-clock.js`와 `container-automation.js`에 산업 정산 시각·예약 시작 시각·재포장 처리량 연동이 존재. 기존 500일 유휴 후 8SCU/h 설비에서 32SCU 재포장 예약 직후 1시간 만에 전량 완료되던 결함을 막음.
- **[코드 확인]** `ore-lot-manifest.js`, `industry-ore-packaging.js`, `industry-ore-ledger.js`로 광맥·품질·가공 난도에 묶인 단일 로트 봉인/개봉. 기존 제련은 봉인 원광을 소비하지 못함.
- **[제출 로그 확인]** 기준 PR #12 검사 73모듈/367 PASS → #13 검사 78모듈/404 PASS. 37개 추가. 실패0/skip0. 실제 제출 `tests.log`, `clock-before.log`/`clock-after.log` 결과를 확인.
- **[제출 로그 확인]** Chromium 관련 7개 스크립트 PASS, 1440×1000/844×390/667×375/390×844 환경 새 로트·시계·저장 경로 검사. 페이지/콘솔 오류0 보고. 실물 모바일 하드웨어/사파리는 미검증.
- **[보존 로그]** 원본 공식·ECON 238개 해시, PR #12 기준 보호 712개 경로, 구 v1/v2/v3 fixture 재현 및 산업 750.125일 경로 보존이라고 기록. 이는 제출 로그를 확인한 것이며 독립 재실행 아님.
- 현재 산업 저장 **schema v4**, 패키징 book **v3**. 구 v1/v2/v3는 각 이전 validator 검사 뒤 원본 백업을 통해 명시 이관.
- **독립 CI 미확인:** GitHub Actions 연관 성공 실행 기록 없음. 로컬 제출 로그와 CI 통과를 혼동하지 말 것.

## 어떤 것이 아직 게임 본체 미구현인가

| 항목 | 상태 |
|---|---|
| Sol19 프리셋·표면 지도·정부 건설·채굴·제련 | 개발 브랜치의 동작 코드 |
| U↔SCU 물리 견적·컨테이너 원장·로트 현지 봉인 | #13 개발 브랜치 동작 코드 |
| 정식 컨테이너 기본 실행 | 직접 C/전력 `null`로 대기; 테스트에서는 명시 비용 주입 |
| 행성 내/천체 간 실제 배송·in-transit 실물 이동·화물선 | **미구현**; 계약/경계 API만 있음 |
| 행성별 발전소를 플레이어가 건설·가동하는 실게임 시스템 | **미구현**; #10은 오프라인 실험 |
| 연구 진행/함선 자유 설계·실전 기동·교전·조선소/나포 | **미구현** |
| ECON-SIM-4 | **미착수** |

## 개발/저장 유의점

- 기본 실험 실행은 transient. 새로고침 때 개발 상태가 초기화되고, 수동 JSON 내보내기·검증/확인 후 가져오기만 제공. 프로토타입 테스트를 본격 영구 저장으로 착각하지 말 것.
- 품질 lot, 정부 자원, C 계정, SCU, 시계, 상태이관은 연동된 보존 계약. 새로운 기능 추가 시 현재 validator를 없애거나 검사량을 줄여 통과시키면 안 됨.
- 과거 ECON-SIM 원시 결과는 재현성/비교 자료. SCU-2 및 후속 변경 후 검증을 다시 하지 않고 공식 수치로 승격하지 말 것.
