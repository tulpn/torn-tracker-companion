// How old a block's data is (hq #687, WP-BL-28): one helper, one wording, every block.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { ageNode, ago, freshness, repaintAges, since, tickAges } from '../../src/core/age.js';
import { ago as panelAgo } from '../../src/core/panel.js';
import { ROOT } from '../helpers.js';

const T0 = Date.UTC(2026, 10, 8, 12);
const doc = () => new JSDOM('<!doctype html><body></body>').window.document;

describe('the words', () => {
  test('one short form for how long', () => {
    assert.equal(since(0), 'just now');
    assert.equal(since(4_000), 'just now');
    assert.equal(since(40_000), '40s');
    assert.equal(since(3 * 60_000 + 59_000), '3m');
    assert.equal(since(2 * 3_600_000), '2h');
    assert.equal(since(3 * 86_400_000), '3d');
    assert.equal(since(-60_000), 'just now', 'a time a little ahead is not negative');
    assert.equal(ago(40_000), '40s ago');
    assert.equal(ago(1_000), 'just now');
    assert.equal(panelAgo, ago, 'the settings page words it the same way');
  });

  test('fresh says when; stale says it may be out of date', () => {
    assert.deepEqual(freshness(T0 - 60_000, T0, 120_000), { stale: false, text: 'Updated 1m ago' });
    assert.deepEqual(freshness(T0 - 120_000, T0, 120_000), { stale: true, text: 'Updated 2m ago · may be out of date' });
    assert.deepEqual(freshness(T0, T0, 120_000), { stale: false, text: 'Updated just now' });
  });

  test('an unknown time gives no line rather than a wrong one', () => {
    for (const at of [undefined, null, NaN, Infinity, '12', {}]) assert.equal(freshness(at, T0, 60_000), null, String(at));
    assert.equal(ageNode(doc(), { at: null, now: T0, staleAfterMs: 60_000 }), null);
  });
});

describe('the line', () => {
  test('carries its time, so a repaint moves it on and marks it stale', () => {
    const d = doc();
    const node = ageNode(d, { at: T0, now: T0 + 30_000, staleAfterMs: 120_000, cls: 'x-age', tag: 'div' });
    d.body.append(node);
    assert.equal(node.tagName, 'DIV');
    assert.equal(node.className, 'x-age');
    assert.equal(node.textContent, 'Updated 30s ago');
    assert.equal(node.dataset.stale, undefined);
    repaintAges(d.body, T0 + 5 * 60_000);
    assert.equal(node.textContent, 'Updated 5m ago · may be out of date');
    assert.equal(node.dataset.stale, 'true');
    repaintAges(null, T0);
  });

  test('a ticker repaints on its timer, asks nothing, and stops', () => {
    const d = doc();
    d.body.append(ageNode(d, { at: T0, now: T0, staleAfterMs: 120_000 }));
    let clock = T0;
    const timers = {
      fn: null,
      setInterval(fn, ms) { assert.equal(ms, 30_000); this.fn = fn; return 7; },
      clearInterval(id) { assert.equal(id, 7); this.fn = null; },
    };
    const stop = tickAges(timers, d.body, () => clock);
    clock += 3 * 60_000;
    timers.fn();
    assert.equal(d.body.textContent, 'Updated 3m ago · may be out of date');
    stop();
    assert.equal(timers.fn, null);
  });

  test('every block that shows data from the site uses it', () => {
    for (const file of ['sidebar.js', 'dashboard.js']) {
      const source = fs.readFileSync(path.join(ROOT, 'src', 'core', file), 'utf8');
      assert.match(source, /from '\.\/age\.js'/, file);
      assert.match(source, /ageNode\(doc,/, file);
    }
  });
});
