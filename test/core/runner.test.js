import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createRegistry } from '../../src/core/registry.js';
import { FeatureRunner } from '../../src/core/runner.js';
import { defaults } from '../../src/core/settings.js';
import { locationOf, spyDescriptor } from '../fixtures.js';

function runnerFor(descriptors, over = {}) {
  const registry = createRegistry(descriptors);
  const settings = { ...defaults(registry), ...over };
  const runner = new FeatureRunner({
    registry,
    getSettings: () => settings,
    makeContext: (d) => ({ id: d.id }),
  });
  return { registry, settings, runner };
}

const WAR = '/factions.php#/war/rank';
const PROFILE = '/profiles.php?XID=1';

describe('CMP-003 a switched-off feature never starts', () => {
  test('start is not called when the switch is off', () => {
    const feature = spyDescriptor();
    const { runner, settings } = runnerFor([feature]);
    settings.features[feature.id].enabled = false;
    runner.update(locationOf(WAR));
    assert.deepEqual(feature.calls, []);
    assert.equal(runner.active.has(feature.id), false);
  });

  test('turning it off again stops it', () => {
    const feature = spyDescriptor();
    const { runner, settings } = runnerFor([feature]);
    runner.update(locationOf(WAR));
    assert.equal(feature.calls[0][0], 'start');
    settings.features[feature.id].enabled = false;
    runner.update(locationOf(WAR));
    assert.deepEqual(feature.calls.map(([name]) => name), ['start', 'stop']);
  });
});

describe('CMP-005 features follow the player around the site', () => {
  test('it starts on its route and stops when the player leaves', () => {
    const feature = spyDescriptor();
    const { runner } = runnerFor([feature]);

    runner.update(locationOf(PROFILE));
    assert.deepEqual(feature.calls, []);

    runner.update(locationOf(WAR));
    assert.deepEqual(feature.calls.map(([name]) => name), ['start']);

    runner.update(locationOf(PROFILE));
    assert.deepEqual(feature.calls.map(([name]) => name), ['start', 'stop']);
  });

  test('staying on the same route does not restart it', () => {
    const feature = spyDescriptor();
    const { runner } = runnerFor([feature]);
    runner.update(locationOf(WAR));
    runner.update(locationOf('/factions.php#/war/rank?sort=level'));
    assert.deepEqual(feature.calls.map(([name]) => name), ['start']);
  });

  test('a feature is handed its own settings through the context', () => {
    const feature = spyDescriptor();
    const registry = createRegistry([feature]);
    const settings = defaults(registry);
    const runner = new FeatureRunner({
      registry,
      getSettings: () => settings,
      makeContext: (d) => ({ id: d.id, settings: settings.features[d.id] }),
    });
    runner.update(locationOf(WAR));
    assert.equal(feature.calls[0][1].settings.sortBy, 'status');
  });
});

describe('CMP-004 one broken feature does not take the others down', () => {
  test('a feature that throws in start is switched off for the page view', () => {
    const broken = spyDescriptor({
      id: 'broken',
      start() {
        throw new Error('Torn moved the table');
      },
    });
    const fine = spyDescriptor({ id: 'fine' });
    const { runner } = runnerFor([broken, fine]);

    runner.update(locationOf(WAR));
    assert.equal(runner.broken.has('broken'), true);
    assert.equal(runner.active.has('broken'), false);
    assert.deepEqual(fine.calls.map(([name]) => name), ['start']);

    // and it is not tried again while the player is on this page
    runner.update(locationOf(PROFILE));
    runner.update(locationOf(WAR));
    assert.equal(runner.broken.has('broken'), true);
    assert.deepEqual(fine.calls.map(([name]) => name), ['start', 'stop', 'start']);
  });

  test('a feature that throws in start still gets a chance to clean up', () => {
    const cleaned = [];
    const broken = spyDescriptor({
      id: 'broken',
      start() {
        throw new Error('half started');
      },
      stop() {
        cleaned.push('stop');
      },
    });
    const { runner } = runnerFor([broken]);
    runner.update(locationOf(WAR));
    assert.deepEqual(cleaned, ['stop']);
  });

  test('a feature that throws in stop does not stop the others stopping', () => {
    const broken = spyDescriptor({
      id: 'broken',
      stop() {
        throw new Error('nope');
      },
    });
    const fine = spyDescriptor({ id: 'fine' });
    const { runner } = runnerFor([broken, fine]);
    runner.update(locationOf(WAR));
    runner.stopAll();
    assert.deepEqual(fine.calls.map(([name]) => name), ['start', 'stop']);
    assert.equal(runner.active.size, 0);
  });

  test('a new page view forgives what broke on the last one', () => {
    let fail = true;
    const flaky = spyDescriptor({
      id: 'flaky',
      start() {
        if (fail) throw new Error('once');
      },
    });
    const { runner } = runnerFor([flaky]);
    runner.update(locationOf(WAR));
    assert.equal(runner.broken.has('flaky'), true);

    fail = false;
    runner.reset();
    runner.update(locationOf(WAR));
    assert.equal(runner.active.has('flaky'), true);
  });
});
