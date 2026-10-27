'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const NOW = '2026-10-26T19:00:00Z';
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const offer = (sku, extra = {}) => ({id: 'offer-' + sku, sku, skus: [sku], price: 20,
  starts_on: '2026-10-01', ends_on: '2026-10-26', membership_required: false,
  retailer_savings_percent: 30, source_url: 'https://go.harborfreight.com/coupons/example/', ...extra});
const feed = (publicOffers = [offer('10001')], extra = {}) => ({last_checked: NOW,
  last_success: NOW, refresh: {status: 'ok', errors: []}, public_offers: publicOffers,
  member_offers: [], conditional_offers: [], history_by_sku: {}, ...extra});

/** Exercise real planner handlers with mocked browser APIs; no browser permissions. */
function harness(options = {}) {
  const elements = new Map(), documentHandlers = new Map(), intervals = [], toasts = [];
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', checked: false, hidden: false, textContent: '', innerHTML: '', dataset: {},
      listeners: new Map(), attributes: new Map(),
      classList: {toggle() {}, add() {}, remove() {}},
      addEventListener(name, listener) { this.listeners.set(name, listener); },
      setAttribute(name, value) { this.attributes.set(name, value); },
      showModal() { this.open = true; }, close() { this.open = false; }, reset() {},
      closest() { return this; }
    });
    return elements.get(id);
  };
  let nextFeed = feed(), fetchFailure = false, requestCount = 0, permission = 'default';
  let nextId = 0, preferences, persisted = 0, ui;
  const notifications = [];
  class MockNotification {
    static get permission() { return permission; }
    static async requestPermission() {
      requestCount += 1;
      if (options.permissionThrows) throw new Error('Mock permission unavailable');
      permission = options.permissionResult || 'granted';
      return permission;
    }
    constructor(title, settings) {
      if (options.notificationThrows) throw new Error('Mock constructor unavailable');
      notifications.push({title, settings});
    }
  }
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [NOW])); }
    static now() { return RealDate.parse(NOW); }
  }
  const document = {hidden: false,
    querySelector() { return $('workspace'); }, querySelectorAll() { return []; },
    addEventListener(name, callback) { documentHandlers.set(name, callback); }
  };
  const context = {console, URL, Intl, Blob, Date: FixedDate, document,
    Notification: options.unsupported ? undefined : MockNotification,
    crypto: {randomUUID: () => 'test-id-' + ++nextId},
    setInterval(callback, period) { intervals.push({callback, period}); return intervals.length; },
    setTimeout() {},
    fetch: async url => {
      if (url.includes('deals.json')) {
        if (fetchFailure) throw new Error('Mock network unavailable');
        return {ok: true, json: async () => plain(nextFeed)};
      }
      return {ok: true, json: async () => ({products: {}})};
    }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['ownership.js', 'deal-engine.js', 'planner-ui.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../site/assets/', file), 'utf8'), context, {filename: file});
  }
  const DATA = ['10001','10002','10003','10004','10005','10006'].map(sku => ({
    'Item Number': sku, Product: 'Tool ' + sku, Category: 'Distinct tool purpose ' + sku,
    'Price USD': 30, _included: true, 'Size Review Status': 'Size continuity not applicable'
  }));
  const bySKU = new Map(DATA.map(row => [row['Item Number'], row]));
  preferences = context.MechanicPlanner.sanitize({version: 2, ...options.preferences}, bySKU);
  ui = context.MechanicPlanner.create({$, DATA, bySKU, esc: String,
    money: value => '$' + Number(value).toFixed(2), toast: text => toasts.push(text),
    getPreferences: () => preferences, setPreferences: value => { preferences = value; },
    useIncluded() {}, persist() { persisted += 1; }, render() { ui?.onRender(); }
  });
  return {
    ui, $, context, notifications, toasts, intervals, documentHandlers,
    get prefs() { return plain(preferences); },
    get requestCount() { return requestCount; },
    get persisted() { return persisted; },
    setFeed(value) { nextFeed = plain(value); },
    failFetch(value = true) { fetchFailure = value; },
    async init() { ui.init(); await tick(); },
    async enable() { await $('enable-notifications').listeners.get('click')(); },
    async refresh() { await ui.refresh(false); }
  };
}

test('initialization never requests browser notification permission, including saved alert preferences', async () => {
  for (const notifications of [false, true]) {
    const h = harness({preferences: {settings: {notifications}}});
    await h.init();
    assert.equal(h.requestCount, 0);
    assert.equal(h.notifications.length, 0);
    assert.equal(h.prefs.alerts.length, 0);
    assert.equal(h.prefs.seenAlerts.length, notifications ? 1 : 0);
  }
});

test('explicit Enable action requests permission and baselines existing matches without a notification flood', async () => {
  const h = harness();
  await h.init();
  assert.equal(h.requestCount, 0);
  await h.enable();
  assert.equal(h.requestCount, 1);
  assert.equal(h.prefs.settings.notifications, true);
  assert.deepEqual(h.prefs.seenAlerts, ['10001:offer-10001:20']);
  assert.equal(h.prefs.alerts.length, 0);
  assert.equal(h.notifications.length, 0);
  assert.equal(h.$('enable-notifications').attributes.get('aria-pressed'), 'true');
});

test('a new matching offer stores an on-site alert, notifies once when granted, and deduplicates repeated refreshes', async () => {
  const h = harness();
  await h.init(); await h.enable();
  h.setFeed(feed([offer('10001'), offer('10002')]));
  await h.refresh();
  assert.equal(h.prefs.alerts.length, 1);
  assert.equal(h.prefs.alerts[0].sku, '10002');
  assert.equal(h.prefs.alerts[0].read, false);
  assert.equal(h.notifications.length, 1);
  assert.match(h.notifications[0].settings.body, /Tool 10002/);
  assert.equal(h.requestCount, 1, 'refresh cannot request permission');
  const persists = h.persisted;
  await h.refresh();
  assert.equal(h.prefs.alerts.length, 1);
  assert.equal(h.notifications.length, 1);
  assert.equal(h.persisted, persists, 'identical refresh should not rewrite alert preferences');
});

test('denied browser permission retains on-site alerts without browser notification attempts', async () => {
  const h = harness({permissionResult: 'denied'});
  await h.init(); await h.enable();
  assert.equal(h.requestCount, 1);
  assert.equal(h.prefs.settings.notifications, true);
  assert.ok(h.toasts.some(text => /On-site alerts enabled/.test(text)));
  h.setFeed(feed([offer('10001'), offer('10002')]));
  await h.refresh();
  assert.equal(h.prefs.alerts.length, 1);
  assert.equal(h.notifications.length, 0);
});

test('stale and source-error feeds never create alerts or consume unseen matching offers', async () => {
  for (const patch of [
    {last_success: '2026-10-26T00:00:00Z'},
    {refresh: {status: 'error', errors: ['Official source unavailable']}}
  ]) {
    const h = harness();
    await h.init(); await h.enable();
    h.setFeed(feed([offer('10001'), offer('10002')], patch));
    await h.refresh();
    assert.equal(h.prefs.alerts.length, 0);
    assert.equal(h.notifications.length, 0);
    assert.equal(h.prefs.seenAlerts.length, 1);
    h.setFeed(feed([offer('10001'), offer('10002')]));
    await h.refresh();
    assert.equal(h.prefs.alerts.length, 1, 'a recovered fresh feed can alert for the previously ignored offer');
  }
});

test('network failures do not manufacture alerts from the previous successful snapshot', async () => {
  const h = harness();
  await h.init(); await h.enable();
  h.failFetch();
  await h.refresh();
  assert.equal(h.prefs.alerts.length, 0);
  assert.equal(h.notifications.length, 0);
  assert.equal(h.requestCount, 1);
});

test('new alerts respect ownership, public eligibility, advertised savings threshold and expiration', async () => {
  const h = harness({preferences: {inventory: [{id: 'owned', sku: '10006', label: 'My tool', capabilities: []}]}});
  await h.init(); await h.enable();
  h.setFeed(feed([
    offer('10001'), offer('10002'), offer('10003', {retailer_savings_percent: 10}),
    offer('10004', {ends_on: '2026-10-25'}), offer('10006')
  ], {member_offers: [offer('10005', {membership_required: true})]}));
  await h.refresh();
  assert.deepEqual(h.prefs.alerts.map(alert => alert.sku), ['10002']);
  assert.equal(h.notifications.length, 1);
});

test('unavailable browser APIs and permission errors preserve the on-site fallback', async () => {
  for (const options of [{unsupported: true}, {permissionThrows: true}]) {
    const h = harness(options);
    await h.init(); await h.enable();
    h.setFeed(feed([offer('10001'), offer('10002')]));
    await h.refresh();
    assert.equal(h.prefs.settings.notifications, true);
    assert.equal(h.prefs.alerts.length, 1);
    assert.equal(h.notifications.length, 0);
  }
});

test('a blocked notification constructor cannot discard a persisted on-site alert', async () => {
  const h = harness({notificationThrows: true});
  await h.init(); await h.enable();
  h.setFeed(feed([offer('10001'), offer('10002')]));
  await h.refresh();
  assert.equal(h.prefs.alerts.length, 1);
  assert.ok(h.toasts.some(text => /browser notification unavailable/.test(text)));
});

test('disabling alerts requires no permission request and stops subsequent on-site and browser alerts', async () => {
  const h = harness();
  await h.init(); await h.enable(); await h.enable();
  assert.equal(h.prefs.settings.notifications, false);
  assert.equal(h.requestCount, 1);
  assert.equal(h.$('enable-notifications').attributes.get('aria-pressed'), 'false');
  h.setFeed(feed([offer('10001'), offer('10002')]));
  await h.refresh();
  assert.equal(h.prefs.alerts.length, 0);
  assert.equal(h.notifications.length, 0);
});
