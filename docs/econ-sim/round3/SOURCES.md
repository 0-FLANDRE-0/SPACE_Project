# 전력·산업 단위의 자료와 가정

확인: 2026-11-01. 자료가 게임 C의 구매력이나 2100년 기술을 확정하지 않는다. 아래 자료는 물리적 규모를 가늠하는 참고이며, 가정은 별도로 표시했다. 직접 USD→C 환산은 하지 않았다.

| 자료 | 확인한 범위 | 모형에 사용한 방법과 한계 |
|---|---|---|
| [DOE PEM electrolysis technical targets](https://www.energy.gov/cmei/fuels/technical-targets-proton-exchange-membrane-electrolysis) | 2022 시스템 소비 약55kWh/kg H₂; 장기 목표는 그보다 낮음 | 50–55kWh/kg 탐색. 10t/U이므로 **0.50–0.55GWh/U**. 스택 수치와 시스템 수치를 혼합하지 않음. 미래 상용비용 확정치가 아님 |
| [DOE Process Heating Sourcebook](https://www1.eere.energy.gov/manufacturing/tech_assistance/pdfs/process_heating_sourcebook2.pdf) | 전기로 용해 약400–500kWh/short ton의 사례 | 약0.44–0.55MWh/metric tonne, **용해 공정 일부**의 참고. 전체 철강 생산의 총에너지로 해석하지 않음 |
| [DOE Mining Industry Energy Bandwidth Study](https://www1.eere.energy.gov/manufacturing/resources/mining/pdfs/mining_bandwidth.pdf) | 채굴·분쇄 에너지는 광물과 공정에 따라 큰 차이 | 채굴/분쇄 전기 0.02–0.15MWh/t-ore, 제련 전처리 0.01–0.06은 검증용 가정. 문헌의 총에너지나 분쇄지수를 전부 전력으로 바꾸지 않음 |
| [International Aluminium Institute: China industry/technology report](https://international-aluminium.org/resources/development-of-the-aluminum-industry-and-technology-in-china/) | 중국 2022 알루미늄 전해 전력 약13.448MWh/t | Al 성분만 14MWh/t의 둥근 가정. 전체 추상 합금에 적용하지 않음. 원료/제품별 전 공정 경계와 같다고 주장하지 않음 |
| [NREL ATB 2023 Utility-scale PV](https://atb.nrel.gov/electricity/2023/index/utility-scale_pv) | 지역·설비별 발전계수의 차이 | 지구 평균계수 0.18–0.34를 탐색 가정으로 사용. 2100년이나 달/화성 관측값이 아님 |
| [JRC electrolyser water assessment](https://publications.jrc.ec.europa.eu/repository/bitstream/JRC130683/2022.5468_kjna31282enn.pdf) | 물 수요와 전해 공정 검토 | 화학량론상 물9 질량→H₂1+O₂8. 정수 U 장부에서 산소도 생성 기록. 취수/정수 손실을 모두 계산한 수문모형은 아님 |

## 합금 구성 비교

전기만 비교한다. 연료열·코크스·환원제·공정열 전체의 에너지 합계가 아니다. 제품 구성은 실제 세계의 예측 점유율이 아니라 민감도 가정이다.

| 구성 | 철강 | 기타 비철/특수금속 | 알루미늄 | 가중 전기 MWh/t-alloy |
|---|---:|---:|---:|---:|
| steelHeavy | 80% | 15% | 5% | 2.025 |
| mixed | 60% | 25% | 15% | 3.575 |
| nonferrousHeavy | 30% | 40% | 30% | 5.900 |

성분 원단위는 철강1.0, 기타3.5, Al14MWh/t이다. 철강1.0은 전기로 용해 외 전처리 등을 포함시키는 탐색 가정, 기타3.5는 자료가 충분하지 않은 집계 가정이다. 기타 금속과 특수합금의 생산방법·재활용 비율까지 식별한 자료가 없으므로 실측 평균이라고 표시하지 않는다. 채굴 및 광석 전처리 전기는 제품 원단위와 별도로 계산한다. 수소 전기분해는 별도 소비다.

## 게임 계약과 참고 데이터

출력·모듈 수·기간·핵융합 기동과 수소 소비는 [사용자 지시서](REQUEST_KO.md)와 [보강문](USER_SUPPLEMENT_KO.md)이 출처다. 실제 상용 핵융합 발전소의 경제성으로 해석하지 않는다.

산업 C/U 비용·처리량·난도·램프업은 기존 `industry-policy.js`, `industry-runtime.js`, `ore-quality.js`를 읽어 재사용한다. 기존 수소 상수는 내보내지 않으므로 읽기 전용 계약 어댑터가 소스 패턴·해시를 검사하고 불일치하면 중단한다. 게임 파일을 수정하지 않았다.

지구 8.12TW / 약71,144TWh/년은 요청의 **2100년 검증용 가정**이다. 8,120GW×8,760h를 정확히 계산하면71,131.2TWh(표기 참고값과0.018% 차이)다. 수치 모형은 **730h/월, 8,760h/년**을 일관되게 사용하며, 30일 게임 런타임을 바꾼 것이 아니다.

달/화성 수원·광석·수소원은 Git의 공식 프리셋에서 읽었다. 달은 등록된 수원/수소원이 없고 화성은 수원 셀19가 있으나 광업 수소원은 없다. 이는 이 게임 프리셋의 접근 가능성이지 실제 달에 얼음이 존재하지 않는다는 천문학 주장과 다르다. 부존량·원천 ID·품질·인구 분포 파일은 변경하지 않는다.
