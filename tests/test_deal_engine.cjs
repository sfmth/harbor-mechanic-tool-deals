'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../site/assets/deal-engine.js');
const ownership = require('../site/assets/ownership.js');
const NOW = '2026-10-26T19:00:00Z';
const row = (sku, patch = {}) => ({'Item Number': String(sku), Product: `Tool ${sku}`, Category: `Purpose ${sku}`, _included: true, 'Price USD': 99, ...patch});
const offer = (sku, price, patch = {}) => ({id: `offer-${sku}-${price}`, sku: String(sku), price, starts_on: '2026-10-01', ends_on: '2026-10-26', ...patch});
const index = (rows, publicOffers, memberOffers = [], extras = {}) => api.indexOffers({public_offers: publicOffers, member_offers: memberOffers, ...extras}, rows);
const rank = (rows, offers, options = {}) => api.rankDeals(rows, {index: index(rows, offers), now: NOW, ownership, ...options});
test('Pacific calendar dates include the full final sale day across UTC boundaries', () => {
  assert.equal(api.pacificDate('2026-10-27T06:59:59Z'), '2026-10-26');
  assert.equal(api.pacificDate('2026-10-27T07:00:00Z'), '2026-10-27');
  assert.equal(api.activeOffer(offer('1', 10), '2026-10-27T06:59:59Z'), true);
  assert.equal(api.activeOffer(offer('1', 10), '2026-10-27T07:00:00Z'), false);
  assert.equal(api.pacificDate('2026-03-09T06:59:59Z'), '2026-03-08');
  assert.equal(api.pacificDate('2026-02-30'), null);
  assert.equal(api.pacificDate('2026-02-30T12:00:00Z'), null);
});
test('future, malformed and backwards sale windows never qualify', () => {
  assert.equal(api.activeOffer(offer('1', 10, {starts_on: '2026-10-27'}), NOW), false);
  assert.equal(api.activeOffer(offer('1', 10, {ends_on: '2026-02-30'}), NOW), false);
  assert.equal(api.activeOffer(offer('1', 10, {starts_on: '2026-10-27', ends_on: '2026-10-20'}), NOW), false);
  assert.equal(api.activeOffer(offer('1', 10), 'invalid'), false);
});
test('public and member offers remain separate and coupons never stack', () => {
  const r = row('10001'), i = index([r], [offer('10001', 80, {coupon_code: 'PUBLIC'}), offer('10001', 75, {membership_required: true})], [offer('10001', 60, {coupon_code: 'MEMBER'})]);
  const chosen = api.bestOffers(r, i, NOW);
  assert.equal(chosen.public.price, 80); assert.equal(chosen.member.price, 60);
  assert.equal(api.rankDeals([r], {index: i, now: NOW, tier: 'public'}).recommended[0].price, 80);
  const member = api.rankDeals([r], {index: i, now: NOW, tier: 'member'}).recommended[0];
  assert.equal(member.price, 60); assert.equal(member.offer.coupon_code, 'MEMBER');
  const publicCheaper = index([r], [offer('10001', 50)], [offer('10001', 60)]);
  assert.equal(api.rankDeals([r], {index: publicCheaper, now: NOW, tier: 'member'}).recommended[0].tier, 'public');
});
test('exact SKUs, documented aliases and audited canonical matches work without title guessing', () => {
  const r = row('10001', {_enrichment: {specs: {'SKU(s)': '10001, 10002'}}});
  const i = index([r], [offer('10002', 15), offer('10003', 5, {title: 'Tool 10001'}), offer('10004', 12, {catalog_matches: [{sku: '10004', catalog_sku: '10001', included: true, match_type: 'audited_alias'}]})]);
  assert.equal(api.bestOffers(r, i, NOW).public.price, 12);
  assert.equal(i.bySku.get('10001').length, 2);
});
test('excluded sets and conditional coupon terms cannot enter recommendations', () => {
  const good = row('10001'), bad = row('10002', {_included: false});
  const i = index([good, bad], [offer('10001', null), offer('10001', 10, {conditional: true}), offer('10001', 9, {automatic_recommendation_allowed: false}), offer('10002', 10)], [], {conditional_offers: [offer('10001', 1)]});
  assert.equal(api.bestOffers(good, i, NOW).public, null); assert.equal(i.bySku.has('10002'), false);
});
test('effective offer price enforces 200 dollars regardless of saved snapshot price', () => {
  const a = row('10001', {'Price USD': 300}), b = row('10002', {'Price USD': 100});
  const result = rank([a, b], [offer('10001', 199.99), offer('10002', 200.01)]);
  assert.deepEqual(result.recommended.map(x => x.sku), ['10001']);
  assert.equal(rank([a], [offer('10001', -1)]).recommended.length, 0);
  assert.equal(rank([a], [offer('10001', 200.001)]).recommended.length, 0);
  assert.equal(rank([a], [offer('10001', 200)], {cap: 100}).recommended.length, 0);
});
test('wishlist mode uses only explicitly wished-for products; collection mode scans all', () => {
  const rows = [row('10001'), row('10002')], offers = rows.map(r => offer(r['Item Number'], 20));
  assert.deepEqual(rank(rows, offers, {mode: 'wishlist', wishlist: ['10002']}).recommended.map(x => x.sku), ['10002']);
  assert.equal(rank(rows, offers, {mode: 'wishlist', wishlist: {10001: true, 10002: false}}).recommended.length, 1);
  assert.equal(rank(rows, offers, {mode: 'collection', wishlist: []}).recommended.length, 2);
});
test('monthly spending uses Pacific month, actual paid totals and no previous/future month deductions', () => {
  const purchases = [{date: '2026-10-01', amount: 40}, {date: '2026-09-30', amount: 80},
    {date: '2026-10-25', price: 10, quantity: 2}, {date: '2026-10-27', amount: 999},
    {date: 'invalid', amount: 10}, {amount: 10}, {date: '2026-10-26', amount: -10}, {date: '2026-10-26', amount: 50, status: 'cancelled'}];
  assert.equal(api.monthlySpending(purchases, NOW), 60);
  assert.equal(api.remainingBudget(100, purchases, NOW), 40);
  assert.equal(api.remainingBudget(20, purchases, NOW), 0);
  assert.equal(api.monthlySpending([{date: '2026-11-01T06:00:00Z', amount: 9}], '2026-11-01T06:30:00Z'), 9);
});
test('greedy buying list respects budget in cents and keeps affordable lower-ranked deals', () => {
  const rows = [row('10001'), row('10002'), row('10003')];
  const offers = [offer('10001', 60, {retailer_savings_percent: 50}), offer('10002', 30), offer('10003', 25)];
  const result = rank(rows, offers, {budget: 100, purchases: [{date: '2026-10-01', amount: 10}]});
  assert.equal(result.spent, 10); assert.equal(result.remaining, 90);
  assert.equal(result.plannedSpend, 85); assert.equal(result.remainingAfterPlan, 5);
  assert.equal(rank(rows, offers, {budget: 0}).recommended.length, 0);
  assert.equal(rank(rows, offers, {budget: null}).plannedSpend, 115);
  assert.equal(rank(rows, offers, {budget: 'not a budget'}).plannedSpend, 0);
});
test('owned exact products and explicit family rules suppress active deals', () => {
  const r = row('10001', {Product: 'Floor jack', Category: 'Floor Jacks'});
  assert.equal(rank([r], [offer('10001', 30)], {inventory: [{sku: '10001'}]}).recommended.length, 0);
  assert.equal(rank([r], [offer('10001', 30)], {rules: [{family: 'jacks'}]}).recommended.length, 0);
  assert.equal(rank([r], [offer('10001', 30)], {inventory: [{sku: '10001'}], overrides: {10001: 'replacement'}}).recommended.length, 1);
});
const socketCap = sizes => ({family: 'sockets', system: 'metric', drive: '3/8', depth: 'deep', impact: false, points: '6', profile: 'hex', style: 'fixed', sizes});
const descriptor = (sku, sizes) => ({sku, family: 'sockets', families: ['sockets'], label: `Socket set ${sku}`, dimensions: socketCap([]), capabilities: [socketCap(sizes)], coverageComplete: true, issues: []});
test('virtual verified ownership removes equivalent sets without hiding useful different profiles', () => {
  const rows = [row('10001'), row('10002'), row('10003')], capabilities = {products: {
    10001: descriptor('10001', ['8','9','10']), 10002: descriptor('10002', ['8','9']),
    10003: {...descriptor('10003', ['8','9']), capabilities: [{...socketCap(['8','9']), impact: true}]}
  }};
  const result = rank(rows, [offer('10001', 30, {retailer_savings_percent: 50}), offer('10002', 15), offer('10003', 25)], {capabilities});
  assert.deepEqual(result.recommended.map(x => x.sku), ['10001', '10003']);
  assert.equal(result.suppressed.find(x => x.sku === '10002').kind, 'plan-overlap');
});
test('unknown alternatives use a shopping group without claiming owned capability coverage', () => {
  const rows = [row('10001', {Category: 'Floor Jacks', Product: 'Floor jack A'}), row('10002', {Category: 'Floor Jacks', Product: 'Floor jack B'})];
  const result = rank(rows, [offer('10001', 30), offer('10002', 35)]);
  assert.equal(result.candidates.length, 2); assert.equal(result.recommended.length, 1);
  assert.equal(result.suppressed[0].kind, 'plan-alternative');
});
test('unknown socket profiles keep distinct needed size ranges in the buying list', () => {
  const rows = [row('10001'), row('10002'), row('10003')];
  const unknownDescriptor = (sku, sizes) => ({...descriptor(sku, sizes),
    dimensions: {...socketCap([]), points: 'unknown'},
    capabilities: [{...socketCap(sizes), points: 'unknown'}],
    coverageComplete: false, issues: ['Points are unverified.']});
  const capabilities = {products: {
    10001: unknownDescriptor('10001', ['8','9','10','11','12','13','14','15','16','17','18','19']),
    10002: unknownDescriptor('10002', ['20','21','22','23','24']),
    10003: unknownDescriptor('10003', ['19','18','17','16','15','14','13','12','11','10','9','8'])
  }};
  const result = rank(rows, [offer('10001', 20), offer('10002', 25), offer('10003', 30)], {capabilities});
  assert.deepEqual(result.recommended.map(x => x.sku), ['10001', '10002']);
  assert.equal(result.suppressed.find(x => x.sku === '10003').kind, 'plan-alternative');
});
test('saved snapshot price never manufactures savings or an observed all-time low', () => {
  const r = row('10001', {'Price USD': 199});
  const item = rank([r], [offer('10001', 20)]).recommended[0];
  assert.equal(item.history, null); assert.deepEqual(item.savings, {dollars: null, percent: null});
  assert.equal(/all.time|90%|179/.test(item.explanation), false);
});
test('history comparisons stay in the actual public/member tier and use observed wording', () => {
  const r = row('10001'), history = {10001: {lowest_observed_price: 5, public: {lowest_observed_price: 20, first_observed_at: '2026-10-01T20:00:00Z', deal_episodes: 2, observations_count: 3}, member: {lowest_observed_price: 5, first_observed_at: '2026-10-01T20:00:00Z'}}};
  const item = rank([r], [offer('10001', 20, {retailer_savings_dollars: 10})], {history}).recommended[0];
  assert.equal(item.history.lowest_observed_price, 20); assert.equal(item.history.at_observed_low, true);
  assert.equal(item.savings.dollars, 10); assert.match(item.explanation, /observed by this tracker/);
  assert.doesNotMatch(item.explanation, /all.time|historical low/i);
  const future = {10001: {public: {lowest_observed_price: 1, first_observed_at: '2026-11-01'}}};
  assert.equal(rank([r], [offer('10001', 20)], {history: future}).recommended[0].history, null);
});
