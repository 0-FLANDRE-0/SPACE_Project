#!/usr/bin/env python3
"""Build a runnable HTML ZIP and a Sites static artifact from the current commit."""
from pathlib import Path
import json, subprocess, tarfile, zipfile
root=Path(__file__).resolve().parents[1]
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
version='v0.5C'
destination=root/'dist'/'downloads'/f'SPACE_Project_{version}_HTML.zip'
destination.parent.mkdir(exist_ok=True)
prefix=f'SPACE_Project_{version}/'
readme=f'''SPACE Project {version} — HTML 실행 패키지

1. ZIP을 모두 압축 해제하세요. index.html과 src/assets/vendor 폴더를 함께 유지합니다.
2. Python 3가 설치된 PC에서 이 폴더의 serve.py를 실행하세요.
   Windows: py serve.py
   macOS/Linux: python3 serve.py
3. 브라우저에서 http://localhost:8765 를 엽니다.

ES 모듈을 사용하므로 index.html을 파일로 직접 여는 대신 로컬 HTTP 서버가 필요합니다.
외부 라이브러리와 표면 이미지는 포함되어 있습니다. 선택적 웹폰트는 인터넷 없이 시스템 폰트로 대체됩니다.

천체 선택 → 옆 탭 → 표면 지도. 행성 8개와 위성의 구면 구역을 선택할 수 있습니다.
SPACE 로고를 5초 안에 7번 누르면 개발자 도구가 켜집니다. 자동 설정에서 시드·프로필·총 U/POP를 입력하고 미리보기 → 확인 → 적용합니다. 기본은 수동값 보존입니다.
표면 편집에서 예외를 조정하고 v1 JSON으로 옮깁니다. 생성 출처·설정은 별도 sidecar로 다운로드합니다.
지구 육해는 Natural Earth 50m Land v5.1.2 공개 경계(Public Domain)입니다. 다른 천체는 절차적 게임용 데이터입니다.
자원/인구는 기본 미정이며 테라포밍·채굴·인구 성장은 진행하지 않습니다.
전체화면은 지원 브라우저의 버튼을 사용합니다. 미지원 환경에서는 안내가 표시됩니다.
행정 섹터 → 행정 도구 → 셀 편집은 별도의 항성계 공간 구역 편집입니다.
행정구역과 표면 초안은 각각 로컬 브라우저 저장소에 저장됩니다. 서버·도메인·브라우저가 달라지면 별도 상태입니다.
표면 JSON은 지질 원본과 2100 초기 시나리오이며 게임 진행 저장이 아닙니다. 인구/자원 미설정과 0을 구분합니다.
1×는 현실 1초당 게임 10초입니다. 시계는 UTC. 오프라인 진행은 없습니다.
함선·건설·경제·연구는 포함하지 않습니다.

소스 커밋: {sha}
저장소: https://github.com/0-FLANDRE-0/SPACE_Project
라이선스: vendor/THREE-LICENSE.txt 및 assets/textures/ATTRIBUTION.md, data/planetary-generation/NATURAL_EARTH_LICENSE.md를 확인하세요.
'''
server='''from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os, webbrowser
os.chdir(Path(__file__).resolve().parent)
server=ThreadingHTTPServer(("127.0.0.1",8765),SimpleHTTPRequestHandler)
print("SPACE Project: http://localhost:8765 — Ctrl+C to stop")
webbrowser.open("http://localhost:8765")
try: server.serve_forever()
except KeyboardInterrupt: server.server_close()
'''
with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED) as archive:
 for path in sorted((root/'dist').rglob('*')):
  if path.is_file() and 'downloads' not in path.relative_to(root/'dist').parts:archive.write(path,prefix+str(path.relative_to(root/'dist')))
 archive.writestr(prefix+'README_RUN_KO.txt',readme)
 archive.writestr(prefix+'serve.py',server)
 archive.writestr(prefix+'SOURCE.json',json.dumps({'commit':sha,'version':version,'repository':'0-FLANDRE-0/SPACE_Project'},indent=2))
artifact=root/'artifacts'/'SPACE_Project_v0.5C_site.tar.gz';artifact.parent.mkdir(exist_ok=True)
with tarfile.open(artifact,'w:gz') as archive:
 archive.add(root/'.openai'/'hosting.json',arcname='.openai/hosting.json')
 archive.add(root/'dist',arcname='dist')
print(json.dumps({'commit_sha':sha,'zip':str(destination),'zip_bytes':destination.stat().st_size,'archive':str(artifact)}))
