# 원본·2100 시나리오·향후 현재 상태 계약

v0.5C는 초기 데이터 작성 도구입니다. 테라포밍, 채굴 소비, 인구 성장 또는 시간 적분을 실행하지 않습니다.

## 소유권

| 레이어 | 소유 데이터 | 변경 정책 |
|---|---|---|
| GridDefinition | tileId, 중심/경계, neighborIds, 면적, 방향/f/fingerprint | 고정. 생성·환경 변화로 재번호를 부여하지 않음 |
| Geology / baseline v1 | 초기 육해·지형·환경, depositId/resourceId/initialReserveU | 개발자가 승인한 시작 원본. 게임 실행 중 재생성/잔량 덮어쓰기 금지 |
| StartingScenario v1 / 2100 | 초기 정수 인구·도시화·기반시설·문명·지식·시설 | 시작 조건. 현재 상태와 분리 |
| 작성 sidecar | 생성기 버전·시드·프로필·매개변수·원천 버전·적용 정책 | 별도 `planetary-generation` JSON. 게임 v1 파일의 키를 늘리지 않음 |
| 미래 runtime | 행성 전체 조건, 타일 환경 override, 현재 인구·시설·피해·문명별 지식, depositId별 잔량/접근성 | 별도 미래 저장 형식. v0.5C에서 생성/진행/영속 저장하지 않음 |

미래 행성 전체 조건에는 대기압·대기 조성·평균 기온·수위·빙권 등을 둘 수 있습니다. 물리 단위/변환식/비용/속도는 미확정입니다. 게임 AU로 복사량이나 현실 기온을 계산하지 않습니다.

## 합성 순서

1. 불변 격자와 지질 원본을 읽습니다.
2. 초기 시나리오를 별도로 읽습니다.
3. 미래의 행성 전체 조건을 별도 지역 효과 계산기로 변환합니다. 이 계산기는 아직 없습니다.
4. 지역 효과 위에 명시적인 runtime 타일 override를 적용합니다. `0`, 빈 배열은 유효한 현재값이며 미지정 키만 원본/시나리오로 fallback합니다.
5. 육지/물은 함께 적용하고 합계 1을 검증합니다. atmosphere는 두 값 모두 null이며 고체형으로 바꾸지 않습니다.
6. 광맥 ID/원래 매장량은 지질에서 읽습니다. 잔량·수몰 접근성·채굴 난도 보정은 별도의 runtimeDepositState에서 읽습니다. 문명별 발견 기록은 지질 원본과 별도입니다.

`dist/src/planetary-surface-layer.js`의 순수 `resolveEffectiveSurfaceState()`는 이 경계를 보여주는 **비활성 예제 helper**입니다. 게임 루프/화면/저장소가 호출하지 않습니다. 원본의 복사본과 명시적인 현재값을 반환할 뿐, 기후나 기술을 계산하지 않습니다. helper의 current 입력은 향후 검증된 runtime 상태를 전제로 하며 미래 저장 파일의 validator가 아닙니다.

```js
const effective = resolveEffectiveSurfaceState(original, scenario, {
  terrain: { landFraction: 0.6, waterFraction: 0.4 },
  populationPersons: 2,
  depositState: { 'original-deposit-id': { remainingReserveU: 0, accessible: false } },
});
// original은 여전히 육지 1 / 물 0. depositId, initialReserveU와 초기 인구도 유지.
```

수몰된 광산의 접근성과 지상 시설 피해가 바뀌어도 광맥을 다시 생성하지 않습니다. 광맥 제거/재해는 향후 별도의 명시적 이벤트여야 합니다. 새로운 센서의 발견 결과는 runtime knowledge에 추가합니다. 도시 파괴는 초기 시나리오를 수정하지 않습니다.

스키마/격자/생성기 버전이 변경되어도 기존 JSON은 자동 재생성하지 않습니다. 현재의 strict v1 검증과 대상/fingerprint 일치를 계속 사용하고, 실제 포맷 변화가 필요할 때만 별도 마이그레이션을 설계합니다.

## v0.5D 자원 확장

템플릿 schema2에서도 grid와 원본 환경/매장량은 불변입니다. ore의 단일 authoritative 양은 geology.cells[].deposits[].initialReserveU, 기본 gradeProbabilities는 미래 산출 확률입니다. resourceConfiguration은 작성 목표이며 집계에 더하지 않습니다. initialResourceKnowledge는 2100 초기 인지, hydrogenSources는 잠재 원천 정의입니다. 이들은 미래 실제 재고/남은 매장량/테라포밍 상태가 아닙니다.

채굴/선광 기술은 기본 확률을 복사해 유효 확률을 계산하고 제련 기술은 별도 합금 수율만 보정합니다. 결정적 배치 예제/합금 계산이 지질이나 시계를 변경하지 않습니다. 미래 batchSerial·remainingReserveU·등급별 실제 재고는 별도 runtime에 저장할 예정이며 현재 생성하지 않습니다. 새로운 센서 tier는 기존 진행/발견 기록을 지우지 않고 별도로 추가합니다.

v1 파일/로컬 초안을 자동 이관하지 않습니다. 명시적 이관은 원본/ID/양/초기 시나리오를 보존하며 불명확한 매장 형태·품질은 레거시 가정으로 표시합니다. 승인한 재배분과는 별도 작업입니다. 지구 사용자 원본과 승인된 공식 v2는 별도 파일로 보관합니다.
