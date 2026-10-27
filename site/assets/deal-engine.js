/* Deal eligibility and a local buying list. Retailer offers are never stacked. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DealPlanner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const MAX_PRICE = 200;
  const clean = value => String(value == null ? '' : value).trim();
  const skuOf = row => clean(row && (row['Item Number'] || row.sku));
  const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const number = value => typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
  const positivePrice = value => { const n = number(value); return Number.isFinite(n) && n > 0 ? money(n) : null; };
  const list = value => Array.isArray(value) ? value : [];
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  function validDay(value) {
    if (!datePattern.test(clean(value))) return null;
    const day = clean(value), time = new Date(day + 'T12:00:00Z');
    return Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === day ? day : null;
  }
  /** Retailer sale dates are inclusive calendar days in America/Los_Angeles. */
  function pacificDate(now) {
    if (validDay(now)) return clean(now);
    if (datePattern.test(clean(now))) return null;
    const isoDay = clean(now).match(/^(\d{4}-\d{2}-\d{2})T/);
    if (isoDay && !validDay(isoDay[1])) return null;
    const time = now == null ? new Date() : new Date(now);
    if (!Number.isFinite(time.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(time);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  function activeOffer(offer, now) {
    const today = pacificDate(now);
    if (!today || !offer || offer.active === false || offer.expired === true) return false;
    const start = offer.starts_on ? validDay(offer.starts_on) : null;
    const end = offer.ends_on ? validDay(offer.ends_on) : null;
    if ((offer.starts_on && !start) || (offer.ends_on && !end)) return false;
    if (start && end && start > end) return false;
    return (!start || start <= today) && (!end || end >= today);
  }
  function documentedSkus(row) {
    const canonical = skuOf(row), result = new Set(canonical ? [canonical] : []);
    const evidence = row?._enrichment?.specs?.['SKU(s)'];
    // Only the explicitly named SKU field establishes aliases; never title numbers.
    if (Array.isArray(evidence)) evidence.forEach(value => { if (/^\d{3,7}$/.test(clean(value))) result.add(clean(value)); });
    else if (typeof evidence === 'string') (evidence.match(/\b\d{3,7}\b/g) || []).forEach(value => result.add(value));
    return [...result];
  }
  function includedRow(row) {
    return !!row && row._included !== false && row.included !== false &&
      !['Confirmed size gaps', 'Size coverage unverified'].includes(row['Size Review Status']);
  }
  /**
   * indexOffers(payload, catalog) returns {bySku: Map, catalogBySku: Map, payload}.
   * bySku uses canonical audited IDs; matching accepts exact SKUs, documented SKU(s),
   * or source-provided exact/audited_alias catalog_matches. No fuzzy title matches.
   */
  function indexOffers(payload, catalog) {
    payload = payload && typeof payload === 'object' ? payload : {};
    const catalogBySku = new Map(), aliases = new Map(), ambiguous = new Set(), bySku = new Map();
    for (const row of list(catalog)) {
      const canonical = skuOf(row);
      if (!canonical || !includedRow(row)) continue;
      catalogBySku.set(canonical, row);
      for (const alias of documentedSkus(row)) {
        if (aliases.has(alias) && aliases.get(alias) !== canonical) ambiguous.add(alias);
        else aliases.set(alias, canonical);
      }
    }
    for (const alias of ambiguous) aliases.delete(alias);
    for (const canonical of catalogBySku.keys()) aliases.set(canonical, canonical);
    for (const [tier, offers] of [['public', payload.public_offers], ['member', payload.member_offers]]) {
      for (const raw of list(offers)) {
        if (!raw || typeof raw !== 'object') continue;
        // A mislabeled member offer can never leak into the public channel.
        if (tier === 'public' && raw.membership_required === true) continue;
        if (raw.price == null || raw.conditional === true || raw.requires_terms_review === true || raw.automatic_recommendation_allowed === false) continue;
        const price = positivePrice(raw.price);
        if (price == null || number(raw.price) > MAX_PRICE) continue;
        const matches = new Set(), rawSkus = [raw.sku, ...list(raw.skus)].map(clean).filter(Boolean);
        for (const alias of rawSkus) if (aliases.has(alias)) matches.add(aliases.get(alias));
        for (const match of list(raw.catalog_matches)) {
          if (!match || match.included !== true || !['exact', 'audited_alias', undefined].includes(match.match_type)) continue;
          const canonical = clean(match.catalog_sku || match.sku);
          if (catalogBySku.has(canonical)) matches.add(canonical);
        }
        const offer = {...raw, price, tier, membership_required: tier === 'member',
          id: clean(raw.id) || [tier, clean(raw.event_id), rawSkus.join(','), price, clean(raw.ends_on)].join('|')};
        for (const canonical of matches) {
          if (!bySku.has(canonical)) bySku.set(canonical, []);
          const entries = bySku.get(canonical);
          if (!entries.some(value => value.id === offer.id && value.tier === tier && value.price === price)) entries.push(offer);
        }
      }
    }
    return {bySku, catalogBySku, aliases, payload};
  }
  function offerOrder(a, b) {
    return a.price - b.price || (a.coupon_code ? 1 : 0) - (b.coupon_code ? 1 : 0) ||
      clean(a.ends_on || '9999').localeCompare(clean(b.ends_on || '9999')) || a.id.localeCompare(b.id);
  }
  /** Each channel returns one standalone offer; prices/coupons are never combined. */
  function bestOffers(row, index, now) {
    const offers = list(index?.bySku?.get(skuOf(row))).filter(value => activeOffer(value, now));
    return {
      public: offers.filter(value => value.tier === 'public').sort(offerOrder)[0] || null,
      member: offers.filter(value => value.tier === 'member').sort(offerOrder)[0] || null
    };
  }
  function purchaseDay(purchase) {
    const value = purchase?.date || purchase?.purchased_on || purchase?.purchasedAt || purchase?.purchased_at || purchase?.acquiredAt;
    return value ? pacificDate(value) : null;
  }
  /** Actual nonnegative purchase totals in the current Pacific calendar month. */
  function monthlySpending(purchases, now) {
    const today = pacificDate(now);
    if (!today) return 0;
    let cents = 0;
    for (const purchase of list(purchases)) {
      if (!purchase || purchase.deleted === true || ['cancelled', 'canceled', 'refunded'].includes(purchase.status)) continue;
      const day = purchaseDay(purchase);
      if (!day || day > today || day.slice(0, 7) !== today.slice(0, 7)) continue;
      const total = number(purchase.amount ?? purchase.total ?? purchase.paidPrice ?? purchase.paid_price);
      const unit = number(purchase.price ?? purchase['Price USD']);
      const quantity = purchase.quantity == null ? 1 : number(purchase.quantity);
      const amount = Number.isFinite(total) ? total : unit * quantity;
      if (Number.isFinite(amount) && amount >= 0 && Number.isFinite(quantity) && quantity > 0) cents += Math.round(amount * 100);
    }
    return cents / 100;
  }
  function budgetValue(budget) {
    if (budget == null || budget === '') return null;
    const value = number(budget);
    return Number.isFinite(value) && value >= 0 ? money(value) : 0;
  }
  function remainingBudget(budget, purchases, now) {
    const value = budgetValue(budget);
    return value == null ? null : money(Math.max(0, value - monthlySpending(purchases, now)));
  }
  function wanted(sku, wishlist) {
    if (wishlist instanceof Set) return wishlist.has(sku);
    if (Array.isArray(wishlist)) return wishlist.some(value => typeof value === 'object' ? clean(value.sku || value['Item Number']) === sku && value.enabled !== false : clean(value) === sku);
    return !!(wishlist && wishlist[sku]);
  }
  function historyFor(row, offer, history, now) {
    if (!history || typeof history !== 'object') return null;
    let summary;
    for (const sku of [skuOf(row), ...documentedSkus(row)]) {
      const value = history[sku]?.[offer.tier];
      if (value && typeof value === 'object') { summary = value; break; }
    }
    if (!summary) return null;
    const low = positivePrice(summary.lowest_observed_price), first = summary.first_observed_at ? pacificDate(summary.first_observed_at) : null;
    if (low == null || !first || first > pacificDate(now)) return null;
    const episodes = number(summary.deal_episodes), observations = number(summary.observations_count);
    return {lowest_observed_price: low, first_observed_at: summary.first_observed_at,
      last_observed_at: summary.last_observed_at || null,
      deal_episodes: Number.isFinite(episodes) && episodes >= 0 ? episodes : null,
      observations_count: Number.isFinite(observations) && observations >= 0 ? observations : null,
      at_observed_low: offer.price <= low, difference_from_low: money(offer.price - low), tier: offer.tier};
  }
  function advertisedSavings(offer) {
    const amount = number(offer.retailer_savings_dollars), percent = number(offer.retailer_savings_percent);
    return {dollars: Number.isFinite(amount) && amount > 0 ? money(amount) : null,
      percent: Number.isFinite(percent) && percent > 0 && percent <= 100 ? percent : null};
  }
  function priorityFor(row, descriptor, priorities) {
    const value = priorities instanceof Map ? priorities.get(skuOf(row)) ?? priorities.get(descriptor?.family) : priorities?.[skuOf(row)] ?? priorities?.[descriptor?.family];
    if (typeof value === 'string') return ({high: 2, medium: 1, low: 0})[value.toLowerCase()] || 0;
    const numeric = number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(5, numeric)) : 0;
  }
  function ownershipApi(options) { return options.ownership || root.ToolOwnership || null; }
  function coverageFor(row, options, inventory, overrides) {
    const api = ownershipApi(options);
    return api?.coverageForProduct ? api.coverageForProduct(row, inventory, options.rules || [], overrides || {}, options.capabilities) :
      {hidden: list(inventory).some(value => clean(value?.sku) === skuOf(row)), descriptor: null, explanation: 'Exact product ownership only.', missing: []};
  }
  // This is a buying-list grouping, never evidence that an owned tool covers another.
  function fallbackGroup(row, descriptor) {
    const family = descriptor?.family || clean(row.Category) || 'unclassified';
    const dimensions = descriptor?.dimensions || {};
    if (['sockets', 'wrenches', 'hex-keys', 'drill-bits', 'driver-bits'].includes(family)) {
      const fields = ['family', 'system', 'drive', 'depth', 'impact', 'points', 'style', 'profile', 'ratcheting', 'head', 'length', 'material', 'shank'];
      const profiles = list(descriptor?.capabilities).map(capability => [
        fields.map(key => [key, capability[key] ?? null]),
        [...new Set(list(capability.sizes).map(clean).filter(Boolean))].sort()
      ]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      const normalizedDimensions = Object.keys(dimensions).sort().map(key => [key, dimensions[key]]);
      return JSON.stringify([family, normalizedDimensions, profiles]);
    }
    return JSON.stringify([family, clean(row.Category), dimensions]);
  }
  function pickTier(channels, tier) {
    if (tier !== 'member' && tier !== 'both') return channels.public;
    return [channels.public, channels.member].filter(Boolean).sort((a, b) => a.price - b.price ||
      (a.tier === b.tier ? offerOrder(a, b) : a.tier === 'public' ? -1 : 1))[0] || null;
  }
  /**
   * rankDeals(rows, {index, inventory, rules, overrides, capabilities, wishlist,
   * mode:'collection'|'wishlist', tier:'public'|'member'|'both', budget, purchases,
   * priorities, now, history, ownership?}) -> {recommended,candidates,suppressed,
   * spent,remaining,budget,plannedSpend,remainingAfterPlan,potentialSavings}.
   * Candidate entries contain row,sku,offer,price,tier,score,reasons,explanation,
   * history,coverage,savings. Scores use advertised savings, observed history and
   * user priority; they do not imply quality ratings or a guaranteed future low.
   */
  function rankDeals(rows, options) {
    options = options || {};
    const index = options.index || indexOffers({}, rows), now = options.now;
    const inventory = list(options.inventory).slice(), candidates = [], suppressed = [];
    const budget = budgetValue(options.budget), spent = monthlySpending(options.purchases, now);
    const remaining = remainingBudget(budget, options.purchases, now);
    const history = options.history?.history_by_sku || options.history || index.payload?.history_by_sku;
    const cap = Math.min(MAX_PRICE, positivePrice(options.cap) || MAX_PRICE), seen = new Set();
    for (const row of list(rows)) {
      const sku = skuOf(row);
      if (!sku || seen.has(sku) || !includedRow(row)) continue;
      seen.add(sku);
      if (options.mode === 'wishlist' && !wanted(sku, options.wishlist)) continue;
      const coverage = coverageFor(row, options, inventory, options.overrides);
      if (coverage.hidden || coverage.covered) { suppressed.push({row, sku, reason: coverage.explanation || 'Owned tool coverage.', kind: 'owned'}); continue; }
      const offer = pickTier(bestOffers(row, index, now), options.tier);
      if (!offer || offer.price > cap) continue;
      const savings = advertisedSavings(offer), observed = historyFor(row, offer, history, now), reasons = [];
      let score = 10;
      if (savings.percent != null) { score += Math.min(savings.percent, 70) * 0.7; reasons.push(`${savings.percent}% savings advertised by Harbor Freight.`); }
      if (savings.dollars != null) { score += Math.min(savings.dollars, 100) * 0.2; reasons.push(`$${savings.dollars.toFixed(2)} savings advertised by Harbor Freight.`); }
      if (observed) {
        if (observed.at_observed_low) { score += 18; reasons.push('At or below the lowest price observed by this tracker for this price tier.'); }
        else { score -= Math.min(20, observed.difference_from_low / observed.lowest_observed_price * 35); reasons.push(`$${observed.difference_from_low.toFixed(2)} above this tracker's observed low for this price tier.`); }
        if (observed.deal_episodes > 1) reasons.push(`${observed.deal_episodes} distinct deal episodes recorded since tracking began.`);
      } else reasons.push('Price history has not yet established an observed low for this price tier.');
      const priority = priorityFor(row, coverage.descriptor, options.priorities);
      if (priority) { score += priority * 12; reasons.push('Raised by your tool priority.'); }
      if (coverage.status === 'partial') { score += 5; reasons.push(coverage.explanation); }
      if (!savings.percent && !savings.dollars) reasons.push('Listed in the active offer feed; a discount percentage has not been inferred.');
      candidates.push({row, sku, offer, price: offer.price, tier: offer.tier, score: money(score), reasons,
        explanation: reasons.join(' '), history: observed, coverage, savings});
    }
    candidates.sort((a, b) => b.score - a.score || a.price - b.price || a.sku.localeCompare(b.sku));
    const recommended = [], selectedInventory = [], fallbackGroups = new Set();
    let plannedCents = 0, savedCents = 0;
    const availableCents = remaining == null ? Infinity : Math.round(remaining * 100), api = ownershipApi(options);
    for (const candidate of candidates) {
      const overrideValue = options.overrides?.[candidate.sku];
      const override = typeof overrideValue === 'object' ? overrideValue.mode : overrideValue;
      const virtualInventory = ['show', 'replacement'].includes(override) ? selectedInventory : inventory.concat(selectedInventory);
      const after = coverageFor(candidate.row, {...options, rules: []}, virtualInventory, {});
      if (after.hidden || after.covered) {
        suppressed.push({row: candidate.row, sku: candidate.sku, reason: 'Verified coverage overlaps tools already selected for this buying list.', kind: 'plan-overlap'}); continue;
      }
      const unknown = !after.descriptor?.coverageComplete, group = fallbackGroup(candidate.row, after.descriptor);
      if (unknown && fallbackGroups.has(group)) {
        suppressed.push({row: candidate.row, sku: candidate.sku, reason: 'Another alternative from this shopping group is already selected; compare alternatives before adding more.', kind: 'plan-alternative'}); continue;
      }
      const cents = Math.round(candidate.price * 100);
      if (plannedCents + cents > availableCents) continue;
      recommended.push(candidate); plannedCents += cents;
      if (candidate.savings.dollars) savedCents += Math.round(candidate.savings.dollars * 100);
      if (api?.inventoryFromProduct) selectedInventory.push(api.inventoryFromProduct(candidate.row, options.capabilities));
      else selectedInventory.push({sku: candidate.sku});
      if (unknown) fallbackGroups.add(group);
    }
    return {recommended, candidates, suppressed, spent, remaining, budget, plannedSpend: plannedCents / 100,
      remainingAfterPlan: remaining == null ? null : money(Math.max(0, remaining - plannedCents / 100)),
      potentialSavings: savedCents / 100};
  }
  return Object.freeze({MAX_PRICE, pacificDate, activeOffer, documentedSkus, indexOffers, bestOffers,
    monthlySpending, remainingBudget, rankDeals});
});
