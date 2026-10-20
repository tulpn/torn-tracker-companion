// Turns one auction row into an `auction_listing` (CMP-202, CAPI-010 as proposed in hq
// #122). Pure: a row in, the observation's fields or null out. Nothing is guessed: a row
// missing what the site needs is left out.

import { readMoney } from '../../core/dom.js';
import {
  BIDS, BONUS_ICON, CURRENT_BID, ENDS, ITEM, PLATE, PROFILE_LINK, SELLER, STAT, STAT_VALUE, TIMER,
} from './selectors.js';

const positive = (v) => (Number.isInteger(v) && v > 0 ? v : null);

/** "Ends on 14:23:11 - 20/10/26" (Torn time, UTC) -> ISO; anything else -> null. */
export function readEnds(title) {
  const m = /Ends on (\d\d):(\d\d):(\d\d) - (\d\d)\/(\d\d)\/(\d\d)/.exec(String(title || ''));
  if (!m) return null;
  const [h, min, s, d, mo, y] = m.slice(1).map(Number);
  const at = Date.UTC(2000 + y, mo - 1, d, h, min, s);
  const back = new Date(at);
  // 31/02 and the like roll over in Date.UTC; such a title is not a date.
  if (back.getUTCDate() !== d || back.getUTCMonth() !== mo - 1) return null;
  return back.toISOString();
}

/** "7 bids", "1 bid", "No bids" -> the count; anything else -> null. */
export function readBids(text) {
  const t = String(text || '').trim();
  if (/^no bids?$/i.test(t)) return 0;
  const m = /^([\d,]+)\s+bids?$/i.exec(t);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

/** '<b>Quicken</b><br/>61% increased…' -> {name: 'Quicken', value: 61}; else null. */
export function readBonus(title) {
  const m = /^\s*<b>([^<]{1,40})<\/b>(?:<br\s*\/?>)?(.*)$/is.exec(String(title || ''));
  if (!m) return null;
  const value = /(\d+(?:\.\d+)?)/.exec(m[2]);
  return value ? { name: m[1].trim(), value: Number(value[1]) } : null;
}

function stats(row) {
  const out = { damage: null, accuracy: null, armor: null };
  for (const node of row.querySelectorAll(STAT)) {
    const cls = node.querySelector('i')?.className || '';
    const value = Number(node.querySelector(STAT_VALUE)?.textContent.trim());
    if (!Number.isFinite(value)) continue;
    if (cls.includes('damage')) out.damage = value;
    else if (cls.includes('accuracy')) out.accuracy = value;
    else if (cls.includes('defence') || cls.includes('armor')) out.armor = value;
  }
  return out;
}

/**
 * @param {Element} row  one listing
 * @param {number} now   ms, for the end time when the title is missing
 * @returns {object|null} the kind's fields
 */
export function readRow(row, now = Date.now()) {
  const listing_id = positive(Number(row.id));
  const item = row.querySelector(ITEM);
  const item_id = positive(Number(item?.getAttribute('item')));
  const current_bid = readMoney(row.querySelector(CURRENT_BID)?.textContent);
  const bid_count = readBids(row.querySelector(BIDS)?.textContent);
  const timer = positive(Number(row.querySelector(TIMER)?.getAttribute('timer')));
  const ends_at = readEnds(row.querySelector(ENDS)?.getAttribute('title'))
    ?? (timer ? new Date(now + timer * 1000).toISOString() : null);
  if (!listing_id || !item_id || current_bid === null || bid_count === null || !ends_at) return null;

  const sellerCell = row.querySelector(SELLER);
  const sellerLink = sellerCell?.querySelector(PROFILE_LINK);
  const seller = /[?&]XID=(\d+)/.exec(sellerLink?.getAttribute('href') || '');
  // No seller line at all is not the same as an anonymous one: leave the row out.
  if (!sellerCell) return null;

  const rarity = /\bglow-(yellow|orange|red)\b/.exec(row.querySelector(PLATE)?.className || '');
  const bonuses = [...row.querySelectorAll(BONUS_ICON)]
    .map((icon) => readBonus(icon.getAttribute('title')))
    .filter(Boolean)
    .slice(0, 2);

  return {
    listing_id,
    item_id,
    item_uid: positive(Number(item.getAttribute('armoury'))),
    seller_id: seller ? Number(seller[1]) : null,
    current_bid,
    bid_count,
    ends_at,
    bonuses,
    // Quality is only in the listing's info panel, which the script never opens (hq #122).
    quality: null,
    rarity: rarity ? rarity[1] : 'none',
    ...stats(row),
  };
}
