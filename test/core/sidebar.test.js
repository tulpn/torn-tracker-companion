// The Torn Tracker sidebar block (CMP-108) on its own, with a stand-in for the site and
// timers the test turns by hand.

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { BLOCK_ID, READ_EVERY_MS, askedItems, mountSidebarBlock } from '../../src/core/sidebar.js';
import { readSidebar } from '../../src/core/site.js';
import { setProfitable } from '../../src/core/shops.js';
import { createRegistry } from '../../src/core/registry.js';
import { defaults } from '../../src/core/settings.js';
import * as dom from '../../src/core/dom.js';

const windows = [];
after(() => windows.forEach((w) => w.close()));
const settle = () => new Promise((resolve) => setImmediate(resolve));

const DESKTOP = `<div id="sidebar">
  <div class="sidebar-block___a"><div class="toggle-block___b"><h2 class="title___c">Areas</h2>
    <div class="areas___x1"><div><a href="/index.php">Home</a></div></div></div></div>
  <div class="sidebar-block___a" id="lists"><div class="toggle-block___b"><h2 class="title___c">Lists</h2><div>Friends</div></div></div>
</div>`;
const PDA = `<div class="areasWrapper"><div class="toggle-content___m"><div><a href="/index.php">Home</a></div></div></div>`;

const SOON = new Date(Date.UTC(2026, 9, 23, 12, 2, 31)).toISOString();
const FULL = {
  server_time: new Date(Date.UTC(2026, 9, 23, 12, 0, 0)).toISOString(),
  chain: { current: 412, max: 500, timeout_at: SOON, as_of: SOON },
  war: { opponent_name: 'Ares', our_score: 1200, their_score: 1000, target: 5000, finish_eta: null, as_of: SOON },
  terms: { label: 'TERMED: win · 50 hits each' },
  partner: { torn_id: 7, name: 'Medic' },
  dibs: [{ target_id: 9, target_name: 'Target', expires_at: SOON }],
  oc: { crime_id: 3, name: 'Blast from the Past', state: 'planning', ready_at: null, needs_me: true },
  guide: { done: 6, total: 9, bonuses_unclaimed: 1, faction_bonuses_used: 0 },
  links: [{ label: 'War room', url: 'https://www.torn-tracker.com/war/' }],
};

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
    setInterval: () => 0,
    clearInterval() {},
    /** Runs every timer that's waiting, once. */
    run() {
      const due = [...pending.entries()];
      pending.clear();
      for (const [, t] of due) t.fn();
    },
  };
}

function mount({ html = DESKTOP, answer = { status: 'ok', ...readSidebar(FULL, Object.keys(FULL), 0) }, change, open, watch = null, onWatch = null } = {}) {
  dom.resetObserver();
  const { window } = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, { url: 'https://www.torn.com/' });
  windows.push(window);
  const settings = defaults(createRegistry([]));
  change?.(settings);
  const asked = [];
  const site = {
    async sidebar(items) {
      asked.push(items);
      return typeof answer === 'function' ? answer(items) : answer;
    },
  };
  let clock = Date.UTC(2026, 9, 23, 12, 0, 0);
  const timers = fakeTimers();
  const saved = [];
  const block = mountSidebarBlock({
    doc: window.document,
    site,
    getSettings: () => settings,
    onMutation: dom.onMutation,
    store: { read: async () => (open === undefined ? null : { open }), write: async (v) => saved.push(v) },
    timers,
    now: () => clock,
    watch,
    onWatch,
  });
  const node = () => window.document.getElementById(BLOCK_ID);
  return {
    window, block, settings, asked, timers, saved, node,
    advance(ms) {
      clock += ms;
    },
    toggle() {
      node().querySelector('.ttc-sb-head').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    },
  };
}

describe('CMP-108 the block sits after Lists and looks like Torn’s', () => {
  test('on a desktop it follows Lists and starts open', async () => {
    const t = mount();
    await settle();
    assert.equal(t.node().previousElementSibling.id, 'lists');
    assert.equal(t.node().dataset.open, 'true');
    assert.match(t.node().textContent, /Chain 412 \/ 500/);
  });

  test('AC4: in PDA’s menu it starts closed, and asks nothing until opened', async () => {
    const t = mount({ html: PDA });
    await settle();
    assert.ok(t.node());
    assert.equal(t.node().dataset.open, 'false');
    assert.equal(t.asked.length, 0);
    t.toggle();
    await settle();
    assert.equal(t.asked.length, 1);
    assert.deepEqual(t.saved, [{ open: true }], 'the choice is remembered on this device');
  });
});

describe('CMP-108 AC1 the switches', () => {
  test('with the master switch off, there is no block and no read', async () => {
    const t = mount({ change: (s) => { s.sidebar.enabled = false; } });
    await settle();
    assert.equal(t.node(), null);
    assert.equal(t.asked.length, 0);
  });

  test('an item switched off is never asked for', async () => {
    const t = mount({ change: (s) => { s.sidebar.items.chain = false; } });
    await settle();
    assert.equal(t.asked[0].includes('chain'), false);
    assert.doesNotMatch(t.node().textContent, /Chain/);
  });

  test('the defaults ask for the spec’s nine on-items, quick links being local', () => {
    assert.deepEqual(askedItems(defaults(createRegistry([]))), ['chain', 'watch', 'war', 'terms', 'partner', 'dibs', 'oc', 'guide']);
  });
});

describe('CMP-108 AC2 how often it asks', () => {
  test('at most once a minute', async () => {
    const t = mount();
    await settle();
    assert.equal(t.asked.length, 1);
    t.advance(30_000);
    t.timers.run();
    await settle();
    assert.equal(t.asked.length, 1, 'not after 30 s');
    t.advance(READ_EVERY_MS);
    t.timers.run();
    await settle();
    assert.equal(t.asked.length, 2);
  });

  test('never while the tab is hidden or the block is closed', async () => {
    const t = mount();
    await settle();
    Object.defineProperty(t.window.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    t.advance(READ_EVERY_MS);
    t.timers.run();
    await settle();
    assert.equal(t.asked.length, 1, 'hidden tab');
    Object.defineProperty(t.window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
    t.toggle();
    t.advance(READ_EVERY_MS);
    t.timers.run();
    await settle();
    assert.equal(t.asked.length, 1, 'closed block');
  });

  test('a 429 waits as long as the site says', async () => {
    let calls = 0;
    const t = mount({ answer: () => (calls++ === 0 ? { status: 'wait', retryMs: 300_000 } : { status: 'ok', items: new Map(), links: [] }) });
    await settle();
    t.advance(READ_EVERY_MS * 2);
    t.timers.run();
    await settle();
    assert.equal(t.asked.length, 1);
    t.advance(300_000);
    t.timers.run();
    await settle();
    assert.equal(t.asked.length, 2);
  });
});

describe('CMP-108 AC3 links are plain navigation', () => {
  test('every link goes to a profile, an attack page or torn-tracker.com', async () => {
    const t = mount();
    await settle();
    const hrefs = [...t.node().querySelectorAll('a')].map((a) => a.getAttribute('href'));
    assert.ok(hrefs.includes('/profiles.php?XID=7'));
    assert.ok(hrefs.includes('/loader.php?sid=attack&user2ID=9'));
    assert.ok(hrefs.includes('https://www.torn-tracker.com/war/'));
    for (const href of hrefs) {
      assert.match(href, /^(\/profiles\.php\?XID=\d+|\/loader\.php\?sid=attack&user2ID=\d+|https:\/\/www\.torn-tracker\.com\/)/, href);
    }
  });
});

describe('CMP-108 AC5 nothing to say, nothing shown', () => {
  test('an empty item is absent, not "none"', async () => {
    const t = mount({ answer: { status: 'ok', ...readSidebar({ chain: FULL.chain, war: null, partner: null }, ['chain', 'war', 'partner'], 0) } });
    await settle();
    assert.doesNotMatch(t.node().textContent, /War|partner|none/i);
  });

  test('the block hides itself when every enabled item is empty', async () => {
    const t = mount({
      answer: { status: 'ok', items: new Map(), links: [] },
      change: (s) => { s.sidebar.items.links = false; },
    });
    await settle();
    assert.equal(t.node().hidden, true);
  });

  test('without a script key, or with a refused one, it asks for the key', async () => {
    for (const status of ['no_key', 'refused']) {
      const t = mount({ answer: { status } });
      await settle();
      assert.match(t.node().textContent, /Add your script key/);
      assert.equal(t.node().querySelector('a').getAttribute('href'), '/index.php#/torn-tracker/keys');
    }
  });

  test('until the site serves the read, each item says "no data"', async () => {
    const t = mount({ answer: { status: 'failed' } });
    await settle();
    assert.match(t.node().textContent, /Chain no data/);
  });
});

describe('CMP-109 the shop price count', () => {
  test('is local: never asked for, shown from this page whatever the read says, live', async () => {
    const t = mount({
      answer: { status: 'no_key' },
      change: (s) => { s.sidebar.items.links = false; },
    });
    await settle();
    assert.equal(t.asked.flat().includes('shops'), false);
    assert.doesNotMatch(t.node().textContent, /Shop price/);
    setProfitable(3);
    assert.match(t.node().textContent, /Shop price 3 listings below what a shop pays/);
    setProfitable(0);
    assert.doesNotMatch(t.node().textContent, /Shop price/);
    t.block.destroy();
  });

  test('switched off, it is not shown', async () => {
    const t = mount({ change: (s) => { s.sidebar.items.shops = false; } });
    await settle();
    setProfitable(1);
    assert.doesNotMatch(t.node().textContent, /Shop price/);
    setProfitable(0);
    t.block.destroy();
  });
});

describe('the sidebar read is checked field by field', () => {
  test('a field that does not fit makes its item null; items not asked for are left out', () => {
    const { items, links } = readSidebar({
      chain: { current: -1, max: 10 },
      partner: { torn_id: 7, name: 'x'.repeat(200) },
      oc: { crime_id: 3, name: 'OC', state: 'sleeping', needs_me: false },
      guide: FULL.guide,
      links: [{ label: 'Evil', url: 'https://evil.example/' }, ...FULL.links],
    }, ['chain', 'partner', 'oc', 'guide'], 0);
    assert.equal(items.get('chain'), null);
    assert.equal(items.get('partner'), null);
    assert.equal(items.get('oc'), null);
    assert.deepEqual(items.get('guide'), { done: 6, total: 9, bonuses: 1 });
    assert.equal(items.has('war'), false);
    assert.deepEqual(links, FULL.links, 'only links to torn-tracker.com');
  });

  test('loot needs its source, for the credit', () => {
    const npc = [{ npc_id: 4, name: 'Duke', level: 3, next_level_at: SOON }];
    assert.equal(readSidebar({ loot: npc }, ['loot']).items.get('loot'), null);
    assert.equal(readSidebar({ loot: npc, source: 'loot.example' }, ['loot']).items.get('loot').source, 'loot.example');
  });
});

describe('CHW-011, CHW-021 the watch line', () => {
  const NEXT = { now: null, next: { slot_start: '2026-10-24T03:00:00.000Z', role: 'lead' }, gaps_24h: 2 };
  function fakeWatch() {
    const listeners = new Set();
    const w = { on: false, isOn: () => w.on, toggle() { w.on = !w.on; listeners.forEach((fn) => fn()); }, onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
    return w;
  }

  test('the next slot, the gaps, and a switch that is only the player’s click', async () => {
    const watch = fakeWatch();
    const seen = [];
    const t = mount({ answer: { status: 'ok', ...readSidebar({ watch: NEXT }, ['watch'], 0) }, watch, onWatch: (item) => seen.push(item) });
    await settle();
    assert.match(t.node().textContent, /Watch Next watch 03:00 TCT · Lead · 2 without a Lead/);
    assert.equal(seen.length, 1, 'the slot notice hears of the next slot');
    const sw = t.node().querySelector('.ttc-sb-switch');
    assert.equal(sw.getAttribute('aria-pressed'), 'false');
    sw.dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
    assert.equal(watch.isOn(), true);
    assert.equal(t.node().querySelector('.ttc-sb-switch').getAttribute('aria-pressed'), 'true');
  });

  test('no slot: a way to sign up', async () => {
    const t = mount({ answer: { status: 'ok', ...readSidebar({ watch: { now: null, next: null, gaps_24h: 0 } }, ['watch'], 0) } });
    await settle();
    assert.match(t.node().textContent, /Sign up to watch/);
  });
});
