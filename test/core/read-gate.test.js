// hq #721: a 403 feed stops, a 429 pauses every read for its Retry-After, and the open
// tabs together stay under the site's budget. Two tabs are two gates (and two sites) on
// one store, which is what localStorage is to two Torn tabs.

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createCache } from '../../src/core/cache.js';
import {
  PAUSE_MAX_MS, READS_MAX, REFUSED_MS, SIDEBAR_EVERY_MS, createReadGate, memoryStore, readState,
} from '../../src/core/read-gate.js';
import { SIDEBAR_URL, SPACES, WAR_BRIEF_URL, createSite } from '../../src/core/site.js';

const KEY = 'tt_feed_abcdefghijklmnop';

/** A Torn tab: its own site and cache, sharing the gate's store with the other tabs. */
function tab(store, { clock, reply, calls }) {
  const gate = createReadGate({ now: clock, ...store });
  const site = createSite({
    getKey: () => KEY,
    send: async (url, opts) => {
      calls.push({ url, ...opts, at: clock() });
      return reply(url, opts);
    },
    cache: createCache(SPACES, { now: clock }),
    now: clock,
    gate,
  });
  return { gate, site };
}

function fakeLocalStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

afterEach(() => {
  delete globalThis.localStorage;
});

describe('hq #721 a 403 feed is not asked again', () => {
  test('the war brief answers 403 once; later pages and other tabs replay it without asking', async () => {
    let clock = 1_000_000;
    const store = memoryStore();
    const calls = [];
    const reply = () => ({ ok: false, status: 403, data: { error: 'no_faction', detail: 'no faction' } });
    const first = tab(store, { clock: () => clock, reply, calls });
    assert.equal(await first.site.warBrief(), null);
    assert.equal(calls.length, 1);

    // A new page in the same tab, then another tab, minutes apart, as in the log.
    for (const minutes of [8, 11, 17, 59]) {
      clock = 1_000_000 + minutes * 60_000;
      const next = tab(store, { clock: () => clock, reply, calls });
      assert.equal(await next.site.warBrief(), null);
    }
    assert.equal(calls.length, 1, 'one 403 per forbidden feed');

    clock = 1_000_000 + REFUSED_MS + 1;
    await tab(store, { clock: () => clock, reply, calls }).site.warBrief();
    assert.equal(calls.length, 2, 'after the hour it asks once more');
  });

  test('the kept 403 keeps its error code, so a Pro-only answer still reads as one', async () => {
    const clock = () => 5_000;
    const store = memoryStore();
    const calls = [];
    const reply = () => ({ ok: false, status: 403, data: { error: 'pro_required' } });
    assert.deepEqual((await tab(store, { clock, reply, calls }).site.warLoadouts())?.pro, false);
    assert.deepEqual((await tab(store, { clock, reply, calls }).site.warLoadouts())?.pro, false);
    assert.equal(calls.length, 1);
  });

  test('a refused key is not kept as a refused feed: it is about the key, and a new key clears it', async () => {
    const clock = () => 5_000;
    const store = memoryStore();
    const calls = [];
    const reply = () => ({ ok: false, status: 403, data: { detail: 'Key lacks the feeds scope' } });
    const { gate, site } = tab(store, { clock, reply, calls });
    await site.warBrief();
    assert.deepEqual(readState(await store.read('ttc_reads'), 5_000).refused, {});
    await gate.heard(WAR_BRIEF_URL, 'GET', { status: 403, data: { error: 'no_faction' } });
    await gate.reset();
    assert.deepEqual((await gate.admit(WAR_BRIEF_URL, 'GET')).go, true);
  });
});

describe('hq #721 a 429 pauses every read for its Retry-After', () => {
  test('one feed’s 429 holds back every feed, in every tab, for the header’s seconds', async () => {
    let clock = 0;
    const store = memoryStore();
    const calls = [];
    let busy = true;
    const reply = (url) => (busy && url.includes('/me/sidebar')
      ? { ok: false, status: 429, data: null, retryAfter: '90' }
      : { ok: true, status: 200, data: { chain: null } });
    const a = tab(store, { clock: () => clock, reply, calls });
    const b = tab(store, { clock: () => clock, reply, calls });

    assert.deepEqual(await a.site.sidebar(['chain']), { status: 'wait', retryMs: 90_000, paused: true });
    busy = false;
    clock = 30_000;
    assert.equal(await b.site.warBrief(), null, 'another feed, another tab: held back');
    const held = await b.site.sidebar(['chain']);
    assert.equal(held.status, 'wait');
    assert.equal(held.paused, true);
    assert.equal(held.retryMs, 60_000, 'what is left of the 90 s');
    assert.equal(calls.length, 1, 'nothing went out during the pause');
    assert.equal(await a.gate.pausedFor(), 60_000);

    clock = 90_000;
    assert.equal((await b.site.sidebar(['chain'])).status, 'ok');
    assert.equal(calls.length, 2);
  });

  test('a Retry-After past an hour, or none, is held to an hour, or a minute', async () => {
    const gate = createReadGate({ now: () => 0, ...memoryStore() });
    await gate.heard(SIDEBAR_URL, 'GET', { status: 429, retryAfter: '999999' });
    assert.equal(await gate.pausedFor(), PAUSE_MAX_MS);
    const other = createReadGate({ now: () => 0, ...memoryStore() });
    await other.heard(SIDEBAR_URL, 'GET', { status: 429, retryAfter: null });
    assert.equal(await other.pausedFor(), 60_000);
  });
});

describe('hq #721 two tabs stay under the budget', () => {
  test('two tabs polling the sidebar every 30 s for ten minutes read it about once a minute, never twice in 55 s', async () => {
    globalThis.localStorage = fakeLocalStorage();
    let clock = 0;
    const store = memoryStore();
    const calls = [];
    const reply = () => ({ ok: true, status: 200, data: { server_time: new Date(clock).toISOString(), chain: null } });
    const a = tab(store, { clock: () => clock, reply, calls });
    const b = tab(store, { clock: () => clock, reply, calls });
    await Promise.all([a.site.cache.load(), b.site.cache.load()]);

    const answers = [];
    for (clock = 0; clock < 10 * 60_000; clock += 15_000) {
      // Tab A at :00 and :30, tab B at :15 and :45: each every 30 s, out of step.
      const which = (clock / 15_000) % 2 === 0 ? a : b;
      answers.push(await which.site.sidebar(['chain']));
      await Promise.resolve();
    }
    assert.ok(calls.length <= 11, `${calls.length} sidebar reads in ten minutes`);
    for (let i = 1; i < calls.length; i += 1) {
      assert.ok(calls[i].at - calls[i - 1].at >= SIDEBAR_EVERY_MS, 'never two reads inside the window');
    }
    assert.ok(answers.every((x) => x.status === 'ok'), 'the tab that does not read draws the other’s answer');
  });

  test('every tab’s reads count against one minute’s budget', async () => {
    let clock = 0;
    const store = memoryStore();
    const tabs = [createReadGate({ now: () => clock, ...store }), createReadGate({ now: () => clock, ...store })];
    let went = 0;
    for (let i = 0; i < 80; i += 1) {
      if ((await tabs[i % 2].admit(`https://torn-tracker.com/api/feeds/x${i}`, 'GET')).go) went += 1;
    }
    assert.equal(went, READS_MAX);
    const held = await tabs[0].admit('https://torn-tracker.com/api/feeds/y', 'GET');
    assert.equal(held.why, 'budget');
    clock = 60_000;
    assert.equal((await tabs[1].admit('https://torn-tracker.com/api/feeds/y', 'GET')).go, true, 'a minute later it may again');
  });
});

describe('hq #721 the stored record is checked field by field', () => {
  test('odd fields are dropped, not trusted', () => {
    const now = 1_000_000;
    const state = readState({
      pausedUntil: now + PAUSE_MAX_MS + 5,
      refused: { '/elsewhere': { until: now + 1 }, '/api/feeds/war/brief': { until: now + 10, error: '<b>' }, '/api/feeds/oc': { until: 'x' } },
      reads: [now - 70_000, now - 5, 'x', now + 99_999],
      sidebar: { items: 'chain', tab: 'abc', at: 'soon' },
    }, now);
    assert.deepEqual(state, {
      pausedUntil: 0,
      refused: { '/api/feeds/war/brief': { until: now + 10, error: null } },
      reads: [now - 5],
      sidebar: null,
    });
    assert.deepEqual(readState('junk', now), { pausedUntil: 0, refused: {}, reads: [], sidebar: null });
  });
});
