// Your best runs on the travel agency (TRV-050, hq #78).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { PLANNER, runLine, short, tct } from '../../src/features/travel-panel/index.js';
import { runFeature } from '../feature-harness.js';

const AGENCY = 'https://www.torn.com/travel.php';
const HTML = '<div class="content-wrapper"><div class="content-title"><h4>Travel Agency</h4></div><div class="travel-agency"></div></div>';
const LANDS = Date.parse('2026-10-22T14:20:00Z');

const RUNS = [
  { country: 'mexico', stops: null, item_id: 258, item_name: 'Jaguar Plushie', quantity: 29, profit_per_hour: 13500, lands_at: LANDS, accuracy: '±10 min', hours: 4.3 },
  { country: 'cayman', stops: ['uk'], item_id: 1, item_name: 'Banana Orchid', quantity: 29, profit_per_hour: 9800, lands_at: LANDS, accuracy: null, hours: 6 },
];

function fakeSite(answer = { runs: RUNS, reason: null, basis: 'profit_per_hour' }) {
  const calls = [];
  return {
    calls,
    async travelRuns(limit) {
      calls.push(limit);
      return answer;
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: AGENCY, html: HTML, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const panel = (r) => r.doc.querySelector('.ttc-runs');

describe('TRV-050 a run as one line', () => {
  test('where, what, profit per hour, landing in Torn time and how sure', () => {
    assert.equal(short(13500), '$13.5k');
    assert.equal(short(1_200_000), '$1.2m');
    assert.equal(tct(LANDS), '14:20');
    assert.equal(runLine(RUNS[0]), 'Mexico: 29 Jaguar Plushie, +$13.5k/h, lands 14:20 TCT (±10 min)');
    assert.equal(runLine(RUNS[1]), 'Cayman Islands → United Kingdom: 29 Banana Orchid, +$9.8k/h, lands 14:20 TCT');
  });
});

describe('TRV-050 on the travel agency', () => {
  test('the top runs under the heading, with a link to the planner; no game action', async () => {
    const site = fakeSite();
    const r = run({ site });
    await wait();
    assert.deepEqual(site.calls, [3]);
    assert.equal(panel(r).previousElementSibling.className, 'content-title');
    assert.equal(panel(r).querySelectorAll('li').length, 2);
    assert.equal(panel(r).querySelector('a').getAttribute('href'), PLANNER);
    assert.deepEqual(r.violations, []);
  });

  test('no capacity known yet: says how to fix it', async () => {
    const r = run({ site: fakeSite({ runs: [], reason: 'no_capacity', basis: null }) });
    await wait();
    assert.match(panel(r).textContent, /doesn't know how much you can carry/);
  });

  test('no answer: no panel', async () => {
    const r = run({ site: fakeSite(null) });
    await wait();
    assert.equal(panel(r), null);
  });
});
