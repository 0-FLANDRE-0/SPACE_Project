# 최신 검증 — v0.5E

2026-11-01 (KST). 소스 **48모듈**, 자동 테스트 **151개 통과**(기존131+산업20, 실패/건너뜀0). Chromium/Playwright **9개 스크립트 통과**, page/console error0. PC1440×1000, 터치844×390/667×375/390×844에서 소형 정보 패널·구획·건설/완공·생산·증설/개량·선택 해제/닫기·저장/복원을 검증했습니다. 실기기/Safari/GPU는 미검증입니다.

[v0.5E 전체 결과·로그·16개 캡처](v0.5E/VERIFICATION.md) · [산업 데이터·정산·저장·잠정값](v0.5E/IMPLEMENTATION.md) · [승인/UI 보강](v0.5E/UI_SUPPLEMENT_KO.md).

`git diff --exit-code 47c062b -- dist/data` 변경 없음. 정적19개 프리셋/원본 지구·2100 시나리오를 보존하고 별도 산업 런타임만 저장합니다. 정식 재정·재고가 미정이어서 별도 개발 캠페인으로 산업 루프를 시험합니다. 신규 ZIP을 만들지 않습니다.

## 이전 v0.5D.1 기록

2026-10-31. 소스43모듈, 자동 테스트131개(기존122+보정9). 태양계19개 실제 v2 프리셋의 스키마·격자·예산·품질 가중평균·광맥 연결·참조/사용자 지구 원본을 검사합니다. PC1440×1000와 터치844×390/667×375의 기존5개 회귀 및 새 자원 브라우저 흐름은 상세 로그에 기록했습니다. 실제 iPhone/Safari/실기기 GPU는 미검증입니다.

[상세 결과·명령·모바일 캡처](v0.5D/VERIFICATION.md) · [완료 보고·확정/잠정값](v0.5D/REVIEW.md) · [19개 수치/시드](v0.5D/preset-report.json) · [지구 원본/추가 정책](v0.5D/sources/EARTH_SOURCE.md) · [v0.5C 기록](v0.5C/VERIFICATION.md) · [원본/미래 상태 계약](architecture/TERRAFORMING_DATA_CONTRACT.md)

[D.1 보정 전후·지구 그룹별 셀과 양](v0.5D/D1/COMPARISON.md) · [전체 A/k/범위·예외](v0.5D/D1/REPORT.json). generatorVersion2만 변경하고 기존 로컬 초안은 자동 교체하지 않습니다. 새 ZIP은 사용자 요청대로 만들지 않습니다.
