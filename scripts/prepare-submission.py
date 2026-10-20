"""Build the reviewed local demo and a flat submission kit. No secrets, personal data or network calls."""
from pathlib import Path
import hashlib
import json
import os
import re
import runpy
import shutil
import sys
from urllib.parse import unquote
import zipfile

root=Path(__file__).resolve().parents[1]
submission=root/'submission'
dist=root/'dist'
submission.mkdir(exist_ok=True);dist.mkdir(exist_ok=True)
sys.argv=['package.py','--output',str(submission/'neighborhood-companion-local-demo.zip')]
runpy.run_path(str(root/'local-demo/scripts/package.py'),run_name='__main__')
app_manifest=submission/'neighborhood-companion-local-demo.manifest.json'
app=json.loads(app_manifest.read_text(encoding='utf8'))
shutil.copyfile(submission/app['archive'],dist/app['archive'])
files=['README.md','01-投稿填写内容.md','02-启动与评审说明.md','03-三分钟演示脚本.md','04-提交前清单.md','05-技术检查记录.md','cover-1600x900.png','cover.svg','preview.jpg',app['archive'],app_manifest.name]
secret_values=[os.environ[k].encode() for k in ('FAMILY_AI_API_KEY','DEEPSEEK_API_KEY') if os.environ.get(k)]
rows=[]
for name in files:
    path=submission/name
    content=path.read_bytes()
    assert not any(value in content for value in secret_values), 'Secret found; stop release'
    rows.append({'path':name,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()})
    if path.suffix=='.md':
        for target in re.findall(r'\]\(([^)]+)\)',content.decode('utf8')):
            target=target.strip('<>').split('#',1)[0]
            if not target or re.match(r'^[a-z]+:',target,re.I) or target=='manifest.json':continue
            assert (path.parent/unquote(target)).is_file(), 'Broken local link: '+target
png=(submission/'cover-1600x900.png').read_bytes()
assert png[:8]==b'\x89PNG\r\n\x1a\n'
assert int.from_bytes(png[16:20],'big')==1600 and int.from_bytes(png[20:24],'big')==900 and len(png)<5*1024*1024
assert (submission/'preview.jpg').read_bytes()[:2]==b'\xff\xd8'
manifest={'reviewed_on':'2026-10-20','app_version':'local-H5-v0.1','previous_source_commit':'609456cb68421b5396021828841df7e71ebf29c1','app_files':len(app['files']),'app_archive_sha256':app['sha256'],'files':rows,'runtime_credentials_included':False,'access_note':'Loopback only; current logged-in submission form/ZIP availability and reviewer AI configuration are unverified.'}
(submission/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
files.append('manifest.json')
kit=dist/'neighborhood-companion-submission-kit.zip'
with zipfile.ZipFile(kit,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for name in files:archive.write(submission/name,'neighborhood-companion-submission/'+name)
with zipfile.ZipFile(kit) as archive:assert archive.testzip() is None
print(json.dumps({'runtime_bytes':(dist/app['archive']).stat().st_size,'runtime_files':len(app['files']),'kit_bytes':kit.stat().st_size,'kit_files':len(files),'cover_bytes':len(png),'secret_scan':'passed','local_links':'passed'},ensure_ascii=True))
