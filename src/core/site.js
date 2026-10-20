// Reading from torn-tracker.com's companion API (CMP-011, CMP-023; the server side is
// CAPI-033..035 in specs/companion-api.md).
//
// Every read goes to our host only, with the player's script key, and is cached so a
// page view asks at most once. Every answer is checked field by field; an answer that
// does not fit is treated as no answer. Nothing here ever throws at a feature: when the
// site is down, the key is missing or refused, or the reply is odd, a feature gets an
// empty result and shows "no data" (CMP-023).
//
// The FF and price shapes are the ones specs/companion-api.md section 6.4 pins (accepted
// in hq #97). The dibs shapes (CAPI-034) are the companion lane's proposal, hq #104, until
// the spec pins them.

import { SITE } from '../hosts.js';
import { createCache } from './cache.js';
import { request } from './net.js';

export const FF_URL = `${SITE}/api/feeds/ff`;
export const PRICES_URL = `${SITE}/api/feeds/prices`;
export const DIBS_URL = `${SITE}/api/feeds/war/dibs`;

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

const NAME = 64;

/** Torn's player names are short; anything else is not a name. */
const validName = (v) => typeof v === 'string' && v.length > 0 && v.length <= NAME;

/**
 * One claim from CAPI-034, turned to the local clock.
 * @returns {{target: number, holder: {id: number, name: string}, expiresAt: number, mine: boolean}|null}
 */
export function readDibs(row, skew) {
  if (!row || typeof row !== 'object' || !positiveInt(row.target_id)) return null;
  const holder = row.holder;
  if (!holder || !positiveInt(holder.torn_id) || !validName(holder.name)) return null;
  const expires = typeof row.expires_at === 'string' ? Date.parse(row.expires_at) : NaN;
  if (!Number.isFinite(expires) || typeof row.mine !== 'boolean') return null;
  return { target: row.target_id, holder: { id: holder.torn_id, name: holder.name }, expiresAt: expires - skew, mine: row.mine };
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
export function createSite({
  getKey, send = request, cache = createCache(SPACES), now = Date.now,
}) {
  /** Set when the site refuses the key; reads stop until the key changes. */
  let refusedKey = null;

  const headers = () => ({ Authorization: `Bearer ${getKey()}`, Accept: 'application/json' });
  const usable = () => Boolean(getKey()) && getKey() !== refusedKey;

  async function exchange(url, opts) {
    const result = await send(url, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
    if (result.status === 401 || result.status === 403) refusedKey = getKey();
    return result;
  }

  async function call(url, opts) {
    const result = await exchange(url, opts);
    return result.ok ? result.data : null;
  }

  /** How far the site's clock is ahead of ours, from a reply's server_time; 0 if absent. */
  function skewOf(data) {
    const server = typeof data?.server_time === 'string' ? Date.parse(data.server_time) : NaN;
    return Number.isFinite(server) ? server - now() : 0;
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

    /**
     * The faction's dibs in the current ranked war (CAPI-034). Never cached: the war page
     * asks at most every 15 s while it is visible (CMP-102).
     * @returns {Promise<{war: boolean, dibs: Map<number, object>}|null>} null when there is
     *          no answer; war false when there is no ranked war
     */
    async dibs() {
      if (!usable()) return null;
      const data = await call(DIBS_URL, { method: 'GET' });
      if (!data || typeof data !== 'object' || !Object.hasOwn(data, 'war')) return null;
      const war = data.war !== null && typeof data.war === 'object';
      const skew = skewOf(data);
      const dibs = new Map();
      for (const row of war && Array.isArray(data.dibs) ? data.dibs : []) {
        const claim = readDibs(row, skew);
        if (claim) dibs.set(claim.target, claim);
      }
      return { war, dibs };
    },

    /**
     * Claims or releases one target (CAPI-034). One press of the button is one call.
     * @param {number} target
     * @param {'claim'|'release'} action
     * @returns {Promise<{ok: boolean, dibs: object|null, error: string|null}>}
     *          ok false with error 'dibs_taken' carries the holder's claim in dibs
     */
    async callDibs(target, action) {
      if (!positiveInt(target) || !['claim', 'release'].includes(action)) {
        return { ok: false, dibs: null, error: 'invalid' };
      }
      if (!usable()) return { ok: false, dibs: null, error: 'no_key' };
      const result = await exchange(`${DIBS_URL}/${target}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = result.data && typeof result.data === 'object' ? result.data : {};
      const claim = data.dibs ? readDibs({ target_id: target, ...data.dibs }, skewOf(data)) : null;
      if (result.ok) return { ok: true, dibs: claim, error: null };
      const known = ['dibs_taken', 'no_war', 'not_in_war'];
      const error = known.includes(data.error) ? data.error : (result.status === 429 ? 'busy' : 'failed');
      return { ok: false, dibs: error === 'dibs_taken' ? claim : null, error };
    },

    /** The site refused the current key (the panel says so). */
    keyRefused: () => Boolean(getKey()) && getKey() === refusedKey,
  };
}
