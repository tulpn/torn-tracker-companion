// Price filler (CMP-105).
//
// On the bazaar's add and manage pages and the item market's sell form, each row gets a
// small inline "Fill" button with a short amount (hq #521). A press fills that row's price (the site's market value minus the
// player's undercut) and, where the form has one, the quantity the player owns. It never
// fills below what a shop in Torn pays for the item, and says so when it stopped there
// (CMP-109). Torn's own button still has to be pressed by the player: the script never
// submits, never presses anything of Torn's, and one press fills one row.
//
// Inspiration: Torn Bazaar Filler (Ramin Quluzade and Silmaril, MIT,
// https://greasyfork.org/scripts/473470) and Torn Market Filler (Silmaril, MIT,
// https://greasyfork.org/scripts/513920), for where the fields are; TornTools (GPLv3)
// for setting a React field. No code was taken. Their "fill all" and their press of
// Torn's mobile Manage button are deliberately not here (CMP-900).

import { compact } from '../../core/chart.js';
import { settler } from '../../core/dom.js';
import { shopName } from '../../core/shops.js';
import { button as uiButton } from '../../core/ui.js';
import { fillRow, itemIdOf, ownedOf, priceFrom } from './fill.js';
import { FORMS, formFor } from './selectors.js';

const MARK = 'ttc-fill';
const SETTLE_MS = 250;

let stopWatching = null;
let settle = null;
let timers = globalThis;
let page = null;
let alive = false;

const money = (n) => `$${n.toLocaleString('en-US')}`;
/** The button's short amount (hq #521): $1.2m, $800k, $49. The full one is in its title. */
export const shortMoney = (n) => `$${compact(n)}`;

/**
 * Never fills below what a shop in Torn pays (CMP-109): the market price, or the shop's
 * when that is higher, with the shop that set it.
 */
export function floored(price, shop) {
  if (price === null || !shop || shop.price <= price) return { price, shop: null };
  return { price: shop.price, shop };
}

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

      const [prices, shops] = await Promise.all([ctx.site.prices(items.map((r) => r.id)), ctx.site.shops()]);
      if (!alive) return;
      for (const { row, id } of items) {
        if (!row.isConnected || row.querySelector(`.${MARK}`)) continue;
        const { price, shop } = floored(priceFrom(prices.get(id), ctx.settings.undercut), shops.get(id));
        const title = price === null ? 'No market value for this item yet'
          : shop ? `Stopped at the shop price: ${shopName(shop)} pays ${money(price)} each, more than the market value less your undercut`
            : `Fill the price with ${money(price)}`;
        const button = uiButton(doc, {
          cls: MARK, inline: true,
          attrs: { disabled: price === null, 'data-tour': 'price-fill', title, 'aria-label': title },
        }, price === null ? 'No price' : `Fill ${shortMoney(price)}${shop ? ' (shop)' : ''}`);
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
      settle ??= settler(() => {
        scan().catch((err) => ctx.log('price filler', err));
      }, SETTLE_MS, { timers });
      settle.poke();
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
    settle?.cancel();
    settle = null;
    for (const node of page?.querySelectorAll(`.${MARK}`) || []) node.remove();
    page = null;
  },
};

export default feature;
