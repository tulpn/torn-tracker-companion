// The after-sale mug badge on profiles and the attack page (TRU-023, TRU-025).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { badgeText, badgeTitle } from '../../src/features/mugger-badge/index.js';
import { runFeature } from '../feature-harness.js';

const SAFETY = 'https://www.torn-tracker.com/trust/safety/';
const HEADING = '<div class="content-title"><h4>Someone\'s profile</h4></div>';
const LISTED = { listed: true, mugs30: 3, mugs90: 5, lastAt: Date.UTC(2026, 9, 20, 12) };

/** A site that lists some players, and remembers every lookup. */
function fakeSite(listed = {}, safetyUrl = SAFETY) {
  const lookups = [];
  return {
    lookups,
    async muggers(ids) {
      lookups.push([...ids]);
      return { players: new Map(ids.map((id) => [id, listed[id] ?? { listed: false }])), safetyUrl };
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, opts);
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});

const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const badges = (r) => [...r.doc.querySelectorAll('.ttc-mugger')];

describe('TRU-025 a badge on a listed player\'s profile and attack page', () => {
  test('a listed player\'s profile gets one badge beside the heading, linking to seller safety', async () => {
    const site = fakeSite({ 55: LISTED });
    const r = run({ html: HEADING, url: 'https://www.torn.com/profiles.php?XID=55', site });
    await wait();
    assert.deepEqual(site.lookups, [[55]]);
    const node = r.doc.querySelector('h4').nextElementSibling;
    assert.equal(node.classList.contains('ttc-mugger'), true);
    assert.equal(node.textContent, 'Mugged sellers: 3 in 30 days');
    assert.equal(node.tagName, 'A');
    assert.equal(node.getAttribute('href'), SAFETY);
    assert.equal(node.getAttribute('target'), '_blank');
    assert.deepEqual(r.violations, []);
  });

  test('the attack page badges the defender', async () => {
    const site = fakeSite({ 77: LISTED });
    const r = run({ html: HEADING, url: 'https://www.torn.com/loader.php?sid=attack&user2ID=77', site });
    await wait();
    assert.deepEqual(site.lookups, [[77]]);
    assert.equal(badges(r).length, 1);
  });

  test('a player who is not listed gets nothing at all', async () => {
    const r = run({ html: HEADING, url: 'https://www.torn.com/profiles.php?XID=56', site: fakeSite() });
    await wait();
    assert.equal(badges(r).length, 0);
  });

  test('without a safety link the badge is plain text', async () => {
    const r = run({ html: HEADING, url: 'https://www.torn.com/profiles.php?XID=55', site: fakeSite({ 55: LISTED }, null) });
    await wait();
    assert.equal(badges(r)[0].tagName, 'SPAN');
  });

  test('Torn re-rendering the page adds no second badge or lookup', async () => {
    const site = fakeSite({ 55: LISTED });
    const r = run({ html: HEADING, url: 'https://www.torn.com/profiles.php?XID=55', site });
    await wait();
    r.doc.body.append(r.doc.createElement('div'));
    await wait();
    assert.equal(badges(r).length, 1);
    assert.equal(site.lookups.length, 1);
  });

  test('stopping the feature takes the badge away', async () => {
    const r = run({ html: HEADING, url: 'https://www.torn.com/profiles.php?XID=55', site: fakeSite({ 55: LISTED }) });
    await wait();
    feature.stop();
    assert.equal(badges(r).length, 0);
  });
});

describe('TRU-002 facts, never accusations, and never the reporters', () => {
  test('the badge counts the last 30 days, or 90 when the 30 are empty', () => {
    assert.equal(badgeText(LISTED), 'Mugged sellers: 3 in 30 days');
    assert.equal(badgeText({ ...LISTED, mugs30: 0 }), 'Mugged sellers: 5 in 90 days');
  });

  test('the tooltip gives both counts and the last report, with the advice', () => {
    const title = badgeTitle(LISTED);
    assert.match(title, /3 mugs in the last 30 days, 5 in 90/);
    assert.match(title, /Last reported 20 Oct 2026/);
    assert.match(title, /Bank your cash before you sell/);
    assert.doesNotMatch(`${title} ${badgeText(LISTED)}`, /scam|cheat|\bbot\b/i);
    assert.doesNotMatch(badgeTitle({ ...LISTED, lastAt: null }), /Last reported/);
  });
});
