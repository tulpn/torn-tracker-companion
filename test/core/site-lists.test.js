// The target lists read and the add or remove call (CAPI-037, CMP-110; hq #391).

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createCache } from '../../src/core/cache.js';
import { LISTS_URL, SPACES, createSite, readLists } from '../../src/core/site.js';

const KEY = `tt_feed_${'L'.repeat(43)}`;
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const LISTS = {
  lists: [
    { uuid: A, name: 'Chain targets', shared: false, contains: true },
    { uuid: B, name: 'Faction hits', shared: true, contains: false },
  ],
  last_used: A,
  server_time: '2026-10-26T00:00:00Z',
};

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});
afterEach(() => {
  delete globalThis.localStorage;
});

function rig({ key = KEY, reply, now = () => 0 } = {}) {
  const calls = [];
  const site = createSite({
    getKey: () => key,
    send: async (url, opts) => {
      calls.push({ url, ...opts });
      return reply(url, opts);
    },
    cache: createCache(SPACES, { now }),
    now: () => Date.parse('2026-10-26T00:00:00Z'),
  });
  return { site, calls };
}

const ok = (data) => () => ({ ok: true, status: 200, data });
const refuse = (status, data = {}) => () => ({ ok: false, status, data });

describe('CMP-110 the lists read: one GET per player, kept 5 minutes', () => {
  test('one GET to our host with the script key and the player id', async () => {
    const r = rig({ reply: ok(LISTS) });
    const got = await r.site.lists(55);
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].url, `${LISTS_URL}?player=55`);
    assert.equal(r.calls[0].method, 'GET');
    assert.equal(r.calls[0].headers.Authorization, `Bearer ${KEY}`);
    assert.equal(got.status, 'ok');
    assert.deepEqual(got.lists.map((l) => l.name), ['Chain targets', 'Faction hits']);
    assert.equal(got.lastUsed, A);
  });

  test('a second look inside 5 minutes asks nothing; after 5 it asks again', async () => {
    let clock = 0;
    const r = rig({ reply: ok(LISTS), now: () => clock });
    await r.site.lists(55);
    clock = 4 * 60_000;
    assert.equal((await r.site.lists(55)).lists.length, 2);
    assert.equal(r.calls.length, 1);
    clock = 5 * 60_000;
    await r.site.lists(55);
    assert.equal(r.calls.length, 2);
  });

  test('each list is checked field by field; last_used must be one of them', () => {
    const got = readLists({
      lists: [
        { uuid: A, name: '  Chain targets ', shared: false, contains: true, owner: 'never read' },
        { uuid: 'not-a-uuid', name: 'Bad', shared: false, contains: false },
        { uuid: B, name: '', shared: false, contains: false },
        { uuid: B, name: 'x'.repeat(101), shared: false, contains: false },
        { uuid: B, name: 'Hits', shared: 'yes', contains: false },
        { uuid: A, name: 'Twice', shared: false, contains: false },
      ],
      last_used: B,
    });
    assert.deepEqual(got, { lists: [{ uuid: A, name: 'Chain targets', shared: false, contains: true }], lastUsed: null });
    assert.equal(readLists({ lists: 'no' }), null);
    assert.equal(readLists(null), null);
  });

  test('without a key, or a key without the lists scope, it is no_key and the other reads go on', async () => {
    const none = rig({ key: '', reply: ok(LISTS) });
    assert.equal((await none.site.lists(55)).status, 'no_key');
    assert.equal(none.calls.length, 0);

    const r = rig({ reply: (url) => (url.startsWith(LISTS_URL)
      ? { ok: false, status: 403, data: { detail: 'This key lacks the lists scope.' } }
      : { ok: true, status: 200, data: { results: [] } }) });
    assert.equal((await r.site.lists(55)).status, 'no_key');
    await r.site.muggers([55]);
    assert.equal(r.calls.length, 2, 'the mug read still asks');
  });

  test('a 429 is busy and a broken answer is failed; neither is cached', async () => {
    const busy = rig({ reply: refuse(429) });
    assert.equal((await busy.site.lists(55)).status, 'busy');
    const broken = rig({ reply: ok({ lists: 'nope' }) });
    assert.equal((await broken.site.lists(55)).status, 'failed');
    await broken.site.lists(55);
    assert.equal(broken.calls.length, 2);
  });
});

describe('CMP-110 AC1 one press is one POST', () => {
  test('add sends the player and the action to the list, and the menu is read again after', async () => {
    const r = rig({ reply: (url, opts) => (opts.method === 'GET' ? ok(LISTS)() : ok({ uuid: B, player_id: 55, state: 'on' })()) });
    await r.site.lists(55);
    const got = await r.site.listEntry(B, 55, 'add');
    assert.deepEqual(got, { ok: true, state: 'on', error: null });
    assert.equal(r.calls.length, 2);
    assert.equal(r.calls[1].url, `${LISTS_URL}/${B}/entries`);
    assert.equal(r.calls[1].method, 'POST');
    assert.deepEqual(JSON.parse(r.calls[1].body), { player_id: 55, action: 'add' });
    await r.site.lists(55);
    assert.equal(r.calls.length, 3, 'the change dropped the cached menu');
  });

  test('AC3: a 403 or a 404 is not_yours and drops the menu too', async () => {
    for (const status of [403, 404]) {
      const r = rig({ reply: (url, opts) => (opts.method === 'GET' ? ok(LISTS)() : refuse(status, { detail: 'Not allowed.' })()) });
      await r.site.lists(55);
      assert.deepEqual(await r.site.listEntry(A, 55, 'remove'), { ok: false, state: null, error: 'not_yours' });
      await r.site.lists(55);
      assert.equal(r.calls.length, 3);
    }
  });

  test('a scope-less key is no_key, a 429 busy; a bad request sends nothing', async () => {
    const scope = rig({ reply: refuse(403, { detail: 'This key lacks the lists scope.' }) });
    assert.equal((await scope.site.listEntry(A, 55, 'add')).error, 'no_key');
    const busy = rig({ reply: refuse(429) });
    assert.equal((await busy.site.listEntry(A, 55, 'add')).error, 'busy');
    const r = rig({ reply: ok({}) });
    assert.equal((await r.site.listEntry('nope', 55, 'add')).error, 'invalid');
    assert.equal((await r.site.listEntry(A, 0, 'add')).error, 'invalid');
    assert.equal((await r.site.listEntry(A, 55, 'toggle')).error, 'invalid');
    assert.equal(r.calls.length, 0);
  });
});
