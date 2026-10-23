// Crime helper (CMP-205, display half).
//
// On Crimes 2.0, the crimes header shows your morale, which Torn does not display: 100
// minus the "demoralisation" the page's own responses carry. On burglary, each target
// gets how long it has left before it disappears, so the ones about to go can be cased
// first. Both come from the page's own responses. With your script key, each crime option
// also shows its value per nerve: torn-tracker.com's average money and item value per
// nerve, from players' shared outcomes (shown only once at least 20 have reported it).
// Nothing is clicked.
//
// Inspiration: Crime Morale by tobytorn (MIT, https://github.com/tobytorn/crime-morale),
// which found both fields, and the burglary helpers by NichtGersti and CowBoyCookie (MIT).
// No code was taken.

import { el } from '../../core/dom.js';
import {
  BURGLARY_ROW, BURGLARY_TITLE, HEADER, OPTION_ROW, OPTION_TITLE, isCrimesResponse,
} from './selectors.js';
import { badge as uiBadge, setTone } from '../../core/ui.js';

const MARK = 'ttc-crime';
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

/** The crime a crimesData request was about: its typeID, from the address or the form. */
export function typeIdOf(url, form) {
  let id = null;
  try {
    id = new URL(String(url), 'https://www.torn.com').searchParams.get('typeID');
  } catch { /* not an address */ }
  const n = Number(id ?? form?.get?.('typeID'));
  return Number.isInteger(n) && n > 0 ? n : null;
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
  area: 'crimes',
  guide: 'crime-helpers',
  summary: 'Your crime morale, value per nerve, and how long burglary targets have left.',
  routes: ['page.php?sid=crimes', 'loader.php?sid=crimes'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: false },
  credits: ['Crime Morale (MIT)'],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const now = () => (typeof ctx.now === 'function' ? ctx.now() : Date.now());
    const s = {
      doc, win, morale: null, properties: new Map(), timer: null, stopWatching: null, unsubscribe: null,
      typeId: null, values: [], asked: new Set(),
    };
    state = s;


    function badge(parent, kind, text, attrs = {}, tone = 'neutral') {
      let node = parent.querySelector(`:scope > .${MARK}[data-kind="${kind}"]`);
      if (!node) {
        node = uiBadge(doc, { cls: MARK, attrs: { 'data-kind': kind } });
        parent.append(node);
      }
      if (node.textContent !== text) node.textContent = text;
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      setTone(node, tone);
      return node;
    }

    /** The text a cell shows, without our own badges. */
    const shown = (cell) => [...(cell?.childNodes || [])]
      .filter((n) => !(n.nodeType === 1 && n.classList.contains(MARK)))
      .map((n) => n.textContent).join(' ').trim();

    function paintValues() {
      // Longest name first, so "Search the Junkyard" never takes "Junkyard"'s line.
      const values = [...s.values].filter((v) => v.value_per_nerve !== null)
        .sort((a, b) => b.name.length - a.name.length);
      for (const row of doc.querySelectorAll(OPTION_ROW)) {
        const cell = row.querySelector(OPTION_TITLE);
        if (!cell) continue;
        const title = shown(cell);
        const value = values.find((v) => title.includes(v.name));
        const old = cell.querySelector(`:scope > .${MARK}[data-kind="value"]`);
        if (!value) {
          old?.remove();
          continue;
        }
        const n = Math.round(value.value_per_nerve);
        const rate = value.success_rate === null ? '' : `; ${Math.round(value.success_rate)}% succeed`;
        badge(cell, 'value', `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US')}/nerve`, {}, n > 0 ? 'good' : 'neutral').title = `Average money and item value per nerve, from ${value.reporters} players' shared outcomes (torn-tracker.com)${rate}`;
      }
    }

    async function loadValues(typeId) {
      if (!ctx.site?.crimeValue || s.asked.has(typeId)) return;
      s.asked.add(typeId);
      const values = await ctx.site.crimeValue(typeId);
      if (state !== s || s.typeId !== typeId) return;
      s.values = values;
      paint();
    }

    function paint() {
      paintValues();
      const header = doc.querySelector(HEADER);
      if (header && s.morale !== null) {
        badge(header, 'morale', `Morale ${s.morale}%`, {}, s.morale >= 80 ? 'good' : s.morale >= 50 ? 'warn' : 'bad').title = 'Your crime morale, from the page (100 minus demoralisation)';
      }
      for (const row of doc.querySelectorAll(BURGLARY_ROW)) {
        const cell = row.querySelector(BURGLARY_TITLE);
        // Rows are recycled as the list scrolls: always match by the title shown now.
        const title = shown(cell);
        const expires = [...s.properties].find(([name]) => title.includes(name))?.[1];
        const old = cell?.querySelector(`:scope > .${MARK}[data-kind="left"]`);
        if (!cell || expires === undefined) {
          old?.remove();
          continue;
        }
        const { text, left } = lifetime(expires - now());
        badge(cell, 'left', text, { 'data-left': left }, { long: 'good', day: 'warn', short: 'bad' }[left]).title = 'Time before this target disappears';
      }
    }

    s.unsubscribe = ctx.intercept.onJson(isCrimesResponse, ({ url, data, form }) => {
      const typeId = typeIdOf(url, form);
      if (typeId && typeId !== s.typeId) {
        s.typeId = typeId;
        s.values = [];
        loadValues(typeId).catch((err) => ctx.log('crime value', err));
      }
      const morale = moraleFrom(data);
      if (morale !== null) s.morale = morale;
      const properties = propertiesFrom(data);
      if (properties.size) s.properties = properties;
      paint();
    }, ctx.win);

    const ours = (r) => ctx.dom.ownChange(r, `.${MARK}`);
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
