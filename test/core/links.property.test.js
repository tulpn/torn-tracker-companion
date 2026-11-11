// Property tests (hq #845, from #471): whatever torn-tracker.com sends, a link a reader
// keeps opens on torn-tracker.com (either spelling, D-162) or is a path on torn.com, never
// anywhere else. Each reader starts from a reply that fits, and random string fields are
// swapped for hostile links: other hosts, look-alikes, other schemes, protocol-relative
// and backslash tricks.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';

import {
  SIDEBAR_KEYS, readAchievements, readBuylist, readCard, readDashboard, readGuide, readLists, readRoutine,
  readSidebar, siteUrl, tornPath,
} from '../../src/core/site.js';

const RUNS = { numRuns: 400 };
const SITE_HOSTS = ['torn-tracker.com', 'www.torn-tracker.com'];
const TORN = 'https://www.torn.com';

/** Output keys that hold a link, and the containers whose every string is one. */
const LINK_KEYS = new Set(['url', 'href', 'image', 'link', 'pageUrl', 'calcUrl', 'path']);
const LINK_BAGS = new Set(['links', 'cardLinks']);

/** True for a link we may show: https on our host, or a path that stays on torn.com. */
function allowed(v) {
  if (v === null) return true;
  if (typeof v !== 'string') return false;
  if (v.startsWith('/')) {
    if (v.startsWith('//') || v.includes('\\')) return false;
    return new URL(v, `${TORN}/`).origin === TORN;
  }
  try {
    const url = new URL(v);
    return url.protocol === 'https:' && SITE_HOSTS.includes(url.host) && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/**
 * Every [where, link] in a reader's output: a string under a link key, or a string held
 * directly in a bag of links (`links: {dashboard: url}`, `cardLinks: Map`).
 */
function linksIn(value, where = '$', bag = false, out = []) {
  const entries = value instanceof Map ? [...value]
    : Array.isArray(value) ? value.map((v, i) => [i, v])
      : value && typeof value === 'object' ? Object.entries(value) : [];
  for (const [k, v] of entries) {
    const at = `${where}.${k}`;
    if ((bag || LINK_KEYS.has(k)) && (typeof v === 'string' || v === null)) out.push([at, v]);
    else linksIn(v, at, LINK_BAGS.has(k), out);
  }
  return out;
}

function assertLinksAllowed(output) {
  for (const [where, link] of linksIn(output)) {
    assert.ok(allowed(link), `${where} = ${JSON.stringify(link)}`);
  }
}

const HOSTILE = [
  'https://evil.example/',
  'https://evil.example/https://torn-tracker.com/',
  'http://torn-tracker.com/me/',
  'http://www.torn-tracker.com/me/',
  'https://torn-tracker.com.evil.example/',
  'https://www.torn-tracker.com.evil.example/guide/',
  'https://torn-tracker.com@evil.example/',
  'https://torn-tracker.com:443@evil.example/',
  'https://torn-tracker.com:8443/x',
  '//evil.example/x',
  '///evil.example/x',
  '/\\evil.example/x',
  '\\\\evil.example\\x',
  ' https://evil.example/',
  '\thttps://evil.example/',
  'https:evil.example',
  'https:/evil.example',
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  ' javascript:alert(1)',
  'data:text/html,x',
  'vbscript:x',
  'https://www.torn.com.evil.example/bank.php',
  'https://torn.com@evil.example/bank.php',
];

/** A hostile link, a random web URL, or a path that may or may not stay put. */
const hostile = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom(...HOSTILE) },
  { weight: 1, arbitrary: fc.webUrl({ withQueryParameters: true, withFragments: true }) },
  { weight: 1, arbitrary: fc.stringMatching(/^[/\\]{1,3}[\w.:@%-]{0,20}(\/[\w.]{0,8})?$/) },
);

/** The number of string leaves in a JSON value. */
function stringCount(v) {
  if (typeof v === 'string') return 1;
  if (Array.isArray(v)) return v.reduce((n, x) => n + stringCount(x), 0);
  if (v && typeof v === 'object') return Object.values(v).reduce((n, x) => n + stringCount(x), 0);
  return 0;
}

/** A copy of `v` where the i-th string leaf becomes `swaps[i]` when that is not null. */
function swapped(v, swaps, at = { i: 0 }) {
  if (typeof v === 'string') {
    const s = swaps[at.i++];
    return s ?? v;
  }
  if (Array.isArray(v)) return v.map((x) => swapped(x, swaps, at));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swapped(x, swaps, at)]));
  return v;
}

/** The seed with some of its strings swapped for hostile links (each about one in three). */
const mutated = (seed) => {
  const n = stringCount(seed);
  const swap = fc.oneof({ weight: 2, arbitrary: fc.constant(null) }, { weight: 1, arbitrary: hostile });
  return fc.array(swap, { minLength: n, maxLength: n }).map((swaps) => swapped(seed, swaps));
};

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const WWW = 'https://www.torn-tracker.com';

const SEEDS = {
  sidebar: {
    links: [
      { label: 'Dashboard', url: `${WWW}/dashboard/` },
      { label: 'Chains', url: 'https://torn-tracker.com/faction/chains/' },
    ],
    routine: {
      url: `${WWW}/me/routine/`,
      day_ends_at: '2026-11-12T00:00:00Z',
      lines: [
        { key: 'bank', text: 'Invest in the bank', done: false, url: 'https://www.torn.com/bank.php' },
        { key: 'refills', text: 'Use your energy refill', done: true, url: '/page.php?sid=points' },
      ],
    },
  },
  achievements: {
    url: `${WWW}/me/achievements/`,
    server_time: '2026-11-11T00:00:00Z',
    unlocked: [{ id: 'first-chain', name: 'First chain', tier: 'bronze' }],
    featured: [],
    card: { image: 'https://torn-tracker.com/u/2000001/card.png?src=unlock', link: `${WWW}/r/abc123/` },
  },
  guide: {
    started: true, offer: true, done: 2, total: 5, url: `${WWW}/guide/`,
    next: { title: 'Link your key', outcome: 'Your page fills in.', cta_label: 'Open', cta_url: `${WWW}/guide/key/` },
  },
  buylist: {
    trader: { torn_id: 2000001, name: 'ExampleTrader' },
    prices: { 206: 830000 },
    page_url: `${WWW}/traders/ExampleTrader/`,
    calc_url: 'https://torn-tracker.com/traders/ExampleTrader/calc/',
    receipts: 3,
  },
  lists: json('../fixtures/site/lists.json').read.data,
  dashboard: json('../fixtures/dashboard.json'),
};

describe('hq #845 links in the site\'s replies stay on our hosts', () => {
  test('the check itself tells ours from theirs', () => {
    for (const ok of [null, `${WWW}/x/`, 'https://torn-tracker.com/', '/bank.php', '/page.php?sid=points#x']) assert.ok(allowed(ok), ok);
    for (const bad of HOSTILE) assert.equal(allowed(bad), false, bad);
  });

  test('the seeds fit, so the swaps are what gets tested', () => {
    assert.ok(readSidebar(SEEDS.sidebar, SIDEBAR_KEYS).links.length === 2);
    assert.ok(readSidebar(SEEDS.sidebar, SIDEBAR_KEYS).items.get('routine')?.lines.length === 2);
    assert.ok(readAchievements(SEEDS.achievements).card);
    assert.ok(readGuide(SEEDS.guide)?.next);
    assert.ok(readBuylist(SEEDS.buylist));
    assert.ok(readLists(SEEDS.lists)?.lists.length === 2);
    assert.ok(readDashboard(SEEDS.dashboard, 0).cards.size > 0);
  });

  const readers = [
    ['readSidebar', SEEDS.sidebar, (d) => readSidebar(d, SIDEBAR_KEYS, 0)],
    ['readRoutine', SEEDS.sidebar.routine, (d) => readRoutine(d, 0)],
    ['readAchievements', SEEDS.achievements, readAchievements],
    ['readCard', SEEDS.achievements.card, readCard],
    ['readGuide', SEEDS.guide, readGuide],
    ['readBuylist', SEEDS.buylist, readBuylist],
    ['readLists', SEEDS.lists, readLists],
    ['readDashboard', SEEDS.dashboard, (d) => readDashboard(d, 0)],
  ];
  for (const [name, seed, read] of readers) {
    test(`${name}: every link kept is ours`, () => {
      assert.ok(linksIn(read(seed)).some(([, link]) => link !== null), `${name}: the seed's links are found`);
      fc.assert(fc.property(mutated(seed), (data) => assertLinksAllowed(read(data))), RUNS);
    });
  }

  test('siteUrl: null or https on our host', () => {
    fc.assert(fc.property(fc.oneof(hostile, fc.string()), (v) => {
      const url = siteUrl(v);
      assert.ok(url === null || (allowed(url) && !url.startsWith('/')), String(url));
    }), RUNS);
  });

  test('tornPath: null or a path that stays on torn.com', () => {
    fc.assert(fc.property(fc.oneof(hostile, fc.string()), (v) => {
      const path = tornPath(v);
      assert.ok(path === null || (path.startsWith('/') && allowed(path)), String(path));
    }), RUNS);
    assert.equal(tornPath('https://www.torn.com/bank.php'), '/bank.php');
    assert.equal(tornPath('https://torn.com/bank.php'), '/bank.php');
  });
});
