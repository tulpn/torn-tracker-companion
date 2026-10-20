// Reading from torn-tracker.com's companion API (CMP-011, CMP-023; the server side is
// CAPI-033..035 in specs/companion-api.md).
//
// Every read goes to our host only, with the player's script key, and is cached so a
// page view asks at most once. Every answer is checked field by field; an answer that
// does not fit is treated as no answer. Nothing here ever throws at a feature: when the
// site is down, the key is missing or refused, or the reply is odd, a feature gets an
// empty result and shows "no data" (CMP-023).
//
// The reply shapes below are the ones specs/companion-api.md section 6.4 pins (accepted in
// hq #97).

import { SITE } from '../hosts.js';
import { createCache } from './cache.js';
import { request } from './net.js';

export const FF_URL = `${SITE}/api/feeds/ff`;
export const PRICES_URL = `${SITE}/api/feeds/prices`;

/** CMP-101: one batched lookup per page view, at most 100 ids. */
export const MAX_IDS = 100;

const HOUR = 3_600_000;
const BAND = 40;

const positiveInt = (v) => Number.isInteger(v) && v > 0;

/**
 * An FF result: a number of at least 1, or null when the site does not know the player.
 * The contract sets no upper bound (estimates above 10 exist); the badge clamps for display.
 */
export function validFf(v) {
  return Boolean(v) && typeof v === 'object'
    && (v.ff === null || (typeof v.ff === 'number' && Number.isFinite(v.ff) && v.ff >= 1))
    && (v.band === null || (typeof v.band === 'string' && v.band.length <= BAND));
}

export function validPrice(v) {
  return Number.isInteger(v) && v >= 0 && v <= 1e12;
}

export const SPACES = Object.freeze({
  ff: { ttlMs: HOUR, max: 2_000, valid: validFf },
  prices: { ttlMs: 10 * 60_000, max: 2_000, valid: validPrice },
});

/**
 * @param {object} opts
 * @param {() => string} opts.getKey
 * @param {typeof request} [opts.send]
 * @param {ReturnType<typeof createCache>} [opts.cache]
 */
export function createSite({ getKey, send = request, cache = createCache(SPACES) }) {
  /** Set when the site refuses the key; reads stop until the key changes. */
  let refusedKey = null;

  const headers = () => ({ Authorization: `Bearer ${getKey()}`, Accept: 'application/json' });
  const usable = () => Boolean(getKey()) && getKey() !== refusedKey;

  async function call(url, opts) {
    const result = await send(url, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
    if (result.status === 401 || result.status === 403) refusedKey = getKey();
    return result.ok ? result.data : null;
  }

  /** Splits ids into what the cache has and what must be asked for, keeping order. */
  function split(name, ids) {
    const found = new Map();
    const missing = [];
    for (const id of new Set(ids)) {
      const hit = cache.get(name, id);
      if (hit !== undefined) found.set(id, hit);
      else missing.push(id);
    }
    return { found, missing };
  }

  return {
    cache,

    /**
     * Fair-fight estimates for players (CAPI-033).
     * @param {number[]} ids
     * @returns {Promise<Map<number, {ff: number|null, band: string|null}>>}
     */
    async ff(ids) {
      const { found, missing } = split('ff', ids.filter(positiveInt));
      const ask = missing.slice(0, MAX_IDS);
      if (ask.length === 0 || !usable()) return found;

      const data = await call(FF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ask }),
      });
      const results = Array.isArray(data?.results) ? data.results : [];
      const answered = new Set();
      for (const row of results) {
        if (!positiveInt(row?.id) || !ask.includes(row.id)) continue;
        const value = { ff: row.ff ?? null, band: row.band ?? null };
        if (!validFf(value)) continue;
        cache.set('ff', row.id, value);
        found.set(row.id, value);
        answered.add(row.id);
      }
      // Asked and not answered means the site does not know them: "?" for an hour, not a retry.
      if (data) {
        for (const id of ask) {
          if (!answered.has(id)) {
            const unknown = { ff: null, band: null };
            cache.set('ff', id, unknown);
            found.set(id, unknown);
          }
        }
      }
      return found;
    },

    /**
     * Market values for items (CAPI-035).
     * @param {number[]} ids
     * @returns {Promise<Map<number, number>>}
     */
    async prices(ids) {
      const { found, missing } = split('prices', ids.filter(positiveInt));
      const ask = missing.slice(0, MAX_IDS);
      if (ask.length === 0 || !usable()) return found;

      const data = await call(`${PRICES_URL}?ids=${ask.join(',')}`, { method: 'GET' });
      for (const row of Array.isArray(data?.prices) ? data.prices : []) {
        if (!positiveInt(row?.item_id) || !ask.includes(row.item_id) || !validPrice(row.market)) continue;
        cache.set('prices', row.item_id, row.market);
        found.set(row.item_id, row.market);
      }
      return found;
    },

    /** The site refused the current key (the panel says so). */
    keyRefused: () => Boolean(getKey()) && getKey() === refusedKey,
  };
}
