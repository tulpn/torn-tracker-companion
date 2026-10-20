// The war page's sort orders (CMP-102). Pure: rows in, keys and comparisons out.
//
// Everything comes from what the page already shows. Hospital timers and travel
// destinations are not on the page, so there is no "time to leave hospital" order until
// hq #98 settles where they may come from.

import { readInt } from '../../core/dom.js';
import { LEVEL, PROFILE_LINK, STATUS } from './selectors.js';

export const ORDERS = Object.freeze(['torn', 'status', 'level', 'ff']);

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
 * A comparator for rows, or null for Torn's own order. Unknowns go last; ties keep the
 * order the page gave them (Array.prototype.sort is stable).
 * @param {string} order
 * @param {Map<number, {ff: number|null}>} ff
 */
export function comparator(order, ff = new Map()) {
  const last = (v) => (v === null || v === undefined ? Infinity : v);
  switch (order) {
    case 'status':
      return (a, b) => STATUS_RANK[statusOf(a)] - STATUS_RANK[statusOf(b)]
        || last(levelOf(a)) - last(levelOf(b));
    case 'level':
      return (a, b) => last(levelOf(a)) - last(levelOf(b));
    case 'ff':
      return (a, b) => last(ff.get(playerOf(a))?.ff) - last(ff.get(playerOf(b))?.ff);
    default:
      return null;
  }
}
