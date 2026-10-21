// Your mugging history with a player, on profiles and attacks (MUG-030, MUG-031).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { mugLine } from '../../src/features/mug-strip/index.js';
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
