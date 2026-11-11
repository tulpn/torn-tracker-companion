// Property tests for the feature extractors and the read gate's stored record (hq #733,
// from #471, D-167): whatever text or attributes Torn's page holds, and whatever sits in
// storage, they never throw, never return an id or count that isn't one, and never guess.
// The shop highlighter's price reader and its numbers joined them in hq #845.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { JSDOM } from 'jsdom';

import { itemIdOf, ownedOf } from '../../src/features/price-filler/fill.js';
import { itemOf, listingsOf, MAX_LISTINGS } from '../../src/features/market-snapshot/index.js';
import { findPrice, judge, parsePrice, short } from '../../src/features/shop-highlighter/scan.js';
import { short as auctionShort } from '../../src/features/auction-values/index.js';
import { readMoney, shortMoney } from '../../src/core/dom.js';
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

describe('hq #845 the shop highlighter reads a price however Torn splits it', () => {
  const holderOf = (layout, dollar, digits) => {
    const s = el('span');
    switch (layout) {
      case 'one text': s.textContent = `${dollar}${digits}`; break;
      // The live shape (hq #826): "$" and the number as two text nodes of one element.
      case 'two texts': s.append(document.createTextNode(dollar), document.createTextNode(digits)); break;
      case 'two spans': s.append(el('span', {}, dollar), el('span', {}, digits)); break;
      case 'text then span': s.append(document.createTextNode(dollar), el('b', {}, digits)); break;
      default: s.append(el('i', {}, dollar), document.createTextNode(digits));
    }
    return s;
  };
  const layouts = fc.constantFrom('one text', 'two texts', 'two spans', 'text then span', 'span then text');

  test("findPrice reads the listing's price, whatever the layout and the text around it", () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 1e12 }), layouts, fc.constantFrom('$', '$ '), fc.integer({ min: 0, max: 2 }),
      fc.stringMatching(/^[A-Za-z0-9_-]{1,16}$/), fc.constantFrom('x3', '3 available', 'qty: 12', '1,000x', ''),
      (n, layout, dollar, wraps, seller, qty) => {
        let holder = holderOf(layout, dollar, n.toLocaleString('en-US'));
        for (let i = 0; i < wraps; i++) {
          const w = el('div');
          w.append(holder);
          holder = w;
        }
        const row = el('li');
        row.append(el('span', {}, seller), holder, el('span', {}, qty));
        const found = findPrice(row);
        assert.equal(found?.price, n);
        assert.ok(holder.contains(found.el), 'the mark goes on the price, not the row');
      },
    ), RUNS);
  });

  test('parsePrice: null, or a number written in digits after the "$"', () => {
    fc.assert(fc.property(fc.oneof(pageText, fc.stringMatching(/^[$\s\d,]{0,12}$/)), (t) => {
      const price = parsePrice(t);
      if (price === null) return;
      assert.ok(Number.isFinite(price) && price >= 0);
      assert.match(t, /\$\s?\d/, 'a price is read only from digits');
    }), RUNS);
    fc.assert(fc.property(fc.integer({ min: 0, max: 1e12 }), (n) => {
      assert.equal(parsePrice(`$${n.toLocaleString('en-US')}`), n);
    }), RUNS);
    assert.equal(parsePrice('$,'), null);
    assert.equal(parsePrice('$ ,,,'), null);
  });

  test('judge: a tier only for a listing below a shop price that pays', () => {
    const at = (max) => fc.integer({ min: 0, max });
    const tiers = fc.record({
      mode: fc.constantFrom('abs', 'pct', 'other'),
      absGreen: at(1e6), absYellow: at(1e6), absRed: at(1e6), absBlue: at(1e6),
      pctGreen: at(100), pctYellow: at(100), pctRed: at(100), pctBlue: at(100),
    });
    fc.assert(fc.property(fc.integer({ min: 1, max: 1e9 }), fc.integer({ min: 0, max: 1e9 }), tiers, (price, shop, settings) => {
      const { profit, tier } = judge(price, shop, settings);
      assert.equal(profit, shop - price);
      if (tier !== null) assert.ok(shop > 0 && price < shop, `${price} vs ${shop}: ${tier}`);
    }), RUNS);
  });

  test('short: never "1000k" or "1000m"; reads back within its rounding', () => {
    fc.assert(fc.property(fc.oneof(
      fc.integer({ min: -1e12, max: 1e12 }),
      fc.constantFrom(999.5, 999_949, 999_950, 999_999, 999_994_999, 999_995_000, -999_999),
    ), (n) => {
      const s = short(n);
      const m = /^(-?\d+(?:\.\d+)?)([kmb]?)$/.exec(s);
      assert.ok(m, s);
      const unit = { '': 1, k: 1e3, m: 1e6, b: 1e9 }[m[2]];
      if (m[2] !== 'b') assert.ok(Math.abs(Number(m[1])) < 1000, `${n} -> ${s}`);
      assert.ok(Math.abs(Number(m[1]) * unit - n) <= Math.max(0.5, Math.abs(n) * 0.05), `${n} -> ${s}`);
    }), RUNS);
    assert.equal(short(999_999), '1m');
    assert.equal(short(999_995_000), '1b');
  });

  test('the money lines (sidebar, travel panel, auction badges) never say "$1000k" either', () => {
    const near = fc.oneof(
      fc.integer({ min: 0, max: 1e12 }),
      fc.constantFrom(999, 999_949, 999_950, 999_999, 99_999_999, 999_949_999, 999_999_999),
    );
    for (const [name, fmt] of [['shortMoney', shortMoney], ['auction short', auctionShort]]) {
      fc.assert(fc.property(near, (n) => {
        const s = fmt(n);
        const m = /^\$(\d+(?:\.\d+)?)([kmb]?)$/.exec(s);
        assert.ok(m, `${name}: ${n} -> ${s}`);
        if (m[2] !== 'b') assert.ok(Number(m[1]) < 1000, `${name}: ${n} -> ${s}`);
        assert.ok(Math.abs(readMoney(s) - n) <= Math.max(0, n * 0.05), `${name}: ${n} -> ${s}`);
      }), RUNS);
    }
    assert.equal(shortMoney(999_999), '$1m');
    assert.equal(auctionShort(999_999), '$1m');
    assert.equal(auctionShort(999_999_999), '$1b');
  });
});
