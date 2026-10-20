// Reads the other trader's offer and prices it (CMP-201). Pure: a side of the page, a
// name table and prices in; lines and totals out. Nothing is guessed: an item the table
// does not know, or the site has no price for, is listed as unpriced.

import { readMoney } from '../../core/dom.js';
import { ITEMS, MONEY } from './selectors.js';

const MAX_QUANTITY = 1_000_000;

/** 'Xanax x3' -> {name: 'Xanax', quantity: 3}; 'Xanax' -> quantity 1; junk -> null. */
export function readItem(text) {
  const m = /^\s*(.+?)(?:\s+x([\d,]+))?\s*$/.exec(String(text ?? ''));
  if (!m) return null;
  const quantity = m[2] === undefined ? 1 : Number(m[2].replace(/,/g, ''));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return null;
  if (/^No (items|money) in trade$/i.test(m[1])) return null;
  return { name: m[1], quantity };
}

/** The money line, '$1,000,000' among other words; null when there is none. */
export function readCash(text) {
  const m = /\$[\d,]+/.exec(String(text ?? ''));
  return m ? readMoney(m[0]) : null;
}

/**
 * @param {Element} side  the other trader's side
 * @param {Map<string, number>} ids  item name -> id
 * @returns {{cash: number, items: Array<{name: string, quantity: number, id: number|null}>}}
 */
export function readSide(side, ids) {
  let cash = 0;
  for (const node of side.querySelectorAll(MONEY)) cash += readCash(node.textContent) ?? 0;
  const items = [];
  for (const node of side.querySelectorAll(ITEMS)) {
    const item = readItem(node.textContent);
    if (item) items.push({ ...item, id: ids.get(item.name) ?? null });
  }
  return { cash, items };
}

/**
 * @param {{cash: number, items: Array<{name: string, quantity: number, id: number|null}>}} offer
 * @param {Map<number, number>} prices  item id -> market value
 */
export function priceOffer(offer, prices) {
  let total = offer.cash;
  const lines = offer.items.map((item) => {
    const each = item.id === null ? undefined : prices.get(item.id);
    const value = each === undefined ? null : each * item.quantity;
    if (value !== null) total += value;
    return { ...item, each: each ?? null, value };
  });
  return { cash: offer.cash, lines, total, unpriced: lines.filter((l) => l.value === null).length };
}

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

/** The text the Copy button puts on the clipboard. */
export function receipt(priced, trader) {
  const out = [`Trade${trader ? ` with ${trader}` : ''}, at torn-tracker.com market value`];
  for (const line of priced.lines) {
    out.push(line.value === null
      ? `${line.quantity} x ${line.name}: no price`
      : `${line.quantity} x ${line.name} @ ${money(line.each)} = ${money(line.value)}`);
  }
  if (priced.cash > 0) out.push(`Money: ${money(priced.cash)}`);
  out.push(`Total: ${money(priced.total)}${priced.unpriced ? ` (${priced.unpriced} without a price)` : ''}`);
  return out.join('\n');
}

export { money };
