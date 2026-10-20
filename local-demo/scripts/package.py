"""Create a credential-free, dependency-free ZIP using an explicit release allowlist."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
args = parser.parse_args()
output = Path(args.output).resolve()
assert not output.is_relative_to(root), 'Keep release archives outside the source directory'
paths = [root / name for name in ('AGENTS.md', 'LICENSE', '.gitignore', '.env.example', 'package.json', 'README.md', 'SUBMISSION.md', 'server.mjs', 'start.cmd', 'configure-ai.cmd')]
for directory in ('public', 'lib', 'scripts', 'tests'):
    paths += sorted((root / directory).rglob('*'))
paths = [p for p in paths if p.is_file() and '__pycache__' not in p.parts]
output.parent.mkdir(parents=True, exist_ok=True)
key_values = []
import os
for key in ('FAMILY_AI_API_KEY', 'DEEPSEEK_API_KEY'):
    if os.environ.get(key):
        key_values.append(os.environ[key].encode())
manifest = []
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for path in paths:
        relative = path.relative_to(root).as_posix()
        assert relative == '.env.example' or not path.name.startswith('.env'), relative
        assert not any(p in {'data', 'node_modules', '.git'} for p in Path(relative).parts), relative
        content = path.read_bytes()
        assert not any(key in content for key in key_values), 'Secret detected; release stopped'
        archive.writestr('neighborhood-companion-local-demo/' + relative, content)
        manifest.append({'path': relative, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
report = {'archive': output.name, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'files': manifest, 'runtime_secrets_included': False}
output.with_suffix('.manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'archive': output.name, 'bytes': report['bytes'], 'files': len(manifest), 'secret_scan': 'passed'}, ensure_ascii=True))
