// Award countdown on Torn's awards page (hq #785, ENG-063).
//
// On page.php?sid=awards, one strip above the tab panel names the award you're closest to
// crossing: "3 busts to your next award, Bar Breaker. At your pace: Thursday." It comes
// from the dashboard read the companion already makes (companion-api §6.4b), asked once
// when the page opens and kept a minute; the site works it out from your stored counters
// and never asks Torn. When the site sends the next crossings at your pace (`next`), the
// strip names up to two with the day; until then it names the award nearest completion,
// with no day.
//
// It reads nothing from the page but where the tab panel is, and it never presses
// anything on Torn's page. The link opens the site's awards page in a new tab.

import { el, settler } from '../../core/dom.js';
import { strip } from '../../core/ui.js';
import { countdownNodes } from '../../core/awards.js';

export { countdown, dayText } from '../../core/awards.js';

const MARK = 'ttc-award-next';
export const PANEL = "[role='tabpanel']";
const SETTLE_MS = 300;

let state = null;

export default {
  id: 'award-countdown',
  wave: 3,
  title: 'Award countdown',
  area: 'other',
  guide: 'award-countdown',
  summary: 'On the awards page, the award you are closest to and, when the site knows your pace, the day you reach it.',
  routes: ['page.php?sid=awards'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const now = ctx.now || Date.now;
    const s = { doc, settle: null, stopWatching: null, said: null };
    state = s;
    const alive = () => state === s;

    const make = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);

    // Torn redraws the panel when the tab changes, which can take the strip with it:
    // put it back above whichever panel shows.
    function place() {
      if (!alive() || !s.said) return;
      const panel = doc.querySelector(PANEL);
      if (!panel) return;
      const box = doc.querySelector(`.${MARK}`);
      if (box && box.nextElementSibling === panel) return;
      box?.remove();
      panel.before(strip(doc, { cls: MARK, tone: 'info' }, ...s.said));
    }

    const own = (n) => Boolean((n.nodeType === 1 ? n : n.parentElement)?.closest?.(`.${MARK}`));
    const ours = (r) => own(r.target)
      || (r.addedNodes.length + r.removedNodes.length > 0 && [...r.addedNodes, ...r.removedNodes].every(own));

    (async () => {
      if (!ctx.site?.dashboard) return;
      const answer = await ctx.site.dashboard();
      if (!alive() || answer?.status !== 'ok') return;
      s.said = countdownNodes(answer.cards?.get('awards') ?? null, now(), make, 'div');
      if (!s.said.length) return;
      s.settle = settler(place, SETTLE_MS, { timers: win });
      s.stopWatching = ctx.dom.onMutation((records) => {
        if (!records.every(ours)) s.settle.poke();
      }, doc);
      place();
    })();
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    s.settle?.cancel();
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
