import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createRegistry } from '../../src/core/registry.js';
import { createSharer, isApplicationPage } from '../../src/core/share.js';
import { defaults } from '../../src/core/settings.js';
import { DISCLOSURE } from '../../src/core/disclosure.js';
import { UNWORDED, WORDED, descriptor, loadoutData } from '../fixtures.js';

function sharerFor({
  shares = ['loadout'], on = [], consent = WORDED.version, disclosure = WORDED, now,
  at = 'https://www.torn.com/page.php?sid=attack&user2ID=1',
} = {}) {
  const d = descriptor({ shares });
  const registry = createRegistry([d]);
  const settings = defaults(registry);
  settings.sharingConsent = consent;
  for (const kind of on) settings.shares[kind] = true;
  const queued = [];
  const share = createSharer({
    descriptor: d, getSettings: () => settings, sink: (o) => queued.push(o), disclosure, now,
    getLocation: () => new URL(at),
  });
  return { share, queued, settings };
}

describe('CMP-014 nothing is shared until the player switches the kind on', () => {
  test('a kind that is off queues nothing', () => {
    const { share, queued } = sharerFor();
    assert.equal(share('loadout', loadoutData()), false);
    assert.deepEqual(queued, []);
  });

  test('a kind the player switched on is queued', () => {
    const { share, queued } = sharerFor({ on: ['loadout'] });
    assert.equal(share('loadout', loadoutData()), true);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].player_id, 123);
  });

  test('switching the kind back off stops it again', () => {
    const { share, queued, settings } = sharerFor({ on: ['loadout'] });
    share('loadout', loadoutData());
    settings.shares.loadout = false;
    share('loadout', loadoutData());
    assert.equal(queued.length, 1);
  });

  test('a feature cannot share a kind it did not declare', () => {
    const { share, queued, settings } = sharerFor({ shares: ['loadout'], on: ['loadout'] });
    settings.shares.foreign_stock = true; // even if somehow switched on
    assert.equal(share('foreign_stock', { country: 'mexico' }), false);
    assert.deepEqual(queued, []);
  });
});

describe('CMP-014 a switch shares nothing until the player agreed to the current wording', () => {
  test('without agreement, a kind that is on queues nothing', () => {
    const { share, queued } = sharerFor({ on: ['loadout'], consent: 0 });
    assert.equal(share('loadout', loadoutData()), false);
    assert.deepEqual(queued, []);
  });

  test('agreement to an older wording is not agreement to this one', () => {
    const { share, queued } = sharerFor({ on: ['loadout'], consent: WORDED.version - 1 });
    assert.equal(share('loadout', loadoutData()), false);
    assert.deepEqual(queued, []);
  });

  test("while the owner's wording is missing, nothing can be shared at all", () => {
    const { share, queued } = sharerFor({ on: ['loadout'], consent: 1, disclosure: UNWORDED });
    assert.equal(share('loadout', loadoutData()), false);
    assert.deepEqual(queued, []);
  });

  test('a kind without its own line is not shared even with the notice agreed', () => {
    const disclosure = { ...WORDED, kinds: { foreign_stock: 'only this one' } };
    const { share, queued } = sharerFor({ on: ['loadout'], disclosure });
    assert.equal(share('loadout', loadoutData()), false);
    assert.deepEqual(queued, []);
  });
});

describe('CMP-014 every observation says when and from which version', () => {
  test('it is flat, the way the site takes it, with observed_at and script_version', () => {
    const { share, queued } = sharerFor({ on: ['loadout'] });
    share('loadout', loadoutData());
    const [observation] = queued;
    assert.equal(observation.kind, 'loadout');
    assert.match(observation.observed_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(typeof observation.script_version, 'string');
    assert.equal('data' in observation, false);
    assert.equal(observation.context, 'attack');
  });

  test('observed_at comes from the corrected clock it is given', () => {
    const { share, queued } = sharerFor({ on: ['loadout'], now: () => Date.UTC(2026, 9, 19, 12) });
    share('loadout', loadoutData());
    assert.equal(queued[0].observed_at, '2026-10-19T12:00:00.000Z');
  });

  test('a feature cannot overwrite the kind, the time or the version', () => {
    const { share, queued } = sharerFor({ on: ['loadout'] });
    share('loadout', { ...loadoutData(), kind: 'foreign_stock', observed_at: '2000-01-01T00:00:00Z', script_version: 'x' });
    assert.equal(queued[0].kind, 'loadout');
    assert.notEqual(queued[0].observed_at, '2000-01-01T00:00:00.000Z');
    assert.notEqual(queued[0].script_version, 'x');
  });

  test('the queue refusing an observation is reported as not shared', () => {
    const d = descriptor();
    const settings = { ...defaults(createRegistry([d])), sharingConsent: WORDED.version };
    settings.shares.loadout = true;
    const share = createSharer({ descriptor: d, getSettings: () => settings, sink: () => false, disclosure: WORDED });
    assert.equal(share('loadout', loadoutData()), false);
  });
});

describe("D-056 nothing is recorded on Torn's application pages", () => {
  test('a kind that is on and agreed to still shares nothing there', () => {
    for (const at of [
      'https://www.torn.com/companies.php?step=applications',
      'https://www.torn.com/companies.php#/option=applications',
      'https://www.torn.com/factions.php?step=your#/tab=controls&option=application',
      'https://www.torn.com/joblist.php#!p=corpinfo&ID=1&applications',
    ]) {
      const { share, queued } = sharerFor({ on: ['loadout'], at });
      assert.equal(share('loadout', loadoutData()), false, at);
      assert.deepEqual(queued, [], at);
    }
  });

  test('the rest of those sites is not affected', () => {
    for (const at of ['https://www.torn.com/factions.php#/war/rank', 'https://www.torn.com/companies.php']) {
      assert.equal(isApplicationPage(new URL(at)), false, at);
    }
    assert.equal(isApplicationPage(new URL('https://www.torn.com/profiles.php?XID=1#applications')), false,
      'only company, faction and job pages');
  });
});
