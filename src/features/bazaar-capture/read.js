// Turns the bazaar's own responses into one `bazaar_listing` (CMP-203, CAPI-010). Pure.
//
// The page loads the listings in chunks as the player scrolls; each response carries its
// `start`, a `list` and the bazaar's `total`. The list is complete once every chunk from 0
// to total has been seen.

import { OWNER_PARAM, OWN_ID_COOKIE } from './selectors.js';

/** CAPI-010: at most 200 listings in one observation. */
export const MAX_ITEMS = 200;

const whole = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const positive = (v) => (Number.isInteger(v) && v > 0 ? v : null);

/** The bazaar's owner from the page address, or null on your own pages. */
export function ownerFrom(search) {
  return positive(Number(new URLSearchParams(String(search || '')).get(OWNER_PARAM)));
}

/** The logged-in player's id from the page's cookie, or null. */
export function ownIdFrom(cookie) {
  for (const part of String(cookie || '').split(';')) {
    const [name, value] = part.trim().split('=');
    if (name === OWN_ID_COOKIE) return positive(Number(value));
  }
  return null;
}

/**
 * One response's chunk. Null when it does not look like the bazaar's listings.
 * @returns {{start: number, total: number, items: Array<{item_id: number, item_uid?: number, quantity: number, price: number}>}|null}
 */
export function readChunk(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.list)) return null;
  const start = whole(data.start) ?? 0;
  const total = whole(data.total);
  if (total === null) return null;
  const items = [];
  for (const entry of data.list) {
    const item_id = positive(entry?.itemID);
    const quantity = positive(entry?.amount);
    const price = whole(entry?.price);
    if (!item_id || !quantity || price === null) continue;
    const uid = positive(entry?.armoryID);
    items.push(uid ? { item_id, item_uid: uid, quantity, price } : { item_id, quantity, price });
  }
  return { start, total, items, count: data.list.length };
}

/** Collects chunks by their start; reports what has been seen and whether it is all. */
export function createListing() {
  const chunks = new Map();
  let total = null;
  return {
    add(chunk) {
      chunks.set(chunk.start, chunk);
      total = chunk.total;
    },
    get size() {
      return chunks.size;
    },
    /** @returns {{items: object[], complete: boolean}} */
    result() {
      const ordered = [...chunks.values()].sort((a, b) => a.start - b.start);
      const items = ordered.flatMap((c) => c.items);
      const seen = ordered.reduce((n, c) => n + c.count, 0);
      // Every row the page listed was read, and none was cut off by the 200 limit.
      const complete = total !== null && seen >= total && items.length === seen && items.length <= MAX_ITEMS;
      return { items: items.slice(0, MAX_ITEMS), complete };
    },
  };
}
