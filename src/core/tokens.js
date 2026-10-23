// The suite's design tokens as CSS (hq WP-UI-8, UI-001).
//
// The names are the website's own (shadcn's `--primary`, `--card`, … and torn-tracker's
// `--tt-…`), so one change to the site's tokens reaches the companion with no other edit.
// They are only ever declared on the companion's own elements (its Shadow DOM page, its
// badges, its sidebar block), never on Torn's `:root`: Torn's page keeps its own values.
//
// Two ways to pick a theme:
//   - what the companion adds inline on Torn's page follows Torn's theme, because it sits
//     on Torn's background (`body.dark-mode`);
//   - the settings page is a surface of its own: its "Look" setting picks dark (the
//     suite's default), light, or Torn's.

import { TOKENS } from '../data/tokens.js';

export const LOOKS = Object.freeze(['dark', 'light', 'torn']);
export const DEFAULT_LOOK = 'dark';

/**
 * A static value in pixels where the site writes rem: rem is the root's font size, which
 * is Torn's on Torn's page, not the site's 16 px.
 */
export function px(value) {
  return value.replace(/(\d*\.?\d+)rem\b/g, (_, n) => `${Math.round(Number(n) * 16 * 100) / 100}px`);
}

/** `--name: value;` for every colour of a theme, plus the static values. */
export function declarations(theme) {
  const colours = TOKENS[theme === 'light' ? 'light' : 'dark'];
  return [...Object.entries(colours), ...Object.entries(TOKENS.static).map(([name, value]) => [name, px(value)])]
    .map(([name, value]) => `--${name}: ${value};`).join(' ');
}

/**
 * The tokens for elements inline on Torn's page: light unless Torn's body says dark.
 * @param {string} selector  the companion's own elements, e.g. `.ttc-ui-badge, #ttc-x`
 */
export function followTorn(selector) {
  const dark = selector.split(',').map((s) => s.trim())
    .flatMap((s) => [`body.dark-mode ${s}`, `body.dark ${s}`]).join(', ');
  return `${selector} { ${declarations('light')} }\n  ${dark} { ${declarations('dark')} }`;
}

/** Torn marks its dark theme on the body; without it, the page is light. */
export function tornTheme(doc) {
  const body = doc.body;
  return body?.classList.contains('dark-mode') || body?.classList.contains('dark') ? 'dark' : 'light';
}

/** The settings page's theme for a "Look" setting. */
export function lookTheme(look, doc) {
  if (look === 'torn') return tornTheme(doc);
  return look === 'light' ? 'light' : 'dark';
}
