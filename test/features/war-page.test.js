// The war page: sorting and dibs, against a saved page and a stand-in for the site
// (CMP-102).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { clock, sortList } from '../../src/features/war-page/index.js';
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
function fakeSite({ war = true, dibs = [], ff = {}, answer } = {}) {
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
      return { war, dibs: new Map(claims) };
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
    assert.deepEqual([...bars[0].querySelectorAll('button')].map((b) => b.dataset.order), ['torn', 'status', 'level', 'ff']);
  });

  test('pressing Level, then Status, then Torn\'s order moves Torn\'s rows and puts them back', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    const rows = [...r.doc.querySelectorAll('li.enemy')];
    press(r, r.doc.querySelector('[data-order="level"]'));
    await wait(50);
    assert.deepEqual(enemies(r), ['Enemy Two', 'Enemy Three', 'Enemy One']);
    press(r, r.doc.querySelector('[data-order="status"]'));
    await wait(50);
    assert.deepEqual(enemies(r), ['Enemy Two', 'Enemy One', 'Enemy Three']);
    press(r, r.doc.querySelector('[data-order="torn"]'));
    await wait(50);
    assert.deepEqual(enemies(r), ['Enemy One', 'Enemy Two', 'Enemy Three']);
    assert.ok([...r.doc.querySelectorAll('li.enemy')].every((row, i) => row === rows[i]), 'the same nodes, never copies');
    assert.equal(r.doc.querySelector('[data-order="torn"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(r.violations, []);
  });

  test('the sort from the settings applies on arrival', async () => {
    const r = run({ site: fakeSite(), settings: { enabled: true, sortBy: 'level', dibs: false } });
    await wait();
    assert.deepEqual(enemies(r), ['Enemy Two', 'Enemy Three', 'Enemy One']);
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
