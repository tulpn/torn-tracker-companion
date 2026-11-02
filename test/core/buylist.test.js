// A trader's buy list from torn-tracker.com (CMP-309, hq #339): the read, checked field by
// field, and one GET per list per five minutes.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { BUYLIST_URL, SPACES, buylistTrader, createSite, readBuylist } from '../../src/core/site.js';
import { createCache } from '../../src/core/cache.js';

const KEY = `tt_feed_${'B'.repeat(43)}`;

const answer = () => ({
  trader: { torn_id: 2000001, name: 'ExampleTrader' },
  published: true,
  updated_at: '2026-11-02T10:00:00Z',
  priced_at: '2026-11-02T10:00:00Z',
  prices: { 206: 790_000, 367: 11_500_000 },
  page_url: 'https://torn-tracker.com/traders/ExampleTrader/',
  calc_url: 'https://torn-tracker.com/traders/ExampleTrader/calc/',
  receipts: 12,
  last_trade_at: null,
  server_time: '2026-11-02T12:00:00Z',
});

function rig({ reply = () => ({ ok: true, status: 200, data: answer() }), key = KEY } = {}) {
  let clock = Date.UTC(2026, 10, 2, 12);
  const calls = [];
  const site = createSite({
    getKey: () => key,
    send: async (url, opts) => {
      calls.push({ url, ...opts });
      return reply();
    },
    cache: createCache(SPACES, { now: () => clock }),
    now: () => clock,
  });
  return { site, calls, tick: (ms) => { clock += ms; } };
}

describe('CMP-309 the trader asked for', () => {
  test('me, a name or an id; anything else is refused before asking', () => {
    assert.equal(buylistTrader(' ME '), 'me');
    assert.equal(buylistTrader('Example_Trader-1'), 'Example_Trader-1');
    assert.equal(buylistTrader('2000001'), '2000001');
    assert.equal(buylistTrader(''), null);
    assert.equal(buylistTrader('a/b'), null);
    assert.equal(buylistTrader('x'.repeat(33)), null);
    assert.equal(buylistTrader(42), null);
  });
});

describe('CMP-309 the buy list read', () => {
  test('prices by item id, the links and the receipts', () => {
    const list = readBuylist(answer());
    assert.deepEqual(list.trader, { id: 2000001, name: 'ExampleTrader' });
    assert.deepEqual([...list.prices], [[206, 790_000], [367, 11_500_000]]);
    assert.equal(list.pageUrl, 'https://torn-tracker.com/traders/ExampleTrader/');
    assert.equal(list.calcUrl, 'https://torn-tracker.com/traders/ExampleTrader/calc/');
    assert.equal(list.receipts, 12);
  });

  test('a bad price is dropped, never read as 0; a link off the site falls back', () => {
    const data = answer();
    data.prices = { 206: 0, 367: -5, 1: 1.5, x: 100, 2: '100', 3: 250 };
    data.page_url = 'javascript:alert(1)';
    data.calc_url = 'https://example.com/';
    const list = readBuylist(data);
    assert.deepEqual([...list.prices], [[3, 250]]);
    assert.equal(list.pageUrl, 'https://torn-tracker.com/traders/');
    assert.equal(list.calcUrl, 'https://torn-tracker.com/traders/');
  });

  test('no trader or no prices object is no list', () => {
    assert.equal(readBuylist(null), null);
    assert.equal(readBuylist({ ...answer(), trader: { torn_id: 0, name: 'X' } }), null);
    assert.equal(readBuylist({ ...answer(), prices: [] }), null);
  });
});

describe('CMP-309 site.buylist', () => {
  test('one GET with the script key, kept five minutes', async () => {
    const { site, calls, tick } = rig();
    const first = await site.buylist('ExampleTrader');
    assert.equal(first.status, 'ok');
    assert.equal(first.list.prices.get(206), 790_000);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${BUYLIST_URL}/ExampleTrader`);
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[0].headers.Authorization, `Bearer ${KEY}`);
    await site.buylist('exampletrader');
    tick(4 * 60_000);
    await site.buylist('ExampleTrader');
    assert.equal(calls.length, 1, 'the same list, any case, within five minutes');
    tick(2 * 60_000);
    await site.buylist('ExampleTrader');
    assert.equal(calls.length, 2);
  });

  test('your own list is asked for as me', async () => {
    const { site, calls } = rig();
    await site.buylist('me');
    assert.equal(calls[0].url, `${BUYLIST_URL}/me`);
  });

  test('no key and a bad name ask nothing', async () => {
    const { site, calls } = rig({ key: '' });
    assert.equal((await site.buylist('ExampleTrader')).status, 'no_key');
    assert.equal((await rig().site.buylist('a b')).status, 'bad_name');
    assert.equal(calls.length, 0);
  });

  test('404 is not_found, kept like an answer', async () => {
    const { site, calls } = rig({ reply: () => ({ ok: false, status: 404, data: { detail: 'not_found' } }) });
    assert.equal((await site.buylist('Nobody')).status, 'not_found');
    assert.equal((await site.buylist('Nobody')).status, 'not_found');
    assert.equal(calls.length, 1);
  });

  test('429 waits for Retry-After before asking again', async () => {
    const { site, calls, tick } = rig({ reply: () => ({ ok: false, status: 429, data: null, retryAfter: '60' }) });
    assert.deepEqual(await site.buylist('ExampleTrader'), { status: 'wait', retryMs: 60_000 });
    assert.equal((await site.buylist('Other')).status, 'wait');
    assert.equal(calls.length, 1);
    tick(61_000);
    await site.buylist('Other');
    assert.equal(calls.length, 2);
  });

  test('401 is refused; a broken answer is failed and not kept', async () => {
    assert.equal((await rig({ reply: () => ({ ok: false, status: 401, data: null }) }).site.buylist('me')).status, 'refused');
    const { site, calls } = rig({ reply: () => ({ ok: true, status: 200, data: { nope: true } }) });
    assert.equal((await site.buylist('me')).status, 'failed');
    await site.buylist('me');
    assert.equal(calls.length, 2);
  });
});
