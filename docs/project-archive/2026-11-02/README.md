# SPACE_Project — 대화·기획·구현 종합 아카이브

> **스냅샷:** 2026-11-02 (Asia/Seoul) · **프로젝트:** [0-FLANDRE-0/SPACE_Project](https://github.com/0-FLANDRE-0/SPACE_Project)  
> **기준 코드:** [PR #13](https://github.com/0-FLANDRE-0/SPACE_Project/pull/13) HEAD `edc0d4257dad9cd46622fc8b00f039b68479b601`  
> **아카이브 성격:** 기존 인계서·기획 백업·이번 대화·검증 보고·GitHub 코드 확인 사항을 주제별로 재정리한 **시점별 기록**. 채팅 전체 원문의 문자 그대로 복제본은 아님.

## 먼저 읽을 1분 요약

- **[구현/PR 제출]** 항성계·행성 표면·19천체 지질, 지구 92셀 인구, 세계 시계, 정부 광업·제련, U 재고 및 SCU 포장·회수, 원광 품질 로트 현지 봉인·개봉까지 프로토타입/기능 브랜치에 구현.
- **[코드 리뷰 확인]** 최신 SCU 보완 PR #13은 500일 유휴 뒤 수동 재포장 시계 결함을 재현·수정했고, 광석 1U=4SCU를 품질·광맥 출처·가공 난도 로트와 연결.
- **[제출 로그]** PR #13 `npm test` 404/404, `npm run check` 78모듈, 관련 Chromium 7개 스크립트 PASS 기록. **독립 GitHub Actions CI PASS 및 실제 iOS/Safari 검증은 없음.**
- **[오프라인 검증]** ECON-SIM-1/2/3은 연구용 시뮬레이터. **ECON-SIM-3 최종 종합 합격 후보 0개**이고 결과는 게임 공식 밸런스로 채택하지 않음.
- **[미정]** 포장 직접 C/전력, 수소 액화/극저온/장거리 배송 비용, 발전·산업 실운영비의 공식값, 소형 식민지 전원, ECON-SIM-4.
- **[미구현]** 실제 물류 배송·수송선·항로, 행성 전력망과 경제 본체 통합, 연구 런타임, 함선 건조·3D 항행·전투. 함선과 전투 철학은 비교적 자세하게 정리돼 있음.
- **[GitHub 주의]** 확인 시 PR #1~#13 모두 Open/미병합. `main`은 최신 개발 상태를 그대로 담지 않음. 이 아카이브도 PR #13을 기반으로 한 **문서 전용 후속 브랜치**에 작성함.

## 문서 지도

| 문서 | 내용 |
|---|---|
| [01_IMPLEMENTATION_AND_PR_STATUS.md](01_IMPLEMENTATION_AND_PR_STATUS.md) | PR #1~#13, 구현·실행 범위, 기준 커밋, 검증 근거, GitHub 브랜치 주의 |
| [02_WORLD_RESEARCH_INDUSTRY.md](02_WORLD_RESEARCH_INDUSTRY.md) | 게임 철학, 3D/섹터/표면, 시간, 인구, 지질·시설·산업, 연구 및 200년 캠페인 |
| [03_RESOURCE_SCU_PACKAGING.md](03_RESOURCE_SCU_PACKAGING.md) | U/SCU/C/Q, 표준 컨테이너 7종, 소재 회수, 수소, 광석 로트, SCU 보완 패치, 물류 경계 |
| [04_ECONOMY_POWER.md](04_ECONOMY_POWER.md) | ECON-SIM 1~3의 결과, 발전 모듈, 광업·제련 전력, 초기 식민지 소형 전원, ECON-SIM-4 범위 |
| [05_SHIPS_AND_COMBAT.md](05_SHIPS_AND_COMBAT.md) | 9함급, 고정 선체 형식과 장갑면 한계, HAC/타이탄, 직접 조종, 형상·LOS, 확률·국소손상 전투 |
| [06_DECISIONS_AND_SUPERSEDED.md](06_DECISIONS_AND_SUPERSEDED.md) | 사용자 확정 / 잠정 / 제안 / 폐기 및 구자료 상충 해결 |
| [07_NEXT_STEPS_AND_OPEN_QUESTIONS.md](07_NEXT_STEPS_AND_OPEN_QUESTIONS.md) | 향후 작업 순서·의존성·완료 판정·남은 결정사항 |
| [08_CONVERSATION_CHRONICLE.md](08_CONVERSATION_CHRONICLE.md) | 이번 채팅에서 실제 이어진 논의 흐름과 새로 정리된 핵심 사항 |
| [09_SOURCE_MAP.md](09_SOURCE_MAP.md) | 1차 첨부 원본, 기획 백업17종, 온라인 보고서/근거 지도 |
| [NEW_CHAT_HANDOFF_KO.md](NEW_CHAT_HANDOFF_KO.md) | 새 채팅에 붙여넣을 짧은 인계 메시지 |

## 상태 표기의 뜻

- **[사용자 확정]** 최근 대화에서 사용자가 직접 선택·수정한 규칙. 기술적 세부가 확정됐다는 뜻은 아닐 수 있음.
- **[방향 결정]** 전체 인계자료에서 일관되게 반복된 설계 철학/기획 방향.
- **[구현 확인]** 지정 브랜치/HEAD의 실제 코드나 diff에서 확인한 기능. `main` 배포/게임 모든 시스템과의 통합을 뜻하지 않음.
- **[제출 로그 확인]** Codex의 테스트 실행 출력·보고서 및 로그와 일치하는 결과. 별도 재실행 또는 독립 CI 통과를 의미하지 않음.
- **[잠정]** 시뮬레이션의 기준 입력/추정 크기/게임 밸런스 후보.
- **[제안]** 과거 Claude·ChatGPT 등의 아이디어, 사용자 승인이 분명하지 않은 것.
- **[미정]** 숫자·수식·기능 범위가 미합의.
- **[미구현]** 해당 HEAD의 게임 실행 본체에는 기능이 없음.
- **[폐기/대체]** 최근 명시적인 정책이 역사적 설정을 대체함.

**판독 우선순위:** 최근 사용자 발언 > 사용자 승인 지시/구체 요구 > 현재 코드에서 확인된 구현 사실 > 과거 인계서 > Claude/ChatGPT의 미승인 수치. **'코드에 있음'과 '밸런스 최종 확정'을 같은 말로 사용하면 안 됨.**

## 자료 출처와 보존 정책

1. 사용자가 제공한 2026-11-01 **종합 인계서**, **함선·생산·전술전투 상세 인계서**, 2026-10-31 **함선 기획 백업 11번**, 그리고 2026-11-02 **SCU-2 FOLLOW-UP-1 Codex 지시서**를 현재 대화의 원본 근거로 사용. 일부 문서는 로컬 첨부로만 존재하므로 GitHub에 원문 전체가 게시됐다고 주장하지 않음.
2. 최신 실제 변경은 [PR #13 구현·검증](https://github.com/0-FLANDRE-0/SPACE_Project/tree/feat/resource-cargo-scu-followup-1/docs/resource-cargo-scu/followup-1) 및 [PR #12](https://github.com/0-FLANDRE-0/SPACE_Project/pull/12), [PR #11](https://github.com/0-FLANDRE-0/SPACE_Project/pull/11) 기준. 경제 검증은 [PR #10](https://github.com/0-FLANDRE-0/SPACE_Project/pull/10) 산출물.
3. 상세 원시 결과, 숫자 후보 및 화면 회귀는 **원래 보고서/로그가 1차 출처**. 이 아카이브는 설명·탐색용 2차 인덱스.
4. 이 폴더는 **스냅샷**이므로 이후 새 PR이 생기면 새 날짜 스냅샷 또는 명시적인 갱신 로그를 추가. 과거 실패·결정/미결정 표시를 지우지 말 것.
5. 채팅의 개인·계정 정보, 다른 프로젝트의 비관련 비공개 파일, 실제 대화의 원문 전부를 무단 전재하지 않음. 

## 권장 다음 흐름 — 확정 일정 아님

**소형 식민지 발전 모듈 후보 설계 → ECON-SIM-4 별도 검증 → 사용자 승인된 비용·전력 기준 채택 → 실제 발전/경제 런타임 연동 → 위치 기반 물류 → 함선 설계·건조·전투.**

포장재 U와 SCU의 기반이 만들어졌다고 **실제 운송선이나 자동 배송이 구현된 것은 아님**. 실제 물류 구현은 경제 검증과 분리할 수 있음.

**이 파일의 핵심 용도:** 다음 채팅에서 아카이브 링크부터 전달해 과거 대화의 결정·제안·미구현을 다시 섞지 않도록 하는 것.
