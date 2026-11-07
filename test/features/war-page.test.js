// The war page: sorting and dibs, against a saved page and a stand-in for the site
// (CMP-102).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { clock, sortList, statusText, travelDetail } from '../../src/features/war-page/index.js';
import { comparator, levelOf, statusOf } from '../../src/features/war-page/order.js';
import { page, runFeature } from '../feature-harness.js';

const WAR = 'https://www.torn.com/factions.php?step=your#/war/rank';
const NOW = 1_800_000_000_000;

/** Three opponents in Torn's order: hospital 50, okay 20, travelling 35. */
const HTML = page('faction-war.html').replace(
  '</ul>',
  '<li class="enemy"><div class="member"><a href="/profiles.php?XID=103">Enemy Three</a></div><div class="level">35</div><div class="status traveling">Traveling</div></li></ul>',
);

/** A site with dibs and FF estimates, remembering every call. */
function fakeSite({ war = true, dibs = [], ff = {}, answer, roster = [], loadouts } = {}) {
  const calls = [];
  const claims = new Map(dibs.map((d) => [d.target, d]));
  return {
    calls,
    claims,
    async ff(ids) {
      calls.push(['ff', [...ids]]);
      return new Map(ids.map((id) => [id, { ff: ff[id] ?? null, band: null }]));
    },
    async dibs() {
      calls.push(['dibs']);
      return { war, dibs: new Map(claims), roster: new Map(roster.map((r) => [r.id, r])) };
    },
    async warLoadouts() {
      calls.push(['warLoadouts']);
      return loadouts ?? null;
    },
    async callDibs(target, action) {
      calls.push(['callDibs', target, action]);
      if (answer) return answer(target, action);
      if (action === 'release') {
        claims.delete(target);
        return { ok: true, dibs: null, error: null };
      }
      const claim = { target, holder: { id: 9, name: 'Me' }, expiresAt: NOW + 300_000, mine: true };
      claims.set(target, claim);
      return { ok: true, dibs: claim, error: null };
    },
  };
}

/** Roster rows as site.js hands them over: until already on our clock, in ms. */
const ROSTER = [
  { id: 101, state: 'Hospital', until: NOW + 245_000, description: 'In hospital for 4 mins' },
  { id: 102, state: 'Okay', until: null, description: 'Okay' },
  { id: 103, state: 'Traveling', until: null, description: 'Traveling to Mexico' },
];

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: WAR, now: () => NOW, html: HTML, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});

const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const enemies = (r) => [...r.doc.querySelectorAll('li.enemy a')].map((a) => a.textContent);
const dibsButton = (r, id) => r.doc.querySelector(`.ttc-war-dibs[data-player="${id}"]`);

/** The player's own pick in our Sort select (hq #557 B14). */
function pick(r, order) {
  const select = r.doc.querySelector('.ttc-war-order');
  select.value = order;
  select.dispatchEvent(new r.doc.defaultView.Event('change', { bubbles: true }));
}

/** The player's own press of one of our buttons. */
function press(r, node) {
  node.dispatchEvent(new r.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('CMP-102 sorting reads only what the page shows', () => {
  test('status from the cell\'s class, or the text "Okay"; anything else is other', () => {
    const r = run({ settings: { enabled: false, sortBy: 'torn', dibs: false } });
    const rows = [...r.doc.querySelectorAll('li.enemy')];
    assert.deepEqual(rows.map(statusOf), ['hospital', 'okay', 'traveling']);
    assert.deepEqual(rows.map(levelOf), [50, 20, 35]);
    const odd = r.doc.createElement('li');
    assert.equal(statusOf(odd), 'other');
    assert.equal(levelOf(odd), null);
  });

  test('Torn\'s order is no comparator; unknown FF goes last', () => {
    assert.equal(comparator('torn'), null);
    const r = run({ settings: { enabled: false, sortBy: 'torn', dibs: false } });
    const list = r.doc.querySelector('ul.members-list');
    const ff = new Map([[101, { ff: 2 }], [103, { ff: 1.2 }]]);
    sortList(list, comparator('ff', ff));
    assert.deepEqual(enemies(r), ['Enemy Three', 'Enemy One', 'Enemy Two']);
    assert.equal(sortList(list, comparator('ff', ff)), false, 'already in order: nothing moves');
  });

  test('countdown text', () => {
    assert.equal(clock(245_000), '4:05');
    assert.equal(clock(-1), '0:00');
  });
});

describe('CMP-102 the sort bar', () => {
  test('sits above the opponents\' list only; our own list is left alone', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    const bars = r.doc.querySelectorAll('.ttc-war-bar');
    assert.equal(bars.length, 1);
    assert.ok(bars[0].nextElementSibling.querySelector('li.enemy'));
    assert.deepEqual([...bars[0].querySelectorAll('select option')].map((o) => o.value), ['torn', 'status', 'leave', 'level', 'ff']);
    assert.equal(bars[0].querySelectorAll('button').length, 0, 'one select, not a row of buttons');
  });

  test('pressing Level, then Status, then Torn\'s order moves Torn\'s rows and puts them back', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    const rows = [...r.doc.querySelectorAll('li.enemy')];
    pick(r, 'level');
    await wait(50);
    assert.deepEqual(enemies(r), ['Enemy Two', 'Enemy Three', 'Enemy One']);
    pick(r, 'status');
    await wait(50);
    assert.deepEqual(enemies(r), ['Enemy Two', 'Enemy One', 'Enemy Three']);
    pick(r, 'torn');
    await wait(50);
    assert.deepEqual(enemies(r), ['Enemy One', 'Enemy Two', 'Enemy Three']);
    assert.ok([...r.doc.querySelectorAll('li.enemy')].every((row, i) => row === rows[i]), 'the same nodes, never copies');
    assert.equal(r.doc.querySelector('.ttc-war-order').value, 'torn');
    assert.deepEqual(r.violations, []);
  });

  test('the sort from the settings applies on arrival', async () => {
    const r = run({ site: fakeSite(), settings: { enabled: true, sortBy: 'level', dibs: false } });
    await wait();
    assert.deepEqual(enemies(r), ['Enemy Two', 'Enemy Three', 'Enemy One']);
    assert.equal(r.doc.querySelector('.ttc-war-order').value, 'level');
  });

  test('hq #557 B14: with Torn War Stuff Enhanced on the page, no Sort select and no sorting', async () => {
    const r = run({ site: fakeSite(), settings: { enabled: true, sortBy: 'level', dibs: false } });
    r.doc.querySelector('li.enemy .status')?.setAttribute('data-twse-overridden', 'true');
    await wait();
    assert.equal(r.doc.querySelector('.ttc-war-bar'), null);
    assert.deepEqual(enemies(r), ['Enemy One', 'Enemy Two', 'Enemy Three'], "Torn's order, left to the other script");
  });

  test('FF order asks the site once, for opponents only', async () => {
    const site = fakeSite({ ff: { 101: 1.5, 102: 4, 103: 2.5 } });
    const r = run({ site, settings: { enabled: true, sortBy: 'ff', dibs: false } });
    await wait();
    assert.deepEqual(site.calls, [['ff', [101, 102, 103]]]);
    assert.deepEqual(enemies(r), ['Enemy One', 'Enemy Three', 'Enemy Two']);
  });
});

describe('CMP-102 dibs: shown from the site, called with one press, one site action', () => {
  test('a button beside each opponent: free, or held by someone with a countdown', async () => {
    const site = fakeSite({ dibs: [{ target: 101, holder: { id: 5, name: 'Ares' }, expiresAt: NOW + 245_000, mine: false }] });
    const r = run({ site });
    await wait();
    assert.equal(dibsButton(r, 101).textContent, 'Ares 4:05');
    assert.equal(dibsButton(r, 101).disabled, true);
    assert.equal(dibsButton(r, 102).textContent, 'Dibs');
    assert.equal(dibsButton(r, 102).disabled, false);
    assert.equal(r.doc.querySelectorAll('li.your .ttc-war-dibs').length, 0, 'never on our own members');
  });

  test('pressing claims; pressing again releases; each press is one call and no game action', async () => {
    const site = fakeSite();
    const r = run({ site });
    await wait();
    press(r, dibsButton(r, 102));
    await wait(50);
    assert.equal(dibsButton(r, 102).textContent, 'Mine 5:00');
    press(r, dibsButton(r, 102));
    await wait(50);
    assert.equal(dibsButton(r, 102).textContent, 'Dibs');
    assert.deepEqual(site.calls.filter((c) => c[0] === 'callDibs'), [['callDibs', 102, 'claim'], ['callDibs', 102, 'release']]);
    assert.deepEqual(r.violations, []);
  });

  test('beaten to it: the button shows who has them and says so', async () => {
    const holder = { target: 102, holder: { id: 5, name: 'Ares' }, expiresAt: NOW + 60_000, mine: false };
    const site = fakeSite({ answer: () => ({ ok: false, dibs: holder, error: 'dibs_taken' }) });
    const r = run({ site });
    await wait();
    press(r, dibsButton(r, 102));
    await wait(50);
    assert.equal(dibsButton(r, 102).textContent, 'Ares 1:00');
    assert.match(dibsButton(r, 102).title, /Someone else called dibs first/);
  });

  test('no ranked war on the site: no buttons', async () => {
    const r = run({ site: fakeSite({ war: false }) });
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-war-dibs').length, 0);
  });

  test('a hidden tab asks nothing; dibs switched off ask nothing', async () => {
    const hidden = fakeSite();
    run({ site: hidden, visibility: 'hidden' });
    const off = fakeSite();
    run({ site: off, settings: { enabled: true, sortBy: 'torn', dibs: false } });
    await wait();
    assert.deepEqual(hidden.calls, []);
    assert.deepEqual(off.calls, []);
  });

  test('stopping removes everything the feature added and leaves Torn\'s rows', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    feature.stop();
    assert.equal(r.doc.querySelectorAll('[data-ttc-war]').length, 0);
    assert.equal(r.doc.querySelectorAll('li.enemy').length, 3);
  });
});

describe('CMP-102 timers and destinations from the site roster (CAPI-034, hq #98)', () => {
  test('what goes beside the status', () => {
    assert.equal(statusText({ state: 'Hospital', until: NOW + 61_000, description: '' }, NOW), '1:01');
    assert.equal(statusText({ state: 'Jail', until: NOW - 1, description: '' }, NOW), '');
    assert.equal(statusText({ state: 'Traveling', until: null, description: 'Traveling to Mexico' }, NOW), '→ MX');
    assert.equal(statusText({ state: 'Traveling', until: null, description: 'Returning to Torn from Japan' }, NOW), '← JP');
    assert.equal(statusText({ state: 'Abroad', until: null, description: 'In Cayman Islands' }, NOW), 'in KY');
    assert.equal(statusText({ state: 'Traveling', until: null, description: 'Traveling to United Kingdom' }, NOW), '→ UK');
    assert.equal(statusText({ state: 'Abroad', until: null, description: 'In Atlantis' }, NOW), 'in Atlantis');
    assert.equal(statusText({ state: 'Okay', until: null, description: 'Okay' }, NOW), '');
    assert.equal(statusText(undefined, NOW), '');
  });

  test('the full destination goes in the title (hq #557 A5)', () => {
    assert.equal(travelDetail({ state: 'Traveling', description: 'Traveling to United Kingdom' }), 'Traveling to United Kingdom');
    assert.equal(travelDetail({ state: 'Abroad', description: 'In South Africa' }), 'In South Africa');
    assert.equal(travelDetail({ state: 'Hospital', description: 'In hospital for 4 mins' }), '');
    assert.equal(travelDetail({ state: 'Traveling', description: '<b>odd</b>' }), '');
    assert.equal(travelDetail(undefined), '');
  });

  test('a countdown in the status cell of the opponent in hospital, a destination for the traveller', async () => {
    const r = run({ site: fakeSite({ roster: ROSTER }) });
    await wait();
    const label = (id) => r.doc.querySelector(`a[href$="XID=${id}"]`).closest('li').querySelector('.status .ttc-war-time')?.textContent;
    assert.equal(label(101), '4:05');
    assert.equal(label(102), undefined);
    assert.equal(label(103), '→ MX');
    const traveller = r.doc.querySelector('a[href$="XID=103"]').closest('li').querySelector('.status .ttc-war-time');
    assert.equal(traveller.title, 'Traveling to Mexico');
    assert.deepEqual(r.violations, []);
  });

  test('Out soonest: okay first, then by time left in hospital, then travellers', async () => {
    const roster = [...ROSTER, { id: 104, state: 'Hospital', until: NOW + 30_000, description: '' }];
    const html = HTML.replace('</ul>', '<li class="enemy"><div class="member"><a href="/profiles.php?XID=104">Enemy Four</a></div><div class="level">10</div><div class="status hospital">Hospital</div></li></ul>');
    const r = run({ html, site: fakeSite({ roster }), settings: { enabled: true, sortBy: 'leave', dibs: false, timers: true } });
    await wait();
    assert.deepEqual(enemies(r), ['Enemy Two', 'Enemy Four', 'Enemy One', 'Enemy Three']);
  });

  test('timers off and dibs off: the site is never asked', async () => {
    const site = fakeSite({ roster: ROSTER });
    const r = run({ site, settings: { enabled: true, sortBy: 'torn', dibs: false, timers: false } });
    await wait();
    assert.deepEqual(site.calls, []);
    assert.equal(r.doc.querySelectorAll('.ttc-war-time').length, 0);
  });

  test('timers on, dibs off: timers show, no dibs buttons', async () => {
    const r = run({ site: fakeSite({ roster: ROSTER }), settings: { enabled: true, sortBy: 'torn', dibs: false, timers: true } });
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-war-time').length, 2);
    assert.equal(r.doc.querySelectorAll('.ttc-war-dibs').length, 0);
  });
});

describe('LDT-032 loadout flags of opponents on the war page (Pro)', () => {
  const pro = {
    pro: true,
    war: true,
    opponents: new Map([
      [101, { player_id: 101, flags: [{ flag: 'heavy_hitter', reason: 'Rifle: damage 76.9' }, { flag: 'temp_ready', reason: null }], seen_at: NOW - 3 * 3_600_000, reporters: 2, old: false, hidden: false }],
      [102, { player_id: 102, flags: [], seen_at: NOW - 20 * 86_400_000, reporters: 1, old: true, hidden: false }],
      [103, { player_id: 103, flags: [], seen_at: null, reporters: null, old: false, hidden: true }],
    ]),
  };
  const label = (r, id) => r.doc.querySelector(`a[href$="XID=${id}"]`).closest('li').querySelector('.ttc-war-ld');

  test('flags, age, old and hidden beside each opponent; reasons on hover; asked once', async () => {
    const site = fakeSite({ loadouts: pro });
    const r = run({ site });
    await wait();
    // One short word in the one-line member cell; the rest on hover and on a tap (hq #557).
    assert.equal(label(r, 101).textContent, 'Heavy +1');
    assert.ok(label(r, 101).classList.contains('ttc-ui-compact'));
    assert.match(label(r, 101).title, /Rifle: damage 76\.9/);
    assert.match(label(r, 101).dataset.detail, /^Rifle: damage 76\.9\. Temp\. Seen 3h ago by 2 players/);
    assert.equal(label(r, 101).dataset.open, 'false');
    label(r, 101).dispatchEvent(new r.doc.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(label(r, 101).dataset.open, 'true');
    assert.equal(label(r, 102).textContent, '20d');
    assert.equal(label(r, 102).dataset.old, 'true');
    assert.equal(label(r, 103).textContent, 'hidden');
    assert.equal(site.calls.filter((c) => c[0] === 'warLoadouts').length, 1);
    assert.deepEqual(r.violations, []);
  });

  test('a Core faction gets one note, no flags', async () => {
    const r = run({ site: fakeSite({ loadouts: { pro: false, war: false, opponents: new Map() } }) });
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-war-ld').length, 0);
    assert.match(r.doc.querySelector('.ttc-war-note').textContent, /Pro feature/);
  });

  test('switched off: not asked', async () => {
    const site = fakeSite({ loadouts: pro });
    run({ site, settings: { enabled: true, sortBy: 'torn', dibs: false, timers: false, loadouts: false } });
    await wait();
    assert.equal(site.calls.filter((c) => c[0] === 'warLoadouts').length, 0);
  });
});

describe('hq #535 the captured war page, with Torn War Stuff Enhanced and FF Scouter on', () => {
  // Rows 3000001-2 okay; 3-5 in hospital with TWSE's countdown drawn over the status; 6 in
  // hospital without it; 7 travelling and 8 abroad, both with TWSE's destination.
  const CAPTURED = page('faction-war-captured.html');
  const roster = [
    { id: 3000001, state: 'Okay', until: null, description: 'Okay' },
    { id: 3000003, state: 'Hospital', until: NOW + 786_000, description: '' },
    { id: 3000004, state: 'Hospital', until: NOW + 1_418_000, description: '' },
    { id: 3000005, state: 'Hospital', until: NOW + 7_894_000, description: '' },
    { id: 3000006, state: 'Hospital', until: NOW + 7_894_000, description: '' },
    { id: 3000007, state: 'Traveling', until: null, description: 'Returning to Torn from China' },
    { id: 3000008, state: 'Abroad', until: null, description: 'In Switzerland' },
  ];
  const settings = { enabled: true, sortBy: 'torn', dibs: true, timers: true, loadouts: false };
  const row = (r, id) => r.doc.querySelector(`li.enemy[data-player_id="${id}"]`) ?? r.doc.querySelector(`a[href$="XID=${id}"]`).closest('li');

  test('one timer per row: none where TWSE already shows the time or the destination', async () => {
    const r = run({ html: CAPTURED, site: fakeSite({ roster }), settings });
    await wait();
    for (const id of [3000003, 3000004, 3000005, 3000007, 3000008]) {
      assert.equal(row(r, id).querySelectorAll('.ttc-war-time').length, 0, `row ${id}`);
    }
    const ours = row(r, 3000006).querySelectorAll('.ttc-war-time');
    assert.equal(ours.length, 1);
    assert.equal(ours[0].textContent, '2:11:34', 'hours shown, not 131:34');
    assert.deepEqual(r.violations, []);
  });

  test('a cell TWSE takes over later loses our timer on the next tick', async () => {
    const r = run({ html: CAPTURED, site: fakeSite({ roster }), settings });
    await wait();
    const cell = row(r, 3000006).querySelector('.status');
    assert.equal(cell.querySelectorAll('.ttc-war-time').length, 1);
    cell.dataset.twseOverridden = 'true';
    await wait(1200);
    assert.equal(cell.querySelectorAll('.ttc-war-time').length, 0);
  });

  test('the dibs button is a small one-line button in the member cell, one per row', async () => {
    const r = run({ html: CAPTURED, site: fakeSite({ roster }), settings });
    await wait();
    const buttons = [...r.doc.querySelectorAll('.ttc-war-dibs')];
    assert.equal(buttons.length, r.doc.querySelectorAll('li.enemy').length);
    for (const b of buttons) {
      assert.ok(b.classList.contains('ttc-ui-small'), b.className);
      assert.ok(b.closest('.member'));
    }
    const css = r.doc.getElementById('ttc-ui-style').textContent;
    const rule = css.slice(css.indexOf('.ttc-ui-small.ttc-ui-small {'));
    const body = rule.slice(0, rule.indexOf('}'));
    assert.match(body, /white-space: nowrap/);
    assert.match(body, /flex: none/);
    assert.match(body, /height: 20px/);
    // On a touch screen it gets a finger's room, still on one line (hq #557 A4).
    assert.match(css, /@media \(pointer: coarse\) \{[^@]*\.ttc-ui-small\.ttc-ui-small \{ min-height: 0; height: 32px; min-width: 44px;/);
  });

  test('every width: the timer is one line and stands in for Torn’s word, kept in its title (hq #535 reopened)', async () => {
    const r = run({ html: CAPTURED, site: fakeSite({ roster }), settings });
    await wait();
    const cell = row(r, 3000006).querySelector('.status');
    const label = cell.querySelector('.ttc-war-time');
    assert.ok(label.classList.contains('ttc-ui-compact'), 'one line, never a tall pill');
    assert.ok(cell.hasAttribute('data-ttc-war-timed'));
    assert.equal(label.title, 'Hospital');
    // Only the cells with our timer are marked; Torn's word stays everywhere else.
    assert.equal(r.doc.querySelectorAll('[data-ttc-war-timed]').length, r.doc.querySelectorAll('.status .ttc-war-time').length);
    const css = r.doc.getElementById('ttc-ui-style').textContent;
    assert.match(outsideMedia(css), /\[data-ttc-war-timed\] \{ font-size: 0 !important; white-space: nowrap; \}/);
    cell.dataset.twseOverridden = 'true';
    await wait(1200);
    assert.ok(!cell.hasAttribute('data-ttc-war-timed'), 'TWSE took the cell: Torn’s word is back');
    r.stop();
    assert.equal(r.doc.querySelectorAll('[data-ttc-war-timed]').length, 0);
  });

  test('every width: dibs is a 24 px icon before the banner, its label kept for hover and screen readers', async () => {
    const r = run({ html: CAPTURED, site: fakeSite({ roster }), settings });
    await wait();
    const b = row(r, 3000001).querySelector('.ttc-war-dibs');
    assert.equal(b.dataset.short, '⚑');
    assert.match(b.getAttribute('aria-label'), /^Dibs\. Call dibs/);
    const css = r.doc.getElementById('ttc-ui-style').textContent;
    const flat = outsideMedia(css);
    assert.match(flat, /\.ttc-war-dibs \{ order: -1; width: 24px;/);
    assert.match(flat, /\.ttc-war-dibs::before \{ content: attr\(data-short\)/);
    assert.match(flat, /\.member:has\(> \.ttc-war-dibs\) \{ display: flex !important; flex-wrap: nowrap;/);
  });

  test('a row another script made taller: timer and dibs stay inside their cells (hq #535, owner 2026-11-05 23:05)', async () => {
    // The owner's desktop shot: TornTools adds "Stats Estimate" under every enemy row.
    const html = CAPTURED.replaceAll('<div class="clear"></div></li>', '<div class="clear"></div><div class="tt-stats-estimate">Stats Estimate: 2m - 25m</div></li>');
    const r = run({ html, site: fakeSite({ roster }), settings });
    await wait();
    const rows = [...r.doc.querySelectorAll('li.enemy')];
    assert.ok(rows.every((li) => li.querySelector('.tt-stats-estimate')));
    for (const li of rows) {
      for (const ours of li.querySelectorAll('.ttc-war-dibs, .ttc-war-time')) {
        assert.ok(ours.parentElement.matches('.member, .status'), `${ours.className} sits in ${ours.parentElement.className}`);
      }
      assert.equal(li.querySelector('.tt-stats-estimate').previousElementSibling.className, 'clear', 'their line is untouched, after Torn’s clear');
    }
    assert.ok(r.doc.querySelectorAll('.status .ttc-war-time').length >= 1);
    assert.deepEqual(r.violations, []);
  });
});

/** The stylesheet with every @media block taken out: the rules that hold at any width. */
function outsideMedia(css) {
  let out = '';
  let depth = 0;
  let inMedia = false;
  for (let i = 0; i < css.length; i += 1) {
    if (!inMedia && css.startsWith('@media', i)) { inMedia = true; depth = 0; }
    const ch = css[i];
    if (inMedia) {
      if (ch === '{') depth += 1;
      else if (ch === '}') { depth -= 1; if (depth === 0) inMedia = false; }
      continue;
    }
    out += ch;
  }
  return out;
}

describe('hq #535 clock', () => {
  test('hours from an hour up', () => {
    assert.equal(clock(3_599_000), '59:59');
    assert.equal(clock(3_600_000), '1:00:00');
    assert.equal(clock(7_894_000), '2:11:34');
  });
});
