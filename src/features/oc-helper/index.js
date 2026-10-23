// OC helper (CMP-204, display half).
//
// On the faction's crimes page, each crime card gets the site's success estimate for it
// (when the faction has a key with faction API access on torn-tracker.com), and each slot
// gets its role's weight: how much that role counts towards the crime's success. Both
// come from torn-tracker.com (CAPI-035, accepted in hq #110), one call per crime name
// per page view. It only shows; nothing is joined or clicked.
//
// Torn's page shows no weights. The site takes them from tornprobability.com (D-074),
// and they are credited wherever they show: a line above the crimes and each weight's
// tooltip. The script itself never calls the provider.
//
// Slots are matched to roles by the title the page shows, which is the label Torn's API
// gives each position. Positions P1..P6 are not on the page.
//
// Inspiration: TornTools (GPLv3, https://github.com/Mephiles/torntools_extension) and
// OC2.0 Helper by Strigwulf (GPLv3, https://greasyfork.org/scripts/577968), which show
// weights beside each slot. No code was taken; they get their weights from a third-party
// service, this script only from torn-tracker.com.

import { el } from '../../core/dom.js';
import { CARD, CARD_ID, NAME, SLOT, SLOT_HEADER, SLOT_TITLE } from './selectors.js';
import { badge, note } from '../../core/ui.js';

const MARK = 'ttc-oc';
const SETTLE_MS = 250;

let state = null;

/** 'Looter #1', 'looter 1' and 'Looter1' are the same role. */
export function roleKey(label) {
  return String(label || '').toLowerCase().replace(/[\s#]+/g, '');
}

const CREDIT = 'ttc-oc-credit';

const pct = (n) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

export default {
  id: 'oc-helper',
  wave: 2,
  title: 'Organized crimes: weights and success',
  area: 'crimes',
  guide: 'oc-helper',
  summary: "Role weights and success estimates on your faction's organized crimes.",
  routes: ['factions.php#/tab=crimes'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)', 'OC2.0 Helper (GPLv3)'],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    /** name -> promise of the site's answer, asked once per page view */
    const asked = new Map();
    const s = { doc, win, timer: null, stopWatching: null };
    state = s;
    const alive = () => state === s;


    function label(parent, text, title, kind) {
      let node = parent.querySelector(`:scope > .${MARK}[data-kind="${kind}"]`);
      if (!node) {
        // The tour's anchors (hq #238), one per kind of label.
        const anchor = kind === 'success' ? { 'data-tour': 'oc-success' } : { 'data-tour': 'oc-weight' };
        node = badge(doc, { cls: MARK, tone: kind === 'success' ? 'good' : 'info', attrs: { 'data-kind': kind, ...anchor } });
        parent.append(node);
      }
      if (node.textContent !== text) node.textContent = text;
      node.title = title;
    }

    /** One visible credit line above the first crime card, once any weight shows. */
    function credit(card, source) {
      const text = `Role weights: ${source}, via torn-tracker.com`;
      let node = doc.querySelector(`.${CREDIT}`);
      if (!node) {
        node = note(doc, { cls: `${MARK} ${CREDIT}`, attrs: { 'data-kind': 'credit' } });
        const first = doc.querySelector(CARD);
        (first || card).before(node);
      }
      if (node.textContent !== text) node.textContent = text;
    }

    function paint(card, answer) {
      const id = Number(card.dataset[CARD_ID]);
      const success = answer.crimes.get(id);
      const name = card.querySelector(NAME);
      if (name?.parentElement && typeof success === 'number') {
        label(name.parentElement, `~${pct(success)}`, "torn-tracker.com's success estimate for this crime", 'success');
      }
      const weights = new Map((answer.roles || []).map((r) => [roleKey(r.label), r.weight]));
      for (const slot of card.querySelectorAll(SLOT)) {
        const title = slot.querySelector(SLOT_TITLE);
        const weight = weights.get(roleKey(title?.textContent));
        if (typeof weight !== 'number') continue;
        label(slot.querySelector(SLOT_HEADER) || slot, `${pct(weight)}`,
          `How much this role counts towards success. Weights from ${answer.weightsSource}, via torn-tracker.com`, 'weight');
        credit(card, answer.weightsSource);
      }
    }

    async function scan() {
      if (!ctx.site) return;
      for (const card of doc.querySelectorAll(CARD)) {
        const name = card.querySelector(NAME)?.textContent.trim();
        if (!name) continue;
        if (!asked.has(name)) asked.set(name, ctx.site.oc(name));
        const answer = await asked.get(name);
        if (!alive()) return;
        if (card.isConnected) paint(card, answer);
      }
    }

    function later() {
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => {
        s.timer = null;
        scan().catch((err) => ctx.log('oc helper', err));
      }, SETTLE_MS);
    }

    const ours = (r) => ctx.dom.ownChange(r, `.${MARK}`);
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (!records.every(ours)) later();
    }, doc);
    later();
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
