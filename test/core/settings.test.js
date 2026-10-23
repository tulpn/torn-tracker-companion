import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createRegistry } from '../../src/core/registry.js';
import { defaults, isEnabled, isShared, normalize } from '../../src/core/settings.js';
import { UNWORDED, WORDED, descriptor } from '../fixtures.js';

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
    assert.equal(isShared({ ...settings, sharingConsent: WORDED.version }, 'foreign_stock', WORDED), true);
  });

  test('a switch that is on is not sharing until the current wording is agreed', () => {
    const settings = normalize({ shares: { foreign_stock: true } }, registry);
    assert.equal(settings.sharingConsent, 0);
    assert.equal(isShared(settings, 'foreign_stock', WORDED), false);
    assert.equal(isShared({ ...settings, sharingConsent: WORDED.version }, 'foreign_stock', UNWORDED), false,
      'and with no wording at all, never');
  });

  test('the agreed version is kept only when it is a positive whole number', () => {
    for (const bad of [-1, 1.5, '2', null]) {
      assert.equal(normalize({ sharingConsent: bad }, registry).sharingConsent, 0);
    }
    assert.equal(normalize({ sharingConsent: 3 }, registry).sharingConsent, 3);
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

  test('the settings page\'s look is dark, light or Torn\'s, and dark otherwise', () => {
    assert.equal(normalize({}, registry).look, 'dark');
    assert.equal(normalize({ look: 'torn' }, registry).look, 'torn');
    assert.equal(normalize({ look: 'purple' }, registry).look, 'dark');
    assert.equal(normalize({ look: 1 }, registry).look, 'dark');
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

describe('CMP-008 an option outside what its descriptor allows falls back to the default', () => {
  const described = createRegistry([descriptor({
    defaults: { enabled: true, sortBy: 'status', undercut: 1 },
    options: { sortBy: { label: 'Sort by', choices: ['status', 'level'] }, undercut: { label: 'Undercut', min: 0, max: 100 } },
  })]);

  test('a choice that is not offered, or a number out of range, is not kept', () => {
    const settings = normalize({ features: { 'war-enhancer': { sortBy: 'random', undercut: 500 } } }, described);
    assert.deepEqual(settings.features['war-enhancer'], { enabled: true, sortBy: 'status', undercut: 1 });
  });

  test('values inside the bounds are kept', () => {
    const settings = normalize({ features: { 'war-enhancer': { sortBy: 'level', undercut: 100 } } }, described);
    assert.equal(settings.features['war-enhancer'].sortBy, 'level');
    assert.equal(settings.features['war-enhancer'].undercut, 100);
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

describe('CMP-108 the sidebar block’s switches', () => {
  test('on by default, with the spec’s items on and off', () => {
    const { sidebar } = defaults(registry);
    assert.equal(sidebar.enabled, true);
    assert.deepEqual(Object.entries(sidebar.items).filter(([, on]) => !on).map(([id]) => id), ['travel', 'loot', 'gym', 'stocks']);
  });

  test('saved switches are kept; wrong types and unknown items fall back or go', () => {
    const out = normalize({ sidebar: { enabled: 'no', items: { gym: true, chain: false, wrapped: true, war: 1 } } }, registry);
    assert.equal(out.sidebar.enabled, true);
    assert.equal(out.sidebar.items.gym, true);
    assert.equal(out.sidebar.items.chain, false);
    assert.equal(out.sidebar.items.war, true);
    assert.equal('wrapped' in out.sidebar.items, false);
  });

  test('settings from before the block get its defaults (AC6)', () => {
    const out = normalize({ debug: true, features: {} }, registry);
    assert.equal(out.debug, true);
    assert.deepEqual(out.sidebar, defaults(registry).sidebar);
  });
});
