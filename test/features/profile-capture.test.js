// The profile features on Torn's real profile markup (hq #313): the owner's capture of
// Duke's profile (an NPC, so nothing about a player), test/fixtures/pages/profile-npc.html.
// The synthetic profile.html stays for a faction member with a level; this one checks the
// anchors every feature hangs off are where Torn really puts them.

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import mugStrip from '../../src/features/mug-strip/index.js';
import loadoutView from '../../src/features/loadout-view/index.js';
import playerNotes from '../../src/features/player-notes/index.js';
import addToList from '../../src/features/add-to-list/index.js';
import { readProfile } from '../../src/features/message-templates/index.js';
import { page, runFeature } from '../feature-harness.js';

const NOW = Date.parse('2026-10-21T13:00:00Z');
const URL = 'https://www.torn.com/profiles.php?XID=4';
const HTML = page('profile-npc.html');
const LIST = '11111111-1111-4111-8111-111111111111';

const site = {
  calls: [],
  async myMugs(id) {
    this.calls.push(['myMugs', id]);
    return { count: 2, last_at: NOW - 86_400_000, last_amount: 10_000, average: 8_000 };
  },
  async playerLoadout(id) {
    this.calls.push(['playerLoadout', id]);
    return { seen: true, hidden: false, seen_at: NOW - 3_600_000, reporters: 1, flags: [], slots: { primary: { item_id: 399, name: 'ArmaLite M-15A4', damage: 76.9, accuracy: 54.4, bonuses: [] } } };
  },
  async warLoadouts() {
    return null;
  },
  async lists(id) {
    this.calls.push(['lists', id]);
    return { status: 'ok', lists: [{ uuid: LIST, name: 'Chain targets', shared: false, contains: false }], lastUsed: LIST };
  },
};

const running = [];
const run = (feature) => {
  site.calls = [];
  const r = runFeature(feature, { html: HTML, url: URL, now: () => NOW, site });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

/** Torn's own parts of the page are where they were and as many as before. */
function untouched(r) {
  const title = r.doc.querySelector('.content-title');
  assert.ok(title.querySelector('h4#skip-to-content'), 'the heading stays in the title bar');
  assert.ok(title.querySelector('.links-top-wrap #top-page-links-list'), 'Torn\'s page links stay');
  assert.equal(r.doc.querySelectorAll('.basic-information .info-table > li').length, 12);
  assert.deepEqual(r.violations, []);
}

describe('hq #313 the profile features on the captured profile', () => {
  test('the page is Duke\'s: the heading is "Name [id]", the id comes from the address', () => {
    const r = run(playerNotes);
    assert.equal(r.doc.querySelector('.content-title h4').textContent, 'Duke [4]');
    assert.deepEqual(readProfile(r.doc, 4), { name: 'Duke', id: '4', faction: null, level: null },
      'an NPC: "N/A" is no faction, and the table has no Level row');
  });

  test('MUG-030 the mug line goes under the title bar, once', async () => {
    const r = run(mugStrip);
    await wait();
    const strip = r.doc.querySelectorAll('.ttc-mugs');
    assert.equal(strip.length, 1);
    assert.ok(strip[0].previousElementSibling.classList.contains('content-title'));
    assert.deepEqual(site.calls, [['myMugs', 4]]);
    untouched(r);
  });

  test('LDT-032 the loadout card goes under the title bar, once', async () => {
    const r = run(loadoutView);
    await wait();
    const card = r.doc.querySelectorAll('.ttc-loadout');
    assert.equal(card.length, 1);
    assert.ok(card[0].previousElementSibling.classList.contains('content-title'));
    assert.match(card[0].textContent, /Primary: ArmaLite M-15A4/);
    untouched(r);
  });

  test('CMP-308 the note toggle sits beside the heading', async () => {
    const r = run(playerNotes);
    await wait();
    const toggle = r.doc.querySelector('.ttc-notes-toggle');
    assert.ok(toggle);
    assert.equal(toggle.parentElement, r.doc.querySelector('.content-title'));
    untouched(r);
  });

  test('CMP-110 the list button sits beside the heading and reads once', async () => {
    const r = run(addToList);
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-lists-main').length, 1);
    assert.equal(r.doc.querySelector('h4#skip-to-content').nextElementSibling.classList.contains('ttc-lists'), true);
    assert.equal(r.doc.querySelector('.ttc-lists-main').textContent, 'Add to Chain targets');
    assert.deepEqual(site.calls, [['lists', 4]]);
    untouched(r);
  });
});
