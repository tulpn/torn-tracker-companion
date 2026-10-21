// Value badges on the auction house (AUC-020, read accepted in hq #199).
//
// Beside each listing the auction house shows, a badge gives torn-tracker.com's value
// estimate: "about $27.4m, 12 sales" from comparable completed sales (or the item
// market, for plain items), "not enough sales" below five, and a "deal" tag when the
// current bid is well under the estimate. It only shows: the script never bids.
//
// Sharing the listings themselves is a separate kind (auction-capture), off until the
// player switches it on; seeing the badges never needs it.

import { el } from '../../core/dom.js';
import { ROW } from '../auction-capture/selectors.js';

const MARK = 'ttc-auc';
const SETTLE_MS = 600;

let state = null;

/** $27.4m, $950k, $1.2b, $800. */
export function short(n) {
  const units = [[1e9, 'b'], [1e6, 'm'], [1e3, 'k']];
  for (const [size, unit] of units) {
    if (n >= size) return `$${(n / size).toFixed(n >= size * 100 ? 0 : 1).replace(/\.0$/, '')}${unit}`;
  }
  return `$${n}`;
}

/** The badge's text and tooltip for one estimate. */
export function badgeFor(value) {
  if (value.estimate === null) {
    return { text: 'not enough sales', title: `Only ${value.sales} comparable sale${value.sales === 1 ? '' : 's'} so far (torn-tracker.com)` };
  }
  const basis = value.basis === 'market' ? 'the item market' : `${value.sales} comparable sale${value.sales === 1 ? '' : 's'}`;
  return {
    text: `about ${short(value.estimate)}${value.basis === 'auctions' ? `, ${value.sales} sales` : ''}`,
    title: `Value estimate from ${basis} (torn-tracker.com)${value.deal ? '. A deal: the bid is well under it.' : ''}`,
  };
}

export default {
  id: 'auction-values',
  wave: 2,
  title: 'Auction value badges',
  routes: ['amarket.php'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null, stopWatching: null };
    state = s;
    const alive = () => state === s;

    async function paint() {
      if (!ctx.site?.auctionValues) return;
      const rows = [...doc.querySelectorAll(ROW)];
      const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length === 0) return;
      const values = await ctx.site.auctionValues(ids);
      if (!alive()) return;
      for (const row of rows) {
        const value = values.get(Number(row.id));
        const place = row.querySelector('.title') || row;
        let node = place.querySelector(`:scope > .${MARK}`);
        if (!value) {
          node?.remove();
          continue;
        }
        const { text, title } = badgeFor(value);
        if (!node) {
          node = el('span', { class: MARK, ownerDocument: doc });
          node.style.cssText = 'display: inline-block; margin-left: 6px; padding: 0 5px; border-radius: 3px; font: 700 11px/16px sans-serif; background: #2d4f7a; color: #fff;';
          place.append(node);
        }
        const full = value.deal ? `${text} · deal` : text;
        if (node.textContent !== full) node.textContent = full;
        node.title = title;
        node.dataset.deal = String(value.deal);
        if (value.deal) node.style.background = '#2d6a3e';
      }
    }

    // Countdowns tick every second; only new or changed rows are a reason to look again.
    const mine = (n) => Boolean((n.nodeType === 1 ? n : n.parentElement)?.closest?.(`.time-wrap, .time, .${MARK}`));
    const quiet = (r) => mine(r.target)
      || (r.addedNodes.length + r.removedNodes.length > 0 && [...r.addedNodes, ...r.removedNodes].every(mine));
    const later = () => {
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => paint().catch((err) => ctx.log('auction values', err)), SETTLE_MS);
    };
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (!records.every(quiet)) later();
    }, doc);
    later();
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    s.win.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
