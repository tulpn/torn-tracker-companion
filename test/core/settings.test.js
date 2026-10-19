import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createRegistry } from '../../src/core/registry.js';
import { defaults, isEnabled, isShared, normalize } from '../../src/core/settings.js';
import { descriptor } from '../fixtures.js';

const registry = createRegistry([
  descriptor({ id: 'war-enhancer', shares: ['loadout'] }),
  descriptor({ id: 'ff-badges', defaults: { enabled: false }, shares: [] }),
  descriptor({ id: 'travel', defaults: { enabled: true, capacity: 5 }, shares: ['foreign_stock'] }),
]);

describe('CMP-003 defaults come from the descriptors', () => {
  test('each feature gets its own declared defaults', () => {
    const base = defaults(registry);
    assert.deepEqual(base.features['war-enhancer'], { enabled: true, sortBy: 'status' });
    assert.equal(base.features['ff-badges'].enabled, false);
    assert.equal(base.features.travel.capacity, 5);
  });
});

describe('CMP-014 every sharing switch starts off', () => {
  test('defaults say no to every kind', () => {
    assert.deepEqual(defaults(registry).shares, { foreign_stock: false, loadout: false });
  });

  test('only an explicit true turns one on', () => {
    const settings = normalize({ shares: { loadout: 'yes', foreign_stock: true } }, registry);
    assert.equal(settings.shares.loadout, false);
    assert.equal(settings.shares.foreign_stock, true);
    assert.equal(isShared(settings, 'foreign_stock'), true);
  });

  test('a kind this build does not have is dropped', () => {
    const settings = normalize({ shares: { crime_outcome: true } }, registry);
    assert.equal('crime_outcome' in settings.shares, false);
  });
});

describe('CMP-008 settings from storage are validated field by field', () => {
  test('a value of the wrong type falls back to the default', () => {
    const settings = normalize({
      debug: 'yes',
      features: { 'war-enhancer': { enabled: 1, sortBy: 'level' }, travel: { capacity: 'lots' } },
    }, registry);
    assert.equal(settings.debug, false);
    assert.equal(settings.features['war-enhancer'].enabled, true);
    assert.equal(settings.features['war-enhancer'].sortBy, 'level');
    assert.equal(settings.features.travel.capacity, 5);
  });

  test('NaN and Infinity are not numbers we keep', () => {
    const settings = normalize({ features: { travel: { capacity: Number.NaN } } }, registry);
    assert.equal(settings.features.travel.capacity, 5);
  });

  test('unknown features and unknown options are dropped', () => {
    const settings = normalize({
      junk: true,
      features: { 'not-a-feature': { enabled: true }, travel: { enabled: false, junk: 1 } },
    }, registry);
    assert.equal('junk' in settings, false);
    assert.equal('not-a-feature' in settings.features, false);
    assert.deepEqual(settings.features.travel, { enabled: false, capacity: 5 });
  });

  test('garbage in storage gives the defaults back', () => {
    for (const raw of [null, undefined, 'nonsense', 42, []]) {
      assert.deepEqual(normalize(raw, registry), defaults(registry));
    }
  });

  test('normalizing twice changes nothing', () => {
    const once = normalize({ features: { travel: { enabled: false } } }, registry);
    assert.deepEqual(normalize(once, registry), once);
  });
});

describe('CMP-003 a feature is on only when its switch says so', () => {
  test('isEnabled reads the feature\'s own switch', () => {
    const settings = defaults(registry);
    assert.equal(isEnabled(settings, 'war-enhancer'), true);
    assert.equal(isEnabled(settings, 'ff-badges'), false);
    assert.equal(isEnabled(settings, 'not-a-feature'), false);
    assert.equal(isEnabled(undefined, 'war-enhancer'), false);
  });
});
