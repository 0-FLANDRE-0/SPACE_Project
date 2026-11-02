# 09. 1차 자료·인계서·기획 백업/PR 근거 지도

> 이 페이지의 목적은 **'이 수치/결정의 원문을 어디서 확인하나?'**를 새 채팅에서 잃어버리지 않는 것임. 표의 '사용자 첨부'는 **해당 채팅에 제공된 원본**이지 GitHub 저장소에도 원문이 있다고 뜻하는 게 아님. 무단으로 원본 파일 전부를 저장소에 복사하지 않았음.

## 이번 아카이브 작성 시 직접 읽거나 GitHub에서 확인한 소스

| 근거 | 성격과 주의 |
|---|---|
| 사용자 첨부 `SPACE_Project_새채팅_종합인계서_2026-11-01.md` | 11월1일의 장문 프로젝트 요약. 당시 PR #11까지 조회한 상태라 SCU2 미구현 표기는 **현재는 구정보** |
| 사용자 첨부 `SPACE_Project_함선설계_전투_상세인계서_2026-11-01.md` | 함선 설계·항행·확률 기반 전투·경제 연결. 숫자는 방향/잠정/제안으로 분류해 사용 |
| 사용자 첨부 `11_함선_선체_설계_생산_개수.md` | 10월31일 기획 백업. 9개 함급/설계/제작·수리의 초기 방향; **옛 명칭 사용** |
| 사용자 제공 `SPACE_Project_SCU_2_FOLLOWUP_1_Codex_지시서_KO.md` | 2026-11-02 SCU 시계·광석 로트 보완 요구/수용 기준 |
| 현재 채팅의 사용자 발언·응답 | HAC 길이 구상/선체 형식/LOS, Claude 명칭 선택, 광석4SCU 재확인, ECON4 범위·다음 단계 등 최신 정정 |
| [PR #13](https://github.com/0-FLANDRE-0/SPACE_Project/pull/13) | 최신 SCU followup 코드/제출 검증·v4 산업 저장 |
| [PR #12](https://github.com/0-FLANDRE-0/SPACE_Project/pull/12) | U와 SCU 분리/표준용기/수소 legacy·물류 계약 |
| [PR #11](https://github.com/0-FLANDRE-0/SPACE_Project/pull/11) | 역사적 resource-unit 패키징 기반(옛 U 공간 계약 포함) |
| [PR #10](https://github.com/0-FLANDRE-0/SPACE_Project/pull/10) | ECON-SIM 1/2/3 오프라인 코드·보고서·실험 |
| [PR #1~#9](01_IMPLEMENTATION_AND_PR_STATUS.md) | 항성계·표면·지질·정부 산업·지구 인구·개발 세션 |

## 핵심 온라인 원시 보고서

- [ECON-SIM-1 REPORT_KO](https://github.com/0-FLANDRE-0/SPACE_Project/blob/f4bc5e46ad8952b8f6eb981692b32ef94ee1fc08/docs/econ-sim/REPORT_KO.md).
- [ECON-SIM-2 REPORT_KO](https://github.com/0-FLANDRE-0/SPACE_Project/blob/f4bc5e46ad8952b8f6eb981692b32ef94ee1fc08/docs/econ-sim/round2/REPORT_KO.md).
- [ECON-SIM-3 REPORT_KO](https://github.com/0-FLANDRE-0/SPACE_Project/blob/f4bc5e46ad8952b8f6eb981692b32ef94ee1fc08/docs/econ-sim/round3/REPORT_KO.md).
- [ECON-SIM-3 설정 JSON](https://github.com/0-FLANDRE-0/SPACE_Project/blob/f4bc5e46ad8952b8f6eb981692b32ef94ee1fc08/scripts/econ-round3.config.json) / [구현](https://github.com/0-FLANDRE-0/SPACE_Project/blob/f4bc5e46ad8952b8f6eb981692b32ef94ee1fc08/docs/econ-sim/round3/IMPLEMENTATION.md).
- [SCU-2 구현/API](https://github.com/0-FLANDRE-0/SPACE_Project/blob/f2aa8a824020042d201c552d55f8f4a82ab2a6a6/docs/resource-cargo-scu/IMPLEMENTATION.md), [REPORT_KO](https://github.com/0-FLANDRE-0/SPACE_Project/blob/f2aa8a824020042d201c552d55f8f4a82ab2a6a6/docs/resource-cargo-scu/REPORT_KO.md), [검증](https://github.com/0-FLANDRE-0/SPACE_Project/blob/f2aa8a824020042d201c552d55f8f4a82ab2a6a6/docs/resource-cargo-scu/VERIFICATION.md), [후속](https://github.com/0-FLANDRE-0/SPACE_Project/blob/f2aa8a824020042d201c552d55f8f4a82ab2a6a6/docs/resource-cargo-scu/FOLLOW_UP.md).
- [SCU FOLLOW-UP-1 REPORT](https://github.com/0-FLANDRE-0/SPACE_Project/blob/edc0d4257dad9cd46622fc8b00f039b68479b601/docs/resource-cargo-scu/followup-1/REPORT_KO.md), [검증](https://github.com/0-FLANDRE-0/SPACE_Project/blob/edc0d4257dad9cd46622fc8b00f039b68479b601/docs/resource-cargo-scu/followup-1/VERIFICATION.md), [저장](https://github.com/0-FLANDRE-0/SPACE_Project/blob/edc0d4257dad9cd46622fc8b00f039b68479b601/docs/resource-cargo-scu/followup-1/SAVE_SCHEMA.md), [후속](https://github.com/0-FLANDRE-0/SPACE_Project/blob/edc0d4257dad9cd46622fc8b00f039b68479b601/docs/resource-cargo-scu/followup-1/FOLLOW_UP.md).
- [최신 결정 장부](https://github.com/0-FLANDRE-0/SPACE_Project/blob/edc0d4257dad9cd46622fc8b00f039b68479b601/docs/DECISIONS.md) (이전 버전 기록과 날짜 충돌 가능, 최신 사용자 발언으로 대조).

## 2026-10-31 기획 백업17종의 분야 인덱스

아래의 원본이 **모두 현재 채팅에 직접 첨부됐다는 뜻은 아님**. 이전 종합 인계서의 '기획 백업17종' 목록에서 확인한 파일명·용도를 보존한 2차 목록. 현재 코드 상태는 새 PR이 우선함.

| 백업 | 주제 |
|---|---|
| `00_처음_읽기_구현현황.md` | 그 당시 구현과 미구현 구분 |
| `01_연구_지식_발견_종합테크트리.md` | 연구력/지식/과제 진도, 정부·민간 연구 |
| `02_연구_이론_심화_실현_검증.md` | 이론·심화·실현, 실제 실험 대기/실패 구분 |
| `03_정부시설_섹터건설슬롯.md` | 국가 1~4 시설 슬롯과 민간 시설 분리 |
| `04_전력_발전_축전_공급.md` | 전력/전기에너지/축전, R3는 이후 오프라인 구현 |
| `05_광업_매장량_품질_제련.md` | 진실/발견/원광 품질/로트·수율 |
| `06_정부_민간경제_시장_재정.md` | 국가 C/실물 U와 민간 자율경제 |
| `07_재고_물류_교역_수송.md` | 위치별 재고/행성 및 천체 간 단계별 물류 |
| `08_탐사_지질조사_문명별인지.md` | 탐사와 문명별 발견/검증 |
| `09_인구_식민지_노동_사회.md` | POP·노동·주거/사회·식민지 |
| `10_행성표면_테라포밍_지상작전.md` | 테라포밍/지상 충돌·원본 보존 |
| `11_함선_선체_설계_생산_개수.md` | 9함급·모듈·장갑·생산/개수; 이번 채팅에 직접 첨부됨 |
| `12_항행_이동_전술전투_차단.md` | 3D 관성/장거리 드라이브/차단·전투 |
| `13_게임시간_배속_오프라인.md` | 1×=10:1 시계, 미래 오프라인 정산 |
| `14_항성계_섹터_행정_확장.md` | 3D/평면 육각/구면 표면 3계층 |
| `15_개발순서_의존성_검증기준.md` | 당시 작업 순서·보존/회귀 기준 |
| `16_미결정사항_및_합의목록.md` | 그 당시 확정/잠정 표시, 최신 상태와 대조 필요 |

## 2026-11-02 보강 때 원문 추가 확인

- 사용자 업로드 **'SPACE_Project_미구현_설명서_17종_2026-10-31.zip'** 안의 원본 11번 **선체·설계·생산·개수**, 12번 **항행·3D 전술·차단**을 직접 열어 읽었다. 9함급의 **역할과 규모 분리**, 자유 조립·방향별 장갑/국소손상, 추진/드라이브 분리는 당시 원문에서도 확인된다. 반면 **최신 함급 한국어 명칭·동일 함급의 여러 고정 선체 형식·형식별 면별 최대 장갑 두께·HAC 280~300m 초반**은 10월31일 원문보다 **이후 사용자 정정**에서 추가된 내용이다.
- 사용자 업로드 **'SPACE_Project 연구 테크트리_2026-10-31.json'** 직접 확인: catalog.categories **3**, catalog.fields **19**, catalog.eras **12**, nodes **13**, edges **20**. 초안 구조 확인일 뿐 기술 해금·게임 런타임 확정은 아니다.
- **[선체 형식 상세 보강](05A_HULL_FORMS_ARMOR_LOS_DETAIL.md)**과 [현 브랜치의 docs/DECISIONS.md](../../DECISIONS.md)를 2026-11-02에 연결했다. 05A에는 [사용자 결정]과 [설계 해석/제안]을 구분하고, LOS의 가시성과 장갑 관통 경로를 분리한다.
- 위 ZIP/JSON의 원문이 **GitHub archive 폴더에 통째로 새로 복사됐다는 뜻은 아니다.** 실제 소스는 첨부이며, GitHub의 새 문서는 근거·해석/현재 결정을 명시한 2차 자료다.

## AI 보강 JSON과 Claude 보충 — 원문 확보·보존

- 이번 사용자 첨부 [보강 테크트리 JSON](sources/SPACE_Project_연구테크트리_AI보강시안_2026-10-31.json)은 GitHub에 원문 그대로 보존했고 read-back 비교도 일치. SHA256: `6dbf07d16ae795302b7729b4bd7ea88a197ee75c4a9334ace5557d5d78075d20`. **45노드·72연결**, 2026-10-31 구초안의 **13노드·20연결**에서 확장. 13개 구노드의 K 요구량은 AI 잠정 제안. 상세 [02A 연구 트리 감사](02A_TECH_TREE_AI_ENHANCED_SOURCE.md).
- 이번 사용자 첨부 [10 Claude 대화 보충](10_CLAUDE_DISCUSSION_SUPPLEMENT.md)도 원문 그대로 보존하고 read-back 비교 일치. SHA256: `f069e28ed9839c1ca4e955d841984c96a217698ef82dcd5eb4eea356264fa1e0`. 사용자 결정·구상·Claude 제안은 파일의 구분을 그대로 존중함. 이는 전체 대화 원문이 아닌 **대화 재구성 기록**이다.
- 두 파일이 GitHub에 있으므로 기존의 **'보강 JSON 미확인' 기록은 대체**. 정확한 연구 노드/조건은 보존된 JSON을 직접 참조하고, 제안 단계 K/C/U/시설 수치를 사용자 최종 승인으로 취급하지 말 것.
- 최신 결정 기록은 [06](06_DECISIONS_AND_SUPERSEDED.md) 및 [동기화된 docs/DECISIONS.md](../../DECISIONS.md).

## 문서 인용 및 갱신 규칙

1. **숫자**는 최신 사용자 명시 결정 / 코드·테스트 / 기획 후보 / Claude 제안 중 무엇인지 옆에 붙임.
2. **미구현**을 확인할 때는 이 아카이브 날짜와 해당 PR HEAD를 밝히고 최신 GitHub 변경을 다시 조회.
3. ECON-SIM-4가 진행되면 R3 역사 결과를 덮어쓰지 말고 새 비교표와 새 날짜/커밋으로 별도 보존.
4. 새로운 원문 파일이 첨부되면 **원문 우선 직접 확인**. 근거가 없는 기획 간격을 상상으로 메우지 않음.
5. 채팅 원본 전체가 여기 업로드되었다고 말하지 않고, **현재 접근 가능한 근거를 바탕으로 주제별 재구성**한 아카이브임을 유지.
