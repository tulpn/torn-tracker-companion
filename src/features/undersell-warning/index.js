// Undersell warning (CMP-109).
//
// On the Item Market's add-listing form and the bazaar's add and manage pages, a price
// below what a shop in Torn pays for the item gets a warning under the field while the
// player types: "Below the shop price. Big Al's Gun Shop pays $1,250 each, $310 more than
// this (×12: $3,720)." It only says so: nothing is disabled, changed, pressed or
// submitted, and an item no shop buys gets no warning.
//
// The idea is the owner's, from Torn Item Market - Shop Sell Price Highlighter (GPLv3);
// the forms are the price filler's (CMP-105).

import { readMoney, readInt } from '../../core/dom.js';
import { undersellText } from '../../core/shops.js';
import { badge } from '../../core/ui.js';
import { itemIdOf, ownedOf } from '../price-filler/fill.js';
import { FORMS, formFor } from '../price-filler/selectors.js';

const MARK = 'ttc-undersell';
const SETTLE_MS = 250;
/** The companion's own nodes in a form row: the filler's button and this warning. */
const OWN = `.${MARK}, .ttc-fill`;

let state = null;

/** The price typed into a row: the first of its price inputs that holds a whole number. */
export function typedPrice(row, form) {
  for (const input of row.querySelectorAll(FORMS[form].price)) {
    const n = readMoney(input.value);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

/** How many are being listed: the quantity field when it holds one, else how many are owned. */
export function listedQty(row, form) {
  const field = FORMS[form].quantity ? row.querySelector(FORMS[form].quantity) : null;
  const typed = field ? readInt(field.value) : null;
  return Number.isInteger(typed) && typed > 0 ? typed : ownedOf(row, form);
}

export default {
  id: 'undersell-warning',
  wave: 1,
  title: 'Undersell warning',
  area: 'market',
  guide: 'shop-price-guard',
  summary: 'Warns on bazaar and item market sell forms when your price is below what a shop pays.',
  routes: ['bazaar.php#/add', 'bazaar.php#/manage', 'page.php?sid=ItemMarket'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: false },
  credits: ['Torn Item Market - Shop Sell Price Highlighter (GPLv3)'],

  start(ctx) {
    const { doc } = ctx;
    const timers = ctx.win || globalThis;
    const s = { doc, timers, table: null, timer: null, stopWatching: null, onInput: null };
    state = s;
    const alive = () => state === s;

    /** Puts the warning under one row's price, updates it, or takes it away. */
    function check(row, form) {
      const field = row.querySelector(FORMS[form].price);
      if (!field) return;
      const id = itemIdOf(row, form);
      const text = id ? undersellText(typedPrice(row, form), s.table.get(id), listedQty(row, form)) : null;
      const shown = row.querySelector(`.${MARK}`);
      if (!text) {
        shown?.remove();
        return;
      }
      if (shown) {
        if (shown.textContent !== text) shown.textContent = text;
        return;
      }
      const node = badge(doc, { cls: MARK, tone: 'warn', block: true, attrs: { role: 'status', 'data-tour': 'undersell' } }, text);
      const group = field.closest('.input-money-group') || field;
      const filler = group.nextElementSibling?.classList.contains('ttc-fill') ? group.nextElementSibling : null;
      (filler || group).after(node);
    }

    function scan() {
      const form = formFor(ctx.win?.location);
      if (!form || !s.table) return;
      for (const row of doc.querySelectorAll(FORMS[form].rows)) check(row, form);
    }

    // The player typing (or the filler filling, which types the same way).
    s.onInput = (event) => {
      const form = formFor(ctx.win?.location);
      if (!form || !s.table || !event.target?.closest) return;
      const row = event.target.closest(FORMS[form].rows);
      if (row) check(row, form);
    };
    doc.addEventListener('input', s.onInput, true);

    // Rows Torn renders later, and the manage page's prices already filled in.
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (records.every((r) => ctx.dom.ownChange(r, OWN))) return;
      timers.clearTimeout(s.timer);
      s.timer = timers.setTimeout(() => {
        s.timer = null;
        if (alive()) scan();
      }, SETTLE_MS);
    }, doc);

    ctx.site.shops()
      .then((table) => {
        if (!alive()) return;
        s.table = table;
        scan();
      })
      .catch((err) => ctx.log('undersell warning', err));
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    s.doc.removeEventListener('input', s.onInput, true);
    if (s.timer !== null) s.timers.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
