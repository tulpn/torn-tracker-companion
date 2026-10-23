// The guide's next step in the settings page (hq #155, WP-GDE-4; GDE-007).
//
// One read, GET /api/feeds/me/guide (site.guide), kept 15 minutes in the read cache. It's
// asked when the player opens a Torn page and the kept answer is older than that, only
// with a script key and while the tab is visible, and never on the attack page. The
// settings page shows the answer it holds, so opening it asks for nothing. The strip has
// a switch under General; off, nothing is asked.
//
// The guide is opt-in (GDE-001): a player who never started it sees one line offering it,
// and once they dismiss it on the site, the site stops offering and the strip is gone.

import { matchRoute } from './routes.js';

/** Pages it never asks on: an attack in progress. */
const NEVER = ['loader.php?sid=attack', 'page.php?sid=attack'];

/** What the strip shows for an answer: the next step, the offer, or nothing. */
export function stripOf(guide) {
  if (!guide) return null;
  if (guide.started && guide.next) return { kind: 'next', ...guide.next, done: guide.done, total: guide.total, url: guide.url };
  if (!guide.started && guide.offer) return { kind: 'offer', url: guide.url };
  return null;
}

/**
 * @param {object} opts
 * @param {Document} opts.doc
 * @param {{guide: () => Promise<object|null>, guideHeld: () => object|null}} opts.site
 * @param {() => object} opts.getSettings
 */
export function createGuide({ doc, site, getSettings }) {
  let asking = null;
  const changed = new Set();
  const on = () => getSettings()?.guideStrip !== false;

  return {
    /** On every location change: asks when the kept answer has run out. */
    update(loc) {
      if (!on() || asking || site.guideHeld() || doc.visibilityState === 'hidden') return;
      if (NEVER.some((route) => matchRoute(route, loc))) return;
      asking = site.guide()
        .then((value) => { if (value) changed.forEach((fn) => fn()); })
        .catch(() => {})
        .finally(() => { asking = null; });
    },
    /** What the strip shows now; null when switched off or there's nothing to say. */
    strip: () => (on() ? stripOf(site.guideHeld()) : null),
    /** Called when a new answer came, so the settings page can redraw the strip. */
    onChange(fn) {
      changed.add(fn);
      return () => changed.delete(fn);
    },
    /** Waits for a read in flight; for tests. */
    settled: () => asking || Promise.resolve(),
    destroy() {
      changed.clear();
    },
  };
}
