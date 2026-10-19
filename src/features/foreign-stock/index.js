// Foreign shop stock (CMP-104 capture half, TRV-051).
//
// On the shop the player sees after landing abroad, every item's stock and price is
// shared as `foreign_stock` (when the player has switched that kind on), zero stock
// included: an empty shelf is the fact restock predictions need most. The page's own
// response is read first; the shelves on the page are the fallback. Nothing is bought
// and nothing is clicked.
//
// At most one report per country every 30 seconds, and only while the tab is visible.
//
// Inspiration: TornTools (GPLv3, https://github.com/Mephiles/torntools_extension) reads
// the same response for its travel table and YATA uploads. No code was taken; the
// response and selector names are recorded in selectors.js with their source.
//
// The best-buy table (CMP-104's display half, TRV-052) needs the site's prices
// (CAPI-035) and arrives with WP-TRV-8.

import { createGate, isVisible } from '../../core/capture.js';
import { countryFromBody, fromPage, fromResponse, onTheGround } from './read.js';
import { ROWS, isShopResponse } from './selectors.js';

const WINDOW_MS = 30_000;

let unsubscribe = null;
let fallback = null;
let timers = globalThis;
let gate = null;

const feature = {
  id: 'foreign-stock',
  wave: 1,
  title: 'Foreign shop stock',
  routes: ['page.php?sid=travel', 'index.php'],
  defaults: { enabled: true },
  shares: ['foreign_stock'],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)'],
  /** How long to wait for the response before reading the shelves off the page. */
  fallbackMs: 3_000,

  start(ctx) {
    gate = createGate({ windowMs: WINDOW_MS, now: ctx.now });
    let answered = false;

    const report = (country, items) => {
      if (!country || items.length === 0) return;
      if (!isVisible(ctx.doc) || !onTheGround(ctx.doc)) return;
      if (!gate.allow(country)) return;
      for (const item of items) ctx.share('foreign_stock', { country, ...item });
      ctx.log('foreign stock', country, items.length, 'items');
    };

    unsubscribe = ctx.intercept.onJson(isShopResponse, ({ data }) => {
      const read = fromResponse(data);
      if (!read) return;
      answered = true;
      report(read.country ?? countryFromBody(ctx.doc), read.items);
    }, ctx.win);

    // A shop the page rendered before we were listening still counts.
    timers = ctx.win || globalThis;
    fallback = timers.setTimeout(async () => {
      fallback = null;
      if (answered) return;
      if (!(await ctx.dom.waitFor(ROWS, { root: ctx.doc, timeout: feature.fallbackMs }))) return;
      if (!answered) report(countryFromBody(ctx.doc), fromPage(ctx.doc));
    }, feature.fallbackMs);
  },

  stop() {
    unsubscribe?.();
    unsubscribe = null;
    if (fallback !== null) timers.clearTimeout(fallback);
    fallback = null;
    gate = null;
  },
};

export default feature;
