// The Torn Tracker block in Torn's sidebar (CMP-108).
//
// A collapsible block of its own after Torn's "Lists", shaped like Torn's own blocks and
// coloured by the suite's tokens in Torn's theme (WP-UI-8), with a few live facts the
// player would otherwise open the site or Discord for. It has a master switch, and every
// item has its own switch (Settings → Sidebar). An item with nothing to say is left out,
// and the block hides itself when every item is empty.
//
// One read feeds it: GET /api/feeds/me/sidebar with the items switched on (site.sidebar).
// It's asked when the block is opened, then at most once a minute, and only while the
// block is open and the tab is visible. Countdowns tick locally between reads. Every link
// is plain navigation (a profile, an attack page, the site): the game action is still the
// player's own click on Torn's page. A local item (the shop price highlighter's count)
// is never asked for: it comes from this page and is shown whatever the read says.
//
// Facts, not code: TornTools (GPLv3) and The Contract look for the sidebar in the same
// two places as core/entry.js.

import { el, ownChange } from './dom.js';
import { SITE } from '../hosts.js';
import { OURS, SIDEBAR } from './entry.js';
import { followTorn } from './tokens.js';
import { onProfitable, profitableCount } from './shops.js';
import { watchLine } from './rota.js';

const P = 'ttc';
export const BLOCK_ID = `${P}-sidebar-block`;
export const READ_EVERY_MS = 60_000;

/** The items, in the order the block shows them, with the spec's defaults. All Core. */
export const SIDEBAR_ITEMS = Object.freeze([
  { id: 'chain', title: 'Chain', summary: 'Your faction’s chain count and its timeout, counting down.', on: true },
  { id: 'watch', title: 'Chain watch', summary: 'Your chain watch now or next, and a switch for watch mode.', on: true },
  { id: 'war', title: 'Ranked war', summary: 'The score, the target and when the war should end. Only during a war.', on: true },
  { id: 'terms', title: 'War terms', summary: 'The terms your faction agreed for this war, or “NOT TERMED”. Only during a war.', on: true },
  { id: 'partner', title: 'Med-out partner', summary: 'Your partner, linking to their profile. Hidden when you have none.', on: true },
  { id: 'dibs', title: 'My dibs', summary: 'The targets you hold, with time left, linking to each attack page.', on: true },
  { id: 'oc', title: 'Organised Crime', summary: 'Your OC and its state, and when it needs you.', on: true },
  { id: 'guide', title: 'Guide', summary: 'Your progress in the torn-tracker guide, and bonuses to claim.', on: true },
  { id: 'travel', title: 'Best travel run', summary: 'Your planner’s best run right now, with its profit per hour.', on: false },
  { id: 'loot', title: 'NPC loot', summary: 'The next loot level per NPC and when it comes, with the source credited.', on: false },
  { id: 'gym', title: 'Gym', summary: 'How far you are towards your next gym.', on: false },
  { id: 'stocks', title: 'Stock watches', summary: 'How many of your watched stocks crossed their line.', on: false },
  { id: 'shops', title: 'Below shop price', summary: 'On the Item Market: how many listings on screen sell below what a shop pays.', on: true, local: true },
  { id: 'links', title: 'Quick links', summary: 'Your dashboard, the war room and the guide on torn-tracker.com.', on: true },
]);

/** The quick links when the site sends none. */
const LINKS = Object.freeze([
  { label: 'Dashboard', url: `${SITE}/` },
  { label: 'Guide', url: `${SITE}/guide/` },
]);
const GUIDE_URL = `${SITE}/guide/`;
const PLANNER_URL = `${SITE}/travel/`;
const STOCKS_URL = `${SITE}/stocks/`;

const STYLE = `
  ${followTorn(`#${BLOCK_ID}`)}
  #${BLOCK_ID} { margin-top: 8px; font: 12px/1.4 var(--tt-font-sans); color: var(--card-foreground); }
  #${BLOCK_ID} .${P}-sb-head {
    display: flex; align-items: center; gap: 6px; width: 100%; min-height: 32px; padding: 0 8px; border: 0; cursor: pointer;
    border-radius: var(--radius) var(--radius) 0 0; background: var(--card); color: inherit;
    font: 700 13px/1 var(--tt-font-sans); text-align: left;
  }
  #${BLOCK_ID} .${P}-sb-head:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
  #${BLOCK_ID} .${P}-sb-head::before {
    content: ""; width: 4px; height: 14px; border-radius: 2px; background: var(--primary);
  }
  #${BLOCK_ID} .${P}-sb-head::after { content: "▾"; margin-left: auto; transition: transform var(--tt-duration-fast) var(--tt-ease); }
  #${BLOCK_ID}[data-open="false"] .${P}-sb-head { border-radius: var(--radius); }
  #${BLOCK_ID}[data-open="false"] .${P}-sb-head::after { transform: rotate(-90deg); }
  #${BLOCK_ID}[data-open="false"] .${P}-sb-body { display: none; }
  #${BLOCK_ID} .${P}-sb-body {
    padding: 4px 8px 6px; border-radius: 0 0 var(--radius) var(--radius); background: var(--card);
    border-top: 1px solid var(--border);
  }
  #${BLOCK_ID} .${P}-sb-row { padding: 3px 0; overflow-wrap: anywhere; }
  #${BLOCK_ID} .${P}-sb-row + .${P}-sb-row { border-top: 1px dashed var(--border); }
  #${BLOCK_ID} .${P}-sb-row b { font-weight: 700; }
  #${BLOCK_ID} .${P}-sb-row a { color: var(--ring); text-decoration: none; }
  #${BLOCK_ID} .${P}-sb-row a:hover { text-decoration: underline; }
  #${BLOCK_ID} .${P}-sb-muted { color: var(--muted-foreground); }
  #${BLOCK_ID} .${P}-sb-alert { color: color-mix(in srgb, var(--destructive) 65%, var(--foreground)); font-weight: 700; }
  #${BLOCK_ID} .${P}-sb-links a { margin-right: 10px; }
  #${BLOCK_ID} .${P}-sb-switch {
    margin-left: 6px; padding: 1px 8px; border: 1px solid var(--border); border-radius: 999px; cursor: pointer;
    background: transparent; color: inherit; font: 600 11px/1.6 var(--tt-font-sans);
  }
  #${BLOCK_ID} .${P}-sb-switch[aria-pressed="true"] { background: var(--primary); color: var(--primary-foreground); border-color: var(--primary); }
  @media (pointer: coarse) {
    #${BLOCK_ID} .${P}-sb-head { min-height: 44px; }
    #${BLOCK_ID} .${P}-sb-links a { display: inline-flex; align-items: center; min-height: 44px; }
    #${BLOCK_ID} .${P}-sb-switch { min-height: 44px; }
  }
`;

function addStyle(doc) {
  if (doc.getElementById(`${P}-sidebar-style`)) return;
  const style = el('style', { id: `${P}-sidebar-style`, ownerDocument: doc });
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/** 2:31, 1:02:09: time left on a countdown. */
export function left(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "3h 20m", "12m": a rough time until. */
export function roughly(ms) {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m >= 60) return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
  return `${m}m`;
}

const thousands = (n) => n.toLocaleString('en-US');
const short = (n) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1).replace(/\.0$/, '')}m`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return `$${n}`;
};

/** The items the read is asked for: switched on, not the static quick links, not local. */
export function askedItems(settings) {
  const sb = settings?.sidebar;
  if (!sb?.enabled) return [];
  return SIDEBAR_ITEMS.filter((item) => item.id !== 'links' && !item.local && sb.items?.[item.id] === true).map((item) => item.id);
}

/** One of Torn's sidebar entries (Friends, Enemies, Targets under Lists). */
const ENTRY = "[id^='nav-'], [class*='area-desktop'], [class*='area-mobile']";

/**
 * Where the block goes: after Torn's Lists, or after Areas when Lists can't be found.
 * On the captured desktop sidebar (2026-10-23) Lists isn't a wrapper: it's a header with
 * the h2 "Lists", followed by its entries as siblings. So the block goes after the last
 * of those entries; where Lists is a wrapper, it has no such siblings, and the block
 * goes after the wrapper.
 */
export function anchorOf(doc) {
  const areas = doc.querySelector(SIDEBAR);
  if (!areas) return null;
  const scope = doc.querySelector('#sidebarroot') || doc.querySelector('#sidebar') || doc.body;
  const heading = [...scope.querySelectorAll('h2, h3, [class*="title"], [class*="header"]')]
    .find((n) => n.children.length === 0 && n.textContent.trim() === 'Lists');
  if (heading) {
    // Climb until the next step up would also hold Areas: that's the Lists header or block.
    let block = heading;
    while (block.parentElement && block.parentElement !== scope && !block.parentElement.contains(areas)) block = block.parentElement;
    if (!block.contains(areas)) {
      let last = block;
      for (let n = block.nextElementSibling; n; n = n.nextElementSibling) {
        if (n.id === BLOCK_ID) continue;
        if (!n.matches(ENTRY)) break;
        last = n;
      }
      return last;
    }
  }
  return areas.closest("[class*='sidebar-block'], [class*='toggle-block']") || areas;
}

/**
 * @param {object} opts
 * @param {Document} opts.doc
 * @param {object} opts.site                  core/site.js
 * @param {() => object} opts.getSettings
 * @param {(handler: Function, doc: Document) => () => void} opts.onMutation
 * @param {{read: Function, write: Function}} opts.store  the block's open state on this device
 * @param {object} [opts.timers]
 * @param {() => number} [opts.now]
 * @param {object} [opts.watch]               core/watch.js's controller, for the line's switch
 * @param {(item: object|null) => void} [opts.onWatch]  each answer's `watch` item (CHW-026)
 */
export function mountSidebarBlock({
  doc = globalThis.document, site, getSettings, onMutation, store, timers = doc.defaultView || globalThis, now = Date.now,
  watch = null, onWatch = null,
}) {
  addStyle(doc);
  const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);

  /** null until the player opens or closes it: then the default for where it sits. */
  let openState = null;
  let block = null;
  /** The last answer: status, items, links, and when it came. */
  let answer = null;
  let lastAsked = 0;
  let notBefore = 0;
  let readTimer = null;
  let tick = null;
  let placeTimer = null;
  let stopped = false;

  store.read().then((saved) => {
    if (typeof saved?.open === 'boolean' && openState === null) {
      openState = saved.open;
      place();
    }
  }).catch(() => {});

  /** On a phone or in PDA's slide-out the block starts closed; on a desktop, open. */
  const isOpen = () => openState ?? !doc.querySelector('.areasWrapper');
  const enabled = () => getSettings()?.sidebar?.enabled === true;

  function row(...children) {
    return h('div', { class: `${P}-sb-row` }, ...children);
  }

  const link = (href, text, external = false) => h('a', external
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { href }, text);
  const until = (at) => h('span', { 'data-ttc-until': String(at) }, left(at - now()));

  /** One line per item with something to say; an item without is left out. */
  const LINES = {
    chain: (c) => (c.current === 0
      ? row(h('b', null, 'Chain'), ' none')
      : row(h('b', null, 'Chain'), ` ${thousands(c.current)} / ${thousands(c.max)}`, ...(c.timeoutAt ? [' · ', until(c.timeoutAt)] : []))),
    war(w) {
      const diff = w.ours - w.theirs;
      return row(h('b', null, 'War'), ` vs ${w.opponent}: `,
        h('span', { class: diff < 0 ? `${P}-sb-alert` : '' }, `${diff >= 0 ? '+' : '−'}${thousands(Math.abs(diff))}`),
        ` · ${thousands(w.ours)} / ${thousands(w.target)}`,
        ...(w.finishAt ? [` · ends in ~${roughly(w.finishAt - now())}`] : []));
    },
    // CHW-011, CHW-021: "Watching now · Lead", the next slot, or a way to sign up; and the
    // switch for watch mode, which any member may use, slot or not.
    watch(w) {
      const text = watchLine(w);
      const words = w.now || w.next ? h('span', { class: w.now ? `${P}-sb-alert` : '' }, ` ${text}`)
        : [' ', link('/index.php#/torn-tracker/watch', text)];
      const gaps = w.gaps ? h('span', { class: `${P}-sb-muted` }, ` · ${w.gaps} without a Lead`) : null;
      return row(h('b', null, 'Watch'), ...[words].flat(), gaps, watchSwitch());
    },
    terms: (t) => row(h('b', null, 'Terms'), ` ${t.label}`),
    partner: (p) => row(h('b', null, 'Med-out partner'), ' ', link(`/profiles.php?XID=${p.id}`, p.name)),
    dibs: (rows) => row(h('b', null, 'My dibs'), ...rows.flatMap((d, i) => [
      i ? ' · ' : ' ', link(`/loader.php?sid=attack&user2ID=${d.id}`, d.name), ' ', until(d.expiresAt)])),
    oc(o) {
      let state = o.state;
      if (o.state === 'ready' && o.readyAt && o.readyAt > now()) state = `ready in ${roughly(o.readyAt - now())}`;
      return row(h('b', null, 'OC'), ` ${o.name} · `, o.needsMe ? h('span', { class: `${P}-sb-alert` }, 'needs you') : state);
    },
    guide: (g) => (g.done >= g.total && g.bonuses === 0 ? null
      : row(link(GUIDE_URL, `Guide ${g.done} / ${g.total}`, true),
        g.bonuses ? ` · ${g.bonuses} bonus${g.bonuses === 1 ? '' : 'es'} to claim` : '')),
    travel: (r) => row(h('b', null, 'Travel'), ' ',
      link(PLANNER_URL, `${r.country.replace(/-/g, ' ')} · ${r.item_name} · +${short(r.profit_per_hour)}/h`, true)),
    loot: (l) => row(h('b', null, 'Loot'), ...l.npcs.map((n) => ` ${n.name} L${n.level}${n.nextAt ? ` → L${n.level + 1} in ${roughly(n.nextAt - now())}` : ''};`),
      h('span', { class: `${P}-sb-muted` }, ` (${l.source})`)),
    gym: (g) => row(h('b', null, 'Gym'), g.nextGym === null ? ' every gym unlocked' : ` ${Math.round(g.percent)}% to ${g.nextGym}`),
    stocks: (s) => row(link(STOCKS_URL, `${s.crossed} of ${s.watched} watched stocks crossed`, true)),
  };

  /** Watch mode's switch on the line (CHW-021): the player's own click, nothing else. */
  function watchSwitch() {
    if (!watch) return null;
    const on = watch.isOn();
    const button = h('button', { type: 'button', class: `${P}-sb-switch`, 'aria-pressed': String(on), title: 'Watch mode: a big chain timer over the page' },
      on ? 'Watch mode on' : 'Watch mode off');
    button.addEventListener('click', () => watch.toggle());
    return button;
  }

  function body() {
    const settings = getSettings();
    const want = askedItems(settings);
    const showLinks = settings.sidebar.items.links === true;
    const rows = [];
    if (!answer) {
      if (want.length) rows.push(row(h('span', { class: `${P}-sb-muted` }, 'Loading…')));
    } else if (answer.status === 'no_key' || answer.status === 'refused') {
      rows.push(row(link('/index.php#/torn-tracker/keys', 'Add your script key'), h('span', { class: `${P}-sb-muted` }, ' to see your chain, war and dibs here.')));
    } else if (answer.status !== 'ok') {
      for (const id of want) {
        const item = SIDEBAR_ITEMS.find((i) => i.id === id);
        rows.push(row(h('b', null, item.title), h('span', { class: `${P}-sb-muted` }, ' no data')));
      }
    } else {
      for (const id of want) {
        const value = answer.items.get(id);
        const line = value ? LINES[id](value) : null;
        if (line) rows.push(line);
      }
    }
    const below = profitableCount();
    if (settings.sidebar.items.shops === true && below > 0) {
      rows.push(row(h('b', null, 'Shop price'), ` ${thousands(below)} listing${below === 1 ? '' : 's'} below what a shop pays`));
    }
    if (showLinks) {
      const links = answer?.status === 'ok' && answer.links.length ? answer.links : LINKS;
      rows.push(h('div', { class: `${P}-sb-row ${P}-sb-links` }, ...links.map((l) => link(l.url, l.label, true))));
    }
    return rows;
  }

  function render() {
    if (!block) return;
    const open = isOpen();
    block.dataset.open = String(open);
    block.querySelector(`.${P}-sb-head`).setAttribute('aria-expanded', String(open));
    const rows = open ? body() : [];
    block.querySelector(`.${P}-sb-body`).replaceChildren(...rows);
    // Open with nothing to show: the block hides itself.
    block.hidden = open && rows.length === 0;
  }

  /** Ticks the countdowns between reads; nothing else. */
  function paint() {
    for (const node of block?.querySelectorAll('[data-ttc-until]') || []) {
      node.textContent = left(Number(node.dataset.ttcUntil) - now());
    }
  }

  async function load() {
    const want = askedItems(getSettings());
    if (want.length === 0) {
      answer = { status: 'ok', items: new Map(), links: [] };
      render();
      return;
    }
    lastAsked = now();
    const result = await site.sidebar(want);
    if (stopped) return;
    if (result.status === 'wait') {
      notBefore = now() + result.retryMs;
      if (!answer) answer = { status: 'failed' };
    } else {
      answer = result;
      if (result.status === 'ok' && result.items.has('watch')) onWatch?.(result.items.get('watch'));
    }
    render();
  }

  /** Asks when the block is open, the tab is visible and a minute has passed. */
  const due = () => !stopped && enabled() && isOpen() && block?.isConnected
    && doc.visibilityState !== 'hidden' && now() - lastAsked >= READ_EVERY_MS && now() >= notBefore;

  // The one timer here that reaches the network, through site.sidebar: it asks only
  // while the block is open and the player is looking.
  function refreshSidebar() {
    if (stopped) return;
    if (due()) load().catch(() => {});
    timers.clearTimeout(readTimer);
    readTimer = timers.setTimeout(refreshSidebar, READ_EVERY_MS);
  }

  function toggle() {
    openState = !isOpen();
    store.write({ open: openState }).catch(() => {});
    render();
    if (openState) refreshSidebar();
  }

  function build() {
    const head = h('button', { type: 'button', class: `${P}-sb-head`, 'aria-expanded': 'false', 'data-tour': 'companion-sidebar' },
      h('span', { class: `${P}-mark`, 'aria-hidden': 'true' }, 'TT'), 'Torn Tracker');
    head.addEventListener('click', toggle);
    return h('div', { id: BLOCK_ID, 'data-ttc-own': '', 'data-open': 'false' }, head, h('div', { class: `${P}-sb-body` }));
  }

  function place() {
    if (stopped) return;
    if (!enabled()) {
      block?.remove();
      return;
    }
    const anchor = anchorOf(doc);
    if (!anchor) return;
    if (!block) block = build();
    if (anchor.nextElementSibling !== block) anchor.after(block);
    render();
    if (isOpen()) refreshSidebar();
  }

  const stopWatching = onMutation((records) => {
    if (records.every((r) => ownChange(r, OURS))) return;
    timers.clearTimeout(placeTimer);
    placeTimer = timers.setTimeout(place, 200);
  }, doc);
  const onVisible = () => {
    if (doc.visibilityState !== 'hidden') refreshSidebar();
  };
  doc.addEventListener('visibilitychange', onVisible);
  const stopCounting = onProfitable(() => render());
  const stopWatchMode = watch?.onChange(() => render());
  tick = timers.setInterval(() => {
    if (isOpen()) paint();
  }, 1000);
  place();

  return {
    get block() {
      return block;
    },
    /**
     * Settings changed: a switched-off item disappears now; a new one is asked for with
     * the next read, which still waits out its minute.
     */
    update() {
      if (!enabled()) {
        block?.remove();
        return;
      }
      place();
    },
    place,
    destroy() {
      stopped = true;
      stopWatching?.();
      stopCounting();
      stopWatchMode?.();
      doc.removeEventListener('visibilitychange', onVisible);
      timers.clearTimeout(readTimer);
      timers.clearTimeout(placeTimer);
      timers.clearInterval(tick);
      block?.remove();
    },
  };
}
