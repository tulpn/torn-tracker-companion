// Shop price highlighter (CMP-109).
//
// On the Item Market, a listing priced below what a shop in Torn pays for the item gets a
// coloured outline, a dot and its profit ("+12.5k") beside the price, and a tooltip with
// the prices, the margin and the listing's total. The tier (green, yellow, red, blue) is
// the profit per item, or the margin, against the minimums on the settings page. The
// sidebar block counts the listings on screen that qualify. Highlight only: nothing is
// bought, filled or pressed.
//
// From Torn Item Market - Shop Sell Price Highlighter v0.5.1
// (https://github.com/tulpn/torn-item-market-highlighter), Copyright (C) ares313377
// [4372940], contributed by its author under the GNU GPL v3. Its settings moved to the
// companion's settings page and its count to the sidebar block; its decoration (Torn's
// own nodes get attributes, never children) is kept as it was.

import { setProfitable } from '../../core/shops.js';
import { ensureStyle } from '../../core/ui.js';
import { TIERS, findPrice, findRow, isChrome, itemIdOfImage, judge, parseQty, short, tierKey } from './scan.js';

const SETTLE_MS = 150;
const ROW = 'data-ttc-shop';
const HIDE = 'data-ttc-shop-hide';
const DOT = 'data-ttc-shop-dot';
const LABEL = 'data-ttc-shop-label';
/** What the companion's own nodes match: their changes never cause a rescan. */
const OWN = "[class^='ttc-'], [class*=' ttc-'], [id^='ttc-']";

let state = null;

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

const ABS = { green: 50_000, yellow: 10_000, red: 1_000, blue: 1 };
const PCT = { green: 100, yellow: 50, red: 20, blue: 1 };
const NAMES = { green: 'Green', yellow: 'Yellow', red: 'Red', blue: 'Blue' };

const tierDefaults = Object.fromEntries(TIERS.flatMap((t) => [[tierKey('abs', t), ABS[t]], [tierKey('pct', t), PCT[t]]]));
const tierOptions = Object.fromEntries(TIERS.flatMap((t) => [
  [tierKey('abs', t), { label: `${NAMES[t]}: profit per item at least ($)`, min: 1, max: 1_000_000_000 }],
  [tierKey('pct', t), { label: `${NAMES[t]}: margin at least (%)`, min: 1, max: 100_000 }],
]));

/** Whether the location is the Item Market's own add-listing form, where nothing is listed. */
function onAddListing(loc) {
  return String(loc?.hash || '').toLowerCase().startsWith('#/addlisting');
}

/** Takes everything this feature put on a row away again. */
function clearRow(row) {
  row.removeAttribute(ROW);
  row.removeAttribute(HIDE);
  for (const node of [row, ...row.querySelectorAll(`[${DOT}]`)]) {
    if (!node.hasAttribute(DOT)) continue;
    node.removeAttribute(DOT);
    node.removeAttribute(LABEL);
    node.removeAttribute('title');
  }
}

/** The tooltip: what is listed, what the shop pays, the profit and the listing's total. */
export function tooltipFor({ name, price, entry, profit, margin, qty }) {
  const lines = [
    name,
    `Listed at ${money(price)} · ${entry.shop || 'A shop'} pays ${money(entry.price)}`,
    `Profit ${money(profit)} each (${margin.toFixed(1)}%)`,
  ];
  if (qty > 1) lines.push(`${qty.toLocaleString('en-US')} listed: ${money(profit * qty)} in all`);
  return lines.join('\n');
}

/** The inline label: "+12.5k" or "+25%", with the listing's total when it is wanted. */
export function labelFor({ profit, margin, qty }, settings) {
  const each = settings.mode === 'pct' ? `+${Math.round(margin)}%` : `+${short(profit)}`;
  return settings.showTotal && qty > 1 ? `${each} (${short(profit * qty)})` : each;
}

/** Judges one listing row and marks it; returns whether it is below the shop's price. */
function decorate(row, img, id, { price, el: priceEl }, qty, entry, settings) {
  clearRow(row);
  const { profit, margin, tier } = entry ? judge(price, entry.price, settings) : { tier: null };
  if (!tier) {
    if (settings.hideUnprofitable) row.setAttribute(HIDE, '');
    return false;
  }
  row.setAttribute(ROW, tier);
  priceEl.setAttribute(DOT, tier);
  const name = img.getAttribute('alt') || `Item ${id}`;
  priceEl.setAttribute('title', tooltipFor({ name, price, entry, profit, margin, qty: settings.showTotal ? qty : 1 }));
  if (settings.inlineLabel) priceEl.setAttribute(LABEL, labelFor({ profit, margin, qty }, settings));
  return true;
}

export default {
  id: 'shop-highlighter',
  wave: 1,
  title: 'Shop price highlighter',
  area: 'market',
  guide: 'shop-price-guard',
  summary: 'Item Market listings below what a shop pays get a coloured outline and their profit.',
  routes: ['page.php?sid=ItemMarket'],
  defaults: {
    enabled: true, mode: 'abs', ...tierDefaults, inlineLabel: true, showTotal: true, hideUnprofitable: false,
  },
  options: {
    mode: { label: 'Colour listings by', choices: ['abs', 'pct'], labels: { abs: 'Profit per item ($)', pct: 'Margin (%)' } },
    ...tierOptions,
    inlineLabel: { label: 'Show the profit beside the price' },
    showTotal: { label: "Add the listing's total (profit × quantity)" },
    hideUnprofitable: { label: 'Hide listings that are not below a shop price' },
  },
  shares: [],
  needs: { apiKey: false, scriptKey: false },
  credits: ['Torn Item Market - Shop Sell Price Highlighter (GPLv3)'],

  start(ctx) {
    const { doc } = ctx;
    const timers = ctx.win || globalThis;
    const s = { doc, timers, table: null, rev: 0, timer: null, stopWatching: null };
    state = s;
    const alive = () => state === s;
    ensureStyle(doc);

    function scan() {
      if (!s.table || onAddListing(ctx.win?.location)) return;
      let count = 0;
      for (const img of doc.querySelectorAll("img[src*='/images/items/']")) {
        const id = itemIdOfImage(img);
        if (!id || isChrome(img)) continue;
        const row = findRow(img);
        if (!row) continue;
        const found = findPrice(row);
        if (!found?.price) continue;
        const qty = parseQty(row.textContent.replace(found.el.textContent, ' '));
        const sig = `${id}:${found.price}:${qty}:${s.rev}`;
        if (row.dataset.ttcShopSig !== sig) {
          row.dataset.ttcShopSig = sig;
          decorate(row, img, id, found, qty, s.table.get(id), ctx.settings);
        }
        if (row.hasAttribute(ROW)) count++;
      }
      setProfitable(count);
    }

    const later = () => {
      timers.clearTimeout(s.timer);
      s.timer = timers.setTimeout(() => {
        s.timer = null;
        if (alive()) scan();
      }, SETTLE_MS);
    };

    // Our marks are attributes, which the shared observer doesn't watch, so they never
    // wake it; Torn re-rendering a list, or a price changing, does.
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (!records.every((r) => ctx.dom.ownChange(r, OWN))) later();
    }, doc);

    ctx.site.shops()
      .then((table) => {
        if (!alive()) return;
        s.table = table;
        s.rev++;
        scan();
      })
      .catch((err) => ctx.log('shop highlighter', err));
  },

  stop() {
    const s = state;
    state = null;
    setProfitable(0);
    if (!s) return;
    s.stopWatching?.();
    if (s.timer !== null) s.timers.clearTimeout(s.timer);
    for (const row of s.doc.querySelectorAll(`[${ROW}], [${HIDE}], [data-ttc-shop-sig]`)) {
      clearRow(row);
      delete row.dataset.ttcShopSig;
    }
  },
};
