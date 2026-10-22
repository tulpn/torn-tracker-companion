// Your mugging history with a player (MUG-030).
//
// On a profile or attack page you opened, a small strip says how often you have mugged
// this player, when last and for how much, and what you got on average, from your own
// records on torn-tracker.com. Nothing about anyone else's mugs, no Torn request of its
// own, and on the attack page it fills nothing and clicks nothing.

import { ago } from '../war-page/index.js';
import { badge } from '../../core/ui.js';

const MARK = 'ttc-mugs';
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

export default {
  id: 'mug-strip',
  wave: 2,
  title: 'Your mugs of a player',
  area: 'war',
  guide: 'attack-page',
  summary: 'Your own mugs of a player, on their profile and the attack page.',
  routes: ['profiles.php', 'page.php?sid=attack'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const now = () => (typeof ctx.now === 'function' ? ctx.now() : Date.now());
    const s = { doc, win, timer: null };
    state = s;
    const params = new URLSearchParams(String(win.location?.search || ''));
    const id = Number(params.get('XID') || params.get('user2ID'));
    if (!Number.isInteger(id) || id <= 0 || !ctx.site?.myMugs) return;

    s.timer = win.setTimeout(async () => {
      try {
        const line = mugLine(await ctx.site.myMugs(id), now());
        const heading = doc.querySelector(HEADING);
        if (state !== s || !line || !heading || doc.querySelector(`.${MARK}`)) return;
        const node = badge(doc, { cls: MARK, tone: 'info', block: true }, line);
        node.title = 'From your own mugs on torn-tracker.com';
        (heading.closest('.content-title') || heading).after(node);
      } catch (err) {
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
