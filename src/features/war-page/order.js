// The war page's sort orders (CMP-102). Pure: rows in, keys and comparisons out.
//
// Status, level and the hit order come from what the page shows. "Out soonest" needs the
// time each opponent leaves hospital or jail, which the page does not show; it comes from
// the site's roster (CAPI-034, the hq #98 fallback), keyed by player id.

import { readInt } from '../../core/dom.js';
import { LEVEL, PROFILE_LINK, STATUS } from './selectors.js';

export const ORDERS = Object.freeze(['torn', 'status', 'leave', 'level', 'ff']);

/** Hittable first, then those who will be soon. */
const STATUS_RANK = { okay: 0, hospital: 1, traveling: 2, abroad: 3, jail: 4, other: 5 };

/** 'okay', 'hospital', 'traveling', 'abroad', 'jail' or 'other'. */
export function statusOf(row) {
  const cell = row.querySelector(STATUS);
  if (!cell) return 'other';
  for (const state of ['hospital', 'jail', 'traveling', 'abroad']) {
    if (cell.classList.contains(state)) return state;
  }
  return cell.textContent.trim() === 'Okay' ? 'okay' : 'other';
}

export function playerOf(row) {
  const m = /[?&]XID=(\d+)/.exec(row.querySelector(PROFILE_LINK)?.getAttribute('href') || '');
  return m ? Number(m[1]) : null;
}

export function levelOf(row) {
  return readInt(row.querySelector(LEVEL)?.textContent.replace(/^\D*/, '') ?? '');
}

/**
 * How soon a row can be hit: 0 for okay, the ms until they leave hospital or jail, then
 * everyone travelling, then the rest. The roster wins over the page when it has the row.
 */
export function leaveKey(row, roster = new Map(), now = Date.now()) {
  const status = roster.get(playerOf(row));
  const state = status ? status.state.toLowerCase() : statusOf(row);
  if (state === 'okay') return 0;
  if ((state === 'hospital' || state === 'jail') && status?.until) return Math.max(1, status.until - now);
  if (state === 'hospital' || state === 'jail') return 1e12;
  if (state === 'traveling' || state === 'abroad') return 1e13;
  return 1e14;
}

/**
 * A comparator for rows, or null for Torn's own order. Unknowns go last; ties keep the
 * order the page gave them (Array.prototype.sort is stable).
 * @param {string} order
 * @param {Map<number, {ff: number|null}>} ff
 * @param {Map<number, {state: string, until: number|null}>} roster
 * @param {number} now
 */
export function comparator(order, ff = new Map(), roster = new Map(), now = Date.now()) {
  const last = (v) => (v === null || v === undefined ? Infinity : v);
  switch (order) {
    case 'status':
      return (a, b) => STATUS_RANK[statusOf(a)] - STATUS_RANK[statusOf(b)]
        || last(levelOf(a)) - last(levelOf(b));
    case 'leave':
      return (a, b) => leaveKey(a, roster, now) - leaveKey(b, roster, now);
    case 'level':
      return (a, b) => last(levelOf(a)) - last(levelOf(b));
    case 'ff':
      return (a, b) => last(ff.get(playerOf(a))?.ff) - last(ff.get(playerOf(b))?.ff);
    default:
      return null;
  }
}
