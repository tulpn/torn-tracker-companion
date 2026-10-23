// The suite's design tokens in the companion (hq WP-UI-8, UI-001).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { TOKENS } from '../../src/data/tokens.js';
import { declarations, followTorn, lookTheme, px, tornTheme } from '../../src/core/tokens.js';
import { ensureStyle } from '../../src/core/ui.js';
import { moduleFrom, tokensFrom } from '../../tools/build-tokens.mjs';
import { ROOT } from '../helpers.js';

const page = (bodyClass = '') => new JSDOM(`<!doctype html><html><head></head><body class="${bodyClass}"></body></html>`).window.document;

const json = () => ({
  format: 1,
  source: 'design/tokens.css',
  dark: { background: '#1b1b1b', primary: '#1971c2' },
  light: { background: '#ffffff', primary: '#1971c2' },
  static: { radius: '0.625rem', 'tt-font-sans': '"Inter Variable", system-ui, sans-serif' },
});

describe('tools/build-tokens.mjs checks the site\'s tokens before the script carries them', () => {
  test('a good tokens.json round-trips into src/data/tokens.js', async () => {
    const out = tokensFrom(json());
    assert.deepEqual(out.dark, { background: '#1b1b1b', primary: '#1971c2' });
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-tokens-')), 'tokens.mjs');
    fs.writeFileSync(file, moduleFrom(out, '2026-10-23'));
    try {
      const { TOKENS: back } = await import(`file://${file.replace(/\\/g, '/')}`);
      assert.deepEqual(JSON.parse(JSON.stringify(back)), out);
      assert.ok(Object.isFrozen(back.dark));
    } finally {
      fs.rmSync(path.dirname(file), { recursive: true });
    }
  });

  test('anything that could break out of a declaration is refused', () => {
    const cases = [
      (j) => { j.dark.primary = 'red; } body { display: none'; },
      (j) => { j.dark.primary = '#12345'; },
      (j) => { j.static.radius = '1px; }</style>'; },
      (j) => { j.static.radius = 'url(https://example.com/x)'; },
      (j) => { j.dark['Bad Name'] = '#000000'; j.light['Bad Name'] = '#000000'; },
      (j) => { delete j.light.primary; },
      (j) => { j.format = 2; },
      (j) => { delete j.static; },
    ];
    for (const spoil of cases) {
      const j = json();
      spoil(j);
      assert.throws(() => tokensFrom(j), undefined, JSON.stringify(j));
    }
  });

  test('the tokens the script carries pass the same checks, and name the site\'s colours', () => {
    const again = tokensFrom({ format: 1, ...JSON.parse(JSON.stringify(TOKENS)) });
    assert.deepEqual(again, JSON.parse(JSON.stringify(TOKENS)));
    for (const name of ['background', 'foreground', 'card', 'primary', 'muted-foreground', 'border', 'ring', 'input',
      'destructive', 'tt-success', 'tt-warning']) {
      assert.match(TOKENS.dark[name], /^#[0-9a-f]{6}$/, name);
      assert.match(TOKENS.light[name], /^#[0-9a-f]{6}$/, name);
    }
  });
});

describe('the tokens as CSS', () => {
  test('rem becomes px on the site\'s 16 px base, because Torn\'s root font size is not the site\'s', () => {
    assert.equal(px('0.625rem'), '10px');
    assert.equal(px('2.75rem'), '44px');
    assert.equal(px('0 1px 2px 0 rgb(0 0 0 / 0.3)'), '0 1px 2px 0 rgb(0 0 0 / 0.3)');
    assert.doesNotMatch(declarations('dark'), /\drem\b/);
  });

  test('a theme declares every colour under the site\'s own names', () => {
    assert.match(declarations('dark'), new RegExp(`--primary: ${TOKENS.dark.primary};`));
    assert.match(declarations('light'), new RegExp(`--background: ${TOKENS.light.background};`));
    assert.match(declarations('anything else'), new RegExp(`--background: ${TOKENS.dark.background};`), 'dark is the default');
  });

  test('inline on Torn\'s page, the tokens go on our elements only, never on Torn\'s root or body', () => {
    const css = followTorn('.ttc-a, #ttc-b');
    assert.match(css, /^\.ttc-a, #ttc-b \{/);
    assert.match(css, /body\.dark-mode \.ttc-a, body\.dark \.ttc-a, body\.dark-mode #ttc-b, body\.dark #ttc-b \{/);
    const doc = page();
    ensureStyle(doc);
    const sheet = doc.getElementById('ttc-ui-style').textContent;
    assert.doesNotMatch(sheet, /(^|[\s,}])(:root|html|body)\s*\{/, 'no rule on the page itself');
  });

  test('a change to a token reaches the built script with no other edit', () => {
    const built = fs.readFileSync(path.join(ROOT, 'dist', 'torn-tracker-companion.user.js'), 'utf8');
    assert.ok(built.includes(TOKENS.dark.primary));
    assert.ok(built.includes(TOKENS.light['tt-success']));
  });

  test('no stylesheet of the companion picks a colour of its own', () => {
    // The scale badge's ink sits on a data colour; the sidebar entry copies Torn's own.
    const allowed = /color: #(fff|111);|var\(--default-[a-z-]+, #[0-9a-f]{3,6}\)/g;
    for (const file of ['ui.js', 'panel.js', 'sidebar.js']) {
      const source = fs.readFileSync(path.join(ROOT, 'src', 'core', file), 'utf8').replace(allowed, '');
      const style = source.slice(source.indexOf('const STYLE = `'), source.indexOf('`;', source.indexOf('const STYLE = `')));
      assert.doesNotMatch(style, /#[0-9a-f]{3,6}\b|rgba?\(/i, file);
    }
  });
});

describe('which theme', () => {
  test('Torn\'s theme is read off its body', () => {
    assert.equal(tornTheme(page()), 'light');
    assert.equal(tornTheme(page('dark-mode')), 'dark');
  });

  test('the settings page\'s look: dark by default, light, or Torn\'s', () => {
    assert.equal(lookTheme('dark', page()), 'dark');
    assert.equal(lookTheme('light', page('dark-mode')), 'light');
    assert.equal(lookTheme('torn', page()), 'light');
    assert.equal(lookTheme('torn', page('dark-mode')), 'dark');
    assert.equal(lookTheme(undefined, page()), 'dark');
  });
});
