// Stock signals on the stock market page (CMP-304).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { labelFor } from '../../src/features/stock-advisor/index.js';
import { runFeature } from '../feature-harness.js';

const STOCKS = 'https://www.torn.com/page.php?sid=stocks';

/** Synthetic: classes and ids as TornTools (GPLv3) and the two MIT stock scripts read them. */
const row = (id, name) => `<ul class="stock___CnywB" id="${id}">
  <li class="stockName___a1" aria-label="Stock: ${name}"><div class="nameContainer___b2"><img src="/images/v2/stock-market/logos/X.svg">${name}</div></li>
  <li class="stockPrice___c3" id="priceTab"><div class="price___d4">$610.20</div></li>
  <li class="stockOwned___e5"><p class="count___f6">None</p></li>
</ul>`;
const HTML = `<div id="stockmarketroot"><div class="stockMarket___g7">${row(1, 'Torn City Stock Exchange')}${row(2, 'Syscore MFG')}${row(3, 'Legal Authorities Group')}</div></div>`;

function fakeSite(signals = new Map([
  [1, { signal: 'below_avg', avg_30d: 820.5, price: 610.2 }],
  [2, { signal: 'above_avg', avg_30d: null, price: 99 }],
  [3, { signal: null, avg_30d: 10, price: 10 }],
])) {
  const calls = [];
  return {
    calls,
    async stockSignals() {
      calls.push('stockSignals');
      return signals;
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: STOCKS, html: HTML, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 700) => new Promise((resolve) => setTimeout(resolve, ms));
const label = (r, id) => r.doc.querySelector(`ul[id="${id}"] .ttc-stock`);

describe('CMP-304 the label', () => {
  test('names the rule, never buy or sell (AC3)', () => {
    const below = labelFor({ signal: 'below_avg', avg_30d: 820.5, price: 1 });
    assert.equal(below.text, 'far below its 30-day average ($820.5)');
    assert.equal(labelFor({ signal: 'above_avg', avg_30d: null, price: 1 }).text, 'far above its 30-day average');
    assert.equal(labelFor({ signal: null, avg_30d: 1, price: 1 }), null);
    assert.equal(labelFor(undefined), null);
    for (const words of [below.text, below.title]) assert.doesNotMatch(words, /\b(buy|sell)\b/i);
  });
});

describe('CMP-304 on the stock market', () => {
  test('one read per page view; a label in each stock’s name where there is a signal (AC1)', async () => {
    const site = fakeSite();
    const r = run({ site });
    await wait();
    assert.deepEqual(site.calls, ['stockSignals']);
    assert.equal(label(r, 1).textContent, 'far below its 30-day average ($820.5)');
    assert.equal(label(r, 2).textContent, 'far above its 30-day average');
    assert.equal(label(r, 3), null, 'no signal yet: nothing');
    r.doc.querySelector('ul[id="1"] .price___d4').textContent = '$611.00';
    await wait();
    assert.equal(site.calls.length, 1, 'a price tick is no reason to ask again');
    assert.deepEqual(r.violations, []);
  });

  test('a press on the label does not open Torn’s dropdown, and nothing is filled or pressed (AC2)', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    let opened = 0;
    r.doc.querySelector('ul[id="1"] li').addEventListener('click', () => { opened += 1; });
    label(r, 1).dispatchEvent(new r.window.MouseEvent('click', { bubbles: true }));
    assert.equal(opened, 0);
    assert.deepEqual(r.violations, []);
  });

  test('no signals from the site: no labels', async () => {
    const r = run({ site: fakeSite(new Map()) });
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-stock').length, 0);
  });
});
