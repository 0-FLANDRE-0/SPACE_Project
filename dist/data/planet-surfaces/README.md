# 정적 표면 초기 프리셋

개발자 표면 지도에서 내보낸 JSON을 이 폴더에 복사하고 `index.json`의 `templates`에 `systemId:bodyId` → 파일 경로를 추가합니다.

```json
{"schemaVersion":1,"templates":{"sol:earth":"./data/planet-surfaces/sol-earth.json"}}
```

콜론 등 예약 문자를 포함한 사용자 ID는 각각 encodeURIComponent로 인코딩한 후 `:`로 연결합니다. 일반 sol/earth ID는 위와 같습니다. 경로는 HTML 루트를 기준으로 합니다. manifest에 등록하지 않은 JSON은 자동 적용하지 않습니다.

로더는 원래 격자를 생성한 뒤 대상·버전·f·방향·tileCount·fingerprint·값을 검증합니다. 정적 프리셋 이후 같은 시스템/천체의 유효한 로컬 초안이 있으면 초안을 우선합니다. 새 브라우저나 해당 초안이 없는 환경에서 정적 초기 상태를 확인할 수 있습니다. 손상/구버전 초안은 덮어쓰지 않습니다.

현재 manifest는 비어 있습니다. 예시 매장량·인구를 게임 기본값으로 배포하지 않습니다. 2100은 시나리오 메타데이터이며 천문 epoch나 단일 게임 시계를 바꾸지 않습니다. 지질의 initialReserveU와 초기 populationPersons는 미래 runtime 저장과 구분합니다.
