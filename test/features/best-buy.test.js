// Best buy on the foreign shop, against saved shop data (TRV-052).

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { labelFor, playerFrom } from '../../src/features/best-buy/index.js';
import { bestBuy, readCapacity } from '../../src/features/best-buy/best.js';
import { json, page, runFeature } from '../feature-harness.js';

const SHOP_URL = 'https://www.torn.com/page.php?sid=travelData&step=shop';

/** The message above the shelves, as TornTools reads it. */
const info = (cash = '$1,000,000', carried = '5 / 29') => `<div class="info-msg-cont"><div class="msg">You have <strong>Mexico</strong>
  <strong>${cash}</strong> and have purchased <strong>${carried}</strong> items.</div></div>`;

function fakeSite(prices = { 258: 12_000, 260: 900, 399: 2_400_000 }) {
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
  const r = runFeature(feature, { url: 'https://www.torn.com/page.php?sid=travel', ...opts });
  running.push(r);
  return r;
};
beforeEach(() => {
  feature.fallbackMs = 5;
});
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
  feature.fallbackMs = 3_000;
});

const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const labels = (r) => [...r.doc.querySelectorAll('.ttc-best')];

describe('TRV-052 the pick', () => {
  const shelves = [
    { item_id: 1, quantity: 100, price: 1_000 },
    { item_id: 2, quantity: 3, price: 10_000 },
    { item_id: 3, quantity: 50, price: 500 },
  ];
  const market = new Map([[1, 1_500], [2, 30_000], [3, 400]]);

  test('most money in total, not per item: 3 dear ones, or 24 cheap ones when they pay more', () => {
    assert.deepEqual(bestBuy(shelves, market, { room: 24, money: null }), { item_id: 2, amount: 3, each: 20_000, total: 60_000 });
    const cheaper = new Map([...market, [2, 12_000]]);
    assert.deepEqual(bestBuy(shelves, cheaper, { room: 24, money: null }), { item_id: 1, amount: 24, each: 500, total: 12_000 });
  });

  test('cash limits the amount; a loss, no stock, no room or no price is never picked', () => {
    assert.deepEqual(bestBuy(shelves, market, { room: 100, money: 25_000 }), { item_id: 2, amount: 2, each: 20_000, total: 40_000 });
    assert.equal(bestBuy(shelves, market, { room: 0, money: null }), null);
    assert.equal(bestBuy([{ item_id: 3, quantity: 50, price: 500 }], market), null);
    assert.equal(bestBuy([{ item_id: 2, quantity: 0, price: 10_000 }], market), null);
    assert.equal(bestBuy([{ item_id: 9, quantity: 5, price: 1 }], market), null);
  });

  test('capacity reads "bought / max" and nothing else', () => {
    assert.deepEqual(readCapacity(' 5 / 29 '), { bought: 5, capacity: 29 });
    assert.equal(readCapacity('5/'), null);
    assert.equal(readCapacity('30 / 29'), null);
  });

  test('labels say "up to" when the room is unknown', () => {
    const pick = { item_id: 1, amount: 24, each: 500, total: 12_000 };
    assert.equal(labelFor(pick, { room: 24 }), 'Best buy: 24 (+$500 each, +$12,000)');
    assert.equal(labelFor(pick, { room: null }), 'Best buy: up to 24 (+$500 each, +$12,000)');
  });
});

describe('TRV-052 on the shop page', () => {
  test('from the page\'s own response: one price lookup, one label, on the best row', async () => {
    const site = fakeSite();
    const r = run({ html: info() + page('travel-shop.html'), site });
    r.respond(SHOP_URL, json('travel-shop.json'));
    await wait();
    assert.deepEqual(site.lookups, [[258, 260, 399]]);
    // 24 of room: plushies make $2,000 each = $48,000; the rifle loses money.
    assert.deepEqual(labels(r).map((n) => n.textContent), ['Best buy: 24 (+$2,000 each, +$48,000)']);
    assert.match(labels(r)[0].closest('li').textContent, /Jaguar Plushie/);
    assert.deepEqual(r.violations, []);
  });

  test('read off the page when the response was missed; cash from the message', async () => {
    const r = run({ html: info('$25,000', '0 / 29') + page('travel-shop.html'), site: fakeSite() });
    await wait();
    assert.deepEqual(labels(r).map((n) => n.textContent), ['Best buy: 2 (+$2,000 each, +$4,000)']);
  });

  test('no message: the amount is "up to" the stock', async () => {
    const r = run({ html: page('travel-shop.html'), site: fakeSite() });
    r.respond(SHOP_URL, { ...json('travel-shop.json'), money: undefined });
    await wait();
    assert.match(labels(r)[0].textContent, /^Best buy: up to 1234 /);
  });

  test('the label moves when the room runs out; nothing is filled or pressed', async () => {
    const r = run({ html: info() + page('travel-shop.html'), site: fakeSite() });
    r.respond(SHOP_URL, json('travel-shop.json'));
    await wait();
    r.doc.querySelector('.info-msg-cont strong:nth-of-type(3)').textContent = '29 / 29';
    await wait();
    assert.equal(labels(r).length, 0);
    assert.ok([...r.doc.querySelectorAll('input')].every((i) => i.value === ''));
    assert.deepEqual(r.violations, []);
  });

  test('no prices from the site: no label, no guess', async () => {
    const r = run({ html: info() + page('travel-shop.html'), site: fakeSite({}) });
    r.respond(SHOP_URL, json('travel-shop.json'));
    await wait();
    assert.equal(labels(r).length, 0);
  });

  test('stopping takes the label off', async () => {
    const r = run({ html: info() + page('travel-shop.html'), site: fakeSite() });
    r.respond(SHOP_URL, json('travel-shop.json'));
    await wait();
    feature.stop();
    assert.equal(labels(r).length, 0);
  });

  test('money falls back to the response', () => {
    const r = run({ html: '', site: fakeSite() });
    assert.deepEqual(playerFrom(r.doc, 5_000), { room: null, money: 5_000 });
    assert.deepEqual(playerFrom(r.doc, -1), { room: null, money: null });
  });
});
