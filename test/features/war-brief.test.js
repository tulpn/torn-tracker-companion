// The pre-war strip on the opponent's faction page (PRE-042, hq #136).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { factionOf, validateBriefData } from '../../src/features/war-brief/index.js';
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
    const r = run({ site: fakeSite({ opponent: 678, compare: COMPARE, headline: "They're larger, older and won 4 of their last 5.", briefUrl: 'https://torn-tracker.com/war/prewar/', pro: true }) });
    await wait();
    assert.match(strip(r).textContent, /^Your next ranked war: They have 92 members/);
    assert.match(strip(r).textContent, /won 4 of their last 5/);
    assert.equal(strip(r).dataset.tone, 'info', 'information, never the red edge (hq #557 E35)');
    assert.equal(strip(r).querySelector('a').getAttribute('href'), 'https://torn-tracker.com/war/prewar/');
    assert.equal(strip(r).previousElementSibling.className, 'content-title');
    assert.deepEqual(r.violations, []);
  });

  test('Core: the compare and a note, never a headline', async () => {
    const r = run({ site: fakeSite({ opponent: 678, compare: COMPARE, headline: null, briefUrl: null, pro: false }) });
    await wait();
    assert.match(strip(r).textContent, /The full brief is a Pro feature\./);
  });

  test('hq #557 30 the Core note once, and the same link words for every tier', async () => {
    const core = { opponent: 678, compare: COMPARE, headline: null, briefUrl: 'https://torn-tracker.com/war/prewar/', pro: false };
    const r = run({ site: fakeSite(core) });
    await wait();
    assert.match(strip(r).textContent, /Pro feature/);
    assert.equal(strip(r).querySelector('a').textContent, 'Open the brief on torn-tracker.com');
    assert.deepEqual(r.stored(), { proNoteSeen: true, shownFor: 678 });
    r.stop();
    const again = run({ site: fakeSite(core), data: { proNoteSeen: true } });
    await wait();
    assert.match(strip(again).textContent, /^Your next ranked war: /);
    assert.doesNotMatch(strip(again).textContent, /Pro feature/);
    assert.equal(strip(again).querySelector('a').textContent, 'Open the brief on torn-tracker.com');
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

describe('hq #557 A6 the strip keeps its place where it showed last time', () => {
  const pro = { opponent: 678, compare: COMPARE, headline: 'Larger.', briefUrl: null, pro: true };

  test('the saved data is checked field by field', () => {
    assert.deepEqual(validateBriefData(null), { proNoteSeen: false, shownFor: null });
    assert.deepEqual(validateBriefData({ proNoteSeen: 'yes', shownFor: -3 }), { proNoteSeen: false, shownFor: null });
    assert.deepEqual(validateBriefData({ proNoteSeen: true, shownFor: 678 }), { proNoteSeen: true, shownFor: 678 });
  });

  test('a first visit adds nothing until the answer, then remembers the page', async () => {
    const r = run({ site: fakeSite(pro) });
    assert.equal(strip(r), null);
    await wait();
    assert.match(strip(r).textContent, /^Your next ranked war: /);
    assert.equal(r.stored().shownFor, 678);
  });

  test('the next visit holds the place at once and fills it in place', async () => {
    const r = run({ site: fakeSite(pro), data: { proNoteSeen: false, shownFor: 678 } });
    assert.equal(strip(r).dataset.loading, 'true');
    assert.equal(strip(r).textContent, 'Your next ranked war: Loading…');
    assert.equal(strip(r).previousElementSibling.className, 'content-title');
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-brief').length, 1);
    assert.equal(strip(r).dataset.loading, undefined);
    assert.match(strip(r).textContent, /Larger\./);
  });

  test('when the war is over the held place goes, and the page is forgotten', async () => {
    const r = run({ site: fakeSite(null), data: { proNoteSeen: true, shownFor: 678 } });
    assert.ok(strip(r));
    await wait();
    assert.equal(strip(r), null);
    assert.deepEqual(r.stored(), { proNoteSeen: true, shownFor: null });
  });

  test('the Core note and the place are saved together', async () => {
    const r = run({ site: fakeSite({ ...pro, headline: null, pro: false }) });
    await wait();
    assert.deepEqual(r.stored(), { proNoteSeen: true, shownFor: 678 });
  });

  test('another faction page holds nothing', () => {
    const r = run({ url: 'https://www.torn.com/factions.php?step=profile&ID=999', site: fakeSite(pro), data: { proNoteSeen: false, shownFor: 678 } });
    assert.equal(strip(r), null);
  });
});
