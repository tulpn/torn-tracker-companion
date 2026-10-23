// Achievements in the companion (hq #241, WP-UX-8): the read, the unlock toast, the
// featured ones in the settings header, and their switches.

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { READ_EVERY_MS, SHOW_MS, TOAST_ID, cleanState, createUnlocks } from '../../src/core/unlocks.js';
import { ACHIEVEMENTS_URL, createSite, readAchievements } from '../../src/core/site.js';
import { createCache } from '../../src/core/cache.js';
import { createRegistry } from '../../src/core/registry.js';
import { defaults, normalize } from '../../src/core/settings.js';
import { mountPanel } from '../../src/core/panel.js';
import { emptyKeys } from '../../src/core/keys.js';

const KEY = `tt_feed_${'U'.repeat(43)}`;
const windows = [];
after(() => windows.forEach((w) => w.close()));

const T0 = Date.UTC(2026, 9, 24, 12, 0, 0);
const iso = (ms) => new Date(ms).toISOString();
const NIGHT = { id: 'night-shift', name: 'Night shift', tier: null, points: 3, sentence: 'Hit during a war between 02:00 and 05:00 TCT.', earned_at: iso(T0), hidden: true };
const CHAINS = { id: 'chains', name: 'Chain tracker', tier: 'silver', points: 10, sentence: 'Tracked 25 chains.', earned_at: iso(T0) };

function fakeTimers() {
  let next = 1;
  const pending = new Map();
  return {
    pending,
    setTimeout(fn, ms) {
      const id = next++;
      pending.set(id, { fn, ms });
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    run() {
      const due = [...pending.values()];
      pending.clear();
      due.forEach((t) => t.fn());
    },
  };
}

const at = (url) => {
  const u = new URL(url);
  return { pathname: u.pathname, search: u.search, hash: u.hash };
};
const HOME = at('https://www.torn.com/index.php');

function rig({ replies = [], settings = defaults(createRegistry([])), stored = null } = {}) {
  const { window } = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.torn.com/' });
  windows.push(window);
  let clock = T0;
  const asked = [];
  const writes = [];
  const queue = [...replies];
  const site = {
    async achievements(since) {
      asked.push(since);
      const next = queue.shift() ?? { status: 'failed' };
      return typeof next === 'function' ? next(since) : next;
    },
  };
  const timers = fakeTimers();
  let current = settings;
  const unlocks = createUnlocks({
    doc: window.document,
    site,
    getSettings: () => current,
    store: { read: async () => stored, write: async (v) => { writes.push(v); return true; } },
    timers,
    now: () => clock,
  });
  return {
    window, unlocks, asked, writes, timers,
    tick: (ms) => { clock += ms; },
    set: (s) => { current = s; },
    toast: () => window.document.getElementById(TOAST_ID),
    visit: async (loc = HOME) => {
      unlocks.update(loc);
      await unlocks.settled();
    },
  };
}

const ok = (fields) => ({ status: 'ok', unlocked: [], featured: [], url: 'https://www.torn-tracker.com/me/achievements/', cursor: iso(T0), ...fields });

describe('WP-UX-8 the achievements read', () => {
  test('only what fits is kept, field by field', () => {
    const read = readAchievements({
      unlocked: [
        NIGHT,
        CHAINS,
        { ...CHAINS, id: 'Bad Id' },
        { ...CHAINS, tier: 'platinum' },
        { ...CHAINS, id: 'long', sentence: 'x'.repeat(161) },
        { ...CHAINS, id: 'noname', name: '' },
      ],
      featured: [{ id: 'chains', name: 'Chain tracker', tier: 'silver' }, { id: 'x', name: 'y', tier: 'tin' }, 'junk'],
      url: 'https://evil.example/me/',
      server_time: iso(T0),
    });
    assert.deepEqual(read.unlocked.map((a) => a.id), ['night-shift', 'chains', 'long']);
    assert.equal(read.unlocked[0].hidden, true);
    assert.equal(read.unlocked[1].tier, 'silver');
    assert.equal(read.unlocked[2].sentence, null, 'too long a sentence is dropped, not cut');
    assert.deepEqual(read.featured, [{ id: 'chains', name: 'Chain tracker', tier: 'silver' }]);
    assert.equal(read.url, 'https://www.torn-tracker.com/me/achievements/', 'a link off our site is replaced');
    assert.equal(read.cursor, iso(T0));
    assert.equal(readAchievements({ server_time: 'yesterday' }).cursor, null);
    assert.deepEqual(readAchievements(null).unlocked, []);
  });

  test('it asks our host with the script key and the last reply’s time; no key asks nothing', async () => {
    const calls = [];
    const site = createSite({
      getKey: () => KEY,
      send: async (url, opts) => {
        calls.push({ url, ...opts });
        return { ok: true, status: 200, data: { unlocked: [NIGHT], featured: [], server_time: iso(T0) } };
      },
      cache: createCache({}),
    });
    const first = await site.achievements(null);
    assert.equal(calls[0].url, ACHIEVEMENTS_URL);
    assert.equal(calls[0].headers.Authorization, `Bearer ${KEY}`);
    assert.equal(first.status, 'ok');
    await site.achievements('2026-10-24T12:00:00.000Z');
    assert.equal(calls[1].url, `${ACHIEVEMENTS_URL}?since=2026-10-24T12%3A00%3A00.000Z`);

    const none = createSite({ getKey: () => '', send: async () => assert.fail('no request without a key') });
    assert.equal((await none.achievements(null)).status, 'no_key');
    const slow = createSite({ getKey: () => KEY, send: async () => ({ ok: false, status: 429, data: null, retryAfter: '600' }) });
    assert.deepEqual(await slow.achievements(null), { status: 'wait', retryMs: 600_000 });
    const refused = createSite({ getKey: () => KEY, send: async () => ({ ok: false, status: 403, data: null }) });
    assert.equal((await refused.achievements(null)).status, 'refused');
  });
});

describe('WP-UX-8 the unlock toast', () => {
  test('the first read only marks where the next starts: an install shows no old unlocks', async () => {
    const r = rig({ replies: [ok({ unlocked: [readAchievements({ unlocked: [NIGHT] }).unlocked[0]] })] });
    await r.unlocks.load();
    await r.visit();
    assert.deepEqual(r.asked, [null]);
    assert.equal(r.toast(), null);
    assert.equal(r.writes.at(-1).cursor, iso(T0));
  });

  test('a new one shows on the page the player is on, with its tier, its sentence and a link to share it on the site', async () => {
    const unlocked = readAchievements({ unlocked: [CHAINS] }).unlocked;
    const r = rig({ stored: { cursor: iso(T0 - 1000), readAt: T0 - READ_EVERY_MS }, replies: [ok({ unlocked, cursor: iso(T0 + 5) })] });
    await r.unlocks.load();
    await r.visit();
    assert.deepEqual(r.asked, [iso(T0 - 1000)]);
    const toast = r.toast();
    assert.ok(toast);
    assert.equal(toast.getAttribute('role'), 'status');
    assert.match(toast.textContent, /Achievement unlocked.*Chain tracker.*Silver.*Tracked 25 chains\..*See it and share/s);
    const link = toast.querySelector('a');
    assert.equal(link.getAttribute('href'), 'https://www.torn-tracker.com/me/achievements/');
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(r.writes.at(-1).cursor, iso(T0 + 5), 'the next read starts at this reply');
  });

  test('several at once: the first, and how many more', async () => {
    const unlocked = readAchievements({ unlocked: [NIGHT, CHAINS] }).unlocked;
    const r = rig({ stored: { cursor: iso(T0 - 1000) }, replies: [ok({ unlocked })] });
    await r.unlocks.load();
    await r.visit();
    assert.match(r.toast().textContent, /Hidden achievement found.*Night shift.*See all 2.*and 1 more/s);
  });

  test('it goes by itself, waits while the pointer is on it, and closes with its button', async () => {
    const unlocked = readAchievements({ unlocked: [CHAINS] }).unlocked;
    const r = rig({ stored: { cursor: iso(T0 - 1000) }, replies: [ok({ unlocked }), ok({ unlocked })] });
    await r.unlocks.load();
    await r.visit();
    assert.equal([...r.timers.pending.values()][0].ms, SHOW_MS);
    r.toast().dispatchEvent(new r.window.MouseEvent('mouseenter'));
    assert.equal(r.timers.pending.size, 0);
    r.toast().dispatchEvent(new r.window.MouseEvent('mouseleave'));
    r.timers.run();
    assert.equal(r.toast(), null);
    r.tick(READ_EVERY_MS);
    await r.visit();
    r.toast().querySelector('button').dispatchEvent(new r.window.MouseEvent('click', { bubbles: true }));
    assert.equal(r.toast(), null);
  });

  test('at most one read every five minutes, never on the attack page or a hidden tab', async () => {
    const r = rig({ stored: { cursor: iso(T0 - 1000), readAt: T0 - 60_000 }, replies: [ok({}), ok({})] });
    await r.unlocks.load();
    await r.visit();
    assert.equal(r.asked.length, 0, 'a minute ago is too soon');
    r.tick(READ_EVERY_MS);
    await r.visit(at('https://www.torn.com/loader.php?sid=attack&user2ID=1'));
    assert.equal(r.asked.length, 0, 'not during an attack');
    Object.defineProperty(r.window.document, 'visibilityState', { value: 'hidden', configurable: true });
    await r.visit();
    assert.equal(r.asked.length, 0, 'not on a hidden tab');
    Object.defineProperty(r.window.document, 'visibilityState', { value: 'visible', configurable: true });
    await r.visit();
    await r.visit();
    assert.equal(r.asked.length, 1);
  });

  test('a 429 waits as long as the site says', async () => {
    const r = rig({ stored: { cursor: iso(T0) }, replies: [{ status: 'wait', retryMs: 20 * 60_000 }, ok({})] });
    await r.unlocks.load();
    await r.visit();
    r.tick(READ_EVERY_MS);
    await r.visit();
    assert.equal(r.asked.length, 1);
    r.tick(20 * 60_000);
    await r.visit();
    assert.equal(r.asked.length, 2);
  });

  test('with the toast off nothing shows, but the featured ones still come; with both off nothing is asked', async () => {
    const settings = defaults(createRegistry([]));
    settings.achievements.toast = false;
    const unlocked = readAchievements({ unlocked: [CHAINS] }).unlocked;
    const featured = [{ id: 'chains', name: 'Chain tracker', tier: 'silver' }];
    const r = rig({ settings, stored: { cursor: iso(T0 - 1000) }, replies: [ok({ unlocked, featured })] });
    await r.unlocks.load();
    let told = 0;
    r.unlocks.onChange(() => { told += 1; });
    await r.visit();
    assert.equal(r.toast(), null);
    assert.deepEqual(r.unlocks.featured(), featured);
    assert.equal(told, 1);
    r.set({ ...settings, achievements: { toast: false, featured: false } });
    assert.deepEqual(r.unlocks.featured(), []);
    r.tick(READ_EVERY_MS);
    await r.visit();
    assert.equal(r.asked.length, 1);
  });

  test('what’s stored is checked field by field, and "Forget me" clears it', async () => {
    assert.deepEqual(cleanState({ cursor: 'soon', readAt: T0 + 1, featured: [{ id: 'X Y', name: 'n', tier: null }, { id: 'ok', name: 'Fine', tier: 'gold' }] }, T0),
      { cursor: null, readAt: 0, featured: [{ id: 'ok', name: 'Fine', tier: 'gold' }] });
    assert.deepEqual(cleanState('junk'), { cursor: null, readAt: 0, featured: [] });
    const r = rig({ stored: { cursor: iso(T0), featured: [{ id: 'ok', name: 'Fine', tier: 'gold' }] } });
    await r.unlocks.load();
    assert.equal(r.unlocks.featured().length, 1);
    r.unlocks.reset();
    assert.deepEqual(r.unlocks.featured(), []);
  });
});

describe('WP-UX-8 the switches and the settings header', () => {
  test('both switches start on and survive a round trip; anything else falls back', () => {
    const registry = createRegistry([]);
    assert.deepEqual(defaults(registry).achievements, { toast: true, featured: true });
    assert.deepEqual(normalize({ achievements: { toast: false, featured: 'no', other: true } }, registry).achievements, { toast: false, featured: true });
    assert.deepEqual(normalize({ achievements: 'junk' }, registry).achievements, { toast: true, featured: true });
  });

  test('the header shows the featured ones; General has the two switches, saved like any other', async () => {
    const { window } = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.torn.com/' });
    windows.push(window);
    const registry = createRegistry([]);
    let current = defaults(registry);
    const saves = [];
    let featured = [{ id: 'chains', name: 'Chain tracker', tier: 'silver' }, { id: 'night-shift', name: 'Night shift', tier: null }];
    const listeners = new Set();
    const unlocks = { featured: () => featured, onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
    const panel = mountPanel({
      doc: window.document,
      registry,
      version: '9.9.9',
      getSettings: () => current,
      getKeys: () => emptyKeys(),
      onSave: async (s) => { saves.push(s); current = s; return true; },
      onReset: async () => {},
      onForget: async () => true,
      credits: [],
      unlocks,
    });
    panel.open('general');
    const chips = [...panel.panel.querySelectorAll('.ttc-featured li')].map((li) => li.textContent);
    assert.deepEqual(chips, ['Chain tracker · Silver', 'Night shift']);
    featured = [];
    listeners.forEach((fn) => fn());
    assert.equal(panel.panel.querySelectorAll('.ttc-featured li').length, 0);

    const toast = panel.panel.querySelector('[data-achievements=toast]');
    assert.equal(toast.checked, true);
    toast.checked = false;
    toast.dispatchEvent(new window.Event('change', { bubbles: true }));
    panel.panel.querySelector('[data-act=save]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(saves.at(-1).achievements, { toast: false, featured: true });
    panel.destroy();
  });
});
