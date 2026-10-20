// Best buy on the foreign shop (TRV-052, CMP-104's display half).
//
// On the shop the player sees after landing abroad, the item that makes the most money
// for what they can still carry and afford gets a label with the amount to buy and the
// profit, from torn-tracker.com's market values (CAPI-035, one lookup per shop view,
// cached for ten minutes). Highlight only: nothing is filled, bought or clicked; the
// player presses Buy.
//
// The shelves come from the page's own response, or from the page when the response was
// missed (the same readers as the foreign stock capture). Money and capacity come from
// the message above the shelves ("purchased 5 / 29").
//
// Inspiration: TornTools (GPLv3, https://github.com/Mephiles/torntools_extension), whose
// travel fill max and item profits read the same message and rows. No code was taken.

import { el } from '../../core/dom.js';
import { fromPage, fromResponse, itemIdOf } from '../foreign-stock/read.js';
import { INFO_CAPACITY, INFO_MONEY, ITEM_IMAGE, ITEM_NAME, ROWS, isShopResponse } from '../foreign-stock/selectors.js';
import { bestBuy, readCapacity, readMoney } from './best.js';

const MARK = 'ttc-best';
const STYLE_ID = 'ttc-best-style';
const STYLE = `
  [class*='row___']:has(.${MARK}) { outline: 2px solid #4a6; outline-offset: -2px; }
  .${MARK} {
    display: inline-block; margin-left: 6px; padding: 1px 5px; border-radius: 3px;
    background: #4a6; color: #000; font: 700 11px/16px sans-serif;
  }
`;
const SETTLE_MS = 250;

let state = null;

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

/** What the player can still carry and how much cash they have, from the page. */
export function playerFrom(doc, responseMoney = null) {
  const carried = readCapacity(doc.querySelector(INFO_CAPACITY)?.textContent);
  const shown = readMoney(doc.querySelector(INFO_MONEY)?.textContent);
  const cash = shown ?? (Number.isInteger(responseMoney) && responseMoney >= 0 ? responseMoney : null);
  return { room: carried ? carried.capacity - carried.bought : null, money: cash };
}

/** The label's text: "Best buy: 19 (+$1,234 each, +$23,446)". */
export function labelFor(pick, { room }) {
  const amount = room === null ? `up to ${pick.amount}` : String(pick.amount);
  return `Best buy: ${amount} (+${money(pick.each)} each, +${money(pick.total)})`;
}

export default {
  id: 'best-buy',
  wave: 1,
  title: 'Best buy abroad',
  routes: ['page.php?sid=travel', 'index.php'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)'],
  /** How long to wait for the response before reading the shelves off the page. */
  fallbackMs: 3_000,

  start(ctx) {
    const { doc } = ctx;
    const timers = ctx.win || globalThis;
    const s = {
      doc, timers, items: null, responseMoney: null, market: new Map(), pick: null,
      unsubscribe: null, stopWatching: null, fallback: null, scanTimer: null,
    };
    state = s;
    const alive = () => state === s;

    if (!doc.getElementById(STYLE_ID)) {
      const style = el('style', { id: STYLE_ID, ownerDocument: doc });
      style.textContent = STYLE;
      doc.head.append(style);
    }

    /** Puts the label on the best item's row, once, and takes it off any other. */
    function paint() {
      const player = playerFrom(doc, s.responseMoney);
      s.pick = s.items ? bestBuy(s.items, s.market, player) : null;
      for (const row of doc.querySelectorAll(ROWS)) {
        const id = itemIdOf(row.querySelector(ITEM_IMAGE));
        const label = row.querySelector(`.${MARK}`);
        if (!s.pick || id !== s.pick.item_id) {
          label?.remove();
          continue;
        }
        const text = labelFor(s.pick, player);
        if (label) {
          if (label.textContent !== text) label.textContent = text;
          continue;
        }
        const node = el('span', { class: MARK, title: "torn-tracker.com market value minus this shop's price", ownerDocument: doc }, text);
        (row.querySelector(ITEM_NAME) || row).append(node);
      }
    }

    async function shelves(items, responseMoney = null) {
      if (!items || items.length === 0) return;
      s.items = items;
      if (responseMoney !== null) s.responseMoney = responseMoney;
      if (!ctx.site) return;
      const found = await ctx.site.prices(items.map((item) => item.item_id));
      if (!alive()) return;
      s.market = found;
      paint();
    }

    s.unsubscribe = ctx.intercept.onJson(isShopResponse, ({ data }) => {
      const read = fromResponse(data);
      if (read) shelves(read.items, data.money ?? null).catch((err) => ctx.log('best buy', err));
    }, ctx.win);

    // A shop the page rendered before we were listening still counts.
    s.fallback = timers.setTimeout(async () => {
      s.fallback = null;
      if (s.items) return;
      if (!(await ctx.dom.waitFor(ROWS, { root: doc, timeout: this.fallbackMs }))) return;
      if (alive() && !s.items) shelves(fromPage(doc)).catch((err) => ctx.log('best buy', err));
    }, this.fallbackMs);

    // Torn re-renders the rows, and the message changes after each purchase.
    const ours = (r) => [r.target, ...r.addedNodes, ...r.removedNodes]
      .every((n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(`.${MARK}`));
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (!s.items || records.every(ours)) return;
      timers.clearTimeout(s.scanTimer);
      s.scanTimer = timers.setTimeout(() => {
        s.scanTimer = null;
        if (alive()) paint();
      }, SETTLE_MS);
    }, doc);
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.unsubscribe?.();
    s.stopWatching?.();
    s.timers.clearTimeout(s.fallback);
    s.timers.clearTimeout(s.scanTimer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
