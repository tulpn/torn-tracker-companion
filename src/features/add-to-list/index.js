// Add to list on profiles (CMP-110, hq #391; the read and the call are CAPI-037).
//
// On a player's profile, beside the heading, a split button. The main part adds the
// player to the list you last added to ("Add to Chain targets"); the arrow opens a menu of
// your lists, and the faction lists you may edit, each ticked when the player is on it. A
// click on a list adds them, or takes them off a ticked one. "Manage lists" opens the
// lists on torn-tracker.com.
//
// One click is one call to torn-tracker.com and never a game action. Nothing is read from
// the profile but its id. The menu is read once per profile view and kept 5 minutes; a
// change drops it, so the next opening reads it again. Without a script key with the
// lists scope, the button says so and links to the settings.

import { SITE } from '../../hosts.js';
import { el } from '../../core/dom.js';
import { onSubjectPage, pageSubject } from '../../core/players.js';
import { bar, button, note } from '../../core/ui.js';
import { HEADING } from '../ff-badges/selectors.js';

const MARK = 'ttc-lists';
export const KEYS_HREF = '/index.php#/torn-tracker/keys';
export const MANAGE_URL = `${SITE}/lists/`;
const SETTLE_MS = 250;

/** What each refusal tells the player. */
export const SAY = Object.freeze({
  not_yours: 'That list isn\'t yours to change.',
  busy: 'torn-tracker.com is busy. Try again in a minute.',
  failed: 'That didn\'t work. Try again later.',
  no_key: 'Your script key can\'t change lists. Add a key with the lists scope.',
});

let state = null;

const plural = (n) => `${n} ${n === 1 ? 'list' : 'lists'}`;

/**
 * The main button's words and what a press does, from the menu as last read.
 * @returns {{text: string, act: 'add'|'menu'|'retry', list: object|null}}
 */
export function mainAction(menu) {
  if (!menu || menu.status !== 'ok') return { text: 'Lists: try again', act: 'retry', list: null };
  const on = menu.lists.filter((l) => l.contains).length;
  const last = menu.lists.find((l) => l.uuid === menu.lastUsed) || null;
  if (last && !last.contains) return { text: `Add to ${last.name}`, act: 'add', list: last };
  if (on > 0) return { text: `On ${plural(on)}`, act: 'menu', list: null };
  return { text: 'Add to a list', act: 'menu', list: null };
}

export default {
  id: 'add-to-list',
  wave: 3,
  title: 'Add to list',
  area: 'war',
  guide: 'add-to-list',
  summary: 'A button on profiles that adds the player to one of your torn-tracker.com target lists.',
  routes: ['profiles.php'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null, stopWatching: null, asking: null, menu: null, open: false, stale: false, busy: false };
    state = s;
    const alive = () => state === s;
    const stop = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    function say(words) {
      const line = doc.querySelector(`.${MARK}-note`);
      if (line) line.textContent = words;
    }

    /** The menu under the button: one entry per list, ticked when the player is on it. */
    function menuNode(id) {
      const items = s.menu.lists.map((list) => {
        const item = button(doc, {
          cls: `${MARK}-item`, tone: list.contains ? 'good' : undefined,
          attrs: { 'aria-pressed': String(list.contains), title: list.contains ? 'Take them off this list' : 'Add them to this list' },
        }, `${list.contains ? '✓ ' : ''}${list.name}`, list.shared ? ' (faction)' : '');
        item.addEventListener('click', (event) => {
          stop(event);
          change(id, list, list.contains ? 'remove' : 'add');
        });
        return item;
      });
      const manage = el('a', { href: MANAGE_URL, target: '_blank', rel: 'noopener noreferrer', class: `${MARK}-manage`, ownerDocument: doc }, 'Manage lists');
      return bar(doc, { cls: `${MARK}-menu` }, ...(items.length ? items : [note(doc, {}, 'You have no lists yet.')]), manage);
    }

    /** Builds the split button (or the key link) from what the site said. */
    function render(heading, id) {
      for (const node of doc.querySelectorAll(`.${MARK}`)) node.remove();
      if (s.menu?.status === 'no_key') {
        const link = el('a', { href: KEYS_HREF, class: `${MARK} ${MARK}-key ttc-ui-button`, title: 'Lists need a script key with the lists scope.', ownerDocument: doc },
          'Add your script key');
        heading.after(link);
        return;
      }
      const action = mainAction(s.menu);
      const main = button(doc, { cls: `${MARK}-main`, attrs: { disabled: s.busy } }, action.text);
      main.addEventListener('click', (event) => {
        stop(event);
        if (s.busy) return;
        if (action.act === 'add') change(id, action.list, 'add');
        else if (action.act === 'retry') reread(heading, id);
        else toggle(heading, id);
      });
      const arrow = button(doc, { cls: `${MARK}-arrow`, attrs: { 'aria-expanded': String(s.open), 'aria-label': 'Your lists', disabled: s.busy } }, '▾');
      arrow.addEventListener('click', (event) => {
        stop(event);
        if (!s.busy) toggle(heading, id);
      });
      const group = el('span', { class: `${MARK} ${MARK}-group`, ownerDocument: doc }, main, arrow, note(doc, { cls: `${MARK}-note` }));
      group.dataset.player = String(id);
      heading.after(group);
      if (s.open && s.menu?.status === 'ok') (heading.closest('.content-title') || heading).after(el('div', { class: MARK, ownerDocument: doc }, menuNode(id)));
    }

    /** Opens or closes the menu; after a change, opening it reads the lists again. */
    async function toggle(heading, id) {
      s.open = !s.open;
      if (s.open && s.stale) {
        await reread(heading, id);
        return;
      }
      render(heading, id);
    }

    async function reread(heading, id) {
      s.busy = true;
      render(heading, id);
      const menu = await ctx.site.lists(id);
      if (!alive()) return;
      s.busy = false;
      s.stale = false;
      s.menu = { ...menu, id };
      render(heading, id);
      if (menu.status !== 'ok') say(SAY[menu.status] || SAY.failed);
    }

    /** One press: one call, then the button shows where the player is now. */
    async function change(id, list, action) {
      const heading = doc.querySelector(HEADING);
      if (!heading || s.busy) return;
      s.busy = true;
      render(heading, id);
      const got = await ctx.site.listEntry(list.uuid, id, action);
      if (!alive()) return;
      s.busy = false;
      s.stale = true;
      let words;
      if (got.ok) {
        s.menu = {
          ...s.menu,
          lastUsed: got.state === 'on' ? list.uuid : s.menu.lastUsed,
          lists: s.menu.lists.map((l) => (l.uuid === list.uuid ? { ...l, contains: got.state === 'on' } : l)),
        };
        const on = s.menu.lists.filter((l) => l.contains).length;
        words = `${got.state === 'on' ? 'Added to' : 'Taken off'} ${list.name}. On ${plural(on)}.`;
      } else if (got.error === 'not_yours') {
        // The list is gone or read-only now: the menu drops it until the next read.
        const lists = s.menu.lists.filter((l) => l.uuid !== list.uuid);
        s.menu = { ...s.menu, lists, lastUsed: lists.some((l) => l.uuid === s.menu.lastUsed) ? s.menu.lastUsed : null };
        words = SAY.not_yours;
      } else if (got.error === 'no_key') {
        s.menu = { status: 'no_key', lists: [], lastUsed: null, id };
        s.open = false;
      } else {
        words = SAY[got.error] || SAY.failed;
      }
      const now = doc.querySelector(HEADING);
      if (!now) return;
      render(now, id);
      if (words) say(words);
    }

    async function look() {
      const id = pageSubject(win.location);
      if (!id || !onSubjectPage(win.location)) return;
      const heading = doc.querySelector(HEADING);
      if (!heading || doc.querySelector(`.${MARK}`) || s.asking === id) return;
      if (s.menu?.id === id) {
        render(heading, id);
        return;
      }
      s.asking = id;
      const menu = await ctx.site.lists(id);
      s.asking = null;
      if (!alive()) return;
      s.menu = { ...menu, id };
      const now = doc.querySelector(HEADING);
      if (now && !doc.querySelector(`.${MARK}`)) render(now, id);
    }

    const later = () => {
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => {
        s.timer = null;
        if (alive()) look().catch((err) => ctx.log('add to list', err));
      }, SETTLE_MS);
    };
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (records.every((r) => ctx.dom.ownChange(r, `.${MARK}`))) return;
      later();
    }, doc);
    later();
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    if (s.timer !== null) s.win.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
