// The settings panel (CMP-003, CMP-007, CMP-011, CMP-012, CMP-014, CMP-107).
//
// Four tabs:
//   Features  a switch per feature, grouped by wave, with the options it describes
//   Sharing   the first-run notice, a switch per observation kind, the queue's state
//   Keys      the script key, the optional Torn API key behind its terms table, debug,
//             and "Forget me"
//   Credits   every script this one took code or an idea from
//
// Edits are kept in a draft until Save, so moving between tabs loses nothing. The texts
// the owner words (disclosure.js) are shown as given; where one is still missing, that
// part of the panel stays closed and says so.
//
// Everything is built with createElement and text nodes, and every target is at least
// 44 px so it can be hit with a thumb in Torn PDA.

import META from '../meta.js';
import { CREDITS, CREDITS_URL } from '../credits.js';
import { DISCLOSURE, TOS_COLUMNS, hasTosTable, kindOffered, sharingOffered } from './disclosure.js';
import { el } from './dom.js';
import { checkTyped, onPda } from './keys.js';
import { kindTitle } from './kinds.js';
import { shareKinds } from './registry.js';
import { backendName } from './storage.js';

const P = 'ttc';
const RELEASES = 'https://github.com/tulpn/torn-tracker-companion/releases/latest';

const STYLE = `
  #${P}-fab {
    position: fixed; right: 12px; bottom: 84px; z-index: 99998;
    width: 44px; height: 44px; border-radius: 50%;
    background: #222; color: #fff; border: 1px solid #555;
    box-shadow: 0 2px 8px rgba(0,0,0,.4); cursor: pointer;
    display: flex; align-items: center; justify-content: center; font-size: 18px; line-height: 1;
  }
  #${P}-panel {
    position: fixed; right: 12px; bottom: 136px; z-index: 99999;
    width: min(360px, calc(100vw - 24px)); max-height: min(80vh, 620px); overflow: auto;
    background: #1e1e1e; color: #eee; border: 1px solid #555; border-radius: 8px; padding: 12px;
    font: 13px/1.4 sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,.5); box-sizing: border-box;
  }
  #${P}-panel[hidden], #${P}-fab[hidden] { display: none; }
  #${P}-panel h3 { margin: 0 0 8px; font-size: 14px; }
  #${P}-panel h4 { margin: 12px 0 4px; font-size: 12px; color: #aaa; font-weight: 600; }
  #${P}-panel .${P}-tabs { display: flex; gap: 4px; border-bottom: 1px solid #444; margin: 0 -12px 4px; padding: 0 12px; }
  #${P}-panel .${P}-tabs button {
    flex: 1; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: none; padding: 4px 2px;
  }
  #${P}-panel .${P}-tabs button[aria-selected=true] { border-bottom-color: #2ecc71; color: #fff; font-weight: 700; }
  #${P}-panel label.${P}-check {
    display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer;
  }
  #${P}-panel label.${P}-check[data-off] { color: #777; cursor: default; }
  #${P}-panel label.${P}-field { display: block; margin-top: 6px; }
  #${P}-panel label.${P}-field > span { display: block; margin-bottom: 2px; }
  #${P}-panel input[type=checkbox] { width: 18px; height: 18px; flex: none; }
  #${P}-panel input[type=text], #${P}-panel input[type=password], #${P}-panel input[type=number], #${P}-panel select {
    width: 100%; min-height: 44px; box-sizing: border-box; padding: 4px 8px;
    background: #111; color: #eee; border: 1px solid #666; border-radius: 4px; font: inherit;
  }
  #${P}-panel .${P}-option { margin-left: 26px; }
  #${P}-panel button {
    background: #333; color: #eee; border: 1px solid #666; border-radius: 4px;
    min-height: 44px; padding: 4px 12px; cursor: pointer; font: inherit;
  }
  #${P}-panel button.${P}-primary { background: #2ecc71; color: #000; border-color: #2ecc71; font-weight: 700; }
  #${P}-panel button.${P}-danger { border-color: #e74c3c; color: #e74c3c; }
  #${P}-panel .${P}-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
  #${P}-panel .${P}-muted { color: #999; font-size: 11px; margin-top: 6px; }
  #${P}-panel .${P}-muted a, #${P}-panel .${P}-credits a { color: #8ab4f8; }
  #${P}-panel .${P}-notice { background: #262626; border-left: 3px solid #2ecc71; padding: 8px; margin: 6px 0; white-space: pre-line; }
  #${P}-panel .${P}-warn { color: #f1c40f; font-size: 12px; margin-top: 6px; }
  #${P}-panel .${P}-status { color: #e74c3c; font-size: 12px; margin-top: 6px; min-height: 1em; }
  #${P}-panel dl { margin: 6px 0; }
  #${P}-panel dt { color: #aaa; font-size: 11px; margin-top: 6px; }
  #${P}-panel dd { margin: 0; }
  #${P}-panel .${P}-credits li { margin: 6px 0; }
`;

const TABS = [
  ['features', 'Features'],
  ['sharing', 'Sharing'],
  ['keys', 'Keys'],
  ['credits', 'Credits'],
];

const WAVE_TITLES = { 1: 'Wave 1', 2: 'Wave 2', 3: 'Wave 3' };

function addStyle(doc) {
  if (doc.getElementById(`${P}-style`)) return;
  const style = el('style', { id: `${P}-style`, ownerDocument: doc });
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

  const fab = h('button', {
    id: `${P}-fab`, type: 'button',
    title: `${META.name} — settings`, 'aria-label': `${META.name} settings`,
  }, '⚙');
  const panel = h('div', { id: `${P}-panel`, hidden: true, role: 'dialog', 'aria-label': `${META.name} settings` });
  doc.body.append(fab, panel);

  let tab = 'features';
  let armedForget = false;
  /** What the player has changed and not yet saved. */
  let draft = null;

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

  // ------------------------------------------------------------ Features

  function optionInput(d, key, option) {
    const value = draft.settings.features[d.id]?.[key];
    const data = { 'data-feature': d.id, 'data-opt': key, id: `${P}-opt-${d.id}-${key}` };
    if (typeof value === 'boolean') {
      return h('label', { class: `${P}-check ${P}-option` }, h('input', { type: 'checkbox', ...data, checked: value }), option.label);
    }
    let input;
    if (option.choices) {
      input = h('select', data, ...option.choices.map((choice) => h('option', { value: choice, selected: choice === value }, String(choice))));
    } else if (typeof value === 'number') {
      input = h('input', { type: 'number', inputmode: 'decimal', ...data, value, min: option.min, max: option.max });
    } else {
      input = h('input', { type: 'text', ...data, value });
    }
    return h('label', { class: `${P}-field ${P}-option` }, h('span', null, option.label), input);
  }

  function featuresTab() {
    if (registry.length === 0) {
      return [h('div', { class: `${P}-muted` }, 'No features in this build yet. Wave 1 is on its way.')];
    }
    const keys = draft.keys;
    const rows = [];
    for (const wave of [...new Set(registry.map((d) => d.wave))].sort()) {
      rows.push(h('h4', null, WAVE_TITLES[wave] || `Wave ${wave}`));
      for (const d of registry.filter((f) => f.wave === wave)) {
        rows.push(h('label', { class: `${P}-check` },
          h('input', {
            type: 'checkbox', id: `${P}-feature-${d.id}`, 'data-feature': d.id, 'data-opt': 'enabled',
            checked: draft.settings.features[d.id]?.enabled === true,
          }),
          d.title));
        if (d.needs.scriptKey && !keys.script) {
          rows.push(h('div', { class: `${P}-muted ${P}-option` }, 'Needs your script key (Keys tab).'));
        }
        if (d.needs.apiKey && !keys.api && !keys.usePdaKey) {
          rows.push(h('div', { class: `${P}-muted ${P}-option` }, 'Needs a Torn API key (Keys tab).'));
        }
        for (const [key, option] of Object.entries(d.options || {})) rows.push(optionInput(d, key, option));
      }
    }
    rows.push(h('div', { class: `${P}-row` }, h('button', { type: 'button', 'data-act': 'reset' }, 'Reset to defaults')));
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
      lines.push(h('div', { class: `${P}-warn` }, 'Add your script key on the Keys tab to start sharing.'));
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

  function sharingTab() {
    const kinds = shareKinds(registry);
    const rows = [];
    if (!sharingOffered(disclosure)) {
      rows.push(h('div', { class: `${P}-muted` },
        'Nothing is shared by this version. The sharing switches appear once the notice saying exactly what each one shares is ready.'));
    } else {
      rows.push(h('div', { class: `${P}-notice`, id: `${P}-first-run` }, disclosure.firstRun));
      if (kinds.length === 0) rows.push(h('div', { class: `${P}-muted` }, 'No feature in this build shares anything.'));
      for (const kind of kinds) {
        const offered = kindOffered(kind, disclosure);
        rows.push(h('label', { class: `${P}-check`, 'data-off': !offered },
          h('input', {
            type: 'checkbox', id: `${P}-share-${kind}`, 'data-share': kind,
            checked: offered && draft.settings.shares[kind] === true, disabled: !offered,
          }),
          kindTitle(kind)));
        if (offered) rows.push(h('div', { class: `${P}-muted ${P}-option` }, disclosure.kinds[kind]));
      }
      if (kinds.length && draft.settings.sharingConsent !== disclosure.version) {
        rows.push(h('div', { class: `${P}-row` },
          h('button', { type: 'button', class: `${P}-primary`, 'data-act': 'consent' }, 'Share the kinds I picked')));
        rows.push(h('div', { class: `${P}-muted` }, 'Until you press it, nothing is shared.'));
      }
    }
    rows.push(h('div', { id: `${P}-queue` }, ...queueLines(getQueue())));
    return rows;
  }

  // ------------------------------------------------------------ Keys

  function keysTab() {
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
    rows.push(
      h('h4', null, 'This device'),
      h('label', { class: `${P}-check` },
        h('input', { type: 'checkbox', id: `${P}-debug`, 'data-setting': 'debug', checked: draft.settings.debug === true }),
        'Log what the script does to the browser console'),
      h('div', { class: `${P}-row` },
        h('button', { type: 'button', class: `${P}-danger`, 'data-act': 'forget' },
          armedForget ? 'Really forget everything?' : 'Forget me')),
      h('div', { class: `${P}-muted` }, `Settings and keys are stored only on this device (${backendName()}).`),
    );
    return rows;
  }

  // ------------------------------------------------------------ Credits

  function creditsTab() {
    const rows = [];
    if (credits.length === 0) {
      rows.push(h('div', { class: `${P}-muted` }, 'This build uses no other script\'s code or ideas yet.'));
    } else {
      rows.push(h('ul', { class: `${P}-credits` }, ...credits.map((c) => h('li', null,
        h('a', { href: c.url, target: '_blank', rel: 'noopener noreferrer' }, c.name),
        ` by ${c.author}, ${c.licence}. `,
        c.merged ? `Code: ${c.taken}` : `Idea: ${c.taken}`))));
    }
    rows.push(h('div', { class: `${P}-muted` },
      h('a', { href: CREDITS_URL, target: '_blank', rel: 'noopener noreferrer' }, 'All credits and licences')));
    return rows;
  }

  // ------------------------------------------------------------ frame

  const BODIES = { features: featuresTab, sharing: sharingTab, keys: keysTab, credits: creditsTab };

  function render(status = '') {
    panel.replaceChildren(
      h('h3', null, META.name),
      h('div', { class: `${P}-tabs`, role: 'tablist' }, ...TABS.map(([id, title]) => h('button', {
        type: 'button', role: 'tab', 'data-act': 'tab', 'data-tab': id, 'aria-selected': String(id === tab),
      }, title))),
      ...BODIES[tab](),
      h('div', { class: `${P}-status`, role: 'status' }, status),
      h('div', { class: `${P}-row` },
        h('button', { type: 'button', class: `${P}-primary`, 'data-act': 'save' }, 'Save'),
        h('button', { type: 'button', 'data-act': 'close' }, 'Close')),
      h('div', { class: `${P}-muted` },
        `Version ${version}. `,
        h('a', { href: RELEASES, target: '_blank', rel: 'noopener noreferrer' }, 'Check for an update')),
    );
  }

  /** Keeps the draft in step with every input, so a tab change loses nothing. */
  function onInput(event) {
    const input = event.target;
    const { feature, opt, share, key, setting } = input.dataset || {};
    if (feature && opt) {
      const current = draft.settings.features[feature]?.[opt];
      let value;
      if (input.type === 'checkbox') value = input.checked;
      else if (typeof current === 'number') value = input.value === '' ? NaN : Number(input.value);
      else value = input.value;
      // A half-typed number stays in the field; normalize() keeps the old value if it is not valid.
      if (typeof value !== 'number' || Number.isFinite(value)) draft.settings.features[feature][opt] = value;
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

  async function save(settings) {
    const typed = checkTyped(draft.keys);
    if (typed.error) {
      tab = 'keys';
      render(typed.error);
      return;
    }
    const ok = await onSave(settings, typed.keys);
    if (!ok) {
      render('Could not save: storage is full or unavailable.');
      return;
    }
    freshDraft();
    panel.hidden = true;
  }

  async function onClick(event) {
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    const act = button.dataset.act;
    if (act !== 'forget') armedForget = false;

    if (act === 'tab') {
      tab = button.dataset.tab;
      render();
    } else if (act === 'save') {
      await save(draft.settings);
    } else if (act === 'consent') {
      await save({ ...draft.settings, sharingConsent: disclosure.version });
    } else if (act === 'reset') {
      await onReset();
      freshDraft();
      render('Back to defaults.');
    } else if (act === 'close') {
      panel.hidden = true;
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

  fab.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      freshDraft();
      armedForget = false;
      render();
    }
  });
  panel.addEventListener('click', onClick);
  panel.addEventListener('input', onInput);
  panel.addEventListener('change', onInput);

  return {
    fab,
    panel,
    render,
    /** The queue changed: refresh its lines if the Sharing tab is showing. */
    updateQueue() {
      const box = panel.hidden ? null : panel.querySelector(`#${P}-queue`);
      if (box) box.replaceChildren(...queueLines(getQueue()));
    },
    destroy() {
      panel.remove();
      fab.remove();
    },
  };
}
