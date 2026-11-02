// The after-sale mug read (TRU-022, TRU-023; the companion read accepted on hq #368).

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createCache } from '../../src/core/cache.js';
import { SPACES, TRUST_MUGGERS_URL, createSite } from '../../src/core/site.js';

const KEY = `tt_feed_${'E'.repeat(43)}`;
const SAFETY = 'https://torn-tracker.com/trust/safety/';
const LISTED = { id: 1, listed: true, mugs_30d: 3, mugs_90d: 5, last_reported_at: '2026-10-20T12:00:00Z' };

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

function rig({ key = KEY, reply, now = () => 0, clock = () => Date.parse('2026-10-25T00:00:00Z') } = {}) {
  const calls = [];
  const site = createSite({
    getKey: () => key,
    send: async (url, opts) => {
      calls.push({ url, ...opts });
      return reply(url, opts);
    },
    cache: createCache(SPACES, { now }),
    now: clock,
  });
  return { site, calls };
}

const trustReply = (rows, extra = {}) => () => ({ ok: true, status: 200, data: { results: rows, safety_url: SAFETY, ...extra } });

describe('TRU-023 the after-sale mug read: listed players only, kept 10 minutes', () => {
  test('one POST to our host with the script key; the unlisted are not listed, never guessed', async () => {
    const r = rig({ reply: trustReply([LISTED]) });
    const { players, safetyUrl } = await r.site.muggers([1, 2, 2]);
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].url, TRUST_MUGGERS_URL);
    assert.equal(r.calls[0].method, 'POST');
    assert.deepEqual(JSON.parse(r.calls[0].body), { ids: [1, 2] });
    assert.equal(r.calls[0].headers.Authorization, `Bearer ${KEY}`);
    assert.deepEqual(players.get(1), { listed: true, mugs30: 3, mugs90: 5, lastAt: Date.parse('2026-10-20T12:00:00Z') });
    assert.deepEqual(players.get(2), { listed: false });
    assert.equal(safetyUrl, SAFETY);
  });

  test('a second look inside 10 minutes asks nothing and keeps the safety link', async () => {
    let clock = 0;
    const r = rig({ reply: trustReply([LISTED]), now: () => clock });
    await r.site.muggers([1, 2]);
    clock = 9 * 60_000;
    const again = await r.site.muggers([1, 2]);
    assert.equal(r.calls.length, 1);
    assert.equal(again.players.get(1).listed, true);
    assert.equal(again.safetyUrl, SAFETY);
    clock = 10 * 60_000;
    await r.site.muggers([1]);
    assert.equal(r.calls.length, 2);
  });

  test('a row that does not fit, or one we did not ask about, lists nobody', async () => {
    const r = rig({
      reply: trustReply([
        { ...LISTED, id: 1, mugs_30d: '3' },
        { ...LISTED, id: 2, mugs_30d: 0, mugs_90d: 0 },
        { ...LISTED, id: 3, listed: 'yes' },
        { ...LISTED, id: 4, last_reported_at: null, reporter: 'never read' },
        { ...LISTED, id: 9 },
      ]),
    });
    const { players } = await r.site.muggers([1, 2, 3, 4]);
    for (const id of [1, 2, 3]) assert.deepEqual(players.get(id), { listed: false }, `id ${id}`);
    assert.deepEqual(players.get(4), { listed: true, mugs30: 3, mugs90: 5, lastAt: null });
    assert.equal(players.has(9), false);
  });

  test('a safety link off our host is dropped', async () => {
    const r = rig({ reply: trustReply([LISTED], { safety_url: 'https://elsewhere.example/' }) });
    assert.equal((await r.site.muggers([1])).safetyUrl, null);
  });

  test('a path or the bare host becomes a link on www', async () => {
    const path = rig({ reply: trustReply([LISTED], { safety_url: '/trust/safety/' }) });
    assert.equal((await path.site.muggers([1])).safetyUrl, SAFETY);
    const bare = rig({ reply: trustReply([LISTED], { safety_url: 'https://torn-tracker.com/trust/safety/' }) });
    assert.equal((await bare.site.muggers([1])).safetyUrl, SAFETY);
  });

  test('until the site serves the read, nobody is listed and the read rests 10 minutes (hq #368)', async () => {
    let t = Date.parse('2026-10-25T00:00:00Z');
    const r = rig({ reply: () => ({ ok: false, status: 404, data: null }), clock: () => t });
    assert.equal((await r.site.muggers([1])).players.size, 0);
    // A profile page changes many times a second; none of those changes asks again.
    for (let i = 0; i < 50; i += 1) await r.site.muggers([1]);
    assert.equal(r.calls.length, 1);
    t += 599_000;
    await r.site.muggers([1]);
    assert.equal(r.calls.length, 1);
    t += 2_000;
    await r.site.muggers([1]);
    assert.equal(r.calls.length, 2, 'asked again once the rest is over');
  });

  test('a 429 rests as long as Retry-After says, at most an hour; a failure a minute', async () => {
    let t = 0;
    let reply = { ok: false, status: 429, data: null, retryAfter: '120' };
    const r = rig({ reply: () => reply, clock: () => t });
    await r.site.muggers([1]);
    t += 119_000;
    await r.site.muggers([1]);
    assert.equal(r.calls.length, 1);
    t += 2_000;
    reply = { ok: false, status: 503, data: null };
    await r.site.muggers([1]);
    assert.equal(r.calls.length, 2);
    t += 59_000;
    await r.site.muggers([1]);
    assert.equal(r.calls.length, 2);
    t += 2_000;
    reply = { ok: false, status: 429, data: null, retryAfter: '99999' };
    await r.site.muggers([1]);
    t += 3_599_000;
    await r.site.muggers([1]);
    assert.equal(r.calls.length, 3);
    t += 2_000;
    await r.site.muggers([1]);
    assert.equal(r.calls.length, 4);
  });

  test('a refused answer that says nothing about the route does not rest it', async () => {
    let t = 0;
    const r = rig({ reply: () => ({ ok: false, status: 400, data: null }), clock: () => t });
    await r.site.muggers([1]);
    await r.site.muggers([1]);
    assert.equal(r.calls.length, 2);
  });

  test('without a script key nothing is asked', async () => {
    const r = rig({ key: '', reply: trustReply([]) });
    assert.equal((await r.site.muggers([1])).players.size, 0);
    assert.equal(r.calls.length, 0);
  });
});
