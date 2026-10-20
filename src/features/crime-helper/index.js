// Crime helper (CMP-205, display half).
//
// On Crimes 2.0, the crimes header shows your morale, which Torn does not display: 100
// minus the "demoralisation" the page's own responses carry. On burglary, each target
// gets how long it has left before it disappears, so the ones about to go can be cased
// first. Both come from the page's own responses; nothing is asked of any server and
// nothing is clicked.
//
// Inspiration: Crime Morale by tobytorn (MIT, https://github.com/tobytorn/crime-morale),
// which found both fields, and the burglary helpers by NichtGersti and CowBoyCookie (MIT).
// No code was taken.

import { el } from '../../core/dom.js';
import { BURGLARY_ROW, BURGLARY_TITLE, HEADER, isCrimesResponse } from './selectors.js';

const MARK = 'ttc-crime';
const STYLE_ID = 'ttc-crime-style';
const STYLE = `
  .${MARK} { margin-left: 8px; padding: 0 5px; border-radius: 3px; font: 700 11px/16px sans-serif; }
  .${MARK}[data-kind="morale"] { background: #333; color: #ddd; }
  .${MARK}[data-left="long"] { background: #2d6a3e; color: #fff; }
  .${MARK}[data-left="day"] { background: #8a6d1d; color: #fff; }
  .${MARK}[data-left="short"] { background: #8a2d2d; color: #fff; }
`;
const HOUR = 3_600_000;
const SETTLE_MS = 250;

let state = null;

/** `DB.demMod` -> morale 0..100; anything else -> null. */
export function moraleFrom(data) {
  const dem = data?.DB?.demMod;
  return typeof dem === 'number' && Number.isFinite(dem) && dem >= 0 && dem <= 100 ? Math.round(100 - dem) : null;
}

/** `DB.crimesByType.properties` -> title -> expiry in ms; rows that do not fit are left out. */
export function propertiesFrom(data) {
  const out = new Map();
  const list = data?.DB?.crimesByType?.properties;
  for (const p of Array.isArray(list) ? list : []) {
    if (typeof p?.title !== 'string' || !p.title.trim() || p.title.length > 100) continue;
    if (!Number.isInteger(p.expire) || p.expire <= 0) continue;
    out.set(p.title.trim(), p.expire * 1000);
  }
  return out;
}

/** '2d 5h', '7h', '40m'; and how urgent: long (3 days or more), day, short (12 h or less). */
export function lifetime(ms) {
  const h = Math.max(0, ms) / HOUR;
  const text = h >= 48 ? `${Math.floor(h / 24)}d ${Math.floor(h % 24)}h` : h >= 1 ? `${Math.floor(h)}h` : `${Math.floor(h * 60)}m`;
  return { text, left: h >= 72 ? 'long' : h > 12 ? 'day' : 'short' };
}

export default {
  id: 'crime-helper',
  wave: 2,
  title: 'Crimes: morale and burglary targets',
  routes: ['page.php?sid=crimes', 'loader.php?sid=crimes'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: false },
  credits: ['Crime Morale (MIT)'],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const now = () => (typeof ctx.now === 'function' ? ctx.now() : Date.now());
    const s = { doc, win, morale: null, properties: new Map(), timer: null, stopWatching: null, unsubscribe: null };
    state = s;

    if (!doc.getElementById(STYLE_ID)) {
      const style = el('style', { id: STYLE_ID, ownerDocument: doc });
      style.textContent = STYLE;
      doc.head.append(style);
    }

    function badge(parent, kind, text, attrs = {}) {
      let node = parent.querySelector(`:scope > .${MARK}[data-kind="${kind}"]`);
      if (!node) {
        node = el('span', { class: MARK, 'data-kind': kind, ownerDocument: doc });
        parent.append(node);
      }
      if (node.textContent !== text) node.textContent = text;
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      return node;
    }

    function paint() {
      const header = doc.querySelector(HEADER);
      if (header && s.morale !== null) {
        badge(header, 'morale', `Morale ${s.morale}%`).title = 'Your crime morale, from the page (100 minus demoralisation)';
      }
      for (const row of doc.querySelectorAll(BURGLARY_ROW)) {
        const cell = row.querySelector(BURGLARY_TITLE);
        // Rows are recycled as the list scrolls: always match by the title shown now.
        const title = [...(cell?.childNodes || [])]
          .filter((n) => !(n.nodeType === 1 && n.classList.contains(MARK)))
          .map((n) => n.textContent).join(' ').trim();
        const expires = [...s.properties].find(([name]) => title.includes(name))?.[1];
        const old = cell?.querySelector(`:scope > .${MARK}[data-kind="left"]`);
        if (!cell || expires === undefined) {
          old?.remove();
          continue;
        }
        const { text, left } = lifetime(expires - now());
        badge(cell, 'left', text, { 'data-left': left }).title = 'Time before this target disappears';
      }
    }

    s.unsubscribe = ctx.intercept.onJson(isCrimesResponse, ({ data }) => {
      const morale = moraleFrom(data);
      if (morale !== null) s.morale = morale;
      const properties = propertiesFrom(data);
      if (properties.size) s.properties = properties;
      paint();
    }, ctx.win);

    const ours = (r) => [r.target, ...r.addedNodes, ...r.removedNodes]
      .every((n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(`.${MARK}`));
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (records.every(ours)) return;
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => {
        s.timer = null;
        if (state === s) paint();
      }, SETTLE_MS);
    }, doc);
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.unsubscribe?.();
    s.stopWatching?.();
    s.win.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
