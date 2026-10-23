// Merit hints on the merits tab (CMP-301).
//
// On page.php?sid=awards&tab=merits, when the player has free merits, a strip above the
// list names every merit those merits are enough to raise, and each merit below its
// maximum gets a small "next: N merits" label. Torn already prints what each merit does,
// so the hint is what it costs: raising a merit from level L costs L + 1 merits (Torn's
// own text on the tab says so, and the captured levels add up to its "Merits Used").
// With no free merits, nothing is shown.
//
// It reads only the tab's own markup: each merit's aria-label ("Nerve Bar. Upgraded:
// 1 / 10. ") and the "Available Merits" count. It asks nothing of anyone. A name in the
// strip only scrolls to its merit; upgrading is still the player's own press on Torn's
// row, and the script never presses it.

import { el } from '../../core/dom.js';
import { badge, setTone, strip } from '../../core/ui.js';

const MARK = 'ttc-merits';
export const PANEL = '#merits-panel';
export const MERIT = "li[aria-label*='Upgraded:']";
export const LIST = "ul[class*='meritsList']";
const SETTLE_MS = 300;

let state = null;

/** "Nerve Bar. Upgraded: 1 / 10. " -> {name, level, max}; anything else -> null. */
export function readMerit(label) {
  const m = /^\s*(.{1,60}?)\.\s*Upgraded:\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/.exec(String(label || ''));
  if (!m) return null;
  const level = Number(m[2]);
  const max = Number(m[3]);
  return max > 0 && level <= max ? { name: m[1].trim(), level, max } : null;
}

/** The free merits the tab shows: "Available Merits: 2", else "You have 2 merits"; null if neither. */
export function freeMerits(panel) {
  const count = panel.querySelector('.currency-merits')?.parentElement?.lastElementChild?.textContent;
  const fromCount = /^\s*(\d{1,4})\s*$/.exec(count || '');
  if (fromCount) return Number(fromCount[1]);
  const fromText = /You have\s+(\d{1,4})\s+merits?/i.exec(panel.textContent || '');
  return fromText ? Number(fromText[1]) : null;
}

/** Raising a merit from level L costs L + 1 merits. */
export const nextCost = (level) => level + 1;

const merits = (n) => `${n} merit${n === 1 ? '' : 's'}`;

export default {
  id: 'merit-hints',
  wave: 3,
  title: 'Merit hints',
  area: 'other',
  guide: 'merit-hints',
  summary: 'On the merits tab, which merits your free merits can raise, and what each next level costs.',
  routes: ['page.php?sid=awards'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: false },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null, stopWatching: null };
    state = s;

    function clear() {
      for (const node of doc.querySelectorAll(`.${MARK}`)) node.remove();
    }

    function look() {
      if (state !== s) return;
      const panel = doc.querySelector(PANEL);
      const free = panel ? freeMerits(panel) : null;
      const rows = panel ? [...panel.querySelectorAll(MERIT)].map((li) => ({ li, merit: readMerit(li.getAttribute('aria-label')) }))
        .filter((r) => r.merit) : [];
      // AC1: no free merits, no hints.
      if (!free || rows.length === 0) {
        clear();
        return;
      }

      for (const { li, merit } of rows) {
        let node = li.querySelector(`.${MARK}`);
        if (merit.level >= merit.max) {
          node?.remove();
          continue;
        }
        const cost = nextCost(merit.level);
        const text = `next: ${merits(cost)}`;
        if (!node) {
          node = badge(doc, { cls: MARK });
          const spot = li.querySelector("[class*='title']");
          if (spot) spot.after(node);
          else li.append(node);
        }
        if (node.textContent !== text) node.textContent = text;
        setTone(node, cost <= free ? 'good' : 'neutral');
        node.title = cost <= free
          ? `Your ${merits(free)} can raise ${merit.name} to level ${merit.level + 1}.`
          : `${merit.name} needs ${merits(cost)} for level ${merit.level + 1}; you have ${free}.`;
      }

      const raisable = rows.filter(({ merit }) => merit.level < merit.max && nextCost(merit.level) <= free);
      const cheapest = rows.filter(({ merit }) => merit.level < merit.max)
        .sort((a, b) => a.merit.level - b.merit.level)[0];
      const key = `${free}|${raisable.map((r) => `${r.merit.name}:${r.merit.level}`).join(',')}`;
      let box = panel.querySelector(`.${MARK}-strip`);
      if (box?.dataset.key === key) return;
      box?.remove();
      const goTo = (li, name) => {
        const link = el('a', { href: '#', ownerDocument: doc }, name);
        // Only scrolls: the merit's own row, and its upgrade, stay the player's to press.
        link.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          li.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        return link;
      };
      const line = raisable.length
        ? [el('div', { ownerDocument: doc }, 'Enough to raise: ',
          ...raisable.flatMap(({ li, merit }, i) => [i ? ', ' : '', goTo(li, merit.name), ` (${nextCost(merit.level)})`]), '.')]
        : cheapest ? [el('div', { ownerDocument: doc }, 'Not enough for any next level yet. The cheapest is ',
          goTo(cheapest.li, cheapest.merit.name), `, at ${merits(nextCost(cheapest.merit.level))}.`)] : [];
      box = strip(doc, { cls: `${MARK} ${MARK}-strip`, tone: 'info', attrs: { 'data-key': key } },
        el('strong', { ownerDocument: doc }, `You have ${merits(free)} to spend`),
        ...line,
        el('div', { ownerDocument: doc }, 'A merit’s next level costs one more than its current level.'));
      const first = panel.querySelector(LIST);
      if (first) first.before(box);
      else panel.prepend(box);
    }

    // A change is ours when it happened inside our nodes, or only added or removed them.
    // A removed node has no ancestors left, so it's judged by itself, never by closest().
    const own = (n) => Boolean((n.nodeType === 1 ? n : n.parentElement)?.closest?.(`.${MARK}`));
    const ours = (r) => own(r.target)
      || (r.addedNodes.length + r.removedNodes.length > 0 && [...r.addedNodes, ...r.removedNodes].every(own));
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
