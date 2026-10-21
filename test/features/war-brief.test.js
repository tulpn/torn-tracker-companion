// The pre-war strip on the opponent's faction page (PRE-042, hq #136).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { factionOf } from '../../src/features/war-brief/index.js';
import { runFeature } from '../feature-harness.js';

const OPPONENT = 'https://www.torn.com/factions.php?step=profile&ID=678';
const HTML = '<div class="content-title"><h4>Their Faction</h4></div><div id="factions"></div>';
const COMPARE = 'They have 92 members (we 88), 4.1m respect, avg level 62, Platinum II, form WWLWW.';

function fakeSite(brief) {
  const calls = [];
  return {
    calls,
    async warBrief() {
      calls.push('warBrief');
      return brief;
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: OPPONENT, html: HTML, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const strip = (r) => r.doc.querySelector('.ttc-brief');

describe('PRE-042 the strip', () => {
  test('only on a faction profile page', () => {
    assert.equal(factionOf('?step=profile&ID=678'), 678);
    assert.equal(factionOf('?step=your'), null);
  });

  test('Pro: the compare, the headline and the link, under the heading', async () => {
    const r = run({ site: fakeSite({ opponent: 678, compare: COMPARE, headline: "They're larger, older and won 4 of their last 5.", briefUrl: 'https://www.torn-tracker.com/war/1/brief/', pro: true }) });
    await wait();
    assert.match(strip(r).textContent, /^Your next ranked war: They have 92 members/);
    assert.match(strip(r).textContent, /won 4 of their last 5/);
    assert.equal(strip(r).querySelector('a').getAttribute('href'), 'https://www.torn-tracker.com/war/1/brief/');
    assert.equal(strip(r).previousElementSibling.className, 'content-title');
    assert.deepEqual(r.violations, []);
  });

  test('Core: the compare and a note, never a headline', async () => {
    const r = run({ site: fakeSite({ opponent: 678, compare: COMPARE, headline: null, briefUrl: null, pro: false }) });
    await wait();
    assert.match(strip(r).textContent, /The full brief is a Pro feature\./);
  });

  test('another faction’s page, or outside the window: nothing', async () => {
    const other = run({ url: 'https://www.torn.com/factions.php?step=profile&ID=999', site: fakeSite({ opponent: 678, compare: COMPARE, headline: null, briefUrl: null, pro: false }) });
    await wait();
    assert.equal(strip(other), null);
  });

  test('no pre-war window: nothing', async () => {
    const r = run({ site: fakeSite(null) });
    await wait();
    assert.equal(strip(r), null);
  });
});
