// Property tests for the feature extractors and the read gate's stored record (hq #733,
// from #471, D-167): whatever text or attributes Torn's page holds, and whatever sits in
// storage, they never throw, never return an id or count that isn't one, and never guess.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { JSDOM } from 'jsdom';

import { itemIdOf, ownedOf } from '../../src/features/price-filler/fill.js';
import { itemOf, listingsOf, MAX_LISTINGS } from '../../src/features/market-snapshot/index.js';
import { PAUSE_MAX_MS, READS_MAX, REFUSED_MS, WINDOW_MS, readState } from '../../src/core/read-gate.js';

const RUNS = { numRuns: 300 };
const id = (v) => v === null || (Number.isSafeInteger(v) && v > 0);
const count = (v) => v === null || (Number.isSafeInteger(v) && v >= 0);

/** Text as a page may hold it: any string, often digits, dashes and slashes. */
const pageText = fc.oneof(
  fc.string(),
  fc.stringMatching(/^[-/\dx ,a-z]{0,40}$/),
  fc.constantFrom('', '-0-', '/0/', '-99999999999999999999-', '/items/0/', '/items/99999999999999999999/', 'x0', 'x 1,2,3'),
);

const { document } = new JSDOM('<!doctype html><body></body>').window;
const el = (tag, attrs = {}, text = '') => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.textContent = text;
  return n;
};

describe('hq #733 the sell form extractors', () => {
  test('itemIdOf: null or a positive id, from the info button or the image', () => {
    fc.assert(fc.property(pageText, pageText, fc.constantFrom('marketAdd', 'bazaarAdd', 'bazaarManage'), (controls, src, form) => {
      const row = el('div', { class: 'itemRow___x' });
      row.append(el('button', { class: 'viewInfoButton___y', 'aria-controls': controls }));
      const wrap = el('div', { class: 'image-wrap imgContainer___z' });
      wrap.append(el('img', { src }));
      row.append(wrap);
      return id(itemIdOf(row, form));
    }), RUNS);
  });

  test('itemIdOf: no digits, no id', () => {
    fc.assert(fc.property(fc.stringMatching(/^[^\d]*$/), (t) => {
      const row = el('div');
      row.append(el('button', { class: 'viewInfoButton___y', 'aria-controls': t }), el('img', { src: `/items/${t}/` }));
      return itemIdOf(row, 'marketAdd') === null;
    }), RUNS);
  });

  test('ownedOf: null or a count; "xN" round-trips', () => {
    fc.assert(fc.property(pageText, (t) => count(ownedOf(el('div', {}, t), 'marketAdd'))), RUNS);
    fc.assert(fc.property(fc.integer({ min: 1, max: 1e9 }), (n) => {
      assert.equal(ownedOf(el('div', {}, `Xanax x${n.toLocaleString('en-US')} `), 'marketAdd'), n);
    }), RUNS);
  });
});

describe('hq #733 the item market extractors', () => {
  test('itemOf: null or a positive id, whatever the hash and the image say', () => {
    fc.assert(fc.property(pageText, pageText, (hash, src) => {
      const doc = new JSDOM(`<div class="sellerListWrapper___a"></div>`).window.document;
      doc.querySelector('div').append(Object.assign(doc.createElement('img'), { className: 'torn-item' }));
      doc.querySelector('img').setAttribute('src', src);
      return id(itemOf(doc, `#/market/view=search&itemID=${hash}`)) && id(itemOf(doc, hash));
    }), RUNS);
  });

  test('listingsOf: at most 50 rows, each a price at or above 0 and a positive quantity', () => {
    fc.assert(fc.property(fc.array(fc.tuple(pageText, pageText), { maxLength: 60 }), (rows) => {
      const list = el('ul', { class: 'sellerList___a' });
      for (const [price, available] of rows) {
        const row = el('li', { class: 'rowWrapper___b' });
        row.append(el('div', { class: 'price___c' }, price), el('div', { class: 'available___d' }, available));
        list.append(row);
      }
      const root = el('div');
      root.append(list);
      const out = listingsOf(root);
      return out.length <= MAX_LISTINGS && out.every((l) => Number.isSafeInteger(l.price) && l.price >= 0
        && Number.isSafeInteger(l.quantity) && l.quantity > 0);
    }), { numRuns: 100 });
  });
});

describe('hq #733 the read gate\'s stored record', () => {
  const now = 1_800_000_000_000;
  const time = fc.oneof(fc.integer({ min: now - 2 * REFUSED_MS, max: now + 2 * REFUSED_MS }), fc.double(), fc.string());
  const stored = fc.oneof(
    fc.anything(),
    fc.record({
      pausedUntil: time,
      refused: fc.dictionary(fc.oneof(fc.string(), fc.string().map((s) => `/api/feeds/${s}`)),
        fc.oneof(fc.anything(), fc.record({ until: time, error: fc.oneof(fc.string(), fc.anything()) }))),
      reads: fc.oneof(fc.anything(), fc.array(time, { maxLength: 80 })),
      sidebar: fc.oneof(fc.anything(), fc.record({ items: fc.string(), tab: fc.string(), at: time })),
    }, { requiredKeys: [] }),
  );

  test('never throws; what comes out passes its own checks', () => {
    fc.assert(fc.property(stored, (raw) => {
      const s = readState(raw, now);
      assert.deepEqual(Object.keys(s), ['pausedUntil', 'refused', 'reads', 'sidebar']);
      assert.ok(s.pausedUntil === 0 || (s.pausedUntil > now && s.pausedUntil <= now + PAUSE_MAX_MS));
      for (const [path, entry] of Object.entries(s.refused)) {
        assert.ok(path.startsWith('/api/feeds/'));
        assert.ok(entry.until > now && entry.until <= now + REFUSED_MS);
        assert.ok(entry.error === null || /^[a-z_]{1,40}$/.test(entry.error));
      }
      assert.ok(s.reads.length <= READS_MAX);
      assert.ok(s.reads.every((t) => Number.isFinite(t) && now - t < WINDOW_MS));
      assert.ok(s.sidebar === null || (typeof s.sidebar.items === 'string' && Number.isFinite(s.sidebar.at)));
      assert.deepEqual(readState(JSON.parse(JSON.stringify(s)), now), s, 'reading its own output changes nothing');
    }), RUNS);
  });
});
