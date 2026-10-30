#!/usr/bin/env python3
"""Build a runnable HTML ZIP and a Sites static artifact from the current commit."""
from pathlib import Path
import json, subprocess, tarfile, zipfile
root=Path(__file__).resolve().parents[1]
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
version='v0.5A'
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

천체 선택 → 옆 탭 → 확대. 행정 섹터 → 행정 도구 → 셀 편집으로 구역을 만듭니다.
구역은 로컬 브라우저 저장소에만 저장되며 서버·도메인이 달라지면 별도 상태입니다.
1×는 현실 1초당 게임 10초입니다. 시계는 UTC. 오프라인 진행은 없습니다.
함선·건설·경제·연구는 포함하지 않습니다.

소스 커밋: {sha}
저장소: https://github.com/0-FLANDRE-0/SPACE_Project
라이선스: vendor/THREE-LICENSE.txt 및 assets/textures/ATTRIBUTION.md를 확인하세요.
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
artifact=root/'artifacts'/'SPACE_Project_v0.5A_site.tar.gz';artifact.parent.mkdir(exist_ok=True)
with tarfile.open(artifact,'w:gz') as archive:
 archive.add(root/'.openai'/'hosting.json',arcname='.openai/hosting.json')
 archive.add(root/'dist',arcname='dist')
print(json.dumps({'commit_sha':sha,'zip':str(destination),'zip_bytes':destination.stat().st_size,'archive':str(artifact)}))
