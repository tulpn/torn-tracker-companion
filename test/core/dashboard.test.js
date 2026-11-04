// The dashboard inside Torn (hq #465): the read, checked card by card, and the page that
// shows it at /index.php#/torn-tracker/dashboard while its switch is on. hq #491 (D-170):
// the new order, no hero, bars or battle stats, and each card's link to its own page; part 2
// adds alerts, chain watch, awards, the war's start and dibs, and the running course.

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { DASHBOARD_CARDS, ME_DASHBOARD_URL, SPACES, createSite, readDashboard } from '../../src/core/site.js';
import { createCache } from '../../src/core/cache.js';
import { DASH_ID, mountDashboard } from '../../src/core/dashboard.js';
import { CHART_COLOURS, SERIES_ORDER, barChart, chartDeclarations, compact, dayLabel, lineChart } from '../../src/core/chart.js';
import { routeOf } from '../../src/core/page.js';
import { createRegistry } from '../../src/core/registry.js';
import { defaults, normalize } from '../../src/core/settings.js';
import { ROOT } from '../helpers.js';

const KEY = `tt_feed_${'D'.repeat(43)}`;
const FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'dashboard.json'), 'utf8'));
const copy = () => JSON.parse(JSON.stringify(FIXTURE));
const windows = [];
after(() => windows.forEach((w) => w.close()));
const settle = () => new Promise((resolve) => setImmediate(resolve));

function siteRig({ reply = () => ({ ok: true, status: 200, data: copy() }), key = KEY } = {}) {
  let clock = Date.UTC(2026, 10, 2, 12);
  const calls = [];
  const site = createSite({
    getKey: () => key,
    send: async (url, opts) => {
      calls.push({ url, ...opts });
      return reply();
    },
    cache: createCache(SPACES, { now: () => clock }),
    now: () => clock,
  });
  return { site, calls, tick: (ms) => { clock += ms; } };
}

function pageRig(site, settings = { look: 'dark' }) {
  const win = new JSDOM('<!doctype html><body></body>', { url: 'https://www.torn.com/index.php' }).window;
  windows.push(win);
  const host = win.document.createElement('div');
  win.document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const dash = mountDashboard({ doc: win.document, root, site, getSettings: () => settings, now: () => Date.UTC(2026, 10, 2, 12) });
  return { win, root, dash };
}

async function opened(site, settings) {
  const rig = pageRig(site, settings);
  rig.dash.open();
  await settle();
  await settle();
  return rig;
}

describe('hq #465 the dashboard read', () => {
  test('every card of the fixture fits, in the page order', () => {
    const read = readDashboard(copy());
    assert.deepEqual([...read.cards.keys()], DASHBOARD_CARDS);
    for (const key of DASHBOARD_CARDS) assert.notEqual(read.cards.get(key), null, key);
    assert.equal(read.cards.get('gym').percent, 37.5);
    assert.equal(read.cards.get('chain').current, 412);
    assert.equal(read.cards.get('war').opponent, 'Other Example Faction');
  });

  test('hq #491: the order puts what needs the player now first; hero, bars and stats are gone', () => {
    assert.deepEqual(DASHBOARD_CARDS, [
      'alerts', 'war', 'chain_watch', 'chain', 'oc', 'awards', 'education', 'gym', 'goals', 'achievements', 'guide', 'money',
    ]);
    for (const gone of ['hero', 'bars', 'stats']) assert.equal(DASHBOARD_CARDS.includes(gone), false, gone);
    const read = readDashboard({ ...copy(), hero: { name: 'Someone' }, bars: { bars: [] }, stats: { gym: [] } });
    assert.equal('hero' in read, false);
    assert.equal(read.cards.has('bars'), false);
    assert.equal(read.cards.has('stats'), false);
  });

  test('hq #491: a card links to its own url, else its page; a link off the site is none at all', () => {
    const read = readDashboard(copy());
    assert.equal(read.cardLinks.get('gym'), 'https://torn-tracker.com/gym/', 'the own url');
    assert.equal(read.cardLinks.get('money'), 'https://torn-tracker.com/finances/', 'its page from the links');
    assert.equal(read.links.war, null, 'off the site');
    assert.equal(read.cardLinks.get('war'), null);
    assert.equal(read.links.stats, 'https://torn-tracker.com/stats/');
  });

  test('hq #491: no card link is ever the dashboard page, even when the read says so', () => {
    const data = copy();
    data.gym.url = 'https://torn-tracker.com/dashboard/';
    data.goals.url = 'https://www.torn-tracker.com/dashboard?tab=goals';
    data.links.finances = 'https://torn-tracker.com/dashboard/';
    data.links.guide = 'javascript:alert(1)';
    const read = readDashboard(data);
    assert.equal(read.cardLinks.get('gym'), null, 'no gym page in the links: none at all');
    assert.equal(read.cardLinks.get('goals'), null);
    assert.equal(read.cardLinks.get('money'), null);
    assert.equal(read.cardLinks.get('guide'), null);
    for (const [key, url] of readDashboard(null).cardLinks) assert.equal(url, null, key);
    assert.equal(read.links.dashboard, 'https://torn-tracker.com/dashboard/', 'the one link at the top stays');
  });

  test('a card that does not fit is off, the others stay', () => {
    const data = copy();
    data.gym = { next_gym: 'Example gym', percent: 140 };
    data.money.series = [{ date: 'yesterday', income: 5 }];
    data.chain = { current: -1, max: 10 };
    delete data.education;
    const read = readDashboard(data);
    for (const key of ['gym', 'money', 'chain', 'education']) assert.equal(read.cards.get(key), null, key);
    assert.notEqual(read.cards.get('goals'), null);
    assert.notEqual(read.cards.get('war'), null);
  });

  test('hq #491 part 2: alerts are checked row by row, newest first as sent, without a payload', () => {
    const data = copy();
    data.alerts.push({ kind: 'Bad Kind!', title: 'x', at: '2026-11-02T10:00:00Z' }, { kind: 'personal.x', title: '' },
      { kind: 'personal.merit', title: 'Off-site link', at: 'soon', url: 'https://evil.example/' });
    const alerts = readDashboard(data).cards.get('alerts');
    assert.deepEqual(alerts.map((a) => a.title), ['Stakeout triggered', 'Your watch starts soon', 'Off-site link']);
    assert.equal(alerts[0].url, 'https://www.torn-tracker.com/stakeouts/');
    assert.equal(alerts[2].url, null);
    assert.equal(alerts[2].at, null);
    assert.equal('detail' in alerts[0], false);
    data.alerts = Array.from({ length: 15 }, (_, i) => ({ kind: 'personal.x', title: `Alert ${i}` }));
    assert.equal(readDashboard(data).cards.get('alerts').length, 10);
    data.alerts = [];
    assert.equal(readDashboard(data).cards.get('alerts'), null);
  });

  test('hq #491 part 2: the war says whether it runs, when it starts, and the member\'s dibs', () => {
    const data = copy();
    const war = readDashboard(data).cards.get('war');
    assert.equal(war.state, 'running');
    assert.equal(war.startsAt, Date.UTC(2026, 10, 1, 12));
    assert.equal(war.endsAt, null);
    assert.deepEqual(war.dibs.map((d) => d.name), ['Example Target']);
    data.war.state = 'ended';
    assert.equal(readDashboard(data).cards.get('war'), null);
    data.war.state = 'scheduled';
    data.war.dibs = [{ target_id: -1, target_name: 'x', expires_at: 'never' }];
    assert.deepEqual(readDashboard(data).cards.get('war').dibs, []);
  });

  test('hq #491 part 2: chain watch reads holders, the member\'s slots and the gaps; junk holders drop', () => {
    const data = copy();
    data.chain_watch.now.holders.push({ role: 'captain', torn_id: 2000003, name: 'Nobody' });
    const cw = readDashboard(data).cards.get('chain_watch');
    assert.deepEqual(cw.now.holders.map((x) => [x.role, x.name, x.mine]), [['lead', 'ExamplePlayer', true], ['backup_1', 'ExampleFriend', false]]);
    assert.deepEqual(cw.next.holders, [], 'nobody on watch next is kept, not dropped');
    assert.deepEqual(cw.mine, { now: 'lead', next: { role: 'backup_1', slotStart: Date.UTC(2026, 10, 2, 18), startsAt: Date.UTC(2026, 10, 2, 18) } });
    assert.equal(cw.gaps, 6);
    data.chain_watch.now.slot_start = '2026-11-02T12:10:00Z';
    assert.equal(readDashboard(data).cards.get('chain_watch').now, null, 'a slot off :00 and :30 does not fit');
    assert.equal(readDashboard({ chain_watch: { now: null, next: null, mine: {}, chain: null } }).cards.get('chain_watch'), null);
  });

  test('hq #491 part 2: a chain on the chain watch card is not shown twice', () => {
    const data = copy();
    assert.notEqual(readDashboard(data).cards.get('chain'), null, 'no chain on the watch card: the chain card shows');
    data.chain_watch.chain = { current: 148, max: 250, timeout_at: '2026-11-02T12:03:00Z', as_of: '2026-11-02T12:00:00Z', url: 'https://www.torn-tracker.com/chains/' };
    const read = readDashboard(data);
    assert.equal(read.cards.get('chain_watch').chain.current, 148);
    assert.equal(read.cards.get('chain_watch').chain.url, 'https://www.torn-tracker.com/chains/');
    assert.equal(read.cards.get('chain'), null);
  });

  test('hq #491 part 2: awards keep at most five fitting rows, each linking on the site only', () => {
    const data = copy();
    data.awards.nearest[1].url = 'https://torn-tracker.com/dashboard/';
    data.awards.nearest.push({ id: 3, kind: 'trophy', name: 'x', pct: 10 }, { id: 4, kind: 'medal', name: 'y', pct: 101 });
    for (let i = 0; i < 6; i += 1) data.awards.nearest.push({ id: 10 + i, kind: 'honor', name: `Filler ${i}`, pct: 1 });
    const awards = readDashboard(data).cards.get('awards');
    assert.equal(awards.nearest.length, 3, 'only the first five sent are looked at; two of them do not fit');
    assert.deepEqual(awards.nearest.slice(0, 2).map((a) => [a.name, a.detail, a.pct]), [['Example honor', '5 to go', 95], ['Example medal', '8 to go', 60.5]]);
    assert.equal(awards.nearest[1].url, null, 'never the dashboard page');
    assert.equal(readDashboard(data).cardLinks.get('awards'), 'https://www.torn-tracker.com/awards/');
  });

  test('hq #491 part 2: education carries the running course, the member\'s next pick and the branch', () => {
    const data = copy();
    const edu = readDashboard(data).cards.get('education');
    assert.deepEqual(edu.course, { id: 11, name: 'Example course', finishesAt: Date.UTC(2026, 10, 5, 12) });
    assert.deepEqual(edu.nextCourse, { id: 12, name: 'Next example course' });
    assert.deepEqual(edu.branch, { name: 'Biology', done: 3, total: 10 });
    data.education = { course: null, next_course: null, branch: { name: 'Biology', done: 1, total: 0 }, position: null, next: null, complete: false };
    assert.equal(readDashboard(data).cards.get('education'), null, 'nothing to say is no card');
  });

  test('the last gym is a card of its own, not a missing one', () => {
    const data = copy();
    data.gym = { next_gym: null, percent: null };
    assert.deepEqual(readDashboard(data).cards.get('gym'), { nextGym: null, percent: null, energy: null });
  });

  test('nothing at all still gives the dashboard link and no cards', () => {
    const read = readDashboard(null);
    assert.ok([...read.cards.values()].every((v) => v === null));
    assert.equal(read.links.dashboard, 'https://torn-tracker.com/dashboard/');
  });

  test('bad numbers are dropped field by field', () => {
    const data = copy();
    data.money.series[0].income = Infinity;
    data.goals.active[0].pct = 500;
    const read = readDashboard(data);
    assert.equal(read.cards.get('money').series[0].income, null);
    assert.equal(read.cards.get('goals').active[0].pct, null);
  });
});

describe('hq #465 site.dashboard()', () => {
  test('one GET with the script key, kept a minute', async () => {
    const r = siteRig();
    const first = await r.site.dashboard();
    assert.equal(first.status, 'ok');
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].url, ME_DASHBOARD_URL);
    assert.equal(r.calls[0].method, 'GET');
    assert.equal(r.calls[0].headers.Authorization, `Bearer ${KEY}`);
    assert.equal((await r.site.dashboard()).cached, true);
    assert.equal(r.calls.length, 1);
    r.tick(61_000);
    await r.site.dashboard();
    assert.equal(r.calls.length, 2);
  });

  test('no key asks nothing; a refusal, a 429 and a failure each say so', async () => {
    const none = siteRig({ key: '' });
    assert.equal((await none.site.dashboard()).status, 'no_key');
    assert.equal(none.calls.length, 0);
    assert.equal((await siteRig({ reply: () => ({ ok: false, status: 401, data: null }) }).site.dashboard()).status, 'refused');
    assert.deepEqual(await siteRig({ reply: () => ({ ok: false, status: 429, data: null, retryAfter: '30' }) }).site.dashboard(),
      { status: 'wait', retryMs: 30_000 });
    assert.equal((await siteRig({ reply: () => ({ ok: false, status: 500, data: null }) }).site.dashboard()).status, 'failed');
  });
});

describe('hq #465 the page', () => {
  test('every card renders, each with a link that stays on the site and opens a new tab', async () => {
    const { root } = await opened(siteRig().site);
    const cards = [...root.querySelectorAll('[data-card]')].map((n) => n.dataset.card);
    assert.deepEqual(cards, DASHBOARD_CARDS);
    for (const a of root.querySelectorAll(`#${DASH_ID} a[target="_blank"]`)) {
      assert.match(a.href, /^https:\/\/(www\.)?torn-tracker\.com\//, a.href);
      assert.equal(a.rel, 'noopener noreferrer');
    }
    assert.match(root.querySelector('[data-card="gym"]').textContent, /estimate/);
    assert.equal(root.getElementById(DASH_ID).dataset.theme, 'dark');
  });

  test('hq #491: no card link ends in /dashboard/; the one dashboard link is at the top', async () => {
    const data = copy();
    data.gym.url = 'https://torn-tracker.com/dashboard/';
    data.links.finances = 'https://torn-tracker.com/dashboard/';
    const { root } = await opened(siteRig({ reply: () => ({ ok: true, status: 200, data }) }).site);
    const cardLinks = [...root.querySelectorAll('[data-card] a')];
    assert.ok(cardLinks.length > 0);
    for (const a of cardLinks) assert.doesNotMatch(new URL(a.href).pathname, /\/dashboard\/?$/, a.href);
    assert.equal(root.querySelector('[data-card="war"] a'), null, 'a card with no page of its own has no link');
    const top = [...root.querySelectorAll(`#${DASH_ID} a`)].filter((a) => /\/dashboard\/?$/.test(new URL(a.href).pathname));
    assert.equal(top.length, 1);
    assert.equal(top[0].closest('[data-card]'), null);
    assert.equal(root.querySelector('[data-card="hero"]'), null);
  });

  test('hq #491 part 2: chain watch says nobody is on watch, and marks the member', async () => {
    const { root } = await opened(siteRig().site);
    const cw = root.querySelector('[data-card="chain_watch"]').textContent;
    assert.match(cw, /ExamplePlayer \(you\)/);
    assert.match(cw, /Nobody on watch\./);
    assert.match(cw, /You're on watch now: Lead/);
    assert.match(cw, /Your next watch: Backup 1, in 6h/);
    assert.match(cw, /6 slots in the next 24 h have no Lead/);
    assert.match(root.querySelector('[data-card="alerts"]').textContent, /Stakeout triggered20m ago/);
    assert.match(root.querySelector('[data-card="awards"]').textContent, /5 to go/);
    assert.match(root.querySelector('[data-card="war"]').textContent, /Your dibs.*Example Target/);
    assert.match(root.querySelector('[data-card="education"]').textContent, /Studying Example course/);
  });

  test('hq #491 part 2: a scheduled war says when it starts', async () => {
    const data = copy();
    data.war.state = 'scheduled';
    data.war.starts_at = '2026-11-03T12:00:00Z';
    const { root } = await opened(siteRig({ reply: () => ({ ok: true, status: 200, data }) }).site);
    const war = root.querySelector('[data-card="war"]').textContent;
    assert.match(war, /Starts in /);
    assert.doesNotMatch(war, /Us/);
  });

  test('hq #541: the site’s new name for it, matched, reads the same as scheduled (tc-targets #582)', async () => {
    const data = copy();
    data.war.state = 'matched';
    data.war.starts_at = '2026-11-03T12:00:00Z';
    const { root } = await opened(siteRig({ reply: () => ({ ok: true, status: 200, data }) }).site);
    const war = root.querySelector('[data-card="war"]').textContent;
    assert.match(war, /Starts in /);
    assert.doesNotMatch(war, /Us/);
  });

  test('a card that is off is not on the page', async () => {
    const data = copy();
    delete data.war;
    const { root } = await opened(siteRig({ reply: () => ({ ok: true, status: 200, data }) }).site);
    assert.equal(root.querySelector('[data-card="war"]'), null);
    assert.notEqual(root.querySelector('[data-card="oc"]'), null);
  });

  test('one read per open; opening again while open asks nothing', async () => {
    let reads = 0;
    const site = { dashboard: async () => { reads += 1; return { status: 'failed' }; } };
    const { dash } = pageRig(site);
    dash.open();
    dash.open();
    await settle();
    assert.equal(reads, 1);
    dash.close();
    dash.open();
    await settle();
    assert.equal(reads, 2);
  });

  test('an answer that lands after close is dropped', async () => {
    let release;
    const site = { dashboard: () => new Promise((resolve) => { release = resolve; }) };
    const { root, dash } = pageRig(site);
    dash.open();
    dash.close();
    release({ status: 'ok', ...readDashboard(copy()) });
    await settle();
    assert.equal(root.querySelector('[data-card]'), null);
    assert.equal(dash.isOpen(), false);
  });

  test('loading, no key, refused, wait and failed each say what to do', async () => {
    const say = async (result) => {
      const { root, dash } = pageRig({ dashboard: async () => result });
      dash.open();
      const loading = root.querySelector('[role="status"]').textContent;
      await settle();
      const status = root.querySelector('[role="status"]');
      return { loading, text: status.textContent, link: status.querySelector('a')?.getAttribute('href') ?? null };
    };
    const noKey = await say({ status: 'no_key' });
    assert.match(noKey.loading, /Loading your dashboard/);
    assert.match(noKey.text, /script key/);
    assert.equal(noKey.link, '#/torn-tracker/keys');
    assert.equal((await say({ status: 'refused' })).link, '#/torn-tracker/keys');
    assert.match((await say({ status: 'wait', retryMs: 60_000 })).text, /asked to wait/);
    assert.match((await say({ status: 'failed' })).text, /Couldn't reach/);
  });

  test('the light theme follows the setting', () => {
    const { root, dash } = pageRig({ dashboard: async () => ({ status: 'failed' }) }, { look: 'light' });
    dash.open();
    assert.equal(root.getElementById(DASH_ID).dataset.theme, 'light');
  });
});

describe('hq #465 the switch and the route', () => {
  test('the route names the section; the switch is off by default', () => {
    assert.equal(routeOf({ pathname: '/index.php', hash: '#/torn-tracker/dashboard' }), 'dashboard');
    const registry = createRegistry([]);
    assert.equal(defaults(registry).dashboard, false);
    assert.equal(normalize({ ...defaults(registry), dashboard: true }, registry).dashboard, true);
    assert.equal(normalize({ ...defaults(registry), dashboard: 'yes' }, registry).dashboard, false);
  });
});

describe('hq #465 the charts', () => {
  const doc = () => {
    const win = new JSDOM('<!doctype html><body></body>').window;
    windows.push(win);
    return win.document;
  };
  const rows = [{ date: '2026-10-31', a: 5, b: -3 }, { date: '2026-11-01', a: 10, b: null }];
  const series = [{ key: 'a', label: 'In' }, { key: 'b', label: 'Out' }];

  test('labels and numbers', () => {
    assert.equal(dayLabel('2026-11-02'), '2 Nov');
    assert.equal(compact(1234), '1.2k');
    assert.equal(compact(-2_500_000), '-2.5m');
    assert.equal(compact(12), '12');
  });

  test('a bar chart: one titled mark per value, a legend, the same numbers in a table', () => {
    const fig = barChart(doc(), { rows, series, label: 'Test' });
    const marks = fig.querySelectorAll('rect.ttc-mark');
    assert.equal(marks.length, 3, 'a missing value draws nothing');
    for (const m of marks) assert.ok(m.querySelector('title').textContent.length > 0);
    assert.equal(fig.querySelectorAll('.ttc-legend li').length, 2);
    assert.equal(fig.querySelectorAll('.ttc-values tbody tr').length, 2);
    assert.equal(fig.querySelector('svg').getAttribute('aria-label'), 'Test');
  });

  test('a line chart with one series has no legend; colours go in the fixed order', () => {
    const one = lineChart(doc(), { rows, series: series.slice(0, 1), label: 'One' });
    assert.equal(one.querySelector('.ttc-legend'), null);
    const two = lineChart(doc(), { rows, series, label: 'Two' });
    assert.deepEqual([...two.querySelectorAll('polyline')].map((p) => p.getAttribute('class')),
      [`ttc-line ttc-c${SERIES_ORDER[0]}`, `ttc-line ttc-c${SERIES_ORDER[1]}`]);
  });

  test('each theme declares four colours', () => {
    for (const theme of ['light', 'dark']) {
      const css = chartDeclarations(theme);
      for (const colour of CHART_COLOURS[theme]) assert.ok(css.includes(colour), `${theme} ${colour}`);
    }
  });

  test('the dashboard stays small', () => {
    for (const [file, budget] of [['chart.js', 11_000], ['dashboard.js', 18_000]]) {
      const size = fs.statSync(path.join(ROOT, 'src', 'core', file)).size;
      assert.ok(size <= budget, `${file} is ${size} bytes, budget ${budget}`);
    }
  });
});
