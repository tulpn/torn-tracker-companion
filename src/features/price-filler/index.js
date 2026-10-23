// Price filler (CMP-105).
//
// On the bazaar's add and manage pages and the item market's sell form, each row gets a
// "Fill" button. A press fills that row's price (the site's market value minus the
// player's undercut) and, where the form has one, the quantity the player owns. Torn's
// own button still has to be pressed by the player: the script never submits, never
// presses anything of Torn's, and one press fills one row.
//
// Inspiration: Torn Bazaar Filler (Ramin Quluzade and Silmaril, MIT,
// https://greasyfork.org/scripts/473470) and Torn Market Filler (Silmaril, MIT,
// https://greasyfork.org/scripts/513920), for where the fields are; TornTools (GPLv3)
// for setting a React field. No code was taken. Their "fill all" and their press of
// Torn's mobile Manage button are deliberately not here (CMP-900).

import { el } from '../../core/dom.js';
import { fillRow, itemIdOf, ownedOf, priceFrom } from './fill.js';
import { FORMS, formFor } from './selectors.js';

const MARK = 'ttc-fill';
const SETTLE_MS = 250;

let stopWatching = null;
let timer = null;
let timers = globalThis;
let page = null;
let alive = false;

const money = (n) => `$${n.toLocaleString('en-US')}`;

const feature = {
  id: 'price-filler',
  wave: 1,
  title: 'Price filler',
  area: 'market',
  guide: 'price-filler',
  summary: 'A Fill button on bazaar and item market sell forms: market value minus your undercut.',
  routes: ['bazaar.php#/add', 'bazaar.php#/manage', 'page.php?sid=ItemMarket'],
  defaults: { enabled: true, undercut: 1 },
  options: { undercut: { label: 'Undercut the market value by ($)', min: 0, max: 1_000_000_000 } },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: ['Torn Bazaar Filler (MIT)', 'Torn Market Filler (MIT)', 'TornTools (GPLv3)'],

  start(ctx) {
    alive = true;
    timers = ctx.win || globalThis;
    const { doc } = ctx;
    page = doc;

    const scan = async () => {
      const form = formFor(ctx.win?.location);
      if (!form) return;
      const rows = [...doc.querySelectorAll(FORMS[form].rows)]
        .filter((row) => !row.querySelector(`.${MARK}`) && row.querySelector(FORMS[form].price));
      const items = rows.map((row) => ({ row, id: itemIdOf(row, form) })).filter((r) => r.id);
      if (items.length === 0) return;

      const prices = await ctx.site.prices(items.map((r) => r.id));
      if (!alive) return;
      for (const { row, id } of items) {
        if (!row.isConnected || row.querySelector(`.${MARK}`)) continue;
        const price = priceFrom(prices.get(id), ctx.settings.undercut);
        const button = el('button', {
          type: 'button', class: MARK, ownerDocument: doc, disabled: price === null, 'data-tour': 'price-fill',
          title: price === null ? 'No market value for this item yet' : `Fill the price with ${money(price)}`,
        }, price === null ? 'No price' : `Fill ${money(price)}`);
        button.addEventListener('click', (event) => {
          // The player's own press. It fills this row and stops there.
          event.preventDefault();
          event.stopPropagation();
          fillRow(row, form, { price, quantity: ownedOf(row, form) });
        });
        const field = row.querySelector(FORMS[form].price);
        (field.closest('.input-money-group') || field).after(button);
      }
    };

    const later = () => {
      timers.clearTimeout(timer);
      timer = timers.setTimeout(() => {
        timer = null;
        scan().catch((err) => ctx.log('price filler', err));
      }, SETTLE_MS);
    };
    stopWatching = ctx.dom.onMutation((records) => {
      if (records.every((r) => [...r.addedNodes].every((n) => n.classList?.contains(MARK)))) return;
      later();
    }, doc);
    later();
  },

  stop() {
    alive = false;
    stopWatching?.();
    stopWatching = null;
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
    for (const node of page?.querySelectorAll(`.${MARK}`) || []) node.remove();
    page = null;
  },
};

export default feature;
