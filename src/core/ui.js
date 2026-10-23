// One look for everything the companion adds to Torn's pages (hq #224).
//
// Features never pick colours or sizes of their own: they ask for a badge, a strip, a
// note or a small button here, with a tone that says what it means. One stylesheet,
// built on Torn's own CSS variables where they exist, follows Torn's light and dark
// themes (`body.dark-mode`) and wraps on a phone instead of overflowing. A badge whose
// colour is the data itself (the fair-fight scale) passes it in as `--ttc-tone-bg`.

import { el } from './dom.js';

const P = 'ttc';
export const TONES = Object.freeze(['good', 'neutral', 'warn', 'bad', 'info']);

const STYLE = `
  .${P}-ui-badge {
    --ttc-good-bg: rgba(39, 133, 82, .14); --ttc-good-fg: #1d6b40;
    --ttc-neutral-bg: rgba(95, 107, 117, .14); --ttc-neutral-fg: #4a5560;
    --ttc-warn-bg: rgba(196, 135, 0, .16); --ttc-warn-fg: #8a5a00;
    --ttc-bad-bg: rgba(192, 57, 43, .14); --ttc-bad-fg: #a3271b;
    --ttc-info-bg: rgba(45, 105, 170, .14); --ttc-info-fg: #23578f;
    display: inline-flex; align-items: center; gap: 4px; max-width: 100%; box-sizing: border-box;
    margin: 1px 0 1px 6px; padding: 1px 8px; border-radius: 999px;
    font: 600 11px/16px system-ui, -apple-system, "Segoe UI", Arial, sans-serif; letter-spacing: .01em;
    vertical-align: middle; white-space: normal; overflow-wrap: anywhere; text-decoration: none;
    background: var(--ttc-neutral-bg); color: var(--ttc-neutral-fg);
  }
  .${P}-ui-badge[data-tone="good"] { background: var(--ttc-good-bg); color: var(--ttc-good-fg); }
  .${P}-ui-badge[data-tone="warn"] { background: var(--ttc-warn-bg); color: var(--ttc-warn-fg); }
  .${P}-ui-badge[data-tone="bad"] { background: var(--ttc-bad-bg); color: var(--ttc-bad-fg); }
  .${P}-ui-badge[data-tone="info"] { background: var(--ttc-info-bg); color: var(--ttc-info-fg); }
  .${P}-ui-badge[data-tone="scale"] { background: var(--ttc-tone-bg); color: #fff; min-width: 34px; justify-content: center; }
  .${P}-ui-badge[data-tone="scale"][data-ink="dark"] { color: #111; }
  .${P}-ui-badge[data-dim="true"] { opacity: .5; }
  a.${P}-ui-badge:hover { filter: brightness(.95); text-decoration: underline; }
  body.dark-mode .${P}-ui-badge {
    --ttc-good-bg: rgba(72, 187, 120, .2); --ttc-good-fg: #8fe0b0;
    --ttc-neutral-bg: rgba(160, 170, 180, .18); --ttc-neutral-fg: #c9d1d9;
    --ttc-warn-bg: rgba(240, 180, 40, .2); --ttc-warn-fg: #f3cd6b;
    --ttc-bad-bg: rgba(240, 90, 75, .2); --ttc-bad-fg: #ff9e92;
    --ttc-info-bg: rgba(90, 160, 240, .2); --ttc-info-fg: #9cc8ff;
  }
  .${P}-ui-block { display: flex; width: fit-content; margin: 3px 0 0; }
  /* Pinned over the bottom edge of a positioned box (a round icon), so it takes no line of
     its own in a row whose height Torn fixes. Opaque, so the icon doesn't show through. */
  .${P}-ui-badge[data-pin="under"] {
    position: absolute; left: 50%; bottom: -5px; transform: translateX(-50%); z-index: 1; margin: 0;
    padding: 0 7px; white-space: nowrap; font-size: 10px; line-height: 15px; pointer-events: none;
    --ttc-pin-under: var(--default-bg-panel-color, #f2f2f2);
    box-shadow: 0 0 0 2px var(--ttc-pin-under);
  }
  body.dark-mode .${P}-ui-badge[data-pin="under"] { --ttc-pin-under: #2a2a2a; }
${['good', 'neutral', 'warn', 'bad', 'info'].map((t) => `  .${P}-ui-badge[data-pin="under"][data-tone="${t}"] { background: linear-gradient(var(--ttc-${t}-bg), var(--ttc-${t}-bg)), var(--ttc-pin-under); }`).join(' ')}
  .${P}-ui-strip {
    display: block; box-sizing: border-box; max-width: 100%; margin: 10px 0; padding: 10px 14px;
    border-radius: 10px; border: 1px solid rgba(0, 0, 0, .08); border-left: 4px solid #278552;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .08);
    font: 13px/1.55 system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
    background: var(--default-bg-panel-color, #fff); color: var(--default-font-color, #2b2b2b);
    overflow-wrap: anywhere;
  }
  .${P}-ui-strip[data-tone="bad"] { border-left-color: #c0392b; }
  .${P}-ui-strip[data-tone="info"] { border-left-color: #2d69aa; }
  .${P}-ui-strip strong:first-child { display: block; margin-bottom: 4px; font-size: 13px; }
  .${P}-ui-strip ol, .${P}-ui-strip ul { margin: 4px 0 6px 18px; padding: 0; }
  .${P}-ui-strip li { margin: 2px 0; }
  .${P}-ui-strip a { color: var(--default-blue-color, #2a5d9f); font-weight: 600; }
  body.dark-mode .${P}-ui-strip {
    background: var(--default-bg-panel-color, #2a2a2a); color: var(--default-font-color, #e3e3e3);
    border-color: rgba(255, 255, 255, .08); box-shadow: none;
  }
  body.dark-mode .${P}-ui-strip a { color: var(--default-blue-color, #8ab4f8); }
  .${P}-ui-note { display: block; margin-top: 2px; font: 11px/1.4 system-ui, -apple-system, "Segoe UI", Arial, sans-serif; opacity: .75; overflow-wrap: anywhere; }
  .${P}-ui-bar {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 8px 0;
    font: 12px system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  }
  .${P}-ui-button {
    min-height: 26px; padding: 2px 12px; border: 1px solid rgba(0, 0, 0, .15); border-radius: 999px; cursor: pointer;
    font: 600 11px/18px system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
    background: var(--default-bg-panel-color, #fff); color: var(--default-font-color, #333);
    transition: background-color .15s, border-color .15s;
  }
  .${P}-ui-button:hover:not(:disabled) { border-color: #278552; }
  .${P}-ui-button[aria-pressed="true"], .${P}-ui-button[data-tone="good"] { background: #278552; border-color: #278552; color: #fff; }
  .${P}-ui-button[data-tone="bad"] { background: rgba(192, 57, 43, .14); border-color: transparent; color: #a3271b; cursor: default; }
  .${P}-ui-button:disabled { cursor: default; }
  .${P}-ui-button:focus-visible { outline: 2px solid #2d69aa; outline-offset: 2px; }
  body.dark-mode .${P}-ui-button { background: var(--default-bg-panel-color, #2a2a2a); color: var(--default-font-color, #e3e3e3); border-color: rgba(255, 255, 255, .18); }
  body.dark-mode .${P}-ui-button[data-tone="bad"] { background: rgba(240, 90, 75, .2); color: #ff9e92; }
  /* The best buy abroad: its whole row is outlined, without touching Torn's own styles. */
  [class*='row___']:has(.${P}-best) { outline: 2px solid #278552; outline-offset: -2px; border-radius: 6px; }
  @media (pointer: coarse) {
    .${P}-ui-button { min-height: 44px; min-width: 44px; padding: 6px 14px; }
  }
`;

/** Puts the one stylesheet on the page, once. */
export function ensureStyle(doc) {
  if (doc.getElementById(`${P}-ui-style`)) return;
  const style = el('style', { id: `${P}-ui-style`, ownerDocument: doc });
  style.textContent = STYLE;
  (doc.head || doc.documentElement).append(style);
}

function classes(base, extra) {
  return [base, extra].filter(Boolean).join(' ');
}

/**
 * A small label beside something on the page.
 * @param {Document} doc
 * @param {object} [opts]
 * @param {string} [opts.cls]    the feature's own class, which finds it again
 * @param {string} [opts.tone]   good, neutral, warn, bad or info
 * @param {boolean} [opts.block] on its own line
 * @param {'under'} [opts.pin]   pinned over the bottom edge of its (positioned) parent
 * @param {string} [opts.tag]    span by default; 'a' for a link
 * @param {object} [opts.attrs]  any other attributes
 */
export function badge(doc, { cls, tone = 'neutral', block = false, pin = null, tag = 'span', attrs = {} } = {}, ...children) {
  ensureStyle(doc);
  const node = el(tag, {
    class: classes(`${P}-ui-badge${block ? ` ${P}-ui-block` : ''}`, cls), 'data-tone': tone, ownerDocument: doc,
    ...(pin === 'under' ? { 'data-pin': 'under' } : {}), ...attrs,
  }, ...children);
  return node;
}

/** Changes a badge's tone; `scale` sets a data colour (with dark or light ink) instead. */
export function setTone(node, tone, { scale = null, ink = 'light', dim = false } = {}) {
  if (scale) {
    node.dataset.tone = 'scale';
    node.style.setProperty('--ttc-tone-bg', scale);
  } else {
    node.dataset.tone = TONES.includes(tone) ? tone : 'neutral';
    node.style.removeProperty('--ttc-tone-bg');
  }
  if (ink === 'dark') node.dataset.ink = 'dark';
  else delete node.dataset.ink;
  node.dataset.dim = String(Boolean(dim));
}

/** A strip of text across the page: a panel of runs, a pre-war line, a loadout card. */
export function strip(doc, { cls, tone, attrs = {} } = {}, ...children) {
  ensureStyle(doc);
  return el('div', { class: classes(`${P}-ui-strip`, cls), 'data-tone': tone, ownerDocument: doc, ...attrs }, ...children);
}

/** A small line of secondary text. */
export function note(doc, { cls, attrs = {} } = {}, ...children) {
  ensureStyle(doc);
  return el('span', { class: classes(`${P}-ui-note`, cls), ownerDocument: doc, ...attrs }, ...children);
}

/** A row of our own small controls. */
export function bar(doc, { cls, attrs = {} } = {}, ...children) {
  ensureStyle(doc);
  return el('div', { class: classes(`${P}-ui-bar`, cls), ownerDocument: doc, ...attrs }, ...children);
}

/** One of our own small buttons; 44 px on touch screens. */
export function button(doc, { cls, tone, attrs = {} } = {}, ...children) {
  ensureStyle(doc);
  return el('button', { type: 'button', class: classes(`${P}-ui-button`, cls), 'data-tone': tone, ownerDocument: doc, ...attrs }, ...children);
}
