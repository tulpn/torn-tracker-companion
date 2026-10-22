// One look for everything the companion adds to Torn's pages (hq #224).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { badge, bar, button, ensureStyle, note, setTone, strip } from '../../src/core/ui.js';
import { ROOT } from '../helpers.js';

const page = () => new JSDOM('<!doctype html><html><head></head><body></body></html>').window.document;

describe('the shared look', () => {
  test('one stylesheet, put on the page once', () => {
    const doc = page();
    ensureStyle(doc);
    badge(doc, {}, 'a');
    strip(doc, {}, 'b');
    assert.equal(doc.querySelectorAll('#ttc-ui-style').length, 1);
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
