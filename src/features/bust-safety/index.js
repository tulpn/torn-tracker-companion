// Bust safety on the jail page (CMP-303, ruled on hq #219).
//
// Torn's jail page shows no bust difficulty, so beside each prisoner the script shows the
// community's rule of thumb, worked out from what that row shows: level x (hours left +
// 3), the score TornTools uses. It is coloured by band and labelled for what it is: a
// rule of thumb, not Torn's odds. With its sharing switch on, each prisoner's level band
// and time-left band (never who they are) is shared as `jail_difficulty`.
//
// The script never clicks Bust or Bail, and never changes a bust link to skip Torn's
// confirmation ("quick bust"). Highlighting is the only thing it does.
//
// Facts, not code, from TornTools (GPLv3, features/jail-filter: the score, and where the
// rows, levels and times are) and Bustr+ (MIT, greasyfork 586532).

import { createGate, isVisible } from '../../core/capture.js';
import { el } from '../../core/dom.js';

const MARK = 'ttc-bust';
export const ROW = '.users-list > li, ul.user-info-list-wrap > li';
export const LEVEL = '.info-wrap .level';
export const TIME = '.info-wrap .time';
export const NAME = 'a.user.name';
const SETTLE_MS = 300;

/** Closed bands for jail_difficulty (proposed to the lead on hq #219). */
export const LEVEL_BANDS = Object.freeze([[10, '1-10'], [25, '11-25'], [50, '26-50'], [75, '51-75'], [100, '76-100']]);
export const HOURS_BANDS = Object.freeze([[1, '<1'], [3, '1-3'], [6, '3-6'], [12, '6-12'], [24, '12-24'], [Infinity, '24+']]);

let state = null;

/** 'LEVEL: 25' or 'Level 25' -> 25; anything else -> null. */
export function levelOf(text) {
  const m = /(\d{1,3})\s*$/.exec(String(text || '').trim());
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : null;
}

/** 'TIME: 1d 2h 15m', '45m', '2h' -> hours as a decimal; anything else -> null. */
export function hoursOf(text) {
  const t = String(text || '').replace(/^\s*time\s*:?\s*/i, '');
  let total = 0;
  let found = false;
  for (const [, n, unit] of t.matchAll(/(\d+)\s*([dhms])/gi)) {
    found = true;
    total += Number(n) * { d: 24, h: 1, m: 1 / 60, s: 1 / 3600 }[unit.toLowerCase()];
  }
  return found ? total : null;
}

/** The community rule of thumb TornTools uses: level x (hours left + 3). */
export function score(level, hours) {
  return Math.round(level * (hours + 3));
}

export const bandOf = (value, bands) => bands.find(([top]) => value <= top)[1];

export default {
  id: 'bust-safety',
  wave: 3,
  title: 'Bust safety',
  area: 'other',
  guide: 'bust-safety',
  summary: 'A rule-of-thumb difficulty beside each prisoner in jail, coloured by band. Not Torn’s odds.',
  routes: ['jailview.php'],
  defaults: { enabled: true, easyUpTo: 100, hardFrom: 250 },
  options: {
    easyUpTo: { label: 'Green up to this score', min: 1, max: 100_000 },
    hardFrom: { label: 'Red from this score', min: 1, max: 100_000 },
  },
  shares: ['jail_difficulty'],
  needs: { apiKey: false, scriptKey: false },
  credits: ['TornTools (GPLv3)'],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null, stopWatching: null, gate: createGate({ windowMs: 10 * 60_000, now: ctx.now }) };
    state = s;
    const easy = ctx.settings.easyUpTo;
    const hard = ctx.settings.hardFrom;

    function look() {
      if (state !== s) return;
      for (const row of doc.querySelectorAll(ROW)) {
        const level = levelOf(row.querySelector(LEVEL)?.textContent);
        const hours = hoursOf(row.querySelector(TIME)?.textContent);
        let node = row.querySelector(`.${MARK}`);
        if (level === null || hours === null) {
          node?.remove();
          continue;
        }
        const value = score(level, hours);
        const band = value <= easy ? 'easy' : value >= hard ? 'hard' : 'medium';
        if (!node) {
          node = el('span', { class: MARK, ownerDocument: doc });
          node.style.cssText = 'display: inline-block; margin-left: 6px; padding: 0 5px; border-radius: 3px; font: 700 11px/16px Arial, sans-serif; color: #fff;';
          const spot = row.querySelector(NAME) || row.querySelector('.info-wrap');
          if (spot?.matches?.(NAME)) spot.after(node);
          else (spot || row).append(node);
        }
        const text = `${value}`;
        if (node.textContent !== text) node.textContent = text;
        node.dataset.band = band;
        node.style.background = band === 'easy' ? '#2e7d4f' : band === 'hard' ? '#a33' : '#8a6d1d';
        node.title = `Rule of thumb, not Torn's odds: level ${level} × (${hours.toFixed(1)} hours left + 3) = ${value}. Lower is easier.`;

        // Shared only with its switch on; never who: the row's key stays here.
        if (!isVisible(doc)) continue;
        const who = /XID=(\d+)/.exec(row.querySelector(NAME)?.getAttribute('href') || '')?.[1] || row.textContent.slice(0, 40);
        if (!s.gate.allow(who)) continue;
        ctx.share('jail_difficulty', { level_band: bandOf(level, LEVEL_BANDS), hours_left_band: bandOf(hours, HOURS_BANDS) });
      }
    }

    const ours = (r) => [r.target, ...r.addedNodes, ...r.removedNodes]
      .every((n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(`.${MARK}`));
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (records.every(ours)) return;
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(look, SETTLE_MS);
    }, doc);
    s.timer = win.setTimeout(look, SETTLE_MS);
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
