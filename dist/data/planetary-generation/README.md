# 지구 육지 비율 자료

`earth-land-50m-v5.1.2.json`은 Natural Earth **1:50m Land v5.1.2** 육지 경계의 로컬 가공 결과입니다. Public Domain. [이용조건](https://www.naturalearthdata.com/about/terms-of-use/)과 함께 [라이선스 원문](NATURAL_EARTH_LICENSE.md)을 포함합니다.

- 공식 자료: https://www.naturalearthdata.com/downloads/50m-physical-vectors/
- 고정 원본: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_land.geojson
- SHA-256: `e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b`
- 0.5도 래스터의 259,200개 중심점을 원본 경계에 평가. 경계 래스터화는 16배 세밀한 작업 캔버스로 양자화 오차를 낮춘 후 중심을 추출.
- 각 점을 기존 구면 다각형에 배정하고 위도 띠의 실제 구면 면적 `sin(latNorth)-sin(latSouth)`로 가중. 타일 중심 한 점으로 판정하지 않음.
- 바디 로컬 +Y 북극, +X 경도 0, -Z 동향. 기존 텍스처/자전/ID는 변경하지 않음.
- 원천의 구면 사다리꼴 적분 육지 약 28.7475%, 래스터 약 28.8526%, 타일 면적 가중 약 28.8472%. 일반적인 '지구 육지 29%'와 다른 정의/해안선/호수/빙붕 해상도 차이가 있음.
- 50m 축척 해안선과 0.5도 표본 한계. 작은 섬/해안/호수는 생략/양자화될 수 있고 남극 빙붕 처리는 원천에 따름. 고도/토양/자원/인구 자료가 아님. 92개 광역 구역이므로 한 대륙 좌표가 속한 셀에도 바다가 포함될 수 있음.

다른 천체의 지형·기온·거주성·광석 분포는 게임용 절차적 가정입니다. 지구 인구 역시 실제 인구 자료를 자동 적용하지 않으며, 개발자가 입력한 2100 시나리오 총량을 게임 가중치로 배치합니다. 확정된 시작 인구/자원 총량이 없습니다.

브라우저는 이 로컬 JSON만 읽습니다. 실행 중 외부 지도 API 요청은 없습니다. 격자 fingerprint가 맞지 않으면 적용을 거부합니다. 실패 시 실제 자료를 썼다고 가장하지 않고 절차적 모드를 개발자가 선택할 수 있습니다.

저장소에서 재현:

```sh
mkdir -p artifacts/natural-earth
curl -fL https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_land.geojson -o artifacts/natural-earth/ne_50m_land.geojson
python3 scripts/prepare-earth-mask.py  # Pillow 필요; 오프라인 제작 단계만
node scripts/prepare-earth-mask.mjs
```

최종 게임 초기 데이터는 계속 `data/planet-surfaces/index.json`에서 등록합니다. 이 자료를 추가해도 인구·매장량 프리셋은 자동 등록되지 않습니다.
