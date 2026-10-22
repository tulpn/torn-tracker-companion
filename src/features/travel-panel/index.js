// Your best runs on the travel agency (TRV-050; read accepted in hq #78).
//
// On the travel agency page, a small panel lists your top three runs from torn-tracker.com's
// planner: where, what and how many to buy, the profit per hour, when you'd land (Torn
// time) and how sure the restock estimate is. It links to the full planner on the site.
// It takes no game action: nothing is booked, bought or clicked.

import { el } from '../../core/dom.js';
import { strip } from '../../core/ui.js';

const MARK = 'ttc-runs';
export const PLANNER = 'https://www.torn-tracker.com/travel/';
const SETTLE_MS = 300;

const COUNTRY = {
  mexico: 'Mexico', cayman: 'Cayman Islands', canada: 'Canada', hawaii: 'Hawaii', uk: 'United Kingdom',
  argentina: 'Argentina', switzerland: 'Switzerland', japan: 'Japan', china: 'China', uae: 'UAE',
  'south-africa': 'South Africa',
};

let state = null;

const countryName = (key) => COUNTRY[key] || key;

/** $13.5k, $950, $1.2m: short money for a line. */
export function short(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1).replace(/\.0$/, '')}m`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return `$${n}`;
}

/** 14:20 in Torn time (UTC). */
export function tct(ms) {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "Mexico: 29 Jaguar Plushie, +$13.5k/h, lands 14:20 TCT (±10 min)". */
export function runLine(run) {
  const where = run.stops?.length ? [run.country, ...run.stops].map(countryName).join(' → ') : countryName(run.country);
  const sure = run.accuracy ? ` (${run.accuracy})` : '';
  return `${where}: ${run.quantity} ${run.item_name}, +${short(run.profit_per_hour)}/h, lands ${tct(run.lands_at)} TCT${sure}`;
}

export default {
  id: 'travel-panel',
  wave: 1,
  title: 'Your best runs on the travel agency',
  area: 'travel',
  guide: 'foreign-shop',
  summary: 'Your top three travel runs from the torn-tracker.com planner, on the travel agency page.',
  routes: ['travel.php'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null };
    state = s;
    if (!ctx.site?.travelRuns) return;

    s.timer = win.setTimeout(async () => {
      try {
        const answer = await ctx.site.travelRuns(3);
        if (state !== s || !answer || doc.querySelector(`.${MARK}`)) return;
        const panel = strip(doc, { cls: MARK });
        panel.append(el('strong', { ownerDocument: doc }, 'Your best runs (torn-tracker.com)'));
        if (answer.runs.length) {
          const list = el('ol', { ownerDocument: doc });
          for (const run of answer.runs) list.append(el('li', { ownerDocument: doc }, runLine(run)));
          panel.append(list);
        } else if (answer.reason === 'no_capacity') {
          panel.append(el('div', { ownerDocument: doc },
            "The planner doesn't know how much you can carry yet. Open a foreign shop once while abroad, or add a key on torn-tracker.com."));
        } else {
          panel.append(el('div', { ownerDocument: doc }, 'No runs to suggest right now.'));
        }
        panel.append(el('a', { href: PLANNER, target: '_blank', rel: 'noopener noreferrer', ownerDocument: doc }, 'Open the travel planner'));
        const anchor = doc.querySelector('.content-title') || doc.querySelector('.content-wrapper')?.firstElementChild;
        if (anchor) anchor.after(panel);
        else doc.querySelector('.content-wrapper')?.prepend(panel);
      } catch (err) {
        ctx.log('travel runs', err);
      }
    }, SETTLE_MS);
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.win.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
