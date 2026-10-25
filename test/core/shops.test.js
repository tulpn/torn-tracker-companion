// What a shop pays for each item (CMP-109): the site's public table, the built-in one,
// the warning's words and the tool that builds the table.

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createCache } from '../../src/core/cache.js';
import {
  BUILT_IN, BUILT_IN_DATE, MAX_SHOP_ROWS, readShopReply, shopName, undersellText, validShopRow, validShopRows,
} from '../../src/core/shops.js';
import { SHOP_PRICES_URL, SPACES, createSite } from '../../src/core/site.js';
import { shopsFrom, shopsModuleFrom } from '../../tools/build-items.mjs';

const KEY = `tt_feed_${'E'.repeat(43)}`;
const BIG_AL = { price: 1250, shop: "Big Al's Gun Shop", country: 'Torn' };

let store;
beforeEach(() => {
  store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});
afterEach(() => {
  delete globalThis.localStorage;
});

function rig({ reply, now = () => 0, key = KEY } = {}) {
  const calls = [];
  const site = createSite({
    getKey: () => key,
    send: async (url, opts) => {
      calls.push({ url, ...opts });
      return reply(url, opts);
    },
    cache: createCache(SPACES, { now }),
  });
  return { site, calls };
}

const ok = (items) => () => ({ ok: true, status: 200, data: { items, updated_at: '2026-10-25T00:00:00Z' } });

describe('CMP-109 the site\'s table, kept a day, asked without a key', () => {
  test('one anonymous GET to the public catalogue; the reply becomes the table', async () => {
    const r = rig({ reply: ok([{ item_id: 206, sell_price: 1250, shop: "Big Al's Gun Shop", country: 'Torn' }]) });
    const table = await r.site.shops();
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].url, SHOP_PRICES_URL);
    assert.equal(r.calls[0].method, 'GET');
    assert.equal(r.calls[0].headers.Authorization, undefined, 'public data: the script key is never sent');
    assert.deepEqual(table.get(206), BIG_AL);
  });

  test('a second ask inside the day uses the cache; after it, the site is asked again', async () => {
    let clock = 0;
    const r = rig({ reply: ok([{ item_id: 1, sell_price: 5, shop: null, country: null }]), now: () => clock });
    await r.site.shops();
    clock = 23 * 3_600_000;
    await r.site.shops();
    assert.equal(r.calls.length, 1);
    clock = 24 * 3_600_000;
    await r.site.shops();
    assert.equal(r.calls.length, 2);
  });

  test('pages asking at once share one request', async () => {
    const r = rig({ reply: ok([{ item_id: 1, sell_price: 5, shop: null, country: null }]) });
    await Promise.all([r.site.shops(), r.site.shops()]);
    assert.equal(r.calls.length, 1);
  });

  test('AC4: with the site down, the built-in table; the site is not asked again for an hour', async () => {
    let clock = 0;
    const r = rig({ reply: () => ({ ok: false, status: 503, data: null }), now: () => clock });
    assert.equal(await r.site.shops(), BUILT_IN);
    clock = 59 * 60_000;
    assert.equal(await r.site.shops(), BUILT_IN);
    assert.equal(r.calls.length, 1);
    clock = 61 * 60_000;
    await r.site.shops();
    assert.equal(r.calls.length, 2);
  });

  test('a network failure, or a reply with nothing usable, is the built-in table too', async () => {
    const thrown = rig({ reply: () => { throw new Error('offline'); } });
    assert.equal(await thrown.site.shops(), BUILT_IN);
    const empty = rig({ reply: ok([{ item_id: 'x', sell_price: 5 }]) });
    assert.equal(await empty.site.shops(), BUILT_IN);
  });

  test('the built-in table holds prices for this release', () => {
    assert.ok(BUILT_IN.size > 100);
    assert.match(BUILT_IN_DATE, /^\d{4}-\d{2}-\d{2}$/);
    for (const [id, entry] of BUILT_IN) {
      assert.ok(Number.isInteger(id) && id > 0);
      assert.ok(Number.isInteger(entry.price) && entry.price > 0);
    }
  });
});

describe('the reply is checked field by field', () => {
  test('a row that does not fit is left out; a repeated id keeps the first', () => {
    const rows = readShopReply({ items: [
      { item_id: 206, sell_price: 1250, shop: "Big Al's Gun Shop", country: 'Torn' },
      { item_id: 206, sell_price: 9, shop: null, country: null },
      { item_id: 7, sell_price: 0, shop: null, country: null },
      { item_id: 8, sell_price: 1.5, shop: null, country: null },
      { item_id: -1, sell_price: 5, shop: null, country: null },
      { item_id: 9, sell_price: 5, shop: 42, country: ['x'] },
      { item_id: 10, sell_price: 5, shop: 'x'.repeat(41), country: 'Torn' },
      null,
    ] });
    assert.deepEqual(rows, [[206, 1250, "Big Al's Gun Shop", 'Torn'], [9, 5, null, null], [10, 5, null, 'Torn']]);
    assert.equal(readShopReply({ items: 'no' }), null);
    assert.equal(readShopReply(null), null);
  });

  test('the open data envelope is ignored, and an empty list is no answer (hq #365)', () => {
    const envelope = { observed_at: '2026-10-25T20:00:00Z', age_s: 12, reporters: null, source: 'api', server_time: 1792958400 };
    const rows = readShopReply({ ...envelope, updated_at: '2026-10-25T20:00:00Z', items: [
      { item_id: 1, sell_price: 50, shop: null, country: null },
    ] });
    assert.deepEqual(rows, [[1, 50, null, null]]);
    assert.equal(readShopReply({ ...envelope, updated_at: null, items: [] }), null);
  });

  test('what the cache keeps', () => {
    assert.equal(validShopRow([1, 5, null, null]), true);
    assert.equal(validShopRow([1, 5, 'Shop']), false);
    assert.equal(validShopRow([1, 1e13, null, null]), false);
    assert.equal(validShopRows([]), false);
    assert.equal(validShopRows(Array.from({ length: MAX_SHOP_ROWS + 1 }, (_, i) => [i + 1, 1, null, null])), false);
  });
});

describe('the warning\'s words', () => {
  test('the shop, what it pays, the difference and the total', () => {
    assert.equal(undersellText(940, BIG_AL, 12),
      "Below the shop price. Big Al's Gun Shop pays $1,250 each, $310 more than this (×12: $3,720).");
    assert.equal(undersellText(940, BIG_AL, 1), "Below the shop price. Big Al's Gun Shop pays $1,250 each, $310 more than this.");
    assert.equal(undersellText(940, BIG_AL), "Below the shop price. Big Al's Gun Shop pays $1,250 each, $310 more than this.");
  });

  test('nothing at or above the shop price, without a price, or for an item no shop buys', () => {
    assert.equal(undersellText(1250, BIG_AL, 2), null);
    assert.equal(undersellText(null, BIG_AL, 2), null);
    assert.equal(undersellText(5, undefined, 2), null);
  });

  test('a shop abroad names its country; an unknown one is "a shop"', () => {
    assert.equal(shopName({ shop: 'Pawn Shop', country: 'Mexico' }), 'Pawn Shop in Mexico');
    assert.equal(shopName({ shop: null }), 'A shop');
    assert.equal(shopName(null, { capital: false }), 'a shop');
  });
});

describe('tools/build-items.mjs, the shop table', () => {
  test('the highest value.shops[].sell_price per item, with its shop; the deprecated fields are not read', () => {
    const rows = shopsFrom({ items: [
      { id: 206, value: { sell_price: 99_999, shops: [
        { shop: 'Pawn Shop', country: 'Torn', buy_price: null, sell_price: 1000 },
        { shop: "Big Al's Gun Shop", country: 'Torn', buy_price: 2000, sell_price: 1250 },
      ] } },
      { id: 1, value: { shops: [{ shop: 'Pawn Shop', country: 'Torn', sell_price: null }] } },
      { id: 2, value: { sell_price: 50 } },
      { id: 3, value: { shops: [{ shop: 'Market', country: 'Mexico', sell_price: 7 }] } },
    ] });
    assert.deepEqual(rows, [[3, 7, 'Market', 'Mexico'], [206, 1250, "Big Al's Gun Shop", 'Torn']]);
    assert.throws(() => shopsFrom({ error: { code: 2 } }), /no items array/);
  });

  test('the module it writes', () => {
    const text = shopsModuleFrom([[206, 1250, "Big Al's Gun Shop", 'Torn']], '2026-10-25');
    assert.match(text, /^\/\/ Generated by tools\/build-items\.mjs on 2026-10-25/);
    assert.match(text, /^export const SHOPS_DATE = '2026-10-25';$/m);
    assert.match(text, /^ {2}\[206,1250,"Big Al's Gun Shop","Torn"\],$/m);
  });
});
