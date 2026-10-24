// The upload queue (CMP-008, CMP-014, CMP-023; the server side is CAPI-011..014).
//
// Observations wait here, on the device, until they can go to torn-tracker.com:
//   - at most 200 are kept, the oldest dropped first, and none older than 10 minutes
//     (the site refuses those anyway);
//   - a flush sends one batch of up to 50, all of one kind, at most once every 15 s. One
//     kind per batch because the site refuses a whole batch for one bad entry and answers
//     426 only for a batch of one kind; this way a problem with one kind never holds up
//     another;
//   - a flush is set off by the player's own page views (an observation being queued, or
//     the page being left) and only ever talks to our host. Nothing here touches torn.com;
//   - 429 waits out Retry-After, 401 (or a 403 for a scope the key lacks) pauses sharing until the player saves a new key,
//     426 stops that kind until the script is updated, and the panel says which.
//
// The queue and its state live in ttc_queue, so a page change does not lose them. Two
// open tabs each keep their own copy and the last to write wins; at worst an observation
// is lost or sent twice, and the site drops duplicates.

import { SITE } from '../hosts.js';
import { checkObservation, isKnownKind } from './kinds.js';
import { keyRefused, request } from './net.js';
import { KEYS, read, write } from './storage.js';
import { log, warn } from './log.js';

export const ENDPOINT = `${SITE}/api/feeds/observations`;

export const MAX_QUEUE = 200;
export const BATCH_MAX = 50;
export const FLUSH_GAP_MS = 15_000;
export const MAX_AGE_MS = 10 * 60_000;
/** When the site is unreachable, or says 429 without saying how long. */
export const RETRY_MS = 60_000;
/** A keepalive request may carry at most 64 KiB in browsers; stay under it. */
const KEEPALIVE_BYTES = 60_000;
/** A server clock further off than this is not believed. */
const MAX_OFFSET_MS = 24 * 3_600_000;

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/;

function emptyState() {
  return {
    items: [],
    /** epoch ms before which nothing is sent (429, or the site being down) */
    retryAt: 0,
    /** the site refused the script key; nothing is sent until a new one is saved */
    authFailed: false,
    /** kind -> the minimum script version the site asked for (426) */
    blocked: {},
    /** server clock minus device clock, from the last reply that carried server_time */
    offsetMs: 0,
    /** the outcome of the last flush, for the panel */
    last: null,
  };
}

/** Every field from storage is checked; anything that does not fit is dropped. */
export function normalizeState(raw) {
  const state = emptyState();
  const given = raw && typeof raw === 'object' ? raw : {};
  if (Array.isArray(given.items)) {
    for (const item of given.items.slice(-MAX_QUEUE)) {
      const checked = checkObservation(item);
      if (checked.value) state.items.push(checked.value);
    }
  }
  if (Number.isFinite(given.retryAt) && given.retryAt > 0) state.retryAt = given.retryAt;
  state.authFailed = given.authFailed === true;
  if (given.blocked && typeof given.blocked === 'object') {
    for (const [kind, version] of Object.entries(given.blocked)) {
      if (isKnownKind(kind) && typeof version === 'string' && (SEMVER.test(version) || version === '?')) {
        state.blocked[kind] = version;
      }
    }
  }
  if (Number.isFinite(given.offsetMs) && Math.abs(given.offsetMs) <= MAX_OFFSET_MS) state.offsetMs = given.offsetMs;
  if (given.last && typeof given.last === 'object' && typeof given.last.outcome === 'string'
    && Number.isFinite(given.last.at)) {
    state.last = {
      outcome: given.last.outcome.slice(0, 40),
      at: given.last.at,
      accepted: Number.isInteger(given.last.accepted) ? given.last.accepted : 0,
    };
  }
  return state;
}

/** Retry-After is seconds or an HTTP date; anything else is no answer. */
export function retryAfterMs(value, now) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text) * 1000;
  const when = Date.parse(text);
  return Number.isNaN(when) ? null : Math.max(0, when - now);
}

function serverOffset(data, deviceNow) {
  const raw = data?.server_time;
  let at = null;
  if (typeof raw === 'number' && Number.isFinite(raw)) at = raw < 1e12 ? raw * 1000 : raw;
  else if (typeof raw === 'string') at = Date.parse(raw);
  if (at == null || Number.isNaN(at)) return null;
  const offset = at - deviceNow;
  return Math.abs(offset) <= MAX_OFFSET_MS ? offset : null;
}

/**
 * @param {object} opts
 * @param {() => string} opts.getKey   the script key, '' when there is none
 * @param {typeof request} [opts.send]
 * @param {() => number} [opts.now]    the device clock
 * @param {object} [opts.timers]       { setTimeout, clearTimeout }
 * @param {(state: object) => void} [opts.onChange]  the panel's status line listens here
 */
export function createUploader({
  getKey,
  send = request,
  now = Date.now,
  timers = globalThis,
  onChange = () => {},
}) {
  let state = emptyState();
  let timer = null;
  let flushing = false;
  let lastFlushAt = 0;
  let persistQueued = false;
  /** Bumped by clear(), so a write queued before "Forget me" does not bring it all back. */
  let generation = 0;

  const changed = () => {
    if (!persistQueued) {
      persistQueued = true;
      const mine = generation;
      // Many observations queued in one go are one write, not one each.
      Promise.resolve().then(() => {
        persistQueued = false;
        if (mine === generation) write(KEYS.queue, state);
      });
    }
    try {
      onChange(status());
    } catch { /* the panel's problem, not the queue's */ }
  };

  /** The device clock corrected by the site's, so observed_at matches the server's view. */
  const serverNow = () => now() + state.offsetMs;

  function prune() {
    const cutoff = serverNow() - MAX_AGE_MS;
    const before = state.items.length;
    state.items = state.items.filter((item) => Date.parse(item.observed_at) >= cutoff && !state.blocked[item.kind]);
    if (state.items.length > MAX_QUEUE) state.items = state.items.slice(-MAX_QUEUE);
    return before !== state.items.length;
  }

  function status() {
    return {
      queued: state.items.length,
      hasKey: Boolean(getKey()),
      authFailed: state.authFailed,
      retryAt: state.retryAt > now() ? state.retryAt : 0,
      blocked: { ...state.blocked },
      last: state.last,
    };
  }

  /** Something is waiting and could go once any wait is over. */
  function sendable() {
    return state.items.length > 0 && Boolean(getKey()) && !state.authFailed;
  }

  function canSend() {
    return sendable() && now() >= state.retryAt;
  }

  function schedule() {
    if (timer !== null || !sendable()) return;
    const wait = Math.max(0, lastFlushAt + FLUSH_GAP_MS - now(), state.retryAt - now());
    timer = timers.setTimeout(() => {
      timer = null;
      flush();
    }, wait);
  }

  function nextBatch(maxBytes = Infinity) {
    const kind = state.items[0]?.kind;
    if (!kind) return null;
    let batch = state.items.filter((item) => item.kind === kind).slice(0, BATCH_MAX);
    let body = JSON.stringify({ observations: batch });
    while (body.length > maxBytes && batch.length > 1) {
      batch = batch.slice(0, Math.ceil(batch.length / 2));
      body = JSON.stringify({ observations: batch });
    }
    if (body.length > maxBytes) return null;
    return { kind, batch, body };
  }

  const remove = (batch) => {
    const sent = new Set(batch);
    state.items = state.items.filter((item) => !sent.has(item));
  };

  /**
   * Sends one batch if one can go now. The only path from this module to the network.
   * @param {object} [opts]
   * @param {boolean} [opts.keepalive]  the page is going away (pagehide)
   */
  async function flush({ keepalive = false } = {}) {
    if (flushing) return null;
    if (prune()) changed();
    if (!canSend()) return null;
    if (!keepalive && now() < lastFlushAt + FLUSH_GAP_MS) {
      schedule();
      return null;
    }

    const next = nextBatch(keepalive ? KEEPALIVE_BYTES : Infinity);
    if (!next) return null;
    flushing = true;
    lastFlushAt = now();

    let result;
    try {
      result = await send(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getKey()}`, 'Content-Type': 'application/json' },
        body: next.body,
        keepalive,
      });
    } finally {
      flushing = false;
    }

    settle(next, result);
    changed();
    schedule();
    return result;
  }

  function settle({ kind, batch }, result) {
    const at = now();
    const outcome = (name, extra = {}) => {
      state.last = { outcome: name, at, accepted: 0, ...extra };
    };

    if (result.ok) {
      remove(batch);
      const offset = serverOffset(result.data, at);
      if (offset !== null) state.offsetMs = offset;
      state.retryAt = 0;
      const accepted = Number.isInteger(result.data?.accepted) ? result.data.accepted : batch.length;
      outcome('sent', { accepted });
      log('uploaded', batch.length, kind, result.data);
    } else if (keyRefused(result)) {
      // The batch stays: it is the key that was wrong, not the observations.
      state.authFailed = true;
      outcome('key refused');
      warn('the site refused the script key; sharing is paused until a new one is saved');
    } else if (result.status === 426) {
      const min = result.data?.min_version;
      state.blocked[kind] = typeof min === 'string' && SEMVER.test(min) ? min : '?';
      state.items = state.items.filter((item) => item.kind !== kind);
      outcome('update needed');
      warn(`the site needs a newer script to accept ${kind}`);
    } else if (result.status === 429) {
      state.retryAt = at + (retryAfterMs(result.retryAfter, at) ?? RETRY_MS);
      outcome('slowed down');
    } else if (result.status >= 400 && result.status < 500) {
      // 400, 413, 422: sending the same batch again would get the same answer.
      remove(batch);
      outcome('refused');
      warn(`the site refused a batch of ${kind} (${result.status}); it was dropped`);
    } else {
      // The site is down or unreachable: keep everything and try again later.
      state.retryAt = at + RETRY_MS;
      outcome('unreachable');
    }
  }

  return {
    async load() {
      state = normalizeState(await read(KEYS.queue));
      if (prune()) changed();
      schedule();
      return status();
    },

    /**
     * Queues one observation that already passed the sharing gate.
     * @returns {boolean} false when it did not fit the kind's shape and was dropped
     */
    add(observation) {
      const checked = checkObservation(observation);
      if (checked.error) {
        warn(`dropped a ${observation?.kind} observation: ${checked.error}`);
        return false;
      }
      if (state.blocked[checked.value.kind]) return false;
      state.items.push(checked.value);
      prune();
      changed();
      schedule();
      return true;
    },

    flush,
    status,
    serverNow,

    /** The player saved a new script key: try again with it. */
    keyChanged() {
      state.authFailed = false;
      changed();
      schedule();
    },

    /** "Forget me". Storage is cleared by the caller; this drops what is in memory. */
    clear() {
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
      generation += 1;
      persistQueued = false;
      state = emptyState();
      onChange(status());
    },

    stop() {
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
    },
  };
}
