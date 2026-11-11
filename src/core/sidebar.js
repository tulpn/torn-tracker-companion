// The Torn Tracker block in Torn's sidebar (CMP-108).
//
// A collapsible block of its own in Torn's sidebar, shaped like Torn's own blocks and
// coloured by the suite's tokens in Torn's theme (WP-UI-8), with a few live facts the
// player would otherwise open the site or Discord for. It has a master switch, and every
// item has its own switch (Settings → Sidebar). An item with nothing to say is left out,
// and the block hides itself when every item is empty.
//
// One read feeds it: GET /api/feeds/me/sidebar with the items switched on (site.sidebar).
// It's asked when the block is opened, then at most once a minute, and only while the
// block is open and the tab is visible. Countdowns tick locally between reads. A redraw of
// Torn's sidebar, a 429 or a failed read never blanks it: the last rows are shown again,
// and a page load inside the minute gets them from the read cache (hq #452). Every link
// is plain navigation (a profile, an attack page, the site): the game action is still the
// player's own click on Torn's page. A local item (the shop price highlighter's count)
// is never asked for: it comes from this page and is shown whatever the read says.
//
// Where it sits is the player's choice on this device (hq #507, D-173): at the top, above
// Torn's Areas (the default), after Areas, after Lists, or at the bottom. A page without
// the chosen place falls back to the next one down, never to nothing.
//
// Facts, not code: TornTools (GPLv3) and The Contract look for the sidebar in the same
// two places as core/entry.js.

import { ageCss, ageNode, repaintAges } from './age.js';
import { brandMark } from './brand.js';
import { el, ownChange, settler, shortMoney } from './dom.js';
import { log } from './log.js';
import { SITE } from '../hosts.js';
import { OURS, SIDEBAR } from './entry.js';
import { followTorn } from './tokens.js';
import { onProfitable, profitableCount } from './shops.js';
import { watchLine } from './rota.js';

const P = 'ttc';
export const BLOCK_ID = `${P}-sidebar-block`;
export const READ_EVERY_MS = 60_000;
/** RDB-005: a routine reading older than this says its age. */
const STALE_MS = 90 * 60_000;
/** An answer this old says it may be out of date (hq #606, hq #687): two missed reads. */
export const AGED_MS = 2 * 60_000;

/** The items, in the order the block shows them, with the spec's defaults. All Core. */
export const SIDEBAR_ITEMS = Object.freeze([
  { id: 'chain', title: 'Chain', summary: 'Your faction’s chain count and its timeout, counting down.', on: true },
  { id: 'watch', title: 'Chain watch', summary: 'Your chain watch now or next, and a switch for watch mode.', on: true },
  { id: 'war', title: 'Ranked war', summary: 'The score, the target and when the war should end. Only during a war.', on: true },
  { id: 'terms', title: 'War terms', summary: 'The terms your faction agreed for this war, or “NOT TERMED”. Only during a war.', on: true },
  { id: 'partner', title: 'Med-out partner', summary: 'Your partner, linking to their profile. Hidden when you have none.', on: true },
  { id: 'dibs', title: 'My dibs', summary: 'The targets you hold, with time left, linking to each attack page.', on: true },
  { id: 'oc', title: 'Organized crime', summary: 'Your OC and its state, and when it needs you.', on: true },
  { id: 'guide', title: 'Guide', summary: 'Your progress in the Torn Tracker guide, and bonuses to claim.', on: true },
  { id: 'routine', title: 'Routine', summary: 'How many of today’s routine lines are still undone; tap for the list, each linking to its Torn page.', on: true },
  { id: 'travel', title: 'Best travel run', summary: 'Your planner’s best run right now, with its profit per hour.', on: false },
  { id: 'loot', title: 'NPC loot', summary: 'The NPC whose next loot level comes soonest, and when, with the source credited.', on: false },
  { id: 'gym', title: 'Gym', summary: 'How far you are towards your next gym.', on: false },
  { id: 'stocks', title: 'Stock watches', summary: 'How many of your watched stocks crossed their line.', on: false },
  { id: 'shops', title: 'Below shop price', summary: 'On the Item Market: how many listings on screen sell below what a shop pays.', on: true, local: true },
  { id: 'links', title: 'Quick links', summary: 'Your dashboard, the war room and the guide on torn-tracker.com.', on: true },
]);

/** The quick links when the site sends none. */
const LINKS = Object.freeze([
  { label: 'Dashboard', url: `${SITE}/` },
  { label: 'Guide', url: `${SITE}/guide/` },
]);
const GUIDE_URL = `${SITE}/guide/`;
const FACTION_URL = `${SITE}/faction/`;
const PLANNER_URL = `${SITE}/travel/`;
const STOCKS_URL = `${SITE}/stocks/`;
// hq #541: Torn's own pages for the war and OC lines; plain links, same tab, nothing fetched.
// The feed now sends the war's id (CAPI-039), but Torn has a page by id only for a finished
// war (the rank report); a matched or running war lives on the faction's ranked-war tab,
// which is what Torn's own war list links to as well.
export const WAR_PAGE = '/factions.php?step=your#/war/rank';
export const CRIMES_PAGE = '/factions.php?step=your#/tab=crimes';
export const SHARING_PAGE = '/index.php#/torn-tracker/sharing';

const STYLE = `
  ${followTorn(`#${BLOCK_ID}`)}
  #${BLOCK_ID}[data-position="top"] { margin: 0 0 8px; }
  #${BLOCK_ID} { margin-top: 8px; font: 12px/1.4 var(--tt-font-sans); color: var(--card-foreground); }
  #${BLOCK_ID} .${P}-sb-head {
    display: flex; align-items: center; gap: 6px; width: 100%; min-height: 32px; padding: 0 8px; border: 0; cursor: pointer;
    border-radius: var(--radius) var(--radius) 0 0; background: var(--card); color: inherit;
    font: 700 13px/1 var(--tt-font-sans); text-align: left;
  }
  #${BLOCK_ID} .${P}-sb-head:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
  /* The mark stands where the accent bar was (hq BRAND-050). */
  #${BLOCK_ID} .${P}-sb-mark { flex: none; width: 16px; height: 16px; display: block; }
  #${BLOCK_ID} .${P}-sb-head::after { content: "▾"; margin-left: auto; transition: transform var(--motion-fast) var(--ease-out); }
  #${BLOCK_ID}[data-open="false"] .${P}-sb-head { border-radius: var(--radius); }
  #${BLOCK_ID}[data-open="false"] .${P}-sb-head::after { transform: rotate(-90deg); }
  #${BLOCK_ID}[data-open="false"] .${P}-sb-body { display: none; }
  #${BLOCK_ID} .${P}-sb-body {
    padding: 4px 8px 6px; border-radius: 0 0 var(--radius) var(--radius); background: var(--card);
    border-top: 1px solid var(--border);
  }
  #${BLOCK_ID} .${P}-sb-row { padding: 3px 0; overflow-wrap: anywhere; }
  #${BLOCK_ID} .${P}-sb-row + .${P}-sb-row { border-top: 1px dashed var(--border); }
  #${BLOCK_ID} .${P}-sb-row b { font-weight: 700; }
  #${BLOCK_ID} .${P}-sb-row a { color: var(--ring); text-decoration: none; }
  #${BLOCK_ID} .${P}-sb-row a:hover { text-decoration: underline; }
  #${BLOCK_ID} .${P}-sb-ext { font-size: 0.85em; }
  #${BLOCK_ID} .${P}-sb-muted { color: var(--muted-foreground); }
  ${ageCss(`#${BLOCK_ID} .${P}-sb-age`)}
  #${BLOCK_ID} .${P}-sb-alert { color: color-mix(in srgb, var(--destructive) 65%, var(--foreground)); font-weight: 700; }
  #${BLOCK_ID} .${P}-sb-links a { margin-right: 10px; }
  #${BLOCK_ID} .${P}-sb-routine {
    display: inline-flex; align-items: center; gap: 6px; padding: 0; border: 0; cursor: pointer;
    background: transparent; color: inherit; font: inherit;
  }
  #${BLOCK_ID} .${P}-sb-routine:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  #${BLOCK_ID} .${P}-sb-badge {
    min-width: 18px; padding: 0 5px; border-radius: 999px; text-align: center;
    background: var(--primary); color: var(--primary-foreground); font: 700 12px/18px var(--tt-font-sans);
  }
  #${BLOCK_ID} .${P}-sb-list { margin: 2px 0 0; padding: 0 0 0 14px; }
  #${BLOCK_ID} .${P}-sb-list li { padding: 1px 0; }
  #${BLOCK_ID} .${P}-sb-switch {
    margin-left: 6px; padding: 1px 8px; border: 1px solid var(--border); border-radius: 999px; cursor: pointer;
    background: transparent; color: inherit; font: 600 13px/1.5 var(--tt-font-sans);
  }
  #${BLOCK_ID} .${P}-sb-switch[aria-pressed="true"] { background: var(--primary); color: var(--primary-foreground); border-color: var(--primary); }
  #${BLOCK_ID} .${P}-sb-switch, #${BLOCK_ID} .${P}-sb-state { white-space: nowrap; }
  #${BLOCK_ID} .${P}-sb-state { font-weight: 400; }
  @media (pointer: coarse) {
    #${BLOCK_ID} .${P}-sb-head { min-height: 44px; }
    #${BLOCK_ID} .${P}-sb-links a { display: inline-flex; align-items: center; min-height: 44px; }
    #${BLOCK_ID} .${P}-sb-switch, #${BLOCK_ID} .${P}-sb-routine { min-height: 44px; }
    #${BLOCK_ID} .${P}-sb-list li { padding: 6px 0; }
  }
`;

function addStyle(doc) {
  if (doc.getElementById(`${P}-sidebar-style`)) return;
  const style = el('style', { id: `${P}-sidebar-style`, ownerDocument: doc });
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/** 2:31, 1:02:09: time left on a countdown. */
export function left(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "3h 20m", "12m": a rough time until. */
export function roughly(ms) {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m >= 60) return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
  return `${m}m`;
}

const thousands = (n) => n.toLocaleString('en-US');
const short = shortMoney;

/** The items the read is asked for: switched on, not the static quick links, not local. */
export function askedItems(settings) {
  const sb = settings?.sidebar;
  if (!sb?.enabled) return [];
  return SIDEBAR_ITEMS.filter((item) => item.id !== 'links' && !item.local && sb.items?.[item.id] === true).map((item) => item.id);
}

/** Where the block can sit, top to bottom, with the settings page's words. */
export const POSITIONS = Object.freeze(['top', 'areas', 'lists', 'bottom']);
export const DEFAULT_POSITION = 'top';
export const POSITION_LABELS = Object.freeze({
  top: 'At the top, above Areas',
  areas: 'After Areas',
  lists: 'After Lists',
  bottom: 'At the bottom',
});

/** The items that need a faction the site manages: the empty-state line's case (hq #507). */
/**
 * The NPC whose next loot level comes soonest; with no time to come, the first in the list.
 * @param {{ name: string, level: number, nextAt: number|null }[]} npcs at least one
 * @param {number} at now, in ms
 */
export function nextLoot(npcs, at) {
  const coming = npcs.filter((n) => n.nextAt !== null && n.nextAt > at);
  return coming.length ? coming.reduce((a, b) => (b.nextAt < a.nextAt ? b : a)) : npcs[0];
}

const FACTION_ITEMS = Object.freeze(['chain', 'war', 'dibs', 'loot']);

/** One of Torn's sidebar entries (Friends, Enemies, Targets under Lists). */
const ENTRY = "[id^='nav-'], [class*='area-desktop'], [class*='area-mobile']";

/**
 * Where the block goes: after Torn's Lists, or after Areas when Lists can't be found.
 * On the captured desktop sidebar (2026-10-23) Lists isn't a wrapper: it's a header with
 * the h2 "Lists", followed by its entries as siblings. So the block goes after the last
 * of those entries; where Lists is a wrapper, it has no such siblings, and the block
 * goes after the wrapper.
 */
export function anchorOf(doc) {
  const areas = doc.querySelector(SIDEBAR);
  if (!areas) return null;
  return listsAnchor(doc, areas) || areasBlockOf(doc, areas);
}

const scopeOf = (doc) => doc.querySelector('#sidebarroot') || doc.querySelector('#sidebar') || doc.body;

/** The h2 (or header) that says "Lists", or undefined. */
const listsHeadingIn = (scope) => [...scope.querySelectorAll('h2, h3, [class*="title"], [class*="header"]')]
  .find((n) => n.children.length === 0 && n.textContent.trim() === 'Lists');

/**
 * Torn's Areas block: the wrapper of Areas' links, climbed to the outermost wrapper that
 * still holds only Areas, so the blocks beside it are Torn's other sidebar blocks.
 */
function areasBlockOf(doc, areas) {
  const scope = scopeOf(doc);
  const heading = listsHeadingIn(scope);
  let block = areas.closest("[class*='sidebar-block'], [class*='toggle-block']") || areas;
  // Without Torn's #sidebar (PDA's menu) there is nothing safe to climb to.
  if (scope === doc.body) return block;
  while (block.parentElement && block.parentElement !== scope
    && !(heading && block.parentElement.contains(heading))) block = block.parentElement;
  return block;
}

/** The last of Lists' entries, or the Lists block; null when the page has no Lists. */
function listsAnchor(doc, areas) {
  const scope = scopeOf(doc);
  const heading = listsHeadingIn(scope);
  if (heading) {
    // Climb until the next step up would also hold Areas: that's the Lists header or block.
    let block = heading;
    while (block.parentElement && block.parentElement !== scope && !block.parentElement.contains(areas)) block = block.parentElement;
    if (!block.contains(areas)) {
      let last = block;
      for (let n = block.nextElementSibling; n; n = n.nextElementSibling) {
        if (n.id === BLOCK_ID) continue;
        if (!n.matches(ENTRY)) break;
        last = n;
      }
      return last;
    }
  }
  return null;
}

/**
 * Where the block goes for a position (hq #507): the node it goes next to, whether it
 * goes before or after it, and the position that was used. A position the page can't
 * give falls back to the next one down; null only when Torn's Areas isn't there yet.
 * @param {Document} doc
 * @param {string} position  one of POSITIONS; anything else counts as the default
 * @returns {{anchor: Element, before: boolean, position: string}|null}
 */
export function placementOf(doc, position = DEFAULT_POSITION) {
  const areas = doc.querySelector(SIDEBAR);
  if (!areas) return null;
  const block = areasBlockOf(doc, areas);
  const start = POSITIONS.includes(position) ? POSITIONS.indexOf(position) : 0;
  for (const at of POSITIONS.slice(start)) {
    if (at === 'top') return { anchor: block, before: true, position: at };
    if (at === 'areas') return { anchor: block, before: false, position: at };
    if (at === 'lists') {
      const lists = listsAnchor(doc, areas);
      if (lists) return { anchor: lists, before: false, position: at };
    }
    if (at === 'bottom') {
      // The last of the blocks beside Areas, leaving ours out.
      let last = block;
      for (let n = block.nextElementSibling; n; n = n.nextElementSibling) {
        if (n.id !== BLOCK_ID) last = n;
      }
      return { anchor: last, before: false, position: at };
    }
  }
  return null;
}

/** How the console names a node of Torn's sidebar: its id, else its first class. */
function nameOf(node) {
  if (node.id) return `#${node.id}`;
  const first = String(node.getAttribute('class') || '').split(/\s+/)[0];
  return first ? `.${first}` : node.tagName.toLowerCase();
}

/**
 * The console line for a read (hq #488): which items came back with something to show
 * and which the site sent empty, so "the block shows only Watch" can be told apart from
 * "the block is broken".
 */
export function readLine(want, result) {
  if (result.status !== 'ok') return `sidebar: read ${result.status}`;
  const full = want.filter((id) => result.items.get(id));
  const empty = want.filter((id) => !result.items.get(id));
  return `sidebar: read ok: ${full.length ? full.join(', ') : 'nothing'} to show`
    + (empty.length ? `; empty from the site: ${empty.join(', ')}` : '');
}

/**
 * @param {object} opts
 * @param {Document} opts.doc
 * @param {object} opts.site                  core/site.js
 * @param {() => object} opts.getSettings
 * @param {(handler: Function, doc: Document) => () => void} opts.onMutation
 * @param {{read: Function, write: Function}} opts.store  the block's open state on this device
 * @param {object} [opts.timers]
 * @param {() => number} [opts.now]
 * @param {object} [opts.watch]               core/watch.js's controller, for the line's switch
 * @param {(item: object|null) => void} [opts.onWatch]  each answer's `watch` item (CHW-026)
 */
export function mountSidebarBlock({
  doc = globalThis.document, site, getSettings, onMutation, store, timers = doc.defaultView || globalThis, now = Date.now,
  watch = null, onWatch = null, sharingPaused = () => false,
}) {
  addStyle(doc);
  const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);

  /** null until the player opens or closes it: then the default for where it sits. */
  let openState = null;
  let block = null;
  /** The last answer: status, items, links, and when it came (`at`, when known). */
  let answer = null;
  let lastAsked = 0;
  let notBefore = 0;
  /** Until when torn-tracker.com asked every read to wait (a 429's Retry-After, hq #721). */
  let pausedUntil = 0;
  let readTimer = null;
  let tick = null;
  let stopped = false;
  let routineOpen = false;
  // hq #488: what the console last said about placing, reading and hiding, so that a
  // reason is said once when it changes, not on every redraw.
  const said = new Map();
  const say = (topic, text) => {
    if (said.get(topic) === text) return;
    said.set(topic, text);
    log(text);
  };

  store.read().then((saved) => {
    if (typeof saved?.open === 'boolean' && openState === null) {
      openState = saved.open;
      place();
    }
  }).catch(() => {});

  /** On a phone or in PDA's slide-out the block starts closed; on a desktop, open. */
  const isOpen = () => openState ?? !doc.querySelector('.areasWrapper');
  const enabled = () => getSettings()?.sidebar?.enabled === true;

  function row(...children) {
    return h('div', { class: `${P}-sb-row` }, ...children);
  }

  // A link to torn-tracker.com opens a new tab, and says so with ↗ and its title; Torn's own
  // pages open in the same tab, as before (hq #557 C22).
  const link = (href, text, external = false) => (external
    ? h('a', { href, target: '_blank', rel: 'noopener noreferrer', title: 'Opens torn-tracker.com in a new tab' },
      text, h('span', { class: `${P}-sb-ext`, 'aria-hidden': 'true' }, ' ↗'))
    : h('a', { href }, text));
  /**
   * A countdown to a time the site sent (hq #541): "prefix 1:02:09" until it passes, then
   * the word for done ("ready", "expired") until the next read says what happened.
   */
  const until = (at, done = '0:00', prefix = '') => h('span', {
    'data-ttc-until': String(at), 'data-ttc-done': done, 'data-ttc-prefix': prefix,
  }, countdown(at, done, prefix));
  const countdown = (at, done, prefix) => (at > now() ? `${prefix}${left(at - now())}` : done);

  /** One line per item with something to say; an item without is left out. */
  const LINES = {
    chain: (c) => (c.current === 0
      ? row(h('b', null, 'Chain'), ' none')
      : row(h('b', null, 'Chain'), ` ${thousands(c.current)} / ${thousands(c.max)}`, ...(c.timeoutAt ? [' · ', until(c.timeoutAt, 'timed out')] : []))),
    war(w) {
      const diff = w.ours - w.theirs;
      return row(h('b', null, link(WAR_PAGE, 'Ranked war')), ` vs ${w.opponent}: `,
        h('span', { class: diff < 0 ? `${P}-sb-alert` : '' }, `${diff >= 0 ? '+' : '−'}${thousands(Math.abs(diff))}`),
        ` · ${thousands(w.ours)} / ${thousands(w.target)}`,
        // Matched: count down to the start (CAPI-039); running: to the finish estimate.
        ...(w.state === 'matched' && w.startsAt ? [' · ', until(w.startsAt, 'starting', 'starts in ')]
          : w.finishAt ? [' · ', until(w.finishAt, 'ending', 'ends in ~')] : []));
    },
    // CHW-011, CHW-021: "Watching now · Lead", the next slot, or a way to sign up; and the
    // switch for watch mode, which any member may use, slot or not. hq #523: with no slot
    // held and no watch open, the row is left out, unless watch mode is on (its way off).
    watch(w) {
      if (!w.now && !w.next && !w.open && !watch?.isOn()) return null;
      const text = watchLine(w);
      const words = w.now || w.next ? h('span', { class: w.now ? `${P}-sb-alert` : '' }, ` ${text}`)
        : [' ', link('/index.php#/torn-tracker/watch', text)];
      const gaps = w.gaps ? h('span', { class: `${P}-sb-muted` }, ` · ${w.gaps} without a Lead`) : null;
      return row(h('b', null, 'Watch'), ...[words].flat(), gaps, watchSwitch());
    },
    terms: (t) => row(h('b', null, 'Terms'), ` ${t.label}`),
    partner: (p) => row(h('b', null, 'Med-out partner'), ' ', link(`/profiles.php?XID=${p.id}`, p.name)),
    dibs: (rows) => row(h('b', null, 'My dibs'), ...rows.flatMap((d, i) => [
      i ? ' · ' : ' ', link(`/page.php?sid=attack&user2ID=${d.id}`, d.name), ' ', until(d.expiresAt, 'expired')])),
    // hq #541: the line opens the crimes tab; a crime in planning counts down to ready_at.
    // An unstarted crime past its expiry reads expired (CAPI-039), and one with no ready time
    // counts down to it; the next read says what Torn did with it.
    oc(o) {
      const unstarted = o.state === 'recruiting' || o.state === 'planning';
      const expired = unstarted && o.expiredAt && o.expiredAt <= now();
      const counting = !expired && o.readyAt && (o.state === 'planning' || o.state === 'ready');
      const state = expired ? 'expired' : counting ? until(o.readyAt, 'ready', 'ready in ')
        : unstarted && o.expiredAt ? until(o.expiredAt, 'expired', 'expires in ') : o.state;
      return row(h('b', null, link(CRIMES_PAGE, 'OC')), ` ${o.name} · `,
        ...(o.needsMe ? [h('span', { class: `${P}-sb-alert` }, 'needs you'), ...(state !== o.state ? [' · ', state] : [])] : [state]));
    },
    guide: (g) => (g.done >= g.total && g.bonuses === 0 ? null
      : row(link(GUIDE_URL, `Guide ${g.done} / ${g.total}`, true),
        g.bonuses ? ` · ${g.bonuses} bonus${g.bonuses === 1 ? '' : 'es'} to claim` : '')),
    // Only the country is the link, so the rest of the line reads as plain words (C22).
    travel: (r) => row(h('b', null, 'Travel'), ' ',
      link(PLANNER_URL, r.country.replace(/-/g, ' '), true), ` · ${r.item_name} · +${short(r.profit_per_hour)}/h`),
    // Only the next NPC to reach a new level; the full list is on the site (hq #557 17).
    loot: (l) => {
      const n = nextLoot(l.npcs, now());
      return row(h('b', null, 'Loot'), ` ${n.name} L${n.level}${n.nextAt ? ` → L${n.level + 1} in ${roughly(n.nextAt - now())}` : ''}`,
        h('span', { class: `${P}-sb-muted` }, ` (${l.source})`));
    },
    gym: (g) => row(h('b', null, 'Gym'), g.nextGym === null ? ' every gym unlocked' : ` ${Math.round(g.percent)}% to ${g.nextGym}`),
    routine: (r) => routineLine(r),
    stocks: (s) => row(link(STOCKS_URL, `${s.crossed} of ${s.watched} watched stocks crossed`, true)),
  };

  /**
   * RDB-081: "Routine [3] left today", and the undone lines on tap, each linking to its
   * Torn page in the same tab (RDB-004). A reading older than 90 minutes says its age
   * (RDB-005). Open or closed is kept while the page stays open.
   */
  function routineLine(r) {
    if (r.keyNeeded) return row(h('b', null, 'Routine'), ' ', link(r.url, 'add your API key on torn-tracker.com', true));
    if (!r.lines.length) return null;
    if (r.undone === 0) return row(h('b', null, 'Routine'), h('span', { class: `${P}-sb-muted` }, ` all ${r.lines.length} done today`));
    const resets = r.endsAt && r.endsAt > now() ? ` · resets in ${roughly(r.endsAt - now())}` : '';
    const button = h('button', {
      type: 'button', class: `${P}-sb-routine`, 'aria-expanded': String(routineOpen),
      'aria-label': `Routine: ${r.undone} of ${r.lines.length} left today. ${routineOpen ? 'Hide' : 'Show'} the list.`,
    }, h('b', null, 'Routine'), h('span', { class: `${P}-sb-badge` }, String(r.undone)), 'left today');
    button.addEventListener('click', () => {
      routineOpen = !routineOpen;
      render();
    });
    const list = routineOpen ? h('ul', { class: `${P}-sb-list` }, ...r.lines.filter((l) => !l.done).map((l) => h('li', null,
      link(l.href, l.text),
      l.asOf && now() - l.asOf > STALE_MS ? h('span', { class: `${P}-sb-muted` }, ` · ${roughly(now() - l.asOf)} old`) : null)),
    h('li', { class: `${P}-sb-muted` }, `${r.lines.length - r.undone} done · `, link(r.url, 'the full list', true))) : null;
    return row(button, h('span', { class: `${P}-sb-muted` }, resets), list);
  }

  /** Watch mode's switch on the line (CHW-021): the player's own click, nothing else. */
  function watchSwitch() {
    if (!watch) return null;
    const on = watch.isOn();
    // "Watch" and its state in a short word, so the row fits 172 px (hq #557 B16).
    const button = h('button', {
      type: 'button', class: `${P}-sb-switch`, 'aria-pressed': String(on), 'aria-label': 'Watch mode',
      title: `Watch mode is ${on ? 'on' : 'off'}: a big chain timer over the page`,
    }, 'Watch ', h('span', { class: `${P}-sb-state` }, on ? 'on' : 'off'));
    button.addEventListener('click', () => watch.toggle());
    return button;
  }

  function body() {
    const settings = getSettings();
    const want = askedItems(settings);
    const showLinks = settings.sidebar.items.links === true;
    const rows = [];
    // hq #758: ticked kinds are held until the player agrees to the new wording. The line
    // only says so and opens the Sharing screen; agreeing is the player's press there.
    if (sharingPaused(settings)) {
      rows.push(h('div', { class: `${P}-sb-row`, 'data-ttc-sharing-paused': '' },
        h('span', { class: `${P}-sb-alert` }, 'Sharing is paused:'),
        ' what is shared is worded differently since you agreed. ',
        link(SHARING_PAGE, 'Read and agree')));
    }
    // hq #721: the site asked every read to wait; the block says so rather than look stuck.
    if (pausedUntil > now() && want.length) {
      rows.push(h('div', { class: `${P}-sb-row ${P}-sb-muted`, 'data-ttc-paused': '' }, 'Paused, retrying in ',
        h('span', { 'data-ttc-until': String(pausedUntil), 'data-ttc-done': '0:00' }, countdown(pausedUntil, '0:00', ''))));
    }
    if (!answer) {
      if (want.length) rows.push(row(h('span', { class: `${P}-sb-muted` }, 'Loading…')));
    } else if (answer.status === 'no_key' || answer.status === 'refused') {
      rows.push(row(link('/index.php#/torn-tracker/keys', 'Add your script key'), h('span', { class: `${P}-sb-muted` }, ' to see your chain, war and dibs here.')));
    } else if (answer.status !== 'ok') {
      for (const id of want) {
        const item = SIDEBAR_ITEMS.find((i) => i.id === id);
        rows.push(row(h('b', null, item.title), h('span', { class: `${P}-sb-muted` }, ' didn’t load; retrying each minute')));
      }
    } else {
      // hq #507: the site says the account has no faction it manages, and every faction
      // item asked for came back empty for it. Any other empty item stays silent.
      const factionAsked = want.filter((id) => FACTION_ITEMS.includes(id));
      if (answer.factionLinked === false && factionAsked.length && factionAsked.every((id) => !answer.items.get(id))) {
        rows.push(h('div', { class: `${P}-sb-row`, 'data-ttc-no-faction': '' },
          link(FACTION_URL, 'Link your faction on torn-tracker.com', true),
          h('span', { class: `${P}-sb-muted` }, ' to see chain, war and dibs')));
      }
      for (const id of want) {
        const value = answer.items.get(id);
        const line = value ? LINES[id](value) : null;
        if (line) rows.push(line);
      }
    }
    // hq #687: the rows from the site say how old they are; past two missed reads, that
    // they may be out of date. Only under rows: an empty block still hides itself.
    const age = answer?.status === 'ok' && rows.length ? ageNode(doc, {
      at: answer.at, now: now(), staleAfterMs: AGED_MS, cls: `${P}-sb-row ${P}-sb-age`, tag: 'div',
    }) : null;
    if (age) rows.push(age);
    const below = profitableCount();
    if (settings.sidebar.items.shops === true && below > 0) {
      rows.push(row(h('b', null, 'Below shop price'), ` ${thousands(below)} listing${below === 1 ? '' : 's'}`));
    }
    if (showLinks) {
      const links = answer?.status === 'ok' && answer.links.length ? answer.links : LINKS;
      rows.push(h('div', { class: `${P}-sb-row ${P}-sb-links` }, ...links.map((l) => link(l.url, l.label, true))));
    }
    return rows;
  }

  function render() {
    if (!block) return;
    const open = isOpen();
    block.dataset.open = String(open);
    block.querySelector(`.${P}-sb-head`).setAttribute('aria-expanded', String(open));
    const rows = open ? body() : [];
    block.querySelector(`.${P}-sb-body`).replaceChildren(...rows);
    // Open with nothing to show: the block hides itself.
    block.hidden = open && rows.length === 0;
    say('hidden', block.hidden ? 'sidebar: block hidden: every item switched on is empty'
      : `sidebar: block shown ${open ? 'open' : 'closed'}`);
  }

  /** Ticks the countdowns and the age line between reads; nothing else, and nothing is asked. */
  function paint() {
    repaintAges(block, now());
    for (const node of block?.querySelectorAll('[data-ttc-until]') || []) {
      const { ttcUntil, ttcDone, ttcPrefix } = node.dataset;
      const text = countdown(Number(ttcUntil), ttcDone ?? '0:00', ttcPrefix ?? '');
      if (node.textContent !== text) node.textContent = text;
    }
  }

  async function load() {
    const want = askedItems(getSettings());
    if (want.length === 0) {
      answer = { status: 'ok', items: new Map(), links: [] };
      render();
      return;
    }
    lastAsked = now();
    const result = await site.sidebar(want);
    if (stopped) return;
    if (result.status === 'wait' || result.status === 'failed') {
      // A 429 or a failed read says nothing new: the rows already shown stay (hq #452).
      if (result.status === 'wait') notBefore = now() + result.retryMs;
      if (result.status === 'wait' && result.paused) pausedUntil = notBefore;
      // With nothing shown yet, the last answer kept from an earlier page stands in, with its
      // age, rather than "no data" on every row (hq #606).
      if (answer?.status !== 'ok') answer = lastKept() ?? { status: 'failed' };
    } else {
      answer = result;
      if (result.status === 'ok' && result.items.has('watch')) onWatch?.(result.items.get('watch'));
    }
    say('read', readLine(want, result));
    render();
  }

  /** Asks when the block is open, the tab is visible and a minute has passed. */
  const due = () => !stopped && enabled() && isOpen() && block?.isConnected
    && doc.visibilityState !== 'hidden' && now() - lastAsked >= READ_EVERY_MS && now() >= notBefore;

  // The one timer here that reaches the network, through site.sidebar: it asks only
  // while the block is open and the player is looking.
  function refreshSidebar() {
    if (stopped) return;
    if (due()) load().catch(() => {});
    timers.clearTimeout(readTimer);
    readTimer = timers.setTimeout(refreshSidebar, READ_EVERY_MS);
  }

  function toggle() {
    openState = !isOpen();
    store.write({ open: openState }).catch(() => {});
    render();
    if (openState) refreshSidebar();
  }

  function build() {
    const head = h('button', { type: 'button', class: `${P}-sb-head`, 'aria-expanded': 'false', 'data-tour': 'companion-sidebar' },
      brandMark(doc, `${P}-sb-mark`), 'Torn Tracker');
    head.addEventListener('click', toggle);
    return h('div', { id: BLOCK_ID, 'data-ttc-own': '', 'data-open': 'false' }, head, h('div', { class: `${P}-sb-body` }));
  }

  /** The last answer kept from an earlier page, or null; it asks nothing (hq #606). */
  function lastKept() {
    const want = askedItems(getSettings());
    return want.length ? site.lastSidebar?.(want) ?? null : null;
  }

  function place() {
    if (stopped) return;
    if (!enabled()) {
      block?.remove();
      say('place', 'sidebar: block not placed: switched off in Settings');
      return;
    }
    const wanted = getSettings()?.sidebar?.position;
    const spot = placementOf(doc, wanted);
    if (!spot) {
      say('place', "sidebar: block not placed: no anchor (Torn's Areas not found yet)");
      return;
    }
    const { anchor, before } = spot;
    say('place', `sidebar: block placed ${before ? 'before' : 'after'} ${nameOf(anchor)}`
      + (spot.position !== wanted && wanted ? ` (${spot.position}: this page has no place for ${wanted})` : ''));
    if (!block) block = build();
    // A new page draws the last answer at once; the read on its schedule then replaces it.
    if (!answer) answer = lastKept();
    block.dataset.position = spot.position;
    // A copy left behind by a redraw of Torn's sidebar holds old rows and a dead button.
    for (const copy of doc.querySelectorAll(`#${BLOCK_ID}`)) {
      if (copy === block) continue;
      copy.remove();
      log('sidebar: block removed as stale: a copy a redraw left behind');
    }
    if (before ? anchor.previousElementSibling !== block : anchor.nextElementSibling !== block) {
      if (before) anchor.before(block);
      else anchor.after(block);
    }
    render();
    if (isOpen()) refreshSidebar();
  }

  // A redraw that only takes our block out reads as our own change, so a block that is
  // gone is put back whatever the records say. It comes back with the rows it had.
  // A script that keeps changing the sidebar never puts the look off past a second (hq #466).
  const placeSoon = settler(() => place(), 200, { timers });
  const stopWatching = onMutation((records) => {
    if (records.every((r) => ownChange(r, OURS)) && (!block || block.isConnected || !enabled())) return;
    placeSoon.poke();
  }, doc);
  const onVisible = () => {
    if (doc.visibilityState === 'hidden') return;
    paint();
    refreshSidebar();
  };
  doc.addEventListener('visibilitychange', onVisible);
  const stopCounting = onProfitable(() => render());
  const stopWatchMode = watch?.onChange(() => render());
  // The one ticker for every countdown in the block (hq #541): it paints from the page's
  // clock once a second while the block is open and the tab is seen, and asks for nothing.
  tick = timers.setInterval(() => {
    if (isOpen() && doc.visibilityState !== 'hidden') paint();
  }, 1000);
  place();

  return {
    get block() {
      return block;
    },
    /**
     * Settings changed: a switched-off item disappears now; a new one is asked for with
     * the next read, which still waits out its minute.
     */
    update() {
      place();
    },
    place,
    destroy() {
      stopped = true;
      stopWatching?.();
      stopCounting();
      stopWatchMode?.();
      doc.removeEventListener('visibilitychange', onVisible);
      timers.clearTimeout(readTimer);
      placeSoon.cancel();
      timers.clearInterval(tick);
      block?.remove();
    },
  };
}
