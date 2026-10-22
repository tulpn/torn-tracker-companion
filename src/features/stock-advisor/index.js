// Stock signals on the stock market (CMP-304; read pinned in companion-api section 6.4).
//
// Beside each stock's name, a short label says when its price is far below or far above
// its 30-day average, from torn-tracker.com's daily closes. It names the rule, never
// "buy" or "sell", and it is a simple signal, not advice. Stocks the site has no signal
// for show nothing. The script never fills or presses Buy or Sell.
//
// Facts, not code, from TornTools (GPLv3, features/stock-acronyms and stocks-filter): the
// row's id attribute is Torn's stock id, and the name cell is the place for a label.
// Torn Stock Analyzer and Torn Stock Advisor (both MIT) confirmed the rows.

import { el } from '../../core/dom.js';
import { badge, setTone } from '../../core/ui.js';

const MARK = 'ttc-stock';
export const ROW = "#stockmarketroot [class*='stockMarket__'] > ul[class*='stock___'][id]";
export const NAME = "[class*='nameContainer__']";
const SETTLE_MS = 500;

let state = null;

const money = (n) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** The label for one stock's signal, or null when there is none to show. */
export function labelFor(entry) {
  if (!entry || entry.signal === null) return null;
  const avg = entry.avg_30d !== null ? ` (${money(entry.avg_30d)})` : '';
  const text = entry.signal === 'below_avg'
    ? `far below its 30-day average${avg}`
    : `far above its 30-day average${avg}`;
  return {
    text,
    title: 'A simple signal from torn-tracker.com’s daily closes, not advice. It only compares today’s price with the last 30 days.',
  };
}

export default {
  id: 'stock-advisor',
  wave: 3,
  title: 'Stock signals',
  area: 'market',
  guide: 'stock-signals',
  summary: 'Marks a stock whose price is far from its 30-day average.',
  routes: ['page.php?sid=stocks'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)'],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null, stopWatching: null, signals: null, asked: false };
    state = s;
    const alive = () => state === s;

    function paint() {
      if (!s.signals) return;
      for (const row of doc.querySelectorAll(ROW)) {
        const name = row.querySelector(NAME);
        if (!name) continue;
        const label = labelFor(s.signals.get(Number(row.id)));
        let node = name.querySelector(`:scope > .${MARK}`);
        if (!label) {
          node?.remove();
          continue;
        }
        if (!node) {
          node = badge(doc, { cls: MARK, block: true });
          // The row's cells open Torn's dropdown; a press on our label stays ours.
          node.addEventListener('click', (event) => event.stopPropagation());
          name.append(node);
        }
        if (node.textContent !== label.text) node.textContent = label.text;
        node.title = label.title;
        node.dataset.signal = s.signals.get(Number(row.id)).signal;
        // A price far below its average reads as an opportunity, far above as a caution;
        // the words, not the colour, carry the meaning, and neither says buy or sell.
        setTone(node, node.dataset.signal === 'below_avg' ? 'info' : 'warn');
      }
    }

    async function look() {
      if (!alive() || !ctx.site?.stockSignals) return;
      if (!s.asked && doc.querySelector(ROW)) {
        // One read per page view (the site client keeps it 5 minutes).
        s.asked = true;
        s.signals = await ctx.site.stockSignals();
        if (!alive()) return;
      }
      paint();
    }

    const ours = (r) => [r.target, ...r.addedNodes, ...r.removedNodes]
      .every((n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(`.${MARK}`));
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (records.every(ours)) return;
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => look().catch((err) => ctx.log('stock signals', err)), SETTLE_MS);
    }, doc);
    s.timer = win.setTimeout(() => look().catch((err) => ctx.log('stock signals', err)), SETTLE_MS);
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
