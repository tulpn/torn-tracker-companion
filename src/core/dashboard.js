// The dashboard inside Torn (hq #465, companion-api §6.4b).
//
// /index.php#/torn-tracker/dashboard, while the "Dashboard (preview)" setting is on: the
// player's torn-tracker.com dashboard as cards, in the settings page's Shadow DOM host.
// One read of `GET /api/feeds/me/dashboard` each time the page opens, with the player's
// own script key; the site keeps the answer a minute and so does the script. Nothing
// ticks: timers show the time they were read, and a card the site has nothing for is left
// out. hq #491 (D-170): what needs the player now comes first, the hero, bars and battle
// stats are gone, and each card links to its own page on torn-tracker.com, never to the
// dashboard page; the one dashboard link is at the top. Part 2 adds the alerts, chain watch
// and awards cards, the war's start and dibs, and the running course in education.

import { barChart, CHART_STYLE, chartDeclarations } from './chart.js';
import { el } from './dom.js';
import { ROLE_NAMES } from './rota.js';
import { DASHBOARD_CARDS } from './site.js';
import { left, roughly } from './sidebar.js';
import { declarations, lookTheme } from './tokens.js';

const P = 'ttc';
export const DASH_ID = `${P}-dash`;
const MONEY_DAYS = 7;

const CARD_TITLE = Object.freeze({
  alerts: 'Alerts', war: 'Ranked war', chain_watch: 'Chain watch', chain: 'Chain', oc: 'Organized crime',
  awards: 'Nearest awards', education: 'Education', gym: 'Next gym', goals: 'Savings goals',
  achievements: 'Next achievements', guide: 'Getting started', money: 'Money, last 7 days',
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
  #${DASH_ID} .${P}-dcard h3 { margin: 0; font-size: 13px; font-weight: 700; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: .05em; }
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
  #${DASH_ID} .${P}-sub { margin: 4px 0 0; font-size: 12px; font-weight: 700; color: var(--muted-foreground); }
  #${DASH_ID} .${P}-tag { display: inline-block; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
    background: color-mix(in srgb, var(--tt-warning) 18%, transparent); }
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

  // hq #491: the card's own page, or no link at all; never the dashboard page.
  const more = (url) => (url ? h('a', { class: `${P}-more`, href: url, target: '_blank', rel: 'noopener noreferrer' }, 'More on torn-tracker.com →') : null);
  const meter = (value, max, label, over = false) => {
    const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
    const bar = h('span');
    bar.style.width = `${pct}%`;
    return h('div', {
      class: `${P}-meter`, role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct,
      'data-over': over || null,
    }, bar);
  };
  const until = (at) => (at == null ? null : (at > now() ? `in ${roughly(at - now())}` : 'now'));
  const ago = (at) => (at == null ? null : (at < now() ? `${roughly(now() - at)} ago` : 'just now'));
  const role = (r) => r.label ?? ROLE_NAMES[r.role];
  const chainBody = (v) => [
    h('p', null, h('span', { class: `${P}-big` }, `${thousands(v.current)} / ${thousands(v.max)}`)),
    meter(v.current, v.max, `Chain: ${v.current} of ${v.max}`),
    v.timeoutAt != null ? h('p', { class: `${P}-muted` }, `Timeout was ${left(v.timeoutAt - (v.asOf ?? now()))} when read`) : null,
  ];
  // An empty slot is said, not hidden: nobody on watch is worth knowing.
  const slot = (heading, v) => (v ? [
    h('p', { class: `${P}-sub` }, heading),
    v.holders.length
      ? h('ul', { class: `${P}-rows` }, ...v.holders.map((x) => h('li', { class: `${P}-row` },
        h('span', null, x.mine ? h('strong', null, `${x.name} (you)`) : x.name), h('span', { class: `${P}-muted` }, role(x)))))
      : h('p', { class: `${P}-muted` }, 'Nobody on watch.'),
  ] : []);

  const BODIES = {
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
    alerts: (v) => [h('ul', { class: `${P}-rows` }, ...v.map((a) => h('li', { class: `${P}-row` },
      a.url ? h('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, a.title) : h('span', null, a.title),
      a.at != null ? h('span', { class: `${P}-muted` }, ago(a.at)) : null)))],
    chain_watch: (v) => [
      v.mine.now ? h('p', null, h('span', { class: `${P}-tag` }, `You're on watch now: ${ROLE_NAMES[v.mine.now]}`)) : null,
      ...slot('Now', v.now),
      ...slot(v.next ? `Next, ${until(v.next.startsAt)}` : '', v.next),
      v.mine.next ? h('p', null, `Your next watch: ${ROLE_NAMES[v.mine.next.role]}, ${until(v.mine.next.startsAt)}`) : null,
      v.gaps ? h('p', { class: `${P}-muted` }, `${v.gaps} slot${v.gaps === 1 ? '' : 's'} in the next 24 h ${v.gaps === 1 ? 'has' : 'have'} no Lead.`) : null,
      ...(v.chain ? [h('p', { class: `${P}-sub` }, 'Chain'), ...chainBody(v.chain)] : []),
    ],
    awards: (v) => [h('ul', { class: `${P}-rows` }, ...v.nearest.map((a) => h('li', null,
      h('div', { class: `${P}-row` },
        a.url ? h('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, a.name) : h('strong', null, a.name),
        h('span', { class: `${P}-muted` }, a.detail ?? `${Math.floor(a.pct)}%`)),
      a.description ? h('p', { class: `${P}-muted` }, `${a.kind === 'medal' ? 'Medal' : 'Honor'} · ${a.description}`) : null,
      meter(a.pct, 100, `${a.name}: ${Math.floor(a.pct)}%`))))],
    education: (v) => [
      v.course ? h('p', null, 'Studying ', h('strong', null, v.course.name),
        v.course.finishesAt != null ? h('span', { class: `${P}-muted` }, ` · done ${until(v.course.finishesAt)}`) : null) : null,
      v.branch ? h('p', { class: `${P}-muted` }, `${v.branch.name}: ${v.branch.done} of ${v.branch.total} courses`) : null,
      v.branch ? meter(v.branch.done, v.branch.total, `${v.branch.name}: ${v.branch.done} of ${v.branch.total}`) : null,
      v.nextCourse ? h('p', null, `Your next pick: ${v.nextCourse.name}`) : null,
      v.position ? h('p', null, v.position) : null,
      v.complete ? h('p', null, 'Every course is done.') : null,
      v.next ? h('p', null, `Next: ${v.next.to}${v.next.job ? ` (for ${v.next.job})` : ''}`,
        v.next.daysLeft != null ? h('span', { class: `${P}-muted` }, ` · ${v.next.daysLeft} days`) : null) : null,
    ],
    chain: chainBody,
    war: (v) => (v.state === 'scheduled'
      ? [
        h('p', null, `Against ${v.opponent}`),
        h('p', null, h('strong', null, v.startsAt != null ? `Starts ${until(v.startsAt)}` : 'Matched, not started')),
        h('p', { class: `${P}-muted` }, `Target ${thousands(v.target)}`),
      ]
      : [
        h('p', null, `Against ${v.opponent}`),
        h('div', { class: `${P}-row` }, h('span', null, 'Us'), h('strong', null, thousands(v.ours))),
        h('div', { class: `${P}-row` }, h('span', null, 'Them'), h('strong', null, thousands(v.theirs))),
        h('p', { class: `${P}-muted` }, `Target ${thousands(v.target)}${v.finishAt != null ? ` · ends ${until(v.finishAt)}` : ''}`),
        ...(v.dibs.length ? [
          h('p', { class: `${P}-sub` }, 'Your dibs'),
          h('ul', { class: `${P}-rows` }, ...v.dibs.map((d) => h('li', { class: `${P}-row` },
            h('span', null, d.name), h('span', { class: `${P}-muted` }, d.expiresAt > now() ? `${left(d.expiresAt - now())} left` : 'expired')))),
        ] : []),
      ]),
    oc: (v) => [
      h('p', null, h('strong', null, v.name), h('span', { class: `${P}-muted` }, ` · ${v.state}`)),
      v.readyAt != null ? h('p', { class: `${P}-muted` }, `Ready ${until(v.readyAt)}`) : null,
      v.needsMe ? h('p', null, h('span', { class: `${P}-tag` }, 'Needs you')) : null,
    ],
  };

  function card(key, value, url) {
    return h('section', { class: `${P}-dcard`, 'data-card': key },
      h('h3', null, CARD_TITLE[key]), ...BODIES[key](value), more(url));
  }

  function show(read) {
    siteLink.setAttribute('href', read.links.dashboard);
    const cards = DASHBOARD_CARDS.filter((key) => read.cards.get(key) != null)
      .map((key) => card(key, read.cards.get(key), read.cardLinks?.get(key) ?? null));
    grid.replaceChildren(...cards);
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
