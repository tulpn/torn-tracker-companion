// Your mugging history with a player, on profiles and attacks (MUG-030, MUG-031).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { mugLine, validateMugData, withShown } from '../../src/features/mug-strip/index.js';
import { runFeature } from '../feature-harness.js';

const NOW = Date.parse('2026-10-21T13:00:00Z');
const HTML = '<div class="content-title"><h4>Some Player</h4></div>';

function fakeSite(answer) {
  const calls = [];
  return {
    calls,
    async myMugs(id) {
      calls.push(id);
      return answer;
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { html: HTML, now: () => NOW, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const strip = (r) => r.doc.querySelector('.ttc-mugs');

describe('MUG-030 the line', () => {
  test('count, last and average; once has no average', () => {
    assert.equal(mugLine({ count: 3, last_at: NOW - 2 * 86_400_000, last_amount: 1_200_000, average: 900_000 }, NOW),
      'You mugged them 3 times: last 2d ago for $1,200,000, $900,000 on average.');
    assert.equal(mugLine({ count: 1, last_at: NOW - 3_600_000, last_amount: 50_000, average: 50_000 }, NOW),
      'You mugged them once: last 1h ago for $50,000.');
    assert.equal(mugLine({ count: 0, last_at: null, last_amount: null, average: null }, NOW), null);
    assert.equal(mugLine(null, NOW), null);
  });
});

describe('MUG-030 on the page', () => {
  test('on a profile: your own history under the heading', async () => {
    const site = fakeSite({ count: 2, last_at: NOW - 86_400_000, last_amount: 10_000, average: 8_000 });
    const r = run({ url: 'https://www.torn.com/profiles.php?XID=111', site });
    await wait();
    assert.deepEqual(site.calls, [111]);
    assert.match(strip(r).textContent, /^You mugged them 2 times/);
    assert.equal(strip(r).previousElementSibling.className, 'content-title');
    assert.ok(strip(r).classList.contains('ttc-ui-strip'), 'hq #557 E36: a strip, not a pill');
    assert.equal(strip(r).dataset.tone, 'info');
    assert.deepEqual(r.violations, []);
  });

  test('on the attack page, for the player being attacked; nothing filled or clicked', async () => {
    const site = fakeSite({ count: 1, last_at: null, last_amount: 5_000, average: 5_000 });
    const r = run({ url: 'https://www.torn.com/page.php?sid=attack&user2ID=222', site });
    await wait();
    assert.deepEqual(site.calls, [222]);
    assert.equal(strip(r).textContent, 'You mugged them once: for $5,000.');
    assert.deepEqual(r.violations, []);
  });

  test('never mugged them, or no answer: no strip', async () => {
    const r = run({ url: 'https://www.torn.com/profiles.php?XID=3', site: fakeSite({ count: 0, last_at: null, last_amount: null, average: null }) });
    await wait();
    assert.equal(strip(r), null);
  });
});

describe('hq #557 A6 the strip keeps its place where it showed last time', () => {
  const two = { count: 2, last_at: null, last_amount: 10_000, average: 8_000 };
  const none = { count: 0, last_at: null, last_amount: null, average: null };

  test('the saved list: whole positive ids, no repeats, the newest 50', () => {
    assert.deepEqual(validateMugData(null), { shownFor: [] });
    assert.deepEqual(validateMugData({ shownFor: [1, 1, -2, 'x', 3.5, 4] }), { shownFor: [1, 4] });
    const many = Array.from({ length: 60 }, (_, i) => i + 1);
    assert.deepEqual(validateMugData({ shownFor: many }).shownFor, many.slice(10));
    assert.deepEqual(withShown([1, 2, 3], 1, true), [2, 3, 1]);
    assert.deepEqual(withShown([1, 2, 3], 2, false), [1, 3]);
  });

  test('a first visit adds nothing until the answer, then remembers the player', async () => {
    const r = run({ url: 'https://www.torn.com/profiles.php?XID=111', site: fakeSite(two) });
    assert.equal(strip(r), null);
    await wait();
    assert.match(strip(r).textContent, /^You mugged them 2 times/);
    assert.deepEqual(r.stored(), { shownFor: [111] });
  });

  test('the next visit holds the place at once and fills it in place', async () => {
    const r = run({ url: 'https://www.torn.com/profiles.php?XID=111', site: fakeSite(two), data: { shownFor: [111] } });
    assert.equal(strip(r).dataset.loading, 'true');
    assert.equal(strip(r).textContent, 'Your mugs of this player: Loading…');
    assert.equal(strip(r).previousElementSibling.className, 'content-title');
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-mugs').length, 1);
    assert.equal(strip(r).dataset.loading, undefined);
    assert.match(strip(r).textContent, /^You mugged them 2 times/);
  });

  test('no mugs any more: the held place goes and the player is forgotten', async () => {
    const r = run({ url: 'https://www.torn.com/profiles.php?XID=111', site: fakeSite(none), data: { shownFor: [5, 111] } });
    assert.ok(strip(r));
    await wait();
    assert.equal(strip(r), null);
    assert.deepEqual(r.stored(), { shownFor: [5] });
  });

  test('a player not remembered holds nothing', () => {
    const r = run({ url: 'https://www.torn.com/profiles.php?XID=7', site: fakeSite(two), data: { shownFor: [111] } });
    assert.equal(strip(r), null);
  });
});
