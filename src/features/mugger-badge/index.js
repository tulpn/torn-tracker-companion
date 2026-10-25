// After-sale mug badge (TRU-023, TRU-025, WP-TRU-3 part 2).
//
// On a player's profile and on the attack page, when torn-tracker.com lists that player
// for mugging sellers shortly after a sale (TRU-022: 3 or more different reporters in 30
// days), a badge beside the heading says so, with the counts in its tooltip and a link to
// the site's seller-safety page. Facts only, never an accusation (TRU-002), and never
// the reporters. Anyone not listed gets no badge at all, so the page looks as it did.
//
// The read is the one accepted on hq #368. Until the site serves it, there is no answer
// and nothing shows.

import { ATTACK_ROUTES, onSubjectPage, pageSubject } from '../../core/players.js';
import { badge } from '../../core/ui.js';
import { HEADING } from '../ff-badges/selectors.js';

const MARK = 'ttc-mugger';
const SETTLE_MS = 250;

let state = null;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The badge's words for a listed player. */
export function badgeText(entry) {
  return entry.mugs30 > 0 ? `Mugged sellers: ${entry.mugs30} in 30 days` : `Mugged sellers: ${entry.mugs90} in 90 days`;
}

/** The tooltip: what was reported, and when last. */
export function badgeTitle(entry) {
  const last = entry.lastAt === null ? ''
    : ` Last reported ${new Date(entry.lastAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`;
  return `Players reported this player mugging them shortly after a sale: ${plural(entry.mugs30, 'mug', 'mugs')} in the last `
    + `30 days, ${entry.mugs90} in 90.${last} Bank your cash before you sell.`;
}

export default {
  id: 'mugger-badge',
  wave: 3,
  title: 'After-sale mug badge',
  area: 'market',
  guide: 'mugger-badge',
  summary: 'A badge on the profile and attack page of a player listed for mugging sellers just after a sale.',
  routes: ['profiles.php', ...ATTACK_ROUTES],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null, stopWatching: null, asked: null };
    state = s;
    const alive = () => state === s;

    async function look() {
      const id = pageSubject(win.location);
      if (!id || !onSubjectPage(win.location)) return;
      const heading = doc.querySelector(HEADING);
      if (!heading || heading.parentNode?.querySelector(`:scope > .${MARK}`) || s.asked === id) return;
      s.asked = id;
      const { players, safetyUrl } = await ctx.site.muggers([id]);
      s.asked = null;
      const entry = players.get(id);
      if (!alive() || !entry?.listed || !heading.isConnected || heading.parentNode?.querySelector(`:scope > .${MARK}`)) return;
      const link = safetyUrl ? { tag: 'a', attrs: { href: safetyUrl, target: '_blank', rel: 'noopener noreferrer' } } : { attrs: {} };
      const node = badge(doc, {
        cls: MARK, tone: 'warn', tag: link.tag, attrs: { ...link.attrs, title: badgeTitle(entry) },
      }, badgeText(entry));
      node.dataset.player = String(id);
      heading.after(node);
    }

    const later = () => {
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => {
        s.timer = null;
        if (alive()) look().catch((err) => ctx.log('mugger badge', err));
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
