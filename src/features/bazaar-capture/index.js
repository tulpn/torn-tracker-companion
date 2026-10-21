// Another player's bazaar (CMP-203 capture half; CAPI-010 `bazaar_listing`).
//
// On bazaar.php?userId=N, the listings the page loads for the player are shared as one
// `bazaar_listing` (when the player has switched that kind on): item, quantity and price,
// with the item's own id where the page has one. The API has no player's bazaar listings,
// only a directory, so this fills a real gap. Your own bazaar pages (#/, #/add, #/manage)
// are never read.
//
// The page loads listings in chunks as the player scrolls; the script waits for the
// chunks to settle and reports what it has, marked complete only when it saw them all.
// At most once per bazaar every five minutes, and again only if a partial list became
// complete. Only while the tab is on screen. Nothing is bought and nothing is clicked.
//
// Torn shows no "closed" flag in the response any source names, so only a bazaar that
// listed items is reported, as open. A capture of a closed bazaar should confirm this.
//
// Inspiration: TornTools (GPLv3, https://github.com/Mephiles/torntools_extension) reads
// the same response for its bazaar worth. No code was taken.

import { createGate, isVisible } from '../../core/capture.js';
import { createListing, ownIdFrom, ownerFrom, readChunk } from './read.js';
import { isItemsResponse } from './selectors.js';

const WINDOW_MS = 5 * 60_000;

let state = null;

const feature = {
  id: 'bazaar-capture',
  wave: 2,
  title: 'Bazaar listings',
  area: 'market',
  guide: 'auction-and-bazaar',
  summary: "Lets you share another player's bazaar listings (switch it on under Sharing).",
  routes: ['bazaar.php'],
  defaults: { enabled: true },
  shares: ['bazaar_listing'],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)'],
  /** How long the chunks must be quiet before the listing is reported. */
  settleMs: 5_000,

  start(ctx) {
    const win = ctx.win || globalThis;
    const owner = ownerFrom(win.location?.search);
    if (!owner || owner === ownIdFrom(ctx.doc.cookie)) return;

    const s = {
      win, timer: null, unsubscribe: null, listing: createListing(), sentComplete: false,
      gate: createGate({ windowMs: WINDOW_MS, now: ctx.now }),
    };
    state = s;

    const report = () => {
      if (state !== s || !isVisible(ctx.doc)) return;
      const { items, complete } = s.listing.result();
      if (items.length === 0 || s.sentComplete) return;
      if (!s.gate.allow(`${owner}:${complete ? 'complete' : 'partial'}`)) return;
      if (ctx.share('bazaar_listing', { owner_id: owner, items, open: true, complete }) && complete) {
        s.sentComplete = true;
      }
      ctx.log('bazaar', owner, items.length, complete ? 'complete' : 'partial');
    };

    s.unsubscribe = ctx.intercept.onJson(isItemsResponse, ({ data }) => {
      const chunk = readChunk(data);
      if (!chunk) return;
      s.listing.add(chunk);
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(report, feature.settleMs);
    }, ctx.win);
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.unsubscribe?.();
    s.win.clearTimeout(s.timer);
  },
};

export default feature;
