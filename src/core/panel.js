// The settings page (CMP-003, CMP-007, CMP-011, CMP-012, CMP-014, CMP-107 as reworked
// on the owner's review, 2026-10-22).
//
// A full-screen page laid over the Torn page the player is on, like TornTools' own
// settings, opened from the "Torn Tracker" sidebar link or the icon by the avatar
// (core/entry.js). It is built from what the script already holds: opening it makes no
// request. A menu of sections sits on the left, and across the top on a phone:
//   General   version, the update link, console logging
//   Features  each feature with its switch, one line on what it does, its options and a
//             "Learn more" link to its knowledge base page, grouped by area
//   Sharing   the notice, a switch per kind with its "what is shared" line, the queue
//   Keys      the script key, and the optional Torn API key behind Torn's terms table
//   Data      what is kept on this device, and "Forget me"
//   Credits   every script this one took code or an idea from
//   Help      the knowledge base and where to ask
// A search box finds a setting in any section. Edits are kept in a draft until Save, so
// moving between sections loses nothing; Esc or Close leaves without saving. The page
// remembers the last section. It follows Torn's light or dark theme, and every target is
// at least 44 px so it can be hit with a thumb in Torn PDA.
//
// Everything is built with createElement and text nodes.

import META from '../meta.js';
import { CREDITS, CREDITS_URL } from '../credits.js';
import { DISCLOSURE, TOS_COLUMNS, hasTosTable, kindOffered, sharingOffered } from './disclosure.js';
import { el } from './dom.js';
import { checkTyped, onPda } from './keys.js';
import { kindTitle } from './kinds.js';
import { shareKinds } from './registry.js';
import { KEYS, backendName, read, write } from './storage.js';

const P = 'ttc';
const RELEASES = 'https://github.com/tulpn/torn-tracker-companion/releases/latest';
const ISSUES = 'https://github.com/tulpn/torn-tracker-companion/issues';
export const GUIDE = 'https://www.torn-tracker.com/guide/companion/';

export const SECTIONS = Object.freeze([
  ['general', 'General'],
  ['features', 'Features'],
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
  sharing: 'Choose what you share with torn-tracker.com. Everything starts off.',
  keys: 'The key that connects the companion to torn-tracker.com.',
  data: 'What the companion keeps on this device, and how to clear it.',
  credits: 'The scripts the companion learned from, with their licences.',
  help: 'Guides, answers, and where to report a problem.',
});

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
    --ttc-bg: #f4f5f7; --ttc-surface: #ffffff; --ttc-text: #1f2328; --ttc-muted: #5f6b76;
    --ttc-line: #e3e6ea; --ttc-accent: #278552; --ttc-accent-soft: rgba(39, 133, 82, .12); --ttc-accent-text: #fff;
    --ttc-danger: #c0392b; --ttc-warn: #8a5a00; --ttc-link: #23578f; --ttc-field: #fff; --ttc-off: #c9ced4;
    --ttc-shadow: 0 1px 2px rgba(16, 24, 40, .06), 0 1px 3px rgba(16, 24, 40, .08);
    position: fixed; inset: 0; z-index: 2147483000; display: flex; justify-content: center; align-items: stretch;
    background: rgba(15, 18, 22, .55); backdrop-filter: blur(2px);
    font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: var(--ttc-text);
  }
  #${P}-panel[data-theme="dark"] {
    --ttc-bg: #16181b; --ttc-surface: #1f2226; --ttc-text: #e6e8eb; --ttc-muted: #9aa4ae;
    --ttc-line: #2e3238; --ttc-accent: #3fae6e; --ttc-accent-soft: rgba(63, 174, 110, .16); --ttc-accent-text: #0b0c0d;
    --ttc-danger: #ff8a7d; --ttc-warn: #f3cd6b; --ttc-link: #8ab4f8; --ttc-field: #121416; --ttc-off: #4a5058;
    --ttc-shadow: none;
  }
  #${P}-panel[hidden] { display: none; }
  #${P}-panel *, #${P}-panel *::before, #${P}-panel *::after { box-sizing: border-box; }
  #${P}-panel .${P}-sheet {
    display: grid; grid-template-columns: 220px minmax(0, 1fr); grid-template-rows: auto 1fr auto;
    grid-template-areas: "head head" "nav main" "foot foot";
    width: min(1060px, 100%); min-width: 0; height: min(780px, 100%); margin: auto; overflow: hidden;
    background: var(--ttc-bg); border-radius: 14px; box-shadow: 0 20px 50px rgba(0, 0, 0, .35);
  }
  #${P}-panel .${P}-head {
    grid-area: head; display: flex; align-items: center; gap: 14px; padding: 12px 18px;
    background: var(--ttc-surface); border-bottom: 1px solid var(--ttc-line);
  }
  #${P}-panel .${P}-brand { display: flex; align-items: center; gap: 10px; flex: none; }
  #${P}-panel .${P}-logo {
    display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9px;
    background: var(--ttc-accent); color: #fff; font: 800 13px/1 system-ui, Arial, sans-serif; letter-spacing: -.02em;
  }
  #${P}-panel .${P}-head h2 { margin: 0; font-size: 17px; font-weight: 700; }
  #${P}-panel .${P}-head h2 small { display: block; font-size: 11px; font-weight: 500; color: var(--ttc-muted); }
  #${P}-panel .${P}-head input[type=search] { flex: 1; min-width: 0; max-width: 420px; margin-left: auto; border-radius: 999px; padding-left: 16px; }
  #${P}-panel .${P}-head .${P}-x { border-radius: 999px; border-color: transparent; font-size: 16px; }
  #${P}-panel nav, #${P}-panel main, #${P}-panel .${P}-head, #${P}-panel .${P}-foot { min-width: 0; }
  #${P}-panel .${P}-card[data-needs-key="true"] > label.${P}-check:first-child::after {
    content: "needs key"; margin-left: auto; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
    background: var(--ttc-accent-soft); color: var(--ttc-muted);
  }
  #${P}-panel nav { grid-area: nav; overflow: auto; padding: 12px 10px; background: var(--ttc-surface); border-right: 1px solid var(--ttc-line); }
  #${P}-panel nav button {
    display: block; width: 100%; margin: 2px 0; padding: 8px 12px; text-align: left; border: 0; border-radius: 8px;
    background: none; color: var(--ttc-text); font-weight: 500;
  }
  #${P}-panel nav button:hover { background: var(--ttc-bg); }
  #${P}-panel nav button[aria-selected=true] { background: var(--ttc-accent-soft); color: var(--ttc-accent); font-weight: 700; }
  #${P}-panel main { grid-area: main; overflow: auto; padding: 18px 26px 26px; }
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
    background: var(--ttc-surface); border-top: 1px solid var(--ttc-line);
  }
  #${P}-panel .${P}-foot .${P}-status { flex: 1; min-width: 160px; }
  #${P}-panel label.${P}-check { display: flex; align-items: center; gap: 12px; min-height: 44px; cursor: pointer; font-weight: 600; }
  #${P}-panel label.${P}-check[data-off] { color: var(--ttc-muted); cursor: default; }
  #${P}-panel label.${P}-field { display: block; margin-top: 10px; }
  #${P}-panel label.${P}-field > span { display: block; margin-bottom: 4px; font-weight: 600; font-size: 13px; }
  /* Toggle switches: drawn with backgrounds only, so they look the same in every browser. */
  #${P}-panel input[type=checkbox] {
    appearance: none; -webkit-appearance: none; flex: none; width: 40px; height: 24px; margin: 0; border-radius: 999px;
    cursor: pointer; transition: background-color .15s, background-position .15s;
    background: radial-gradient(circle, #fff 0 8px, transparent 9px) 2px 50% / 20px 20px no-repeat, var(--ttc-off);
  }
  #${P}-panel input[type=checkbox]:checked { background-color: var(--ttc-accent); background-position: 18px 50%; }
  #${P}-panel input[type=checkbox]:disabled { opacity: .45; cursor: default; }
  #${P}-panel input[type=checkbox]:focus-visible { outline: 2px solid var(--ttc-link); outline-offset: 2px; }
  #${P}-panel input[type=text], #${P}-panel input[type=password], #${P}-panel input[type=number],
  #${P}-panel input[type=search], #${P}-panel select {
    width: 100%; min-height: 44px; padding: 8px 12px; background: var(--ttc-field); color: var(--ttc-text);
    border: 1px solid var(--ttc-line); border-radius: 10px; font: inherit;
  }
  #${P}-panel input:focus-visible, #${P}-panel select:focus-visible { outline: 2px solid var(--ttc-accent); outline-offset: 1px; }
  #${P}-panel .${P}-option { margin-left: 52px; }
  #${P}-panel button {
    min-height: 44px; min-width: 44px; padding: 8px 16px; border-radius: 10px; cursor: pointer; font: inherit; font-weight: 600;
    background: var(--ttc-surface); color: var(--ttc-text); border: 1px solid var(--ttc-line);
  }
  #${P}-panel button:hover { border-color: var(--ttc-accent); }
  #${P}-panel button.${P}-primary { background: var(--ttc-accent); color: var(--ttc-accent-text); border-color: var(--ttc-accent); }
  #${P}-panel button.${P}-primary:hover { filter: brightness(1.05); }
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
  #${P}-panel dl { margin: 6px 0; }
  #${P}-panel dt { color: var(--ttc-muted); font-size: 12px; margin-top: 8px; }
  #${P}-panel dd { margin: 0; }
  #${P}-panel .${P}-credits { padding-left: 18px; }
  #${P}-panel .${P}-credits li { margin: 8px 0; }
  @media (max-width: 700px) {
    #${P}-panel .${P}-sheet {
      grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto 1fr auto;
      grid-template-areas: "head" "nav" "main" "foot"; height: 100%; border-radius: 0;
    }
    #${P}-panel .${P}-head { flex-wrap: wrap; gap: 10px; padding: 10px 12px; }
    #${P}-panel .${P}-head input[type=search] { order: 3; flex-basis: 100%; max-width: none; margin-left: 0; }
    #${P}-panel .${P}-head .${P}-x { margin-left: auto; }
    #${P}-panel .${P}-foot button { flex: 1; }
    #${P}-panel nav { display: flex; gap: 4px; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--ttc-line); padding: 6px 8px; }
    #${P}-panel nav button { width: auto; flex: none; white-space: nowrap; }
    #${P}-panel main { padding: 14px 14px 20px; }
    #${P}-panel .${P}-option { margin-left: 0; }
  }
`;

function addStyle(doc) {
  if (doc.getElementById(`${P}-style`)) return;
  const style = el('style', { id: `${P}-style`, ownerDocument: doc });
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/** Torn marks its dark theme on the body; without it, the page is light. */
export function themeOf(doc) {
  const body = doc.body;
  return body?.classList.contains('dark-mode') || body?.classList.contains('dark') ? 'dark' : 'light';
}

const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const sectionIds = SECTIONS.map(([id]) => id);

/**
 * @param {object} opts
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
  addStyle(doc);
  const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);
  const pda = onPda(doc.defaultView || globalThis);

  const panel = h('div', { id: `${P}-panel`, hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': `${META.name} settings` });
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
      h('button', { type: 'button', class: `${P}-x`, 'data-act': 'close', 'aria-label': 'Close settings', title: 'Close (Esc)' }, '\u2715')),
    nav,
    main,
    h('div', { class: `${P}-foot` },
      status,
      h('button', { type: 'button', 'data-act': 'close' }, 'Close'),
      h('button', { type: 'button', class: `${P}-primary`, 'data-act': 'save' }, 'Save'))));
  doc.body.append(panel);

  let section = 'features';
  let query = '';
  let armedForget = false;
  /** What the player has changed and not yet saved. */
  let draft = null;

  // The last section is a convenience kept on this device; any failure just means Features.
  read(KEYS.ui).then((ui) => {
    if (sectionIds.includes(ui?.section)) section = ui.section;
  }).catch(() => {});

  function freshDraft() {
    const settings = getSettings();
    draft = {
      settings: {
        ...settings,
        features: Object.fromEntries(Object.entries(settings.features).map(([id, f]) => [id, { ...f }])),
        shares: { ...settings.shares },
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
        h('div', { class: `${P}-row` }, h('button', { type: 'button', class: `${P}-primary`, 'data-act': 'tab', 'data-tab': 'keys' }, 'Add your script key'))));
    }
    for (const [area, title] of AREAS) {
      const items = registry.filter((d) => d.area === area && matches(d.title, d.summary, title));
      if (items.length === 0) continue;
      rows.push(h('h4', null, title), ...items.map(featureCard));
    }
    if (!query) rows.push(h('div', { class: `${P}-row` }, h('button', { type: 'button', 'data-act': 'reset' }, 'Reset settings to defaults')));
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
    general: generalBody, features: featuresBody, sharing: sharingBody, keys: keysBody,
    data: dataBody, credits: creditsBody, help: helpBody,
  };

  /** While searching, every section that has something matching, under its own heading. */
  function searchBody() {
    const rows = [];
    for (const [id, title] of SECTIONS) {
      if (!['features', 'sharing', 'credits'].includes(id) && !matches(title)) continue;
      const body = BODIES[id]();
      const found = body.filter((n) => n.classList?.contains(`${P}-card`) || n.tagName === 'UL' || n.tagName === 'H4');
      if (!found.some((n) => n.classList?.contains(`${P}-card`) || (n.tagName === 'UL' && n.children.length)) && !matches(title)) continue;
      rows.push(h('h3', null, title), ...(found.length ? found : body));
    }
    if (rows.length === 0) rows.push(h('div', { class: `${P}-muted` }, `Nothing matches “${query}”.`));
    return rows;
  }

  function render(message = '') {
    panel.dataset.theme = themeOf(doc);
    nav.replaceChildren(...SECTIONS.map(([id, title]) => h('button', {
      type: 'button', role: 'tab', 'data-act': 'tab', 'data-tab': id, 'aria-selected': String(!query && id === section),
    }, title)));
    const title = SECTIONS.find(([id]) => id === section)[1];
    main.replaceChildren(...(query ? searchBody() : [
      h('h3', null, title), h('p', { class: `${P}-intro` }, INTROS[section]), ...BODIES[section](),
    ]));
    status.textContent = message;
  }

  /** Keeps the draft in step with every input, so a section change loses nothing. */
  function onInput(event) {
    const input = event.target;
    if (input === search) {
      query = search.value.trim().toLowerCase();
      render();
      return;
    }
    const { feature, opt, share, key, setting } = input.dataset || {};
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
    }
  }

  // While the page is open, Torn's page behind it does not scroll.
  let bodyOverflow = '';

  function close() {
    if (!panel.hidden) doc.body.style.overflow = bodyOverflow;
    panel.hidden = true;
    armedForget = false;
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
    close();
  }

  async function onClick(event) {
    if (event.target === panel) {
      close();
      return;
    }
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    const act = button.dataset.act;
    if (act !== 'forget') armedForget = false;

    if (act === 'tab') {
      section = button.dataset.tab;
      query = '';
      search.value = '';
      write(KEYS.ui, { section }).catch(() => {});
      render();
      main.scrollTop = 0;
    } else if (act === 'save') {
      await save(draft.settings);
    } else if (act === 'consent') {
      await save({ ...draft.settings, sharingConsent: disclosure.version });
    } else if (act === 'reset') {
      await onReset();
      freshDraft();
      render('Back to defaults.');
    } else if (act === 'close') {
      close();
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

  function onKey(event) {
    if (event.key === 'Escape' && !panel.hidden) close();
  }

  /** Opens the page, on a section when one is named. Nothing is requested. */
  function show(at) {
    if (sectionIds.includes(at)) section = at;
    freshDraft();
    armedForget = false;
    query = '';
    search.value = '';
    render();
    if (panel.hidden) bodyOverflow = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';
    panel.hidden = false;
  }

  panel.addEventListener('click', onClick);
  panel.addEventListener('input', onInput);
  panel.addEventListener('change', onInput);
  doc.addEventListener('keydown', onKey);

  return {
    panel,
    open: show,
    close,
    toggle() {
      if (panel.hidden) show();
      else close();
    },
    render,
    /** The queue changed: refresh its lines if the Sharing section is showing. */
    updateQueue() {
      const box = panel.hidden ? null : panel.querySelector(`#${P}-queue`);
      if (box) box.replaceChildren(...queueLines(getQueue()));
    },
    destroy() {
      doc.removeEventListener('keydown', onKey);
      panel.remove();
    },
  };
}
