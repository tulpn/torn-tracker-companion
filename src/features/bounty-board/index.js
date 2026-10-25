// The bounty board (BNT-012, WP-BNT-2).
//
// On bounties.php, a fair-fight badge beside every target, from torn-tracker.com: all the
// targets on the page in one batched read, as for CMP-101. Above the list, a filter bar
// hides the rows outside the hunter's limits (a minimum reward, a highest fair fight, a
// level range, anonymous bounties) and says how many it hides. Hospital timers the page
// already shows are outlined when they run out within the minutes set. It reads the page
// only: no Torn call, and nothing is attacked or claimed (BNT-001).
//
// The filter is kept for the tab in sessionStorage, checked field by field.

import { el, ownChange } from '../../core/dom.js';
import { idFromHref } from '../../core/players.js';
import { badge, bar as uiBar, setTone } from '../../core/ui.js';
import { describe as ffLook, textColourFor } from '../ff-badges/view.js';
import { LEVEL, LISTER, LIST, REWARD, ROWS, STATUS, TARGET } from './selectors.js';

const MARK = 'ttc-bounty';
const HIDE = 'data-ttc-bounty-hide';
const SOON = 'data-ttc-bounty-soon';
/** Torn re-renders lists in bursts; one scan once it settles. */
const SETTLE_MS = 250;

export const FILTER_KEY = 'ttc-bounty-filter';

/** Every limit off. 0 means "no limit". */
export const NO_FILTER = Object.freeze({
  minReward: 0, maxFf: 0, minLevel: 0, maxLevel: 0, hideAnonymous: false,
});

const LIMITS = {
  minReward: [0, 100_000_000_000], maxFf: [0, 100], minLevel: [0, 100], maxLevel: [0, 100],
};

/** A filter from storage or the bar, checked field by field; anything odd is "no limit". */
export function validFilter(raw) {
  const given = raw && typeof raw === 'object' ? raw : {};
  const out = { ...NO_FILTER };
  for (const [key, [lo, hi]] of Object.entries(LIMITS)) {
    const n = Number(given[key]);
    if (Number.isFinite(n) && n >= lo && n <= hi) out[key] = key === 'maxFf' ? Math.round(n * 100) / 100 : Math.floor(n);
  }
  out.hideAnonymous = given.hideAnonymous === true;
  return out;
}

export { idFromHref };

/** How long a timer on the page has left, in ms: "1:02:03", "12:30", "1h 20m", "45s". Null if none. */
export function timerMs(text) {
  const s = String(text || '');
  const clock = /(\d+):(\d{2})(?::(\d{2}))?/.exec(s);
  if (clock) {
    const [a, b, c] = clock.slice(1).map((v) => (v === undefined ? null : Number(v)));
    return (c === null ? a * 60 + b : a * 3600 + b * 60 + c) * 1000;
  }
  let total = 0;
  let any = false;
  for (const [unit, ms] of [['d', 86_400_000], ['h', 3_600_000], ['m', 60_000], ['s', 1000]]) {
    const m = new RegExp(`(\\d+)\\s*${unit}\\b`, 'i').exec(s);
    if (m) {
      total += Number(m[1]) * ms;
      any = true;
    }
  }
  return any ? total : null;
}

/** What a row shows: the target, their level, the reward, an anonymous lister, a hospital timer. */
export function readRow(row) {
  const text = (sel) => row.querySelector(sel)?.textContent?.trim() ?? '';
  const level = /\d+/.exec(text(LEVEL));
  const reward = /\$\s*([\d,]+)/.exec(text(REWARD)) || /([\d,]+)/.exec(text(REWARD));
  const status = row.querySelector(STATUS);
  const statusText = `${status?.textContent ?? ''} ${status?.getAttribute('title') ?? ''}`;
  return {
    id: idFromHref(row.querySelector(TARGET)?.getAttribute('href')),
    level: level ? Number(level[0]) : null,
    reward: reward ? Number(reward[1].replace(/,/g, '')) : null,
    anonymous: /\banonymous\b/i.test(text(LISTER)),
    hospitalMs: /hospital/i.test(statusText) ? timerMs(statusText) : null,
  };
}

/** Whether a row passes the filter. What the page or the site doesn't say never hides a row. */
export function passes(row, filter, ff) {
  if (filter.minReward && row.reward !== null && row.reward < filter.minReward) return false;
  if (filter.minLevel && row.level !== null && row.level < filter.minLevel) return false;
  if (filter.maxLevel && row.level !== null && row.level > filter.maxLevel) return false;
  if (filter.hideAnonymous && row.anonymous) return false;
  if (filter.maxFf && typeof ff?.ff === 'number' && ff.ff > filter.maxFf) return false;
  return true;
}

let state = null;

export default {
  id: 'bounty-board',
  wave: 3,
  title: 'Bounty board',
  area: 'war',
  guide: 'bounty-board',
  summary: 'On the bounty board: a fair-fight badge on every target, filters, and hospital timers that are nearly up.',
  routes: ['bounties.php'],
  defaults: { enabled: true, soonMinutes: 10 },
  options: {
    soonMinutes: { label: 'Outline a hospital timer with this many minutes or fewer left', min: 1, max: 240 },
  },
  shares: [],
  needs: { apiKey: false, scriptKey: false },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = {
      doc, win, timer: null, stop: null, alive: true, ff: new Map(), asked: new Set(),
    };
    state = s;
    const soonMs = () => {
      const n = Number(ctx.settings?.soonMinutes);
      return (Number.isFinite(n) && n >= 1 && n <= 240 ? n : 10) * 60_000;
    };
    const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);

    let filter = { ...NO_FILTER };
    try {
      filter = validFilter(JSON.parse(win.sessionStorage?.getItem(FILTER_KEY) ?? 'null'));
    } catch { /* no storage, or nothing kept: no limits */ }
    const keep = () => {
      try {
        win.sessionStorage?.setItem(FILTER_KEY, JSON.stringify(filter));
      } catch { /* the filter lasts this page view */ }
    };

    function field(key, label, attrs) {
      const input = h('input', {
        type: 'number', inputmode: 'decimal', min: '0', class: `${MARK}-in`, 'data-filter': key, 'aria-label': label,
        value: filter[key] ? String(filter[key]) : '', ...attrs,
      });
      input.addEventListener('input', () => {
        filter = validFilter({ ...filter, [key]: input.value === '' ? 0 : input.value });
        keep();
        apply();
      });
      return input;
    }

    function makeBar() {
      const anon = h('input', { type: 'checkbox', 'data-filter': 'hideAnonymous', checked: filter.hideAnonymous });
      anon.addEventListener('change', () => {
        filter = { ...filter, hideAnonymous: anon.checked };
        keep();
        apply();
      });
      return uiBar(doc, { cls: `${MARK} ${MARK}-bar`, attrs: { role: 'group', 'aria-label': 'Filter the bounties' } },
        h('strong', null, 'Filter'),
        h('label', null, 'Reward at least $', field('minReward', 'Reward at least, in dollars', { step: '1000' })),
        h('label', null, 'Fair fight up to', field('maxFf', 'Fair fight up to', { step: '0.1', class: `${MARK}-in ${MARK}-short` })),
        h('label', null, 'Level',
          field('minLevel', 'Level from', { step: '1', max: '100', class: `${MARK}-in ${MARK}-short` }),
          '–',
          field('maxLevel', 'Level to', { step: '1', max: '100', class: `${MARK}-in ${MARK}-short` })),
        h('label', null, anon, ' Hide anonymous'),
        h('span', { class: `${MARK}-count`, role: 'status' }));
    }

    function addBadge(row, id) {
      const link = row.querySelector(TARGET);
      if (!link || row.querySelector(`.${MARK}-ff`)) return;
      const look = ffLook(s.ff.get(id));
      const node = badge(doc, { cls: `${MARK} ${MARK}-ff`, attrs: { title: look.title, 'data-player': String(id) } }, look.text);
      setTone(node, null, { scale: look.background, ink: textColourFor(look.background) === '#000000' ? 'dark' : 'light' });
      link.after(node);
    }

    /** Hides, outlines and counts; makes no request. */
    function apply() {
      let shown = 0;
      let total = 0;
      for (const row of doc.querySelectorAll(ROWS)) {
        const read = readRow(row);
        if (!read.id) continue;
        total += 1;
        const pass = passes(read, filter, s.ff.get(read.id));
        if (pass) shown += 1;
        row.toggleAttribute(HIDE, !pass);
        row.toggleAttribute(SOON, read.hospitalMs !== null && read.hospitalMs <= soonMs());
      }
      const count = doc.querySelector(`.${MARK}-count`);
      const text = shown === total ? `All ${total} shown` : `${shown} of ${total} shown`;
      if (count && count.textContent !== text) count.textContent = text;
    }

    async function scan() {
      const list = doc.querySelector(LIST);
      if (!list) return;
      if (!doc.querySelector(`.${MARK}-bar`)) list.before(makeBar());
      const rows = [...doc.querySelectorAll(ROWS)].map((row) => ({ row, id: readRow(row).id })).filter((r) => r.id);
      const ask = [...new Set(rows.map((r) => r.id))].filter((id) => !s.asked.has(id));
      if (ask.length && ctx.site) {
        ask.forEach((id) => s.asked.add(id));
        const found = await ctx.site.ff(ask);
        if (!s.alive) return;
        for (const [id, value] of found) s.ff.set(id, value);
      }
      for (const { row, id } of rows) if (row.isConnected) addBadge(row, id);
      apply();
    }

    const later = () => {
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => {
        s.timer = null;
        scan().catch((err) => ctx.log('bounty board', err));
      }, SETTLE_MS);
    };
    s.stop = ctx.dom.onMutation((records) => {
      if (records.every((r) => ownChange(r, `.${MARK}`))) return;
      later();
    }, doc);
    later();
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.alive = false;
    s.stop?.();
    if (s.timer !== null) s.win.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
    for (const row of s.doc.querySelectorAll(`[${HIDE}], [${SOON}]`)) {
      row.removeAttribute(HIDE);
      row.removeAttribute(SOON);
    }
  },
};
