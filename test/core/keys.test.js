import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { apiKeyFor, checkTyped, loadKeys, normalizeKeys, saveKeys } from '../../src/core/keys.js';

// Made-up keys of the right shape. Never a real one.
const SCRIPT = `tt_feed_${'A'.repeat(43)}`;
const API = 'abcdEFGH12345678';

let store;
beforeEach(() => {
  store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});
afterEach(() => {
  delete globalThis.localStorage;
});

describe('CMP-011 the script key is a torn-tracker.com key, not a Torn API key', () => {
  test('a key of the site\'s shape is accepted', () => {
    assert.deepEqual(checkTyped({ script: ` ${SCRIPT} ` }), { keys: { script: SCRIPT, api: '', usePdaKey: false } });
  });

  test('a Torn API key in the script key field is caught and explained', () => {
    assert.match(checkTyped({ script: API }).error, /Torn API key/);
  });

  test('a script key in the Torn API key field is caught and explained', () => {
    assert.match(checkTyped({ api: SCRIPT }).error, /script key/);
  });

  test('anything else is refused', () => {
    assert.ok(checkTyped({ script: 'tt_feed_short' }).error);
    assert.ok(checkTyped({ api: 'abc' }).error);
  });

  test('blank clears a key', () => {
    assert.deepEqual(checkTyped({ script: '', api: '' }).keys, { script: '', api: '', usePdaKey: false });
  });
});

describe('CMP-008 keys from storage are checked against their shape', () => {
  test('a stored key of the wrong shape is dropped', () => {
    assert.deepEqual(normalizeKeys({ script: 'nope', api: 'x', usePdaKey: 'yes', extra: 1 }),
      { script: '', api: '', usePdaKey: false });
  });

  test('keys round-trip through ttc_keys and nowhere else', async () => {
    assert.equal(await saveKeys({ script: SCRIPT, api: API, usePdaKey: false }), true);
    assert.deepEqual([...store.keys()], ['ttc_keys']);
    assert.deepEqual(await loadKeys(), { script: SCRIPT, api: API, usePdaKey: false });
  });
});

describe('CMP-007 Torn PDA may fill in its own API key', () => {
  test('PDA\'s key is used only when the player asked for it and PDA replaced the placeholder', () => {
    const keys = { script: '', api: API, usePdaKey: true };
    assert.equal(apiKeyFor(keys, 'PDAPDAPDA1234567'), 'PDAPDAPDA1234567');
    assert.equal(apiKeyFor(keys, '###PDA-APIKEY###'), API, 'outside PDA the placeholder is never used');
    assert.equal(apiKeyFor({ ...keys, usePdaKey: false }, 'PDAPDAPDA1234567'), API);
  });
});
