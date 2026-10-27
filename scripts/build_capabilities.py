"""Build reviewed ownership capabilities from the saved public catalog.

The browser and generator share ownership.js. Ambiguous evidence stays unknown;
this generator does not invent components from a piece count or range endpoint.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def build(index=None, output=None):
    index = index or ROOT / 'site' / 'index.html'
    output = output or ROOT / 'site' / 'data' / 'capabilities.json'
    source = index.read_text()
    match = re.search(r'<script\s+id="catalog-data"\s+type="application/json">(.*?)</script>', source, re.S)
    if not match:
        raise ValueError('Saved catalog-data block was not found')
    rows = json.loads(match.group(1))
    runner = """
const fs = require('node:fs');
const api = require(process.argv[1]);
const rows = JSON.parse(fs.readFileSync(0,'utf8'));
const products = Object.fromEntries(rows.map(row => {
 const d = api.classifyProduct(row);
 return [d.sku,d];
}));
process.stdout.write(JSON.stringify({schemaVersion:1,source:'Saved verified size evidence; ambiguous profiles remain unknown.',products},null,2)+'\\n');
"""
    result = subprocess.run(['node', '-e', runner, str(ROOT / 'site' / 'assets' / 'ownership.js')], input=json.dumps(rows), text=True, check=True, capture_output=True)
    payload = json.loads(result.stdout)
    assert len(payload['products']) == len(rows)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(result.stdout)
    complete = sum(v['coverageComplete'] for v in payload['products'].values())
    print(json.dumps({'products':len(rows),'complete_profile_mappings':complete,'output':str(output)},indent=2))
    return payload

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--index',type=Path)
    parser.add_argument('--output',type=Path)
    args = parser.parse_args()
    build(args.index,args.output)
