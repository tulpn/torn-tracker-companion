// One look for everything the companion adds to Torn's pages (hq #224).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { badge, bar, button, buttonCss, ensureStyle, note, setTone, strip, tapDetail } from '../../src/core/ui.js';
import { ROOT } from '../helpers.js';
import { TOKENS } from '../../src/data/tokens.js';

const page = () => new JSDOM('<!doctype html><html><head></head><body></body></html>').window.document;

describe('the shared look', () => {
  test('one stylesheet, put on the page once', () => {
    const doc = page();
    ensureStyle(doc);
    badge(doc, {}, 'a');
    strip(doc, {}, 'b');
    assert.equal(doc.querySelectorAll('#ttc-ui-style').length, 1);
  });

  test('hq #557 E35: no shop price tier is drawn red, since every tier is a profit', () => {
    const doc = page();
    ensureStyle(doc);
    const css = doc.getElementById('ttc-ui-style').textContent;
    const ink = (tier) => css.match(new RegExp(`\\[data-ttc-shop="${tier}"\\][^{]*\\{ --ttc-shop-ink: ([^;]+);`))[1];
    assert.equal(ink('red'), TOKENS.light.ring);
    assert.equal(ink('blue'), TOKENS.light['muted-foreground']);
    assert.match(css, /\.ttc-ui-badge\[data-tone="warn"\] \{ --ttc-ink: var\(--tt-nerve\); \}/, 'caution is amber in both themes');
    assert.match(css, /\.ttc-ui-strip\[data-tone="warn"\] \{ --ttc-ink: var\(--tt-nerve\); \}/, 'hq #557 E36: a warn strip');
    for (const tier of ['green', 'yellow', 'red', 'blue']) {
      assert.notEqual(ink(tier), TOKENS.light['tt-ff-hard']);
      assert.notEqual(ink(tier), TOKENS.light.destructive);
    }
  });

  test('it follows Torn’s dark theme and wraps on a phone', () => {
    const doc = page();
    ensureStyle(doc);
    const css = doc.getElementById('ttc-ui-style').textContent;
    assert.match(css, /body\.dark-mode \.ttc-ui-badge/);
    assert.match(css, /body\.dark-mode \.ttc-ui-strip/);
    assert.match(css, /overflow-wrap: anywhere/);
    assert.match(css, /@media \(pointer: coarse\)[\s\S]*min-height: 44px/, 'our buttons are thumb-sized on touch screens');
  });

  test('a badge keeps the feature’s own class and says its tone', () => {
    const doc = page();
    const node = badge(doc, { cls: 'ttc-x', tone: 'good', attrs: { title: 'Why' } }, 'Text');
    assert.equal(node.className, 'ttc-ui-badge ttc-x');
    assert.equal(node.dataset.tone, 'good');
    assert.equal(node.title, 'Why');
    setTone(node, 'bad', { dim: true });
    assert.equal(node.dataset.tone, 'bad');
    assert.equal(node.dataset.dim, 'true');
    setTone(node, 'nonsense');
    assert.equal(node.dataset.tone, 'neutral');
  });

  test('a colour that is the data itself goes in as a variable, with readable ink', () => {
    const doc = page();
    const node = badge(doc, {}, '2.50');
    setTone(node, null, { scale: '#e8a117', ink: 'dark' });
    assert.equal(node.dataset.tone, 'scale');
    assert.equal(node.style.getPropertyValue('--ttc-tone-bg'), '#e8a117');
    assert.equal(node.dataset.ink, 'dark');
  });

  test('strips, notes, bars and buttons', () => {
    const doc = page();
    assert.equal(strip(doc, { cls: 'ttc-y', tone: 'info' }).dataset.tone, 'info');
    assert.match(note(doc, {}, 'n').className, /ttc-ui-note/);
    assert.match(bar(doc, {}).className, /ttc-ui-bar/);
    const b = button(doc, { tone: 'good' }, 'Go');
    assert.equal(b.type, 'button');
    assert.equal(b.dataset.tone, 'good');
  });
});

describe('hq #557 E33 one button look', () => {
  test('a primary button is the filled one; a plain one has no variant', () => {
    const doc = page();
    assert.equal(button(doc, { primary: true }, 'Save').dataset.variant, 'primary');
    assert.equal(button(doc, {}, 'Cancel').dataset.variant, undefined);
    const css = doc.getElementById('ttc-ui-style').textContent;
    assert.ok(css.includes('.ttc-ui-button[data-variant="primary"]'));
  });

  test('every hover, focus and disabled rule covers each selector it is given', () => {
    const css = buttonCss('#a button, #a a.b', '#a .p');
    assert.ok(css.includes('#a button:hover:not(:disabled), #a a.b:hover:not(:disabled) {'));
    assert.ok(css.includes('#a button:focus-visible, #a a.b:focus-visible {'));
    assert.ok(css.includes('#a .p { background: var(--primary);'));
  });

  test('the panel, the dashboard and the page buttons all draw from it, with no colour of their own', () => {
    for (const file of ['panel.js', 'dashboard.js']) {
      const source = fs.readFileSync(path.join(ROOT, 'src', 'core', file), 'utf8');
      assert.match(source, /\$\{buttonCss\(/, file);
      assert.doesNotMatch(source, /-btn \{[^}]*(background|border-radius)/, file);
    }
  });
});

describe('no feature styles itself', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(path.join(ROOT, 'src', 'features'));

  test('no stylesheet, inline colour or size of its own (the fair-fight scale is data, not styling)', () => {
    const offenders = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      if (/el\('style'|STYLE = `|\.style\.(cssText|background|color|font|margin|padding)\b/.test(source)) offenders.push(path.relative(ROOT, file));
    }
    assert.deepEqual(offenders, []);
  });
});

describe('hq #557 A9 a tap detail stays on a 360 px screen', () => {
  const at = (left) => {
    const { window } = new JSDOM('<!doctype html><html><body></body></html>');
    Object.defineProperty(window, 'innerWidth', { value: 360 });
    const doc = window.document;
    const node = badge(doc, { compact: true }, 'x');
    doc.body.append(node);
    node.getBoundingClientRect = () => ({ left, right: left + 30, top: 0, bottom: 16, width: 30, height: 16 });
    tapDetail(node, 'The full detail');
    return { window, node };
  };
  const tap = ({ window, node }) => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

  test('near the right edge it opens leftwards; with room it opens rightwards', () => {
    const edge = at(300);
    tap(edge);
    assert.equal(edge.node.dataset.open, 'true');
    assert.equal(edge.node.dataset.flip, 'end');
    const roomy = at(20);
    tap(roomy);
    assert.equal(roomy.node.dataset.flip, undefined);
  });

  test('closing and opening again reads the place again', () => {
    const r = at(300);
    tap(r);
    tap(r);
    assert.equal(r.node.dataset.open, 'false');
    r.node.getBoundingClientRect = () => ({ left: 10, right: 40, top: 0, bottom: 16, width: 30, height: 16 });
    tap(r);
    assert.equal(r.node.dataset.flip, undefined);
  });

  test('the detail is never wider than the screen, and the flip anchors it on the right', () => {
    const doc = page();
    ensureStyle(doc);
    const css = doc.getElementById('ttc-ui-style').textContent;
    assert.match(css, /max-width: min\(220px, 90vw\)/);
    assert.match(css, /\[data-flip="end"\]::after \{ left: auto; right: 0; \}/);
  });
});
