// The pre-war strip on the opponent's faction page (PRE-042, read accepted in hq #136).
//
// Between the match and the war's start, the faction page of the faction you're about to
// fight gets a short strip from torn-tracker.com: the one-line comparison of both sides,
// the brief's headline for Pro factions (a note for Core ones), and a link to the full
// brief on the site. It never names a member: who to hit first stays on the site.

import { el } from '../../core/dom.js';
import { strip as uiStrip } from '../../core/ui.js';

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

/**
 * The strip's own saved data: whether the Pro note was shown once already (hq #557 30), and
 * the faction whose page showed the strip last, so its place is held there from the start
 * (hq #557 A6).
 */
export function validateBriefData(value) {
  const shownFor = Number(value?.shownFor);
  return {
    proNoteSeen: value?.proNoteSeen === true,
    shownFor: Number.isInteger(shownFor) && shownFor > 0 ? shownFor : null,
  };
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
  data: { empty: { proNoteSeen: false, shownFor: null }, validate: validateBriefData },

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null };
    state = s;
    const faction = factionOf(win.location?.search);
    if (!faction || !ctx.site?.warBrief) return;

    const saved = () => validateBriefData(ctx.data?.());
    // One save for every change, so two saves can't each overwrite the other's.
    const remember = (change) => {
      const now = saved();
      if (Object.keys(change).every((k) => now[k] === change[k])) return;
      Promise.resolve(ctx.saveData?.((fresh) => ({ ...validateBriefData(fresh), ...change })))
        .catch((err) => ctx.log('war brief data', err));
    };
    const anchorOf = () => doc.querySelector('.content-title') || doc.querySelector('#factions') || doc.body.firstElementChild;
    // Whether the strip shows is known only from the site's answer. Where it showed on the
    // last visit, its place is held from the start and filled in place, so the page doesn't
    // jump (hq #557 A6); elsewhere nothing is added until the answer comes.
    const anchor = anchorOf();
    if (saved().shownFor === faction && anchor && !doc.querySelector(`.${MARK}`)) {
      anchor.after(uiStrip(doc, { cls: MARK, tone: 'info', attrs: { 'data-loading': 'true' } },
        el('strong', { ownerDocument: doc }, 'Your next ranked war: '), 'Loading…'));
    }

    s.timer = win.setTimeout(async () => {
      try {
        const brief = await ctx.site.warBrief();
        if (state !== s) return;
        // Only on the page of the faction the war is against.
        if (!brief || brief.opponent !== faction || !brief.compare) {
          doc.querySelector(`.${MARK}`)?.remove();
          if (saved().shownFor === faction) remember({ shownFor: null });
          return;
        }
        const change = { shownFor: faction };
        const strip = uiStrip(doc, { cls: MARK, tone: 'info' }); // information, not a warning (hq #557 E35)
        strip.append(el('strong', { ownerDocument: doc }, 'Your next ranked war: '), brief.compare);
        if (brief.headline) strip.append(el('div', { ownerDocument: doc }, brief.headline));
        else if (!brief.pro && !saved().proNoteSeen) {
          // Once only: the next war's strip leaves the note off (hq #557 30).
          strip.append(el('div', { ownerDocument: doc }, 'The full brief is a Pro feature.'));
          change.proNoteSeen = true;
        }
        if (brief.briefUrl) {
          // The same words for every tier (hq #557 30); the site says what the tier shows.
          strip.append(' ', el('a', {
            href: brief.briefUrl, target: '_blank', rel: 'noopener noreferrer', ownerDocument: doc,
          }, 'Open the brief on torn-tracker.com'));
        }
        const held = doc.querySelector(`.${MARK}`);
        const place = anchorOf();
        if (held) held.replaceWith(strip);
        else if (place) place.after(strip);
        else return;
        remember(change);
      } catch (err) {
        doc.querySelector(`.${MARK}`)?.remove();
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
