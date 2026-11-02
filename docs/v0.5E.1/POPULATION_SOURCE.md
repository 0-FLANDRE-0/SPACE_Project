# 지구 인구 자료 출처와 재배분

취득: **2026-11-01 (KST)**. 제품 하나만 사용했다. 국가별 비중이나 섹터별 인구를 추정해 작성하지 않았다.

| 항목 | 실제 사용한 자료 |
|---|---|
| 제작 | European Commission, Joint Research Centre / GHSL |
| 제품 | GHS-POP R2023A, E2025, V1-0 |
| 공간 해상도 | 원본 1,000 m 셀 |
| 좌표계 | World Mollweide, ESRI:54009, WGS84 기반 |
| 래스터 크기 | 36,082 × 18,000, float64, nodata=-200 |
| 지리 값 | 셀당 사람 수; 명/km²가 아님 |
| 기준 연도 | 2025 epoch. R2023A의 모형화/추계 공간 분포이며 2025 현장 센서스나 2100 예측이 아님 |
| 공식 설명 | https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php |
| DOI | https://doi.org/10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE |
| 실제 다운로드 | https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_POP_GLOBE_R2023A/GHS_POP_E2025_GLOBE_R2023A_54009_1000/V1-0/GHS_POP_E2025_GLOBE_R2023A_54009_1000_V1_0.zip |

원본 ZIP 323,340,844바이트를 다운로드하고 압축 안의 GeoTIFF를 직접 읽었다. TIFF는 262,164,752바이트다. 3,043만 개의 양수 픽셀을 실제로 집계했으며 게임 배포에는 이 대용량 래스터를 포함하지 않는다. 게임은 정적 92셀 파생값만 사용하므로 외부 인구 API/인터넷이 필요 없다.

## 사용 조건과 표시

자료 패키지 `GHSL_Data_Package_2023.pdf` Terms of Use에 다음과 같이 명시되어 있다.

> The data in this data package are provided free-of-charge © European Union, 2023. Reuse is authorised, provided the source is acknowledged.

EC Decision 2011/833/EU에 따른 출처 표시를 유지한다. 문서 자체의 CC BY 4.0 표기와 데이터의 위 재사용 조건을 구분했다. 원본의 수정/파생 내용은 **1km 셀 중심을 게임 92개 광역 섹터로 합산하고 사용자 지정 총인구에 정규화**한 것이다. 게임 안 범례와 이 문서는 GHSL 2025 출처 및 게임용 2100 시작 시나리오 총량 고정이라는 차이를 유지한다.

## 원본 체크섬

- ZIP SHA256: `cd630f51ac65dff2a0c7ad252333bbb20c5cf9de4d85eef04e22ef3699d80c95`
- TIFF SHA256: `db9cdc20a7ab6d383f63b10b70929887fbd96200452cd48e4b6515c1a52b0f75`
- 산출물 체크섬/서명: [earth-population-e1.json](../../dist/data/planet-surfaces/earth-population-e1.json)의 `source.aggregateSha256`, `before.sha256`, `after.sha256`. 최종 지구 JSON SHA256은 `42c8333e20cd1fef7bbbbbc65ac3edc5d63366d2f5ae75581cfa629c55ce8475`.
- [실제 래스터 메타정보·92셀 가중치](ghsl-earth92-weights.json), [92셀 전/후 수치](POPULATION_COMPARISON.md), [기계 판독 보고서](POPULATION_REPORT.json).

## 집계 알고리즘과 한계

1. 기존 `createPlanetarySurfaceGrid('sol', earth)`의 fingerprint `7d4c00a6`, 92개 ID/중심/경계 법선/구면 반경을 그대로 사용했다. 로컬 +Y 북극, +X 경도0, -Z 동쪽을 따른다.
2. 원본 전체 해상도를 64행 단위로 읽는다. nodata와 실제 0을 구분하며 음수/비유한 수가 있으면 중단한다. 양수 픽셀의 원래 중심을 Mollweide에서 WGS84 경위도로 역투영한 뒤 단위 구면으로 변환한다.
3. KD-tree는 후보 4개를 줄이는 용도다. 최종 수락은 기존 `containsSurfacePoint`와 같은 모든 구면 반공간 및 각반경 검사로 한다. 후보에서 찾지 못하면 전체92개를 검사하며 동률은 ID 오름차순으로 정한다. 실제 결과: 전체 검사 fallback0, 경계 동률0.
4. 날짜변경선에 걸친 **5픽셀**은 중심이 유효 Mollweide 타원 밖에 최대 약341m 나와 있었다. 셀 자체가 타원과 겹치는 것을 확인하고 그 픽셀 안의 유효 경계로 중심을 500m 이내 이동해 인구를 전부 보존했다. 그보다 큰 예외는 오류로 처리한다. 인구를 버리거나 국가별 값을 대체하지 않았다.
5. 각 픽셀을 정확히 한 섹터에 배정한다. **원본 1km 중심점 배정**이라는 경계 근사이며 면적 비례 교차 분할은 하지 않았다. 픽셀의 값 자체가 인구수이므로 위도별 픽셀 면적이나 섹터 `areaWeight`를 다시 곱하지 않는다.
6. 원자료 합계 **8,191,988,536.304918명**의 공간 비율을 사용자 총량 **8,893,000,000명**에 적용했다. Float64 집계 가중치의 저장된 십진 표현을 BigInt 공통 정수 단위로 바꾸고 정확한 최대 잔여 방식으로 정수 명수를 배분했다. 잔여 동률은 섹터 ID 순이다.
7. 모든92개 인구 필드를 평가했다. 82개 값이 바뀌고 10개는 기존과 같은0이며, 새 분포의 실제0은19셀이다. 92셀은 수백만km² 규모이므로 도시/해안 단위 정확도나 미래 이주 예측을 의미하지 않는다.

집계 스크립트를 두 번 실행해 가중치 JSON의 바이트 일치를 확인했고, 재배분과 전체19개 프리셋 생성기도 별도 출력 디렉터리에서 바이트 일치를 확인했다. 지구 외18개 프리셋과 사용자 지구 원본은 불변이다. 지구의 지질·환경·격자·나머지2100 시나리오 필드도 보존했다.

## 재현 명령

Python의 `numpy scipy rasterio pyproj`가 필요하다. 원본 ZIP은 위 URL에서 받고 checksum을 확인한 뒤 압축을 푼다. 전체 고해상도 입력은 작업 디렉터리에만 둔다.

```sh
node scripts/export-earth-population-grid.mjs /tmp/earth-grid.json
OPENBLAS_NUM_THREADS=1 python3 scripts/aggregate-ghsl-population.py \
  --raster /path/to/GHS_POP_E2025_GLOBE_R2023A_54009_1000_V1_0.tif \
  --grid /tmp/earth-grid.json --output /tmp/earth92-weights.json
EARTH_POPULATION_OUTPUT_ROOT=/tmp/population-repro \
  node scripts/refine-earth-population.mjs /tmp/earth92-weights.json
SOL_PRESET_OUTPUT_ROOT=/tmp/sol-repro node scripts/generate-sol-presets.mjs
```

재배분 스크립트 기본 기준은 git의 `ec242b3` 지구이며, 세 번째 인자로 동일한 기준 JSON 파일을 제공할 수도 있다. 게임 런타임/일반 프리셋 재생성에는 래스터·Python 의존성이 없다. 프리셋 생성기는 보관된 소형 인구 패키지를 결정적으로 적용한다.

## 후속 결정

기존 섹터 도시화율을 수정하지 않은 채 인구만 옮겼으므로 인구 가중 전체 도시화율은 **75.000009% → 51.293690%**가 된다. 기존 도시화/기반시설·시설·소유권을 자동 보정하지 않았다. 새 인구 분포에 맞는 도시화·기반시설 분포는 별도 승인이 필요한 후속 설계다.
