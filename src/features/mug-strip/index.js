// Your mugging history with a player (MUG-030).
//
// On a profile or attack page you opened, a small strip says how often you have mugged
// this player, when last and for how much, and what you got on average, from your own
// records on torn-tracker.com. Nothing about anyone else's mugs, no Torn request of its
// own, and on the attack page it fills nothing and clicks nothing.

import { ago } from '../war-page/index.js';
import { ATTACK_ROUTES, pageSubject } from '../../core/players.js';
import { strip } from '../../core/ui.js';

const MARK = 'ttc-mugs';
/** How many players' pages the strip remembers having shown on, newest last. */
const REMEMBERED = 50;
const HEADING = '.content-title h4, h4';
const SETTLE_MS = 300;

let state = null;

const money = (n) => `$${n.toLocaleString('en-US')}`;

/** "You mugged them 3 times: last 2d ago for $1,200,000, $900,000 on average." */
export function mugLine(mugs, now) {
  if (!mugs || mugs.count === 0) return null;
  const times = mugs.count === 1 ? 'once' : `${mugs.count} times`;
  const last = [
    mugs.last_at !== null ? `last ${ago(now - mugs.last_at)} ago` : null,
    mugs.last_amount !== null ? `for ${money(mugs.last_amount)}` : null,
  ].filter(Boolean).join(' ');
  const average = mugs.average !== null && mugs.count > 1 ? `${money(mugs.average)} on average` : null;
  const details = [last, average].filter(Boolean).join(', ');
  return `You mugged them ${times}${details ? `: ${details}` : ''}.`;
}

/**
 * The strip's own saved data: the players whose page showed it last, so its place is held
 * there from the start (hq #557 A6). Newest last, at most fifty.
 */
export function validateMugData(value) {
  const ids = Array.isArray(value?.shownFor) ? value.shownFor : [];
  const ok = ids.filter((id) => Number.isInteger(id) && id > 0);
  return { shownFor: [...new Set(ok)].slice(-REMEMBERED) };
}

/** The list with `id` moved to the end (shown) or taken out (not shown). */
export function withShown(list, id, shown) {
  const rest = validateMugData({ shownFor: list }).shownFor.filter((n) => n !== id);
  return validateMugData({ shownFor: shown ? [...rest, id] : rest }).shownFor;
}

export default {
  id: 'mug-strip',
  wave: 2,
  title: 'Your mugs of a player',
  area: 'war',
  guide: 'attack-page',
  summary: 'Your own mugs of a player, on their profile and the attack page.',
  routes: ['profiles.php', ...ATTACK_ROUTES],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: [],
  data: { empty: { shownFor: [] }, validate: validateMugData },

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const now = () => (typeof ctx.now === 'function' ? ctx.now() : Date.now());
    const s = { doc, win, timer: null };
    state = s;
    const id = pageSubject(win.location);
    if (!id || !ctx.site?.myMugs) return;

    const known = () => validateMugData(ctx.data?.()).shownFor.includes(id);
    const remember = (shown) => {
      if (known() === shown) return;
      Promise.resolve(ctx.saveData?.((fresh) => ({ shownFor: withShown(validateMugData(fresh).shownFor, id, shown) })))
        .catch((err) => ctx.log('mug strip place', err));
    };
    const placeOf = () => {
      const heading = doc.querySelector(HEADING);
      return heading ? heading.closest('.content-title') || heading : null;
    };
    // Whether the strip shows is known only from the site's answer. On a player whose page
    // showed it last time, its place is held from the start and filled in place, so the page
    // doesn't jump (hq #557 A6); elsewhere nothing is added until the answer comes.
    const first = placeOf();
    if (known() && first && !doc.querySelector(`.${MARK}`)) {
      first.after(strip(doc, { cls: MARK, tone: 'info', attrs: { 'data-loading': 'true' } }, 'Your mugs of this player: Loading…'));
    }

    s.timer = win.setTimeout(async () => {
      try {
        const line = mugLine(await ctx.site.myMugs(id), now());
        if (state !== s) return;
        const held = doc.querySelector(`.${MARK}`);
        if (!line) {
          held?.remove();
          remember(false);
          return;
        }
        // A sentence: a strip, not a pill (hq #557 E36).
        const node = strip(doc, { cls: MARK, tone: 'info' }, line);
        node.title = 'From your own mugs on torn-tracker.com';
        const place = placeOf();
        if (held) held.replaceWith(node);
        else if (place) place.after(node);
        else return;
        remember(true);
      } catch (err) {
        doc.querySelector(`.${MARK}`)?.remove();
        ctx.log('mug strip', err);
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
