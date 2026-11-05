// The Torn Tracker sidebar block (CMP-108) on its own, with a stand-in for the site and
// timers the test turns by hand.

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

import {
  BLOCK_ID, CRIMES_PAGE, DEFAULT_POSITION, WAR_PAGE, POSITIONS, READ_EVERY_MS, askedItems, mountSidebarBlock, placementOf, readLine,
} from '../../src/core/sidebar.js';
import { readRoutine, readSidebar, tornPath } from '../../src/core/site.js';
import { setProfitable } from '../../src/core/shops.js';
import { createRegistry } from '../../src/core/registry.js';
import { defaults } from '../../src/core/settings.js';
import * as dom from '../../src/core/dom.js';
import { setDebug } from '../../src/core/log.js';
import { ROOT } from '../helpers.js';

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
  links: [{ label: 'War room', url: 'https://torn-tracker.com/war/' }],
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
    intervals: new Map(),
    setInterval(fn, ms) {
      const id = next++;
      this.intervals.set(id, { fn, ms });
      return id;
    },
    clearInterval(id) {
      this.intervals.delete(id);
    },
    /** One beat of every interval, as the page's second would. */
    beat() {
      for (const t of this.intervals.values()) t.fn();
    },
    /** Runs every timer that's waiting, once. */
    run() {
      const due = [...pending.entries()];
      pending.clear();
      for (const [, t] of due) t.fn();
    },
  };
}

// The older tests below were written for the Lists place; the four places have their own
// describe (hq #507).
function mount({ position = 'lists', html = DESKTOP, answer = { status: 'ok', ...readSidebar(FULL, Object.keys(FULL), 0) }, change, open, watch = null, onWatch = null } = {}) {
  dom.resetObserver();
  const { window } = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, { url: 'https://www.torn.com/' });
  windows.push(window);
  const settings = defaults(createRegistry([]));
  settings.sidebar.position = position;
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

  test('the defaults ask for the spec’s on-items, quick links being local', () => {
    assert.deepEqual(askedItems(defaults(createRegistry([]))), ['chain', 'watch', 'war', 'terms', 'partner', 'dibs', 'oc', 'guide', 'routine']);
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

describe('hq #452 the rows survive Torn redrawing its sidebar', () => {
  /** Torn's SPA draws the sidebar again: every node is new, and ours is gone. */
  function redraw(t) {
    t.window.document.getElementById('sidebar').replaceWith(JSDOM.fragment(DESKTOP));
  }

  test('a re-place after a redraw shows the previous answer, without asking again', async () => {
    const t = mount();
    await settle();
    assert.match(t.node().textContent, /Chain 412 \/ 500/);
    for (let page = 0; page < 5; page += 1) {
      redraw(t);
      await settle();
      assert.equal(t.node(), null, 'the redraw took the block out');
      t.advance(10_000);
      t.timers.run();
      await settle();
      assert.equal(t.node()?.previousElementSibling.id, 'lists', `back after Lists, page ${page + 1}`);
      assert.match(t.node().textContent, /Chain 412 \/ 500/);
      assert.match(t.node().textContent, /My dibs/);
    }
    assert.equal(t.asked.length, 1, 'one read in the minute');
    t.advance(READ_EVERY_MS);
    t.timers.run();
    await settle();
    assert.equal(t.asked.length, 2, 'and the next once the minute has passed');
  });

  test('a redraw that only takes our block out still puts it back', async () => {
    const t = mount();
    await settle();
    t.node().remove();
    await settle();
    t.timers.run();
    await settle();
    assert.ok(t.node(), 'back');
    assert.match(t.node().textContent, /Chain 412 \/ 500/);
  });

  test('a copy a redraw left behind is removed: one block, the live one', async () => {
    const t = mount();
    await settle();
    const copy = t.node().cloneNode(true);
    t.window.document.getElementById('sidebar').append(copy);
    t.block.place();
    assert.equal(t.window.document.querySelectorAll(`#${BLOCK_ID}`).length, 1);
    assert.equal(t.node(), t.block.block);
  });

  test('a 429 or a failed read leaves the rows as they were', async () => {
    for (const next of [{ status: 'wait', retryMs: 120_000 }, { status: 'failed' }]) {
      let calls = 0;
      const ok = { status: 'ok', ...readSidebar(FULL, Object.keys(FULL), 0) };
      const t = mount({ answer: () => (calls++ === 0 ? ok : next) });
      await settle();
      const before = t.node().textContent;
      t.advance(READ_EVERY_MS);
      t.timers.run();
      await settle();
      assert.equal(t.asked.length, 2, next.status);
      // Every row is still there; only the countdowns moved on by the minute.
      assert.equal(t.node().textContent, before.replaceAll('2:31', '1:31'), `${next.status} keeps the rows`);
      assert.doesNotMatch(t.node().textContent, /no data/);
    }
  });
});

describe('hq #466 a page that never goes quiet', () => {
  test('a script that keeps changing the page does not keep the block from being placed and read', async () => {
    const t = mount({ html: '<div id="root"></div>' });
    await settle();
    assert.equal(t.node(), null, 'no sidebar yet, no block');
    const doc = t.window.document;
    doc.getElementById('root').append(JSDOM.fragment(DESKTOP));
    await settle();
    const deadline = [...t.timers.pending.entries()].find(([, x]) => x.ms === 1_000)?.[0];
    assert.ok(deadline, 'the first change starts the deadline');
    // Another script changes the page every few ms, as The Contract did fighting us.
    for (let i = 0; i < 30; i += 1) {
      doc.body.append(doc.createElement('span'));
      await settle();
      assert.ok(t.timers.pending.has(deadline), `change ${i + 1} does not put the deadline off`);
    }
    assert.equal(t.node(), null);
    t.timers.pending.get(deadline).fn();
    await settle();
    assert.equal(t.node()?.previousElementSibling.id, 'lists', 'placed by the deadline');
    assert.equal(t.asked.length, 1, 'and read once');
    assert.match(t.node().textContent, /Chain 412 \/ 500/);
  });
});

describe('CMP-108 AC3 links are plain navigation', () => {
  test('every link goes to a profile, an attack page, the faction’s war or crimes tab, or torn-tracker.com', async () => {
    const t = mount();
    await settle();
    const hrefs = [...t.node().querySelectorAll('a')].map((a) => a.getAttribute('href'));
    assert.ok(hrefs.includes('/profiles.php?XID=7'));
    assert.ok(hrefs.includes('/loader.php?sid=attack&user2ID=9'));
    assert.ok(hrefs.includes('https://torn-tracker.com/war/'));
    for (const href of hrefs) {
      assert.match(href, /^(\/profiles\.php\?XID=\d+|\/loader\.php\?sid=attack&user2ID=\d+|\/factions\.php\?step=your#\/(war\/rank|tab=crimes)$|https:\/\/torn-tracker\.com\/)/, href);
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

  test('hq #523: no slot, and a watch open: a way to sign up', async () => {
    const t = mount({ answer: { status: 'ok', ...readSidebar({ watch: { now: null, next: null, gaps_24h: 0, open: true } }, ['watch', 'war'], 0) } });
    await settle();
    assert.match(t.node().textContent, /Watch Sign up to watch/);
  });

  test('hq #523: no slot and no watch open: no Watch row at all', async () => {
    for (const watchItem of [{ now: null, next: null, gaps_24h: 48, open: false }, { now: null, next: null, gaps_24h: 48 }]) {
      const t = mount({ answer: { status: 'ok', ...readSidebar({ watch: watchItem, war: FULL.war }, ['watch', 'war'], 0) } });
      await settle();
      assert.match(t.node().textContent, /War vs/);
      assert.doesNotMatch(t.node().textContent, /Watch|Sign up/);
    }
  });

  test('hq #523: no watch open but watch mode on: the row stays, so it can be switched off', async () => {
    const watch = fakeWatch();
    watch.on = true;
    const t = mount({ answer: { status: 'ok', ...readSidebar({ watch: { now: null, next: null, gaps_24h: 0 } }, ['watch'], 0) }, watch });
    await settle();
    assert.equal(t.node().querySelector('.ttc-sb-switch').getAttribute('aria-pressed'), 'true');
  });
});

// hq #488: Torn's Home page, from the owner's capture of 2026-11-02 (scrubbed). On that
// capture the block was placed and read; the site sent every item but Watch empty.
describe('hq #488 on Torn’s Home page', () => {
  const HOME = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'pages', 'sidebar-home.html'), 'utf8');
  // The read as the site answered it on the capture: only Watch has something to say.
  const LIVE = {
    chain: null, war: null, terms: null, partner: null, dibs: null, oc: null, guide: null,
    travel: null, loot: null, gym: null, stocks: null,
    watch: { now: null, next: null, gaps_24h: 48 },
    links: [{ label: 'Dashboard', url: 'https://www.torn-tracker.com/dashboard/' }],
  };

  /** console.log while debug is on, for the lines the player would see. */
  async function logged(fn) {
    const seen = [];
    const original = console.log;
    console.log = (...args) => seen.push(args.map(String).join(' '));
    setDebug(true);
    try {
      await fn();
    } finally {
      setDebug(false);
      console.log = original;
    }
    return seen;
  }

  test('the block follows Targets, the last Lists entry, open, with its rows', async () => {
    const t = mount({ html: HOME });
    await settle();
    assert.equal(t.node().previousElementSibling.id, 'nav-targets_list');
    assert.equal(t.node().dataset.open, 'true');
    assert.equal(t.node().hidden, false);
    assert.match(t.node().textContent, /Chain 412 \/ 500/);
    assert.match(t.node().textContent, /War vs Ares/);
  });

  test('a sidebar Torn draws late is found within the settler’s second, and read once', async () => {
    const t = mount({ html: '<div id="mainContainer"></div>' });
    await settle();
    assert.equal(t.node(), null);
    t.window.document.body.insertAdjacentHTML('afterbegin', HOME);
    await settle();
    t.timers.run();
    await settle();
    assert.equal(t.node()?.previousElementSibling.id, 'nav-targets_list');
    assert.equal(t.asked.length, 1);
    assert.match(t.node().textContent, /Chain 412 \/ 500/);
  });

  test('the site’s answer on the capture: the links show without a Watch row (hq #523), and the console names what came back empty', async () => {
    let t;
    const seen = await logged(async () => {
      t = mount({ html: HOME, answer: { status: 'ok', ...readSidebar(LIVE, Object.keys(LIVE), 0) } });
      await settle();
    });
    assert.equal(t.node().hidden, false);
    assert.doesNotMatch(t.node().textContent, /Sign up to watch/, 'hq #523: no watch open, no sign-up row');
    assert.match(t.node().textContent, /Dashboard/);
    assert.ok(seen.some((l) => l.includes('sidebar: block placed after #nav-targets_list')), seen.join(' | '));
    assert.ok(seen.some((l) => /sidebar: read ok: watch to show; empty from the site: chain, war, .*oc/.test(l)), seen.join(' | '));
  });

  test('each reason the block is not placed is said once', async () => {
    const off = await logged(async () => {
      mount({ html: HOME, change: (s) => { s.sidebar.enabled = false; } });
      await settle();
    });
    assert.deepEqual(off.filter((l) => l.includes('not placed')).length, 1);
    assert.match(off.join(' | '), /block not placed: switched off in Settings/);
    const none = await logged(async () => {
      const t = mount({ html: '<div id="mainContainer"></div>' });
      t.block.place();
      t.block.place();
      await settle();
    });
    assert.equal(none.filter((l) => l.includes("not placed: no anchor (Torn's Areas not found yet)")).length, 1);
  });

  test('the read line: a failed or refused read says so; a full one names no empty item', () => {
    assert.equal(readLine(['chain'], { status: 'failed' }), 'sidebar: read failed');
    assert.equal(readLine(['chain'], { status: 'refused' }), 'sidebar: read refused');
    assert.equal(readLine(['chain'], { status: 'ok', items: new Map([['chain', { current: 3 }]]) }), 'sidebar: read ok: chain to show');
    assert.equal(readLine(['chain', 'war'], { status: 'ok', items: new Map() }), 'sidebar: read ok: nothing to show; empty from the site: chain, war');
  });
});

describe('hq #507 the block sits where the player chose', () => {
  const HOME = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'pages', 'sidebar-home.html'), 'utf8');
  const REAL = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'pages', 'sidebar-desktop.html'), 'utf8');
  // A page whose sidebar has Areas and another block, but no Lists.
  const NO_LISTS = `<div id="sidebar">
  <div class="sidebar-block___a"><div class="toggle-block___b"><h2 class="title___c">Areas</h2>
    <div class="areas___x1"><div><a href="/index.php">Home</a></div></div></div></div>
  <div class="sidebar-block___a" id="other"><div>Something else</div></div>
</div>`;
  const areasOf = (doc) => doc.querySelector('.areas___x1, [class*="areas___"]').closest('#sidebar > *, [class*="sidebar-block"]');

  test('four places, Top first and the default', () => {
    assert.deepEqual(POSITIONS, ['top', 'areas', 'lists', 'bottom']);
    assert.equal(DEFAULT_POSITION, 'top');
  });

  for (const [name, html, lastId] of [['the #466 capture', REAL, 'nav-targets_list'], ['the #488 Home capture', HOME, 'nav-targets_list'], ['a plain sidebar', DESKTOP, 'lists']]) {
    test(`on ${name}: each place puts the block where it says`, async () => {
      for (const position of POSITIONS) {
        const t = mount({ html, position });
        await settle();
        const block = t.node();
        assert.equal(block.dataset.position, position, position);
        const spot = placementOf(t.window.document, position);
        if (spot.before) assert.equal(block.nextElementSibling, spot.anchor, position);
        else assert.equal(block.previousElementSibling, spot.anchor, position);
        if (position === 'top') assert.match(block.nextElementSibling.textContent, /Home/, 'Areas follows the block');
        if (position === 'areas') assert.match(block.previousElementSibling.textContent, /Home/, 'the block follows Areas');
        if (position === 'lists') assert.equal(block.previousElementSibling.id, lastId);
        if (position === 'bottom') assert.equal(block.nextElementSibling, null, 'nothing of the sidebar comes after it');
        assert.equal(t.window.document.querySelectorAll(`#${BLOCK_ID}`).length, 1);
      }
    });
  }

  test('a saved change moves the block straight away, without a second copy', async () => {
    const t = mount({ position: 'top' });
    await settle();
    t.settings.sidebar.position = 'lists';
    t.block.update();
    assert.equal(t.node().previousElementSibling.id, 'lists');
    assert.equal(t.node().dataset.position, 'lists');
    assert.equal(t.window.document.querySelectorAll(`#${BLOCK_ID}`).length, 1);
  });

  test('a page without Lists shows a Lists choice at the next place down, and says so', async () => {
    const seen = [];
    const original = console.log;
    console.log = (...args) => seen.push(args.map(String).join(' '));
    setDebug(true);
    let t;
    try {
      t = mount({ html: NO_LISTS, position: 'lists' });
      await settle();
    } finally {
      setDebug(false);
      console.log = original;
    }
    assert.equal(t.node().dataset.position, 'bottom');
    assert.equal(t.node().previousElementSibling.id, 'other');
    assert.ok(seen.some((l) => l.includes('(bottom: this page has no place for lists)')), seen.join(' | '));
  });

  test('a position that is not one of the four counts as Top', () => {
    const { window } = new JSDOM(`<!doctype html><body>${DESKTOP}</body>`);
    windows.push(window);
    assert.equal(placementOf(window.document, 'middle').position, 'top');
    assert.equal(placementOf(window.document).position, 'top');
    assert.equal(placementOf(new JSDOM('<!doctype html><body></body>').window.document, 'top'), null);
    assert.ok(areasOf(window.document));
  });

  test('at 360 px, in PDA’s menu, the same choice holds', async () => {
    for (const position of POSITIONS) {
      const t = mount({ html: PDA, position });
      await settle();
      assert.ok(t.node(), position);
      assert.equal(t.node().dataset.open, 'false');
    }
  });
});

describe('hq #507 a line when the account has no faction linked', () => {
  const EMPTY = { chain: null, war: null, terms: null, partner: null, dibs: null, oc: null, guide: null, links: [] };
  const answerOf = (data) => ({ status: 'ok', ...readSidebar(data, Object.keys(data), 0) });
  const line = (t) => t.node().querySelector('[data-ttc-no-faction]');

  test('the site says no faction and the faction items are empty: one line, linking to the faction page', async () => {
    const t = mount({ answer: answerOf({ ...EMPTY, faction_linked: false }) });
    await settle();
    assert.ok(line(t));
    assert.equal(line(t).textContent, 'Link your faction on torn-tracker.com to see chain, war and dibs');
    const a = line(t).querySelector('a');
    assert.equal(a.getAttribute('href'), 'https://torn-tracker.com/faction/');
    assert.equal(t.node().hidden, false);
  });

  test('no line when the site says nothing, says linked, or a faction item has a value', async () => {
    for (const data of [EMPTY, { ...EMPTY, faction_linked: true }, { ...EMPTY, faction_linked: 'no' }, { ...FULL, faction_linked: false }]) {
      const t = mount({ answer: answerOf(data) });
      await settle();
      assert.equal(line(t), null, JSON.stringify(data.faction_linked));
    }
  });

  test('no line when no faction item is switched on', async () => {
    const t = mount({
      answer: answerOf({ ...EMPTY, faction_linked: false }),
      change: (s) => { for (const id of ['chain', 'war', 'dibs', 'loot']) s.sidebar.items[id] = false; },
    });
    await settle();
    assert.equal(line(t), null);
  });
});

// hq #541: the war and OC lines open Torn's own pages, and every time the site sent counts
// down from the page's clock between reads, with one ticker that rests while the tab is hidden.
describe('hq #541 links and live countdowns', () => {
  const HOME = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'pages', 'sidebar-home.html'), 'utf8');
  const T0 = Date.UTC(2026, 9, 23, 12, 0, 0);
  const at = (ms) => new Date(T0 + ms).toISOString();
  const LIVE = {
    server_time: at(0),
    chain: { current: 412, max: 500, timeout_at: at(150_000), as_of: at(0) },
    war: { opponent_name: 'Foes', our_score: 1200, their_score: 1000, target: 5000, finish_eta: at(3_729_000), as_of: at(0) },
    oc: { crime_id: 3, name: 'Blast from the Past', state: 'planning', ready_at: at(65_000), needs_me: false },
    dibs: null, terms: null, partner: null, guide: null, travel: null, loot: null, gym: null, stocks: null, watch: null,
    links: [],
  };
  const live = () => mount({ html: HOME, answer: { status: 'ok', ...readSidebar(LIVE, Object.keys(LIVE), 0) } });
  const line = (t, word) => [...t.node().querySelectorAll('.ttc-sb-row')].find((r) => r.querySelector('b')?.textContent === word);

  test('on the real Home sidebar the War and OC lines link to Torn’s own pages, same tab', async () => {
    const t = live();
    await settle();
    const war = line(t, 'War').querySelector('b a');
    const oc = line(t, 'OC').querySelector('b a');
    assert.equal(war.getAttribute('href'), WAR_PAGE);
    assert.equal(oc.getAttribute('href'), CRIMES_PAGE);
    assert.equal(WAR_PAGE, '/factions.php?step=your#/war/rank');
    assert.equal(CRIMES_PAGE, '/factions.php?step=your#/tab=crimes');
    for (const a of [war, oc]) {
      assert.equal(a.hasAttribute('target'), false, 'same tab');
      assert.equal(new URL(a.href).host, 'www.torn.com');
    }
  });

  test('each time ticks by the second from the page’s clock, without asking the site', async () => {
    const t = live();
    await settle();
    assert.match(line(t, 'Chain').textContent, /· 2:30$/);
    assert.match(line(t, 'War').textContent, /ends in ~1:02:09$/);
    assert.match(line(t, 'OC').textContent, /ready in 1:05$/);
    assert.equal(t.timers.intervals.size, 1, 'one shared ticker');
    t.advance(1_000);
    t.timers.beat();
    assert.match(line(t, 'Chain').textContent, /· 2:29$/);
    assert.match(line(t, 'War').textContent, /ends in ~1:02:08$/);
    assert.match(line(t, 'OC').textContent, /ready in 1:04$/);
    assert.equal(t.asked.length, 1);
  });

  test('past zero each line says what happened until the next read confirms it', async () => {
    const t = live();
    await settle();
    t.advance(65_000);
    t.timers.beat();
    assert.match(line(t, 'OC').textContent, /· ready$/);
    t.advance(85_000);
    t.timers.beat();
    assert.match(line(t, 'Chain').textContent, /· timed out$/);
    t.advance(3_729_000);
    t.timers.beat();
    assert.match(line(t, 'War').textContent, /· ending$/);
  });

  test('the ticker rests while the tab is hidden and catches up when it is seen again', async () => {
    const t = live();
    await settle();
    const doc = t.window.document;
    let state = 'hidden';
    Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => state });
    t.advance(10_000);
    t.timers.beat();
    assert.match(line(t, 'Chain').textContent, /· 2:30$/, 'not painted while hidden');
    state = 'visible';
    doc.dispatchEvent(new t.window.Event('visibilitychange'));
    assert.match(line(t, 'Chain').textContent, /· 2:20$/);
  });

  test('a member the crime needs sees that first, and the countdown after it', async () => {
    const t = mount({ html: HOME, answer: { status: 'ok', ...readSidebar({ ...LIVE, oc: { ...LIVE.oc, needs_me: true } }, Object.keys(LIVE), 0) } });
    await settle();
    assert.match(line(t, 'OC').textContent, /Blast from the Past · needs you · ready in 1:05$/);
  });

  test('destroy stops the ticker', async () => {
    const t = live();
    await settle();
    t.block.destroy();
    assert.equal(t.timers.intervals.size, 0);
  });
});

// CAPI-039 (hq #560, #541 follow-up): the war's id, state and start, and the OC's expiry,
// in the shapes of the site's demo replies (hq assets/backend/560/sidebar-replies.json).
describe('CAPI-039 war start and OC expiry', () => {
  const HOME = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'pages', 'sidebar-home.html'), 'utf8');
  const T0 = Date.UTC(2026, 9, 23, 12, 0, 0);
  const at = (ms) => new Date(T0 + ms).toISOString();
  const MATCHED = {
    server_time: at(0),
    war: {
      id: 9200001, state: 'matched', starts_at: at(5_025_000), opponent_name: 'Crimson Tide',
      our_score: 0, their_score: 0, target: 4000, finish_eta: null, as_of: at(0),
    },
    oc: { crime_id: 90000, name: 'Break the Bank', state: 'ready', ready_at: at(-60_000), expired_at: at(86_400_000), needs_me: false },
    links: [],
  };
  const KEYS = ['war', 'oc'];
  const show = (reply) => mount({ html: HOME, answer: { status: 'ok', ...readSidebar(reply, KEYS, 0) } });
  const line = (t, word) => [...t.node().querySelectorAll('.ttc-sb-row')].find((r) => r.querySelector('b')?.textContent === word);

  test('the readers keep the new fields, and null for what is missing or wrong', () => {
    const read = readSidebar(MATCHED, KEYS, 0).items;
    assert.deepEqual([read.get('war').id, read.get('war').state, read.get('war').startsAt], [9200001, 'matched', T0 + 5_025_000]);
    assert.equal(read.get('oc').expiredAt, T0 + 86_400_000);
    const odd = readSidebar({ ...MATCHED, war: { ...MATCHED.war, id: -1, state: 'over', starts_at: 'soon' }, oc: { ...MATCHED.oc, expired_at: 7 } }, KEYS, 0).items;
    assert.deepEqual([odd.get('war').id, odd.get('war').state, odd.get('war').startsAt], [null, null, null]);
    assert.equal(odd.get('oc').expiredAt, null);
    const old = readSidebar({ ...MATCHED, war: { opponent_name: 'Foes', our_score: 1, their_score: 2, target: 3, finish_eta: null } }, KEYS, 0).items;
    assert.deepEqual([old.get('war').id, old.get('war').state, old.get('war').startsAt], [null, null, null], 'an older site still reads');
  });

  test('a matched war counts down to its start, then says starting', async () => {
    const t = show(MATCHED);
    await settle();
    assert.match(line(t, 'War').textContent, /vs Crimson Tide: \+0 · 0 \/ 4,000 · starts in 1:23:45$/);
    assert.equal(line(t, 'War').querySelector('b a').getAttribute('href'), WAR_PAGE, 'a live war has no page by id');
    t.advance(5_025_000);
    t.timers.beat();
    assert.match(line(t, 'War').textContent, /· starting$/);
  });

  test('a running war counts to its finish, not to a start already past', async () => {
    const t = show({ ...MATCHED, war: { ...MATCHED.war, state: 'running', starts_at: at(-60_000), finish_eta: at(3_729_000) } });
    await settle();
    assert.match(line(t, 'War').textContent, /ends in ~1:02:09$/);
    assert.doesNotMatch(line(t, 'War').textContent, /start/);
  });

  test('a ready crime ignores its expiry', async () => {
    const t = show(MATCHED);
    await settle();
    assert.match(line(t, 'OC').textContent, /Break the Bank · ready$/);
  });

  test('an unstarted crime counts down to its expiry, then reads expired', async () => {
    const t = show({ ...MATCHED, oc: { ...MATCHED.oc, state: 'recruiting', ready_at: null, expired_at: at(65_000) } });
    await settle();
    assert.match(line(t, 'OC').textContent, /Break the Bank · expires in 1:05$/);
    t.advance(65_000);
    t.timers.beat();
    assert.match(line(t, 'OC').textContent, /· expired$/);
  });

  test('a planning crime already past its expiry reads expired, not ready in, even for a member it needs', async () => {
    const t = show({ ...MATCHED, oc: { ...MATCHED.oc, state: 'planning', ready_at: at(65_000), expired_at: at(-1_000), needs_me: true } });
    await settle();
    assert.match(line(t, 'OC').textContent, /Break the Bank · needs you · expired$/);
  });
});

describe('hq #599 RDB-081 the routine badge', () => {
  const T0 = Date.UTC(2026, 9, 23, 12, 0, 0);
  const at = (ms) => new Date(T0 + ms).toISOString();
  // The routine feed's shape as the bot's mock serves it (RDB-082).
  const line = (key, text, done, url, extra = {}) => ({ key, text, done, url, as_of: at(-12 * 60_000), casino: false, ...extra });
  const ROUTINE = {
    lines: [
      line('nerve_refill', 'Nerve refill unused', false, 'https://www.torn.com/points.php'),
      line('bank', 'No bank investment', false, '/bank.php'),
      line('drugs', 'Drug cooldown empty, xanax 2 of 3', true, 'https://www.torn.com/item.php', { as_of: at(-3 * 3_600_000) }),
      line('energy_refill', 'Energy refill used', true, 'https://www.torn.com/points.php'),
      line('casino', 'Casino tokens unused', false, 'https://www.torn.com/casino.php', { casino: true }),
    ],
    day_ends_at: at(12 * 3_600_000),
    casino_off: false,
    url: 'https://torn-tracker.com/me/routine/',
  };
  const EMPTY = { chain: null, watch: null, war: null, terms: null, partner: null, dibs: null, oc: null, guide: null };
  const withRoutine = (routine) => mount({ answer: { status: 'ok', ...readSidebar({ ...EMPTY, server_time: at(0), routine, links: [] }, ['routine'], 0) } });
  const routineRow = (t) => t.node().querySelector('.ttc-sb-routine')?.closest('.ttc-sb-row');

  test('the badge counts the undone lines, the same count the page shows (acceptance test 9)', async () => {
    const t = withRoutine(ROUTINE);
    await settle();
    const button = t.node().querySelector('.ttc-sb-routine');
    assert.equal(button.querySelector('.ttc-sb-badge').textContent, '3');
    assert.equal(readRoutine(ROUTINE).undone, ROUTINE.lines.filter((l) => !l.done).length);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.match(routineRow(t).textContent, /left today · resets in 12h$/);
    assert.equal(t.node().querySelector('.ttc-sb-list'), null, 'the list waits for a tap');
  });

  test('a tap shows the undone lines, each linking to its Torn page in the same tab', async () => {
    const t = withRoutine(ROUTINE);
    await settle();
    t.node().querySelector('.ttc-sb-routine').click();
    const items = [...t.node().querySelectorAll('.ttc-sb-list li')];
    const links = items.slice(0, 3).map((li) => li.querySelector('a'));
    assert.deepEqual(links.map((a) => a.textContent), ['Nerve refill unused', 'No bank investment', 'Casino tokens unused']);
    assert.deepEqual(links.map((a) => a.getAttribute('href')), ['/points.php', '/bank.php', '/casino.php']);
    for (const a of links) assert.equal(a.hasAttribute('target'), false, 'same tab');
    assert.match(items[3].textContent, /^2 done · the full list$/);
    assert.equal(t.node().querySelector('.ttc-sb-routine').getAttribute('aria-expanded'), 'true');
    assert.equal(t.asked.length, 1, 'a tap asks for nothing');
    t.node().querySelector('.ttc-sb-routine').click();
    assert.equal(t.node().querySelector('.ttc-sb-list'), null);
  });

  test('with Casino off there is never a casino line, whatever the site sent (RDB-045, D-211)', async () => {
    const t = withRoutine({ ...ROUTINE, casino_off: true });
    await settle();
    assert.equal(t.node().querySelector('.ttc-sb-badge').textContent, '2');
    t.node().querySelector('.ttc-sb-routine').click();
    assert.doesNotMatch(t.node().textContent, /casino/i);
  });

  test('a reading older than 90 minutes says its age (RDB-005)', async () => {
    const stale = { ...ROUTINE, lines: [line('bank', 'No bank investment', false, '/bank.php', { as_of: at(-2 * 3_600_000) })] };
    const t = withRoutine(stale);
    await settle();
    t.node().querySelector('.ttc-sb-routine').click();
    assert.match(t.node().querySelector('.ttc-sb-list li').textContent, /^No bank investment · 2h old$/);
  });

  test('all done says so; no key on the site links to where to add one', async () => {
    const done = withRoutine({ ...ROUTINE, lines: ROUTINE.lines.map((l) => ({ ...l, done: true })) });
    await settle();
    assert.equal(done.node().querySelector('.ttc-sb-badge'), null);
    assert.ok([...done.node().querySelectorAll('.ttc-sb-row')].some((r) => /^Routine all 5 done today$/.test(r.textContent)));
    const keyless = withRoutine({ key_needed: true, casino_off: false, url: 'https://torn-tracker.com/me/routine/' });
    await settle();
    const a = [...keyless.node().querySelectorAll('.ttc-sb-row a')].find((x) => /API key/.test(x.textContent));
    assert.equal(a.getAttribute('href'), 'https://torn-tracker.com/me/routine/');
  });

  test('the feed is read line by line: a line that does not fit is dropped, never another host', () => {
    assert.equal(tornPath('https://www.torn.com/loader.php?sid=missions'), '/loader.php?sid=missions');
    assert.equal(tornPath('https://evil.example/bank.php'), null);
    assert.equal(tornPath('//evil.example/x'), null);
    assert.equal(tornPath('javascript:alert(1)'), null);
    const r = readRoutine({
      lines: [
        line('bank', 'No bank investment', false, 'https://evil.example/bank.php'),
        line('Bad Key', 'x', false, '/bank.php'),
        line('missions', '', false, '/loader.php?sid=missions'),
        line('nerve', 'Nerve refill unused', 'no', '/points.php'),
        line('ok', 'Kept', false, '/points.php'),
      ],
      url: 'https://evil.example/',
    });
    assert.deepEqual(r.lines.map((l) => l.key), ['ok']);
    assert.equal(r.url, 'https://torn-tracker.com/me/routine/');
    assert.equal(readRoutine([]), null);
    assert.equal(readRoutine({ lines: 'x' }), null);
  });
});
