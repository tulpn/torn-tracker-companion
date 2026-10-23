// The companion's tours and when they run (hq #237, WP-UX-4; UXT-001, UXT-003, UXT-022).
//
// Eight tours: the settings page, the ranked-war page, the travel agency, the foreign shop,
// the bazaar, trades, crimes and organised crimes. The copy is hq #238's.
//
// When a tour runs:
//   - the settings tour, the first time the settings page opens, once per tour version;
//     a new version shows only the steps the player hasn't seen;
//   - any tour on demand: the "?" in the settings page's header, or Help → Tours. A tour
//     of another page is asked for there and starts when the player next opens that page
//     (within ten minutes), once its first anchor is on the page;
//   - after an unlock (UXT-003): when the player switches a feature on and saves, its
//     page's tour is asked for the same way, and starts at that feature's first step;
//   - never on the attack page, and never while the player is typing in a field.
//
// Progress lives on this device under `ttc_tours`, is checked field by field when read,
// and goes with "Forget me" (CMP-008).

import { matchRoute } from './routes.js';
import { checkTour, runTour, stepId, typing } from './tour.js';

export const PENDING_MS = 10 * 60_000;
const WAIT_MS = 15_000;
/** Pages a tour never starts on by itself: an attack in progress. */
const NEVER = ['loader.php?sid=attack', 'page.php?sid=attack'];

export const TOURS = Object.freeze([
  checkTour({
    id: 'settings',
    version: 1,
    surface: 'companion',
    page: '#/torn-tracker',
    title: 'The settings page',
    steps: [
      {
        target: 'companion-settings',
        title: 'Your companion, on one page',
        body: 'Every feature has a switch here. Nothing changes on Torn’s pages until you press Save.',
      },
      {
        target: 'companion-sections',
        title: 'Find a setting',
        body: 'Features, Sidebar, Sharing and Keys each have a section. Search finds a setting in any of them.',
      },
      {
        target: 'companion-keys-tab',
        title: 'Add your script key',
        body: 'Dibs, timers and fair-fight estimates come from torn-tracker.com, and your script key connects them. It stays on this device.',
        requires: 'nokey:script',
      },
      {
        target: 'companion-sharing-tab',
        title: 'Sharing starts off',
        body: 'Nothing about you is shared until you switch a kind on. Each switch says exactly what it sends.',
      },
      {
        target: 'companion-save',
        title: 'Save when you’re done',
        body: 'Close leaves without saving. Next time, the page opens on the section you used last.',
      },
      {
        target: 'companion-sidebar',
        title: 'Live facts in Torn’s sidebar',
        body: 'Your chain, the war score and your dibs, under Lists. Pick which lines show under Sidebar.',
        requires: 'sidebar',
      },
      {
        target: 'companion-tour-button',
        title: 'See this again',
        body: 'Press ? any time. Help → Tours lists every tour, with the ones you’ve done.',
      },
    ],
  }),
  checkTour({
    id: 'war-page',
    version: 1,
    surface: 'companion',
    page: 'factions.php#/war/',
    href: 'https://www.torn.com/factions.php?step=your#/war/rank',
    title: 'The ranked-war page',
    steps: [
      {
        target: 'war-sort',
        title: 'Sort the opponents',
        body: 'By status, out soonest, level or fair fight. Torn’s own rows are moved, never copied.',
        requires: 'feature:war-page',
      },
      {
        target: 'ff-badge',
        title: 'Fair fight at a glance',
        body: 'An estimate from torn-tracker.com: blue is an easy hit, red a hard one, ? means no estimate yet.',
        example: { lines: ['Ares · level 74 · Okay', 'FF 2.41: good respect for one hit'] },
        requires: 'feature:ff-badges',
      },
      {
        target: 'war-dibs',
        title: 'Call dibs',
        body: 'Press to claim a target for your faction, and again to let it go. It never attacks for you.',
        requires: 'feature:war-page',
      },
      {
        target: 'war-timer',
        title: 'When they’re out',
        body: 'Hospital and jail time left, and where they’re flying, from your faction’s war room.',
        requires: 'feature:war-page',
      },
      {
        target: 'war-loadout',
        title: 'Loadout flags (Pro)',
        body: 'Heavy hitter, armour or temps seen on their latest loadout, and how old that sighting is.',
        requires: 'feature:war-page',
      },
    ],
  }),
  checkTour({
    id: 'travel-agency',
    version: 1,
    surface: 'companion',
    page: 'travel.php',
    href: 'https://www.torn.com/travel.php',
    title: 'The travel agency',
    steps: [
      {
        target: 'travel-runs',
        title: 'Your best runs',
        body: 'Your top three runs from torn-tracker.com’s planner: where, what to buy, profit per hour and when you’d land. Nothing is booked for you.',
        example: { lines: ['Mexico · 29 Jaguar plushies · $1.21m an hour', 'Lands 04:52 TCT · restock likely'] },
        requires: 'feature:travel-panel',
      },
    ],
  }),
  checkTour({
    id: 'foreign-shop',
    version: 1,
    surface: 'companion',
    page: 'page.php?sid=travel',
    href: 'https://www.torn.com/page.php?sid=travel',
    title: 'The foreign shop',
    steps: [
      {
        target: 'shop-best-buy',
        title: 'The best buy on this shelf',
        body: 'The item that makes the most for what you can still carry and afford, with how many to buy. Nothing is bought for you.',
        example: { lines: ['Buy 29 · about $412k profit at home'] },
        requires: 'feature:best-buy',
      },
    ],
  }),
  checkTour({
    id: 'bazaar',
    version: 1,
    surface: 'companion',
    page: 'bazaar.php#/add',
    href: 'https://www.torn.com/bazaar.php#/add',
    title: 'Pricing in your bazaar',
    steps: [
      {
        target: 'price-fill',
        title: 'Fill the price',
        body: 'Fills this row with the market value minus your undercut. You still press Torn’s own button to list it.',
        requires: 'feature:price-filler',
      },
    ],
  }),
  checkTour({
    id: 'trade',
    version: 1,
    surface: 'companion',
    page: 'trade.php',
    href: 'https://www.torn.com/trade.php',
    title: 'Trades',
    steps: [
      {
        target: 'trade-value',
        title: 'Their offer at market value',
        body: 'Their money and items, totalled at torn-tracker.com’s market value. Copy makes a receipt to paste in the chat.',
        requires: 'feature:trade-value',
      },
    ],
  }),
  checkTour({
    id: 'crimes',
    version: 1,
    surface: 'companion',
    page: 'page.php?sid=crimes',
    href: 'https://www.torn.com/page.php?sid=crimes',
    title: 'Crimes',
    steps: [
      {
        target: 'crime-morale',
        title: 'Your morale',
        body: 'Torn doesn’t show it, so we work it out from the page: 100 minus your demoralisation.',
        requires: 'feature:crime-helper',
      },
      {
        target: 'crime-value',
        title: 'Money per nerve',
        body: 'What each crime option earns for the nerve it costs, from torn-tracker.com, so you spend nerve where it pays.',
        requires: 'feature:crime-helper',
      },
    ],
  }),
  checkTour({
    id: 'faction-crimes',
    version: 1,
    surface: 'companion',
    page: 'factions.php#/tab=crimes',
    href: 'https://www.torn.com/factions.php?step=your#/tab=crimes',
    title: 'Organised crimes',
    steps: [
      {
        target: 'oc-success',
        title: 'Success estimate',
        body: 'torn-tracker.com’s estimate for this crime, when your faction’s key allows it.',
        requires: 'feature:oc-helper',
      },
      {
        target: 'oc-weight',
        title: 'How much this role counts',
        body: 'Each role’s weight towards the crime’s success, so the right member takes the slot that matters most.',
        requires: 'feature:oc-helper',
      },
    ],
  }),
]);

const byId = new Map(TOURS.map((tour) => [tour.id, tour]));

/** Progress as stored, checked field by field: anything unexpected is dropped. */
export function cleanProgress(raw, now = Date.now()) {
  const out = { tours: {}, pending: null };
  const given = raw && typeof raw === 'object' ? raw : {};
  const tours = given.tours && typeof given.tours === 'object' ? given.tours : {};
  for (const tour of TOURS) {
    const p = tours[tour.id];
    if (!p || typeof p !== 'object') continue;
    const ids = new Set(tour.steps.map(stepId));
    out.tours[tour.id] = {
      version: Number.isInteger(p.version) && p.version >= 1 ? p.version : 0,
      seen: Array.isArray(p.seen) ? [...new Set(p.seen.filter((id) => ids.has(id)))] : [],
      done: p.done === true,
      skipped: p.skipped === true,
    };
  }
  const pending = given.pending;
  if (pending && byId.has(pending.id) && Number.isFinite(pending.at) && now - pending.at < PENDING_MS && pending.at <= now) {
    out.pending = { id: pending.id, at: pending.at };
    if (typeof pending.from === 'string' && byId.get(pending.id).steps.some((step) => stepId(step) === pending.from)) {
      out.pending.from = pending.from;
    }
  }
  return out;
}

const current = (progress, tour) => (progress.tours[tour.id]?.version === tour.version ? progress.tours[tour.id] : null);
/** Whether the player went through this version of the tour to the end. */
export const isDone = (progress, tour) => current(progress, tour)?.done === true;
/** Whether this version has had its turn: done or skipped, so it doesn't start by itself again. */
export const hadTurn = (progress, tour) => Boolean(current(progress, tour)?.done || current(progress, tour)?.skipped);

/** The tour of a feature's page and the step it starts at, or null when no tour shows it. */
export function tourFor(featureId) {
  for (const tour of TOURS) {
    if (!tour.href) continue;
    const step = tour.steps.find((s) => s.requires === `feature:${featureId}`);
    if (step) return { id: tour.id, from: stepId(step) };
  }
  return null;
}

/**
 * @param {object} opts
 * @param {Window} opts.win
 * @param {{read: () => Promise<any>, write: (value: object) => Promise<boolean>}} opts.store
 * @param {(requires: string) => boolean} opts.isMet
 * @param {(handler: () => void, doc: Document) => () => void} opts.onMutation
 * @param {() => number} [opts.now]
 */
export function createTours({ win, store, isMet, onMutation, now = () => Date.now() }) {
  const doc = win.document;
  let progress = cleanProgress(null);
  let running = null;
  let waiting = null;
  /** Bumped by "Forget me", so a tour stopped by it doesn't write its progress back. */
  let generation = 0;
  const changed = new Set();

  const save = () => store.write(progress).catch(() => false);
  const notify = () => changed.forEach((fn) => fn());

  function record(tour, started, { reason, seen }) {
    if (started !== generation) return;
    running = null;
    if (reason === 'empty') return;
    const before = current(progress, tour);
    progress.tours[tour.id] = {
      version: tour.version,
      // Seen steps carry over to a new version, which then shows only its new ones.
      seen: [...new Set([...(progress.tours[tour.id]?.seen || []), ...seen])],
      done: reason === 'done' || before?.done === true,
      skipped: reason === 'skipped',
    };
    save();
    notify();
  }

  function stopWaiting() {
    waiting?.();
    waiting = null;
  }

  /**
   * Starts a tour now, on this page.
   * @param {string} id
   * @param {object} [opts]
   * @param {Array<ParentNode>} [opts.roots]
   * @param {'dark'|'light'} [opts.theme]
   * @param {boolean} [opts.onlyNew]  skip the steps this player has seen already
   * @param {string} [opts.from]  start at this step, skipping the ones before it
   */
  function start(id, { roots = [doc], theme, onlyNew = false, from = null } = {}) {
    const tour = byId.get(id);
    if (!tour) return false;
    running?.stop();
    stopWaiting();
    const skip = onlyNew ? [...(progress.tours[id]?.seen || [])] : [];
    const at = from ? tour.steps.findIndex((step) => stepId(step) === from) : -1;
    if (at > 0) skip.push(...tour.steps.slice(0, at).map(stepId));
    const started = generation;
    running = runTour(doc, tour, { roots, theme, isMet, skip, onEnd: (result) => record(tour, started, result) });
    return true;
  }

  const blocked = (loc) => NEVER.some((route) => matchRoute(route, loc)) || typing(doc);

  return {
    /** Reads what's stored; call once at boot. */
    async load() {
      try {
        progress = cleanProgress(await store.read(), now());
      } catch {
        progress = cleanProgress(null);
      }
    },
    /** Every tour, with whether it's done, for Help → Tours. */
    list() {
      return TOURS.map((tour) => ({ id: tour.id, title: tour.title, href: tour.href || null, done: isDone(progress, tour) }));
    },
    start,
    /** The settings tour, once per version, the first time the page opens. */
    auto(id, opts = {}) {
      const tour = byId.get(id);
      if (!tour || hadTurn(progress, tour) || running || blocked(win.location)) return false;
      return start(id, { ...opts, onlyNew: true });
    },
    /** Asks for a tour of another page; it starts when the player opens that page. */
    request(id, { from = null } = {}) {
      if (!byId.has(id)) return Promise.resolve(false);
      progress.pending = { id, at: now(), ...(from ? { from } : {}) };
      return save();
    },
    /**
     * Features the player just switched on (UXT-003, after an unlock): the first one
     * with a tour has it asked for, starting at its step. A step already seen isn't.
     */
    unlocked(featureIds) {
      for (const featureId of featureIds) {
        const found = tourFor(featureId);
        if (!found || progress.tours[found.id]?.seen.includes(found.from)) continue;
        return this.request(found.id, { from: found.from });
      }
      return Promise.resolve(false);
    },
    /** On every location change: start a tour asked for on this page, once its first anchor shows. */
    update(loc, opts = {}) {
      stopWaiting();
      const pending = progress.pending;
      if (!pending || now() - pending.at >= PENDING_MS) return;
      const tour = byId.get(pending.id);
      if (!tour || !matchRoute(tour.page, loc) || NEVER.some((route) => matchRoute(route, loc))) return;
      const anchors = tour.steps.map((step) => `[data-tour="${step.target}"]`).join(', ');
      const go = () => {
        if (!doc.querySelector(anchors) || typing(doc)) return false;
        stopWaiting();
        progress.pending = null;
        save();
        start(tour.id, { ...opts, from: pending.from || null });
        return true;
      };
      if (go()) return;
      const stop = onMutation(() => { go(); }, doc);
      const timer = win.setTimeout(stopWaiting, WAIT_MS);
      waiting = () => {
        stop();
        win.clearTimeout(timer);
      };
    },
    /** Called when the tours' state changes, so Help → Tours can redraw. */
    onChange(fn) {
      changed.add(fn);
      return () => changed.delete(fn);
    },
    /** Ends a running tour without a verdict on it: its page went away. */
    stop() {
      const tour = running;
      running = null;
      generation += 1;
      tour?.stop();
      stopWaiting();
    },
    /** After "Forget me". */
    reset() {
      generation += 1;
      running?.stop();
      running = null;
      stopWaiting();
      progress = cleanProgress(null);
      notify();
    },
    get running() { return running; },
    destroy() {
      running?.stop();
      stopWaiting();
      changed.clear();
    },
  };
}
