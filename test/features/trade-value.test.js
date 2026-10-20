// Trade value, against a saved trade page and a stand-in for the site (CMP-201).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { stepOf } from '../../src/features/trade-value/index.js';
import { priceOffer, readCash, readItem, receipt } from '../../src/features/trade-value/read.js';
import { moduleFrom, tableFrom } from '../../tools/build-items.mjs';
import { page, runFeature } from '../feature-harness.js';

const VIEW = 'https://www.torn.com/trade.php#step=view&ID=123';

function fakeSite(prices = { 206: 800_000, 367: 12_000_000 }) {
  const lookups = [];
  return {
    lookups,
    async prices(ids) {
      lookups.push([...ids]);
      return new Map(ids.filter((id) => id in prices).map((id) => [id, prices[id]]));
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: VIEW, html: page('trade-view.html'), ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});

const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const box = (r) => r.doc.querySelector('.ttc-trade');

describe('CMP-201 reading an offer', () => {
  test('"Name xN", a bare name, and the empty lines', () => {
    assert.deepEqual(readItem('Xanax x3'), { name: 'Xanax', quantity: 3 });
    assert.deepEqual(readItem(' Feathery Hotel Coupon x1,000 '), { name: 'Feathery Hotel Coupon', quantity: 1000 });
    assert.deepEqual(readItem('Some New Item'), { name: 'Some New Item', quantity: 1 });
    assert.equal(readItem('No items in trade'), null);
    assert.equal(readItem('Xanax x0'), null);
    assert.equal(readCash('$1,000,000'), 1_000_000);
    assert.equal(readCash('No money in trade'), null);
  });

  test('the step from the hash', () => {
    assert.equal(stepOf('#step=view&ID=1'), 'view');
    assert.equal(stepOf('#/step=initiateTrade'), 'initiateTrade');
    assert.equal(stepOf(''), null);
  });

  test('priced lines, an unknown item is counted and never guessed, and the receipt', () => {
    const offer = { cash: 1_000, items: [{ name: 'Xanax', quantity: 2, id: 206 }, { name: 'Odd', quantity: 1, id: null }] };
    const priced = priceOffer(offer, new Map([[206, 800_000]]));
    assert.equal(priced.total, 1_601_000);
    assert.equal(priced.unpriced, 1);
    assert.equal(receipt(priced, 'Ares'), [
      'Trade with Ares, at torn-tracker.com market value',
      '2 x Xanax @ $800,000 = $1,600,000',
      '1 x Odd: no price',
      'Money: $1,000',
      'Total: $1,601,000 (1 without a price)',
    ].join('\n'));
  });
});

describe('CMP-201 on the trade page', () => {
  test('totals the other side only, from one lookup', async () => {
    const site = fakeSite();
    const r = run({ site });
    await wait();
    assert.deepEqual(site.lookups, [[206, 367]]);
    assert.ok(box(r).closest('.user.right'));
    assert.equal(r.doc.querySelectorAll('.ttc-trade').length, 1);
    // $1,000,000 + 3 x $800,000 + 2 x $12,000,000
    assert.equal(box(r).querySelector('strong').textContent, '$27,400,000');
    assert.match(box(r).textContent, /1 without a price/);
    assert.deepEqual(r.violations, []);
  });

  test('a changed offer is priced again; an unchanged page is not', async () => {
    const site = fakeSite();
    const r = run({ site });
    await wait();
    r.doc.querySelector('.ttc-trade').append(r.doc.createElement('i'));
    await wait();
    assert.equal(site.lookups.length, 1, 'our own nodes changing is no reason');
    r.doc.querySelector('.user.right .color2 .desc li .name').textContent = 'Xanax x4';
    await wait();
    assert.equal(site.lookups.length, 2);
    assert.equal(box(r).querySelector('strong').textContent, '$28,200,000');
  });

  test('Copy puts the receipt on the clipboard', async () => {
    const r = run({ site: fakeSite() });
    let copied = null;
    Object.defineProperty(r.window.navigator, 'clipboard', { value: { writeText: async (t) => { copied = t; } }, configurable: true });
    await wait();
    box(r).querySelector('button').dispatchEvent(new r.window.MouseEvent('click', { bubbles: true }));
    await wait(10);
    assert.match(copied, /^Trade with Trader, at torn-tracker\.com market value\n3 x Xanax @ \$800,000 = \$2,400,000/);
    assert.equal(box(r).querySelector('button').textContent, 'Copied');
  });

  test('no clipboard: the receipt is shown to copy by hand', async () => {
    const r = run({ site: fakeSite() });
    Object.defineProperty(r.window.navigator, 'clipboard', { value: undefined, configurable: true });
    await wait();
    box(r).querySelector('button').dispatchEvent(new r.window.MouseEvent('click', { bubbles: true }));
    await wait(10);
    assert.match(box(r).querySelector('textarea').value, /^Total: \$27,400,000 \(1 without a price\)$/m);
  });

  test('not on a trade view: nothing', async () => {
    const r = run({ url: 'https://www.torn.com/trade.php', site: fakeSite() });
    await wait();
    assert.equal(box(r), null);
  });

  test('stopping takes it off', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    feature.stop();
    assert.equal(box(r), null);
  });
});

describe('tools/build-items.mjs', () => {
  test('tradable items only, by name; a name used twice is dropped', () => {
    const pairs = tableFrom({ items: [
      { id: 206, name: 'Xanax', is_tradable: true },
      { id: 1, name: 'Hammer', is_tradable: true },
      { id: 2, name: 'Untradable', is_tradable: false },
      { id: 3, name: 'Twin', is_tradable: true },
      { id: 4, name: 'Twin', is_tradable: true },
      { id: -1, name: 'Bad', is_tradable: true },
    ] });
    assert.deepEqual(pairs, [['Hammer', 1], ['Xanax', 206]]);
    assert.throws(() => tableFrom({ error: { code: 2 } }), /no items array/);
  });

  test('the module it writes is a Map of name to id', () => {
    const text = moduleFrom([['Xanax', 206], ['Say "hi"', 7]], '2026-10-20');
    assert.match(text, /\["Xanax", 206\],/);
    assert.match(text, /\["Say \\"hi\\"", 7\],/);
    assert.match(text, /^export const ITEM_IDS = new Map\(\[$/m);
  });
});
