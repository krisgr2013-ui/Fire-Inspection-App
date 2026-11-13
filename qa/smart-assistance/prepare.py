from pathlib import Path
import urllib.request,hashlib,json
source=Path(__file__).parent
root=Path('smart-release');root.mkdir(exist_ok=True)
for name,want in json.loads((source/'hashes.json').read_text()).items():
 p=root/name;p.parent.mkdir(parents=True,exist_ok=True)
 if name.startswith('smart-assistant.'):
  raw=(source/Path(name).name).read_bytes()
 else:
  raw=urllib.request.urlopen('https://goldstandardservicehub.com/'+name,timeout=45).read()
  if name=='index.html':
   raw=raw.decode().replace('</head>','<link rel="stylesheet" href="smart-assistant.css?v=2">\n</head>').replace('<script src="continuity.js','<script src="smart-assistant.js?v=2"></script>\n<script src="continuity.js').encode()
  elif name=='sw.js':raw=raw.decode().replace('gs-29.8.11-trial1','gs-29.8.11-smart2').replace('const SHELL = [',"const SHELL = ['./smart-assistant.js', './smart-assistant.css', ").encode()
  elif name=='config.js':raw=raw.decode().replace("releaseVersion: '29.8.11',","releaseVersion: '29.8.11-smart2',").encode()
 if hashlib.sha256(raw).hexdigest()!=want:raise SystemExit('Artifact hash mismatch: '+name)
 p.write_bytes(raw)
print('Exact frontend artifact reconstructed and SHA-256 verified.')
