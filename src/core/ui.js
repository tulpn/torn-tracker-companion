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

const OWN = `.${P}-ui-badge, .${P}-ui-strip, .${P}-ui-note, .${P}-ui-bar, .${P}-ui-button, .${P}-profile-actions, .${P}-lists-menu`;
/** The lists menu's class twice, so Torn's own `a` and `button` rules don't reach in. */
const MENU = `.${P}-lists-menu.${P}-lists-menu`;
/** The profile's row of our buttons (hq #467), and the order its parts keep. */
export const PROFILE_ACTIONS = `${P}-profile-actions`;
const ACTION_ORDER = Object.freeze(['lists', 'messages', 'notes']);
/** The row's class twice: it outweighs Torn's `.d .content-title button`. */
const ROW = `.${PROFILE_ACTIONS}.${PROFILE_ACTIONS}`;
/** A compact badge (hq #522); the class twice, see the style. */
const COMPACT = `.${P}-ui-compact.${P}-ui-compact`;
/** Each tone's ink; its background is the same colour, faint. */
const INK = Object.freeze({
  good: 'var(--tt-success)',
  neutral: 'var(--muted-foreground)',
  // Amber, never red (hq #557 E35): the site's --tt-warning is red in its light theme, so
  // caution and bad looked the same there. --tt-nerve is orange in both themes.
  warn: 'var(--tt-nerve)',
  // The destructive red is a fill colour; as text on a dark card it needs lifting.
  bad: 'color-mix(in srgb, var(--destructive) 65%, var(--foreground))',
  info: 'var(--ring)',
});
/** A small button inline in one of Torn's forms (hq #521); the class twice, see the style. */
const INLINE = `.${P}-ui-inline.${P}-ui-inline`;
/** A small button inside one of Torn's table rows (hq #535); the class twice, see the style. */
const SMALL = `.${P}-ui-small.${P}-ui-small`;
/** The shop price highlighter's tiers and the token each is drawn in. */
// Every tier is a profit, so none is red (hq #557 E35): green, yellow, blue, then grey for the
// smallest. The keys stay as saved in settings; the names the player sees are Best to Small.
const SHOP_TIERS = Object.freeze([['green', 'tt-ff-easy'], ['yellow', 'tt-ff-fair'], ['red', 'ring'], ['blue', 'muted-foreground']]);
const tint = (ink, amount = 16) => `color-mix(in srgb, ${ink} ${amount}%, transparent)`;

const each = (selectors, suffix) => selectors.split(',').map((one) => `${one.trim()}${suffix}`).join(', ');

/**
 * The one button look (hq #557 E33): the settings panel, the dashboard and the buttons on
 * Torn's pages all draw theirs from here, so a button is the same shape, weight and colour
 * wherever it shows. Each place sets only its size. `primary` is the selector of the one
 * main action in a group, filled with the accent.
 * @param {string} sel the plain button selector(s), comma separated
 * @param {string} primary the primary variant's selector(s)
 */
export function buttonCss(sel, primary) {
  return `
  ${sel} {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box;
    border: 1px solid var(--input); border-radius: var(--radius); cursor: pointer; text-decoration: none;
    font: 600 13px/18px var(--tt-font-sans);
    background: var(--card); color: var(--card-foreground);
    transition: background-color var(--tt-duration-fast) var(--tt-ease), border-color var(--tt-duration-fast) var(--tt-ease);
  }
  ${each(sel, ':hover:not(:disabled)')} { border-color: var(--primary); text-decoration: none; }
  ${each(sel, ':focus-visible')} { outline: 2px solid var(--ring); outline-offset: 2px; }
  ${each(sel, ':disabled')} { cursor: default; opacity: .6; }
  ${primary} { background: var(--primary); border-color: var(--primary); color: var(--primary-foreground); }
  ${each(primary, ':hover:not(:disabled)')} { filter: brightness(1.05); color: var(--primary-foreground); }`;
}

const STYLE = `
  ${followTorn(OWN)}
  .${P}-ui-badge {
    --ttc-ink: ${INK.neutral};
    display: inline-flex; align-items: center; gap: 4px; max-width: 100%; box-sizing: border-box;
    margin: 1px 0 1px 6px; padding: 1px 8px; border-radius: 999px;
    font: 600 12px/16px var(--tt-font-sans); letter-spacing: .01em;
    vertical-align: middle; white-space: normal; overflow-wrap: anywhere; text-decoration: none;
    background: ${tint('var(--ttc-ink)')}; color: var(--ttc-ink);
  }
${TONES.filter((t) => t !== 'neutral').map((t) => `  .${P}-ui-badge[data-tone="${t}"] { --ttc-ink: ${INK[t]}; }`).join('\n')}
  .${P}-ui-badge[data-tone="scale"] { background: var(--ttc-tone-bg); color: #fff; min-width: 34px; justify-content: center; }
  .${P}-ui-badge[data-tone="scale"][data-ink="dark"] { color: #111; }
  .${P}-ui-badge[data-dim="true"] { opacity: .5; }
  /* A badge that is a link (hq issue 557, 23): a trailing arrow says it goes somewhere, and on
     hover or focus its tint deepens and the words underline. The ink follows the theme. */
  a.${P}-ui-badge:not(.${P}-ui-compact)::after { content: '\\203A'; font-weight: 700; }
  a.${P}-ui-badge { cursor: pointer; }
  a.${P}-ui-badge:hover, a.${P}-ui-badge:focus-visible { background: ${tint('var(--ttc-ink)', 28)}; color: var(--ttc-ink); text-decoration: underline; }
  a.${P}-ui-badge:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  .${P}-ui-block { display: flex; width: fit-content; margin: 3px 0 0; }
  /* Compact (hq issue 522): one short line in a row whose height Torn fixes. The class twice
     outweighs Torn's own span and button rules in that row. A badge with a data-detail shows
     it below itself while data-open is true (a tap, set by the feature). */
  ${COMPACT} {
    flex: none; position: relative; box-sizing: border-box; width: auto; min-width: 0; height: 16px; min-height: 0;
    margin: 0 0 0 4px; padding: 0 6px; border: 0; box-shadow: none; text-shadow: none; text-transform: none;
    font: 600 12px/16px var(--tt-font-sans); white-space: nowrap; overflow-wrap: normal; vertical-align: middle;
  }
  ${COMPACT}[data-detail] { cursor: help; }
  ${COMPACT}[role="button"]:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  ${COMPACT}[data-open="true"]::after {
    content: attr(data-detail); position: absolute; top: calc(100% + 4px); left: 0; z-index: 10;
    width: max-content; max-width: min(220px, 90vw); padding: 6px 8px; white-space: normal; text-align: left;
    font: 400 12px/1.4 var(--tt-font-sans); border: 1px solid var(--border); border-radius: var(--radius);
    background: var(--popover); color: var(--popover-foreground); box-shadow: var(--tt-shadow-md);
  }
  /* Near the right edge the detail opens leftwards, so it stays on a 360 px screen (hq issue 557, A9). */
  ${COMPACT}[data-open="true"][data-flip="end"]::after { left: auto; right: 0; }
  /* Pinned over the bottom edge of a positioned box (a round icon), so it takes no line of
     its own in a row whose height Torn fixes. Opaque, so the icon doesn't show through. */
  .${P}-ui-badge[data-pin="under"] {
    position: absolute; left: 50%; bottom: -5px; transform: translateX(-50%); z-index: 1; margin: 0;
    padding: 0 7px; white-space: nowrap; font-size: 12px; line-height: 16px; pointer-events: none;
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
  .${P}-ui-strip[data-tone="warn"] { --ttc-ink: ${INK.warn}; }
  .${P}-ui-strip[data-tone="bad"] { --ttc-ink: var(--destructive); }
  .${P}-ui-strip[data-tone="info"] { --ttc-ink: var(--primary); }
  .${P}-ui-strip strong:first-child { display: block; margin-bottom: 4px; font-size: 13px; }
  .${P}-ui-strip ol, .${P}-ui-strip ul { margin: 4px 0 6px 18px; padding: 0; }
  .${P}-ui-strip li { margin: 2px 0; }
  .${P}-ui-strip a { color: var(--ring); font-weight: 600; }
  .${P}-ui-note { display: block; margin-top: 2px; font: 12px/1.4 var(--tt-font-sans); color: var(--muted-foreground); overflow-wrap: anywhere; }
  .${P}-ui-bar {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 8px 0;
    font: 12px var(--tt-font-sans);
  }
  ${buttonCss(`.${P}-ui-button`, `.${P}-ui-button[data-variant="primary"], .${P}-ui-button[aria-pressed="true"], .${P}-ui-button[data-tone="good"]`)}
  .${P}-ui-button { min-height: 26px; padding: 2px 12px; }
  .${P}-ui-button[data-tone="bad"] { background: ${tint(INK.bad)}; border-color: transparent; color: ${INK.bad}; cursor: default; }
  /* Small (hq issue 535): one line inside a row Torn keeps narrow, like the war list's
     member cell. It never wraps into a tall pill and never takes Torn's own button rules. */
  ${SMALL} {
    display: inline-flex; flex: none; align-items: center; vertical-align: middle; box-sizing: border-box;
    width: auto; min-width: 0; height: 20px; min-height: 0; margin: 0 0 0 4px; padding: 0 8px;
    font: 600 13px/18px var(--tt-font-sans); white-space: nowrap; overflow-wrap: normal; text-transform: none;
  }
  /* Inline beside one of Torn's form fields (hq issue 521): the field's height, one line, our
     accent. The class twice outweighs Torn's own form button rules, which made it black. */
  ${INLINE} {
    display: inline-flex; flex: none; align-items: center; vertical-align: middle; box-sizing: border-box;
    min-height: 0; min-width: 0; height: 24px; margin: 0 0 0 4px; padding: 0 8px; white-space: nowrap;
    font: 600 13px/1 var(--tt-font-sans); text-transform: none; box-shadow: none; text-shadow: none;
    border: 1px solid var(--primary); border-radius: var(--radius);
    background: ${tint('var(--primary)')}; color: var(--foreground);
  }
  ${INLINE}:hover:not(:disabled) { background: ${tint('var(--primary)', 28)}; }
  ${INLINE}:disabled { border-color: var(--input); background: transparent; color: var(--muted-foreground); }
  /* Its field and it stay on one line inside Torn's cell, the field shrinking to make room.
     Torn's own cell rules set display: block with a long selector, so this one is important.
     A block of ours in the same cell (the undersell warning, hq issue 557) takes a line of
     its own below them: the field starts from no width, so the field and the button never
     wrap, and only the block does. */
  :has(> ${INLINE}) { display: flex !important; flex-wrap: wrap; align-items: center; }
  :has(> ${INLINE}) > :not(${INLINE}, .${P}-ui-block) { flex: 1 1 0; min-width: 0; }
  :has(> ${INLINE}) > .${P}-ui-block { flex: 0 0 100%; order: 1; box-sizing: border-box; }
  :has(> ${INLINE}) > :not(${INLINE}) input:not([type="hidden"]) { width: 100% !important; box-sizing: border-box; }
  /* Gym progress (hq issue 610): a line in Torn's welcome box, in its font; wraps as a sentence. */
  .${P}-gym { display: block; margin: 2px 0 0; font: inherit; color: inherit; white-space: normal; word-break: normal; overflow-wrap: normal; }
  /* The best buy abroad: its whole row is outlined, without touching Torn's own styles. */
  /* Torn's own element: the tokens' values go in directly, so none of its variables change. */
  [class*='row___']:has(.${P}-best) { outline: 2px solid ${TOKENS.light['tt-success']}; outline-offset: -2px; border-radius: 6px; }
  body.dark-mode [class*='row___']:has(.${P}-best) { outline-color: ${TOKENS.dark['tt-success']}; }
  /* Item Market listings below a shop's price (CMP-109): attributes on Torn's own nodes,
     an outline on the listing, a dot and the profit beside its price. */
${SHOP_TIERS.map(([tier, token]) => `  [data-${P}-shop="${tier}"], [data-${P}-shop-dot="${tier}"] { --${P}-shop-ink: ${TOKENS.light[token]}; }
  body.dark-mode [data-${P}-shop="${tier}"], body.dark-mode [data-${P}-shop-dot="${tier}"] { --${P}-shop-ink: ${TOKENS.dark[token]}; }`).join('\n')}
  [data-${P}-shop] { outline: 2px solid var(--${P}-shop-ink) !important; outline-offset: -2px; border-radius: 4px; }
  [data-${P}-shop-hide] { display: none !important; }
  /* The bounty board (BNT-012): rows outside the filter, and hospital timers nearly up. */
  [data-${P}-bounty-hide] { display: none !important; }
  [data-${P}-bounty-soon] { outline: 2px solid ${TOKENS.light['tt-success']} !important; outline-offset: -2px; border-radius: 4px; }
  body.dark-mode [data-${P}-bounty-soon] { outline-color: ${TOKENS.dark['tt-success']} !important; }
  /* The war page (hq issue 535): Torn's member and status cells are floats of a fixed height,
     so anything that wraps inside them spills over the row below, and another script's
     second line under the row (TornTools' stats estimate) makes that worse. At every width:
     one thing per status cell, our timer standing in for Torn's word (the word is in its
     title), and the dibs button a 24 px icon before the banner (its label in its title),
     on one line that never wraps. */
  [data-${P}-war-timed] { font-size: 0 !important; white-space: nowrap; }
  [data-${P}-war-timed] > .${P}-war-time { margin: 0; }
  .member:has(> .${P}-war-dibs) { display: flex !important; flex-wrap: nowrap; align-items: center; }
  .member:has(> .${P}-war-dibs) > :not(.${P}-war-dibs) { min-width: 0; }
  ${SMALL}.${P}-war-dibs { order: -1; width: 24px; margin: 0 4px 0 0; padding: 0; justify-content: center; font-size: 0; }
  ${SMALL}.${P}-war-dibs::before { content: attr(data-short); font-size: 12px; line-height: 18px; }
  .${P}-ui-bar label { display: inline-flex; align-items: center; gap: 4px; }
  .${P}-ui-bar input[type="number"] {
    box-sizing: border-box; width: 110px; min-height: 26px; padding: 2px 6px;
    border: 1px solid var(--input); border-radius: var(--radius); background: var(--background); color: var(--foreground);
    font: 12px var(--tt-font-sans);
  }
  .${P}-ui-bar input.${P}-bounty-short { width: 58px; }
  /* The wallet reminder (TRU-025): its button keeps to one line. */
  .${P}-wallet-dismiss { white-space: nowrap; }
  @media (pointer: coarse) { .${P}-ui-bar input[type="number"] { min-height: 44px; } }
  [data-${P}-shop-dot]::before {
    content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    margin: 0 4px 0 6px; vertical-align: middle; background: var(--${P}-shop-ink);
  }
  [data-${P}-shop-label]::after {
    content: attr(data-${P}-shop-label) attr(data-${P}-shop-total); margin-left: 4px; font-weight: 700; font-size: max(12px, .9em);
    white-space: nowrap; color: var(--${P}-shop-ink);
  }
  /* Narrow listings: the profit each only; the total stays in the title (hq issue 557, B15). */
  @media (max-width: 400px) {
    [data-${P}-shop-label]::after { content: attr(data-${P}-shop-label); }
  }
  /* Text the player is about to send, shown as it will read; a part it lacks is flagged. */
  .${P}-ui-preview {
    margin: 6px 0; padding: 6px 8px; border-radius: var(--radius); background: var(--muted); color: var(--foreground);
    font: 12px/1.5 var(--tt-font-sans); white-space: pre-wrap; overflow-wrap: anywhere;
  }
  .${P}-ui-flag { padding: 0 2px; border-radius: 3px; background: ${tint(INK.warn, 30)}; color: inherit; font-weight: 700; }
  .${P}-ui-preview > strong:first-child { display: block; margin-bottom: 8px; }
  .${P}-ui-strip :is(input[type="text"], textarea, select) {
    box-sizing: border-box; max-width: 100%; padding: 3px 8px;
    border: 1px solid var(--input); border-radius: var(--radius); background: var(--background); color: var(--foreground);
    font: 12px/1.45 var(--tt-font-sans);
  }
  .${P}-ui-strip :is(textarea, input[type="text"]) { display: block; width: 100%; margin: 6px 0; }
  .${P}-ui-strip :is(input[type="text"], select) { min-height: 28px; }
  @media (pointer: coarse) {
    .${P}-ui-button { min-height: 44px; min-width: 44px; padding: 6px 14px; }
    ${INLINE} { min-height: 0; height: 32px; min-width: 44px; padding: 0 10px; }
    /* Small keeps its one line but gets a finger's room (hq issue 557). */
    ${SMALL} { min-height: 0; height: 32px; min-width: 44px; padding: 0 10px; line-height: 30px; }
  }
  /* The profile's row of our buttons (hq issue 467): one block below Torn's title row, drawn
     like Torn's own buttons (its size, radius, font and theme colours); our green only as
     the accent on the left edge and the focus ring. Torn styles every button in its title
     box (no border, no background, a divider before it), so these rules carry the row's
     class twice to win over that. */
  .${P}-profile-actions {
    clear: both; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 6px 0 8px;
  }
  .${P}-profile-actions:empty { display: none; }
  .${P}-profile-actions > span { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0; }
  ${ROW} .${P}-ui-button {
    position: relative; box-sizing: border-box; height: auto; min-height: 34px; min-width: 34px; margin: 0; padding: 0 12px;
    border-radius: 5px; border: var(--btn-border, 1px solid var(--input)); border-left: 3px solid var(--primary);
    background: var(--btn-background, var(--card)); color: var(--btn-color, var(--foreground));
    text-shadow: var(--btn-text-shadow, none); box-shadow: none;
    font: normal 14px/32px "Fjalla One", Arial, sans-serif; text-transform: uppercase; text-decoration: none;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; white-space: nowrap;
  }
  ${ROW} .${P}-ui-button::before, ${ROW} .${P}-ui-button::after { content: none; display: none; }
  ${ROW} .${P}-ui-button:hover:not(:disabled) {
    background: var(--btn-hover-background, var(--muted)); color: var(--btn-hover-color, var(--foreground));
    border: var(--btn-hover-border, 1px solid var(--input)); border-left: 3px solid var(--primary);
    text-shadow: var(--btn-hover-text-shadow, none);
  }
  ${ROW} .${P}-ui-button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  ${ROW} .${P}-ui-button:disabled { cursor: default; opacity: .6; }
  ${ROW} .${P}-ui-button[aria-expanded="true"] { box-shadow: inset 0 -2px 0 var(--primary); }
  /* The split button: its two halves join. */
  ${ROW} .${P}-lists-main { border-top-right-radius: 0; border-bottom-right-radius: 0; }
  ${ROW} .${P}-lists-arrow, ${ROW} .${P}-lists-arrow:hover:not(:disabled) {
    border-top-left-radius: 0; border-bottom-left-radius: 0; border-left-width: 0; padding: 0 10px;
  }
  ${ROW} .${P}-lists-note:not(:empty) { margin-left: 8px; }
  /* The lists menu under the profile's buttons (hq issue 487): a card in the settings panel's
     look, one 44 px row per list with a tick box, and Manage lists as the primary button. */
  ${MENU} {
    box-sizing: border-box; width: 100%; max-width: 380px; margin: 0 0 10px; padding: 6px;
    border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--tt-shadow-sm);
    background: var(--card); color: var(--card-foreground); font: 14px/1.4 var(--tt-font-sans); text-align: left;
  }
  ${MENU} .${P}-lists-head {
    padding: 6px 10px 4px; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: var(--muted-foreground);
  }
  ${MENU} .${P}-lists-item {
    display: flex; align-items: center; gap: 12px; box-sizing: border-box; width: 100%; min-height: 44px; margin: 0; padding: 6px 10px;
    border: 0; border-radius: 8px; background: transparent; color: inherit; box-shadow: none; text-shadow: none;
    font: 600 14px/1.4 var(--tt-font-sans); text-align: left; text-transform: none; cursor: pointer;
    transition: background-color var(--tt-duration-fast) var(--tt-ease);
  }
  ${MENU} .${P}-lists-item:hover:not(:disabled) { background: var(--muted); }
  ${MENU} .${P}-lists-item:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
  ${MENU} .${P}-lists-item:disabled { cursor: default; opacity: .6; }
  ${MENU} .${P}-lists-box {
    flex: none; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;
    width: 20px; height: 20px; border: 2px solid var(--input); border-radius: 5px; background: var(--background);
  }
  ${MENU} .${P}-lists-item[aria-pressed="true"] .${P}-lists-box { background: var(--primary); border-color: var(--primary); }
  ${MENU} .${P}-lists-item[aria-pressed="true"] .${P}-lists-box::after {
    content: '\\2713'; color: var(--primary-foreground); font: 700 13px/1 var(--tt-font-sans);
  }
  ${MENU} .${P}-lists-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  ${MENU} .${P}-lists-tag {
    flex: none; padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 18px;
    background: ${tint('var(--primary)')}; color: var(--muted-foreground);
  }
  /* Each list's row: the tick button, then Open to that list's page on the site (hq issue 486). */
  ${MENU} .${P}-lists-row { display: flex; align-items: center; gap: 4px; }
  ${MENU} .${P}-lists-row .${P}-lists-item { flex: 1; min-width: 0; }
  ${MENU} a.${P}-lists-open {
    flex: none; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;
    min-width: 44px; min-height: 44px; padding: 0 10px; border-radius: 8px;
    color: var(--primary); font: 600 13px/1.4 var(--tt-font-sans); text-decoration: none;
    transition: background-color var(--tt-duration-fast) var(--tt-ease);
  }
  ${MENU} a.${P}-lists-open:hover { background: var(--muted); color: var(--primary); text-decoration: underline; }
  ${MENU} a.${P}-lists-open:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
  ${MENU} .${P}-lists-empty { margin: 0; padding: 8px 10px; color: var(--muted-foreground); }
  ${MENU} .${P}-lists-foot { display: flex; margin-top: 4px; padding: 8px 4px 2px; border-top: 1px solid var(--border); }
  ${MENU} a.${P}-lists-manage {
    display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; min-height: 44px; padding: 8px 16px;
    border: 1px solid var(--primary); border-radius: var(--radius); background: var(--primary); color: var(--primary-foreground);
    font: 600 14px/1.4 var(--tt-font-sans); text-decoration: none;
  }
  ${MENU} a.${P}-lists-manage:hover { filter: brightness(1.05); color: var(--primary-foreground); text-decoration: none; }
  ${MENU} a.${P}-lists-manage:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  @media (pointer: coarse), (max-width: 600px) {
    ${ROW} .${P}-ui-button { min-height: 44px; min-width: 44px; padding: 0 14px; }
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
 * @param {boolean} [opts.compact] one short line inside a row of fixed height (hq #522)
 * @param {'under'} [opts.pin]   pinned over the bottom edge of its (positioned) parent
 * @param {string} [opts.tag]    span by default; 'a' for a link
 * @param {object} [opts.attrs]  any other attributes
 */
export function badge(doc, { cls, tone = 'neutral', block = false, compact = false, pin = null, tag = 'span', attrs = {} } = {}, ...children) {
  ensureStyle(doc);
  const extra = `${block ? ` ${P}-ui-block` : ''}${compact ? ` ${P}-ui-compact` : ''}`;
  const node = el(tag, {
    class: classes(`${P}-ui-badge${extra}`, cls), 'data-tone': tone, ownerDocument: doc,
    ...(pin === 'under' ? { 'data-pin': 'under' } : {}), ...attrs,
  }, ...children);
  return node;
}

/**
 * The detail of a compact badge (hq #522, #557): in its title for a hover, and under it on a
 * tap. The tap goes no further, so it never reaches Torn's own handlers in the row.
 * From the keyboard (hq #557 F39) it is a button: Tab reaches it, Enter or Space opens and
 * closes it, and `aria-expanded` says which. A badge that already has a role (a status line)
 * keeps it and opens by tap only.
 * @param {Element} node a badge made with `compact: true`
 * @param {string} detail
 */
export function tapDetail(node, detail) {
  if (node.title !== detail) node.title = detail;
  if (node.dataset.detail !== detail) node.dataset.detail = detail;
  if (node.dataset.open) return node;
  node.dataset.open = 'false';
  const keyboard = !node.hasAttribute('role');
  if (keyboard) {
    node.setAttribute('role', 'button');
    node.tabIndex = 0;
    node.setAttribute('aria-expanded', 'false');
  }
  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = node.dataset.open !== 'true';
    if (open) flipNearEdge(node);
    node.dataset.open = String(open);
    if (keyboard) node.setAttribute('aria-expanded', String(open));
  };
  node.addEventListener('click', toggle);
  if (keyboard) {
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') toggle(e);
      else if (e.key === 'Escape' && node.dataset.open === 'true') toggle(e);
    });
  }
  return node;
}

/** The widest a detail opens, as in the CSS above. */
const DETAIL_WIDTH = 220;

/**
 * Opens a badge's detail leftwards when it would run past the right edge of the window
 * (hq #557 A9). Read once, on the tap.
 * @param {Element} node
 */
export function flipNearEdge(node) {
  const view = node.ownerDocument?.defaultView;
  const width = view?.innerWidth || node.ownerDocument?.documentElement?.clientWidth || 0;
  const { left } = node.getBoundingClientRect();
  const room = width - left;
  if (width > 0 && room < Math.min(DETAIL_WIDTH, width * 0.9)) node.dataset.flip = 'end';
  else delete node.dataset.flip;
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

/** Text shown as it will be sent, line breaks kept. */
export function preview(doc, { cls, attrs = {} } = {}, ...children) {
  ensureStyle(doc);
  return el('div', { class: classes(`${P}-ui-preview`, cls), ownerDocument: doc, ...attrs }, ...children);
}

/** A part of a preview that needs the player's eye. */
export function flag(doc, { cls, attrs = {} } = {}, ...children) {
  ensureStyle(doc);
  return el('mark', { class: classes(`${P}-ui-flag`, cls), ownerDocument: doc, ...attrs }, ...children);
}

/**
 * Puts one of our profile controls into the profile's row of our buttons (hq #467): one
 * block inside Torn's title box, below its title row and before its rule, so nothing of
 * Torn's moves sideways and none of its nodes is touched. The row is made once; its parts
 * keep one order (lists, messages, notes) whichever feature comes first.
 * @param {Document} doc
 * @param {Element} heading   the profile's name heading
 * @param {'lists'|'messages'|'notes'} slot
 * @param {Element} node
 */
export function profileAction(doc, heading, slot, node) {
  ensureStyle(doc);
  let row = doc.querySelector(`.${PROFILE_ACTIONS}`);
  if (!row) {
    row = el('div', {
      class: PROFILE_ACTIONS, role: 'group', 'aria-label': 'Torn Tracker', 'data-ttc-own': '', ownerDocument: doc,
    });
    const title = heading.closest('.content-title');
    const rule = title && [...title.children].find((n) => n.matches('hr'));
    if (rule) rule.before(row);
    else if (title) title.append(row);
    else heading.after(row);
  }
  node.dataset.ttcSlot = slot;
  const rank = (n) => ACTION_ORDER.indexOf(n.dataset?.ttcSlot);
  const next = [...row.children].find((n) => rank(n) > rank(node));
  row.insertBefore(node, next || null);
  return node;
}

/**
 * One of our own small buttons; 44 px on touch screens. `inline` sizes it to sit beside
 * one of Torn's form fields, on the same line (hq #521).
 */
export function button(doc, { cls, tone, primary = false, inline = false, small = false, attrs = {} } = {}, ...children) {
  ensureStyle(doc);
  const base = `${P}-ui-button${inline ? ` ${P}-ui-inline` : ''}${small ? ` ${P}-ui-small` : ''}`;
  return el('button', {
    type: 'button', class: classes(base, cls), 'data-tone': tone, 'data-variant': primary ? 'primary' : undefined, ownerDocument: doc, ...attrs,
  }, ...children);
}
