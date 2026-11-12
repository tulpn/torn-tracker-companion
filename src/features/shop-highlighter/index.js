// Shop price highlighter (CMP-109).
//
// On the Item Market, a listing priced below what a shop in Torn pays for the item gets a
// coloured outline, a dot and its profit ("+12.5k") beside the price, and a tooltip with
// the prices, the margin and the listing's total. The tier (green, yellow, red, blue: the saved keys; drawn green, yellow, blue, grey) is
// the profit per item, or the margin, against the minimums on the settings page. The
// sidebar block counts the listings on screen that qualify. Highlight only: nothing is
// bought, filled or pressed.
//
// From Torn Item Market - Shop Sell Price Highlighter v0.5.1
// (https://github.com/tulpn/torn-item-market-highlighter), Copyright (C) ares313377
// [4372940], contributed by its author under the GNU GPL v3. Its settings moved to the
// companion's settings page and its count to the sidebar block; its decoration (Torn's
// own nodes get attributes, never children) is kept as it was.

import { BUILT_IN, setProfitable } from '../../core/shops.js';
import { ensureStyle } from '../../core/ui.js';
import { TIERS, findPrice, findRow, isChrome, itemIdOfImage, judge, parseQty, short, tierKey, tierOn } from './scan.js';
import { settler } from '../../core/dom.js';

const SETTLE_MS = 150;
const ROW = 'data-ttc-shop';
const HIDE = 'data-ttc-shop-hide';
const DOT = 'data-ttc-shop-dot';
const LABEL = 'data-ttc-shop-label';
/** The listing's total, apart from the label so a narrow screen can leave it out (hq #557 B15). */
const TOTAL = 'data-ttc-shop-total';
/** What the companion's own nodes match: their changes never cause a rescan. */
const OWN = "[class^='ttc-'], [class*=' ttc-'], [id^='ttc-']";

let state = null;

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

// The grey tier is off by default (0): at $1 it marked every listing below the shop price,
// and a $70 profit on a $3,000 item is noise (hq #976).
const ABS = { green: 50_000, yellow: 10_000, red: 1_000, blue: 0 };
const PCT = { green: 100, yellow: 50, red: 20, blue: 0 };
/** The defaults' version: 2 since the grey tier starts off (hq #976). */
const TIERS_VERSION = 2;
// The names the player sees, best first; drawn green, yellow, blue and grey (hq #557 E35).
const NAMES = { green: 'Best (green)', yellow: 'Good (yellow)', red: 'Fair (blue)', blue: 'Small (grey)' };

const tierDefaults = Object.fromEntries(TIERS.flatMap((t) => [[tierKey('abs', t), ABS[t]], [tierKey('pct', t), PCT[t]]]));
// Only the grey tier can be 0, which switches it off.
const OFF = (t) => (t === 'blue' ? ', 0 for off' : '');
const tierOptions = Object.fromEntries(TIERS.flatMap((t) => [
  [tierKey('abs', t), { label: `${NAMES[t]}: profit per item at least ($${OFF(t)})`, min: t === 'blue' ? 0 : 1, max: 1_000_000_000 }],
  [tierKey('pct', t), { label: `${NAMES[t]}: margin at least (%${OFF(t)})`, min: t === 'blue' ? 0 : 1, max: 100_000 }],
]));

/**
 * Saved settings from before version 2 (hq #976): a grey tier still at the old default of 1
 * was never the player's choice, so it takes the new default, off. Every other value the
 * player saved stays as it was.
 */
export function migrate(saved) {
  if (saved.tiersVersion === TIERS_VERSION) return saved;
  const out = { ...saved, tiersVersion: TIERS_VERSION };
  for (const mode of ['abs', 'pct']) {
    if (out[tierKey(mode, 'blue')] === 1) out[tierKey(mode, 'blue')] = 0;
  }
  return out;
}

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
    node.removeAttribute(TOTAL);
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

/** The inline label: "+12.5k" or "+25%". */
export function eachFor({ profit, margin }, settings) {
  return settings.mode === 'pct' ? `+${Math.round(margin)}%` : `+${short(profit)}`;
}

/** The listing's total after the label, " (50k)", when it is wanted; else ''. */
export function totalFor({ profit, qty }, settings) {
  return settings.showTotal && qty > 1 ? ` (${short(profit * qty)})` : '';
}

/** The whole inline label as a wide screen shows it: "+12.5k (50k)". */
export function labelFor(entry, settings) {
  return `${eachFor(entry, settings)}${totalFor(entry, settings)}`;
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
  if (settings.inlineLabel) {
    priceEl.setAttribute(LABEL, eachFor({ profit, margin }, settings));
    const total = totalFor({ profit, qty }, settings);
    if (total) priceEl.setAttribute(TOTAL, total);
  }
  return true;
}

/** Where a scan stopped, for the debug line: the first step that found nothing. */
export function stoppedAt(n) {
  if (!n.images) return 'no item images outside the filters';
  if (!n.rows) return 'no listing row around the images';
  if (!n.prices) return 'no price in the listing rows';
  if (!n.below) return 'no listing below a shop price';
  if (!n.marked) return 'no listing reaches the lowest tier';
  return 'marked';
}

/**
 * The debug line for one scan (hq #826): the table, what the page read found, how many
 * listings are below a shop price and how many got a mark, the mode and its lowest tier.
 */
export function scanLine(n, table, settings) {
  const pct = settings.mode === 'pct';
  const mode = pct ? 'pct' : 'abs';
  const on = TIERS.filter((t) => tierOn(settings, mode, t));
  const lowest = on.length ? settings[tierKey(mode, on[on.length - 1])] : null;
  const min = lowest === null ? 'none on' : pct ? `${lowest}%` : money(lowest);
  return [
    `shop highlighter: ${stoppedAt(n)};`,
    `${table.size} shop prices (${table === BUILT_IN ? 'built-in' : 'site'}),`,
    `${n.images} item images, ${n.rows} listings, ${n.prices} prices,`,
    `${n.unknown} with no shop price, ${n.below} below a shop price, ${n.marked} marked;`,
    `by ${pct ? 'margin' : 'profit'}, lowest tier ${min}`,
  ].join(' ');
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
    tiersVersion: TIERS_VERSION,
  },
  migrate,
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
    const s = { doc, timers, table: null, rev: 0, settle: null, stopWatching: null, told: '' };
    state = s;
    const alive = () => state === s;
    ensureStyle(doc);

    /** With debug on, the scan's numbers, once each time they change (hq #826). */
    function note(text) {
      if (s.told === text) return;
      s.told = text;
      ctx.log(text);
    }

    function scan() {
      if (!s.table) return;
      if (onAddListing(ctx.win?.location)) {
        note('shop highlighter: the add-listing form, nothing is listed here');
        return;
      }
      const n = { images: 0, rows: 0, prices: 0, unknown: 0, below: 0, marked: 0 };
      for (const img of doc.querySelectorAll("img[src*='/images/items/']")) {
        const id = itemIdOfImage(img);
        if (!id || isChrome(img)) continue;
        n.images++;
        const row = findRow(img);
        if (!row) continue;
        n.rows++;
        const found = findPrice(row);
        if (!found?.price) continue;
        n.prices++;
        const entry = s.table.get(id);
        if (!entry) n.unknown++;
        else if (found.price < entry.price) n.below++;
        const qty = parseQty(row.textContent.replace(found.el.textContent, ' '));
        const sig = `${id}:${found.price}:${qty}:${s.rev}`;
        if (row.dataset.ttcShopSig !== sig) {
          row.dataset.ttcShopSig = sig;
          decorate(row, img, id, found, qty, entry, ctx.settings);
        }
        if (row.hasAttribute(ROW)) n.marked++;
      }
      setProfitable(n.marked);
      note(scanLine(n, s.table, ctx.settings));
    }

    const later = () => {
      s.settle ??= settler(() => {
        if (alive()) scan();
      }, SETTLE_MS, { timers });
      s.settle.poke();
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
    s.settle?.cancel();
    for (const row of s.doc.querySelectorAll(`[${ROW}], [${HIDE}], [data-ttc-shop-sig]`)) {
      clearRow(row);
      delete row.dataset.ttcShopSig;
    }
  },
};
