// The dashboard inside Torn (hq #465, companion-api §6.4b).
//
// /index.php#/torn-tracker/dashboard, while the "Dashboard (preview)" setting is on: the
// player's torn-tracker.com dashboard as cards, in the settings page's Shadow DOM host.
// One read of `GET /api/feeds/me/dashboard` each time the page opens, with the player's
// own script key; the site keeps the answer a minute and so does the script. Nothing
// ticks: bars and timers show the time they were read, and a card the site has nothing
// for is left out. Every card links to its page on torn-tracker.com.

import { barChart, CHART_STYLE, chartDeclarations, lineChart } from './chart.js';
import { el } from './dom.js';
import { DASHBOARD_CARDS, EDU_STATS, GYM_STATS } from './site.js';
import { left, roughly } from './sidebar.js';
import { declarations, lookTheme } from './tokens.js';

const P = 'ttc';
export const DASH_ID = `${P}-dash`;
const MONEY_DAYS = 7;

/** Where each card's "more" link goes, from the read's own links. */
const CARD_LINK = Object.freeze({
  bars: 'dashboard', money: 'finances', gym: 'stats', goals: 'finances', achievements: 'achievements', guide: 'guide',
  education: 'education', chain: 'war', war: 'war', oc: 'oc', stats: 'stats',
});
const CARD_TITLE = Object.freeze({
  bars: 'Bars', money: 'Money, last 7 days', gym: 'Next gym', goals: 'Savings goals', achievements: 'Next achievements',
  guide: 'Getting started', education: 'Education', chain: 'Chain', war: 'Ranked war', oc: 'Organized crime', stats: 'Battle stats',
});

const STYLE = `
  #${DASH_ID} {
    ${declarations('dark')} ${chartDeclarations('dark')}
    display: block; margin: 0 0 10px; container-type: inline-size;
    font: 14px/1.5 var(--tt-font-sans); color: var(--foreground);
  }
  #${DASH_ID}[data-theme="light"] { ${declarations('light')} ${chartDeclarations('light')} }
  #${DASH_ID}[hidden] { display: none; }
  #${DASH_ID} *, #${DASH_ID} *::before, #${DASH_ID} *::after { box-sizing: border-box; }
  #${DASH_ID} .${P}-sheet { background: var(--background); border: 1px solid var(--border); border-radius: var(--radius); }
  #${DASH_ID} .${P}-head {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 12px 16px;
    background: var(--card); border-bottom: 1px solid var(--border); border-radius: var(--radius) var(--radius) 0 0;
  }
  #${DASH_ID} .${P}-logo {
    display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9px;
    background: var(--primary); color: var(--primary-foreground); font: 800 13px/1 var(--tt-font-sans);
  }
  #${DASH_ID} h2 { margin: 0; font-size: 17px; font-weight: 700; }
  #${DASH_ID} h2 small { display: block; font-size: 11px; font-weight: 500; color: var(--muted-foreground); }
  #${DASH_ID} .${P}-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
  #${DASH_ID} a { color: var(--ring); }
  #${DASH_ID} .${P}-btn {
    display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 999px;
    border: 1px solid var(--border); background: var(--background); color: var(--foreground); font-weight: 600; text-decoration: none;
  }
  #${DASH_ID} .${P}-body { padding: 14px 16px 18px; }
  #${DASH_ID} .${P}-state { margin: 0 0 12px; color: var(--muted-foreground); }
  #${DASH_ID} .${P}-state:empty { display: none; }
  #${DASH_ID} .${P}-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  #${DASH_ID} .${P}-dcard {
    display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 12px 14px;
    background: var(--card); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--tt-shadow-sm);
  }
  #${DASH_ID} .${P}-hero { grid-column: 1 / -1; border-left: 4px solid var(--primary); }
  #${DASH_ID} .${P}-dcard h3 { margin: 0; font-size: 13px; font-weight: 700; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: .05em; }
  #${DASH_ID} .${P}-hero h3 { font-size: 20px; color: var(--foreground); text-transform: none; letter-spacing: 0; }
  #${DASH_ID} .${P}-dcard p { margin: 0; }
  #${DASH_ID} .${P}-muted { color: var(--muted-foreground); font-size: 12px; }
  #${DASH_ID} .${P}-big { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  #${DASH_ID} .${P}-rows { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
  #${DASH_ID} .${P}-row { display: flex; justify-content: space-between; gap: 10px; font-variant-numeric: tabular-nums; }
  #${DASH_ID} .${P}-row > :first-child { min-width: 0; overflow-wrap: anywhere; }
  #${DASH_ID} .${P}-meter { height: 6px; border-radius: 999px; background: var(--muted); overflow: hidden; }
  #${DASH_ID} .${P}-meter > span { display: block; height: 100%; border-radius: 999px; background: var(--primary); }
  #${DASH_ID} .${P}-meter[data-over] > span { background: var(--tt-warning); }
  #${DASH_ID} .${P}-more { margin-top: auto; display: inline-flex; align-items: center; min-height: 44px; font-weight: 600; text-decoration: none; }
  #${DASH_ID} .${P}-tag { display: inline-block; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
    background: color-mix(in srgb, var(--tt-warning) 18%, transparent); }
  #${DASH_ID} .${P}-steps { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
  #${DASH_ID} .${P}-step { display: flex; flex-direction: column; gap: 4px; min-height: 44px; padding: 8px 10px;
    border: 1px solid var(--border); border-radius: 8px; color: var(--foreground); text-decoration: none; }
  ${CHART_STYLE}
`;

const thousands = (n) => n.toLocaleString('en-US');
const dollars = (n) => `${n < 0 ? '-' : ''}$${thousands(Math.abs(n))}`;

/**
 * @param {object} opts
 * @param {Document} opts.doc
 * @param {ShadowRoot|Element} opts.root  the page host's shadow root
 * @param {{dashboard: () => Promise<object>}} opts.site
 * @param {() => object} opts.getSettings
 * @param {() => number} [opts.now]  the local clock the read's times are on
 */
export function mountDashboard({ doc = globalThis.document, root, site, getSettings, now = Date.now }) {
  const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);
  if (!root.querySelector?.(`style[data-ttc-dash]`)) {
    const style = h('style', { 'data-ttc-dash': '' });
    style.textContent = STYLE;
    root.append(style);
  }
  const state = h('p', { class: `${P}-state`, role: 'status' });
  const grid = h('div', { class: `${P}-grid` });
  const siteLink = h('a', { class: `${P}-btn`, href: 'https://www.torn-tracker.com/dashboard/', target: '_blank', rel: 'noopener noreferrer' }, 'Open on torn-tracker.com');
  const element = h('div', { id: DASH_ID, role: 'region', 'aria-label': 'Torn Tracker dashboard', hidden: true },
    h('div', { class: `${P}-sheet` },
      h('div', { class: `${P}-head` },
        h('span', { class: `${P}-logo`, 'aria-hidden': 'true' }, 'TT'),
        h('h2', null, 'Dashboard', h('small', null, 'From torn-tracker.com')),
        h('div', { class: `${P}-actions` }, siteLink, h('a', { class: `${P}-btn`, href: '#/torn-tracker' }, 'Settings'))),
      h('div', { class: `${P}-body` }, state, grid)));
  root.append(element);

  let open = false;
  let generation = 0;

  const more = (links, key) => h('a', { class: `${P}-more`, href: links[CARD_LINK[key]] ?? links.dashboard, target: '_blank', rel: 'noopener noreferrer' }, 'More on torn-tracker.com →');
  const meter = (value, max, label, over = false) => {
    const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
    const bar = h('span');
    bar.style.width = `${pct}%`;
    return h('div', {
      class: `${P}-meter`, role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct,
      'data-over': over || null,
    }, bar);
  };
  const ago = (at) => (at == null ? null : `read ${roughly(now() - at)} ago`);
  const until = (at) => (at == null ? null : (at > now() ? `in ${roughly(at - now())}` : 'now'));

  function hero(v, links) {
    const who = v.name ? `${v.name}${v.id ? ` [${v.id}]` : ''}` : 'Your dashboard';
    const facts = [v.level ? `Level ${v.level}` : null, v.faction ? v.faction.name : null].filter(Boolean).join(' · ');
    const rank = v.rank ? h('p', null, `${v.rank.name}: ${thousands(v.rank.points)} points`,
      v.rank.next ? h('span', { class: `${P}-muted` }, ` · ${thousands(Math.max(0, v.rank.next.points - v.rank.points))} to ${v.rank.next.name}`) : null) : null;
    const steps = v.steps.length ? h('div', { class: `${P}-steps` }, ...v.steps.map((s) => h('a', {
      class: `${P}-step`, href: s.url, target: '_blank', rel: 'noopener noreferrer',
    }, h('strong', null, s.title), s.detail ? h('span', { class: `${P}-muted` }, s.detail) : null,
    meter(s.value, s.max, `${s.title}: ${s.value} of ${s.max}`)))) : null;
    return h('section', { class: `${P}-dcard ${P}-hero`, 'data-card': 'hero' },
      h('h3', null, who), facts ? h('p', { class: `${P}-muted` }, facts) : null, rank, steps,
      h('a', { class: `${P}-more`, href: links.dashboard, target: '_blank', rel: 'noopener noreferrer' }, 'Your full dashboard →'));
  }

  const BODIES = {
    bars: (v) => [
      h('ul', { class: `${P}-rows` }, ...v.bars.map((b) => h('li', null,
        h('div', { class: `${P}-row` }, h('span', null, b.label), h('span', null, b.maximum ? `${thousands(b.current)} / ${thousands(b.maximum)}` : thousands(b.current))),
        b.maximum ? meter(b.current, b.maximum, `${b.label}: ${b.current} of ${b.maximum}`, b.over) : null))),
      ...v.effects.map((e) => h('p', { class: `${P}-muted` }, `${e.label}: ends ${until(e.until)}${e.note ? ` · ${e.note}` : ''}`)),
      v.observedAt != null ? h('p', { class: `${P}-muted` }, `As ${ago(v.observedAt)}; they don't count up here.`) : null,
    ],
    money(v) {
      const rows = v.series.slice(-MONEY_DAYS);
      const sum = (k) => rows.reduce((t, r) => t + (r[k] ?? 0), 0);
      return [
        h('div', { class: `${P}-row` }, h('span', null, 'In'), h('strong', null, dollars(sum('income')))),
        h('div', { class: `${P}-row` }, h('span', null, 'Out'), h('strong', null, dollars(sum('cost')))),
        barChart(doc, { rows, series: [{ key: 'income', label: 'Income' }, { key: 'cost', label: 'Costs' }], label: 'Income and costs per day', format: dollars }),
      ];
    },
    gym: (v) => (v.nextGym === null
      ? [h('p', null, "You're at the last gym.")]
      : [
        h('p', null, h('strong', null, v.nextGym), h('span', { class: `${P}-tag` }, ' estimate')),
        meter(v.percent, 100, `${v.nextGym}: about ${v.percent}%`),
        h('p', { class: `${P}-muted` }, `About ${v.percent}% there${v.energy != null ? `, roughly ${thousands(v.energy)} energy to go` : ''}. An estimate, not Torn's figure.`),
      ]),
    goals: (v) => [
      v.saved != null ? h('p', null, h('span', { class: `${P}-big` }, dollars(v.saved)), h('span', { class: `${P}-muted` }, ' saved')) : null,
      h('ul', { class: `${P}-rows` }, ...v.active.map((g) => h('li', null,
        h('div', { class: `${P}-row` }, h('span', null, g.name), h('span', null, g.reached ? 'Reached' : `${dollars(g.remaining)} to go`)),
        g.pct != null ? meter(g.pct, 100, `${g.name}: ${g.pct}%`) : null))),
    ],
    achievements: (v) => [h('ul', { class: `${P}-rows` }, ...v.next.map((a) => h('li', null,
      h('div', { class: `${P}-row` }, h('strong', null, a.name), h('span', { class: `${P}-muted` }, `${a.points} pts`)),
      a.description ? h('p', { class: `${P}-muted` }, a.description) : null,
      a.progress ? meter(a.progress.value, a.progress.target, `${a.name}: ${a.progress.value} of ${a.progress.target}`) : null)))],
    guide: (v) => [
      h('p', null, h('span', { class: `${P}-big` }, `${v.done} / ${v.total}`), h('span', { class: `${P}-muted` }, ' steps done')),
      meter(v.done, v.total, `Guide: ${v.done} of ${v.total}`),
      v.bonuses ? h('p', null, `${v.bonuses} bonus${v.bonuses === 1 ? '' : 'es'} to claim`) : null,
      h('ul', { class: `${P}-rows` }, ...v.steps.filter((s) => !s.done).slice(0, 3).map((s) => h('li', null, s.title))),
    ],
    education: (v) => [
      v.position ? h('p', null, v.position) : null,
      v.complete ? h('p', null, 'Every course is done.') : null,
      v.next ? h('p', null, `Next: ${v.next.to}${v.next.job ? ` (for ${v.next.job})` : ''}`,
        v.next.daysLeft != null ? h('span', { class: `${P}-muted` }, ` · ${v.next.daysLeft} days`) : null) : null,
    ],
    chain: (v) => [
      h('p', null, h('span', { class: `${P}-big` }, `${thousands(v.current)} / ${thousands(v.max)}`)),
      meter(v.current, v.max, `Chain: ${v.current} of ${v.max}`),
      v.timeoutAt != null ? h('p', { class: `${P}-muted` }, `Timeout was ${left(v.timeoutAt - (v.asOf ?? now()))} when read`) : null,
    ],
    war: (v) => [
      h('p', null, `Against ${v.opponent}`),
      h('div', { class: `${P}-row` }, h('span', null, 'Us'), h('strong', null, thousands(v.ours))),
      h('div', { class: `${P}-row` }, h('span', null, 'Them'), h('strong', null, thousands(v.theirs))),
      h('p', { class: `${P}-muted` }, `Target ${thousands(v.target)}${v.finishAt != null ? ` · ends ${until(v.finishAt)}` : ''}`),
    ],
    oc: (v) => [
      h('p', null, h('strong', null, v.name), h('span', { class: `${P}-muted` }, ` · ${v.state}`)),
      v.readyAt != null ? h('p', { class: `${P}-muted` }, `Ready ${until(v.readyAt)}`) : null,
      v.needsMe ? h('p', null, h('span', { class: `${P}-tag` }, 'Needs you')) : null,
    ],
    stats: (v) => [
      v.gym.length >= 2 ? lineChart(doc, { rows: v.gym, series: GYM_STATS.map((k) => ({ key: k, label: k })), label: 'Battle stats over time' }) : null,
      v.edu.length >= 2 ? lineChart(doc, { rows: v.edu, series: EDU_STATS.map((k) => ({ key: k, label: k })), label: 'Working stats over time' }) : null,
    ],
  };

  function card(key, value, links) {
    return h('section', { class: `${P}-dcard`, 'data-card': key },
      h('h3', null, CARD_TITLE[key]), ...BODIES[key](value), more(links, key));
  }

  function show(read) {
    siteLink.setAttribute('href', read.links.dashboard);
    const cards = DASHBOARD_CARDS.filter((key) => read.cards.get(key) != null).map((key) => card(key, read.cards.get(key), read.links));
    grid.replaceChildren(hero(read.hero, read.links), ...cards);
    state.textContent = cards.length ? '' : 'Nothing to show yet: the cards fill in as torn-tracker.com learns about you.';
  }

  function say(words, link) {
    grid.replaceChildren();
    state.replaceChildren(words, ...(link ? [' ', h('a', { href: link.href }, link.text)] : []));
  }

  async function load() {
    const mine = ++generation;
    say('Loading your dashboard…');
    let result;
    try {
      result = await site.dashboard();
    } catch {
      result = { status: 'failed' };
    }
    if (mine !== generation || !open) return;
    if (result?.status === 'ok') show(result);
    else if (result?.status === 'no_key') say('The dashboard needs your torn-tracker.com script key.', { href: '#/torn-tracker/keys', text: 'Add it in Keys' });
    else if (result?.status === 'refused') say('torn-tracker.com refused the script key. Check it in Keys.', { href: '#/torn-tracker/keys', text: 'Open Keys' });
    else if (result?.status === 'wait') say(`torn-tracker.com asked to wait. Try again in ${roughly(result.retryMs ?? 60_000)}.`);
    else say("Couldn't reach torn-tracker.com. Try again in a minute.");
  }

  return {
    element,
    isOpen: () => open,
    /** Shows the page and reads the dashboard once. */
    open() {
      element.dataset.theme = lookTheme(getSettings()?.look, doc);
      element.hidden = false;
      if (open) return;
      open = true;
      load();
    },
    close() {
      open = false;
      generation += 1;
      element.hidden = true;
    },
    destroy() {
      this.close();
      element.remove();
    },
  };
}
