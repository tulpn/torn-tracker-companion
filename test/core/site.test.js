import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createCache } from '../../src/core/cache.js';
import { FF_URL, MAX_IDS, PRICES_URL, SPACES, createSite } from '../../src/core/site.js';

const KEY = `tt_feed_${'E'.repeat(43)}`;

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

const settle = () => new Promise((resolve) => setImmediate(resolve));

function rig({ key = KEY, reply = () => ({ ok: true, status: 200, data: {} }), now = () => 0 } = {}) {
  const calls = [];
  let currentKey = key;
  const site = createSite({
    getKey: () => currentKey,
    send: async (url, opts) => {
      calls.push({ url, ...opts });
      return reply(url, opts);
    },
    cache: createCache(SPACES, { now }),
  });
  return { site, calls, setKey: (k) => { currentKey = k; } };
}

const ffReply = (rows) => () => ({ ok: true, status: 200, data: { results: rows } });

describe('CMP-101 fair-fight estimates: one batched lookup, cached for an hour', () => {
  test('all ids in one request, to our host, with the script key', async () => {
    const r = rig({ reply: ffReply([{ id: 1, ff: 2.5, band: '1m–5m' }, { id: 2, ff: 1, band: '<1m' }]) });
    const found = await r.site.ff([1, 2, 2]);
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].url, FF_URL);
    assert.equal(r.calls[0].method, 'POST');
    assert.deepEqual(JSON.parse(r.calls[0].body), { ids: [1, 2] });
    assert.equal(r.calls[0].headers.Authorization, `Bearer ${KEY}`);
    assert.deepEqual(found.get(1), { ff: 2.5, band: '1m–5m' });
  });

  test('a second page view inside the hour asks nothing', async () => {
    let clock = 0;
    const r = rig({ reply: ffReply([{ id: 1, ff: 3, band: null }]), now: () => clock });
    await r.site.ff([1]);
    clock = 59 * 60_000;
    await r.site.ff([1]);
    assert.equal(r.calls.length, 1);
    clock = 60 * 60_000;
    await r.site.ff([1]);
    assert.equal(r.calls.length, 2);
  });

  test('at most 100 ids per lookup', async () => {
    const r = rig({ reply: ffReply([]) });
    await r.site.ff(Array.from({ length: 150 }, (_, i) => i + 1));
    assert.equal(JSON.parse(r.calls[0].body).ids.length, MAX_IDS);
  });

  test('a player the site does not know is "?" for the hour, never a guess and never a retry', async () => {
    const r = rig({ reply: ffReply([]) });
    assert.deepEqual((await r.site.ff([7])).get(7), { ff: null, band: null });
    await r.site.ff([7]);
    assert.equal(r.calls.length, 1);
  });

  test('a reply that does not fit is no answer: nothing cached, nothing invented', async () => {
    const r = rig({ reply: ffReply([{ id: 1, ff: 99 }, { id: 2, ff: '3' }, { id: 3, ff: 2, band: 'x'.repeat(41) }, { id: 4, ff: 2, band: null, extra: 'fine' }, { id: 5, ff: 2 }]) });
    const found = await r.site.ff([1, 2, 3, 4]);
    for (const id of [1, 2, 3]) assert.deepEqual(found.get(id), { ff: null, band: null }, `id ${id}`);
    assert.deepEqual(found.get(4), { ff: 2, band: null });
    assert.equal(found.has(5), false, 'a row for an id we did not ask about is ignored');
  });

  test('CMP-023 an unreachable site gives no data and caches nothing', async () => {
    const r = rig({ reply: () => ({ ok: false, status: 0, data: null }) });
    assert.equal((await r.site.ff([1])).size, 0);
    await r.site.ff([1]);
    assert.equal(r.calls.length, 2, 'tried again on the next page view');
  });

  test('without a script key nothing is asked', async () => {
    const r = rig({ key: '' });
    assert.equal((await r.site.ff([1])).size, 0);
    assert.equal(r.calls.length, 0);
  });

  test('a refused key stops reads until the key changes', async () => {
    const r = rig({ reply: () => ({ ok: false, status: 401, data: null }) });
    await r.site.ff([1]);
    assert.equal(r.site.keyRefused(), true);
    await r.site.ff([2]);
    assert.equal(r.calls.length, 1);
    r.setKey(`tt_feed_${'F'.repeat(43)}`);
    await r.site.ff([2]);
    assert.equal(r.calls.length, 2);
  });
});

describe('CMP-105 prices: one batched read, cached for ten minutes', () => {
  test('ids in the query, only valid prices kept', async () => {
    const r = rig({ reply: () => ({ ok: true, status: 200, data: { prices: [{ item_id: 1, market: 500 }, { item_id: 2, market: -1 }, { item_id: 9, market: 5 }] } }) });
    const found = await r.site.prices([1, 2]);
    assert.equal(r.calls[0].url, `${PRICES_URL}?ids=1,2`);
    assert.deepEqual([...found], [[1, 500]]);
  });

  test('cached prices are not asked for again', async () => {
    const r = rig({ reply: () => ({ ok: true, status: 200, data: { prices: [{ item_id: 1, market: 500 }] } }) });
    await r.site.prices([1]);
    await r.site.prices([1]);
    assert.equal(r.calls.length, 1);
  });
});

describe('CMP-008 the cache keeps to its key, its lifetime and its shapes', () => {
  test('entries persist in ttc_cache and come back checked', async () => {
    const cache = createCache(SPACES, { now: () => 1000 });
    cache.set('ff', 1, { ff: 2, band: null });
    await settle();
    assert.deepEqual([...store.keys()], ['ttc_cache']);
    const raw = JSON.parse(store.get('ttc_cache'));
    raw.ff['2'] = { v: { ff: 'bad' }, at: 1000 };
    raw.junk = { x: 1 };
    store.set('ttc_cache', JSON.stringify(raw));

    const again = createCache(SPACES, { now: () => 2000 });
    await again.load();
    assert.deepEqual(again.get('ff', 1), { ff: 2, band: null });
    assert.equal(again.get('ff', 2), undefined);
  });

  test('a value that does not fit is never stored', () => {
    const cache = createCache(SPACES);
    assert.equal(cache.set('prices', 1, 'cheap'), false);
    assert.equal(cache.get('prices', 1), undefined);
  });

  test('clear() drops everything, and a queued write does not bring it back', async () => {
    const cache = createCache(SPACES);
    cache.set('prices', 1, 5);
    cache.clear();
    await settle();
    assert.equal(store.has('ttc_cache'), false);
  });

  test('an unknown space is a bug', () => {
    assert.throws(() => createCache(SPACES).get('battle', 1), /no space/);
  });
});
