// One gate for every read from torn-tracker.com, shared by all open Torn tabs (hq #721).
//
// The site allows a script key 60 reads a minute and its sidebar one a minute (CMP-108).
// Each tab used to count on its own, so two tabs and a reload could go over, and a feed
// the account may not read (a 403) was asked again on every page. What is kept here, under
// `ttc_reads` on this device, is shared through storage, so every tab sees it:
//
//   - `pausedUntil`: a 429's Retry-After. Every read waits it out, in every tab;
//   - `refused`: feeds that answered 403, by path, with the answer, kept an hour. The tab
//     replays that answer instead of asking again (a 403 for a scope or the account is
//     not transient; joining a faction is rare, and the hour bounds the wait);
//   - `reads`: when the last reads went out, so all tabs together stay under READS_MAX;
//   - `sidebar`: which items any tab last read the sidebar for, and when, so only one tab
//     a minute reads them.
//
// Nothing here holds the key, a player id or an answer's body beyond a 403's error code.

import { KEYS, read as readStore, write as writeStore } from './storage.js';

/** The site's budget is 60 a minute; stay under it with room for a slow clock. */
export const READS_MAX = 55;
export const WINDOW_MS = 60_000;
/** How long a 403 is replayed instead of asked again. */
export const REFUSED_MS = 60 * 60_000;
/** The longest a Retry-After is honoured. */
export const PAUSE_MAX_MS = 60 * 60_000;
/**
 * One sidebar read a minute across tabs (CMP-108): the same 55 s a tab keeps the answer
 * for, so another tab's page load inside it draws that answer instead of asking.
 */
export const SIDEBAR_EVERY_MS = 55_000;
const REFUSED_MAX = 40;
const CODE = /^[a-z_]{1,40}$/;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** The stored record, checked field by field; anything odd is dropped. */
export function readState(raw, now) {
  const state = { pausedUntil: 0, refused: {}, reads: [], sidebar: null };
  if (!raw || typeof raw !== 'object') return state;
  if (finite(raw.pausedUntil) && raw.pausedUntil > now && raw.pausedUntil <= now + PAUSE_MAX_MS) {
    state.pausedUntil = raw.pausedUntil;
  }
  if (raw.refused && typeof raw.refused === 'object') {
    for (const [path, entry] of Object.entries(raw.refused).slice(0, REFUSED_MAX)) {
      if (!path.startsWith('/api/feeds/') || path.length > 200) continue;
      if (!entry || !finite(entry.until) || entry.until <= now || entry.until > now + REFUSED_MS) continue;
      state.refused[path] = { until: entry.until, error: typeof entry.error === 'string' && CODE.test(entry.error) ? entry.error : null };
    }
  }
  if (Array.isArray(raw.reads)) {
    state.reads = raw.reads.filter((t) => finite(t) && now - t < WINDOW_MS && t <= now + 1000).slice(-READS_MAX);
  }
  const sb = raw.sidebar;
  if (sb && typeof sb === 'object' && typeof sb.items === 'string' && sb.items.length <= 200
    && typeof sb.tab === 'string' && sb.tab.length <= 20
    && finite(sb.at) && sb.at <= now + 1000 && now - sb.at < WINDOW_MS) {
    state.sidebar = { items: sb.items, tab: sb.tab, at: sb.at };
  }
  return state;
}

/** The path a 403 is kept under: no host, no query. */
export function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/** A store that lives in this tab only: for tests, and a site made without the shared one. */
export function memoryStore() {
  const kept = new Map();
  return {
    read: async (key) => (kept.has(key) ? JSON.parse(kept.get(key)) : null),
    write: async (key, value) => {
      kept.set(key, JSON.stringify(value));
      return true;
    },
  };
}

/**
 * @param {object} [opts]
 * @param {() => number} [opts.now]
 * @param {(key: string) => Promise<unknown>} [opts.read]
 * @param {(key: string, value: unknown) => Promise<boolean>} [opts.write]
 */
export function createReadGate({ now = Date.now, read = readStore, write = writeStore } = {}) {
  /** This page's own mark: the tab holding the sidebar turn keeps its own minute. */
  const tab = Math.random().toString(36).slice(2, 12);
  const load = async () => readState(await read(KEYS.reads), now());
  const save = (state) => write(KEYS.reads, state);

  return {
    /**
     * Whether a read may go out now. When it may, it is counted for every tab.
     * @param {string} url
     * @param {string} method
     * @returns {Promise<{go: true} | {go: false, why: 'paused'|'budget', waitMs: number}
     *   | {go: false, why: 'refused', error: string|null}>}
     */
    async admit(url, method) {
      const t = now();
      const state = await load();
      if (state.pausedUntil > t) return { go: false, why: 'paused', waitMs: state.pausedUntil - t };
      const path = method === 'GET' ? pathOf(url) : null;
      const refused = path ? state.refused[path] : undefined;
      if (refused) return { go: false, why: 'refused', error: refused.error };
      if (state.reads.length >= READS_MAX) {
        return { go: false, why: 'budget', waitMs: Math.max(1000, state.reads[0] + WINDOW_MS - t) };
      }
      state.reads.push(t);
      await save(state);
      return { go: true };
    },

    /** What a reply says for every tab: a 429 pauses all reads, a 403 on a GET is kept. */
    async heard(url, method, result) {
      const status = result?.status;
      if (status !== 429 && !(status === 403 && method === 'GET')) return;
      const t = now();
      const state = await load();
      if (status === 429) {
        const seconds = Number(result.retryAfter);
        const ms = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, PAUSE_MAX_MS) : WINDOW_MS;
        state.pausedUntil = Math.max(state.pausedUntil, t + ms);
      } else {
        const path = pathOf(url);
        if (!path) return;
        const error = typeof result.data?.error === 'string' && CODE.test(result.data.error) ? result.data.error : null;
        state.refused[path] = { until: t + REFUSED_MS, error };
      }
      await save(state);
    },

    /** How long every read still waits out a 429, in ms; 0 when none. */
    async pausedFor() {
      const state = await load();
      return Math.max(0, state.pausedUntil - now());
    },

    /**
     * Whether this tab reads the sidebar now. One tab a minute does; the others draw the
     * answer it kept (hq #721, CMP-108). Claims the turn when it is free.
     * @param {string} items  the items asked for, as the read names them: other items are
     *   another read
     * @returns {Promise<{mine: true} | {mine: false, waitMs: number}>}
     */
    async sidebarTurn(items) {
      const t = now();
      const state = await load();
      const last = state.sidebar;
      if (last && last.items === items && last.tab !== tab && t - last.at < SIDEBAR_EVERY_MS) {
        return { mine: false, waitMs: SIDEBAR_EVERY_MS - Math.max(0, t - last.at) };
      }
      state.sidebar = { items, tab, at: t };
      await save(state);
      return { mine: true };
    },

    /** A new key or "Forget me": what the old key was told no longer holds. */
    async reset() {
      await save({ pausedUntil: 0, refused: {}, reads: [], sidebar: null });
    },
  };
}
