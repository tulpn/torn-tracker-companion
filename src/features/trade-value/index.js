// Trade value calculator (CMP-201).
//
// On the trade page, under the other trader's side, a line totals their money and items
// at torn-tracker.com's market value (CAPI-035, one lookup per change of the offer,
// cached for ten minutes), with a Copy button for a receipt to paste in the chat. It only
// shows: the script never accepts, adds or removes anything.
//
// The trade page names items but shows no id, so names are matched against the table in
// src/data/items.js (tools/build-items.mjs). An item it does not know is counted as
// "without a price", never guessed.
//
// Inspiration: TornTools (GPLv3, https://github.com/Mephiles/torntools_extension) totals
// each side the same way, and Torn PDA (GPLv3, https://github.com/Manuito83/torn-pda)
// copies the total. No code was taken.

import { el } from '../../core/dom.js';
import { ITEM_IDS } from '../../data/items.js';
import { money, priceOffer, readSide, receipt } from './read.js';
import { STEPS, THEIR_NAME, THEIR_SIDE } from './selectors.js';

const MARK = 'ttc-trade';
const STYLE_ID = 'ttc-trade-style';
const STYLE = `
  .${MARK} { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px 8px; font: 12px sans-serif; }
  .${MARK} strong { font-weight: 700; }
  .${MARK} button { padding: 1px 8px; border: 1px solid #888; border-radius: 3px; background: #333; color: #ddd; cursor: pointer; }
  .${MARK} textarea { width: 100%; min-height: 6em; font: 11px monospace; }
`;
const SETTLE_MS = 250;

let state = null;

/** The trade's step from the hash: '#step=view&ID=1' -> 'view'. */
export function stepOf(hash) {
  return new URLSearchParams(String(hash || '').replace(/^#\/?/, '')).get('step');
}

export default {
  id: 'trade-value',
  wave: 2,
  title: 'Trade value',
  routes: ['trade.php'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)', 'Torn PDA (GPLv3)'],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null, stopWatching: null, seen: '', ids: ITEM_IDS };
    state = s;
    const alive = () => state === s;

    if (!doc.getElementById(STYLE_ID)) {
      const style = el('style', { id: STYLE_ID, ownerDocument: doc });
      style.textContent = STYLE;
      doc.head.append(style);
    }

    function box(side) {
      let node = side.querySelector(`:scope > .${MARK}`);
      if (!node) {
        node = el('div', { class: MARK, ownerDocument: doc });
        side.append(node);
      }
      return node;
    }

    function show(side, priced, trader) {
      const node = box(side);
      const words = priced.unpriced ? `, ${priced.unpriced} without a price` : '';
      const copy = el('button', { type: 'button', ownerDocument: doc }, 'Copy receipt');
      copy.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const text = receipt(priced, trader);
        try {
          await win.navigator.clipboard.writeText(text);
          copy.textContent = 'Copied';
        } catch {
          // No clipboard (an old WebView, or permission refused): show it to copy by hand.
          const area = el('textarea', { readonly: true, ownerDocument: doc });
          area.value = text;
          node.append(area);
          area.select();
        }
      });
      node.replaceChildren(
        el('span', { ownerDocument: doc }, 'Their offer at market value: ', el('strong', { ownerDocument: doc }, money(priced.total)), words),
        copy,
      );
    }

    async function scan() {
      if (!STEPS.includes(stepOf(win.location?.hash))) return;
      const side = doc.querySelector(THEIR_SIDE);
      if (!side) return;
      const offer = readSide(side, s.ids);
      if (offer.cash === 0 && offer.items.length === 0) {
        side.querySelector(`:scope > .${MARK}`)?.remove();
        s.seen = '';
        return;
      }
      // Only a changed offer is priced again.
      const key = JSON.stringify(offer);
      if (key === s.seen && side.querySelector(`:scope > .${MARK}`)) return;
      s.seen = key;
      const ids = offer.items.map((item) => item.id).filter((id) => id !== null);
      const prices = ids.length && ctx.site ? await ctx.site.prices(ids) : new Map();
      if (!alive()) return;
      const trader = side.querySelector(THEIR_NAME)?.textContent.trim() || '';
      show(side, priceOffer(offer, prices), trader);
    }

    function later() {
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => {
        s.timer = null;
        scan().catch((err) => ctx.log('trade value', err));
      }, SETTLE_MS);
    }

    const ours = (r) => [r.target, ...r.addedNodes, ...r.removedNodes]
      .every((n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(`.${MARK}`));
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (!records.every(ours)) later();
    }, doc);
    win.addEventListener('hashchange', later);
    s.onHash = later;
    later();
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    s.win.removeEventListener('hashchange', s.onHash);
    s.win.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
