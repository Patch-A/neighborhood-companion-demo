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
import argparse

parser=argparse.ArgumentParser()
parser.add_argument('--reuse-runtime',action='store_true',help='Verify and reuse the unchanged local runtime ZIP')
options=parser.parse_args()

root=Path(__file__).resolve().parents[1]
submission=root/'submission'
dist=root/'dist'
submission.mkdir(exist_ok=True);dist.mkdir(exist_ok=True)
app_manifest=submission/'neighborhood-companion-local-demo.manifest.json'
if options.reuse_runtime:
    previous=json.loads(app_manifest.read_text(encoding='utf8'))
    archive_path=submission/previous['archive']
    assert hashlib.sha256(archive_path.read_bytes()).hexdigest()==previous['sha256']
    with zipfile.ZipFile(archive_path) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist())==len(previous['files'])
        for row in previous['files']:
            source=(root/'local-demo'/row['path']).read_bytes()
            assert hashlib.sha256(source).hexdigest()==row['sha256'], 'Runtime changed: '+row['path']
            assert source==archive.read('neighborhood-companion-local-demo/'+row['path'])
else:
    sys.argv=['package.py','--output',str(submission/'neighborhood-companion-local-demo.zip')]
    runpy.run_path(str(root/'local-demo/scripts/package.py'),run_name='__main__')
app=json.loads(app_manifest.read_text(encoding='utf8'))
shutil.copyfile(submission/app['archive'],dist/app['archive'])
files=['README.md','01-投稿填写内容.md','02-启动与评审说明.md','03-三分钟演示脚本.md','04-提交前清单.md','05-技术检查记录.md','06-在线体验与投稿链接.md','07-QMuse导入进度.md','cover-1600x900.png','cover.svg','preview.jpg','online-preview.jpg',app['archive'],app_manifest.name]
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
assert (submission/'online-preview.jpg').read_bytes()[:2]==b'\xff\xd8'
manifest={'reviewed_on':'2026-10-22','app_version':'QMuse-import-READY; Cloudflare-online; bundled-local-v0.1','online_source_commit':'66d24b70defe70af0eaa891b5c41b2919756af71','qmuse_source_commit':'c705fbe7c7f16aaf91fc6e0aa0258d4c6b05aee0','qmuse_import_version':'90100047','qmuse_editor_url':'https://qmuse.cn/app/3379366579041450','qmuse_public_url':None,'qmuse_ai_verified':False,'public_url_submission_accepted':False,'runtime_source_commit':'14d574c41fe6f853f4a605b812158d1c1c11ffd0','public_url':'https://neighborhood-companion-demo.patch-neighborhood-demo.workers.dev/','app_files':len(app['files']),'app_archive_sha256':app['sha256'],'files':rows,'runtime_credentials_included':False,'access_note':'Cloudflare demo exists but submission field rejects its URL. QMuse import READY; owner reports table permissions set and authorizes the secret, but effective permissions, secret configuration, real cloud AI, public publishing and submission acceptance are pending. Bundled ZIP remains the separate loopback runtime.'}
(submission/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
files.append('manifest.json')
kit=dist/'neighborhood-companion-submission-kit.zip'
with zipfile.ZipFile(kit,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for name in files:archive.write(submission/name,'neighborhood-companion-submission/'+name)
with zipfile.ZipFile(kit) as archive:assert archive.testzip() is None
print(json.dumps({'runtime_bytes':(dist/app['archive']).stat().st_size,'runtime_files':len(app['files']),'kit_bytes':kit.stat().st_size,'kit_files':len(files),'cover_bytes':len(png),'secret_scan':'passed','local_links':'passed'},ensure_ascii=True))
