// Item market snapshots, demand-gated (CMP-203, CAPI-013 as accepted in hq #123).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { MAX_LISTINGS, itemOf, listingsOf } from '../../src/features/market-snapshot/index.js';
import { checkObservation } from '../../src/core/kinds.js';
import { runFeature } from '../feature-harness.js';

const MARKET = 'https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=206&itemName=Xanax';

/** Synthetic: classes as TornTools matches them. Sellers are on the page and never read. */
const row = (price, available) => `<li><div class="rowWrapper___a1"><a href="/profiles.php?XID=5">Seller</a>
  <div class="price___b2">$${price}</div><div class="available___c3">${available} available</div></div></li>`;
const page = (rows) => `<div id="item-market-root"><div class="itemInfo___x"><img class="torn-item" src="/images/items/206/large.png"></div>
  <div class="sellerListWrapper___d4"><ul class="sellerList___e5">${rows.join('')}</ul></div></div>`;
const HTML = page([row('830,000', 3), row('831,500', 12), row('ask', 1)]);

function fakeSite(wanted = [206]) {
  const calls = [];
  return {
    calls,
    async demand() {
      calls.push('demand');
      return new Map([['item_market_snapshot', new Set(wanted)]]);
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: MARKET, html: HTML, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 1_000) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CMP-203 reading the item market', () => {
  test('the item from the hash, or from its image when the hash has none', () => {
    const r = run({ settings: { enabled: false }, site: fakeSite([]) });
    assert.equal(itemOf(r.doc, '#/market/view=search&itemID=206'), 206);
    assert.equal(itemOf(r.doc, '#/market/view=category&categoryName=Drugs'), 206);
  });

  test('prices and quantities only, an unreadable row left out, at most 50', () => {
    const r = run({ settings: { enabled: false }, site: fakeSite([]) });
    assert.deepEqual(listingsOf(r.doc), [{ price: 830000, quantity: 3 }, { price: 831500, quantity: 12 }]);
    const big = run({ html: page(Array.from({ length: 70 }, (_, i) => row(1000 + i, 1))), site: fakeSite([]) });
    assert.equal(listingsOf(big.doc).length, MAX_LISTINGS);
  });
});

describe('CMP-203 sending only what the site asks for', () => {
  test('a wanted item is sent once, in the shape the site takes, with no seller', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    assert.equal(r.shared.length, 1);
    const { kind, ...fields } = r.shared[0];
    assert.deepEqual(fields, { item_id: 206, listings: [{ price: 830000, quantity: 3 }, { price: 831500, quantity: 12 }] });
    assert.ok(!JSON.stringify(fields).includes('XID'));
    assert.equal(checkObservation({ kind, observed_at: '2026-10-20T12:00:00Z', script_version: '0.9.0', ...fields }).error, undefined);
    r.doc.querySelector('ul').insertAdjacentHTML('beforeend', row('900,000', 1));
    await wait();
    assert.equal(r.shared.length, 1, 'once per item per five minutes');
    assert.deepEqual(r.violations, []);
  });

  test('an item the site does not want is not sent', async () => {
    const r = run({ site: fakeSite([367]) });
    await wait();
    assert.deepEqual(r.shared, []);
  });

  test('not sharing this kind: the site is not even asked', async () => {
    const site = fakeSite();
    const r = run({ site, sharing: () => false });
    await wait();
    assert.deepEqual(site.calls, []);
    assert.deepEqual(r.shared, []);
  });

  test('a hidden tab asks and sends nothing', async () => {
    const site = fakeSite();
    const r = run({ site, visibility: 'hidden' });
    await wait();
    assert.deepEqual(site.calls, []);
    assert.deepEqual(r.shared, []);
  });
});
