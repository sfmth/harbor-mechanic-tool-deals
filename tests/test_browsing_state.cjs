'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const START = '2026-10-26T19:00:00Z';
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));

/** Run the real application and planner together, replacing only browser APIs.
 * Assertions inspect rendered cards and pagination, rather than implementation flags.
 */
function harness() {
  const elements = new Map(), documentHandlers = new Map(), intervals = [], timeouts = new Map();
  const rows = Array.from({length: 96}, (_, index) => ({
    'Item Number': String(10001 + index), Product: 'Tool ' + String(index + 1).padStart(3, '0'),
    Brand: 'Test brand', Category: index % 2 ? 'Odd tools' : 'Even tools',
    'Price USD': 30, _included: true, 'Size Review Status': 'Size continuity not applicable'
  }));
  const offer = row => ({id: 'offer-' + row['Item Number'], sku: row['Item Number'],
    skus: [row['Item Number']], price: 20, starts_on: '2026-10-01', ends_on: '2026-10-26',
    membership_required: false, retailer_savings_percent: 30,
    source_url: 'https://go.harborfreight.com/coupons/test/'
  });
  let now = START, nextFeed = {last_checked: START, last_success: START,
    refresh: {status: 'ok', errors: []}, public_offers: rows.map(offer), member_offers: [],
    conditional_offers: [], history_by_sku: {}};
  let fetchFailure = false, fetches = 0, nextTimer = 0, scrolls = 0;
  const $ = id => {
    if (!elements.has(id)) {
      const classes = new Set();
      let markup = '';
      const element = {
        value: '', checked: false, hidden: false, textContent: '', dataset: {}, markupWrites: 0,
        listeners: new Map(), attributes: new Map(),
        classList: {add(value) { classes.add(value); }, remove(value) { classes.delete(value); },
          contains(value) { return classes.has(value); },
          toggle(value, on) { if (on ?? !classes.has(value)) classes.add(value); else classes.delete(value); }},
        addEventListener(name, callback) { this.listeners.set(name, callback); },
        setAttribute(name, value) { this.attributes.set(name, value); },
        removeAttribute(name) { this.attributes.delete(name); },
        closest() { return this; }, querySelectorAll() { return []; },
        showModal() { this.open = true; }, close() { this.open = false; },
        reset() {}, focus() {}, scrollIntoView() { scrolls += 1; }
      };
      Object.defineProperty(element, 'innerHTML', {
        get() { return markup; }, set(value) { markup = value; element.markupWrites += 1; }
      });
      elements.set(id, element);
    }
    return elements.get(id);
  };
  $('catalog-data').textContent = JSON.stringify(rows);
  $('image-data').textContent = '{}';
  const views = ['deals', 'plan', 'catalog', 'inventory', 'history'].map(view => {
    const element = $('view-' + view); element.dataset.plannerView = view; return element;
  });
  const document = {hidden: false, getElementById: $, querySelector: selector => $(selector),
    querySelectorAll: selector => selector === '[data-planner-view]' ? views : [],
    addEventListener(name, callback) {
      if (!documentHandlers.has(name)) documentHandlers.set(name, []);
      documentHandlers.get(name).push(callback);
    }
  };
  const RealDate = Date;
  class ClockDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return RealDate.parse(now); }
  }
  const storage = new Map();
  const context = {console, URL, Intl, Blob, Date: ClockDate, document,
    localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    crypto: {randomUUID: () => 'test-' + ++nextTimer},
    matchMedia: () => ({matches: false, addEventListener() {}}), addEventListener() {},
    setInterval(callback, period) { intervals.push({callback, period}); return intervals.length; },
    setTimeout(callback, period) { const id = ++nextTimer; timeouts.set(id, {callback, period}); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    fetch: async url => {
      if (url.includes('deals.json')) {
        fetches += 1;
        if (fetchFailure) throw Error('Test network failure');
        return {ok: true, json: async () => plain(nextFeed)};
      }
      return {ok: true, json: async () => ({products: {}})};
    }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['tool-taxonomy.js', 'ownership.js', 'deal-engine.js', 'planner-ui.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../site/assets/', file), 'utf8'), context, {filename: file});
  }
  async function fire(id, event, extra = {}) {
    const element = $(id), callback = element.listeners.get(event);
    assert.ok(callback, `Missing ${event} handler for ${id}`);
    await callback({target: element, preventDefault() {}, ...extra});
    await tick();
  }
  async function clickData(dataset) {
    const target = {dataset, closest(selector) {
      return Object.keys(dataset).some(key => selector.includes('[data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()))) ? this : null;
    }};
    for (const callback of documentHandlers.get('click') || []) await callback({target});
    await tick();
  }
  return {
    $, rows, fire, clickData,
    async ready() { await tick(); assert.equal($('result-count').textContent, '96 items'); },
    page() { return Number($('pagination').innerHTML.match(/data-page="(\d+)" aria-current="page"/)?.[1]); },
    cards() { return [...$('product-grid').innerHTML.matchAll(/<article[^>]*data-sku="([^"]+)"/g)].map(match => match[1]); },
    browsingWrites() { return ['product-grid', 'pagination', 'active-filters'].map(id => $(id).markupWrites); },
    async go(page) { await clickData({page: String(page)}); assert.equal(this.page(), page); },
    async refresh() { await fire('refresh-deals', 'click'); },
    async interval(period) {
      const timer = intervals.find(entry => entry.period === period);
      assert.ok(timer, `Missing interval ${period}`); await timer.callback(); await tick();
    },
    async visible(hidden) {
      document.hidden = hidden;
      for (const callback of documentHandlers.get('visibilitychange') || []) await callback();
      await tick();
    },
    async search(value) {
      $('search').value = value; await fire('search', 'input');
      for (const [id, entry] of [...timeouts]) if (entry.period === 140) { timeouts.delete(id); entry.callback(); }
      await tick();
    },
    setOfferCount(count) { nextFeed.public_offers = rows.slice(0, count).map(offer); },
    setOfferPrice(sku, price) { nextFeed.public_offers.find(item => item.sku === sku).price = price; },
    setNow(value) { now = value; },
    failFetch() { fetchFailure = true; },
    get fetches() { return fetches; }, get scrolls() { return scrolls; }
  };
}

for (const [label, refresh] of [
  ['manual feed refresh', h => h.refresh()],
  ['15-minute published-offer refresh', h => h.interval(15 * 60 * 1000)],
  ['one-minute expiration check', h => h.interval(60 * 1000)],
  ['returning to the browser tab', h => h.visible(false)]
]) {
  test(`${label} preserves the current result page and visible cards`, async () => {
    const h = harness(); await h.ready(); await h.go(3);
    const before = h.cards(), writes = h.browsingWrites(), scrolls = h.scrolls;
    await refresh(h);
    assert.equal(h.page(), 3);
    assert.deepEqual(h.cards(), before);
    assert.deepEqual(h.browsingWrites(), writes, 'unchanged browsing controls and cards must retain their DOM nodes');
    assert.equal(h.scrolls, scrolls, 'a passive update must not scroll to the result heading');
  });
}

test('a manual refresh updates deal prices without returning to page one', async () => {
  const h = harness(); await h.ready(); await h.go(2);
  const sku = h.cards()[0]; h.setOfferPrice(sku, 17);
  await h.refresh();
  assert.equal(h.page(), 2);
  assert.match(h.$('product-grid').innerHTML, /<strong>\$17\.00<\/strong>/);
});

test('network refresh failure preserves the current page and saved offer results', async () => {
  const h = harness(); await h.ready(); await h.go(3);
  const before = h.cards(); h.failFetch(); await h.refresh();
  assert.equal(h.page(), 3); assert.deepEqual(h.cards(), before);
  assert.match(h.$('feed-status').textContent, /Refresh unavailable/);
});

test('hidden-tab visibility events do not fetch, and a visible-tab refresh preserves browsing', async () => {
  const h = harness(); await h.ready(); await h.go(2);
  const fetches = h.fetches; await h.visible(true);
  assert.equal(h.fetches, fetches);
  await h.visible(false);
  assert.equal(h.fetches, fetches + 1); assert.equal(h.page(), 2);
});

test('saving a shortlist item keeps the current page and updates its saved control', async () => {
  const h = harness(); await h.ready(); await h.go(3);
  const sku = h.cards()[0]; await h.clickData({save: sku});
  assert.equal(h.page(), 3);
  assert.equal(h.$('saved-count-top').textContent, 1);
  assert.match(h.$('product-grid').innerHTML, /product-card saved/);
});

test('marking a tool owned preserves the page while removing the covered product', async () => {
  const h = harness(); await h.ready(); await h.go(3);
  const sku = h.cards()[0]; await h.clickData({own: sku});
  assert.equal(h.page(), 3);
  assert.equal(h.$('result-count').textContent, '95 items');
  assert.ok(!h.cards().includes(sku));
});

test('a feed that loses results clamps to the last remaining page instead of page one', async () => {
  const h = harness(); await h.ready(); await h.go(4);
  h.setOfferCount(48); await h.refresh();
  assert.equal(h.page(), 2);
  assert.equal(h.cards().length, 24);
  assert.equal(h.$('result-count').textContent, '48 items');
});

test('an expiration check clamps an empty result set safely', async () => {
  const h = harness(); await h.ready(); await h.go(4);
  h.setNow('2026-10-27T08:00:00Z'); await h.interval(60 * 1000);
  assert.equal(h.$('pagination').innerHTML, '');
  assert.equal(h.$('empty').hidden, false); assert.deepEqual(h.cards(), []);
});

test('an intentional search starts at page one even if it keeps the same results', async () => {
  const h = harness(); await h.ready(); await h.go(3); await h.search('Tool');
  assert.equal(h.page(), 1); assert.equal(h.$('result-count').textContent, '96 items');
});

test('an intentional category filter starts at page one', async () => {
  const h = harness(); await h.ready(); await h.go(3);
  h.$('category').value = 'Even tools'; await h.fire('category', 'change');
  assert.equal(h.page(), 1); assert.equal(h.$('result-count').textContent, '48 items');
});

test('switching to a different shopping view starts at page one', async () => {
  const h = harness(); await h.ready(); await h.go(3); await h.fire('view-catalog', 'click');
  assert.equal(h.page(), 1);
});
