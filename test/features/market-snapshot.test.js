// Item market snapshots, demand-gated (CMP-203, CAPI-013 as accepted in hq #123).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { MAX_LISTINGS, itemOf, listingsOf } from '../../src/features/market-snapshot/index.js';
import { checkObservation } from '../../src/core/kinds.js';
import { page as capturedPage, runFeature } from '../feature-harness.js';

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

describe('hq #454 the feature says why nothing was shared', () => {
  test('an item the site did not ask for', async () => {
    const r = run({ site: fakeSite([367]) });
    await wait();
    assert.deepEqual(r.logs, ['share item_market_snapshot: refused (not demanded: item 206)']);
  });

  test('a page whose rows no longer match the selectors, counted; said once however often the page redraws', async () => {
    const r = run({ site: fakeSite(), html: `<div id="item-market-root"><div class="sellerListWrapper___d4"><ul class="sellerList___e5">
      <li><div class="rowWrapper___a1"><div class="cost___zz">$1</div></div></li></ul></div></div>` });
    await wait();
    r.doc.querySelector('ul').insertAdjacentHTML('beforeend', '<li>redrawn</li>');
    await wait();
    assert.deepEqual(r.logs, ['market_snapshot: no listings matched (1 rows) for item 206']);
  });

  test('a repeat within five minutes', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    r.doc.querySelector('ul').insertAdjacentHTML('beforeend', row('900,000', 1));
    await wait();
    assert.equal(r.shared.length, 1);
    assert.deepEqual(r.logs, ['share item_market_snapshot: deduped (item 206 went within the last five minutes)']);
  });

  test('not sharing this kind, a hidden tab: each said once', async () => {
    const off = run({ site: fakeSite(), sharing: () => false });
    await wait();
    off.doc.querySelector('ul').insertAdjacentHTML('beforeend', row('900,000', 1));
    await wait();
    assert.deepEqual(off.logs, ['market_snapshot: item_market_snapshot is not switched on under Sharing']);
    off.stop();
    const hidden = run({ site: fakeSite(), visibility: 'hidden' });
    await wait();
    assert.deepEqual(hidden.logs, ['market_snapshot: the tab is hidden; looking again when the page changes']);
  });

  test('a page other scripts keep redrawing is still read within a second of the first change', async () => {
    const r = run({ site: fakeSite() });
    const ul = r.doc.querySelector('ul');
    const started = Date.now();
    // A change every 100 ms for two seconds: the old timer, pushed back each time, never fired.
    const tick = r.doc.createElement('span');
    ul.before(tick);
    const busy = setInterval(() => { tick.textContent = String(Date.now()); }, 100);
    try {
      while (r.shared.length === 0 && Date.now() - started < 2_000) await wait(50);
    } finally {
      clearInterval(busy);
    }
    assert.equal(r.shared.length, 1);
    assert.ok(Date.now() - started < 1_500, `shared after ${Date.now() - started} ms`);
  });
});

describe('hq #732 the captured item market (2026-11-03)', () => {
  const CAPTURED = 'https://www.torn.com/page.php?sid=ItemMarket#/market/view=category&categoryName=Most%20Popular&itemID=1123';

  test('the item from its tile when the hash has none, and every row read', () => {
    const r = run({ html: capturedPage('item-market-listings.html'), settings: { enabled: false }, site: fakeSite([]) });
    assert.equal(itemOf(r.doc, '#/market/view=category&categoryName=Most%20Popular'), 1123);
    assert.deepEqual(listingsOf(r.doc), [
      { price: 430, quantity: 9 }, { price: 540, quantity: 2 }, { price: 550, quantity: 2 }, { price: 599, quantity: 2 },
      { price: 600, quantity: 51 }, { price: 650, quantity: 476 }, { price: 666, quantity: 2820 }, { price: 679, quantity: 9999 },
    ]);
  });

  test('a wanted item is sent with prices and quantities only, no seller', async () => {
    const r = run({ url: CAPTURED, html: capturedPage('item-market-listings.html'), site: fakeSite([1123]) });
    await wait();
    assert.equal(r.shared.length, 1);
    const { kind, ...fields } = r.shared[0];
    assert.equal(fields.item_id, 1123);
    assert.equal(fields.listings.length, 8);
    assert.doesNotMatch(JSON.stringify(fields), /Seller|XID|2000001/);
    assert.equal(checkObservation({ kind, observed_at: '2026-11-03T02:26:00Z', script_version: '0.9.0', ...fields }).error, undefined);
    assert.deepEqual(r.violations, []);
  });
});
