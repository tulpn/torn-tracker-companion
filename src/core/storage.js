// Device storage (CMP-008). The keys below, nothing else, and "Forget me" clears them all.
//
// Torn PDA injects PDA_storage (async); browsers get localStorage. The backend is looked
// up on every call rather than at load, because PDA injects it around the time the script
// starts and because tests swap it per case.

import { warn } from './log.js';

export const KEYS = Object.freeze({
  /** per-feature switches and options, per-kind sharing switches */
  settings: 'ttc_settings',
  /** script key and optional Torn API key; never logged, never uploaded */
  keys: 'ttc_keys',
  /** upload queue, at most 200 observations */
  queue: 'ttc_queue',
  /** read caches with their TTLs */
  cache: 'ttc_cache',
  /** the settings page's last section; a convenience, cleared by "Forget me" */
  ui: 'ttc_ui',
  /** whether the sidebar block is open; a convenience, cleared by "Forget me" */
  sidebar: 'ttc_sidebar',
  /** which tours were seen, and a tour asked for on another page (core/tours.js) */
  tours: 'ttc_tours',
  /** where the next achievements read starts, and the featured ones (core/unlocks.js) */
  unlocks: 'ttc_unlocks',
  /** watch mode: on or off, the box's size, spot and colours, the beep (core/watch.js) */
  watch: 'ttc_watch',
});

const ALL = Object.freeze(Object.values(KEYS));

function pda() {
  const store = globalThis.PDA_storage;
  return store && typeof store.get === 'function' ? store : null;
}

/** 'PDA_storage' or 'localStorage'; the panel shows this so the player knows where it is. */
export function backendName() {
  return pda() ? 'PDA_storage' : 'localStorage';
}

/**
 * Reads one key. Anything unparseable is treated as absent: callers validate the shape
 * field by field on top of this.
 */
export async function read(key, fallback = null) {
  try {
    const store = pda();
    const raw = store ? await store.get(key, null) : globalThis.localStorage?.getItem(key);
    if (raw == null) return fallback;
    // A PDA build that hands back the object it was given, rather than the string.
    if (typeof raw === 'object') return raw;
    return JSON.parse(raw);
  } catch (err) {
    warn('could not read', key, err);
    return fallback;
  }
}

/** @returns {Promise<boolean>} false when storage is full or unavailable. */
export async function write(key, value) {
  try {
    const json = JSON.stringify(value);
    const store = pda();
    if (store) await store.set(key, json);
    else globalThis.localStorage.setItem(key, json);
    return true;
  } catch (err) {
    warn('could not write', key, err && err.name);
    return false;
  }
}

export async function remove(key) {
  try {
    const store = pda();
    if (store) await store.delete(key);
    else globalThis.localStorage.removeItem(key);
    return true;
  } catch (err) {
    warn('could not clear', key, err);
    return false;
  }
}

/** "Forget me": every key this script has ever written. */
export async function forget() {
  const results = await Promise.all(ALL.map((key) => remove(key)));
  return results.every(Boolean);
}
