import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createCache } from '../../src/core/cache.js';
import { DIBS_URL, FF_URL, MAX_IDS, ME_GYM_URL, OC_URL, PRICES_URL, SPACES, createSite } from '../../src/core/site.js';

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

function rig({ key = KEY, reply = () => ({ ok: true, status: 200, data: {} }), now = () => 0, clock } = {}) {
  const calls = [];
  let currentKey = key;
  const site = createSite({
    getKey: () => currentKey,
    send: async (url, opts) => {
      calls.push({ url, ...opts });
      return reply(url, opts);
    },
    cache: createCache(SPACES, { now }),
    now: clock,
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

  test('an estimate above 10 is kept: the contract has no upper bound (hq #97)', async () => {
    const r = rig({ reply: ffReply([{ id: 1, ff: 14.2, band: null }, { id: 2, ff: Infinity, band: null }]) });
    const found = await r.site.ff([1, 2]);
    assert.deepEqual(found.get(1), { ff: 14.2, band: null });
    assert.deepEqual(found.get(2), { ff: null, band: null });
  });

  test('a reply that does not fit is no answer: nothing cached, nothing invented', async () => {
    const r = rig({ reply: ffReply([{ id: 1, ff: 0.5 }, { id: 2, ff: '3' }, { id: 3, ff: 2, band: 'x'.repeat(41) }, { id: 4, ff: 2, band: null, extra: 'fine' }, { id: 5, ff: 2 }]) });
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

describe('CMP-102 dibs (CAPI-034, as proposed in hq #104)', () => {
  const T0 = Date.parse('2026-10-20T12:00:00Z');
  const row = (over = {}) => ({
    target_id: 111, holder: { torn_id: 222, name: 'Ares' }, expires_at: '2026-10-20T12:05:00Z', mine: false, ...over,
  });
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });

  test('reads the claims, turned to our clock by the reply\'s server_time', async () => {
    // Our clock is 10 s behind the site's.
    const r = rig({
      clock: () => T0 - 10_000,
      reply: reply({ war: { id: 1, opponent_faction_id: 2 }, dibs: [row()], server_time: '2026-10-20T12:00:00Z' }),
    });
    const answer = await r.site.dibs();
    assert.equal(r.calls[0].url, DIBS_URL);
    assert.equal(r.calls[0].method, 'GET');
    assert.equal(answer.war, true);
    assert.deepEqual(answer.dibs.get(111), {
      target: 111, holder: { id: 222, name: 'Ares' }, expiresAt: T0 + 300_000 - 10_000, mine: false,
    });
  });

  test('a claim that does not fit is dropped; the rest are kept', async () => {
    const bad = [row({ target_id: 0 }), row({ target_id: 2, holder: { torn_id: 3, name: '' } }),
      row({ target_id: 4, expires_at: 'soon' }), row({ target_id: 5, mine: 'yes' }), row({ target_id: 6, extra: 1 })];
    const r = rig({ reply: reply({ war: {}, dibs: bad }) });
    assert.deepEqual([...(await r.site.dibs()).dibs.keys()], [6]);
  });

  test('no ranked war is an answer; an odd reply or a failure is none', async () => {
    assert.deepEqual(await rig({ reply: reply({ war: null, dibs: [row()] }) }).site.dibs(), { war: false, dibs: new Map(), roster: new Map() });
    assert.equal(await rig({ reply: reply({ dibs: [] }) }).site.dibs(), null);
    assert.equal(await rig({ reply: reply(null, 503) }).site.dibs(), null);
    const r = rig({ key: '' });
    assert.equal(await r.site.dibs(), null);
    assert.equal(r.calls.length, 0, 'no key, no call');
  });

  test('a claim posts the action for that one target', async () => {
    const r = rig({ clock: () => T0, reply: reply({ target_id: 111, dibs: row({ mine: true }), server_time: '2026-10-20T12:00:00Z' }) });
    const result = await r.site.callDibs(111, 'claim');
    assert.equal(r.calls[0].url, `${DIBS_URL}/111`);
    assert.equal(r.calls[0].method, 'POST');
    assert.deepEqual(JSON.parse(r.calls[0].body), { action: 'claim' });
    assert.equal(result.ok, true);
    assert.equal(result.dibs.mine, true);
  });

  test('a release answers null dibs', async () => {
    const r = rig({ reply: reply({ target_id: 111, dibs: null }) });
    assert.deepEqual(await r.site.callDibs(111, 'release'), { ok: true, dibs: null, error: null });
  });

  test('taken comes back with the holder; other refusals are named, never thrown', async () => {
    const taken = await rig({ reply: reply({ error: 'dibs_taken', dibs: row() }, 409) }).site.callDibs(111, 'claim');
    assert.equal(taken.error, 'dibs_taken');
    assert.equal(taken.dibs.holder.name, 'Ares');
    assert.equal((await rig({ reply: reply({ error: 'no_war' }, 404) }).site.callDibs(1, 'claim')).error, 'no_war');
    assert.equal((await rig({ reply: reply({ error: 'whatever' }, 429) }).site.callDibs(1, 'claim')).error, 'busy');
    assert.equal((await rig({ reply: reply(null, 500) }).site.callDibs(1, 'claim')).error, 'failed');
  });

  test('a bad target or action never leaves the script', async () => {
    const r = rig();
    assert.equal((await r.site.callDibs(-1, 'claim')).error, 'invalid');
    assert.equal((await r.site.callDibs(1, 'steal')).error, 'invalid');
    assert.equal(r.calls.length, 0);
  });

  test('the roster: the status of each opponent, until turned to our clock; odd rows dropped', async () => {
    const until = Math.floor(T0 / 1000) + 245;
    const roster = [
      { id: 111, status: { state: 'Hospital', until, description: 'In hospital for 4 mins' } },
      { id: 112, status: { state: 'Traveling', until: 0, description: 'Traveling to Mexico' } },
      { id: 113, status: { state: 'Okay', until: null, description: 'Okay' } },
      { id: 0, status: { state: 'Okay', until: null, description: '' } },
      { id: 114, status: { state: 'Hospital', until: 'soon', description: '' } },
      { id: 115, status: { state: 'x'.repeat(21), until: null, description: '' } },
      { id: 116 },
    ];
    const r = rig({ clock: () => T0 - 10_000, reply: reply({ war: {}, dibs: [], roster, server_time: '2026-10-20T12:00:00Z' }) });
    const answer = await r.site.dibs();
    assert.deepEqual([...answer.roster.keys()], [111, 112, 113]);
    assert.deepEqual(answer.roster.get(111), { id: 111, state: 'Hospital', until: until * 1000 - 10_000, description: 'In hospital for 4 mins' });
    assert.equal(answer.roster.get(112).until, null);
  });

  test('a refused key stops dibs too', async () => {
    const r = rig({ reply: reply(null, 401) });
    await r.site.dibs();
    assert.equal(await r.site.dibs(), null);
    assert.equal(r.calls.length, 1);
  });
});

describe('CMP-204 an OC read (CAPI-035, as accepted in hq #110)', () => {
  const roles = [
    { position_id: 'P1', label: 'Picklock #1', weight: 34.5 },
    { position_id: 'P2', label: 'Hacker', weight: null },
  ];
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });

  test('one call per name, the name encoded; roles and estimates checked field by field', async () => {
    const r = rig({ reply: reply({ oc_name: 'Blast from the Past', roles, crimes: [{ crime_id: 9, success: 72.5 }, { crime_id: 10, success: null }, { crime_id: 0, success: 1 }, { crime_id: 11, success: 101 }] }) });
    const answer = await r.site.oc('Blast from the Past');
    assert.equal(r.calls[0].url, `${OC_URL}/Blast%20from%20the%20Past`);
    assert.deepEqual(answer.roles, roles);
    assert.deepEqual([...answer.crimes], [[9, 72.5], [10, null]]);
    assert.equal(answer.weightsSource, 'tornprobability.com', 'D-074, when the reply does not say');
    const named = rig({ reply: reply({ roles, crimes: [], weights_source: 'example.org' }) });
    assert.equal((await named.site.oc('X')).weightsSource, 'example.org');
    const odd = rig({ reply: reply({ roles, crimes: [], weights_source: '<b>x</b>' }) });
    assert.equal((await odd.site.oc('X')).weightsSource, 'tornprobability.com');
  });

  test('roles are kept for the hour; estimates are asked for afresh', async () => {
    let clock = 0;
    const r = rig({ now: () => clock, reply: reply({ roles, crimes: [] }) });
    await r.site.oc('Stage Fright');
    assert.deepEqual((await r.site.oc('Stage Fright', { crimes: false })).roles, roles);
    assert.equal(r.calls.length, 1, 'roles alone come from the cache');
    await r.site.oc('Stage Fright');
    assert.equal(r.calls.length, 2, 'estimates always ask');
    clock = 60 * 60_000;
    await r.site.oc('Stage Fright', { crimes: false });
    assert.equal(r.calls.length, 3, 'after the hour, roles are asked for again');
  });

  test('roles that do not fit are no roles; a failure falls back to the cached ones', async () => {
    for (const bad of [[], [{ position_id: 'P7', label: 'x', weight: 1 }], [{ position_id: 'P1', label: '', weight: 1 }], [{ position_id: 'P1', label: 'x', weight: 120 }]]) {
      assert.equal((await rig({ reply: reply({ roles: bad, crimes: [] }) }).site.oc('X')).roles, null);
    }
    let fail = false;
    const r = rig({ reply: () => (fail ? { ok: false, status: 503, data: null } : { ok: true, status: 200, data: { roles, crimes: [] } }) });
    await r.site.oc('X');
    fail = true;
    assert.deepEqual((await r.site.oc('X')).roles, roles);
  });

  test('a bad name or no key: no call', async () => {
    const r = rig({ key: '' });
    await r.site.oc('X');
    await rig().site.oc('');
    assert.equal(r.calls.length, 0);
  });
});

describe('CMP-206 the own gym read (CAPI-035, D-073)', () => {
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });

  test('the gym in progress, its percent and the estimate, each checked', async () => {
    const r = rig({ reply: reply({ gym_id: 2, percent: 62, next_gym_energy_estimate: 190, energy_by_gym: [] }) });
    assert.deepEqual(await r.site.meGym(), { gym_id: 2, percent: 62, next_gym_energy_estimate: 190 });
    assert.equal(r.calls[0].url, ME_GYM_URL);
    const odd = rig({ reply: reply({ gym_id: 2, percent: 140, next_gym_energy_estimate: -5 }) });
    assert.deepEqual(await odd.site.meGym(), { gym_id: 2, percent: null, next_gym_energy_estimate: null });
  });

  test('no gym, a failure or no key: nothing', async () => {
    assert.equal(await rig({ reply: reply({}) }).site.meGym(), null);
    assert.equal(await rig({ reply: reply(null, 503) }).site.meGym(), null);
    const r = rig({ key: '' });
    assert.equal(await r.site.meGym(), null);
    assert.equal(r.calls.length, 0);
  });
});
