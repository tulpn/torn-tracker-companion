// The bounty board (BNT-012, WP-BNT-2): badges, the filter bar and the hospital outline.

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, {
  FILTER_KEY, NO_FILTER, passes, readRow, timerMs, validFilter,
} from '../../src/features/bounty-board/index.js';
import { page, runFeature } from '../feature-harness.js';

const URL_ = 'https://www.torn.com/bounties.php';
const FF = new Map([[3000001, { ff: 1.4, band: 'easy' }], [3000002, { ff: 2.2, band: 'fair' }], [3000003, { ff: 4.8, band: 'hard' }]]);

const running = [];
function run(opts = {}) {
  const asked = [];
  const site = {
    ff: async (ids) => {
      asked.push(ids);
      return new Map(ids.filter((id) => FF.has(id)).map((id) => [id, FF.get(id)]));
    },
  };
  const r = runFeature(feature, { url: URL_, html: page('bounties.html'), settings: feature.defaults, site, ...opts });
  running.push(r);
  return { ...r, asked };
}
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));
const hidden = (r) => [...r.doc.querySelectorAll('ul.bounties-list > li[data-id]')]
  .filter((li) => li.hasAttribute('data-ttc-bounty-hide')).map((li) => li.dataset.id);
const type = (r, key, value) => {
  const input = r.doc.querySelector(`[data-filter="${key}"]`);
  input.value = value;
  input.dispatchEvent(new r.window.Event('input', { bubbles: true }));
};

describe('BNT-012 reading the board', () => {
  test('a row gives its target, level, reward, an anonymous lister and a hospital timer', () => {
    const r = run();
    const rows = [...r.doc.querySelectorAll('ul.bounties-list > li')].map(readRow);
    assert.deepEqual(rows[0], { id: 3000001, level: 12, reward: 1_250_000, anonymous: false, hospitalMs: null });
    assert.deepEqual(rows[1], { id: 3000002, level: 45, reward: 80_000, anonymous: true, hospitalMs: 400_000 });
    assert.equal(rows[2].hospitalMs, (2 * 60 + 10) * 60_000);
    assert.equal(rows[3].id, null, 'a row with no target is left alone');
  });

  test('timers as the page may write them', () => {
    assert.equal(timerMs('Hospital 12:30'), 750_000);
    assert.equal(timerMs('1:02:03'), 3_723_000);
    assert.equal(timerMs('1h 20m'), 4_800_000);
    assert.equal(timerMs('45s'), 45_000);
    assert.equal(timerMs('Hospital'), null);
  });

  test('a filter from storage is checked field by field', () => {
    assert.deepEqual(validFilter({ minReward: '5000', maxFf: 2.345, minLevel: -1, maxLevel: 1e9, hideAnonymous: 'yes' }),
      { ...NO_FILTER, minReward: 5000, maxFf: 2.35 });
    assert.deepEqual(validFilter('nonsense'), NO_FILTER);
  });

  test('what the page or the site does not say never hides a row', () => {
    const row = { id: 1, level: null, reward: null, anonymous: false, hospitalMs: null };
    assert.equal(passes(row, { ...NO_FILTER, minReward: 10, minLevel: 5, maxFf: 2 }, { ff: null }), true);
  });
});

describe('BNT-012 on bounties.php', () => {
  test('one batched read for every target, and a badge beside each', async () => {
    const r = run();
    await wait();
    assert.deepEqual(r.asked, [[3000001, 3000002, 3000003]]);
    const badges = [...r.doc.querySelectorAll('.ttc-bounty-ff')].map((b) => b.dataset.player);
    assert.deepEqual(badges, ['3000001', '3000002', '3000003']);
    assert.deepEqual(r.violations, []);
  });

  test('AC5: the filter hides rows below the minimum reward and makes no request', async () => {
    const r = run();
    await wait();
    const before = r.asked.length;
    type(r, 'minReward', '100000');
    assert.deepEqual(hidden(r), ['2']);
    assert.equal(r.doc.querySelector('.ttc-bounty-count').textContent, '2 of 3 shown');
    assert.equal(r.asked.length, before, 'no request');
    assert.deepEqual(r.violations, []);
    type(r, 'minReward', '');
    assert.deepEqual(hidden(r), []);
    assert.equal(r.doc.querySelector('.ttc-bounty-count').textContent, 'All 3 shown');
  });

  test('fair fight, level and anonymous filters', async () => {
    const r = run();
    await wait();
    type(r, 'maxFf', '3');
    assert.deepEqual(hidden(r), ['3']);
    type(r, 'maxFf', '');
    type(r, 'minLevel', '20');
    type(r, 'maxLevel', '60');
    assert.deepEqual(hidden(r), ['1', '3']);
    type(r, 'minLevel', '');
    type(r, 'maxLevel', '');
    const anon = r.doc.querySelector('[data-filter="hideAnonymous"]');
    anon.checked = true;
    anon.dispatchEvent(new r.window.Event('change', { bubbles: true }));
    assert.deepEqual(hidden(r), ['2']);
  });

  test('the filter is kept for the tab', async () => {
    const r = run();
    await wait();
    type(r, 'minReward', '2000000');
    assert.deepEqual(JSON.parse(r.window.sessionStorage.getItem(FILTER_KEY)), { ...NO_FILTER, minReward: 2_000_000 });
  });

  test('a hospital timer under the minutes set is outlined', async () => {
    const r = run();
    await wait();
    const soon = [...r.doc.querySelectorAll('[data-ttc-bounty-soon]')].map((li) => li.dataset.id);
    assert.deepEqual(soon, ['2']);
  });

  test('switching it off takes everything away', async () => {
    const r = run();
    await wait();
    type(r, 'minReward', '100000');
    r.stop();
    assert.equal(r.doc.querySelector('.ttc-bounty'), null);
    assert.equal(r.doc.querySelector('[data-ttc-bounty-hide], [data-ttc-bounty-soon]'), null);
  });

  test('another page: nothing is added', async () => {
    const r = run({ html: '<div class="content-wrapper"></div>' });
    await wait();
    assert.equal(r.doc.querySelector('.ttc-bounty'), null);
    assert.deepEqual(r.asked, []);
  });
});
