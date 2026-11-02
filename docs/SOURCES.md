# 자료 출처와 구현 한계

조회·수집일: 2026-10-29. 모든 게임 실행 데이터와 표면 자산은 저장소에 포함하며, 실행 중 이 사이트들에 질의하지 않습니다.

## 궤도와 자전

1. **NASA/JPL Solar System Dynamics — Approximate Positions of the Planets**
   - https://ssd.jpl.nasa.gov/planets/approx_pos.html
   - Table 1의 J2000 궤도 요소 6개와 세기당 변화량. 장반경, 이심률, 경사각, 평균 경도, 근일점 경도, 승교점 경도를 사용합니다.
   - 1800–2050 범위의 근사식이며, N체 적분이나 정밀 천체력은 아닙니다. 화면은 2026-10-29부터 시작합니다.
   - 지구는 해당 표의 지구–달 질량중심 근사값으로 표시합니다. 지구 본체와 질량중심 차이를 별도 보정하지 않았습니다.
2. **NASA/JPL NAIF — IAU PCK `pck00011.tpc`**
   - https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
   - 행성·대표 위성의 극 방향 RA/Dec, 본초자오선 W와 회전율. 제공된 주기항도 적용합니다. 화성의 2차 위상 다항식도 포함합니다.
   - IAU 좌표계에서 J2000 황도 좌표계로 변환하고, 고정 축 프레임의 하위 노드에서 로컬 Y축 자전을 적용합니다. 토성 고리는 같은 프레임의 적도면에 놓습니다.
   - 자전축은 임의의 시각적 흔들림을 추가하지 않습니다. PCK에 포함된 세차·장동은 실제 자료대로 매우 천천히 변화합니다.
3. **NASA/JPL Horizons API — 위성의 접촉 궤도 요소**
   - https://ssd-api.jpl.nasa.gov/doc/horizons.html
   - 2026-10-29 00:00 TDB의 대표 위성 11개를 각각 모행성 중심·J2000 황도면 기준으로 조회했습니다.
   - 실측 장반경, 이심률, 경사각, 승교점, 근점 인수, 평균 근점이각, 공전 주기를 사용합니다. 이후에는 이 시점의 타원을 케플러 운동으로 전개합니다. 위성의 섭동·궤도면 세차 전체를 재현하지는 않습니다.
   - 역행 위성은 90°보다 큰 경사각과 양의 공전 주기로 처리합니다. 음의 주기를 중복 적용하지 않습니다.
4. **IAU 천문단위**
   - 실제 천문 참고 1 AU = 149,597,870.7 km. 이 환산은 reference* 계산 전용이며 게임 AU나 렌더링 월드 단위의 정의가 아닙니다.

재수집 스크립트: `python3 scripts/update-astronomy.py`. 인터넷이 필요합니다. 공개 사이트의 일시적인 503 응답에는 제한된 재시도를 수행합니다. 스크립트가 저장한 숫자 자료는 `dist/src/astronomy-data.js`입니다. API 응답의 텍스트 설명을 게임에 복제하지 않았습니다.

## 행성 표면 이미지 — 필수 저작자 표시

**Solar System Scope / INOVE — Solar Textures**

- 원본: https://www.solarsystemscope.com/textures/
- 라이선스: **Creative Commons Attribution 4.0 International (CC BY 4.0)**, https://creativecommons.org/licenses/by/4.0/
- 원본 다운로드 경로: `https://www.solarsystemscope.com/textures/download/<파일명>`
- 포함한 원본: `2k_mercury.jpg`, `2k_venus_atmosphere.jpg`, `2k_earth_daymap.jpg`, `2k_earth_clouds.jpg`, `2k_mars.jpg`, `2k_jupiter.jpg`, `2k_saturn.jpg`, `2k_saturn_ring_alpha.png`, `2k_uranus.jpg`, `2k_neptune.jpg`, `2k_moon.jpg`, `2k_sun.jpg`.
- 게임 내 조명, 색조, 대기 테두리와 구름 투명도를 조정했습니다. 다운로드한 이미지 파일 자체는 수정하지 않았습니다.
- 이 자료는 NASA 영상과 지리 자료를 바탕으로 제작자가 조정한 실제 천체 지도입니다. 지구의 대륙·바다·극지 형태는 실제 지도를 따릅니다. 지형 높이·산맥 메시를 만든 것은 아닙니다.
- 일부 위성은 전용 표면 자료를 넣지 않아 달 표면을 재사용하고 색을 달리한 대표 표현입니다. 해당 위성의 실제 지형 재현으로 간주하지 않습니다.
- 이 저작자 표시와 라이선스 링크는 게임 내 `?` 조작 안내에도 표시합니다. 재배포할 때 유지해야 합니다.

## v0.3 게임 좌표와 참고 좌표

- 위의 NASA/JPL 수치와 표면 자산은 변경·삭제하지 않았습니다. `reference*()` 함수에서 실제 AU 참고 좌표 계산과 기존 Horizons 비교 검증을 유지합니다.
- 실제 km 환산 상수 `REAL_AU_KM`는 천문학 참고 정보 전용입니다. 게임 AU와의 물리적 환산식은 없습니다.
- `elementsAt()`은 JPL의 이심률·방향·위상·시대 변화를 사용하되 장반경은 `orbitGameAU`를 따릅니다. 게임 위치는 실제 천체력 좌표가 아닙니다.
- Planet Size는 고정 월드 표시 지름, Star Size는 별도 월드 지름 변환, 위성은 별도 고정 지름·상대 궤도 규칙입니다. 거리 표시 AU와 렌더링 길이는 140/53배로 환산하며 크기 메시에는 이 배율을 적용하지 않습니다. 크기와 거리의 비교/충돌 검사에서는 같은 게임 AU로 역환산합니다. 동적 월드 반지름 보정은 없습니다.
- 게임 눈금은 카메라 타깃 깊이의 화면 평면 기준 게임 AU입니다. 원근 투영에서 다른 깊이의 천체에 동일한 화면 눈금을 직접 대입할 수 없습니다.
- 소행성대 195–235 AU, 카이퍼대 795–900 AU는 게임용 입자 분포입니다. 실제 개별 소천체 위치나 물리 충돌을 표현하지 않습니다.
- 게임 시간은 초당 0.02일. UTC/TDB 미세 차이, N체 섭동을 별도 보정하지 않습니다. JPL 참고식의 원래 정확도 유효 범위는 1800–2050입니다. 100년 게임 여유거리 검사는 설정의 충돌 여유를 검사하는 것으로, 이 기간의 천체력 정확도 보증이 아닙니다.

## v0.5E.1 지구 인구의 공간 비율

European Commission/JRC, GHSL **GHS-POP R2023A E2025 V1-0**의 World Mollweide1km 셀당 인구수를 실제 읽어92개 구면 섹터에 합산했습니다. ©European Union,2023, 출처 표시 조건 재사용(EC Decision2011/833/EU). 2025 모델 분포 비율을 사용자 지정2100 총량8,893 POP에 정규화했으며 도시화율/자원/환경은 바꾸지 않았습니다. [공식 제품](https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php), [DOI](https://doi.org/10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE), [실제 다운로드/체크섬/사용조건/재현/한계](v0.5E.1/POPULATION_SOURCE.md).
