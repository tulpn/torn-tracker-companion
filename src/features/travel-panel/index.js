// Your best runs on the travel agency (TRV-050; read accepted in hq #78).
//
// On the travel agency page, a small panel lists your top three runs from torn-tracker.com's
// planner: where, what and how many to buy, the profit per hour, when you'd land (Torn
// time) and how sure the restock estimate is. It links to the full planner on the site.
// It takes no game action: nothing is booked, bought or clicked.

import { SITE } from '../../hosts.js';
import { el, shortMoney } from '../../core/dom.js';
import { strip } from '../../core/ui.js';

const MARK = 'ttc-runs';
export const PLANNER = `${SITE}/travel/`;
const SETTLE_MS = 300;

const COUNTRY = {
  mexico: 'Mexico', cayman: 'Cayman Islands', canada: 'Canada', hawaii: 'Hawaii', uk: 'United Kingdom',
  argentina: 'Argentina', switzerland: 'Switzerland', japan: 'Japan', china: 'China', uae: 'UAE',
  'south-africa': 'South Africa',
};

let state = null;

const countryName = (key) => COUNTRY[key] || key;

/** $13.5k, $950, $1.2m: short money for a line (one helper with the sidebar's). */
export const short = shortMoney;

/** 14:20 in Torn time (UTC). */
export function tct(ms) {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "Mexico: 29 Jaguar Plushie, +$13.5k/h, lands 14:20 TCT (92% within 5 min)". */
export function runLine(run) {
  // The site's stops start with the run's own country; an older reply might not.
  const stops = run.stops?.length ? (run.stops[0] === run.country ? run.stops : [run.country, ...run.stops]) : [run.country];
  const where = stops.map(countryName).join(' → ');
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

    // The panel's place is held from the start with a one-line "Loading" strip of the same
    // shape, and filled in place, so the page under it doesn't jump when the answer comes
    // (hq #557 A6).
    function reserve() {
      let panel = doc.querySelector(`.${MARK}`);
      if (panel) return panel;
      const anchor = doc.querySelector('.content-title') || doc.querySelector('.content-wrapper')?.firstElementChild;
      const wrapper = doc.querySelector('.content-wrapper');
      if (!anchor && !wrapper) return null;
      panel = strip(doc, { cls: MARK, attrs: { 'data-tour': 'travel-runs', 'data-loading': 'true' } },
        el('strong', { ownerDocument: doc }, 'Your best runs (torn-tracker.com)'),
        el('div', { ownerDocument: doc }, 'Loading…'));
      if (anchor) anchor.after(panel);
      else wrapper.prepend(panel);
      return panel;
    }
    reserve();

    s.timer = win.setTimeout(async () => {
      try {
        const answer = await ctx.site.travelRuns(3);
        if (state !== s) return;
        const panel = reserve();
        if (!answer) {
          panel?.remove();
          return;
        }
        if (!panel) return;
        const body = [el('strong', { ownerDocument: doc }, 'Your best runs (torn-tracker.com)')];
        if (answer.runs.length) {
          const list = el('ol', { ownerDocument: doc });
          for (const run of answer.runs) list.append(el('li', { ownerDocument: doc }, runLine(run)));
          body.push(list);
        } else if (answer.reason === 'no_capacity') {
          body.push(el('div', { ownerDocument: doc },
            "The planner doesn't know how much you can carry yet. Open a foreign shop once while abroad, or add a key on torn-tracker.com."));
        } else {
          body.push(el('div', { ownerDocument: doc }, 'No runs to suggest right now.'));
        }
        body.push(el('a', { href: PLANNER, target: '_blank', rel: 'noopener noreferrer', ownerDocument: doc }, 'Open the travel planner'));
        panel.replaceChildren(...body);
        panel.removeAttribute('data-loading');
      } catch (err) {
        doc.querySelector(`.${MARK}`)?.remove();
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
