// Auction house listings (CMP-202 capture half; CAPI-010 `auction_listing`).
//
// On amarket.php, each listing the page shows is shared as one `auction_listing` (when
// the player has switched that kind on): the item and its own id, the seller (or none,
// when anonymous), the current bid and the number of bids, when it ends, its rarity, its
// damage, accuracy or armour, and its bonuses by name. Torn's API has completed sales but
// no live listings. The high bidder is on the page but is never sent.
//
// A listing is reported again only when its bid changed, and at most once every ten
// minutes; only while the tab is on screen. Nothing is bid on and nothing is clicked.
// The countdowns tick every second, so the rows are read after the page has been still
// for a moment, and a tick alone is no reason to read them.
//
// Inspiration: TornTools (GPLv3), Cortex RW Auction Insights (MIT) and OpenMarket (GPLv3)
// read the same rows. No code was taken; the selectors come from the owner's capture.

import { createGate, isVisible } from '../../core/capture.js';
import { readRow } from './read.js';
import { ROW } from './selectors.js';

const WINDOW_MS = 10 * 60_000;

let state = null;

const feature = {
  id: 'auction-capture',
  wave: 2,
  title: 'Auction listings',
  routes: ['amarket.php'],
  defaults: { enabled: true },
  shares: ['auction_listing'],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)', 'Cortex RW Auction Insights (MIT)', 'OpenMarket (GPLv3)'],
  /** How long the list must be still before its rows are read. */
  settleMs: 1_000,

  start(ctx) {
    const win = ctx.win || globalThis;
    const now = () => (typeof ctx.now === 'function' ? ctx.now() : Date.now());
    const s = { win, timer: null, stopWatching: null, gate: createGate({ windowMs: WINDOW_MS, now: ctx.now }) };
    state = s;

    const scan = () => {
      if (state !== s || !isVisible(ctx.doc)) return;
      let sent = 0;
      for (const row of ctx.doc.querySelectorAll(ROW)) {
        const listing = readRow(row, now());
        if (!listing) continue;
        if (!s.gate.allow(`${listing.listing_id}:${listing.current_bid}`)) continue;
        if (ctx.share('auction_listing', listing)) sent += 1;
      }
      if (sent) ctx.log('auctions', sent);
    };

    // A countdown ticking changes only text inside .time-wrap; that is not a new listing.
    const tick = (r) => r.type === 'characterData'
      || [r.target, ...r.addedNodes].every((n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.('.time-wrap, .time'));
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (records.every(tick)) return;
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(scan, feature.settleMs);
    }, ctx.doc);
    s.timer = win.setTimeout(scan, feature.settleMs);
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    s.win.clearTimeout(s.timer);
  },
};

export default feature;
