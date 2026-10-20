// The best buy on a foreign shop's shelves (TRV-052). Pure: shelves, prices and what the
// player can carry and afford in; one pick out.

import { readInt, readMoney } from '../../core/dom.js';

/** '5 / 29' -> {bought: 5, capacity: 29}; anything else -> null. */
export function readCapacity(text) {
  const m = /^\s*([\d,]+)\s*\/\s*([\d,]+)\s*$/.exec(String(text ?? ''));
  if (!m) return null;
  const bought = readInt(m[1]);
  const capacity = readInt(m[2]);
  return bought !== null && capacity !== null && bought <= capacity ? { bought, capacity } : null;
}

export { readMoney };

/**
 * The item that makes the most money for what the player can still carry and afford.
 * Unknown capacity or money does not limit the amount; the label says "up to" then.
 *
 * @param {Array<{item_id: number, quantity: number, price: number}>} items
 * @param {Map<number, number>} market  torn-tracker.com's market value per item
 * @param {{room: number|null, money: number|null}} player  items still carryable, cash
 * @returns {{item_id: number, amount: number, each: number, total: number}|null}
 *          null when nothing on the shelves makes a profit the player can take
 */
export function bestBuy(items, market, { room = null, money = null } = {}) {
  if (room === 0) return null;
  let best = null;
  for (const { item_id, quantity, price } of items) {
    const value = market.get(item_id);
    if (value === undefined || price <= 0) continue;
    const each = value - price;
    if (each <= 0) continue;
    let amount = quantity;
    if (room !== null) amount = Math.min(amount, room);
    if (money !== null) amount = Math.min(amount, Math.floor(money / price));
    if (amount <= 0) continue;
    const total = each * amount;
    if (!best || total > best.total) best = { item_id, amount, each, total };
  }
  return best;
}
