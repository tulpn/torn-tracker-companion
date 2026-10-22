// Applicant badges on Torn's application lists (JOB-072, CMP-302; read accepted in hq #79).
//
// When a company director or faction recruiter opens their own application list, each
// applicant who shared a job-board card and applied to that board gets a badge: merit
// level, job points and how well they fit, linking to their card on torn-tracker.com.
// The site decides whose board it is from the player's verified role, never from the
// page, and answers nothing for anyone else.
//
// Nothing from these pages is ever shared as an observation (core/share.js refuses any
// kind on application pages), and nothing is accepted, declined or clicked.
//
// No open-source script reads these lists' markup, so applicants are found by their
// profile links in the page's main content. A capture should confirm where badges land.

import { ownIdFrom } from '../bazaar-capture/read.js';
import { badge as uiBadge } from '../../core/ui.js';

const MARK = 'ttc-applicant';
const CONTENT = '.content-wrapper';
const PROFILE = "a[href*='profiles.php?XID=']";
const SETTLE_MS = 400;
const TONE = { good: 'good', fair: 'warn', poor: 'bad' };
const FIT = { good: 'good fit', fair: 'fair fit', poor: 'poor fit' };

let state = null;

/** Which application list this is, from the address: 'company', 'faction' or null. */
export function boardOf(loc) {
  const page = String(loc?.pathname || '').split('/').pop();
  const hash = new URLSearchParams(String(loc?.hash || '').replace(/^#\/?/, ''));
  if (page === 'companies.php' && hash.get('option') === 'applications') return 'company';
  if (page === 'factions.php' && hash.get('tab') === 'controls' && hash.get('option') === 'application') return 'faction';
  return null;
}

/** The badge's words: "10 merits · 1,234 job points · good fit". */
export function badgeText(card) {
  return [
    card.merits !== null ? `${card.merits} merits` : null,
    card.job_points !== null ? `${card.job_points.toLocaleString('en-US')} job points` : null,
    card.fit ? FIT[card.fit] : null,
  ].filter(Boolean).join(' · ') || 'shared card';
}

export default {
  id: 'applicant-badges',
  wave: 3,
  title: 'Applicant badges',
  area: 'jobs',
  guide: 'applicant-badges',
  summary: 'Shared job-board cards beside applicants on your company or faction list.',
  routes: ['companies.php', 'factions.php#/tab=controls'],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: true },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null, stopWatching: null, asked: new Set(), cards: new Map(), allowed: true };
    state = s;
    const alive = () => state === s;
    const self = ownIdFrom(doc.cookie);

    function links() {
      const out = [];
      for (const a of doc.querySelectorAll(`${CONTENT} ${PROFILE}`)) {
        if (a.closest(`.${MARK}`)) continue;
        const m = /[?&]XID=(\d+)/.exec(a.getAttribute('href') || '');
        const id = m ? Number(m[1]) : null;
        if (id && id !== self) out.push({ id, a });
      }
      return out;
    }

    function paint() {
      const placed = new Set();
      for (const { id, a } of links()) {
        const card = s.cards.get(id);
        if (!card || placed.has(id)) continue;
        placed.add(id);
        if (a.nextElementSibling?.classList.contains(MARK)) continue;
        const badge = card.card_url
          ? uiBadge(doc, { cls: MARK, tag: 'a', tone: TONE[card.fit] || 'info', attrs: { href: card.card_url, target: '_blank', rel: 'noopener noreferrer' } }, badgeText(card))
          : uiBadge(doc, { cls: MARK, tone: TONE[card.fit] || 'info' }, badgeText(card));
        badge.title = 'Their shared job-board card on torn-tracker.com';
        a.after(badge);
      }
    }

    async function look() {
      const board = boardOf(win.location);
      if (!alive() || !board || !s.allowed || !ctx.site?.applicantCards) return;
      const fresh = [...new Set(links().map((l) => l.id))].filter((id) => !s.asked.has(id));
      if (fresh.length) {
        for (const id of fresh) s.asked.add(id);
        const answer = await ctx.site.applicantCards(board, fresh);
        if (!alive()) return;
        if (!answer.allowed) {
          s.allowed = false;
          return;
        }
        for (const [id, card] of answer.cards) s.cards.set(id, card);
      }
      paint();
    }

    const later = () => {
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => look().catch((err) => ctx.log('applicant badges', err)), SETTLE_MS);
    };
    const ours = (r) => [r.target, ...r.addedNodes, ...r.removedNodes]
      .every((n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(`.${MARK}`));
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
    s.win.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
