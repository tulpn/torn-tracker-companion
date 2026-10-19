import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createRegistry } from '../../src/core/registry.js';
import { createSharer } from '../../src/core/share.js';
import { defaults } from '../../src/core/settings.js';
import { descriptor } from '../fixtures.js';

function sharerFor({ shares = ['loadout'], on = [] } = {}) {
  const d = descriptor({ shares });
  const registry = createRegistry([d]);
  const settings = defaults(registry);
  for (const kind of on) settings.shares[kind] = true;
  const queued = [];
  return { share: createSharer({ descriptor: d, getSettings: () => settings, sink: (o) => queued.push(o) }), queued, settings };
}

describe('CMP-014 nothing is shared until the player switches the kind on', () => {
  test('a kind that is off queues nothing', () => {
    const { share, queued } = sharerFor();
    assert.equal(share('loadout', { player_id: 1 }), false);
    assert.deepEqual(queued, []);
  });

  test('a kind the player switched on is queued', () => {
    const { share, queued } = sharerFor({ on: ['loadout'] });
    assert.equal(share('loadout', { player_id: 1 }), true);
    assert.equal(queued.length, 1);
    assert.deepEqual(queued[0].data, { player_id: 1 });
  });

  test('switching the kind back off stops it again', () => {
    const { share, queued, settings } = sharerFor({ on: ['loadout'] });
    share('loadout', { player_id: 1 });
    settings.shares.loadout = false;
    share('loadout', { player_id: 2 });
    assert.equal(queued.length, 1);
  });

  test('a feature cannot share a kind it did not declare', () => {
    const { share, queued, settings } = sharerFor({ shares: ['loadout'], on: ['loadout'] });
    settings.shares.foreign_stock = true; // even if somehow switched on
    assert.equal(share('foreign_stock', { country: 'mex' }), false);
    assert.deepEqual(queued, []);
  });
});

describe('CMP-014 every observation says when and from which version', () => {
  test('observed_at and script_version travel with it', () => {
    const { share, queued } = sharerFor({ on: ['loadout'] });
    share('loadout', { player_id: 1 });
    const [observation] = queued;
    assert.equal(observation.kind, 'loadout');
    assert.match(observation.observed_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(typeof observation.script_version, 'string');
  });
});
