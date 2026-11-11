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

const MARK = 'ttc-award-next';
export const PANEL = "[role='tabpanel']";
const SETTLE_MS = 300;
const DAY_MS = 86_400_000;

let state = null;

/** "today", "tomorrow", a weekday within the week, else "on 21 Nov", in the player's local time. */
export function dayText(etaDays, now = Date.now()) {
  if (etaDays === 0) return 'today';
  if (etaDays === 1) return 'tomorrow';
  const day = new Date(now + etaDays * DAY_MS);
  if (etaDays <= 6) return day.toLocaleDateString('en-GB', { weekday: 'long' });
  return `on ${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

const amountText = (n) => n.toLocaleString('en-US');

/**
 * What the strip says, from the dashboard's checked `awards` card: the next crossings at
 * the player's pace when the site sends them, else the award nearest completion.
 * @returns {{lines: Array<{lead: string, name: string, tail: string, url: string|null}>}|null}
 */
export function countdown(card, now = Date.now()) {
  if (!card) return null;
  if (card.next?.length) {
    const lines = card.next.map((a, i) => {
      const unit = a.unit ? ` ${a.unit}` : '';
      const lead = `${amountText(a.remaining)}${unit} to ${i === 0 ? 'your next award' : 'the one after'}, `;
      const tail = a.etaDays == null ? '.' : `. At your pace: ${dayText(a.etaDays, now)}.`;
      return { lead, name: a.name, tail, url: a.url };
    });
    return { lines };
  }
  const a = card.nearest?.[0];
  if (!a) return null;
  const detail = a.detail ?? `${Math.floor(a.pct)}% done`;
  return { lines: [{ lead: 'Closest to earning: ', name: a.name, tail: `, ${detail}.`, url: a.url }] };
}

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

    function build(said) {
      return strip(doc, { cls: MARK, tone: 'info' },
        ...said.lines.map((line) => el('div', { ownerDocument: doc }, line.lead,
          line.url
            ? el('a', { href: line.url, target: '_blank', rel: 'noopener noreferrer', ownerDocument: doc }, line.name)
            : el('strong', { ownerDocument: doc }, line.name),
          line.tail)));
    }

    // Torn redraws the panel when the tab changes, which can take the strip with it:
    // put it back above whichever panel shows.
    function place() {
      if (!alive() || !s.said) return;
      const panel = doc.querySelector(PANEL);
      if (!panel) return;
      const box = doc.querySelector(`.${MARK}`);
      if (box && box.nextElementSibling === panel) return;
      box?.remove();
      panel.before(build(s.said));
    }

    const own = (n) => Boolean((n.nodeType === 1 ? n : n.parentElement)?.closest?.(`.${MARK}`));
    const ours = (r) => own(r.target)
      || (r.addedNodes.length + r.removedNodes.length > 0 && [...r.addedNodes, ...r.removedNodes].every(own));

    (async () => {
      if (!ctx.site?.dashboard) return;
      const answer = await ctx.site.dashboard();
      if (!alive() || answer?.status !== 'ok') return;
      s.said = countdown(answer.cards?.get('awards') ?? null, now());
      if (!s.said) return;
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
