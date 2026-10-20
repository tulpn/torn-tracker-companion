// Item market snapshots (CMP-203's item market half; CAPI-010 `item_market_snapshot`,
// demand-gated by CAPI-013 as accepted in hq #123).
//
// The API already has item market listings, so a snapshot is sent only for items the site
// asks for right now (its demand feed, kept 60 s), and only when the player shares this
// kind: the prices and quantities of up to 50 listings of the item they opened, never who
// is selling. At most once per item every five minutes, only while the tab is on screen.
// Nothing is bought and nothing is clicked.
//
// Inspiration: TornTools (GPLv3), whose cheap-item highlight reads the same rows. No code
// was taken.

import { createGate, isVisible } from '../../core/capture.js';
import { readMoney } from '../../core/dom.js';
import { AVAILABLE, ITEM_IMAGE, LIST_WRAPPER, PRICE, ROW } from './selectors.js';

export const MAX_LISTINGS = 50;
const KIND = 'item_market_snapshot';
const WINDOW_MS = 5 * 60_000;
const SETTLE_MS = 800;

let state = null;

const positive = (v) => (Number.isInteger(v) && v > 0 ? v : null);

/** The item being viewed: the hash's itemID, else the item's image beside the list. */
export function itemOf(doc, hash) {
  const fromHash = positive(Number(new URLSearchParams(String(hash || '').replace(/^#\/?/, '').replace(/^market\//, '')).get('itemID')));
  if (fromHash) return fromHash;
  const img = doc.querySelector(LIST_WRAPPER)?.previousElementSibling?.querySelector(ITEM_IMAGE)
    || doc.querySelector(`${LIST_WRAPPER} ${ITEM_IMAGE}`);
  const m = /\/images\/items\/(\d+)\//.exec(`${img?.getAttribute('srcset') || ''} ${img?.getAttribute('src') || ''}`);
  return m ? Number(m[1]) : null;
}

/** Up to 50 listings as {price, quantity}; a row that cannot be read is left out. */
export function listingsOf(doc) {
  const out = [];
  for (const row of doc.querySelectorAll(ROW)) {
    const price = readMoney(row.querySelector(PRICE)?.textContent);
    const quantity = positive(Number(String(row.querySelector(AVAILABLE)?.textContent || '').replace(/[^\d]/g, '') || NaN));
    if (price === null || price < 0 || !quantity) continue;
    out.push({ price, quantity });
    if (out.length === MAX_LISTINGS) break;
  }
  return out;
}

export default {
  id: 'market-snapshot',
  wave: 2,
  title: 'Item market prices',
  routes: ['page.php?sid=ItemMarket'],
  defaults: { enabled: true },
  shares: [KIND],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)'],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { win, timer: null, stopWatching: null, gate: createGate({ windowMs: WINDOW_MS, now: ctx.now }) };
    state = s;

    async function look() {
      if (state !== s || !isVisible(doc) || !ctx.site?.demand) return;
      // Nothing is asked of the site unless the player shares this kind.
      if (typeof ctx.sharing === 'function' && !ctx.sharing(KIND)) return;
      const item = itemOf(doc, win.location?.hash);
      const listings = item ? listingsOf(doc) : [];
      if (!item || listings.length === 0) return;
      const wanted = (await ctx.site.demand()).get(KIND);
      if (state !== s || !wanted?.has(item) || !s.gate.allow(String(item))) return;
      ctx.share(KIND, { item_id: item, listings });
    }

    s.stopWatching = ctx.dom.onMutation(() => {
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => look().catch((err) => ctx.log('market snapshot', err)), SETTLE_MS);
    }, doc);
    s.timer = win.setTimeout(() => look().catch((err) => ctx.log('market snapshot', err)), SETTLE_MS);
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    s.win.clearTimeout(s.timer);
  },
};
