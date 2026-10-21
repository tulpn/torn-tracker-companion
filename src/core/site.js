// Reading from torn-tracker.com's companion API (CMP-011, CMP-023; the server side is
// CAPI-033..035 in specs/companion-api.md).
//
// Every read goes to our host only, with the player's script key, and is cached so a
// page view asks at most once. Every answer is checked field by field; an answer that
// does not fit is treated as no answer. Nothing here ever throws at a feature: when the
// site is down, the key is missing or refused, or the reply is odd, a feature gets an
// empty result and shows "no data" (CMP-023).
//
// The reply shapes are the ones specs/companion-api.md section 6.4 pins (FF and prices
// accepted in hq #97, dibs in #104, the OC read in #110). The roster's key and shape are the companion's
// proposal on #104, mirroring Torn's UserStatus, until the spec names them.

import { SITE } from '../hosts.js';
import { createCache } from './cache.js';
import { request } from './net.js';

export const FF_URL = `${SITE}/api/feeds/ff`;
export const PRICES_URL = `${SITE}/api/feeds/prices`;
export const DIBS_URL = `${SITE}/api/feeds/war/dibs`;
export const OC_URL = `${SITE}/api/feeds/oc`;
export const ME_GYM_URL = `${SITE}/api/feeds/me/gym`;
export const DEMAND_URL = `${SITE}/api/feeds/demand`;
export const CRIME_VALUE_URL = `${SITE}/api/feeds/crimes/value`;
export const WAR_LOADOUTS_URL = `${SITE}/api/feeds/war/loadouts`;
export const ME_MUGS_URL = `${SITE}/api/feeds/me/mugs`;
export const AUCTION_VALUE_URL = `${SITE}/api/feeds/auctions/value`;
const AUCTION_VALUE_TTL = 10 * 60_000;
const AUCTION_VALUE_MAX = 50;
const ME_MUGS_TTL = 10 * 60_000;
/** Open data (public-api.md): asked anonymously, never with the script key. */
export const OPEN_LOADOUT_URL = `${SITE}/api/open/v1/loadouts`;

export const LOADOUT_FLAGS = Object.freeze(['heavy_hitter', 'armoured', 'temp_ready']);
const WAR_LOADOUTS_TTL = 60_000;
const OPEN_LOADOUT_TTL = 10 * 60_000;
const SLOT_NAMES = ['primary', 'secondary', 'melee', 'temporary', 'helmet', 'body', 'gloves', 'pants', 'boots'];

/** CAPI-013: the demand feed is kept 60 s; at most 500 ids per kind. */
const DEMAND_TTL = 60_000;
const DEMAND_MAX = 500;

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

const STATE = 20;
const DESCRIPTION = 100;

/**
 * One opponent's status from the dibs feed's roster (CAPI-034, the #98 fallback), with
 * `until` (Unix seconds, as Torn gives it) turned to a local-clock time in ms.
 * @returns {{id: number, state: string, until: number|null, description: string}|null}
 */
export function readRosterRow(row, skew) {
  if (!row || typeof row !== 'object' || !positiveInt(row.id)) return null;
  const status = row.status;
  if (!status || typeof status !== 'object') return null;
  const { state, until, description } = status;
  if (typeof state !== 'string' || !state || state.length > STATE) return null;
  if (until !== null && until !== undefined && !(Number.isInteger(until) && until >= 0)) return null;
  if (typeof description !== 'string' || description.length > DESCRIPTION) return null;
  return {
    id: row.id, state, until: Number.isInteger(until) && until > 0 ? until * 1000 - skew : null, description,
  };
}

export const POSITIONS = Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
const LABEL = 40;
/** D-074: OC role weights come from this provider, fetched by the site; always credited. */
export const WEIGHTS_SOURCE = 'tornprobability.com';
const OC_NAME = 100;

const percent_ = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const percent = (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100);

/** An OC's roles as CAPI-035 gives them: up to six slots, each P1..P6 with a label. */
export function validRoles(v) {
  return Array.isArray(v) && v.length > 0 && v.length <= POSITIONS.length && v.every((r) => r
    && typeof r === 'object' && POSITIONS.includes(r.position_id)
    && typeof r.label === 'string' && r.label.length > 0 && r.label.length <= LABEL
    && percent(r.weight));
}

const SUBCRIMES = 50;

/** One crime's value per nerve as CAPI-035 gives it (hq #124): its subcrimes, each checked. */
export function validCrimeValue(v) {
  return Array.isArray(v) && v.length <= SUBCRIMES && v.every((s) => s && typeof s === 'object'
    && typeof s.name === 'string' && s.name.length > 0 && s.name.length <= 100
    && (s.value_per_nerve === null || (Number.isFinite(s.value_per_nerve) && Math.abs(s.value_per_nerve) <= 1e12))
    && (s.success_rate === null || percent_(s.success_rate))
    && Number.isInteger(s.reporters) && s.reporters >= 0);
}

const text = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const stat = (v) => v === undefined || v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10_000);

/** Flags and their one-line reasons, as LDT-032 gives them; unknown flags are dropped. */
function readFlags(flags, reasons) {
  const out = [];
  for (const flag of Array.isArray(flags) ? flags : []) {
    if (!LOADOUT_FLAGS.includes(flag) || out.some((f) => f.flag === flag)) continue;
    const reason = reasons && typeof reasons === 'object' && text(reasons[flag], 80) ? reasons[flag] : null;
    out.push({ flag, reason });
  }
  return out;
}

/** When a loadout was seen, from its ISO time; null when it does not parse. */
function seenAt(v) {
  const at = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(at) ? at : null;
}

/** One slot of an open loadout read: the item and what the page showed of it. */
function readSlot(v) {
  if (!v || typeof v !== 'object' || !positiveInt(v.item_id) || !text(v.name, 100)) return null;
  if (!stat(v.damage) || !stat(v.accuracy)) return null;
  const bonuses = (Array.isArray(v.bonuses) ? v.bonuses : [])
    .filter((b) => b && text(b.name, 40) && typeof b.value === 'number' && Number.isFinite(b.value))
    .slice(0, 2)
    .map((b) => ({ name: b.name, value: b.value }));
  return { item_id: v.item_id, name: v.name, damage: v.damage ?? null, accuracy: v.accuracy ?? null, bonuses };
}

export const SPACES = Object.freeze({
  ff: { ttlMs: HOUR, max: 2_000, valid: validFf },
  prices: { ttlMs: 10 * 60_000, max: 2_000, valid: validPrice },
  ocRoles: { ttlMs: HOUR, max: 200, valid: validRoles },
  crimeValue: { ttlMs: HOUR, max: 100, valid: validCrimeValue },
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
  /** The last demand answer and when it came. */
  let demandMemo = null;
  /** The war loadouts answer and when it came (LDT-032: at most once a minute). */
  let warLoadoutsMemo = null;
  /** Open loadout reads by player id. */
  const openLoadouts = new Map();
  /** The player's own mugs of others, by target id (MUG-031: kept 10 minutes). */
  const myMugs = new Map();
  /** Auction listing values by listing id (#199: kept 10 minutes; null = the site has none). */
  const auctionValues = new Map();

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
     * @returns {Promise<{war: boolean, dibs: Map<number, object>, roster: Map<number, object>}|null>}
     *          null when there is no answer; war false when there is no ranked war
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
      const roster = new Map();
      for (const row of war && Array.isArray(data.roster) ? data.roster : []) {
        const status = readRosterRow(row, skew);
        if (status) roster.set(status.id, status);
      }
      return { war, dibs, roster };
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

    /**
     * An OC's role weights and the faction's success estimates for it (CAPI-035, #110).
     * Roles are kept for an hour; the estimates are fresh each call, so a page view asks
     * once per OC name and keeps the answer itself.
     * @param {string} name  the OC's name as Torn shows it
     * @param {{crimes?: boolean}} [opts]  crimes false: roles from the cache will do
     * @returns {Promise<{roles: object[]|null, crimes: Map<number, number|null>, weightsSource: string}>}
     *          weightsSource is who the weights come from, to credit wherever they show
     *          (D-074: tornprobability.com, fetched by the site)
     */
    async oc(name, { crimes: wantCrimes = true } = {}) {
      const empty = { roles: null, crimes: new Map(), weightsSource: WEIGHTS_SOURCE };
      if (typeof name !== 'string' || !name.trim() || name.length > OC_NAME) return empty;
      const cached = cache.get('ocRoles', name) ?? null;
      if ((cached && !wantCrimes) || !usable()) return { ...empty, roles: cached };

      const data = await call(`${OC_URL}/${encodeURIComponent(name)}`, { method: 'GET' });
      const roles = validRoles(data?.roles) ? data.roles.map(({ position_id, label, weight }) => ({ position_id, label, weight })) : null;
      if (roles) cache.set('ocRoles', name, roles);
      const crimes = new Map();
      for (const row of Array.isArray(data?.crimes) ? data.crimes : []) {
        if (positiveInt(row?.crime_id) && percent(row.success ?? null)) crimes.set(row.crime_id, row.success ?? null);
      }
      const source = data?.weights_source;
      const weightsSource = typeof source === 'string' && /^[a-z0-9.-]{3,60}$/i.test(source) ? source : WEIGHTS_SOURCE;
      return { roles: roles ?? cached, crimes, weightsSource };
    },

    /**
     * The player's own gym view (CAPI-035 own gym, D-073): the gym in progress, how far,
     * and the site's labelled estimate of the energy to the next gym. Never cached: it
     * changes with every train, and the gym page asks once per view.
     * @returns {Promise<{gym_id: number, percent: number|null, next_gym_energy_estimate: number|null}|null>}
     */
    async meGym() {
      if (!usable()) return null;
      const data = await call(ME_GYM_URL, { method: 'GET' });
      if (!positiveInt(data?.gym_id)) return null;
      const percent = percent_(data.percent) ? data.percent : null;
      const estimate = data.next_gym_energy_estimate;
      return {
        gym_id: data.gym_id,
        percent,
        next_gym_energy_estimate: Number.isInteger(estimate) && estimate >= 0 && estimate <= 1e7 ? estimate : null,
      };
    },

    /**
     * Value per nerve for one crime's subcrimes (CAPI-035, hq #124), by the page's own
     * typeID, which the site maps. Kept for an hour. An unmapped crime or a failure is
     * an empty list: nothing is shown, nothing is guessed.
     * @param {number} typeId
     * @returns {Promise<Array<{name: string, value_per_nerve: number|null, success_rate: number|null, reporters: number}>>}
     */
    async crimeValue(typeId) {
      if (!positiveInt(typeId)) return [];
      const cached = cache.get('crimeValue', typeId);
      if (cached !== undefined) return cached;
      if (!usable()) return [];
      const data = await call(`${CRIME_VALUE_URL}?type_id=${typeId}`, { method: 'GET' });
      if (!data) return [];
      const rows = (Array.isArray(data.subcrimes) ? data.subcrimes : []).map((s) => ({
        name: s?.name,
        value_per_nerve: s?.value_per_nerve ?? null,
        success_rate: s?.success_rate ?? null,
        reporters: s?.reporters,
      }));
      const value = validCrimeValue(rows) ? rows : [];
      // An unmapped crime is an answer too: keep it, so the page is not asked again.
      cache.set('crimeValue', typeId, value);
      return value;
    },

    /**
     * The current opponent's loadout flags for the token's own faction (LDT-032, Pro;
     * accepted in hq #142). Kept 60 s. A Core faction gets `pro: false` and no rows.
     * @returns {Promise<{pro: boolean, war: boolean, opponents: Map<number, object>}|null>}
     */
    async warLoadouts() {
      if (warLoadoutsMemo && now() - warLoadoutsMemo.at < WAR_LOADOUTS_TTL) return warLoadoutsMemo.value;
      if (!usable()) return null;
      const result = await exchange(WAR_LOADOUTS_URL, { method: 'GET' });
      let value = null;
      if (result.status === 403 && result.data?.error === 'pro_required') {
        value = { pro: false, war: false, opponents: new Map() };
      } else if (result.ok && result.data && typeof result.data === 'object' && Object.hasOwn(result.data, 'war')) {
        const war = result.data.war !== null && typeof result.data.war === 'object';
        const opponents = new Map();
        for (const row of war && Array.isArray(result.data.opponents) ? result.data.opponents : []) {
          if (!positiveInt(row?.player_id)) continue;
          opponents.set(row.player_id, {
            player_id: row.player_id,
            flags: readFlags(row.flags, row.reasons),
            seen_at: seenAt(row.seen_at),
            reporters: Number.isInteger(row.reporters) && row.reporters >= 0 ? row.reporters : null,
            old: row.old === true,
            hidden: row.hidden === true,
          });
        }
        value = { pro: true, war, opponents };
      }
      if (value) warLoadoutsMemo = { at: now(), value };
      return value;
    },

    /**
     * One player's latest loadout, from the open data (LDT-032, D-053). Asked without any
     * key, as anyone may. Kept 10 minutes.
     * @param {number} playerId
     * @returns {Promise<{seen: boolean, hidden?: boolean, slots?: object, flags?: object[], seen_at?: number|null, reporters?: number|null}|null>}
     *          seen false when the site has never seen this player's loadout; null on failure
     */
    async playerLoadout(playerId) {
      if (!positiveInt(playerId)) return null;
      const memo = openLoadouts.get(playerId);
      if (memo && now() - memo.at < OPEN_LOADOUT_TTL) return memo.value;
      const result = await send(`${OPEN_LOADOUT_URL}/${playerId}`, { method: 'GET', headers: { Accept: 'application/json' } });
      let value = null;
      if (result.status === 404) value = { seen: false };
      else if (result.ok && result.data?.player_id === playerId) {
        const d = result.data;
        if (d.hidden === true) value = { seen: true, hidden: true };
        else {
          const slots = {};
          for (const name of SLOT_NAMES) {
            const slot = readSlot(d.slots?.[name]);
            if (slot) slots[name] = slot;
          }
          value = {
            seen: Object.keys(slots).length > 0,
            hidden: false,
            slots,
            flags: readFlags(d.flags, d.reasons),
            seen_at: seenAt(d.seen_at),
            reporters: Number.isInteger(d.reporters) && d.reporters >= 0 ? d.reporters : null,
          };
        }
      }
      if (value) openLoadouts.set(playerId, { at: now(), value });
      return value;
    },

    /**
     * The token owner's own mugs of one player (MUG-031): how many, the last one and the
     * average. Own data only. Kept 10 minutes.
     * @param {number} playerId
     * @returns {Promise<{count: number, last_at: number|null, last_amount: number|null, average: number|null}|null>}
     */
    async myMugs(playerId) {
      if (!positiveInt(playerId)) return null;
      const memo = myMugs.get(playerId);
      if (memo && now() - memo.at < ME_MUGS_TTL) return memo.value;
      if (!usable()) return null;
      const data = await call(`${ME_MUGS_URL}/${playerId}`, { method: 'GET' });
      if (!data || typeof data !== 'object') return null;
      const money = (v) => (Number.isInteger(v) && v >= 0 && v <= 1e12 ? v : null);
      const last = typeof data.last_at === 'string' ? Date.parse(data.last_at) : NaN;
      const value = {
        count: Number.isInteger(data.count) && data.count >= 0 ? data.count : 0,
        last_at: Number.isFinite(last) ? last - skewOf(data) : null,
        last_amount: money(data.last_amount),
        average: money(typeof data.average === 'number' ? Math.round(data.average) : data.average),
      };
      myMugs.set(playerId, { at: now(), value });
      return value;
    },

    /**
     * Value estimates for auction listings (CAPI-035, accepted in hq #199), by the ids the
     * page shows. Up to 50 per call; each answer, or the lack of one, kept 10 minutes.
     * @param {number[]} ids
     * @returns {Promise<Map<number, {estimate: number|null, sales: number, basis: string, deal: boolean}>>}
     */
    async auctionValues(ids) {
      const found = new Map();
      const ask = [];
      for (const id of new Set(ids.filter(positiveInt))) {
        const memo = auctionValues.get(id);
        if (memo && now() - memo.at < AUCTION_VALUE_TTL) {
          if (memo.value) found.set(id, memo.value);
        } else if (ask.length < AUCTION_VALUE_MAX) ask.push(id);
      }
      if (ask.length === 0 || !usable()) return found;
      const data = await call(AUCTION_VALUE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listings: ask }),
      });
      if (!data) return found;
      const answered = new Set();
      for (const row of Array.isArray(data.values) ? data.values : []) {
        if (!positiveInt(row?.listing_id) || !ask.includes(row.listing_id)) continue;
        const estimate = row.estimate === null || (Number.isInteger(row.estimate) && row.estimate >= 0 && row.estimate <= 1e13) ? row.estimate : undefined;
        if (estimate === undefined || !Number.isInteger(row.sales) || row.sales < 0) continue;
        if (!['auctions', 'market'].includes(row.basis) || typeof row.deal !== 'boolean') continue;
        const value = { estimate, sales: row.sales, basis: row.basis, deal: row.deal };
        auctionValues.set(row.listing_id, { at: now(), value });
        found.set(row.listing_id, value);
        answered.add(row.listing_id);
      }
      // A listing the site has not seen is left out: remember that too, for the window.
      for (const id of ask) if (!answered.has(id)) auctionValues.set(id, { at: now(), value: null });
      return found;
    },

    /**
     * The ids the site wants now for each demand-gated kind (CAPI-013, accepted in #123),
     * kept for 60 s. Any failure means nothing is wanted, so nothing is sent.
     * @returns {Promise<Map<string, Set<number>>>}
     */
    async demand() {
      if (demandMemo && now() - demandMemo.at < DEMAND_TTL) return demandMemo.value;
      const value = new Map();
      if (!usable()) return value;
      const data = await call(DEMAND_URL, { method: 'GET' });
      const wanted = data?.demand && typeof data.demand === 'object' ? data.demand : {};
      for (const [kind, ids] of Object.entries(wanted)) {
        if (!/^[a-z_]{1,40}$/.test(kind) || !Array.isArray(ids)) continue;
        value.set(kind, new Set(ids.filter(positiveInt).slice(0, DEMAND_MAX)));
      }
      demandMemo = { at: now(), value };
      return value;
    },

    /** The site refused the current key (the panel says so). */
    keyRefused: () => Boolean(getKey()) && getKey() === refusedKey,
  };
}
