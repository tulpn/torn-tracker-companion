// Trade value calculator (CMP-201).
//
// On the trade page, under the whole trade (hq #557 A10), a line totals their money and items
// at torn-tracker.com's market value (CAPI-035, one lookup per change of the offer,
// cached for ten minutes), with a Copy button for a receipt to paste in the chat. It only
// shows: the script never accepts, adds or removes anything.
//
// The trade page names items but shows no id, so names are matched against the table in
// src/data/items.js (tools/build-items.mjs). An item it does not know is counted as
// "without a price", never guessed.
//
// CMP-309 (hq #339): the player may instead price at a buy list on torn-tracker.com,
// their own (the other side, what they buy) or a public trader's (their own side, what
// they sell). One read of the list per five minutes; an item the list doesn't buy is
// "not on the list", never $0. The money field is never filled, Accept never pressed.
//
// Inspiration: TornTools (GPLv3, https://github.com/Mephiles/torntools_extension) totals
// each side the same way, and Torn PDA (GPLv3, https://github.com/Manuito83/torn-pda)
// copies the total. No code was taken.

import { el, settler } from '../../core/dom.js';
import { ITEM_IDS } from '../../data/items.js';
import { listBasis, money, priceOffer, readSide, receipt } from './read.js';
import { OWN_SIDE, STEPS, THEIR_NAME, THEIR_SIDE } from './selectors.js';
import { bar as uiBar, button as uiButton, strip } from '../../core/ui.js';

const MARK = 'ttc-trade';
const SETTLE_MS = 250;

/** "their" or "own": which side of the trade a line prices. */
const sideName = (side) => (side.matches(OWN_SIDE) ? 'own' : 'their');

let state = null;

/** The trade's step from the hash: '#step=view&ID=1' -> 'view'. */
export function stepOf(hash) {
  return new URLSearchParams(String(hash || '').replace(/^#\/?/, '')).get('step');
}

export default {
  id: 'trade-value',
  wave: 2,
  title: 'Trade value',
  area: 'market',
  guide: 'trade-value',
  summary: 'Totals the other side of a trade at market value, with a receipt to copy.',
  routes: ['trade.php'],
  defaults: { enabled: true, priceAt: 'market', trader: '' },
  options: {
    priceAt: {
      label: 'Price a trade at',
      choices: ['market', 'mine', 'trader'],
      labels: {
        market: 'Market value (their side)',
        mine: 'Your own buy list (their side, you buy)',
        trader: "A trader's buy list (your side, you sell)",
      },
    },
    trader: { label: "The trader's name or id, for a trader's buy list", maxLength: 32 },
  },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)', 'Torn PDA (GPLv3)'],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, settle: null, stopWatching: null, seen: '', ids: ITEM_IDS };
    state = s;
    const alive = () => state === s;


    /** Our line for this side, if it's there. */
    const shownFor = (side) => {
      const node = doc.querySelector(`.${MARK}`);
      return node && node.dataset.side === sideName(side) ? node : null;
    };

    // Under the whole trade, at full width, not inside the 170 px side column, where it
    // wrapped a word at a time (hq #557 A10). It says which side it prices.
    function box(side) {
      const under = side.parentElement || side;
      let node = doc.querySelector(`.${MARK}`);
      if (!node) node = strip(doc, { cls: MARK, attrs: { 'data-tour': 'trade-value' } });
      if (node.dataset.side !== sideName(side)) node.dataset.side = sideName(side);
      if (under.nextElementSibling !== node) under.after(node);
      return node;
    }

    /** A line in place of the total, when the buy list can't be read (CMP-309). */
    function say(side, text) {
      box(side).replaceChildren(el('div', { ownerDocument: doc }, text));
    }

    function show(side, priced, trader, basis) {
      const node = box(side);
      const words = priced.unpriced ? `, ${priced.unpriced} ${basis ? basis.missingCount : 'without a price'}` : '';
      const copy = uiButton(doc, {}, 'Copy receipt');
      copy.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const text = receipt(priced, trader, basis);
        try {
          await win.navigator.clipboard.writeText(text);
          copy.textContent = 'Copied';
        } catch {
          // No clipboard (an old WebView, or permission refused): show it to copy by hand.
          const area = el('textarea', { readonly: true, ownerDocument: doc });
          area.value = text;
          node.append(area);
          area.select();
        }
      });
      const head = basis
        ? [`Items at ${basis.basis}: `, el('strong', { ownerDocument: doc }, money(priced.total)), words]
        : ['Their offer at market value: ', el('strong', { ownerDocument: doc }, money(priced.total)), words];
      const parts = [copy];
      if (basis?.link) parts.push(el('a', { href: basis.link, target: '_blank', rel: 'noopener noreferrer', ownerDocument: doc }, 'The list on torn-tracker.com'));
      node.replaceChildren(el('div', { ownerDocument: doc }, ...head), uiBar(doc, {}, ...parts));
    }

    /** The buy list to price at, or null for market value (CMP-309). */
    function listAsked() {
      const mode = ctx.settings?.priceAt;
      if (mode === 'mine') return { who: 'me', side: THEIR_SIDE };
      if (mode === 'trader') return { who: ctx.settings?.trader ?? '', side: OWN_SIDE };
      return null;
    }

    const LIST_TROUBLE = {
      no_key: 'To price at a buy list, add your script key under Keys in the Torn Tracker settings.',
      refused: 'torn-tracker.com refused your script key; check it under Keys.',
      bad_name: "Set the trader's name or id in the Torn Tracker settings, under Trade value.",
      not_found: 'torn-tracker.com has no public buy list by that name.',
      wait: 'torn-tracker.com asked to wait; the buy list is read again in a minute.',
      failed: "Couldn't read the buy list from torn-tracker.com.",
    };

    async function scan() {
      if (!STEPS.includes(stepOf(win.location?.hash))) return;
      const asked = listAsked();
      const side = doc.querySelector(asked ? asked.side : THEIR_SIDE);
      if (!side) return;
      const read = readSide(side, s.ids);
      // A buy list prices items only: the money on the side isn't bought.
      const offer = asked ? { cash: 0, items: read.items } : read;
      if (offer.cash === 0 && offer.items.length === 0) {
        doc.querySelector(`.${MARK}`)?.remove();
        s.seen = '';
        return;
      }
      // Only a changed offer is priced again.
      const key = JSON.stringify(offer);
      if (key === s.seen && shownFor(side)) return;
      s.seen = key;
      const trader = doc.querySelector(`${THEIR_SIDE} ${THEIR_NAME}`)?.textContent.trim() || '';
      if (asked) {
        const answer = ctx.site ? await ctx.site.buylist(asked.who) : { status: 'failed' };
        if (!alive()) return;
        if (answer.status !== 'ok') {
          // Not kept as seen: the next change of the page asks again (the site keeps its own pace).
          s.seen = '';
          say(side, LIST_TROUBLE[answer.status] ?? LIST_TROUBLE.failed);
          return;
        }
        show(side, priceOffer(offer, answer.list.prices), trader, listBasis(answer.list));
        return;
      }
      const ids = offer.items.map((item) => item.id).filter((id) => id !== null);
      const prices = ids.length && ctx.site ? await ctx.site.prices(ids) : new Map();
      if (!alive()) return;
      show(side, priceOffer(offer, prices), trader);
    }

    function later() {
      s.settle ??= settler(() => {
        scan().catch((err) => ctx.log('trade value', err));
      }, SETTLE_MS, { timers: win });
      s.settle.poke();
    }

    const ours = (r) => ctx.dom.ownChange(r, `.${MARK}`);
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (!records.every(ours)) later();
    }, doc);
    win.addEventListener('hashchange', later);
    s.onHash = later;
    later();
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    s.win.removeEventListener('hashchange', s.onHash);
    s.settle?.cancel();
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
