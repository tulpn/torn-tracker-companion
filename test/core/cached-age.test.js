// hq #737: a sidebar answer the site served from its minute's cache (`X-Served-From: cache`,
// `Age`, tc-targets#802) is dated by its Age, so its age reads true and the next read falls
// due when the site has a fresh body. Reads stay at one a minute.

import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createCache } from '../../src/core/cache.js';
import { cachedAgeOf, request, resetBudget } from '../../src/core/net.js';
import { createReadGate, memoryStore } from '../../src/core/read-gate.js';
import { SPACES, createSite } from '../../src/core/site.js';

const SITE = 'https://torn-tracker.com/api/feeds/me/sidebar?items=chain';
const KEY = 'tt_feed_abcdefghijklmnop';

const headersOf = (map) => (name) => map[name] ?? null;

describe('hq #737 cachedAgeOf reads the two headers', () => {
  test('a cached body: its Age in seconds', () => {
    assert.equal(cachedAgeOf(headersOf({ 'x-served-from': 'cache', age: '40' })), 40);
    assert.equal(cachedAgeOf(headersOf({ 'x-served-from': ' Cache ', age: '0' })), 0);
  });

  test('a fresh body, or headers that do not fit: null', () => {
    for (const map of [
      {},
      { age: '40' },
      { 'x-served-from': 'origin', age: '40' },
      { 'x-served-from': 'cache' },
      { 'x-served-from': 'cache', age: '-1' },
      { 'x-served-from': 'cache', age: '4.5' },
      { 'x-served-from': 'cache', age: 'soon' },
      { 'x-served-from': 'cache', age: '3601' },
      { 'x-served-from': 'cache', age: '99999999999' },
    ]) assert.equal(cachedAgeOf(headersOf(map)), null, JSON.stringify(map));
  });
});

describe('hq #737 every transport hands the Age on', () => {
  beforeEach(() => {
    resetBudget();
    delete globalThis.PDA_httpGet;
    delete globalThis.GM_xmlhttpRequest;
    delete globalThis.GM;
  });

  test('the manager: out of the raw header block', async () => {
    globalThis.GM_xmlhttpRequest = (d) => d.onload({
      status: 200, responseText: '{}', responseHeaders: 'Content-Type: application/json\r\nX-Served-From: cache\r\nAge: 25\r\n',
    });
    assert.equal((await request(SITE)).cachedAge, 25);
    globalThis.GM_xmlhttpRequest = (d) => d.onload({ status: 200, responseText: '{}', responseHeaders: 'Age: 25\r\n' });
    assert.equal((await request(SITE)).cachedAge, null);
  });

  test('the page fetch: when the site exposes them', async () => {
    globalThis.fetch = async () => new Response('{}', { status: 200, headers: { 'X-Served-From': 'cache', Age: '12' } });
    assert.equal((await request(SITE)).cachedAge, 12);
    globalThis.fetch = async () => new Response('{}', { status: 200 });
    assert.equal((await request(SITE)).cachedAge, null);
  });

  test('Torn PDA: whatever case the headers come in', async () => {
    globalThis.PDA_httpGet = async () => ({ status: 200, responseText: '{}', headers: { 'X-SERVED-FROM': 'cache', AGE: '7' } });
    assert.equal((await request(SITE)).cachedAge, 7);
  });
});

describe('hq #737 the sidebar dates a cached answer by its Age', () => {
  function site(reply) {
    let clock = 1_000_000;
    const calls = [];
    const s = createSite({
      getKey: () => KEY,
      send: async (url) => {
        calls.push(clock);
        return reply();
      },
      cache: createCache(SPACES, { now: () => clock }),
      now: () => clock,
      gate: createReadGate({ now: () => clock, ...memoryStore() }),
    });
    return { s, calls, tick: (ms) => { clock += ms; }, now: () => clock };
  }

  test('Age 40: the answer is 40 s old, and the next read falls due 15 s later', async () => {
    const { s, calls, tick, now } = site(() => ({ ok: true, status: 200, data: { chain: null }, cachedAge: 40 }));
    const first = await s.sidebar(['chain']);
    assert.equal(first.status, 'ok');
    assert.equal(first.at, now() - 40_000);
    assert.equal(s.lastSidebar(['chain']).at, now() - 40_000, 'the kept copy too');
    tick(10_000);
    assert.equal((await s.sidebar(['chain'])).cached, true, 'still inside the 55 s');
    assert.equal(calls.length, 1);
  });

  test('a fresh body is dated now; an Age past the minute counts as one minute', async () => {
    let age = null;
    const { s, tick, now } = site(() => ({ ok: true, status: 200, data: { chain: null }, cachedAge: age }));
    assert.equal((await s.sidebar(['chain'])).at, now());
    tick(120_000);
    age = 3000;
    assert.equal((await s.sidebar(['chain'])).at, now() - 60_000);
  });

  test('a cache that is never dated ahead of now', () => {
    let clock = 5000;
    const cache = createCache(SPACES, { now: () => clock });
    const value = { data: {}, skew: 0, asked: [] };
    assert.ok(cache.set('sidebar', 'x', value, clock + 60_000));
    assert.equal(cache.peek('sidebar', 'x').at, clock);
    assert.ok(cache.set('sidebar', 'y', value, Number.NaN));
    assert.equal(cache.peek('sidebar', 'y').at, clock);
  });
});
