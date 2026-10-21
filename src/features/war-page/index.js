// The ranked-war page (CMP-102).
//
// Above the opponents' list, a row of buttons sorts it by what the page already shows:
// status, level, or the fair-fight estimate from torn-tracker.com. Beside each opponent,
// a dibs button shows who in our faction has called them, and pressing it claims or
// releases the target on torn-tracker.com. That is one site action per press; nothing is
// ever done in the game.
//
// Dibs are asked for at most every 15 s, and only while the tab is visible (CMP-102 AC;
// the site allows 4 a minute, CAPI-034). Countdowns tick locally between asks.
//
// Hospital and jail timers and travel destinations are not on the page. They come from
// the site, on the same feed as the dibs: the war room's roster (CAPI-034, the hq #98
// fallback, D-028). Torn War Stuff Enhanced polls the API about the enemy faction for
// them, which #98 rules out; the script makes no Torn read.
//
// For Pro factions, each opponent also shows the danger flags of their latest loadout
// (heavy hitter, armoured, temp ready) and how old it is, from torn-tracker.com's war
// view (LDT-032), asked once per page view. A Core faction sees a one-line note instead.
//
// Inspiration: Torn War Stuff Enhanced by xentac (MIT, greasyfork.org/scripts/529238) and
// its parent Torn War Stuff by tos (MIT): the idea, where the lists and status cells are,
// and that sorting moves Torn's rows rather than copying them. No code was taken.

import { el } from '../../core/dom.js';
import { ENEMY_ROW, LISTS, MEMBER, STATUS } from './selectors.js';
import { ORDERS, comparator, playerOf } from './order.js';

const MARK = 'ttc-war';
const STYLE_ID = 'ttc-war-style';
const STYLE = `
  .${MARK}-bar { display: flex; gap: 4px; align-items: center; margin: 4px 0; font: 12px sans-serif; }
  .${MARK}-bar button, .${MARK}-dibs {
    padding: 1px 6px; border: 1px solid #888; border-radius: 3px; background: #333; color: #ddd;
    font: 11px/16px sans-serif; cursor: pointer;
  }
  .${MARK}-bar button[aria-pressed="true"] { background: #4a6; color: #000; }
  .${MARK}-dibs { margin: 0 4px; min-width: 44px; }
  .${MARK}-dibs[data-state="mine"] { background: #4a6; color: #000; }
  .${MARK}-dibs[data-state="taken"] { background: #a44; color: #fff; cursor: default; }
  .${MARK}-time { margin-left: 4px; font: 700 11px sans-serif; }
  .${MARK}-ld { margin-left: 4px; padding: 0 4px; border-radius: 3px; background: #5a3d2b; color: #fff; font: 700 10px/15px sans-serif; }
  .${MARK}-ld[data-old="true"] { opacity: .55; }
  .${MARK}-note { margin-left: 8px; opacity: .7; font-weight: 400; }
`;
const LABELS = {
  torn: "Torn's order", status: 'Status', leave: 'Out soonest', level: 'Level', ff: 'Fair fight',
};
const SETTLE_MS = 250;
const DIBS_EVERY_MS = 15_000;

const FLAG_WORDS = { heavy_hitter: 'Heavy', armoured: 'Armour', temp_ready: 'Temp' };

let state = null;

/** '40m', '3h', '5d': how long ago a loadout was seen. */
export function ago(ms) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m < 60) return `${m}m`;
  if (m < 48 * 60) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

/** '4:05' for a countdown; '0:00' once it has run out. */
export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * What goes beside Torn's status: a countdown for hospital and jail, where they are
 * flying for travel. Empty when there is nothing to add.
 */
export function statusText(status, now) {
  if (!status) return '';
  const state = status.state.toLowerCase();
  if ((state === 'hospital' || state === 'jail') && status.until) {
    return status.until > now ? clock(status.until - now) : '';
  }
  if (state === 'traveling' || state === 'abroad') {
    const d = status.description;
    let m = /^Returning to Torn from (.+)$/.exec(d);
    if (m) return `← ${m[1]}`;
    m = /^Traveling to (.+)$/.exec(d);
    if (m) return `→ ${m[1]}`;
    m = /^In (.+)$/.exec(d);
    if (m) return `in ${m[1]}`;
  }
  return '';
}

/** The lists holding opponents; our own faction's list is left as Torn has it. */
function enemyLists(doc) {
  return [...doc.querySelectorAll(LISTS)].filter((list) => list.querySelector(ENEMY_ROW));
}

/** Moves Torn's own rows into order; does nothing when they already are. */
export function sortList(list, compare) {
  if (!compare) return false;
  const rows = [...list.children].filter((n) => n.matches(ENEMY_ROW));
  const sorted = [...rows].sort(compare);
  if (sorted.every((row, i) => row === rows[i])) return false;
  const doc = list.ownerDocument;
  const fragment = doc.createDocumentFragment();
  for (const row of sorted) fragment.append(row);
  list.append(fragment);
  return true;
}

function ownNode(node) {
  const element = node?.nodeType === 1 ? node : node?.parentElement;
  return Boolean(element?.closest?.(`[data-${MARK}]`));
}

export default {
  id: 'war-page',
  wave: 1,
  title: 'War page: sorting and dibs',
  routes: ['factions.php#/war/'],
  defaults: {
    enabled: true, sortBy: 'torn', dibs: true, timers: true, loadouts: true,
  },
  options: {
    sortBy: { label: 'Sort opponents by', choices: [...ORDERS] },
    dibs: { label: "Show your faction's dibs" },
    timers: { label: 'Show hospital timers and where opponents are flying' },
    loadouts: { label: "Show opponents' loadout flags (Pro)" },
  },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: ['Torn War Stuff Enhanced (MIT)'],

  start(ctx) {
    const { doc } = ctx;
    const timers = ctx.win || globalThis;
    const s = {
      doc,
      timers,
      order: ORDERS.includes(ctx.settings.sortBy) ? ctx.settings.sortBy : 'torn',
      ff: new Map(),
      /** Each row's place in Torn's own order, the first time it was seen. */
      seen: new WeakMap(),
      seenCount: 0,
      war: false,
      dibs: new Map(),
      roster: new Map(),
      loadouts: null,
      pending: new Set(),
      notes: new Map(),
      scanTimer: null,
      dibsTimer: null,
      tick: null,
      stopWatching: null,
    };
    state = s;
    const alive = () => state === s;
    const showDibs = Boolean(ctx.settings.dibs && ctx.site);
    const showTimers = Boolean(ctx.settings.timers && ctx.site);
    const showLoadouts = Boolean(ctx.settings.loadouts && ctx.site?.warLoadouts);
    const now = () => (typeof ctx.now === 'function' ? ctx.now() : Date.now());

    if (!doc.getElementById(STYLE_ID)) {
      const style = el('style', { id: STYLE_ID, ownerDocument: doc });
      style.textContent = STYLE;
      doc.head.append(style);
    }

    function bar(list) {
      const prev = list.previousElementSibling;
      if (prev?.classList.contains(`${MARK}-bar`)) return prev;
      const node = el('div', { class: `${MARK}-bar`, [`data-${MARK}`]: '', ownerDocument: doc }, 'Sort:');
      for (const order of ORDERS) {
        const button = el('button', { type: 'button', 'data-order': order, ownerDocument: doc }, LABELS[order]);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          s.order = order;
          scan().catch((err) => ctx.log('war page', err));
        });
        node.append(button);
      }
      list.before(node);
      return node;
    }

    async function loadFf(lists) {
      if (s.order !== 'ff' || !ctx.site) return;
      const ids = lists.flatMap((list) => [...list.querySelectorAll(ENEMY_ROW)].map(playerOf))
        .filter((id) => id && !s.ff.has(id));
      if (ids.length === 0) return;
      const found = await ctx.site.ff(ids);
      for (const [id, value] of found) s.ff.set(id, value);
    }

    function render(button, id) {
      const claim = s.dibs.get(id);
      const live = claim && claim.expiresAt > now() ? claim : null;
      const note = s.notes.get(id);
      let text = 'Dibs';
      let title = 'Call dibs: tells your faction on torn-tracker.com that this target is yours for a few minutes';
      let look = 'free';
      if (live?.mine) {
        text = `Mine ${clock(live.expiresAt - now())}`;
        title = 'Your dibs. Press to release them.';
        look = 'mine';
      } else if (live) {
        text = `${live.holder.name} ${clock(live.expiresAt - now())}`;
        title = `${live.holder.name} has dibs on this target`;
        look = 'taken';
      }
      if (note) title = `${note}. ${title}`;
      if (button.textContent !== text) button.textContent = text;
      button.title = title;
      button.dataset.state = look;
      button.disabled = look === 'taken' || s.pending.has(id);
    }

    async function press(id) {
      if (s.pending.has(id)) return;
      const mine = s.dibs.get(id)?.mine && s.dibs.get(id).expiresAt > now();
      s.pending.add(id);
      s.notes.delete(id);
      paint();
      const result = await ctx.site.callDibs(id, mine ? 'release' : 'claim');
      if (!alive()) return;
      s.pending.delete(id);
      if (result.ok || result.error === 'dibs_taken') {
        if (result.dibs) s.dibs.set(id, result.dibs);
        else s.dibs.delete(id);
      }
      const notes = {
        dibs_taken: 'Someone else called dibs first',
        no_war: 'There is no ranked war on torn-tracker.com right now',
        not_in_war: 'This player is not in the war',
        busy: 'torn-tracker.com is busy; try again in a minute',
        no_key: 'Add your torn-tracker.com script key in the settings',
      };
      if (!result.ok) s.notes.set(id, notes[result.error] || 'torn-tracker.com did not answer');
      paint();
    }

    function placeDibs(lists) {
      if (!showDibs || !s.war) return;
      for (const list of lists) {
        for (const row of list.querySelectorAll(ENEMY_ROW)) {
          const id = playerOf(row);
          const cell = row.querySelector(MEMBER);
          if (!id || !cell || cell.querySelector(`.${MARK}-dibs`)) continue;
          const button = el('button', {
            type: 'button', class: `${MARK}-dibs`, [`data-${MARK}`]: '', 'data-player': String(id), ownerDocument: doc,
          });
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            press(id).catch((err) => ctx.log('war page dibs', err));
          });
          cell.append(button);
        }
      }
    }

    function loadoutLabels() {
      if (!showLoadouts || !s.loadouts) return;
      if (!s.loadouts.pro) {
        for (const bar of doc.querySelectorAll(`.${MARK}-bar`)) {
          if (!bar.querySelector(`.${MARK}-note`)) {
            bar.append(el('span', { class: `${MARK}-note`, ownerDocument: doc }, "Opponents' loadouts are a Pro feature"));
          }
        }
        return;
      }
      for (const row of doc.querySelectorAll(ENEMY_ROW)) {
        const cell = row.querySelector(MEMBER);
        const info = s.loadouts.opponents.get(playerOf(row));
        let node = cell?.querySelector(`.${MARK}-ld`);
        if (!cell || !info) {
          node?.remove();
          continue;
        }
        const words = info.hidden ? 'hidden' : [
          ...info.flags.map((f) => FLAG_WORDS[f.flag]),
          info.seen_at ? ago(now() - info.seen_at) : null,
        ].filter(Boolean).join(' · ');
        if (!words) {
          node?.remove();
          continue;
        }
        if (!node) {
          node = el('span', { class: `${MARK}-ld`, [`data-${MARK}`]: '', ownerDocument: doc });
          cell.append(node);
        }
        if (node.textContent !== words) node.textContent = words;
        node.dataset.old = String(info.old);
        node.title = info.hidden ? 'Loadout hidden at the player\u2019s request' : [
          ...info.flags.map((f) => f.reason || FLAG_WORDS[f.flag]),
          `Seen ${info.seen_at ? ago(now() - info.seen_at) : 'some time'} ago by ${info.reporters ?? 'some'} player${info.reporters === 1 ? '' : 's'}${info.old ? ' (old)' : ''} (torn-tracker.com)`,
        ].join('\n');
      }
    }

    /** Once per page view, and only once the player can see the page. */
    function tryLoadouts() {
      if (!showLoadouts || s.loadoutsAsked || doc.visibilityState !== 'visible') return;
      s.loadoutsAsked = true;
      loadLoadouts().catch((err) => ctx.log('war loadouts', err));
    }

    async function loadLoadouts() {
      const answer = await ctx.site.warLoadouts();
      if (!alive() || !answer) return;
      s.loadouts = answer;
      paint();
    }

    function times() {
      if (!showTimers) return;
      for (const row of doc.querySelectorAll(ENEMY_ROW)) {
        const cell = row.querySelector(STATUS);
        if (!cell) continue;
        const text = statusText(s.roster.get(playerOf(row)), now());
        let label = cell.querySelector(`.${MARK}-time`);
        if (!text) {
          label?.remove();
          continue;
        }
        if (!label) {
          label = el('span', { class: `${MARK}-time`, [`data-${MARK}`]: '', ownerDocument: doc });
          cell.append(label);
        }
        if (label.textContent !== text) label.textContent = text;
      }
    }

    function paint() {
      times();
      loadoutLabels();
      for (const button of doc.querySelectorAll(`.${MARK}-dibs`)) render(button, Number(button.dataset.player));
      for (const button of doc.querySelectorAll(`.${MARK}-bar button`)) {
        button.setAttribute('aria-pressed', String(button.dataset.order === s.order));
      }
    }

    async function scan() {
      const lists = enemyLists(doc);
      if (lists.length === 0) return;
      for (const list of lists) bar(list);
      for (const list of lists) {
        for (const row of list.querySelectorAll(ENEMY_ROW)) if (!s.seen.has(row)) s.seen.set(row, s.seenCount++);
      }
      await loadFf(lists);
      if (!alive()) return;
      const compare = comparator(s.order, s.ff, s.roster, now())
        || ((a, b) => (s.seen.get(a) ?? Infinity) - (s.seen.get(b) ?? Infinity));
      for (const list of lists) sortList(list, compare);
      placeDibs(lists);
      paint();
    }

    function later() {
      timers.clearTimeout(s.scanTimer);
      s.scanTimer = timers.setTimeout(() => {
        s.scanTimer = null;
        scan().catch((err) => ctx.log('war page', err));
      }, SETTLE_MS);
    }

    async function loadDibs() {
      const answer = await ctx.site.dibs();
      if (!alive() || !answer) return;
      s.war = answer.war;
      s.dibs = answer.dibs;
      s.roster = answer.roster ?? new Map();
      // A fresh answer supersedes whatever the last press reported.
      s.notes.clear();
      if (!s.war) for (const node of doc.querySelectorAll(`.${MARK}-dibs`)) node.remove();
      placeDibs(enemyLists(doc));
      paint();
      // New leave times can change the order.
      if (s.order === 'leave') later();
    }

    // The one timer here that reaches the network, and a named exception in the rules
    // lint: it asks only while the player is looking at the page.
    function refreshDibs() {
      if (!alive()) return;
      if (doc.visibilityState === 'visible') loadDibs().catch((err) => ctx.log('war page dibs', err));
      s.dibsTimer = timers.setTimeout(refreshDibs, DIBS_EVERY_MS);
    }

    // Our own buttons and countdowns changing are not a reason to look again.
    const ours = (r) => ownNode(r.target)
      || (r.addedNodes.length + r.removedNodes.length > 0 && [...r.addedNodes, ...r.removedNodes].every(ownNode));
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (!records.every(ours)) later();
    }, doc);
    later();
    s.onVisible = tryLoadouts;
    doc.addEventListener('visibilitychange', tryLoadouts);
    tryLoadouts();
    if (showDibs || showTimers) {
      refreshDibs();
      s.tick = timers.setInterval(paint, 1000);
    }
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    s.timers.clearTimeout(s.scanTimer);
    s.timers.clearTimeout(s.dibsTimer);
    s.timers.clearInterval(s.tick);
    if (s.onVisible) s.doc.removeEventListener('visibilitychange', s.onVisible);
    for (const node of s.doc.querySelectorAll(`[data-${MARK}]`)) node.remove();
  },
};
