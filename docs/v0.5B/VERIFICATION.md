# v0.5B 검증 기록

2026-10-31 (Asia/Seoul). 기준 v0.5A `15359f0`. [구조·데이터 계약](REVIEW.md), [기존 v0.5A 검증](../v0.5/VERIFICATION.md).

## 자동 검사

- `npm run check`: 소스 모듈 **26개 문법 검사 통과**.
- `npm test`: **76개 통과, 실패/건너뜀 0**. 기존 56개 유지 + 구면 격자 9개 + 데이터/IO 11개.
- `git diff --check`: 통과. Python 패키저 문법 검사 통과.
- v0.5A와 `data.js`, `model.js`, `time-control.js`, `game-space.js`, `hex-sectors.js`, `astronomy-data.js` 비교: 변경 없음. 모든 천체 크기·궤도·시간 환산·천문 자료 보존.

격자는 f2/3/4/5의 42/92/162/252셀, 오각형12, 5/6 이웃·대칭·연결성, 역방향 공유 변 두 번 대응, dual 꼭짓점3면, 폐곡면·Euler2·면적합4π를 검사합니다. 독립 모듈 재생성의 ID/geometry/checksum 완전 일치, 대상 ID 조합 충돌 방지, 모든 행성/위성/fixture 해상도, 상한 알림, f2/3/5/8 각2,048점·극·경도 seam·경계/꼭짓점의 결정적 다각형 조회, 앞면/뒷면/접선/구 내부 ray를 검사합니다.

데이터는 null/0/빈 배열 구분, 정확한 POP↔정수 인구, 소수 U·톤·C 분리, ore와 전략 자원 등록/alloy 매장 거부, 육지/물 비율·가스 대기층, 음수/NaN/Infinity/거대 수·비정수 인구 거부, 5개 대상의 전체 필드 export/import 동등성을 검사합니다. 다른 대상/버전/f/방향/count/fingerprint·중복 JSON 키/없는 셀/runtime 필드는 원자적으로 거부합니다. 시스템/천체별 초안, 행정 저장소 독립, 원본 보존/명시적 백업, 저장 실패 메모리 유지/Undo, 정적 manifest 로딩도 확인했습니다. 비유한 수가 JSON clone 과정에서 null로 바뀌지 않도록 검증 전 복사는 structuredClone을 사용합니다.

## 실제 브라우저

Chromium + Playwright, 소프트웨어 SwiftShader. PC 1440×1000, 모바일 터치 에뮬레이션 844×390와 667×375. 정적 서버 → 로컬 모듈/지도/manifest → 실제 캔버스 클릭/표면 편집 → 브라우저 파일 → 로컬 저장 복원을 검사했습니다. 서버 API/DB는 없습니다.

세 스크립트를 실제 실행해 모두 통과했습니다.

- [기존 지도 회귀 로그](browser-regression.log): 선택만으로 확대하지 않음, 팝업/가림/가장자리, 실제 천체·달 보조 선택, 행정 외 기초 섹터, 회전/줌/터치, 궤도·기준 평면·자전축, 텍스처·고리·고정 크기, 세 시스템 전환/정리, 시간·도움말. 시험계 선택 경로만 새 개발자 드로어로 조정했습니다.
- [기존 행정·시간 로그](browser-administration.log): 생성/추가/제거/이름/Undo/통합/삭제, 연결 단절 거부·구멍·모드 복구·새로고침, 실제0.1×/1×/100× 시계비율, 경사 평면, 저장 격리·GPU/DOM 정리, 두 모바일의 실제 터치와 드래그/핀치.
- [새 표면 로그](browser-surface.log): 아래 항목을 확인했습니다.

1. URL 수정 없이 로고7회로 개발자 진입, 종료/재진입, 일반1회 클릭은 진입하지 않음. `?dev=1` 호환.
2. 실제 지구 정보 탭의 표면 버튼으로 진입. 오각형 선택/인구·매장 편집, 음수 거부/취소, JSON 실제 Blob 다운로드와 File 업로드, 대상 불일치 거부·검증 미리보기·덮어쓰기 확인, 로컬 새로고침 복원.
3. 일반 모드에서 편집/파일 버튼·원본 매장량 미노출, 개발자 종료 시 입력 DOM 비움. 표면 중 행정 편집 요청 차단.
4. 실제 시간 변화 후 동일 ID의 타일이 spin/텍스처를 따라 이동하고 fingerprint 유지. 셀 선택은 카메라를 점프시키지 않음.
5. **모든 행성8+위성11**을 실제 열기/렌더/앞면 클릭. 각 오각형12와 단일 활성 레이어, fixture 행성의 공용 지도 확인.
6. 반복 열기/복귀·대상/시스템 전환 후 canvas1, editor DOM1, GPU geometry가 기준 수준으로 복귀.
7. Chromium 네이티브 전체화면 실제 진입/버튼 및 Esc 종료, 상태 버튼/선택 보존. API 없음 Mock, 거부 Promise, fullscreen 금지 iframe에서 실패 안내·성공 상태로 바뀌지 않음.
8. 두 모바일 크기에서 지구/화성/목성/달의 실제 터치 선택·초기 POP 편집·표준 파일 import/export. 드래그/핀치가 선택·데이터를 바꾸지 않음. 전체화면 왕복/개발자 종료·재진입, 수평 오버플로 없음.
9. 세 브라우저 검사에서 미처리 page error·console error 없음.

## 성능 관찰

[19개 천체 실제 렌더 결과](body-render-results.json)를 보존합니다. 활성 표면만 경계/선택선/선택면의 소수 배치로 렌더링하고 셀마다 Mesh를 만들지 않습니다.

| 대상 | 셀 | 전체 draw calls | 삼각형 | 짧은 소프트웨어 RAF 표본 |
|---|---:|---:|---:|---:|
| 지구 | 92 | 10 | 78,800 | 별도 FPS 표본 없음 |
| 목성 | 642 | 8 | 73,984 | 약10.45 FPS / 1.24초 |
| 토성 | 492 | 8 | 33,504 | 약8.06 FPS / 1.24초 |

전체 scene의 배경/소천체/다른 보이는 천체도 포함한 수치이고 기기 성능 벤치마크가 아닙니다. 소프트웨어 렌더링은 낮은 FPS이며 실제 모바일 GPU 개선/60FPS를 주장하지 않습니다. 기본 항성계 탐사 화면은 기존과 같은55 draw calls/172,850 triangles입니다. 매 프레임 전체 격자·편집 DOM을 재생성하지 않으며 geometry/material 교체·dispose를 확인했습니다.

## 실행 패키지와 재현

```sh
npm run dev
npm run check
npm test
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-smoke.mjs
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-administration.mjs
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-planet-surface.mjs
python3 scripts/package-release.py
```

ZIP에는 HTML·JS·정적manifest·Three.js·표면 이미지·라이선스·serve.py와 실행 안내/커밋 정보가 들어갑니다. 압축 해제 후 `python3 serve.py`(Windows `py serve.py`)로 로컬 서버를 실행합니다. file:// 직접 열기는 ES 모듈 때문에 지원하지 않습니다. 최종 ZIP의 CRC와 압축 해제 독립 서버의 실제 브라우저 로딩도 제출 전에 확인합니다.

## 한계와 미검증

실제 iPhone/Safari/Firefox, 모바일 OS 파일 선택·공유 UI·노치·화면회전·GPU 성능, 장기 실기기 메모리 안정성은 검증하지 않았습니다. 네이티브 전체화면 성공은 Chromium/에뮬레이션 범위입니다. 자동 방향 잠금이나 주소창 제거 흉내는 없습니다.

작은 가로 화면의 편집 항목은 탭과 내부 스크롤로 접근합니다. 다중 셀 일괄 적용과 지형/인구/광석 자동 생성, 실제 채굴/탐사/시설 생산/전투/오프라인은 없습니다. knowledge/시설은 초기 메타데이터만 저장합니다. 저장은 브라우저·도메인·포트별이며 서버 저장·동기화가 아닙니다. 숨김 개발자 모드는 보안 경계가 아닙니다.
