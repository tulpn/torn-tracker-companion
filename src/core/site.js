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
import { accountBanned, keyRefused, request } from './net.js';
import { BUILT_IN, readShopReply, tableOf, validShopRows } from './shops.js';

export const FF_URL = `${SITE}/api/feeds/ff`;
export const PRICES_URL = `${SITE}/api/feeds/prices`;
export const DIBS_URL = `${SITE}/api/feeds/war/dibs`;
export const OC_URL = `${SITE}/api/feeds/oc`;
export const ME_GYM_URL = `${SITE}/api/feeds/me/gym`;
export const DEMAND_URL = `${SITE}/api/feeds/demand`;
export const CRIME_VALUE_URL = `${SITE}/api/feeds/crimes/value`;
export const WAR_LOADOUTS_URL = `${SITE}/api/feeds/war/loadouts`;
export const ME_MUGS_URL = `${SITE}/api/feeds/me/mugs`;
export const STOCK_SIGNALS_URL = `${SITE}/api/feeds/stocks/signals`;
export const TRAVEL_RUNS_URL = `${SITE}/api/feeds/me/travel/runs`;
export const SIDEBAR_URL = `${SITE}/api/feeds/me/sidebar`;
export const ACHIEVEMENTS_URL = `${SITE}/api/feeds/me/achievements`;
export const GUIDE_URL = `${SITE}/api/feeds/me/guide`;
/** The faction's chain watch rota (CHW-040 to CHW-042). */
export const CHAIN_WATCH_URL = `${SITE}/api/feeds/me/chain-watch`;
const GUIDE_TTL = 15 * 60_000;
const GUIDE_PAGE = `${SITE}/guide/`;
const TRAVEL_RUNS_TTL = 5 * 60_000;
const STOCK_SIGNALS_TTL = 5 * 60_000;
export const APPLICANTS_URL = `${SITE}/api/feeds/jobs/applicants`;
export const AUCTION_VALUE_URL = `${SITE}/api/feeds/auctions/value`;
const AUCTION_VALUE_TTL = 10 * 60_000;
const AUCTION_VALUE_MAX = 50;
export const WAR_BRIEF_URL = `${SITE}/api/feeds/war/brief`;
/** Players listed for mugging sellers after a sale (TRU-022, the companion's read on hq #368). */
export const LISTS_URL = `${SITE}/api/feeds/lists`;
const LISTS_TTL = 5 * 60_000;
const LISTS_MAX = 100;
const LIST_NAME = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TRUST_MUGGERS_URL = `${SITE}/api/feeds/trust/muggers`;
const TRUST_TTL = 10 * 60_000;
const ME_MUGS_TTL = 10 * 60_000;
/** Open data (public-api.md): asked anonymously, never with the script key. */
export const OPEN_LOADOUT_URL = `${SITE}/api/open/v1/loadouts`;

export const LOADOUT_FLAGS = Object.freeze(['heavy_hitter', 'armoured', 'temp_ready']);
const WAR_LOADOUTS_TTL = 60_000;
const OPEN_LOADOUT_TTL = 10 * 60_000;
/**
 * The item catalogue's shop prices (CMP-109): public, asked anonymously, kept 24 hours.
 * The shape is the companion's proposal on hq #363 until companion-api.md names it.
 */
export const SHOP_PRICES_URL = `${SITE}/api/open/v1/items/shops`;
const DAY = 24 * 3_600_000;
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

/**
 * One trust answer: a listed player's after-sale mug counts and when they were last
 * reported (local-clock ms, or null), or `{listed: false}` for anyone the site left out.
 */
export function validTrust(v) {
  if (!v || typeof v !== 'object') return false;
  if (v.listed === false) return Object.keys(v).length === 1;
  return v.listed === true && Number.isInteger(v.mugs30) && v.mugs30 >= 0 && v.mugs30 <= 1e4
    && Number.isInteger(v.mugs90) && v.mugs90 >= Math.max(1, v.mugs30) && v.mugs90 <= 1e4
    && (v.lastAt === null || (Number.isFinite(v.lastAt) && v.lastAt > 0));
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

const whole = (v) => (Number.isInteger(v) && v >= 0 && v <= 1e13 ? v : null);

/**
 * One run from the travel runs read (TRV-050), with its landing time on the local clock;
 * null when any field doesn't fit.
 */
export function readRun(r, skew = 0) {
  const country = typeof r?.country === 'string' && /^[a-z-]{2,20}$/.test(r.country) ? r.country : null;
  const lands = typeof r?.lands_at === 'string' ? Date.parse(r.lands_at) : NaN;
  const hours = typeof r?.hours === 'number' && Number.isFinite(r.hours) && r.hours > 0 && r.hours < 100 ? r.hours : null;
  const stops = Array.isArray(r?.stops) && r.stops.every((c) => typeof c === 'string' && /^[a-z-]{2,20}$/.test(c)) ? r.stops.slice(0, 3) : null;
  if (!country || !positiveInt(r.item_id) || typeof r.item_name !== 'string' || !r.item_name || r.item_name.length > 60) return null;
  if (!positiveInt(r.quantity) || whole(r.profit_per_hour) === null || !Number.isFinite(lands) || hours === null) return null;
  return {
    country,
    stops,
    item_id: r.item_id,
    item_name: r.item_name,
    quantity: r.quantity,
    cash_needed: whole(r.cash_needed),
    profit: whole(r.profit),
    profit_per_hour: r.profit_per_hour,
    hours,
    lands_at: lands - skew,
    accuracy: typeof r.accuracy === 'string' && r.accuracy.length <= 20 ? r.accuracy : null,
    data_age_s: whole(r.data_age_s),
  };
}

/** Every item the sidebar read can be asked for (companion-api §6.4, CMP-108). */
export const SIDEBAR_KEYS = Object.freeze(['chain', 'watch', 'war', 'terms', 'partner', 'dibs', 'oc', 'guide', 'travel', 'loot', 'gym', 'stocks']);
const OC_STATES = Object.freeze(['recruiting', 'planning', 'ready', 'running', 'done']);
const count = (v, max = 1e9) => Number.isInteger(v) && v >= 0 && v <= max;
const score = (v) => count(v, 1e7);
const time = (v, skew) => {
  const at = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(at) ? at - skew : null;
};

/** The rota's three roles, in order, as the API names them (CHW-002). */
export const WATCH_ROLES = Object.freeze(['lead', 'backup_1', 'backup_2']);
const roleOf = (v) => (typeof v === 'string' && WATCH_ROLES.includes(v) ? v : null);
const SLOT_MS = 1_800_000;
/** A slot's start as the site sent it (UTC ms), on :00 or :30 only. */
const slotTime = (v) => {
  const at = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(at) && at % SLOT_MS === 0 ? at : null;
};

/** One row of the rota, or null when it doesn't fit. */
function readWatchSlot(row) {
  const slotStart = slotTime(row?.slot_start);
  const role = roleOf(row?.role);
  if (slotStart === null || !role || !positiveInt(row.torn_id) || !validName(row.name)) return null;
  return { slotStart, role, id: row.torn_id, name: row.name, mine: row.mine === true };
}

/** The 409's clashes and the roles still free per slot (CHW-041). */
function readClash(data) {
  const clashes = (Array.isArray(data?.clashes) ? data.clashes : []).slice(0, 72).map((c) => ({
    slotStart: slotTime(c?.slot_start), role: roleOf(c?.role), name: validName(c?.name) ? c.name : null,
  })).filter((c) => c.slotStart !== null && c.role);
  const free = new Map();
  const given = data?.free && typeof data.free === 'object' ? data.free : {};
  for (const [at, roles] of Object.entries(given).slice(0, 48)) {
    const slot = slotTime(at);
    if (slot === null || !Array.isArray(roles)) continue;
    free.set(slot, WATCH_ROLES.filter((r) => roles.includes(r)));
  }
  return { clashes, free };
}

/** Each sidebar item's reader: the checked value, or null when it doesn't fit. */
const SIDEBAR_READERS = {
  chain(v, skew) {
    if (!count(v?.current, 1e5) || !count(v.max, 1e5)) return null;
    return {
      current: v.current, max: v.max, timeoutAt: v.timeout_at === null ? null : time(v.timeout_at, skew),
      // When the site last saw the chain: watch mode's "up to N s old" (CHW-020).
      asOf: v.as_of == null ? null : time(v.as_of, skew),
    };
  },
  // CHW-043: the member's watch now, their next one, and the slots with no Lead.
  watch(v, skew) {
    if (typeof v !== 'object') return null;
    const now = v.now == null ? null : roleOf(v.now.role);
    const nextRole = v.next ? roleOf(v.next.role) : null;
    const nextAt = v.next ? slotTime(v.next.slot_start) : null;
    if ((v.now && !now) || (v.next && (!nextRole || nextAt === null))) return null;
    return {
      now,
      next: v.next ? { role: nextRole, slotStart: nextAt, startsAt: nextAt - skew } : null,
      gaps: count(v.gaps_24h, 48) ? v.gaps_24h : 0,
    };
  },
  war(v, skew) {
    if (!validName(v?.opponent_name) || !score(v.our_score) || !score(v.their_score) || !score(v.target)) return null;
    return {
      opponent: v.opponent_name, ours: v.our_score, theirs: v.their_score, target: v.target,
      finishAt: v.finish_eta == null ? null : time(v.finish_eta, skew),
    };
  },
  terms: (v) => (typeof v?.label === 'string' && v.label.trim() && v.label.length <= 120 ? { label: v.label.trim() } : null),
  partner: (v) => (positiveInt(v?.torn_id) && validName(v.name) ? { id: v.torn_id, name: v.name } : null),
  dibs(v, skew) {
    if (!Array.isArray(v)) return null;
    // The site sends an empty name for a target it hasn't seen yet: the row is shown by id.
    const rows = v.slice(0, 10).map((d) => ({
      id: d?.target_id, name: d?.target_name === '' ? `#${d.target_id}` : d?.target_name, expiresAt: time(d?.expires_at, skew),
    })).filter((d) => positiveInt(d.id) && validName(d.name) && d.expiresAt !== null);
    return rows.length ? rows : null;
  },
  oc(v, skew) {
    if (!positiveInt(v?.crime_id) || typeof v.name !== 'string' || !v.name || v.name.length > OC_NAME) return null;
    if (!OC_STATES.includes(v.state) || typeof v.needs_me !== 'boolean') return null;
    return { name: v.name, state: v.state, readyAt: v.ready_at == null ? null : time(v.ready_at, skew), needsMe: v.needs_me };
  },
  guide(v) {
    if (!count(v?.done, 100) || !count(v.total, 100) || v.total === 0 || !count(v.bonuses_unclaimed, 100)) return null;
    return { done: Math.min(v.done, v.total), total: v.total, bonuses: v.bonuses_unclaimed };
  },
  travel: (v, skew) => readRun(v, skew),
  loot(v, skew, data) {
    if (!Array.isArray(v)) return null;
    const rows = v.slice(0, 10).map((n) => ({
      id: n?.npc_id, name: n?.name, level: n?.level, nextAt: n?.next_level_at == null ? null : time(n.next_level_at, skew),
    })).filter((n) => positiveInt(n.id) && validName(n.name) && count(n.level, 10));
    const source = typeof data.source === 'string' && /^[a-z0-9 .-]{3,60}$/i.test(data.source) ? data.source : null;
    return rows.length && source ? { npcs: rows, source } : null;
  },
  gym(v) {
    // At the last gym there is no next one: the site sends both as null.
    if (v?.next_gym === null && v.percent === null) return { nextGym: null, percent: null, energy: null };
    if (typeof v?.next_gym !== 'string' || !v.next_gym || v.next_gym.length > 40 || !percent_(v.percent)) return null;
    return { nextGym: v.next_gym, percent: v.percent, energy: count(v.energy_to_next, 1e7) ? v.energy_to_next : null };
  },
  stocks: (v) => (count(v?.watched, 100) && count(v.crossed, 100) && v.watched > 0 ? { watched: v.watched, crossed: Math.min(v.crossed, v.watched) } : null),
};

/**
 * The sidebar read's answer, checked item by item. An item that was asked for and doesn't
 * fit is null, the same as nothing to show; one that wasn't asked for is left out.
 * @returns {{items: Map<string, object|null>, links: Array<{label: string, url: string}>}}
 */
export function readSidebar(data, asked, skew = 0) {
  const items = new Map();
  for (const key of asked) {
    const reader = SIDEBAR_READERS[key];
    if (!reader) continue;
    const raw = data?.[key];
    let value = null;
    if (raw !== null && raw !== undefined) {
      try {
        value = reader(raw, skew, data);
      } catch {
        value = null;
      }
    }
    items.set(key, value);
  }
  const links = (Array.isArray(data?.links) ? data.links : []).slice(0, 6)
    .filter((l) => typeof l?.label === 'string' && l.label && l.label.length <= 30
      && typeof l.url === 'string' && l.url.startsWith(`${SITE}/`) && l.url.length <= 200)
    .map((l) => ({ label: l.label, url: l.url }));
  return { items, links };
}

export const TIERS = Object.freeze(['bronze', 'silver', 'gold']);
const ACHIEVEMENT_ID = /^[a-z0-9][a-z0-9_-]{0,59}$/;
const SENTENCE = 160;
const UNLOCKED_MAX = 10;
const FEATURED_MAX = 5;
const ACHIEVEMENTS_PAGE = `${SITE}/me/achievements/`;

/** One achievement as the reply names it: id, name and tier, or null when it doesn't fit. */
function readAchievement(a) {
  if (typeof a?.id !== 'string' || !ACHIEVEMENT_ID.test(a.id) || !validName(a.name)) return null;
  if (a.tier != null && !TIERS.includes(a.tier)) return null;
  return { id: a.id, name: a.name, tier: a.tier ?? null };
}

/**
 * The achievements read's answer (WP-UX-8), checked field by field: what was earned after
 * `since`, oldest first, and the player's featured ones. `cursor` is the reply's own
 * server_time, as the site wrote it, for the next read's `since`.
 *
 * `silenced` is the player's one off switch on torn-tracker.com (HOOK-016): true when
 * their notification settings have `pause_all` on or `companion_toasts` off, false when
 * the reply says neither, and null when it carries neither field (an older site), so the
 * last answer stands. A featured entry the reply marks unearned is never shown (HOOK-032).
 * @returns {{unlocked: object[], featured: object[], url: string, cursor: string|null, silenced: boolean|null}}
 */
export function readAchievements(data) {
  const unlocked = (Array.isArray(data?.unlocked) ? data.unlocked : []).slice(0, UNLOCKED_MAX).map((a) => {
    const base = readAchievement(a);
    if (!base) return null;
    const sentence = typeof a.sentence === 'string' && a.sentence.trim() && a.sentence.length <= SENTENCE ? a.sentence.trim() : null;
    return { ...base, sentence, hidden: a.hidden === true, points: count(a.points, 1000) ? a.points : 0 };
  }).filter(Boolean);
  const featured = (Array.isArray(data?.featured) ? data.featured : []).slice(0, FEATURED_MAX)
    .filter((a) => a?.earned !== false).map(readAchievement).filter(Boolean);
  const url = typeof data?.url === 'string' && data.url.startsWith(`${SITE}/`) && data.url.length <= 200 ? data.url : ACHIEVEMENTS_PAGE;
  const cursor = typeof data?.server_time === 'string' && data.server_time.length <= 40 && Number.isFinite(Date.parse(data.server_time))
    ? data.server_time : null;
  const said = typeof data?.pause_all === 'boolean' || typeof data?.companion_toasts === 'boolean';
  const silenced = said ? data.pause_all === true || data.companion_toasts === false : null;
  return { unlocked, featured, url, cursor, silenced };
}

const trimmed = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
/** A link on our site: an absolute one on our host, or a path on it. */
function siteLink(v) {
  if (typeof v !== 'string' || v.length > 200) return null;
  if (/^\/(?!\/)/.test(v)) return `${SITE}${v}`;
  return v.startsWith(`${SITE}/`) ? v : null;
}

/**
 * The guide read's answer (GDE-007), checked field by field, or null when it doesn't fit:
 * whether the player started the guide, whether the site still offers it (never after a
 * dismissal), the step count, and the next open step with its call to action.
 */
export function readGuide(data) {
  if (!data || typeof data !== 'object' || typeof data.started !== 'boolean') return null;
  if (!count(data.done, 100) || !count(data.total, 100) || data.total === 0) return null;
  const n = data.next;
  let next = null;
  if (n && typeof n === 'object') {
    const title = trimmed(n.title, 80);
    const cta = trimmed(n.cta_label, 40);
    const href = siteLink(n.cta_url);
    if (title && cta && href) next = { title, outcome: trimmed(n.outcome, 200), cta, href };
  }
  return {
    started: data.started,
    offer: data.offer === true,
    done: Math.min(data.done, data.total),
    total: data.total,
    next,
    url: siteLink(data.url) ?? GUIDE_PAGE,
  };
}

/** A cached guide answer still has the shape readGuide gives. */
export function validGuide(v) {
  if (!v || typeof v !== 'object' || typeof v.started !== 'boolean' || typeof v.offer !== 'boolean') return false;
  if (!count(v.done, 100) || !count(v.total, 100) || v.done > v.total || typeof v.url !== 'string' || !v.url.startsWith(`${SITE}/`)) return false;
  if (v.next === null) return true;
  return typeof v.next?.title === 'string' && typeof v.next.cta === 'string'
    && typeof v.next.href === 'string' && v.next.href.startsWith(`${SITE}/`)
    && (v.next.outcome === null || typeof v.next.outcome === 'string');
}

export const POSITIONS = Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
const LABEL = 40;
/** D-074: OC role weights come from this provider, fetched by the site; always credited. */
export const WEIGHTS_SOURCE = 'tornprobability.com';
const OC_NAME = 100;

const BARE_SITE = SITE.replace('://www.', '://');

/** A link on torn-tracker.com, or null; the bare host is moved to www, the one @connect names. */
export function siteUrl(v) {
  if (typeof v !== 'string' || v.length > 500) return null;
  if (v.startsWith(`${SITE}/`)) return v;
  return v.startsWith(`${BARE_SITE}/`) ? `${SITE}${v.slice(BARE_SITE.length)}` : null;
}

const percent_ = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const percent = (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100);

/** An OC's roles as CAPI-035 gives them: up to six slots, each P1..P6 with a label. */
export function validRoles(v) {
  return Array.isArray(v) && v.length > 0 && v.length <= POSITIONS.length && v.every((r) => r
    && typeof r === 'object' && POSITIONS.includes(r.position_id)
    && typeof r.label === 'string' && r.label.length <= LABEL
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

/** One target list as the profile menu shows it (CAPI-037). */
const validList = (l) => l !== null && typeof l === 'object' && typeof l.uuid === 'string' && UUID.test(l.uuid)
  && typeof l.name === 'string' && l.name.trim().length > 0 && l.name.length <= LIST_NAME
  && typeof l.shared === 'boolean' && typeof l.contains === 'boolean';

/** A player's menu: the lists and the one last added to, which must be one of them. */
export function validLists(v) {
  return v !== null && typeof v === 'object' && Array.isArray(v.lists) && v.lists.length <= LISTS_MAX
    && v.lists.every(validList) && (v.lastUsed === null || v.lists.some((l) => l.uuid === v.lastUsed));
}

/** The lists read (CAPI-037), field by field; a list that does not fit is left out. */
export function readLists(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.lists)) return null;
  const lists = [];
  const seen = new Set();
  for (const row of data.lists) {
    const list = { uuid: row?.uuid, name: typeof row?.name === 'string' ? row.name.trim() : row?.name, shared: row?.shared, contains: row?.contains };
    if (!validList(list) || seen.has(list.uuid.toLowerCase())) continue;
    seen.add(list.uuid.toLowerCase());
    lists.push(list);
    if (lists.length === LISTS_MAX) break;
  }
  const lastUsed = lists.find((l) => typeof data.last_used === 'string' && l.uuid.toLowerCase() === data.last_used.toLowerCase())?.uuid ?? null;
  return { lists, lastUsed };
}

/** A 403 because the key lacks a scope (CAPI-020), as opposed to one refusing the read. */
const lacksScope = (result) => result?.status === 403 && /\blacks the \S+ scope\b/.test(String(result.data?.detail ?? ''));

export const SPACES = Object.freeze({
  ff: { ttlMs: HOUR, max: 2_000, valid: validFf },
  prices: { ttlMs: 10 * 60_000, max: 2_000, valid: validPrice },
  ocRoles: { ttlMs: HOUR, max: 200, valid: validRoles },
  crimeValue: { ttlMs: HOUR, max: 100, valid: validCrimeValue },
  guide: { ttlMs: GUIDE_TTL, max: 1, valid: validGuide },
  trust: { ttlMs: TRUST_TTL, max: 500, valid: validTrust },
  lists: { ttlMs: LISTS_TTL, max: 200, valid: validLists },
  trustLink: { ttlMs: DAY, max: 1, valid: (v) => typeof v === 'string' && v.length <= 500 && v.startsWith(`${SITE}/`) },
  shops: { ttlMs: DAY, max: 1, valid: validShopRows },
  // The site had no table: the built-in one serves for an hour before it is asked again.
  shopsMissed: { ttlMs: HOUR, max: 1, valid: (v) => v === true },
});

/** What a chain watch reply that isn't an answer means, or null when it is one. */
function watchFailure(result) {
  if (keyRefused(result)) return { status: 'refused' };
  if (result?.status === 404 && result.data?.reason === 'no_faction') return { status: 'no_faction' };
  if (result?.status === 429) {
    const seconds = Number(result.retryAfter);
    return { status: 'wait', retryMs: Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) * 1000 : 60_000 };
  }
  if (!result || result.status === 0) return { status: 'failed' };
  return null;
}

/**
 * @param {object} opts
 * @param {() => string} opts.getKey
 * @param {typeof request} [opts.send]
 * @param {ReturnType<typeof createCache>} [opts.cache]
 * @param {() => void} [opts.onBanned]  the site refused the account itself (a ban)
 */
export function createSite({
  getKey, send = request, cache = createCache(SPACES), now = Date.now, onBanned = () => {},
}) {
  /** Set when the site refuses the key; reads stop until the key changes. */
  let refusedKey = null;
  /** The last demand answer and when it came. */
  let demandMemo = null;
  /** The war loadouts answer and when it came (LDT-032: at most once a minute). */
  let warLoadoutsMemo = null;
  /** Open loadout reads by player id. */
  const openLoadouts = new Map();
  /** The player's own travel runs and when they came (TRV-050: kept 5 minutes). */
  let runsMemo = null;
  /** The stock signals answer and when it came (CMP-304: kept 5 minutes). */
  let stockMemo = null;
  /** The player's own mugs of others, by target id (MUG-031: kept 10 minutes). */
  const myMugs = new Map();
  /** Auction listing values by listing id (#199: kept 10 minutes; null = the site has none). */
  const auctionValues = new Map();
  /** The shop price read in flight, so a page asks once however many features want it. */
  let shopsAsking = null;

  const headers = () => ({ Authorization: `Bearer ${getKey()}`, Accept: 'application/json' });
  const usable = () => Boolean(getKey()) && getKey() !== refusedKey;

  async function exchange(url, opts) {
    const result = await send(url, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
    if (keyRefused(result)) refusedKey = getKey();
    if (accountBanned(result)) onBanned();
    return result;
  }

  /**
   * The lists calls: a 401 or a ban counts as for every read, but a key lacking the lists
   * scope only answers this feature (the player may have left it off on purpose).
   */
  async function listsExchange(url, opts) {
    const result = await send(url, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
    if (result?.status === 401) refusedKey = getKey();
    if (accountBanned(result)) onBanned();
    return result || { ok: false, status: 0, data: null };
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
     * Which of these players are listed for mugging sellers shortly after a sale
     * (TRU-022, TRU-023; the read accepted on hq #368). The site answers only for listed
     * players, so a reply never says who was looked up below the threshold; everyone else
     * asked is `{listed: false}`. Each answer is kept 10 minutes. Until the site serves
     * the read, nothing is cached and every player is simply absent.
     * @param {number[]} ids
     * @returns {Promise<{players: Map<number, object>, safetyUrl: string|null}>}
     */
    async muggers(ids) {
      const { found, missing } = split('trust', ids.filter(positiveInt));
      const ask = missing.slice(0, MAX_IDS);
      const link = () => cache.get('trustLink', 'url') ?? null;
      if (ask.length === 0 || !usable()) return { players: found, safetyUrl: link() };

      const data = await call(TRUST_MUGGERS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ask }),
      });
      if (!data || typeof data !== 'object' || !Array.isArray(data.results)) return { players: found, safetyUrl: link() };
      const skew = skewOf(data);
      // A path, or a link on our host (the bare host is moved to www, as for the war brief).
      const safetyUrl = siteLink(data.safety_url) ?? siteUrl(data.safety_url);
      if (safetyUrl) cache.set('trustLink', 'url', safetyUrl);
      for (const row of data.results) {
        if (!positiveInt(row?.id) || !ask.includes(row.id) || row.listed !== true) continue;
        const last = row.last_reported_at == null ? null : time(row.last_reported_at, skew);
        const value = { listed: true, mugs30: row.mugs_30d, mugs90: row.mugs_90d, lastAt: last };
        if (!validTrust(value)) continue;
        cache.set('trust', row.id, value);
        found.set(row.id, value);
      }
      for (const id of ask) {
        if (found.has(id)) continue;
        cache.set('trust', id, { listed: false });
        found.set(id, { listed: false });
      }
      return { players: found, safetyUrl: link() };
    },

    /**
     * The player's target lists, and whether one player is on each (CAPI-037, CMP-110):
     * own lists first, then the faction lists they may edit. Kept 5 minutes per player,
     * and dropped after a change. A key without the lists scope reads as no key; it does
     * not stop the other reads.
     * @param {number} playerId  the profile's player
     * @returns {Promise<{status: 'ok'|'no_key'|'busy'|'failed', lists: object[], lastUsed: string|null}>}
     */
    async lists(playerId) {
      const none = (status) => ({ status, lists: [], lastUsed: null });
      if (!positiveInt(playerId)) return none('failed');
      const hit = cache.get('lists', playerId);
      if (hit) return { status: 'ok', ...hit };
      if (!usable()) return none('no_key');
      const result = await listsExchange(`${LISTS_URL}?player=${playerId}`, { method: 'GET' });
      if (lacksScope(result) || result.status === 401) return none('no_key');
      if (result.status === 429) return none('busy');
      const value = result.ok ? readLists(result.data) : null;
      if (!value) return none('failed');
      cache.set('lists', playerId, value);
      return { status: 'ok', ...value };
    },

    /**
     * Adds a player to one list, or takes them off it (CAPI-037). One press is one call.
     * The player's menu is read again afterwards, whatever the answer.
     * @param {string} uuid
     * @param {number} playerId
     * @param {'add'|'remove'} action
     * @returns {Promise<{ok: boolean, state: 'on'|'off'|null, error: null|'invalid'|'no_key'|'not_yours'|'not_your_entry'|'not_allowed'|'busy'|'failed'}>}
     *          not_yours: the list is gone or read-only (404, 403); not_your_entry: on a shared
     *          list only whoever added the player, or the list's owner, takes them off
     */
    async listEntry(uuid, playerId, action) {
      if (typeof uuid !== 'string' || !UUID.test(uuid) || !positiveInt(playerId) || !['add', 'remove'].includes(action)) {
        return { ok: false, state: null, error: 'invalid' };
      }
      if (!usable()) return { ok: false, state: null, error: 'no_key' };
      const result = await listsExchange(`${LISTS_URL}/${encodeURIComponent(uuid)}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, action }),
      });
      cache.drop('lists', playerId);
      const data = result.data && typeof result.data === 'object' ? result.data : {};
      if (result.ok) {
        const state = ['on', 'off'].includes(data.state) ? data.state : (action === 'add' ? 'on' : 'off');
        return { ok: true, state, error: null };
      }
      // tc-targets#360 names its refusals in `detail`; `error` is the other endpoints' key.
      const code = [data.detail, data.error].find((v) => typeof v === 'string') ?? '';
      let error = 'failed';
      if (lacksScope(result) || result.status === 401) error = 'no_key';
      else if (result.status === 403 && code === 'not_your_entry') error = 'not_your_entry';
      else if (result.status === 400 && code === 'on_ares_list') error = 'not_allowed';
      else if (result.status === 403 || result.status === 404) error = 'not_yours';
      else if (result.status === 429) error = 'busy';
      return { ok: false, state: null, error };
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
     * What a shop pays for each item (CMP-109): the site's table, kept 24 hours, or the
     * table built into this release when the site has none. Public data: asked without
     * the script key, so it works before the player has one.
     * @returns {Promise<Map<number, import('./shops.js').ShopPrice>>}
     */
    async shops() {
      const cached = cache.get('shops', 'all');
      if (cached) return tableOf(cached);
      if (cache.get('shopsMissed', 'all')) return BUILT_IN;
      shopsAsking ||= send(SHOP_PRICES_URL, { method: 'GET', headers: { Accept: 'application/json' } })
        .then((result) => {
          const rows = result.ok ? readShopReply(result.data) : null;
          if (rows) cache.set('shops', 'all', rows);
          else cache.set('shopsMissed', 'all', true);
          return rows;
        })
        .catch(() => null)
        .finally(() => {
          shopsAsking = null;
        });
      const rows = await shopsAsking;
      return rows ? tableOf(rows) : BUILT_IN;
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
     * Shared job-board cards for the applicants on a company or faction application list
     * (JOB-072, accepted in hq #79). The site decides whose board from the token's verified
     * director or recruiter, never from the page. Not cached.
     * @param {'company'|'faction'} board
     * @param {number[]} ids  the applicants on the page, at most 100
     * @returns {Promise<{allowed: boolean, cards: Map<number, object>}>}
     *          allowed false when the player isn't the board's director or recruiter
     */
    async applicantCards(board, ids) {
      const ask = [...new Set(ids.filter(positiveInt))].slice(0, MAX_IDS);
      if (!['company', 'faction'].includes(board) || ask.length === 0 || !usable()) {
        return { allowed: true, cards: new Map() };
      }
      const result = await exchange(APPLICANTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board, ids: ask }),
      });
      if (result.status === 403 && result.data?.error === 'not_director') return { allowed: false, cards: new Map() };
      const cards = new Map();
      for (const c of result.ok && Array.isArray(result.data?.cards) ? result.data.cards : []) {
        if (!positiveInt(c?.id) || !ask.includes(c.id)) continue;
        const merits = c.merits === null || (Number.isInteger(c.merits) && c.merits >= 0 && c.merits <= 10) ? c.merits : undefined;
        const points = c.job_points === null || (Number.isInteger(c.job_points) && c.job_points >= 0) ? c.job_points : undefined;
        const fit = c.fit === null || ['good', 'fair', 'poor'].includes(c.fit) ? c.fit : undefined;
        if (merits === undefined || points === undefined || fit === undefined) continue;
        const url = typeof c.card_url === 'string' && c.card_url.startsWith(`${SITE}/`) ? c.card_url : null;
        cards.set(c.id, { merits, job_points: points, fit, card_url: url });
      }
      return { allowed: true, cards };
    },

    /**
     * The pre-war strip for the token's own faction (PRE-042, accepted in hq #136): the
     * one-line compare, and the brief's headline for Pro. Asked once per page view.
     * @returns {Promise<{opponent: number, compare: string|null, headline: string|null, briefUrl: string|null, pro: boolean}|null>}
     *          null outside the pre-war window, or on any failure
     */
    async warBrief() {
      if (!usable()) return null;
      const data = await call(WAR_BRIEF_URL, { method: 'GET' });
      const war = data?.war;
      if (!war || typeof war !== 'object' || !positiveInt(war.opponent_faction_id)) return null;
      const line = (v) => (typeof v === 'string' && v.trim() && v.length <= 200 ? v.trim() : null);
      const url = siteUrl(data.brief_url);
      return {
        opponent: war.opponent_faction_id,
        compare: line(data.compare),
        headline: data.pro === true ? line(data.headline) : null,
        briefUrl: url,
        pro: data.pro === true,
      };
    },

    /**
     * The player's own best travel runs, as their planner ranks them (TRV-050, accepted
     * in hq #78). Kept 5 minutes. Every field is checked; a run that does not fit is left
     * out, never guessed.
     * @returns {Promise<{runs: object[], reason: string|null, basis: string|null}|null>}
     */
    async travelRuns(limit = 3) {
      if (runsMemo && now() - runsMemo.at < TRAVEL_RUNS_TTL) return runsMemo.value;
      if (!usable()) return null;
      const n = Math.min(5, Math.max(1, Math.trunc(limit) || 3));
      const data = await call(`${TRAVEL_RUNS_URL}?limit=${n}`, { method: 'GET' });
      if (!data || typeof data !== 'object') return null;
      const skew = skewOf(data);
      const runs = (Array.isArray(data.runs) ? data.runs.slice(0, n) : []).map((r) => readRun(r, skew)).filter(Boolean);
      const value = {
        runs,
        reason: data.reason === 'no_capacity' ? 'no_capacity' : null,
        basis: typeof data.basis === 'string' && data.basis.length <= 30 ? data.basis : null,
      };
      runsMemo = { at: now(), value };
      return value;
    },

    /**
     * The site's simple signal per stock (CMP-304, companion-api §6.4): far below or far
     * above its 30-day average, or none yet. Public market data, the same for everyone.
     * Kept 5 minutes.
     * @returns {Promise<Map<number, {signal: 'below_avg'|'above_avg'|null, avg_30d: number|null, price: number|null}>>}
     */
    async stockSignals() {
      if (stockMemo && now() - stockMemo.at < STOCK_SIGNALS_TTL) return stockMemo.value;
      const value = new Map();
      if (!usable()) return value;
      const data = await call(STOCK_SIGNALS_URL, { method: 'GET' });
      if (!data) return value;
      const money = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9 ? v : null);
      for (const row of Array.isArray(data.signals) ? data.signals : []) {
        if (!positiveInt(row?.stock_id) || row.stock_id > 1_000) continue;
        if (!(row.signal === null || row.signal === 'below_avg' || row.signal === 'above_avg')) continue;
        value.set(row.stock_id, { signal: row.signal, avg_30d: money(row.avg_30d), price: money(row.price) });
      }
      stockMemo = { at: now(), value };
      return value;
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

    /**
     * The sidebar block's one read (CMP-108, companion-api §6.4): only the items asked
     * for. Never cached: the block asks at most once a minute, and only while it's open
     * and the tab is visible.
     * @param {string[]} asked
     * @returns {Promise<{status: 'ok', items: Map<string, object|null>, links: object[]}
     *   | {status: 'no_key'|'refused'|'failed'} | {status: 'wait', retryMs: number}>}
     */
    async sidebar(asked) {
      const ask = SIDEBAR_KEYS.filter((key) => asked.includes(key));
      if (!getKey()) return { status: 'no_key' };
      if (!usable()) return { status: 'refused' };
      const result = await exchange(`${SIDEBAR_URL}?items=${ask.join(',')}`, { method: 'GET' });
      if (keyRefused(result)) return { status: 'refused' };
      if (result.status === 429) {
        const seconds = Number(result.retryAfter);
        return { status: 'wait', retryMs: Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) * 1000 : 60_000 };
      }
      if (!result.ok || !result.data || typeof result.data !== 'object') return { status: 'failed' };
      return { status: 'ok', ...readSidebar(result.data, ask, skewOf(result.data)) };
    },

    /**
     * The faction's chain watch rota (CHW-040): `hours` from the slot `from` is in.
     * @param {number} from    a time in the first slot (UTC ms)
     * @param {number} hours   1 to 168
     * @returns {Promise<{status: 'ok', slots: object[], gaps: number[], skew: number}
     *   | {status: 'no_key'|'refused'|'no_faction'|'failed'} | {status: 'wait', retryMs: number}>}
     */
    async chainWatch(from, hours = 24) {
      if (!getKey()) return { status: 'no_key' };
      if (!usable()) return { status: 'refused' };
      const start = new Date(Math.floor(from / SLOT_MS) * SLOT_MS).toISOString();
      const span = Math.min(168, Math.max(1, Math.round(hours)));
      const result = await exchange(`${CHAIN_WATCH_URL}?from=${encodeURIComponent(start)}&hours=${span}`, { method: 'GET' });
      const failed = watchFailure(result);
      if (failed) return failed;
      const data = result.data && typeof result.data === 'object' ? result.data : null;
      if (!result.ok || !data || !Array.isArray(data.slots)) return { status: 'failed' };
      return {
        status: 'ok',
        slots: data.slots.slice(0, 168 * 2 * 3).map(readWatchSlot).filter(Boolean),
        gaps: (Array.isArray(data.gaps) ? data.gaps : []).slice(0, 336).map(slotTime).filter((g) => g !== null),
        skew: skewOf(data),
      };
    },

    /**
     * Signs the member up for a stretch in one role, all or nothing (CHW-041).
     * @param {{start: number, slots: number, role: string}} ask  start in UTC ms, on :00 or :30
     * @returns {Promise<{status: 'saved', slots: object[]} | {status: 'clash', clashes: object[], free: Map}
     *   | {status: 'invalid', detail: string|null} | {status: 'no_key'|'refused'|'no_faction'|'failed'}
     *   | {status: 'wait', retryMs: number}>}
     */
    async watchSignUp({ start, slots, role }) {
      if (!Number.isInteger(start) || start % SLOT_MS !== 0 || !Number.isInteger(slots) || slots < 1 || slots > 24 || !roleOf(role)) {
        return { status: 'invalid', detail: null };
      }
      if (!getKey()) return { status: 'no_key' };
      if (!usable()) return { status: 'refused' };
      const result = await exchange(CHAIN_WATCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: new Date(start).toISOString(), slots, role }),
      });
      if (result.status === 409) return { status: 'clash', ...readClash(result.data) };
      if (result.status === 400) {
        const detail = typeof result.data?.detail === 'string' && result.data.detail.length <= 200 ? result.data.detail : null;
        return { status: 'invalid', detail };
      }
      const failed = watchFailure(result);
      if (failed) return failed;
      if (!result.ok) return { status: 'failed' };
      const rows = Array.isArray(result.data) ? result.data : result.data?.slots;
      return { status: 'saved', slots: (Array.isArray(rows) ? rows : []).slice(0, 24).map(readWatchSlot).filter(Boolean) };
    },

    /**
     * Drops the member's own slots in a stretch (CHW-042). Torn PDA's helpers send only GET
     * and POST, so from PDA it answers 'pda' and asks nothing.
     * @returns {Promise<{status: 'dropped'|'pda'|'no_key'|'refused'|'no_faction'|'failed'} | {status: 'wait', retryMs: number}>}
     */
    async watchDrop({ start, slots }) {
      if (!Number.isInteger(start) || start % SLOT_MS !== 0 || !Number.isInteger(slots) || slots < 1 || slots > 24) return { status: 'failed' };
      if (typeof globalThis.PDA_httpGet === 'function' || typeof globalThis.PDA_httpPost === 'function') return { status: 'pda' };
      if (!getKey()) return { status: 'no_key' };
      if (!usable()) return { status: 'refused' };
      const at = encodeURIComponent(new Date(start).toISOString());
      const result = await exchange(`${CHAIN_WATCH_URL}?start=${at}&slots=${slots}`, { method: 'DELETE' });
      const failed = watchFailure(result);
      if (failed) return failed;
      return { status: result.ok ? 'dropped' : 'failed' };
    },

    /**
     * The player's achievements earned after `since` (an ISO time from the last reply),
     * and their featured ones (WP-UX-8). Never cached here: core/unlocks.js paces it.
     * @param {string|null} since
     */
    async achievements(since) {
      if (!getKey()) return { status: 'no_key' };
      if (!usable()) return { status: 'refused' };
      const query = since ? `?since=${encodeURIComponent(since)}` : '';
      const result = await exchange(`${ACHIEVEMENTS_URL}${query}`, { method: 'GET' });
      if (keyRefused(result)) return { status: 'refused' };
      if (result.status === 429) {
        const seconds = Number(result.retryAfter);
        return { status: 'wait', retryMs: Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) * 1000 : 5 * 60_000 };
      }
      if (!result.ok || !result.data || typeof result.data !== 'object') return { status: 'failed' };
      return { status: 'ok', ...readAchievements(result.data) };
    },

    /**
     * The player's guide: the next open step and its call to action (GDE-007). Kept 15
     * minutes in the read cache, so the settings page shows it without asking.
     * @returns {Promise<object|null>}
     */
    async guide() {
      const hit = cache.get('guide', 'me');
      if (hit !== undefined) return hit;
      if (!usable()) return null;
      const value = readGuide(await call(GUIDE_URL, { method: 'GET' }));
      if (value) cache.set('guide', 'me', value);
      return value;
    },

    /** The guide as last read, without asking; null when there is none fresh. */
    guideHeld: () => cache.get('guide', 'me') ?? null,

    /** The site refused the current key (the panel says so). */
    keyRefused: () => Boolean(getKey()) && getKey() === refusedKey,
  };
}
