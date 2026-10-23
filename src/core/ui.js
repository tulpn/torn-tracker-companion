// One look for everything the companion adds to Torn's pages (hq #224, WP-UI-8).
//
// Features never pick colours or sizes of their own: they ask for a badge, a strip, a
// note or a small button here, with a tone that says what it means. Every colour, radius
// and font comes from the suite's design tokens (core/tokens.js), declared on our own
// elements only, in the theme Torn shows (`body.dark-mode`), and everything wraps on a
// phone instead of overflowing. A badge whose colour is the data itself (the fair-fight
// scale) passes it in as `--ttc-tone-bg`.

import { el } from './dom.js';
import { followTorn } from './tokens.js';
import { TOKENS } from '../data/tokens.js';

const P = 'ttc';
export const TONES = Object.freeze(['good', 'neutral', 'warn', 'bad', 'info']);

const OWN = `.${P}-ui-badge, .${P}-ui-strip, .${P}-ui-note, .${P}-ui-bar, .${P}-ui-button`;
/** Each tone's ink; its background is the same colour, faint. */
const INK = Object.freeze({
  good: 'var(--tt-success)',
  neutral: 'var(--muted-foreground)',
  warn: 'var(--tt-warning)',
  // The destructive red is a fill colour; as text on a dark card it needs lifting.
  bad: 'color-mix(in srgb, var(--destructive) 65%, var(--foreground))',
  info: 'var(--ring)',
});
const tint = (ink, amount = 16) => `color-mix(in srgb, ${ink} ${amount}%, transparent)`;

const STYLE = `
  ${followTorn(OWN)}
  .${P}-ui-badge {
    --ttc-ink: ${INK.neutral};
    display: inline-flex; align-items: center; gap: 4px; max-width: 100%; box-sizing: border-box;
    margin: 1px 0 1px 6px; padding: 1px 8px; border-radius: 999px;
    font: 600 11px/16px var(--tt-font-sans); letter-spacing: .01em;
    vertical-align: middle; white-space: normal; overflow-wrap: anywhere; text-decoration: none;
    background: ${tint('var(--ttc-ink)')}; color: var(--ttc-ink);
  }
${TONES.filter((t) => t !== 'neutral').map((t) => `  .${P}-ui-badge[data-tone="${t}"] { --ttc-ink: ${INK[t]}; }`).join('\n')}
  .${P}-ui-badge[data-tone="scale"] { background: var(--ttc-tone-bg); color: #fff; min-width: 34px; justify-content: center; }
  .${P}-ui-badge[data-tone="scale"][data-ink="dark"] { color: #111; }
  .${P}-ui-badge[data-dim="true"] { opacity: .5; }
  a.${P}-ui-badge:hover { filter: brightness(.95); text-decoration: underline; }
  .${P}-ui-block { display: flex; width: fit-content; margin: 3px 0 0; }
  /* Pinned over the bottom edge of a positioned box (a round icon), so it takes no line of
     its own in a row whose height Torn fixes. Opaque, so the icon doesn't show through. */
  .${P}-ui-badge[data-pin="under"] {
    position: absolute; left: 50%; bottom: -5px; transform: translateX(-50%); z-index: 1; margin: 0;
    padding: 0 7px; white-space: nowrap; font-size: 10px; line-height: 15px; pointer-events: none;
    --ttc-pin-under: var(--default-bg-panel-color, var(--card));
    background: linear-gradient(${tint('var(--ttc-ink)')}, ${tint('var(--ttc-ink)')}), var(--ttc-pin-under);
    box-shadow: 0 0 0 2px var(--ttc-pin-under);
  }
  .${P}-ui-badge[data-pin="under"][data-tone="scale"] { background: var(--ttc-tone-bg); }
  .${P}-ui-strip {
    --ttc-ink: ${INK.good};
    display: block; box-sizing: border-box; max-width: 100%; margin: 10px 0; padding: 10px 14px;
    border-radius: var(--radius); border: 1px solid var(--border); border-left: 4px solid var(--ttc-ink);
    box-shadow: var(--tt-shadow-sm);
    font: 13px/1.55 var(--tt-font-sans);
    background: var(--card); color: var(--card-foreground);
    overflow-wrap: anywhere;
  }
  .${P}-ui-strip[data-tone="bad"] { --ttc-ink: var(--destructive); }
  .${P}-ui-strip[data-tone="info"] { --ttc-ink: var(--primary); }
  .${P}-ui-strip strong:first-child { display: block; margin-bottom: 4px; font-size: 13px; }
  .${P}-ui-strip ol, .${P}-ui-strip ul { margin: 4px 0 6px 18px; padding: 0; }
  .${P}-ui-strip li { margin: 2px 0; }
  .${P}-ui-strip a { color: var(--ring); font-weight: 600; }
  .${P}-ui-note { display: block; margin-top: 2px; font: 11px/1.4 var(--tt-font-sans); color: var(--muted-foreground); overflow-wrap: anywhere; }
  .${P}-ui-bar {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 8px 0;
    font: 12px var(--tt-font-sans);
  }
  .${P}-ui-button {
    min-height: 26px; padding: 2px 12px; border: 1px solid var(--input); border-radius: 999px; cursor: pointer;
    font: 600 11px/18px var(--tt-font-sans);
    background: var(--card); color: var(--card-foreground);
    transition: background-color var(--tt-duration-fast) var(--tt-ease), border-color var(--tt-duration-fast) var(--tt-ease);
  }
  .${P}-ui-button:hover:not(:disabled) { border-color: var(--primary); }
  .${P}-ui-button[aria-pressed="true"], .${P}-ui-button[data-tone="good"] {
    background: var(--primary); border-color: var(--primary); color: var(--primary-foreground);
  }
  .${P}-ui-button[data-tone="bad"] { background: ${tint(INK.bad)}; border-color: transparent; color: ${INK.bad}; cursor: default; }
  .${P}-ui-button:disabled { cursor: default; }
  .${P}-ui-button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  /* The best buy abroad: its whole row is outlined, without touching Torn's own styles. */
  /* Torn's own element: the tokens' values go in directly, so none of its variables change. */
  [class*='row___']:has(.${P}-best) { outline: 2px solid ${TOKENS.light['tt-success']}; outline-offset: -2px; border-radius: 6px; }
  body.dark-mode [class*='row___']:has(.${P}-best) { outline-color: ${TOKENS.dark['tt-success']}; }
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
