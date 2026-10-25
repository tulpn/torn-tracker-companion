import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createCache } from '../../src/core/cache.js';
import {
  SIDEBAR_URL, TRAVEL_RUNS_URL, STOCK_SIGNALS_URL, APPLICANTS_URL, WAR_BRIEF_URL, AUCTION_VALUE_URL, CRIME_VALUE_URL, DEMAND_URL, DIBS_URL, FF_URL, MAX_IDS, ME_GYM_URL, ME_MUGS_URL, OC_URL, OPEN_LOADOUT_URL, PRICES_URL, SPACES,
  WAR_LOADOUTS_URL, createSite, siteUrl, validRoles,
} from '../../src/core/site.js';

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

function rig({ key = KEY, reply = () => ({ ok: true, status: 200, data: {} }), now = () => 0, clock, onBanned } = {}) {
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
    onBanned,
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

  test('a 403 for a scope the key lacks refuses it; any other 403 answers one read only', async () => {
    const scope = rig({ reply: () => ({ ok: false, status: 403, data: { detail: 'token lacks the feeds:read scope' } }) });
    await scope.site.ff([1]);
    assert.equal(scope.site.keyRefused(), true);
    for (const data of [{ error: 'not_director' }, { detail: 'no faction' }, { error: 'pro_required' }, null]) {
      const other = rig({ reply: () => ({ ok: false, status: 403, data }) });
      await other.site.ff([1]);
      assert.equal(other.site.keyRefused(), false, JSON.stringify(data));
    }
  });

  test('ADM-068 a banned account: reads stop and the script is told, with nothing more', async () => {
    let told = 0;
    const r = rig({ reply: () => ({ ok: false, status: 403, data: { error: 'account_banned' } }), onBanned: () => { told += 1; } });
    await r.site.ff([1]);
    assert.equal(r.site.keyRefused(), true);
    assert.equal(told, 1);
    await r.site.ff([2]);
    assert.equal(r.calls.length, 1, 'nothing more is asked with that key');
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
    for (const bad of [[], [{ position_id: 'P7', label: 'x', weight: 1 }], [{ position_id: 'P1', label: 7, weight: 1 }], [{ position_id: 'P1', label: 'x', weight: 120 }]]) {
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

describe('CMP-203 the demand feed (CAPI-013, accepted in hq #123)', () => {
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });

  test('kinds and the ids wanted, checked; kept for 60 s', async () => {
    let clock = 0;
    const r = rig({ clock: () => clock, reply: reply({ demand: { item_market_snapshot: [206, 367, -1, 'x'], 'Bad Kind': [1] } }) });
    const wanted = await r.site.demand();
    assert.equal(r.calls[0].url, DEMAND_URL);
    assert.deepEqual([...wanted.get('item_market_snapshot')], [206, 367]);
    assert.equal(wanted.has('Bad Kind'), false);
    clock = 59_000;
    await r.site.demand();
    assert.equal(r.calls.length, 1);
    clock = 60_000;
    await r.site.demand();
    assert.equal(r.calls.length, 2);
  });

  test('a failure or no key means nothing is wanted', async () => {
    assert.equal((await rig({ reply: reply(null, 503) }).site.demand()).size, 0);
    const r = rig({ key: '' });
    assert.equal((await r.site.demand()).size, 0);
    assert.equal(r.calls.length, 0);
  });
});

describe('CMP-205 value per nerve (CAPI-035, by the page typeID, hq #124)', () => {
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });
  const subcrimes = [
    { subcrime_id: 1, name: 'Search the Trash', nerve_cost: 2, value_per_nerve: 310.5, success_rate: 91, reporters: 40 },
    { subcrime_id: 2, name: 'Search the Junkyard', nerve_cost: 2, value_per_nerve: null, success_rate: null, reporters: 4 },
  ];

  test('asked by the page typeID, rows checked, kept for the hour', async () => {
    const r = rig({ reply: reply({ crime_id: 1, subcrimes }) });
    const rows = await r.site.crimeValue(1);
    assert.equal(r.calls[0].url, `${CRIME_VALUE_URL}?type_id=1`);
    assert.deepEqual(rows.map((x) => [x.name, x.value_per_nerve]), [['Search the Trash', 310.5], ['Search the Junkyard', null]]);
    await r.site.crimeValue(1);
    assert.equal(r.calls.length, 1);
  });

  test('unmapped, odd or failed: nothing, never a guess', async () => {
    assert.deepEqual(await rig({ reply: reply({ value_per_nerve: null, reason: 'unmapped' }) }).site.crimeValue(9), []);
    assert.deepEqual(await rig({ reply: reply({ subcrimes: [{ name: '', reporters: 1 }] }) }).site.crimeValue(9), []);
    assert.deepEqual(await rig({ reply: reply(null, 503) }).site.crimeValue(9), []);
    const r = rig();
    assert.deepEqual(await r.site.crimeValue(0), []);
    assert.equal(r.calls.length, 0);
  });
});

describe('LDT-032 the two loadout reads (shapes accepted in hq #142)', () => {
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });

  test('the war view: flags with their reasons, age and reporters; unknown flags dropped', async () => {
    const r = rig({ reply: reply({ war: { id: 1 }, opponents: [
      { player_id: 111, flags: ['heavy_hitter', 'sneaky', 'armoured'], reasons: { heavy_hitter: 'ArmaLite: damage 76.9' }, seen_at: '2026-10-21T10:00:00Z', reporters: 2, old: false, hidden: false },
      { player_id: 0, flags: [] },
    ] }) });
    const view = await r.site.warLoadouts();
    assert.equal(r.calls[0].url, WAR_LOADOUTS_URL);
    assert.equal(view.pro, true);
    assert.deepEqual(view.opponents.get(111).flags, [{ flag: 'heavy_hitter', reason: 'ArmaLite: damage 76.9' }, { flag: 'armoured', reason: null }]);
    assert.equal(view.opponents.size, 1);
    await r.site.warLoadouts();
    assert.equal(r.calls.length, 1, 'kept for a minute');
  });

  test('a Core faction: pro false, nothing else', async () => {
    const view = await rig({ reply: reply({ error: 'pro_required' }, 403) }).site.warLoadouts();
    assert.deepEqual(view, { pro: false, war: false, opponents: new Map() });
  });

  test('the open read is asked without any key', async () => {
    const r = rig({ reply: reply({ player_id: 111, hidden: false, seen_at: '2026-10-21T10:00:00Z', reporters: 2,
      slots: { primary: { item_id: 399, name: 'ArmaLite M-15A4', damage: 76.9, accuracy: 54.4, bonuses: [{ name: 'Penetrate', value: 25 }] }, boots: { item_id: 0, name: 'x' } },
      flags: ['heavy_hitter'], reasons: {} }) });
    const loadout = await r.site.playerLoadout(111);
    assert.equal(r.calls[0].url, `${OPEN_LOADOUT_URL}/111`);
    assert.equal(r.calls[0].headers.Authorization, undefined);
    assert.deepEqual(Object.keys(loadout.slots), ['primary']);
    assert.equal(loadout.reporters, 2);
  });

  test('never seen, hidden, another player in the answer, or a failure', async () => {
    assert.deepEqual(await rig({ reply: reply(null, 404) }).site.playerLoadout(5), { seen: false });
    assert.deepEqual(await rig({ reply: reply({ player_id: 5, hidden: true }) }).site.playerLoadout(5), { seen: true, hidden: true });
    assert.equal(await rig({ reply: reply({ player_id: 6, hidden: false, slots: {} }) }).site.playerLoadout(5), null);
    assert.equal(await rig({ reply: reply(null, 503) }).site.playerLoadout(5), null);
  });
});

describe('MUG-031 your own mugs of a player', () => {
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });

  test('count, last and average; kept ten minutes', async () => {
    let clock = Date.parse('2026-10-21T13:00:00Z');
    const r = rig({
      clock: () => clock,
      reply: reply({ count: 3, last_at: '2026-10-19T13:00:00Z', last_amount: 1200000, average: 900000.4, server_time: '2026-10-21T13:00:00Z' }),
    });
    const mugs = await r.site.myMugs(111);
    assert.equal(r.calls[0].url, `${ME_MUGS_URL}/111`);
    assert.deepEqual(mugs, { count: 3, last_at: Date.parse('2026-10-19T13:00:00Z'), last_amount: 1200000, average: 900000 });
    clock += 9 * 60_000;
    await r.site.myMugs(111);
    assert.equal(r.calls.length, 1);
  });

  test('none, odd values or a failure', async () => {
    assert.deepEqual(await rig({ reply: reply({ count: 0, last_at: null, last_amount: null, average: null }) }).site.myMugs(5),
      { count: 0, last_at: null, last_amount: null, average: null });
    assert.deepEqual(await rig({ reply: reply({ count: -2, last_at: 'soon', last_amount: -1, average: 'lots' }) }).site.myMugs(5),
      { count: 0, last_at: null, last_amount: null, average: null });
    assert.equal(await rig({ reply: reply(null, 503) }).site.myMugs(5), null);
  });
});

describe('AUC-020 auction values (CAPI-035, accepted in hq #199)', () => {
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });

  test('the page ids in one post; each row checked; unseen listings remembered too', async () => {
    const r = rig({ reply: reply({ values: [
      { listing_id: 1, estimate: 27400000, sales: 12, basis: 'auctions', deal: false },
      { listing_id: 2, estimate: null, sales: 3, basis: 'auctions', deal: false },
      { listing_id: 3, estimate: -5, sales: 1, basis: 'auctions', deal: false },
      { listing_id: 99, estimate: 1, sales: 1, basis: 'auctions', deal: false },
    ] }) });
    const found = await r.site.auctionValues([1, 2, 3, 4]);
    assert.equal(r.calls[0].url, AUCTION_VALUE_URL);
    assert.deepEqual(JSON.parse(r.calls[0].body), { listings: [1, 2, 3, 4] });
    assert.deepEqual([...found.keys()], [1, 2]);
    await r.site.auctionValues([1, 2, 3, 4]);
    assert.equal(r.calls.length, 1, 'answers and non-answers are kept ten minutes');
  });

  test('at most 50 per call; nothing without a key', async () => {
    const r = rig({ reply: reply({ values: [] }) });
    await r.site.auctionValues(Array.from({ length: 70 }, (_, i) => i + 1));
    assert.equal(JSON.parse(r.calls[0].body).listings.length, 50);
    const none = rig({ key: '' });
    assert.equal((await none.site.auctionValues([1])).size, 0);
    assert.equal(none.calls.length, 0);
  });
});

describe('JOB-072 applicant cards (accepted in hq #79)', () => {
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });

  test('board and ids in one post; each card checked; links only to our own site', async () => {
    const r = rig({ reply: reply({ cards: [
      { id: 1, merits: 10, job_points: 1234, fit: 'good', card_url: 'https://www.torn-tracker.com/jobs/c/1/' },
      { id: 2, merits: null, job_points: null, fit: null, card_url: 'https://evil.example/' },
      { id: 3, merits: 11, job_points: 1, fit: 'good' },
      { id: 4, merits: 1, job_points: 1, fit: 'great' },
      { id: 99, merits: 1, job_points: 1, fit: 'good' },
    ] }) });
    const { allowed, cards } = await r.site.applicantCards('company', [1, 2, 3, 4, 2]);
    assert.equal(r.calls[0].url, APPLICANTS_URL);
    assert.deepEqual(JSON.parse(r.calls[0].body), { board: 'company', ids: [1, 2, 3, 4] });
    assert.equal(allowed, true);
    assert.deepEqual([...cards.keys()], [1, 2]);
    assert.equal(cards.get(2).card_url, null);
  });

  test('not the director: allowed false; a bad board never leaves the script', async () => {
    assert.equal((await rig({ reply: reply({ error: 'not_director' }, 403) }).site.applicantCards('faction', [1])).allowed, false);
    const r = rig();
    await r.site.applicantCards('gang', [1]);
    assert.equal(r.calls.length, 0);
  });
});

describe('PRE-042 the pre-war strip read (accepted in hq #136)', () => {
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });

  test('Pro: compare, headline and a link to our own site only', async () => {
    const r = rig({ reply: reply({ war: { id: 1, opponent_faction_id: 678, starts_at: '…' }, compare: 'A line.', headline: 'Big.', brief_url: 'https://www.torn-tracker.com/war/1/', pro: true }) });
    assert.deepEqual(await r.site.warBrief(), { opponent: 678, compare: 'A line.', headline: 'Big.', briefUrl: 'https://www.torn-tracker.com/war/1/', pro: true });
    assert.equal(r.calls[0].url, WAR_BRIEF_URL);
    const odd = rig({ reply: reply({ war: { opponent_faction_id: 678 }, compare: 'x'.repeat(201), headline: 'Big.', brief_url: 'https://evil.example/', pro: false }) });
    assert.deepEqual(await odd.site.warBrief(), { opponent: 678, compare: null, headline: null, briefUrl: null, pro: false });
  });

  test('the bare host the site sends is moved to www', async () => {
    const r = rig({ reply: reply({ war: { opponent_faction_id: 678 }, brief_url: 'https://torn-tracker.com/war/prewar/', pro: false }) });
    assert.equal((await r.site.warBrief()).briefUrl, 'https://www.torn-tracker.com/war/prewar/');
    assert.equal(siteUrl('https://torn-tracker.com.evil.example/'), null);
    assert.equal(siteUrl('http://torn-tracker.com/x'), null);
  });

  test('no war, a failure or no key: nothing', async () => {
    assert.equal(await rig({ reply: reply({ war: null }) }).site.warBrief(), null);
    assert.equal(await rig({ reply: reply(null, 503) }).site.warBrief(), null);
    const r = rig({ key: '' });
    assert.equal(await r.site.warBrief(), null);
    assert.equal(r.calls.length, 0);
  });
});

describe('CMP-304 stock signals (companion-api section 6.4)', () => {
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });

  test('each row checked; kept five minutes', async () => {
    let clock = 0;
    const r = rig({ clock: () => clock, reply: reply({ signals: [
      { stock_id: 1, signal: 'below_avg', avg_30d: 820.5, price: 610.2 },
      { stock_id: 2, signal: null, avg_30d: null, price: 12 },
      { stock_id: 3, signal: 'buy', avg_30d: 1, price: 1 },
      { stock_id: 0, signal: null },
    ] }) });
    const signals = await r.site.stockSignals();
    assert.equal(r.calls[0].url, STOCK_SIGNALS_URL);
    assert.deepEqual([...signals.keys()], [1, 2]);
    assert.deepEqual(signals.get(1), { signal: 'below_avg', avg_30d: 820.5, price: 610.2 });
    clock = 4 * 60_000;
    await r.site.stockSignals();
    assert.equal(r.calls.length, 1);
    clock = 5 * 60_000;
    await r.site.stockSignals();
    assert.equal(r.calls.length, 2);
  });

  test('a failure or no key: nothing', async () => {
    assert.equal((await rig({ reply: reply(null, 503) }).site.stockSignals()).size, 0);
    const r = rig({ key: '' });
    assert.equal((await r.site.stockSignals()).size, 0);
    assert.equal(r.calls.length, 0);
  });
});

describe('TRV-050 your travel runs (accepted in hq #78)', () => {
  const reply = (data, status = 200) => () => ({ ok: status < 300, status, data });
  const good = { country: 'mexico', item_id: 258, item_name: 'Jaguar Plushie', quantity: 29, cash_needed: 290000, profit: 58000,
    profit_per_hour: 13500, hours: 4.3, lands_at: '2026-10-22T14:20:00Z', accuracy: '92% within 5 min', data_age_s: 240 };

  test('the runs, each checked; a multi-stop run keeps its stops; kept five minutes', async () => {
    let clock = 0;
    const r = rig({ clock: () => clock, reply: reply({ runs: [good, { ...good, country: 'cayman', stops: ['uk'] }, { ...good, country: 'MEX' }, { ...good, quantity: 0 }], basis: 'profit_per_hour' }) });
    const answer = await r.site.travelRuns(3);
    assert.equal(r.calls[0].url, `${TRAVEL_RUNS_URL}?limit=3`);
    assert.deepEqual(answer.runs.map((x) => [x.country, x.stops]), [['mexico', null], ['cayman', ['uk']]]);
    clock = 4 * 60_000;
    await r.site.travelRuns(3);
    assert.equal(r.calls.length, 1);
  });

  test('no capacity yet, a failure, or no key', async () => {
    assert.deepEqual(await rig({ reply: reply({ runs: [], reason: 'no_capacity' }) }).site.travelRuns(), { runs: [], reason: 'no_capacity', basis: null });
    assert.equal(await rig({ reply: reply(null, 503) }).site.travelRuns(), null);
    const r = rig({ key: '' });
    assert.equal(await r.site.travelRuns(), null);
    assert.equal(r.calls.length, 0);
  });
});

describe('CMP-108 the sidebar read', () => {
  test('it asks only for the items switched on, in the contract’s order, with the script key', async () => {
    const { site, calls } = rig({ reply: () => ({ ok: true, status: 200, data: { chain: null } }) });
    const answer = await site.sidebar(['oc', 'chain', 'nonsense']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${SIDEBAR_URL}?items=chain,oc`);
    assert.equal(calls[0].headers.Authorization, `Bearer ${KEY}`);
    assert.equal(answer.status, 'ok');
    assert.equal(answer.items.get('chain'), null);
  });

  test('the last gym, and a dibs target the site has no name for yet', async () => {
    const data = {
      gym: { next_gym: null, percent: null, energy_to_next: null },
      dibs: [{ target_id: 5, target_name: '', expires_at: '2026-10-20T12:05:00Z' }],
    };
    const answer = await rig({ reply: () => ({ ok: true, status: 200, data }) }).site.sidebar(['gym', 'dibs']);
    assert.deepEqual(answer.items.get('gym'), { nextGym: null, percent: null, energy: null });
    assert.equal(answer.items.get('dibs')[0].name, '#5');
  });

  test('an OC role the site has no label for keeps the others', () => {
    assert.equal(validRoles([{ position_id: 'P1', label: '', weight: null }, { position_id: 'P2', label: 'Hacker', weight: 40 }]), true);
  });

  test('no key asks nothing; a refusal, a 429 and a failure each say what happened', async () => {
    assert.equal((await rig({ key: '' }).site.sidebar(['chain'])).status, 'no_key');
    assert.equal((await rig({ reply: () => ({ ok: false, status: 401, data: null }) }).site.sidebar(['chain'])).status, 'refused');
    assert.deepEqual(await rig({ reply: () => ({ ok: false, status: 429, data: null, retryAfter: '120' }) }).site.sidebar(['chain']),
      { status: 'wait', retryMs: 120_000 });
    assert.equal((await rig({ reply: () => ({ ok: false, status: 404, data: null }) }).site.sidebar(['chain'])).status, 'failed');
  });
});
