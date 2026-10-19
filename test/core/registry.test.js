import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { byId, createRegistry, shareKinds, validateDescriptor } from '../../src/core/registry.js';
import { descriptor } from '../fixtures.js';

describe('CMP-002 every feature exports one descriptor', () => {
  test('a complete descriptor passes', () => {
    assert.doesNotThrow(() => validateDescriptor(descriptor()));
  });

  for (const [what, over] of [
    ['a missing id', { id: undefined }],
    ['an id that is not kebab-case', { id: 'War Enhancer' }],
    ['no wave', { wave: undefined }],
    ['no title', { title: '' }],
    ['no routes', { routes: [] }],
    ['a route that is not a string', { routes: [42] }],
    ['defaults without enabled', { defaults: { sortBy: 'status' } }],
    ['an object in defaults', { defaults: { enabled: true, sort: { by: 'status' } } }],
    ['shares that is not an array', { shares: 'loadout' }],
    ['a kind core/kinds.js does not define', { shares: ['battle_stats'] }],
    ['an option with no default', { options: { colour: { label: 'Colour' } } }],
    ['an option with no label', { options: { sortBy: {} } }],
    ['the feature switch as an option', { options: { enabled: { label: 'On' } } }],
    ['choices that do not include the default', { options: { sortBy: { label: 'Sort', choices: ['level'] } } }],
    ['choices of another type', { options: { sortBy: { label: 'Sort', choices: ['status', 1] } } }],
    ['a bound on a text option', { options: { sortBy: { label: 'Sort', min: 0 } } }],
    ['a number default out of its range', { defaults: { enabled: true, n: 5 }, options: { n: { label: 'N', max: 3 } } }],
    ['needs without apiKey', { needs: { scriptKey: true } }],
    ['credits that are not strings', { credits: [{ name: 'x' }] }],
    ['no start', { start: undefined }],
    ['no stop', { stop: undefined }],
  ]) {
    test(`${what} is refused`, () => {
      assert.throws(() => validateDescriptor(descriptor(over)));
    });
  }

  test('described options pass', () => {
    assert.doesNotThrow(() => validateDescriptor(descriptor({
      defaults: { enabled: true, sortBy: 'status', undercut: 1 },
      options: { sortBy: { label: 'Sort by', choices: ['status', 'level'] }, undercut: { label: 'Undercut', min: 0, max: 100 } },
    })));
  });

  test('two features cannot share an id', () => {
    assert.throws(() => createRegistry([descriptor(), descriptor()]), /duplicate/);
  });

  test('the registry is frozen once built', () => {
    const registry = createRegistry([descriptor()]);
    assert.throws(() => registry.push(descriptor({ id: 'other' })));
  });

  test('byId finds a feature or returns null', () => {
    const registry = createRegistry([descriptor()]);
    assert.equal(byId(registry, 'war-enhancer').title, 'War page');
    assert.equal(byId(registry, 'nope'), null);
  });
});

describe('CMP-014 the panel knows every kind a build can share', () => {
  test('shareKinds is the sorted union across features', () => {
    const registry = createRegistry([
      descriptor({ id: 'a', shares: ['loadout', 'foreign_stock'] }),
      descriptor({ id: 'b', shares: ['foreign_stock', 'foreign_shop'] }),
      descriptor({ id: 'c', shares: [] }),
    ]);
    assert.deepEqual(shareKinds(registry), ['foreign_shop', 'foreign_stock', 'loadout']);
  });

  test('a build with no features shares nothing', () => {
    assert.deepEqual(shareKinds(createRegistry([])), []);
  });
});
