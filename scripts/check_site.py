"""Validate the public static catalog without external dependencies."""
import csv
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.json_blocks = {}
        self.current_json = None
        self.references = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('type') == 'application/json':
            self.current_json = attrs.get('id')
            self.json_blocks[self.current_json] = ''
        if tag == 'script' and attrs.get('src'):
            self.references.append(attrs['src'])
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.references.append(attrs['href'])

    def handle_data(self, value):
        if self.current_json is not None:
            self.json_blocks[self.current_json] += value

    def handle_endtag(self, tag):
        if tag == 'script':
            self.current_json = None

def public_path(relative):
    assert relative.startswith('./'), f'Use project-relative asset paths: {relative}'
    path = (SITE / relative).resolve()
    assert path.is_relative_to(SITE.resolve()), f'Asset escapes public directory: {relative}'
    assert path.is_file(), f'Missing asset: {relative}'
    return path

def validate():
    source = (SITE / 'index.html').read_text()
    assert 'data:image/' not in source, 'Photos must be separate cacheable assets'
    assert not re.search(r'/home/|/tmp/|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_', source), 'Private workspace or credential text in public HTML'
    page = Page()
    page.feed(source)
    rows = json.loads(page.json_blocks['catalog-data'])
    photos = json.loads(page.json_blocks['image-data'])
    coverage = json.loads(page.json_blocks['coverage-data'])
    included = [r for r in rows if r['_included']]
    excluded = [r for r in rows if not r['_included']]
    skus = {r['Item Number'] for r in rows}
    assert len(rows) == len(skus) == 2387
    assert len(included) == 2208 and len(excluded) == 179
    assert sum(bool(r['Coverage Added']) for r in included) == 1506
    assert sum(r['Size Review Status'] == 'No skipped standard sizes found' for r in included) == 204
    assert sum(r['Size Review Status'] == 'Confirmed size gaps' for r in excluded) == 170
    assert sum(r['Size Review Status'] == 'Size coverage unverified' for r in excluded) == 9
    assert all(isinstance(r['Price USD'], (int, float)) and 0 < r['Price USD'] <= 200 for r in rows)
    assert all(r['Size Review Status'] in ['No skipped standard sizes found', 'Size continuity not applicable'] for r in included)
    assert set(photos) == skus
    for sku, relative in photos.items():
        path = public_path(relative)
        assert path.stem == sku
        raw = path.read_bytes()
        assert raw.startswith((b'\xff\xd8', b'\x89PNG')) or (raw[:4] == b'RIFF' and raw[8:12] == b'WEBP'), f'Invalid photo: {sku}'
        assert hashlib.sha256(raw).hexdigest() != '5f8e405611e46ad02e01a7e65301899b3d5287b51aaed62e5d3c04c0f9a3b60b', f'Placeholder: {sku}'
    for relative in page.references:
        public_path(relative)
    assert len(coverage) == len({r['sku'] for r in coverage}) == 1213
    assert all(r.get('decision') and r.get('reason') for r in coverage)
    assert not any(re.search('pending|unclassified|candidate|delegated', r['decision']) for r in coverage)
    included_skus = {r['Item Number'] for r in included}
    assert all(str(r.get('catalog_sku') or r['sku']) in included_skus for r in coverage if r['decision'].startswith('included'))
    assert all(r['sku'] not in included_skus for r in coverage if not r['decision'].startswith('included'))
    for filename, expected in [
        ('harbor_freight_mechanic_tools_under_200_no_skipped_sizes.csv', included),
        ('harbor_freight_mechanic_tools_under_200_size_exclusions.csv', excluded),
    ]:
        with (SITE / 'downloads' / filename).open(encoding='utf-8-sig', newline='') as stream:
            actual = list(csv.DictReader(stream))
        assert len(actual) == len(expected)
        by_sku = {r['Item Number']: r for r in actual}
        assert set(by_sku) == {r['Item Number'] for r in expected}
        for row in expected:
            for key, value in row.items():
                if key.startswith('_'):
                    continue
                actual_value = by_sku[row['Item Number']][key]
                if key == 'Price USD':
                    assert float(actual_value) == value
                else:
                    assert actual_value == str(value), (row['Item Number'], key)
    with (SITE / 'downloads' / 'harbor_freight_automotive_coverage_audit.csv').open(encoding='utf-8-sig', newline='') as stream:
        ledger = list(csv.DictReader(stream))
    assert len(ledger) == 1213 and {r['sku'] for r in ledger} == {r['sku'] for r in coverage}
    capabilities = json.loads((SITE / 'data/capabilities.json').read_text())
    assert set(capabilities['products']) == skus
    deals = json.loads((SITE / 'data/deals.json').read_text())
    assert deals['last_success'] and deals['last_checked'] and deals['refresh']['status'] in ['ok', 'error']
    offer_ids = set()
    for member, key in [(False, 'public_offers'), (True, 'member_offers')]:
        for offer in deals[key]:
            assert offer['id'] not in offer_ids
            offer_ids.add(offer['id'])
            assert offer['membership_required'] is member
            assert isinstance(offer['price'], (int, float)) and offer['price'] > 0
            assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', offer['starts_on'])
            assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', offer['ends_on'])
            assert offer['starts_on'] <= offer['ends_on']
            assert offer['source_url'].startswith('https://go.harborfreight.com/')
    assert (SITE / 'data/deal-history.json').is_file() and (SITE / 'deals.xml').is_file()
    result = {'included': len(included), 'size_exclusions': len(excluded), 'photos': len(photos), 'coverage_decisions': len(coverage), 'new_included': 1506, 'recorded_public_offers': len(deals['public_offers']), 'recorded_member_offers': len(deals['member_offers'])}
    return result

if __name__ == '__main__':
    print(json.dumps(validate(), indent=2))
