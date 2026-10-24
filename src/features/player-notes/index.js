// Player notes (CMP-308).
//
// A private note and a coloured tag on any player's profile, shown again on that
// player's profile, beside them in faction member lists and on the attack page. Notes
// are kept only on this device, in the script's settings; nothing is sent anywhere, no
// lookup is made for them, and "Forget me" deletes them. Settings → Data exports and
// imports them as JSON.
//
// The idea is common to Torn Player Notebook and Player Notepad; no code was taken. The
// rows and headings are the fair-fight badges' (ff-badges/selectors.js).

import { el } from '../../core/dom.js';
import { badge, bar as uiBar, button as uiButton, note as uiNote } from '../../core/ui.js';
import { HEADING, ROWS, ROW_LINK } from '../ff-badges/selectors.js';
import { idFromHref } from '../ff-badges/index.js';

const MARK = 'ttc-notes';
/** Each tag and the tone its badge takes. */
export const TAGS = Object.freeze([
  { id: 'friend', label: 'Friend', tone: 'good' },
  { id: 'ally', label: 'Ally', tone: 'info' },
  { id: 'watch', label: 'Watch', tone: 'warn' },
  { id: 'enemy', label: 'Enemy', tone: 'bad' },
  { id: 'note', label: 'Note', tone: 'neutral' },
]);
export const MAX_NOTES = 1000;
export const TEXT = 300;
/** How much of the note the badge carries; the rest is in its tooltip. */
const SHORT = 24;
const SETTLE_MS = 250;

let state = null;

const tagOf = (id) => TAGS.find((t) => t.id === id) || TAGS[TAGS.length - 1];

/** What storage holds is checked field by field: one note per player, at most 1000. */
export function validateNotes(raw) {
  const list = Array.isArray(raw?.notes) ? raw.notes : [];
  const notes = [];
  const seen = new Set();
  for (const n of list) {
    if (!n || typeof n !== 'object' || !Number.isInteger(n.id) || n.id <= 0 || seen.has(n.id)) continue;
    if (!TAGS.some((t) => t.id === n.tag) || typeof n.text !== 'string' || n.text.length > TEXT) continue;
    const at = Number.isInteger(n.at) && n.at > 0 ? n.at : 0;
    seen.add(n.id);
    notes.push({ id: n.id, tag: n.tag, text: n.text, at });
    if (notes.length === MAX_NOTES) break;
  }
  return { notes };
}

/** The notes with one player's set (or removed, with `note` null), newest first. */
export function withNote(data, id, note) {
  const others = validateNotes(data).notes.filter((n) => n.id !== id);
  return { notes: note ? [{ id, ...note }, ...others].slice(0, MAX_NOTES) : others };
}

/** The badge's words: the tag, and the start of the note. */
export function badgeText(note) {
  const tag = tagOf(note.tag).label;
  const text = note.text.trim().replace(/\s+/g, ' ');
  if (!text) return tag;
  return `${tag}: ${text.length > SHORT ? `${text.slice(0, SHORT - 1).trimEnd()}…` : text}`;
}

/** The player a profile or attack page is about. */
function pageSubject(loc) {
  const params = new URLSearchParams(String(loc?.search || ''));
  const id = Number(params.get('XID') || params.get('user2ID'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default {
  id: 'player-notes',
  wave: 3,
  title: 'Player notes',
  area: 'other',
  guide: 'player-notes',
  summary: 'Your own note and tag on a player, shown on their profile, in faction lists and on the attack page.',
  routes: ['profiles.php', 'factions.php', 'page.php?sid=attack', 'loader.php?sid=attack'],
  defaults: { enabled: true },
  data: { empty: { notes: [] }, validate: validateNotes },
  shares: [],
  needs: { apiKey: false, scriptKey: false },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null, stopWatching: null, open: false };
    state = s;
    const alive = () => state === s;
    const notes = () => (ctx.data?.() || { notes: [] }).notes;
    const noteFor = (id) => notes().find((n) => n.id === id) || null;

    function makeBadge(id, note) {
      const node = badge(doc, { cls: `${MARK} ${MARK}-badge`, tone: tagOf(note.tag).tone, attrs: { title: note.text || tagOf(note.tag).label } },
        badgeText(note));
      node.dataset.player = String(id);
      return node;
    }

    function editor(id, heading) {
      const current = noteFor(id);
      const tag = el('select', { class: `${MARK}-tag`, 'aria-label': 'Tag', ownerDocument: doc },
        ...TAGS.map((t) => el('option', { value: t.id, ownerDocument: doc }, t.label)));
      tag.value = current?.tag || 'note';
      const text = el('input', {
        type: 'text', class: `${MARK}-text`, maxlength: String(TEXT), placeholder: 'Your note, only on this device',
        'aria-label': 'Note', ownerDocument: doc,
      });
      text.value = current?.text || '';
      const save = uiButton(doc, { tone: 'good' }, 'Save note');
      const drop = uiButton(doc, {}, 'Delete');
      const node = uiBar(doc, { cls: `${MARK} ${MARK}-editor` }, el('strong', { ownerDocument: doc }, 'Note'), tag, text, save, drop,
        uiNote(doc, { cls: `${MARK}-note` }));
      const say = (words) => { node.querySelector(`.${MARK}-note`).textContent = words; };
      const stop = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      // Our own buttons, pressed by the player; the latest notes are read back from
      // storage first, so a note saved in another tab is kept.
      save.addEventListener('click', async (event) => {
        stop(event);
        const value = { tag: tag.value, text: text.value.slice(0, TEXT), at: Date.now() };
        await ctx.saveData?.((fresh) => withNote(fresh, id, value));
        if (!alive()) return;
        say('Saved on this device.');
        refresh(heading, id);
      });
      drop.addEventListener('click', async (event) => {
        stop(event);
        await ctx.saveData?.((fresh) => withNote(fresh, id, null));
        if (!alive()) return;
        text.value = '';
        say('Deleted.');
        refresh(heading, id);
      });
      return node;
    }

    /** The profile's own badge and button, rebuilt after a save. */
    function refresh(heading, id) {
      for (const node of heading.parentNode?.querySelectorAll(`:scope > .${MARK}-badge, :scope > .${MARK}-toggle`) || []) node.remove();
      const note = noteFor(id);
      const toggle = uiButton(doc, { cls: `${MARK} ${MARK}-toggle`, attrs: { 'aria-expanded': String(s.open) } }, note ? 'Edit note' : 'Add note');
      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        s.open = !s.open;
        toggle.setAttribute('aria-expanded', String(s.open));
        const box = doc.querySelector(`.${MARK}-editor`);
        if (s.open && !box) (heading.closest('.content-title') || heading).after(editor(id, heading));
        else if (!s.open) box?.remove();
      });
      heading.after(...(note ? [makeBadge(id, note)] : []), toggle);
    }

    function look() {
      for (const row of doc.querySelectorAll(ROWS)) {
        if (row.querySelector(`.${MARK}`)) continue;
        const link = row.querySelector(ROW_LINK);
        const id = idFromHref(link?.getAttribute('href'));
        const note = id && noteFor(id);
        if (note) link.after(makeBadge(id, note));
      }
      const id = pageSubject(win.location);
      const page = String(win.location?.pathname || '').split('/').pop();
      if (!id || !['profiles.php', 'page.php', 'loader.php'].includes(page)) return;
      const heading = doc.querySelector(HEADING);
      if (!heading || heading.parentNode?.querySelector(`:scope > .${MARK}`)) return;
      if (page === 'profiles.php') refresh(heading, id);
      else {
        const note = noteFor(id);
        if (note) heading.after(makeBadge(id, note));
      }
    }

    const ours = (r) => ctx.dom.ownChange(r, `.${MARK}`);
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (records.every(ours)) return;
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => alive() && look(), SETTLE_MS);
    }, doc);
    s.timer = win.setTimeout(() => alive() && look(), SETTLE_MS);
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    s.win.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
