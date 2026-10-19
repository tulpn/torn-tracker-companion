// Reads a foreign shop's shelves from the page's own response, or from the page itself
// when the response was missed (CMP-104, TRV-051). Pure functions: in, the response or a
// document; out, rows or null. Nothing is guessed; a row that cannot be read is left out.

import { COUNTRIES } from '../../core/kinds.js';
import { readInt, readMoney } from '../../core/dom.js';
import { BODY_ABROAD, BODY_COUNTRY, BODY_TRAVELING, ITEM_IMAGE, PRICE, ROWS } from './selectors.js';

/** Torn's names and slugs for the countries the site's closed list spells differently. */
const ALIASES = {
  'cayman-islands': 'cayman',
  'united-kingdom': 'uk',
  'great-britain': 'uk',
  'united-arab-emirates': 'uae',
};

/** 'South Africa', 'south-africa', 'united_kingdom' -> the site's key, or null. */
export function countryKey(value) {
  if (typeof value !== 'string') return null;
  const slug = value.trim().toLowerCase().replace(/[\s_]+/g, '-');
  const key = ALIASES[slug] ?? slug;
  return COUNTRIES.includes(key) ? key : null;
}

const whole = (value) => (Number.isInteger(value) && value >= 0 ? value : null);

/**
 * @param {unknown} data  the JSON of `page.php?sid=travelData&step=shop`
 * @returns {{country: string|null, items: Array<{item_id: number, quantity: number, price: number}>} | null}
 */
export function fromResponse(data) {
  if (!data || typeof data !== 'object') return null;
  // Two shapes are in use: shelves grouped by shop, and one flat list.
  const lists = Array.isArray(data.shops)
    ? data.shops.map((shop) => shop?.stock)
    : [data.stock];
  if (!lists.every(Array.isArray)) return null;

  const items = [];
  for (const entry of lists.flat()) {
    const item_id = whole(entry?.ID);
    const quantity = whole(entry?.stock);
    const price = whole(entry?.price);
    if (item_id && quantity !== null && price !== null) items.push({ item_id, quantity, price });
  }
  return { country: countryKey(data.country), items };
}

/** The player is abroad and on the ground, as far as the page says. Unknown counts as yes. */
export function onTheGround(doc) {
  const data = doc.body?.dataset || {};
  if (data[BODY_TRAVELING] === 'true') return false;
  return data[BODY_ABROAD] === undefined || data[BODY_ABROAD] === 'true';
}

export function countryFromBody(doc) {
  return countryKey(doc.body?.dataset?.[BODY_COUNTRY]);
}

function itemIdOf(img) {
  const source = `${img?.getAttribute('srcset') || ''} ${img?.getAttribute('src') || ''}`;
  const m = /\/items\/(\d+)\//.exec(source);
  return m ? Number(m[1]) : null;
}

/** The stock cell reads "Stock 45" (the label is hidden on wide screens). */
function stockOf(row) {
  for (const cell of row.children) {
    const m = /^\s*stock\s*:?\s*([\d,]+)\s*$/i.exec(cell.textContent || '');
    if (m) return readInt(m[1]);
  }
  return null;
}

/** @returns {Array<{item_id: number, quantity: number, price: number}>} */
export function fromPage(doc) {
  const items = [];
  for (const row of doc.querySelectorAll(ROWS)) {
    const item_id = itemIdOf(row.querySelector(ITEM_IMAGE));
    const price = readMoney(row.querySelector(PRICE)?.textContent);
    const quantity = stockOf(row);
    if (item_id && price !== null && quantity !== null) items.push({ item_id, quantity, price });
  }
  return items;
}
