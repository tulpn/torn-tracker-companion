// The companion's tours and when they run (hq #237, WP-UX-4; UXT-001, UXT-003, UXT-022).
//
// Two tours so far: the settings page, and the ranked-war page. The copy is a draft in the
// voice spec's terms; the lead's tour content (hq #238) replaces it.
//
// When a tour runs:
//   - the settings tour, the first time the settings page opens, once per tour version;
//     a new version shows only the steps the player hasn't seen;
//   - any tour on demand: the "?" in the settings page's header, or Help → Tours. A tour
//     of another page is asked for there and starts when the player next opens that page
//     (within ten minutes), once its first anchor is on the page;
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
        title: 'Your companion, one page',
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
        body: 'Dibs, timers and fair-fight estimates come from torn-tracker.com. Your script key connects them. It stays on this device.',
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
        body: 'Close leaves without saving. The page opens on the section you used last.',
      },
      {
        target: 'companion-sidebar',
        title: 'Live facts in Torn’s sidebar',
        body: 'Your chain, the war score and your dibs, under Lists. Choose its lines under Sidebar.',
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
        example: { lines: ['Ares · level 74 · Okay', 'FF 2.41 → good respect for one hit'] },
        requires: 'feature:ff-badges',
      },
      {
        target: 'war-dibs',
        title: 'Call dibs',
        body: 'Press to claim a target for your faction, press again to let it go. It never attacks for you.',
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
  }
  return out;
}

const current = (progress, tour) => (progress.tours[tour.id]?.version === tour.version ? progress.tours[tour.id] : null);
/** Whether the player went through this version of the tour to the end. */
export const isDone = (progress, tour) => current(progress, tour)?.done === true;
/** Whether this version has had its turn: done or skipped, so it doesn't start by itself again. */
export const hadTurn = (progress, tour) => Boolean(current(progress, tour)?.done || current(progress, tour)?.skipped);

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
   */
  function start(id, { roots = [doc], theme, onlyNew = false } = {}) {
    const tour = byId.get(id);
    if (!tour) return false;
    running?.stop();
    stopWaiting();
    const skip = onlyNew ? progress.tours[id]?.seen || [] : [];
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
    request(id) {
      if (!byId.has(id)) return Promise.resolve(false);
      progress.pending = { id, at: now() };
      return save();
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
        start(tour.id, opts);
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
