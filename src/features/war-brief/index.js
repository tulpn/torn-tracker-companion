// The pre-war strip on the opponent's faction page (PRE-042, read accepted in hq #136).
//
// Between the match and the war's start, the faction page of the faction you're about to
// fight gets a short strip from torn-tracker.com: the one-line comparison of both sides,
// the brief's headline for Pro factions (a note for Core ones), and a link to the full
// brief on the site. It never names a member: who to hit first stays on the site.

import { el } from '../../core/dom.js';

const MARK = 'ttc-brief';
const SETTLE_MS = 300;

let state = null;

/** The faction a faction profile page is about, or null. */
export function factionOf(search) {
  const params = new URLSearchParams(String(search || ''));
  if (params.get('step') !== 'profile') return null;
  const id = Number(params.get('ID'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default {
  id: 'war-brief',
  wave: 2,
  title: 'Pre-war brief strip',
  area: 'war',
  guide: 'war-page',
  summary: "Before a ranked war, a one-line comparison and the brief on the opponent's faction page.",
  routes: ['factions.php?step=profile'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null };
    state = s;
    const faction = factionOf(win.location?.search);
    if (!faction || !ctx.site?.warBrief) return;

    s.timer = win.setTimeout(async () => {
      try {
        const brief = await ctx.site.warBrief();
        // Only on the page of the faction the war is against.
        if (state !== s || !brief || brief.opponent !== faction || !brief.compare) return;
        const strip = el('div', { class: MARK, ownerDocument: doc });
        strip.style.cssText = 'margin: 6px 0; padding: 6px 8px; border-left: 3px solid #a44; font: 12px sans-serif;';
        strip.append(el('strong', { ownerDocument: doc }, 'Your next ranked war: '), brief.compare);
        if (brief.headline) strip.append(el('div', { ownerDocument: doc }, brief.headline));
        else if (!brief.pro) strip.append(el('div', { ownerDocument: doc }, 'The full brief is a Pro feature.'));
        if (brief.briefUrl) {
          strip.append(' ', el('a', {
            href: brief.briefUrl, target: '_blank', rel: 'noopener noreferrer', ownerDocument: doc,
          }, brief.pro ? 'Open the brief on torn-tracker.com' : 'See the brief on torn-tracker.com'));
        }
        const anchor = doc.querySelector('.content-title') || doc.querySelector('#factions') || doc.body.firstElementChild;
        if (anchor && !doc.querySelector(`.${MARK}`)) anchor.after(strip);
      } catch (err) {
        ctx.log('war brief', err);
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
