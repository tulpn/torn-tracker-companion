// Fair-fight badges (CMP-101).
//
// Next to each player on profiles, faction member lists, the ranked-war page and the
// attack page, a small badge shows the fair-fight estimate from torn-tracker.com. All
// the players on the page are looked up in one batch (core/site.js caches each answer
// for an hour), so there is never a request per player. The badge only shows; clicking
// it does nothing.
//
// Inspiration: FF Scouter V2 by xentac and contributors (GPLv3 per its header,
// https://github.com/xentac/FFScouter): the idea, where the rows are, and the colour
// scale. No code was taken.

import { el } from '../../core/dom.js';
import { HEADING, ROWS, ROW_LINK } from './selectors.js';
import { describe, textColourFor } from './view.js';

const MARK = 'ttc-ff';
const STYLE_ID = 'ttc-ff-style';
const STYLE = `
  .${MARK} {
    display: inline-block; min-width: 34px; margin: 0 4px; padding: 1px 4px; border-radius: 3px;
    font: 700 11px/16px sans-serif; text-align: center; vertical-align: middle; cursor: default;
  }
`;
/** Torn re-renders lists in bursts; one scan once it settles. */
const SETTLE_MS = 250;

let stopWatching = null;
let timer = null;
let timers = globalThis;
let page = null;
let alive = false;

/** The player id in a profile link, or null. */
export function idFromHref(href) {
  const m = /[?&]XID=(\d+)/.exec(String(href || ''));
  return m ? Number(m[1]) : null;
}

/** The player a profile or attack page is about. */
function pageSubject(loc) {
  const params = new URLSearchParams(String(loc?.search || ''));
  const id = Number(params.get('XID') || params.get('user2ID'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Places that need a badge and do not have one yet.
 * @returns {Array<{id: number, after: Element}>}
 */
export function findSpots(doc, loc) {
  const spots = [];
  for (const row of doc.querySelectorAll(ROWS)) {
    if (row.querySelector(`.${MARK}`)) continue;
    const link = row.querySelector(ROW_LINK);
    const id = idFromHref(link?.getAttribute('href'));
    if (id) spots.push({ id, after: link });
  }
  const subject = pageSubject(loc);
  const page = String(loc?.pathname || '').split('/').pop();
  if (subject && (page === 'profiles.php' || page === 'page.php')) {
    const heading = doc.querySelector(HEADING);
    if (heading && !heading.parentNode?.querySelector(`:scope > .${MARK}`)) spots.push({ id: subject, after: heading });
  }
  return spots;
}

function badge(doc, estimate) {
  const look = describe(estimate);
  const node = el('span', { class: MARK, title: look.title, ownerDocument: doc }, look.text);
  node.style.background = look.background;
  node.style.color = textColourFor(look.background);
  return node;
}

export default {
  id: 'ff-badges',
  wave: 1,
  title: 'Fair-fight badges',
  routes: ['profiles.php', 'factions.php', 'page.php?sid=attack'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: ['FF Scouter V2 (GPLv3)'],

  start(ctx) {
    alive = true;
    timers = ctx.win || globalThis;
    const { doc } = ctx;
    page = doc;
    if (!doc.getElementById(STYLE_ID)) {
      const style = el('style', { id: STYLE_ID, ownerDocument: doc });
      style.textContent = STYLE;
      doc.head.append(style);
    }

    const scan = async () => {
      const spots = findSpots(doc, ctx.win?.location);
      if (spots.length === 0) return;
      const estimates = await ctx.site.ff(spots.map((s) => s.id));
      if (!alive) return;
      for (const { id, after } of spots) {
        if (!after.isConnected || after.parentNode?.querySelector(`:scope > .${MARK}[data-player="${id}"]`)) continue;
        const node = badge(doc, estimates.get(id));
        node.dataset.player = String(id);
        after.after(node);
      }
    };

    const later = () => {
      timers.clearTimeout(timer);
      timer = timers.setTimeout(() => {
        timer = null;
        scan().catch((err) => ctx.log('ff badges', err));
      }, SETTLE_MS);
    };

    stopWatching = ctx.dom.onMutation((records) => {
      // Our own badges going in are not a reason to look again.
      if (records.every((r) => [...r.addedNodes].every((n) => n.classList?.contains(MARK)))) return;
      later();
    }, doc);
    later();
  },

  stop() {
    alive = false;
    stopWatching?.();
    stopWatching = null;
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
    for (const node of page?.querySelectorAll(`.${MARK}`) || []) node.remove();
    page = null;
  },
};
