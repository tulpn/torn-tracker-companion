// Read caches (CMP-008: ttc_cache, "TTL and shape").
//
// What the site told us, kept for a while so a page view does not ask again: fair-fight
// estimates for an hour, prices for ten minutes. Each namespace names its lifetime, its
// size and the check every entry must pass; an entry that is expired or no longer fits
// the check is treated as absent. Nothing here ever holds a key.

import { KEYS, read, write } from './storage.js';

/**
 * @typedef {object} Space
 * @property {number} ttlMs
 * @property {number} max          entries kept; the oldest go first
 * @property {(value: unknown) => boolean} valid
 */

/**
 * @param {Record<string, Space>} spaces
 * @param {object} [opts]
 * @param {() => number} [opts.now]
 */
export function createCache(spaces, { now = Date.now } = {}) {
  /** @type {Record<string, Record<string, {v: unknown, at: number}>>} */
  let data = {};
  let writeQueued = false;
  /** Bumped by clear(), so a write queued before "Forget me" does not bring it all back. */
  let generation = 0;

  const persist = () => {
    if (writeQueued) return;
    writeQueued = true;
    const mine = generation;
    Promise.resolve().then(() => {
      writeQueued = false;
      if (mine === generation) write(KEYS.cache, data);
    });
  };

  const fresh = (space, entry) => entry && Number.isFinite(entry.at)
    && now() - entry.at < space.ttlMs && now() >= entry.at - 60_000 && space.valid(entry.v);

  function prune(name) {
    const space = spaces[name];
    const entries = Object.entries(data[name] || {}).filter(([, e]) => fresh(space, e));
    entries.sort((a, b) => a[1].at - b[1].at);
    data[name] = Object.fromEntries(entries.slice(-space.max));
  }

  return {
    async load() {
      const raw = await read(KEYS.cache);
      data = {};
      if (raw && typeof raw === 'object') {
        for (const name of Object.keys(spaces)) {
          data[name] = raw[name] && typeof raw[name] === 'object' ? raw[name] : {};
          prune(name);
        }
      }
    },

    /** The cached value, or undefined when there is none worth using. */
    get(name, key) {
      const space = spaces[name];
      if (!space) throw new Error(`cache: no space "${name}"`);
      const entry = data[name]?.[String(key)];
      return fresh(space, entry) ? entry.v : undefined;
    },

    set(name, key, value) {
      const space = spaces[name];
      if (!space) throw new Error(`cache: no space "${name}"`);
      if (!space.valid(value)) return false;
      data[name] = data[name] || {};
      data[name][String(key)] = { v: value, at: now() };
      if (Object.keys(data[name]).length > space.max) prune(name);
      persist();
      return true;
    },

    /** "Forget me": storage is cleared by the caller; this drops what is in memory. */
    clear() {
      generation += 1;
      writeQueued = false;
      data = {};
    },
  };
}
