// Loadouts on profiles and the attack page (LDT-032).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { slotLine } from '../../src/features/loadout-view/index.js';
import { runFeature } from '../feature-harness.js';

const NOW = Date.parse('2026-10-21T13:00:00Z');
const HTML = '<div class="content-title"><h4>Some Player</h4></div><div id="profile"></div>';

function fakeSite({ loadout = null, war = null } = {}) {
  const calls = [];
  return {
    calls,
    async playerLoadout(id) {
      calls.push(['playerLoadout', id]);
      return loadout;
    },
    async warLoadouts() {
      calls.push(['warLoadouts']);
      return war;
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
const card = (r) => r.doc.querySelector('.ttc-loadout');

const SEEN = {
  seen: true,
  hidden: false,
  seen_at: NOW - 3 * 3_600_000,
  reporters: 2,
  flags: [{ flag: 'heavy_hitter', reason: null }],
  slots: { primary: { item_id: 399, name: 'ArmaLite M-15A4', damage: 76.9, accuracy: 54.4, bonuses: [{ name: 'Penetrate', value: 25 }] } },
};

describe('LDT-032 the profile card, from the open data', () => {
  test('one line per slot, with when and by how many, under the heading', async () => {
    const site = fakeSite({ loadout: SEEN });
    const r = run({ url: 'https://www.torn.com/profiles.php?XID=111', site });
    await wait();
    assert.deepEqual(site.calls, [['playerLoadout', 111]]);
    assert.match(card(r).textContent, /Latest loadout \(seen 3h ago by 2 players, torn-tracker\.com\)/);
    assert.match(card(r).textContent, /Primary: ArmaLite M-15A4 \(76\.9 dmg, 54\.4 acc, Penetrate 25\)/);
    assert.match(card(r).textContent, /Heavy hitter/);
    assert.equal(card(r).previousElementSibling.className, 'content-title');
    assert.deepEqual(r.violations, []);
  });

  test('hidden at the player’s request', async () => {
    const r = run({ url: 'https://www.torn.com/profiles.php?XID=5', site: fakeSite({ loadout: { seen: true, hidden: true } }) });
    await wait();
    assert.match(card(r).textContent, /hidden at the player’s request/);
  });

  test('never seen: no card', async () => {
    const r = run({ url: 'https://www.torn.com/profiles.php?XID=6', site: fakeSite({ loadout: { seen: false } }) });
    await wait();
    assert.equal(card(r), null);
  });

  test('a slot line without stats is just the item', () => {
    assert.equal(slotLine('boots', { name: 'Combat Boots', damage: null, accuracy: null, bonuses: [] }), 'Boots: Combat Boots');
  });
});

describe('LDT-032 flags on the attack page (Pro)', () => {
  const war = {
    pro: true,
    war: true,
    opponents: new Map([[222, { player_id: 222, flags: [{ flag: 'armoured', reason: '5 armour slots' }], hidden: false }]]),
  };

  test('an opponent in the war: their flags beside the heading', async () => {
    const r = run({ url: 'https://www.torn.com/page.php?sid=attack&user2ID=222', site: fakeSite({ war }) });
    await wait();
    assert.equal(card(r).textContent, 'Armoured');
    assert.equal(card(r).title, '5 armour slots');
  });

  test('anyone else: nothing', async () => {
    const r = run({ url: 'https://www.torn.com/page.php?sid=attack&user2ID=333', site: fakeSite({ war }) });
    await wait();
    assert.equal(card(r), null);
  });

  test('a Core faction: nothing', async () => {
    const r = run({ url: 'https://www.torn.com/page.php?sid=attack&user2ID=222', site: fakeSite({ war: { pro: false, war: false, opponents: new Map() } }) });
    await wait();
    assert.equal(card(r), null);
  });
});
