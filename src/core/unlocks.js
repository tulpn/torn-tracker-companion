// Achievements in the companion (hq #241, WP-UX-8; UXA-002, UXA-003).
//
// Two things, each with its own switch under Settings → General:
//   - a small toast on the Torn page the player is on when torn-tracker.com says they
//     earned an achievement: its name, its tier and one sentence, with a link to the
//     achievement on the site, where Share is. Nothing is ever shared from here;
//   - the player's featured achievements in the settings page's header.
//
// One read feeds both: GET /api/feeds/me/achievements?since=<the last reply's time>
// (site.achievements). It's asked when the player opens a Torn page, at most once every
// five minutes, only with a script key and while the tab is visible, and never on the
// attack page. There is no timer that asks by itself. The very first read only sets where
// the next one starts, so an install never greets the player with old unlocks.
//
// The player's one off switch on torn-tracker.com (HOOK-016, D-146): with pause all on, or
// companion toasts off, in their notification settings there, no toast is shown; the read
// says which with each reply. The switch here stays as well: either one turns it off.
//
// What's kept on this device, under `ttc_unlocks`: the last reply's time, when it was
// asked, the featured achievements, and whether the site's off switch was on. It's checked field by field when read, and goes
// with "Forget me" (CMP-008).

import { el } from './dom.js';
import { followTorn } from './tokens.js';
import { matchRoute } from './routes.js';
import { TIERS } from './site.js';

const P = 'ttc';
export const TOAST_ID = `${P}-unlock`;
export const READ_EVERY_MS = 5 * 60_000;
export const SHOW_MS = 12_000;
/** Pages it never asks or shows on: an attack in progress. */
const NEVER = ['loader.php?sid=attack', 'page.php?sid=attack'];
const ID = /^[a-z0-9][a-z0-9_-]{0,59}$/;

const STYLE = `
  ${followTorn(`#${TOAST_ID}`)}
  #${TOAST_ID} {
    position: fixed; right: 16px; bottom: 16px; z-index: 100000; box-sizing: border-box;
    width: min(340px, calc(100vw - 32px)); padding: 12px 44px 12px 14px;
    border: 1px solid var(--border); border-left: 4px solid var(--tt-warning); border-radius: var(--radius);
    box-shadow: var(--tt-shadow-sm); background: var(--card); color: var(--card-foreground);
    font: 13px/1.45 var(--tt-font-sans); overflow-wrap: anywhere;
    animation: ${P}-unlock-in var(--tt-duration-fast, .2s) var(--tt-ease, ease-out);
  }
  #${TOAST_ID} .${P}-unlock-eyebrow { display: block; font: 700 11px/1.4 var(--tt-font-sans); letter-spacing: .04em; text-transform: uppercase; color: var(--muted-foreground); }
  #${TOAST_ID} .${P}-unlock-name { display: block; margin: 2px 0; font-weight: 700; font-size: 14px; }
  #${TOAST_ID} .${P}-unlock-tier { margin-left: 6px; padding: 0 7px; border-radius: 999px; font: 600 11px/16px var(--tt-font-sans); background: color-mix(in srgb, var(--tt-warning) 18%, transparent); }
  #${TOAST_ID} .${P}-unlock-links { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
  #${TOAST_ID} a { color: var(--ring); font-weight: 600; }
  #${TOAST_ID} .${P}-unlock-x {
    position: absolute; top: 2px; right: 2px; width: 44px; height: 44px; border: 0; cursor: pointer;
    background: transparent; color: var(--muted-foreground); font-size: 16px;
  }
  #${TOAST_ID} .${P}-unlock-x:focus-visible, #${TOAST_ID} a:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  @keyframes ${P}-unlock-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes ${P}-unlock-fade { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { #${TOAST_ID} { animation-name: ${P}-unlock-fade; } }
  @media (max-width: 640px) { #${TOAST_ID} { left: 16px; right: 16px; width: auto; bottom: 72px; } }
`;

function addStyle(doc) {
  if (doc.getElementById(`${P}-unlock-style`)) return;
  const style = el('style', { id: `${P}-unlock-style`, ownerDocument: doc });
  style.textContent = STYLE;
  (doc.head || doc.documentElement).append(style);
}

/** The achievement switches' defaults: both on (UXA-002: the toast is switchable). */
export const ACHIEVEMENT_DEFAULTS = Object.freeze({ toast: true, featured: true });

const featuredOf = (list) => (Array.isArray(list) ? list : []).slice(0, 5)
  .filter((a) => typeof a?.id === 'string' && ID.test(a.id) && typeof a.name === 'string' && a.name && a.name.length <= 64
    && (a.tier === null || TIERS.includes(a.tier)))
  .map((a) => ({ id: a.id, name: a.name, tier: a.tier }));

/** What's stored, checked field by field: anything unexpected is dropped. */
export function cleanState(raw, now = Date.now()) {
  const given = raw && typeof raw === 'object' ? raw : {};
  const cursor = typeof given.cursor === 'string' && given.cursor.length <= 40 && Number.isFinite(Date.parse(given.cursor)) ? given.cursor : null;
  const readAt = Number.isFinite(given.readAt) && given.readAt > 0 && given.readAt <= now ? given.readAt : 0;
  return { cursor, readAt, featured: featuredOf(given.featured), silenced: given.silenced === true };
}

const tierName = (tier) => (tier ? tier[0].toUpperCase() + tier.slice(1) : null);

/**
 * @param {object} opts
 * @param {Document} opts.doc
 * @param {{achievements: (since: string|null) => Promise<object>}} opts.site
 * @param {() => object} opts.getSettings
 * @param {{read: () => Promise<any>, write: (value: object) => Promise<boolean>}} opts.store
 * @param {object} [opts.timers]
 * @param {() => number} [opts.now]
 */
export function createUnlocks({ doc, site, getSettings, store, timers = doc.defaultView || globalThis, now = Date.now }) {
  const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);
  let state = cleanState(null);
  let notBefore = 0;
  let asking = null;
  let hideTimer = null;
  let generation = 0;
  const changed = new Set();

  const switches = () => ({ ...ACHIEVEMENT_DEFAULTS, ...getSettings()?.achievements });
  const save = () => store.write(state).catch(() => false);

  function hide() {
    timers.clearTimeout(hideTimer);
    hideTimer = null;
    doc.getElementById(TOAST_ID)?.remove();
  }

  /** The toast: the first new achievement, and how many more came with it. */
  function show(unlocked, url) {
    hide();
    addStyle(doc);
    const first = unlocked[0];
    const more = unlocked.length - 1;
    const close = h('button', { type: 'button', class: `${P}-unlock-x`, 'aria-label': 'Close' }, '✕');
    const toast = h('div', { id: TOAST_ID, role: 'status', 'aria-live': 'polite', 'data-ttc-own': '' },
      h('span', { class: `${P}-unlock-eyebrow` }, first.hidden ? 'Hidden achievement found' : 'Achievement unlocked'),
      h('span', { class: `${P}-unlock-name` }, first.name,
        first.tier ? h('span', { class: `${P}-unlock-tier` }, tierName(first.tier)) : null),
      first.sentence ? h('span', null, first.sentence) : null,
      h('span', { class: `${P}-unlock-links` },
        h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, more > 0 ? `See all ${unlocked.length}` : 'See it and share'),
        more > 0 ? h('span', null, `and ${more} more`) : null),
      close);
    close.addEventListener('click', hide);
    // It stays while the pointer or focus is on it, and goes on its own otherwise.
    const wait = () => {
      timers.clearTimeout(hideTimer);
      hideTimer = timers.setTimeout(hide, SHOW_MS);
    };
    toast.addEventListener('mouseenter', () => timers.clearTimeout(hideTimer));
    toast.addEventListener('mouseleave', wait);
    toast.addEventListener('focusin', () => timers.clearTimeout(hideTimer));
    toast.addEventListener('focusout', wait);
    (doc.body || doc.documentElement).append(toast);
    wait();
  }

  async function ask(loc) {
    const started = generation;
    const result = await site.achievements(state.cursor);
    if (started !== generation) return;
    if (result.status === 'wait') {
      notBefore = now() + result.retryMs;
      return;
    }
    if (result.status !== 'ok') return;
    const first = state.cursor === null;
    const silenced = typeof result.silenced === 'boolean' ? result.silenced : state.silenced;
    state = { cursor: result.cursor ?? state.cursor, readAt: now(), featured: result.featured, silenced };
    if (silenced) hide();
    save();
    changed.forEach((fn) => fn());
    // The first read only marks where the next one starts.
    if (!first && !silenced && result.unlocked.length && switches().toast && !NEVER.some((route) => matchRoute(route, loc))) {
      show(result.unlocked, result.url);
    }
  }

  return {
    /** Reads what's stored; call once at boot. */
    async load() {
      try {
        state = cleanState(await store.read(), now());
      } catch {
        state = cleanState(null);
      }
    },
    /** On every location change: asks if both are due, never on the attack page. */
    update(loc) {
      const on = switches();
      if (!on.toast && !on.featured) return;
      if (asking || doc.visibilityState === 'hidden' || NEVER.some((route) => matchRoute(route, loc))) return;
      if (now() - state.readAt < READ_EVERY_MS || now() < notBefore) return;
      asking = ask(loc).catch(() => {}).finally(() => { asking = null; });
    },
    /** Whether the player's off switch on torn-tracker.com silences the companion's toasts. */
    silenced: () => state.silenced,
    /** The featured achievements for the settings header; empty when switched off. */
    featured: () => (switches().featured ? state.featured : []),
    /** Called when the featured list changes, so the settings header can redraw. */
    onChange(fn) {
      changed.add(fn);
      return () => changed.delete(fn);
    },
    /** After "Forget me". */
    reset() {
      generation += 1;
      hide();
      state = cleanState(null);
      notBefore = 0;
      changed.forEach((fn) => fn());
    },
    /** Waits for a read in flight; for tests. */
    settled: () => asking || Promise.resolve(),
    destroy() {
      generation += 1;
      hide();
      changed.clear();
    },
  };
}
