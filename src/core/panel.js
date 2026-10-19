// The settings panel (CMP-003, CMP-007, CMP-107).
//
// A switch per feature, "Forget me", and the version. The sharing switches, the key
// fields and the credits page join them in WP-CMP-4; this is the frame they hang on.
//
// Everything is built with createElement and text nodes, and every target is at least
// 44 px so it can be hit with a thumb in Torn PDA.

import META from '../meta.js';
import { el } from './dom.js';
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
  #${P}-panel label.${P}-check {
    display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer;
  }
  #${P}-panel input[type=checkbox] { width: 18px; height: 18px; flex: none; }
  #${P}-panel button {
    background: #333; color: #eee; border: 1px solid #666; border-radius: 4px;
    min-height: 44px; padding: 4px 12px; cursor: pointer; font: inherit;
  }
  #${P}-panel button.${P}-primary { background: #2ecc71; color: #000; border-color: #2ecc71; font-weight: 700; }
  #${P}-panel button.${P}-danger { border-color: #e74c3c; color: #e74c3c; }
  #${P}-panel .${P}-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
  #${P}-panel .${P}-muted { color: #999; font-size: 11px; margin-top: 10px; }
  #${P}-panel .${P}-muted a { color: #8ab4f8; }
  #${P}-panel .${P}-status { color: #e74c3c; font-size: 12px; margin-top: 6px; min-height: 1em; }
`;

const WAVE_TITLES = { 1: 'Wave 1', 2: 'Wave 2', 3: 'Wave 3' };

function addStyle(doc) {
  if (doc.getElementById(`${P}-style`)) return;
  const style = el('style', { id: `${P}-style`, ownerDocument: doc });
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/**
 * @param {object} opts
 * @param {ReadonlyArray<object>} opts.registry
 * @param {() => object} opts.getSettings
 * @param {(next: object) => Promise<boolean>} opts.onSave
 * @param {() => Promise<boolean>} opts.onForget
 * @param {() => Promise<void>} opts.onReset
 */
export function mountPanel({
  doc = globalThis.document,
  registry,
  getSettings,
  onSave,
  onForget,
  onReset,
  version,
}) {
  addStyle(doc);

  const fab = el('button', {
    id: `${P}-fab`, type: 'button', ownerDocument: doc,
    title: `${META.name} — settings`, 'aria-label': `${META.name} settings`,
  }, '⚙');
  const panel = el('div', { id: `${P}-panel`, hidden: true, ownerDocument: doc, role: 'dialog' });
  doc.body.append(fab, panel);

  let armedForget = false;

  function featureRows() {
    if (registry.length === 0) {
      return [el('div', { class: `${P}-muted`, ownerDocument: doc },
        'No features in this build yet. Wave 1 is on its way.')];
    }
    const settings = getSettings();
    const waves = [...new Set(registry.map((d) => d.wave))].sort();
    const rows = [];
    for (const wave of waves) {
      rows.push(el('h4', { ownerDocument: doc }, WAVE_TITLES[wave] || `Wave ${wave}`));
      for (const d of registry.filter((f) => f.wave === wave)) {
        rows.push(el('label', { class: `${P}-check`, ownerDocument: doc },
          el('input', {
            type: 'checkbox', id: `${P}-feature-${d.id}`, ownerDocument: doc,
            checked: settings.features[d.id]?.enabled === true,
          }),
          d.title));
      }
    }
    return rows;
  }

  function render(status = '') {
    const settings = getSettings();
    panel.replaceChildren(
      el('h3', { ownerDocument: doc }, META.name),
      ...featureRows(),
      el('h4', { ownerDocument: doc }, 'This device'),
      el('label', { class: `${P}-check`, ownerDocument: doc },
        el('input', { type: 'checkbox', id: `${P}-debug`, checked: settings.debug === true, ownerDocument: doc }),
        'Log what the script does to the browser console'),
      el('div', { class: `${P}-row`, ownerDocument: doc },
        el('button', { type: 'button', class: `${P}-primary`, 'data-act': 'save', ownerDocument: doc }, 'Save'),
        el('button', { type: 'button', 'data-act': 'reset', ownerDocument: doc }, 'Reset to defaults'),
        el('button', { type: 'button', 'data-act': 'close', ownerDocument: doc }, 'Close')),
      el('div', { class: `${P}-row`, ownerDocument: doc },
        el('button', { type: 'button', class: `${P}-danger`, 'data-act': 'forget', ownerDocument: doc },
          armedForget ? 'Really forget everything?' : 'Forget me')),
      el('div', { class: `${P}-status`, ownerDocument: doc }, status),
      el('div', { class: `${P}-muted`, ownerDocument: doc },
        `Version ${version}. Settings are stored only on this device (${backendName()}). `,
        el('a', { href: RELEASES, target: '_blank', rel: 'noopener noreferrer', ownerDocument: doc },
          'Check for an update')),
    );
  }

  function collect() {
    const settings = getSettings();
    const next = { ...settings, features: { ...settings.features }, shares: { ...settings.shares } };
    for (const d of registry) {
      const input = panel.querySelector(`#${P}-feature-${d.id}`);
      if (input) next.features[d.id] = { ...settings.features[d.id], enabled: input.checked };
    }
    const debug = panel.querySelector(`#${P}-debug`);
    if (debug) next.debug = debug.checked;
    return next;
  }

  async function onClick(event) {
    const button = event.target.closest(`button[data-act]`);
    if (!button) return;
    const act = button.dataset.act;

    if (act !== 'forget') armedForget = false;

    if (act === 'save') {
      const ok = await onSave(collect());
      if (ok) panel.hidden = true;
      else render('Could not save: storage is full or unavailable.');
    } else if (act === 'reset') {
      await onReset();
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
      render(ok ? 'Everything on this device is cleared.' : 'Could not clear storage.');
    }
  }

  fab.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) render();
  });
  panel.addEventListener('click', onClick);

  return {
    fab,
    panel,
    render,
    destroy() {
      panel.remove();
      fab.remove();
    },
  };
}
