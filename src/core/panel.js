// The settings page (CMP-003, CMP-007, CMP-011, CMP-012, CMP-014, CMP-107 as reworked
// on the owner's review, 2026-10-23).
//
// A page inside Torn, at /index.php#/torn-tracker (core/page.js puts it in Torn's main
// column, in a Shadow DOM host), reached from the "Torn Tracker" entry in the sidebar
// (core/entry.js). It is built from what the script already holds: opening it makes no
// request. A menu of sections sits on the left, and across the top on a narrow screen;
// each section is a plain link to #/torn-tracker/<section>, so Back and Forward work:
//   General   version, the update link, the page's look, console logging
//   Features  each feature with its switch, one line on what it does, its options and a
//             "Learn more" link to its knowledge base page, grouped by area
//   Sidebar   the Torn Tracker sidebar block's master switch and one switch per item
//   Sharing   the notice, a switch per kind with its "what is shared" line, the queue
//   Keys      the script key, and the optional Torn API key behind Torn's terms table
//   Data      what is kept on this device, and "Forget me"
//   Credits   every script this one took code or an idea from
//   Help      the knowledge base and where to ask
// A search box finds a setting in any section. Edits are kept in a draft until Save, so
// moving between sections loses nothing; Close, or any link away, leaves without saving.
// The page remembers the last section. Its look is the suite's design tokens (WP-UI-8),
// dark unless the player picks light or Torn's own theme under General, and every
// target is at least 44 px so it can be hit with a thumb in Torn PDA; under 600 px of
// width the menu goes across the top.
//
// Everything is built with createElement and text nodes.

import META from '../meta.js';
import { CREDITS, CREDITS_URL } from '../credits.js';
import { DISCLOSURE, TOS_COLUMNS, hasTosTable, kindOffered, sharingOffered } from './disclosure.js';
import { el } from './dom.js';
import { checkTyped, onPda } from './keys.js';
import { kindTitle } from './kinds.js';
import { LOOKS, declarations, lookTheme } from './tokens.js';
import { shareKinds } from './registry.js';
import { SIDEBAR_ITEMS } from './sidebar.js';
import { KEYS, backendName, read, write } from './storage.js';

const P = 'ttc';
const RELEASES = 'https://github.com/tulpn/torn-tracker-companion/releases/latest';
const ISSUES = 'https://github.com/tulpn/torn-tracker-companion/issues';
export const GUIDE = 'https://www.torn-tracker.com/guide/companion/';

export const SECTIONS = Object.freeze([
  ['general', 'General'],
  ['features', 'Features'],
  ['sidebar', 'Sidebar'],
  ['sharing', 'Sharing'],
  ['keys', 'Keys'],
  ['data', 'Data'],
  ['credits', 'Credits'],
  ['help', 'Help'],
]);

/** One line under each section's heading: what it's for, in plain words. */
const INTROS = Object.freeze({
  general: 'Your version, updates, and help when something misbehaves.',
  features: 'Switch each feature on or off and set its options. Changes apply when you press Save.',
  sidebar: 'A Torn Tracker block in Torn’s sidebar, under Lists, with a few live facts. Choose what it shows. All of it is Core (free).',
  sharing: 'Choose what you share with torn-tracker.com. Everything starts off.',
  keys: 'The key that connects the companion to torn-tracker.com.',
  data: 'What the companion keeps on this device, and how to clear it.',
  credits: 'The scripts the companion learned from, with their licences.',
  help: 'Guides, answers, and where to report a problem.',
});

/** The choices of the page's look; dark is the suite's default. */
const LOOK_LABELS = Object.freeze({ dark: 'Dark', light: 'Light', torn: 'Same as Torn' });

/** The areas features are grouped by, in the order the page lists them. */
export const AREAS = Object.freeze([
  ['war', 'War and attacks'],
  ['travel', 'Travel'],
  ['market', 'Market and trading'],
  ['crimes', 'Crimes'],
  ['gym', 'Gym'],
  ['jobs', 'Jobs'],
  ['other', 'Everything else'],
]);

const STYLE = `
  #${P}-panel {
    ${declarations('dark')}
    --ttc-bg: var(--background); --ttc-surface: var(--card); --ttc-text: var(--foreground); --ttc-muted: var(--muted-foreground);
    --ttc-line: var(--border); --ttc-accent: var(--primary); --ttc-accent-soft: color-mix(in srgb, var(--primary) 16%, transparent);
    --ttc-accent-text: var(--primary-foreground); --ttc-danger: color-mix(in srgb, var(--destructive) 65%, var(--foreground));
    --ttc-warn: var(--tt-warning); --ttc-good: var(--tt-success); --ttc-link: var(--ring); --ttc-field: var(--background);
    --ttc-field-line: var(--input); --ttc-off: var(--input); --ttc-shadow: var(--tt-shadow-sm);
    display: block; container-type: inline-size; margin: 0 0 10px;
    font: 14px/1.5 var(--tt-font-sans); color: var(--ttc-text);
  }
  #${P}-panel[data-theme="light"] { ${declarations('light')} }
  #${P}-panel[hidden] { display: none; }
  #${P}-panel *, #${P}-panel *::before, #${P}-panel *::after { box-sizing: border-box; }
  #${P}-panel .${P}-sheet {
    display: grid; grid-template-columns: 220px minmax(0, 1fr); grid-template-rows: auto 1fr auto;
    grid-template-areas: "head head" "nav main" "foot foot";
    width: 100%; min-width: 0; min-height: 70vh;
    background: var(--ttc-bg); border-radius: var(--radius); border: 1px solid var(--ttc-line);
  }
  #${P}-panel .${P}-head {
    grid-area: head; display: flex; align-items: center; gap: 14px; padding: 12px 18px;
    background: var(--ttc-surface); border-bottom: 1px solid var(--ttc-line);
  }
  #${P}-panel .${P}-brand { display: flex; align-items: center; gap: 10px; flex: none; }
  #${P}-panel .${P}-logo {
    display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9px;
    background: var(--ttc-accent); color: var(--ttc-accent-text); font: 800 13px/1 var(--tt-font-sans); letter-spacing: -.02em;
  }
  #${P}-panel .${P}-head h2 { margin: 0; font-size: 17px; font-weight: 700; }
  #${P}-panel .${P}-head h2 small { display: block; font-size: 11px; font-weight: 500; color: var(--ttc-muted); }
  #${P}-panel .${P}-head input[type=search] { flex: 1; min-width: 0; max-width: 420px; margin-left: auto; border-radius: 999px; padding-left: 16px; }
  #${P}-panel .${P}-head .${P}-x { border-radius: 999px; border-color: transparent; font-size: 16px; padding: 8px 12px; }
  #${P}-panel nav, #${P}-panel main, #${P}-panel .${P}-head, #${P}-panel .${P}-foot { min-width: 0; }
  #${P}-panel .${P}-card[data-needs-key="true"] > label.${P}-check:first-child::after {
    content: "needs key"; margin-left: auto; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
    background: var(--ttc-accent-soft); color: var(--ttc-muted);
  }
  #${P}-panel nav { grid-area: nav; padding: 12px 10px; background: var(--ttc-surface); border-right: 1px solid var(--ttc-line); }
  #${P}-panel nav a {
    display: flex; align-items: center; min-height: 44px; margin: 2px 0; padding: 0 12px; border-radius: 8px;
    color: var(--ttc-text); font-weight: 500; text-decoration: none;
  }
  #${P}-panel nav a:hover { background: var(--ttc-bg); text-decoration: none; }
  #${P}-panel nav a[aria-selected=true] { background: var(--ttc-accent-soft); color: var(--ttc-link); font-weight: 700; }
  #${P}-panel main { grid-area: main; padding: 18px 26px 26px; }
  #${P}-panel main > * { max-width: 760px; }
  #${P}-panel main h3 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  #${P}-panel main .${P}-intro { margin: 0 0 14px; color: var(--ttc-muted); }
  #${P}-panel main h4 {
    margin: 22px 0 8px; font-size: 12px; font-weight: 700; color: var(--ttc-muted); text-transform: uppercase; letter-spacing: .06em;
  }
  #${P}-panel .${P}-card {
    background: var(--ttc-surface); border: 1px solid var(--ttc-line); border-radius: 12px; padding: 10px 14px; margin: 10px 0;
    box-shadow: var(--ttc-shadow);
  }
  #${P}-panel .${P}-card ul { margin: 6px 0 0 18px; padding: 0; }
  #${P}-panel .${P}-foot {
    grid-area: foot; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 18px;
    background: var(--ttc-surface); border-top: 1px solid var(--ttc-line); border-radius: 0 0 var(--radius) var(--radius);
    position: sticky; bottom: 0; z-index: 1;
  }
  #${P}-panel .${P}-foot .${P}-status { flex: 1; min-width: 160px; }
  #${P}-panel label.${P}-check { display: flex; align-items: center; gap: 12px; min-height: 44px; cursor: pointer; font-weight: 600; }
  #${P}-panel label.${P}-check[data-off] { color: var(--ttc-muted); cursor: default; }
  #${P}-panel label.${P}-field { display: block; margin-top: 10px; }
  #${P}-panel label.${P}-field > span { display: block; margin-bottom: 4px; font-weight: 600; font-size: 13px; }
  /* Toggle switches: drawn with backgrounds only, so they look the same in every browser. */
  #${P}-panel input[type=checkbox] {
    appearance: none; -webkit-appearance: none; flex: none; width: 40px; height: 24px; margin: 0; border-radius: 999px;
    cursor: pointer; transition: background-color var(--tt-duration-fast) var(--tt-ease), background-position var(--tt-duration-fast) var(--tt-ease);
    background: radial-gradient(circle, var(--ttc-accent-text) 0 8px, transparent 9px) 2px 50% / 20px 20px no-repeat, var(--ttc-off);
  }
  #${P}-panel input[type=checkbox]:checked { background-color: var(--ttc-accent); background-position: 18px 50%; }
  #${P}-panel input[type=checkbox]:disabled { opacity: .45; cursor: default; }
  #${P}-panel input[type=checkbox]:focus-visible { outline: 2px solid var(--ttc-link); outline-offset: 2px; }
  #${P}-panel input[type=text], #${P}-panel input[type=password], #${P}-panel input[type=number],
  #${P}-panel input[type=search], #${P}-panel select {
    width: 100%; min-height: 44px; padding: 8px 12px; background: var(--ttc-field); color: var(--ttc-text);
    border: 1px solid var(--ttc-field-line); border-radius: var(--radius); font: inherit;
  }
  #${P}-panel input:focus-visible, #${P}-panel select:focus-visible { outline: 2px solid var(--ttc-accent); outline-offset: 1px; }
  #${P}-panel .${P}-option { margin-left: 52px; }
  #${P}-panel button, #${P}-panel a.${P}-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 44px; min-width: 44px; padding: 8px 16px; border-radius: var(--radius); cursor: pointer; font: inherit; font-weight: 600;
    background: var(--ttc-surface); color: var(--ttc-text); border: 1px solid var(--ttc-line); text-decoration: none;
  }
  #${P}-panel button:hover, #${P}-panel a.${P}-btn:hover { border-color: var(--ttc-accent); text-decoration: none; }
  #${P}-panel .${P}-primary, #${P}-panel a.${P}-btn.${P}-primary { background: var(--ttc-accent); color: var(--ttc-accent-text); border-color: var(--ttc-accent); }
  #${P}-panel .${P}-primary:hover { filter: brightness(1.05); }
  #${P}-panel button.${P}-danger { border-color: var(--ttc-danger); color: var(--ttc-danger); }
  #${P}-panel .${P}-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 14px; }
  #${P}-panel .${P}-muted { color: var(--ttc-muted); font-size: 13px; margin-top: 2px; }
  #${P}-panel a { color: var(--ttc-link); font-weight: 600; text-decoration: none; }
  #${P}-panel a:hover { text-decoration: underline; }
  #${P}-panel .${P}-notice {
    background: var(--ttc-accent-soft); border-radius: 12px; padding: 12px 14px; margin: 10px 0; white-space: pre-line;
  }
  #${P}-panel .${P}-warn { color: var(--ttc-warn); margin-top: 6px; font-size: 13px; }
  #${P}-panel .${P}-status { color: var(--ttc-danger); min-height: 1em; font-size: 13px; }
  #${P}-panel .${P}-status[data-tone="good"] { color: var(--ttc-good); }
  #${P}-panel dl { margin: 6px 0; }
  #${P}-panel dt { color: var(--ttc-muted); font-size: 12px; margin-top: 8px; }
  #${P}-panel dd { margin: 0; }
  #${P}-panel .${P}-credits { padding-left: 18px; }
  #${P}-panel .${P}-credits li { margin: 8px 0; }
  @container (max-width: 600px) {
    #${P}-panel .${P}-sheet {
      grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto 1fr auto;
      grid-template-areas: "head" "nav" "main" "foot"; border-radius: 0;
    }
    #${P}-panel .${P}-head { flex-wrap: wrap; gap: 10px; padding: 10px 12px; }
    #${P}-panel .${P}-head input[type=search] { order: 3; flex-basis: 100%; max-width: none; margin-left: 0; }
    #${P}-panel .${P}-head .${P}-x { margin-left: auto; }
    #${P}-panel .${P}-foot button { flex: 1; }
    #${P}-panel nav { display: flex; gap: 4px; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--ttc-line); padding: 6px 8px; }
    #${P}-panel nav a { flex: none; white-space: nowrap; }
    #${P}-panel main { padding: 14px 14px 20px; }
    #${P}-panel .${P}-option { margin-left: 0; }
  }
`;

/** The page's styles go where the page does: inside its Shadow DOM host. */
function addStyle(doc, root) {
  const into = root.nodeType === 11 ? root : doc.head;
  if (into.querySelector(`#${P}-style`)) return;
  const style = el('style', { id: `${P}-style`, ownerDocument: doc });
  style.textContent = STYLE;
  into.appendChild(style);
}


const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const sectionIds = SECTIONS.map(([id]) => id);

/**
 * @param {object} opts
 * @param {Document} opts.doc
 * @param {ShadowRoot|Element} [opts.root]  where the page goes (core/page.js's host)
 * @param {ReadonlyArray<object>} opts.registry
 * @param {() => object} opts.getSettings
 * @param {() => object} opts.getKeys
 * @param {() => object|null} [opts.getQueue]  the upload queue's status()
 * @param {(settings: object, keys: object) => Promise<boolean>} opts.onSave
 * @param {() => Promise<boolean>} opts.onForget
 * @param {() => Promise<void>} opts.onReset
 * @param {object} [opts.disclosure]
 * @param {ReadonlyArray<object>} [opts.credits]
 */
export function mountPanel({
  doc = globalThis.document,
  root = doc.body,
  registry,
  getSettings,
  getKeys,
  getQueue = () => null,
  onSave,
  onForget,
  onReset,
  version,
  disclosure = DISCLOSURE,
  credits = CREDITS,
}) {
  addStyle(doc, root);
  const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);
  const pda = onPda(doc.defaultView || globalThis);
  /** Leaving goes back to Torn's home page, in the same document. */
  const CLOSE = '#';
  const sectionHref = (id) => `#/torn-tracker/${id}`;

  const panel = h('div', { id: `${P}-panel`, role: 'region', 'aria-label': `${META.name} settings`, 'data-tour': 'companion-settings' });
  const search = h('input', { type: 'search', id: `${P}-search`, placeholder: 'Search settings', 'aria-label': 'Search settings', autocomplete: 'off' });
  const nav = h('nav', { 'aria-label': 'Settings sections' });
  const main = h('main');
  const status = h('div', { class: `${P}-status`, role: 'status' });
  panel.append(h('div', { class: `${P}-sheet` },
    h('div', { class: `${P}-head` },
      h('div', { class: `${P}-brand` },
        h('span', { class: `${P}-logo`, 'aria-hidden': 'true' }, 'TT'),
        h('h2', null, 'Torn Tracker', h('small', null, `Companion settings \u00b7 version ${version}`))),
      search,
      h('a', { href: CLOSE, class: `${P}-btn ${P}-x`, 'data-act': 'close', 'aria-label': 'Close settings', title: 'Close' }, '\u2715')),
    nav,
    main,
    h('div', { class: `${P}-foot` },
      status,
      h('a', { href: CLOSE, class: `${P}-btn`, 'data-act': 'close' }, 'Close'),
      h('button', { type: 'button', class: `${P}-primary`, 'data-act': 'save', 'data-tour': 'companion-save' }, 'Save'))));
  root.append(panel);

  let section = 'features';
  /** Whether the route is showing; the draft lives as long as it does. */
  let active = false;
  let query = '';
  let armedForget = false;
  /** What the player has changed and not yet saved. */
  let draft = null;

  // The last section is a convenience kept on this device; any failure just means Features.
  read(KEYS.ui).then((ui) => {
    if (!active && sectionIds.includes(ui?.section)) section = ui.section;
  }).catch(() => {});

  function freshDraft() {
    const settings = getSettings();
    draft = {
      settings: {
        ...settings,
        features: Object.fromEntries(Object.entries(settings.features).map(([id, f]) => [id, { ...f }])),
        shares: { ...settings.shares },
        sidebar: { ...settings.sidebar, items: { ...settings.sidebar?.items } },
      },
      keys: { ...getKeys() },
    };
  }

  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
  const matches = (...texts) => !query || texts.some((t) => String(t || '').toLowerCase().includes(query));

  // ------------------------------------------------------------ Features

  function optionInput(d, key, option) {
    const value = draft.settings.features[d.id]?.[key];
    const data = { 'data-feature': d.id, 'data-opt': key, id: `${P}-opt-${d.id}-${key}` };
    if (typeof value === 'boolean') {
      return h('label', { class: `${P}-check ${P}-option` }, h('input', { type: 'checkbox', ...data, checked: value }), option.label);
    }
    let input;
    if (option.choices) {
      input = h('select', data, ...option.choices.map((choice) => h('option', {
        value: choice, selected: choice === value,
      }, option.labels?.[choice] ?? String(choice))));
    } else if (typeof value === 'number') {
      input = h('input', { type: 'number', inputmode: 'decimal', ...data, value, min: option.min, max: option.max });
    } else {
      input = h('input', { type: 'text', ...data, value });
    }
    return h('label', { class: `${P}-field ${P}-option` }, h('span', null, option.label), input);
  }

  function featureCard(d) {
    const keys = draft.keys;
    const card = h('div', { class: `${P}-card`, 'data-card': d.id },
      h('label', { class: `${P}-check` },
        h('input', {
          type: 'checkbox', id: `${P}-feature-${d.id}`, 'data-feature': d.id, 'data-opt': 'enabled',
          checked: draft.settings.features[d.id]?.enabled === true,
        }),
        d.title),
      h('div', { class: `${P}-muted ${P}-option` }, d.summary, ' ', link(`${GUIDE}${d.guide}/`, 'Learn more')));
    if (d.needs.scriptKey && !keys.script) card.dataset.needsKey = 'true';
    if (d.needs.apiKey && !keys.api && !keys.usePdaKey) {
      card.append(h('div', { class: `${P}-warn ${P}-option` }, 'Needs a Torn API key (Keys).'));
    }
    for (const [key, option] of Object.entries(d.options || {})) card.append(optionInput(d, key, option));
    return card;
  }

  function featuresBody() {
    if (registry.length === 0) return [h('div', { class: `${P}-muted` }, 'No features in this build yet.')];
    const rows = [];
    if (!draft.keys.script && registry.some((d) => d.needs.scriptKey) && !query) {
      rows.push(h('div', { class: `${P}-notice ${P}-keyhint` },
        h('strong', null, 'Add your script key to see torn-tracker.com data. '),
        'Most features show estimates, prices and dibs from torn-tracker.com, and need your script key. '
        + 'Features that only read the page work without it.',
        h('div', { class: `${P}-row` }, h('a', { href: sectionHref('keys'), class: `${P}-btn ${P}-primary` }, 'Add your script key'))));
    }
    for (const [area, title] of AREAS) {
      const items = registry.filter((d) => d.area === area && matches(d.title, d.summary, title));
      if (items.length === 0) continue;
      rows.push(h('h4', null, title), ...items.map(featureCard));
    }
    if (!query) rows.push(h('div', { class: `${P}-row` }, h('button', { type: 'button', 'data-act': 'reset' }, 'Reset settings to defaults')));
    return rows;
  }

  // ------------------------------------------------------------ Sidebar

  function sidebarBody() {
    const sb = draft.settings.sidebar;
    const rows = [];
    if (matches('Torn Tracker sidebar block', 'Sidebar')) {
      rows.push(h('div', { class: `${P}-card`, 'data-card': 'sidebar' },
        h('label', { class: `${P}-check` },
          h('input', { type: 'checkbox', id: `${P}-sidebar-enabled`, 'data-sidebar': 'enabled', checked: sb.enabled === true }),
          'Show the Torn Tracker block in the sidebar'),
        h('div', { class: `${P}-muted ${P}-option` },
          'It asks torn-tracker.com at most once a minute, only while it’s open and you’re looking at the tab. ',
          'Needs your script key. ', link(`${GUIDE}sidebar/`, 'Learn more'))));
    }
    const items = SIDEBAR_ITEMS.filter((item) => matches(item.title, item.summary));
    if (items.length && !query) rows.push(h('h4', null, 'What it shows'));
    for (const item of items) {
      rows.push(h('div', { class: `${P}-card`, 'data-card': `sidebar-${item.id}` },
        h('label', { class: `${P}-check` },
          h('input', {
            type: 'checkbox', id: `${P}-sidebar-${item.id}`, 'data-sidebar': item.id,
            checked: sb.items[item.id] === true, disabled: sb.enabled !== true,
          }),
          item.title),
        h('div', { class: `${P}-muted ${P}-option` }, item.summary)));
    }
    return rows;
  }

  // ------------------------------------------------------------ Sharing

  function queueLines(queue) {
    if (!queue) return [];
    const lines = [];
    const anyOn = Object.values(draft.settings.shares).some(Boolean);
    if (queue.authFailed) {
      lines.push(h('div', { class: `${P}-warn` },
        'torn-tracker.com did not accept your script key. Sharing is paused until you save a valid one.'));
    } else if (!queue.hasKey && anyOn) {
      lines.push(h('div', { class: `${P}-warn` }, 'Add your script key under Keys to start sharing.'));
    }
    if (queue.retryAt) {
      lines.push(h('div', { class: `${P}-warn` }, `torn-tracker.com asked the script to wait. Sharing carries on at ${clock(queue.retryAt)}.`));
    }
    for (const [kind, min] of Object.entries(queue.blocked)) {
      lines.push(h('div', { class: `${P}-warn` },
        `Update the script to keep sharing ${kindTitle(kind).toLowerCase()}${min === '?' ? '' : ` (${min} or newer)`}.`));
    }
    if (queue.queued) lines.push(h('div', { class: `${P}-muted` }, `${queue.queued} waiting to be sent.`));
    if (queue.last?.outcome === 'sent') {
      lines.push(h('div', { class: `${P}-muted` }, `Last sent at ${clock(queue.last.at)}: ${queue.last.accepted} accepted.`));
    }
    return lines;
  }

  function sharingBody() {
    const kinds = shareKinds(registry);
    const rows = [];
    if (!sharingOffered(disclosure)) {
      rows.push(h('div', { class: `${P}-muted` },
        'Nothing is shared by this version. The sharing switches appear once the notice saying exactly what each one shares is ready.'));
    } else {
      if (!query) rows.push(h('div', { class: `${P}-notice`, id: `${P}-first-run` }, disclosure.firstRun));
      if (kinds.length === 0) rows.push(h('div', { class: `${P}-muted` }, 'No feature in this build shares anything.'));
      for (const kind of kinds) {
        const offered = kindOffered(kind, disclosure);
        if (!matches(kindTitle(kind), offered ? disclosure.kinds[kind] : '')) continue;
        const card = h('div', { class: `${P}-card` },
          h('label', { class: `${P}-check`, 'data-off': !offered },
            h('input', {
              type: 'checkbox', id: `${P}-share-${kind}`, 'data-share': kind,
              checked: offered && draft.settings.shares[kind] === true, disabled: !offered,
            }),
            kindTitle(kind)));
        if (offered) card.append(h('div', { class: `${P}-muted ${P}-option` }, disclosure.kinds[kind]));
        rows.push(card);
      }
      if (kinds.length && draft.settings.sharingConsent !== disclosure.version) {
        rows.push(h('div', { class: `${P}-row` },
          h('button', { type: 'button', class: `${P}-primary`, 'data-act': 'consent' }, 'Share the kinds I picked')));
        rows.push(h('div', { class: `${P}-muted` }, 'Until you press it, nothing is shared.'));
      }
    }
    if (!query) rows.push(h('div', { id: `${P}-queue` }, ...queueLines(getQueue())));
    return rows;
  }

  // ------------------------------------------------------------ Keys

  function keysBody() {
    const keys = draft.keys;
    const rows = [
      h('h4', null, 'Script key'),
      h('label', { class: `${P}-field` },
        h('span', null, 'Your torn-tracker.com script key. It is not a Torn API key.'),
        h('input', {
          type: 'password', id: `${P}-key-script`, 'data-key': 'script', value: keys.script,
          placeholder: 'tt_feed_…', autocomplete: 'off', spellcheck: 'false',
        })),
      h('h4', null, 'Torn API key (optional)'),
    ];
    if (hasTosTable(disclosure)) {
      rows.push(h('dl', { id: `${P}-tos` },
        ...TOS_COLUMNS.flatMap(([key, title]) => [h('dt', null, title), h('dd', null, disclosure.tosTable[key])])));
      rows.push(h('label', { class: `${P}-field` },
        h('span', null, 'Torn API key'),
        h('input', {
          type: 'password', id: `${P}-key-api`, 'data-key': 'api', value: keys.api,
          autocomplete: 'off', spellcheck: 'false', disabled: keys.usePdaKey,
        })));
      if (pda) {
        rows.push(h('label', { class: `${P}-check` },
          h('input', { type: 'checkbox', id: `${P}-key-pda`, 'data-key': 'usePdaKey', checked: keys.usePdaKey }),
          'Use my Torn PDA key'));
      }
    } else {
      rows.push(h('div', { class: `${P}-muted` },
        'No feature in this version needs a Torn API key. The field appears together with its terms table.'));
    }
    return rows;
  }

  // ------------------------------------------------------------ the rest

  function generalBody() {
    return [
      h('div', { class: `${P}-card` },
        h('div', null, `${META.name}, version ${version}.`),
        h('div', { class: `${P}-muted` }, 'It updates itself from its newest release. ', link(RELEASES, 'Check for an update'))),
      h('h4', null, 'Look'),
      h('label', { class: `${P}-field` }, h('span', null, 'Colours of this page'),
        h('select', { id: `${P}-look`, 'data-setting': 'look' }, ...LOOKS.map((look) => h('option', {
          value: look, selected: look === draft.settings.look,
        }, LOOK_LABELS[look])))),
      h('div', { class: `${P}-muted` }, 'What the companion adds to Torn’s own pages always follows Torn’s theme.'),
      h('h4', null, 'Troubleshooting'),
      h('label', { class: `${P}-check` },
        h('input', { type: 'checkbox', id: `${P}-debug`, 'data-setting': 'debug', checked: draft.settings.debug === true }),
        'Log what the script does to the browser console'),
    ];
  }

  function dataBody() {
    return [
      h('div', { class: `${P}-card` },
        h('div', null, `Everything the script keeps is stored only on this device (${backendName()}):`),
        h('ul', null,
          h('li', null, 'your settings, sharing choices and saved templates'),
          h('li', null, 'your script key, and your Torn API key if you add one'),
          h('li', null, 'reports waiting to be sent, kept at most ten minutes'),
          h('li', null, 'answers from torn-tracker.com, kept a short while so pages ask less'))),
      h('h4', null, 'Forget me'),
      h('div', { class: `${P}-muted` }, 'Clears all of the above on this device. Your other devices keep theirs.'),
      h('div', { class: `${P}-row` },
        h('button', { type: 'button', class: `${P}-danger`, 'data-act': 'forget' },
          armedForget ? 'Really forget everything?' : 'Forget me')),
    ];
  }

  function creditsBody() {
    const rows = [];
    if (credits.length === 0) {
      rows.push(h('div', { class: `${P}-muted` }, 'This build uses no other script\'s code or ideas yet.'));
    } else {
      rows.push(h('ul', { class: `${P}-credits` }, ...credits.filter((c) => matches(c.name, c.author, c.taken)).map((c) => h('li', null,
        link(c.url, c.name),
        ` by ${c.author}, ${c.licence}. `,
        c.merged ? `Code: ${c.taken}` : `Idea: ${c.taken}`))));
    }
    rows.push(h('div', { class: `${P}-muted` }, link(CREDITS_URL, 'All credits and licences')));
    return rows;
  }

  function helpBody() {
    return [
      h('div', { class: `${P}-card` },
        h('div', null, link(GUIDE, 'The companion guide'), ': installing, every feature, what each kind of sharing sends.'),
        h('div', { class: `${P}-muted` }, link(`${GUIDE}troubleshooting/`, 'Troubleshooting'), ' · ',
          link(`${GUIDE}what-it-never-does/`, 'What it never does'), ' · ', link(`${GUIDE}faq/`, 'FAQ'))),
      h('div', { class: `${P}-card` },
        h('div', null, 'Something wrong? ', link(ISSUES, 'Open an issue on GitHub'),
          ', saying what you expected, what happened, and whether it was in a browser or in Torn PDA.')),
    ];
  }

  // ------------------------------------------------------------ frame

  const BODIES = {
    general: generalBody, features: featuresBody, sidebar: sidebarBody, sharing: sharingBody, keys: keysBody,
    data: dataBody, credits: creditsBody, help: helpBody,
  };

  /** While searching, every section that has something matching, under its own heading. */
  function searchBody() {
    const rows = [];
    for (const [id, title] of SECTIONS) {
      if (!['features', 'sidebar', 'sharing', 'credits'].includes(id) && !matches(title)) continue;
      const body = BODIES[id]();
      const found = body.filter((n) => n.classList?.contains(`${P}-card`) || n.tagName === 'UL' || n.tagName === 'H4');
      if (!found.some((n) => n.classList?.contains(`${P}-card`) || (n.tagName === 'UL' && n.children.length)) && !matches(title)) continue;
      rows.push(h('h3', null, title), ...(found.length ? found : body));
    }
    if (rows.length === 0) rows.push(h('div', { class: `${P}-muted` }, `Nothing matches “${query}”.`));
    return rows;
  }

  function render(message = '', tone = '') {
    panel.dataset.theme = lookTheme(draft?.settings.look ?? getSettings().look, doc);
    nav.replaceChildren(...SECTIONS.map(([id, title]) => h('a', {
      href: sectionHref(id), role: 'tab', 'data-tab': id, 'aria-selected': String(!query && id === section),
    }, title)));
    const title = SECTIONS.find(([id]) => id === section)[1];
    main.replaceChildren(...(query ? searchBody() : [
      h('h3', null, title), h('p', { class: `${P}-intro` }, INTROS[section]), ...BODIES[section](),
    ]));
    status.textContent = message;
    status.dataset.tone = tone;
    // On a narrow screen the menu scrolls sideways: keep the open section in sight.
    const current = nav.querySelector('[aria-selected=true]');
    if (current && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, current.offsetLeft - 8);
  }

  /** Keeps the draft in step with every input, so a section change loses nothing. */
  function onInput(event) {
    const input = event.target;
    if (input === search) {
      query = search.value.trim().toLowerCase();
      render();
      return;
    }
    const { feature, opt, share, key, setting, sidebar } = input.dataset || {};
    if (feature && opt) {
      const current = draft.settings.features[feature]?.[opt];
      let value;
      if (input.type === 'checkbox') value = input.checked;
      else if (typeof current === 'number') value = input.value === '' ? NaN : Number(input.value);
      else value = input.value;
      // A half-typed number stays in the field; normalize() keeps the old value if it is not valid.
      if (typeof value !== 'number' || Number.isFinite(value)) draft.settings.features[feature][opt] = value;
      // The same switch can show twice while searching; keep both in step.
      for (const twin of panel.querySelectorAll(`[data-feature="${feature}"][data-opt="${opt}"]`)) {
        if (twin !== input && twin.type === 'checkbox') twin.checked = input.checked;
      }
    } else if (share) {
      draft.settings.shares[share] = input.checked;
    } else if (key === 'usePdaKey') {
      draft.keys.usePdaKey = input.checked;
      const api = panel.querySelector(`#${P}-key-api`);
      if (api) api.disabled = input.checked;
    } else if (key) {
      draft.keys[key] = input.value;
    } else if (setting === 'debug') {
      draft.settings.debug = input.checked;
    } else if (setting === 'look') {
      // Shown at once, so the player sees it before saving; Close without Save puts it back.
      draft.settings.look = input.value;
      panel.dataset.theme = lookTheme(input.value, doc);
    } else if (sidebar === 'enabled') {
      draft.settings.sidebar.enabled = input.checked;
      for (const item of panel.querySelectorAll('[data-sidebar]')) {
        if (item !== input && item.dataset.sidebar !== 'enabled') item.disabled = !input.checked;
      }
    } else if (sidebar) {
      draft.settings.sidebar.items[sidebar] = input.checked;
    }
  }

  /** The route closed: whatever wasn't saved is dropped. */
  function close() {
    active = false;
    armedForget = false;
    draft = null;
  }

  async function save(settings) {
    const typed = checkTyped(draft.keys);
    if (typed.error) {
      section = 'keys';
      query = '';
      search.value = '';
      render(typed.error);
      return;
    }
    const ok = await onSave(settings, typed.keys);
    if (!ok) {
      render('Could not save: storage is full or unavailable.');
      return;
    }
    freshDraft();
    render('Saved.', 'good');
  }

  async function onClick(event) {
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    const act = button.dataset.act;
    if (act !== 'forget') armedForget = false;

    if (act === 'save') {
      await save(draft.settings);
    } else if (act === 'consent') {
      await save({ ...draft.settings, sharingConsent: disclosure.version });
    } else if (act === 'reset') {
      await onReset();
      freshDraft();
      render('Back to defaults.', 'good');
    } else if (act === 'forget') {
      if (!armedForget) {
        armedForget = true;
        render('This clears settings, keys, the upload queue and caches on this device.');
        return;
      }
      armedForget = false;
      const ok = await onForget();
      freshDraft();
      render(ok ? 'Everything on this device is cleared.' : 'Could not clear storage.');
    }
  }

  /**
   * Shows the page on a section (AC5): a known name opens that section, an unknown one
   * General, and '' or null the last section. Moving between sections keeps the draft;
   * arriving from elsewhere starts a fresh one. Nothing is requested.
   */
  function show(at) {
    if (typeof at === 'string' && at) {
      section = sectionIds.includes(at) ? at : 'general';
      write(KEYS.ui, { section }).catch(() => {});
    }
    if (!active) {
      freshDraft();
      armedForget = false;
      active = true;
    }
    query = '';
    search.value = '';
    render();
  }

  panel.addEventListener('click', onClick);
  panel.addEventListener('input', onInput);
  panel.addEventListener('change', onInput);

  return {
    panel,
    open: show,
    close,
    isActive: () => active,
    render,
    /** The queue changed: refresh its lines if the Sharing section is showing. */
    updateQueue() {
      const box = active ? panel.querySelector(`#${P}-queue`) : null;
      if (box) box.replaceChildren(...queueLines(getQueue()));
    },
    destroy() {
      panel.remove();
    },
  };
}
