// Wallet reminder (TRU-025, PERS-012, WP-TRU-3 part 1).
//
// On the sell forms (the Item Market's add-listing form, the bazaar's add and manage
// pages), when the cash Torn's sidebar shows is at or above the amount the player set, one
// line above the form says so: buyers sometimes mug a seller just after a sale. It reads
// the page only, asks nothing, and "Not now" hides it for this page view.

import { el, readMoney } from '../../core/dom.js';
import { badge, button } from '../../core/ui.js';
import { FORMS, formFor } from '../price-filler/selectors.js';
import { MONEY } from './selectors.js';

const MARK = 'ttc-wallet';
const SETTLE_MS = 250;
const DEFAULT_MIN = 1_000_000;
const MAX = 100_000_000_000;

let state = null;

/** The cash the page shows the player carrying, or null when it doesn't show it. */
export function cashOnHand(doc) {
  const node = doc.querySelector(MONEY);
  if (!node) return null;
  const n = readMoney(node.getAttribute('data-money') ?? node.textContent);
  return Number.isInteger(n) && n >= 0 && n <= MAX ? n : null;
}

/** The reminder's words for an amount carried. */
export function reminderText(cash) {
  return `You're carrying $${cash.toLocaleString('en-US')}. Sellers are sometimes mugged just after a sale: bank it before you list.`;
}

export default {
  id: 'wallet-reminder',
  wave: 3,
  title: 'Wallet reminder',
  area: 'market',
  guide: 'wallet-reminder',
  summary: 'On the sell forms, a reminder to bank your cash first when you carry more than you set.',
  routes: ['bazaar.php#/add', 'bazaar.php#/manage', 'page.php?sid=ItemMarket'],
  defaults: { enabled: true, minCash: DEFAULT_MIN },
  options: {
    minCash: { label: 'Remind me when I carry at least ($)', min: 1000, max: MAX },
  },
  shares: [],
  needs: { apiKey: false, scriptKey: false },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const timers = ctx.win || globalThis;
    const s = { doc, timers, timer: null, stopWatching: null, dismissed: false };
    state = s;
    const minCash = () => {
      const n = Number(ctx.settings?.minCash);
      return Number.isInteger(n) && n >= 1000 && n <= MAX ? n : DEFAULT_MIN;
    };

    function scan() {
      const shown = doc.querySelector(`.${MARK}`);
      const form = formFor(ctx.win?.location);
      const row = form ? doc.querySelector(FORMS[form].rows) : null;
      const cash = cashOnHand(doc);
      if (s.dismissed || !row?.parentElement || cash === null || cash < minCash()) {
        shown?.remove();
        return;
      }
      const text = reminderText(cash);
      if (shown) {
        const line = shown.querySelector(`.${MARK}-text`);
        if (line && line.textContent !== text) line.textContent = text;
        return;
      }
      const notNow = button(doc, { cls: `${MARK}-dismiss` }, 'Not now');
      notNow.addEventListener('click', () => {
        s.dismissed = true;
        doc.querySelector(`.${MARK}`)?.remove();
      });
      const node = badge(doc, { cls: MARK, tone: 'warn', block: true, attrs: { role: 'note' } },
        el('span', { class: `${MARK}-text`, ownerDocument: doc }, text), ' ', notNow);
      row.parentElement.before(node);
    }

    // Rows Torn renders later, and the sidebar's money changing.
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (records.every((r) => ctx.dom.ownChange(r, `.${MARK}`))) return;
      timers.clearTimeout(s.timer);
      s.timer = timers.setTimeout(() => {
        s.timer = null;
        if (state === s) scan();
      }, SETTLE_MS);
    }, doc);
    scan();
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    if (s.timer !== null) s.timers.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
