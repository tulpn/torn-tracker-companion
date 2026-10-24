// What a shop in Torn pays for each item (CMP-109), for the shop price highlighter, the
// undersell warning and the price filler's floor.
//
// The table comes from torn-tracker.com's public item catalogue (site.shops(), kept 24
// hours, no script key), and from the table built into each release when the site can't
// be reached. Either way it is the highest `value.shops[].sell_price` from Torn's
// /torn/items, with that shop's name and country. No Torn API call is made at runtime.

import { SHOP_SELL, SHOPS_DATE } from '../data/shops.js';

/** At most this many rows are taken from the site; Torn has under 1,600 items. */
export const MAX_SHOP_ROWS = 5_000;
const MAX_PRICE = 1e12;

const positiveInt = (v) => Number.isInteger(v) && v > 0;
const name = (v) => (typeof v === 'string' && v.trim() && v.length <= 40 ? v.trim() : null);

/** One row as stored: [id, price, shop|null, country|null]. */
export function validShopRow(row) {
  return Array.isArray(row) && row.length === 4 && positiveInt(row[0])
    && positiveInt(row[1]) && row[1] <= MAX_PRICE
    && (row[2] === null || name(row[2]) === row[2])
    && (row[3] === null || name(row[3]) === row[3]);
}

/** The rows kept in the cache: a non-empty list of valid rows. */
export function validShopRows(v) {
  return Array.isArray(v) && v.length > 0 && v.length <= MAX_SHOP_ROWS && v.every(validShopRow);
}

/**
 * The site's reply, checked field by field: `{items: [{item_id, sell_price, shop,
 * country}]}`. A row that doesn't fit is left out; a reply with no row that fits is no
 * answer (null).
 */
export function readShopReply(data) {
  if (!Array.isArray(data?.items)) return null;
  const rows = [];
  const seen = new Set();
  for (const item of data.items.slice(0, MAX_SHOP_ROWS)) {
    const row = [item?.item_id, item?.sell_price, name(item?.shop), name(item?.country)];
    if (!validShopRow(row) || seen.has(row[0])) continue;
    seen.add(row[0]);
    rows.push(row);
  }
  return rows.length ? rows : null;
}

/**
 * @typedef {object} ShopPrice
 * @property {number} price        what the shop pays for one
 * @property {string|null} shop    its name, when known
 * @property {string|null} country where it is, when known
 */

/** @returns {Map<number, ShopPrice>} */
export function tableOf(rows) {
  return new Map(rows.map(([id, price, shop, country]) => [id, { price, shop, country }]));
}

/** The table built into this release: the fallback when the site can't be reached. */
export const BUILT_IN = tableOf(SHOP_SELL);
export const BUILT_IN_DATE = SHOPS_DATE;

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

/** "Big Al's Gun Shop", "the Pawn Shop in Mexico", or "A shop" when the name is unknown. */
export function shopName(entry, { capital = true } = {}) {
  if (!entry?.shop) return capital ? 'A shop' : 'a shop';
  return entry.country && entry.country !== 'Torn' ? `${entry.shop} in ${entry.country}` : entry.shop;
}

/**
 * The undersell warning's words, or null when the price is not below what the shop pays.
 * "Below the shop price. Big Al's Gun Shop pays $1,250 each, $310 more than this
 * (×12: $3,720)."
 * @param {number} price     the player's price for one
 * @param {ShopPrice|undefined} entry
 * @param {number|null} [qty]
 */
export function undersellText(price, entry, qty = null) {
  if (!entry || !positiveInt(price) || price >= entry.price) return null;
  const more = entry.price - price;
  const total = positiveInt(qty) && qty > 1 ? ` (×${qty.toLocaleString('en-US')}: ${money(more * qty)})` : '';
  return `Below the shop price. ${shopName(entry)} pays ${money(entry.price)} each, ${money(more)} more than this${total}.`;
}

// ---------------------------------------------------------------- profitable count
// The highlighter counts the Item Market listings on screen that sell below a shop's
// price; the sidebar block shows the number (CMP-108). Nothing leaves this page.

let profitable = 0;
const listeners = new Set();

export function setProfitable(n) {
  const next = Number.isInteger(n) && n > 0 ? n : 0;
  if (next === profitable) return;
  profitable = next;
  for (const fn of listeners) {
    try {
      fn(profitable);
    } catch {
      // a listener's fault is its own
    }
  }
}

export const profitableCount = () => profitable;

/** @returns {() => void} unsubscribe */
export function onProfitable(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
