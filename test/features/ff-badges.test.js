// Fair-fight badges, against saved pages and a stand-in for the site (CMP-101).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { findSpots, idFromHref } from '../../src/features/ff-badges/index.js';
import { UNKNOWN_COLOUR, colourFor, describe as look, textColourFor } from '../../src/features/ff-badges/view.js';
import { page, runFeature } from '../feature-harness.js';

const WAR = 'https://www.torn.com/factions.php?step=your#/war/rank';

/** A site that knows some players, and remembers every lookup. */
function fakeSite(known = {}) {
  const lookups = [];
  return {
    lookups,
    async ff(ids) {
      lookups.push([...ids]);
      return new Map(ids.map((id) => [id, known[id] ?? { ff: null, band: null }]));
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
const badges = (r) => [...r.doc.querySelectorAll('.ttc-ff')];

describe('CMP-101 a badge beside each player, from one batched lookup', () => {
  test('every member row on the war page gets one, from a single lookup', async () => {
    const site = fakeSite({ 101: { ff: 3.2, band: '10m–25m' }, 102: { ff: 1.1, band: '<1m' } });
    const r = run({ html: page('faction-war.html'), url: WAR, site });
    await wait();
    assert.deepEqual(site.lookups, [[101, 102, 201]]);
    assert.deepEqual(badges(r).map((b) => [b.dataset.player, b.textContent]), [['101', '3.20'], ['102', '1.10'], ['201', '?']]);
    assert.deepEqual(r.violations, []);
  });

  test('the badge sits right after the player\'s link, beside Torn\'s nodes, replacing none', async () => {
    const r = run({ html: page('faction-war.html'), url: WAR, site: fakeSite() });
    await wait();
    const link = r.doc.querySelector('a[href="/profiles.php?XID=101"]');
    assert.equal(link.nextElementSibling.classList.contains('ttc-ff'), true);
    assert.equal(link.textContent, 'Enemy One');
  });

  test('an unknown player shows "?" on grey, never a guess', async () => {
    const r = run({ html: page('faction-war.html'), url: WAR, site: fakeSite() });
    await wait();
    const unknown = badges(r)[0];
    assert.equal(unknown.textContent, '?');
    assert.match(unknown.title, /no estimate/);
  });

  test('Torn re-rendering the list does not add a second badge or a lookup per player', async () => {
    const site = fakeSite();
    const r = run({ html: page('faction-war.html'), url: WAR, site });
    await wait();
    const list = r.doc.querySelector('.enemy-faction .members-list');
    list.append(r.doc.createElement('div'));
    await wait();
    assert.equal(badges(r).length, 3);
    assert.equal(site.lookups.length, 1);
  });

  test('a row added later is looked up then, on its own', async () => {
    const site = fakeSite();
    const r = run({ html: page('faction-war.html'), url: WAR, site });
    await wait();
    const row = r.doc.createElement('li');
    row.className = 'enemy';
    const member = r.doc.createElement('div');
    member.className = 'member';
    const link = r.doc.createElement('a');
    link.href = '/profiles.php?XID=103';
    link.textContent = 'Late';
    member.append(link);
    row.append(member);
    r.doc.querySelector('.enemy-faction .members-list').append(row);
    await wait();
    assert.deepEqual(site.lookups[1], [103]);
    assert.equal(badges(r).length, 4);
  });

  test('a profile page badges its subject beside the heading', async () => {
    const site = fakeSite({ 55: { ff: 2, band: null } });
    const r = run({ html: '<div class="content-title"><h4>Someone\'s profile</h4></div>', url: 'https://www.torn.com/profiles.php?XID=55', site });
    await wait();
    assert.deepEqual(site.lookups, [[55]]);
    assert.equal(r.doc.querySelector('h4').nextElementSibling.textContent, '2.00');
  });

  test('stopping the feature takes its badges away', async () => {
    const r = run({ html: page('faction-war.html'), url: WAR, site: fakeSite() });
    await wait();
    feature.stop();
    assert.equal(badges(r).length, 0);
  });

  test('a badge does nothing when clicked', async () => {
    const r = run({ html: page('faction-war.html'), url: WAR, site: fakeSite() });
    await wait();
    const before = r.window.location.href;
    badges(r)[0].dispatchEvent(new r.window.MouseEvent('click', { bubbles: true }));
    assert.equal(r.window.location.href, before);
    assert.deepEqual(r.violations, []);
  });
});

describe('CMP-101 colours as FF Scouter, so players read them the way they already do', () => {
  test('FF 1 is blue, FF 5 and above red, steps in between', () => {
    assert.equal(colourFor(1), '#1734e8');
    assert.equal(colourFor(3), '#34e817');
    assert.equal(colourFor(5), '#e81734');
    assert.equal(colourFor(9), '#e81734');
    assert.equal(colourFor(0.5), '#1734e8');
    assert.equal(colourFor(null), UNKNOWN_COLOUR);
  });

  test('text is black or white, whichever reads', () => {
    assert.equal(textColourFor('#dbe817'), '#000000');
    assert.equal(textColourFor('#1734e8'), '#ffffff');
  });

  test('two decimals, with the band in the tooltip', () => {
    assert.deepEqual(look({ ff: 2.345, band: '1m–5m' }).text, '2.35');
    assert.match(look({ ff: 2.345, band: '1m–5m' }).title, /stats about 1m–5m/);
  });
});

describe('CMP-006 players are found by their profile links', () => {
  test('the id comes from XID and nothing else', () => {
    assert.equal(idFromHref('/profiles.php?XID=123'), 123);
    assert.equal(idFromHref('https://www.torn.com/profiles.php?foo=1&XID=9'), 9);
    assert.equal(idFromHref('/profiles.php?ID=5'), null);
    assert.equal(idFromHref(null), null);
  });

  test('a row without a profile link gets no badge', async () => {
    const r = run({ html: page('faction-war.html'), url: WAR, site: fakeSite() });
    assert.equal(findSpots(r.doc, r.window.location).length, 3);
  });
});
