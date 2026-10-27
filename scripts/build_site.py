"""Stage only public website files and record deployment provenance."""
import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from check_site import ROOT, SITE, validate

parser = argparse.ArgumentParser()
parser.add_argument('--commit', default='local')
args = parser.parse_args()
counts = validate()
destination = ROOT / '_site'
if destination.exists():
    shutil.rmtree(destination)
shutil.copytree(SITE, destination)
# Keep an already visited Pages site from mixing new HTML with older cached
# application code. Data uses its own refresh timestamps and fetch policy.
index = destination / 'index.html'
page = index.read_text()
for asset in sorted((destination / 'assets').glob('*')):
    if asset.is_file() and asset.suffix in ['.js', '.css']:
        relative = asset.relative_to(destination).as_posix()
        version = hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
        page = page.replace('./' + relative + '"', './' + relative + '?v=' + version + '"')
index.write_text(page)
files = {}
for path in sorted(destination.rglob('*')):
    if path.is_file():
        files[path.relative_to(destination).as_posix()] = {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}
manifest = {'repository': 'sfmth/harbor-mechanic-tool-deals', 'commit': args.commit, 'snapshot_date': '2026-10-26', 'built_at': datetime.now(timezone.utc).isoformat(), 'counts': counts, 'files': files}
deals = json.loads((SITE / 'data/deals.json').read_text())
manifest['deal_last_success'] = deals['last_success']
manifest['deal_refresh_status'] = deals['refresh']['status']
(destination / 'release.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'directory': str(destination), 'commit': args.commit, 'files': len(files), **counts}, indent=2))
