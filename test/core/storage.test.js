import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { KEYS, backendName, forget, read, remove, write } from '../../src/core/storage.js';
import { fakePdaStorage } from '../helpers.js';

function fakeLocalStorage(throwOnWrite = false) {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      if (throwOnWrite) {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      map.set(key, String(value));
    },
    removeItem: (key) => map.delete(key),
  };
}

function use({ local = fakeLocalStorage(), pda = null } = {}) {
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  if (pda) globalThis.PDA_storage = pda;
  else delete globalThis.PDA_storage;
  return { local, pda };
}

beforeEach(() => use());

describe('CMP-008 seven keys and nothing else', () => {
  test('the keys are the ones the spec names', () => {
    assert.deepEqual(KEYS, {
      settings: 'ttc_settings',
      keys: 'ttc_keys',
      queue: 'ttc_queue',
      cache: 'ttc_cache',
      ui: 'ttc_ui',
      sidebar: 'ttc_sidebar',
      tours: 'ttc_tours',
    });
  });

  test('a value survives a round trip', async () => {
    const { local } = use();
    assert.equal(await write(KEYS.settings, { debug: true }), true);
    assert.deepEqual(await read(KEYS.settings), { debug: true });
    assert.equal(local.map.get('ttc_settings'), '{"debug":true}');
  });

  test('a missing key gives the fallback', async () => {
    assert.equal(await read(KEYS.queue), null);
    assert.deepEqual(await read(KEYS.queue, []), []);
  });

  test('unreadable JSON is treated as absent, not as a crash', async () => {
    const { local } = use();
    local.map.set('ttc_cache', '{not json');
    assert.deepEqual(await read(KEYS.cache, { fallback: true }), { fallback: true });
  });

  test('a full disk is reported, not thrown', async () => {
    use({ local: fakeLocalStorage(true) });
    assert.equal(await write(KEYS.settings, { debug: true }), false);
  });

  test('"Forget me" clears all seven, the last settings section, the sidebar block\u2019s state and the tours included', async () => {
    const { local } = use();
    for (const key of Object.values(KEYS)) await write(key, { some: 'thing' });
    assert.equal(local.map.size, 7);
    assert.equal(await forget(), true);
    assert.equal(local.map.size, 0);
  });

  test('remove takes one key away', async () => {
    const { local } = use();
    await write(KEYS.keys, { scriptKey: 'x' });
    await remove(KEYS.keys);
    assert.equal(local.map.has('ttc_keys'), false);
  });
});

describe('CMP-007 Torn PDA storage is used when PDA injects it', () => {
  test('writes go to PDA_storage and not to localStorage', async () => {
    const pda = fakePdaStorage();
    const { local } = use({ pda });
    assert.equal(backendName(), 'PDA_storage');

    await write(KEYS.settings, { debug: true });
    assert.equal(pda.store.has('ttc_settings'), true);
    assert.equal(local.map.size, 0);
    assert.deepEqual(await read(KEYS.settings), { debug: true });
  });

  test('"Forget me" clears PDA storage too', async () => {
    const pda = fakePdaStorage();
    use({ pda });
    for (const key of Object.values(KEYS)) await write(key, 1);
    await forget();
    assert.equal(pda.store.size, 0);
  });

  test('a PDA build that hands back an object instead of a string still works', async () => {
    const pda = fakePdaStorage();
    use({ pda });
    pda.store.set('ttc_settings', { debug: true });
    assert.deepEqual(await read(KEYS.settings), { debug: true });
  });

  test('without PDA the backend is localStorage', () => {
    use();
    assert.equal(backendName(), 'localStorage');
  });
});
