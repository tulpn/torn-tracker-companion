// Undersell warning, against saved sell forms (CMP-109 AC2, AC4, AC5).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { listedQty, typedPrice } from '../../src/features/undersell-warning/index.js';
import { BUILT_IN } from '../../src/core/shops.js';
import { page, runFeature } from '../feature-harness.js';

const BAZAAR_ADD = 'https://www.torn.com/bazaar.php#/add';
const BAZAAR_MANAGE = 'https://www.torn.com/bazaar.php#/manage';
const MARKET_ADD = 'https://www.torn.com/page.php?sid=ItemMarket#/addListing';

const BIG_AL = { price: 1000, shop: "Big Al's Gun Shop", country: 'Torn' };

function fakeSite(shops = { 206: BIG_AL }) {
  return {
    async shops() {
      return shops instanceof Map ? shops : new Map(Object.entries(shops).map(([id, entry]) => [Number(id), entry]));
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, opts);
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});

const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

/** Types into a field the way the player does: the value, then an input event. */
function type(r, input, value) {
  input.value = value;
  input.dispatchEvent(new r.window.Event('input', { bubbles: true }));
}

describe('CMP-109 AC2 the warning while the player types', () => {
  test('$900 warns with the shop, the difference and the total for what is listed', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite() });
    await wait();
    const row = r.doc.querySelector('ul.items-cont > li');
    type(r, row.querySelector('div.price input'), '900');
    const warning = row.querySelector('.ttc-undersell');
    assert.equal(warning.textContent,
      "Below the shop price. Big Al's Gun Shop pays $1,000 each, $100 more than this (×12: $1,200).");
    assert.equal(warning.getAttribute('role'), 'status');
  });

  test('$1,000 or more takes it away again; nothing is disabled, changed or submitted', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite() });
    await wait();
    let submitted = false;
    r.doc.querySelector('form').addEventListener('submit', () => { submitted = true; });
    const row = r.doc.querySelector('ul.items-cont > li');
    const input = row.querySelector('div.price input');
    type(r, input, '900');
    assert.ok(row.querySelector('.ttc-undersell'));
    type(r, input, '1,000');
    assert.equal(row.querySelector('.ttc-undersell'), null);
    type(r, input, '5000');
    assert.equal(row.querySelector('.ttc-undersell'), null);
    assert.equal(input.value, '5000');
    assert.equal([...r.doc.querySelectorAll('input, button')].some((n) => n.disabled), false);
    assert.equal(submitted, false);
    assert.deepEqual(r.violations, []);
  });

  test('an item no shop buys never warns', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite() });
    await wait();
    const row = r.doc.querySelectorAll('ul.items-cont > li')[2];
    type(r, row.querySelector('div.price input'), '1');
    assert.equal(row.querySelector('.ttc-undersell'), null);
  });

  test('the item market sell form: the quantity typed counts', async () => {
    const r = run({ html: page('market-add.html'), url: MARKET_ADD, site: fakeSite() });
    await wait();
    const row = r.doc.querySelector("[class*='itemRow___']");
    type(r, row.querySelector("[class^='amountInputWrapper___'] input"), '3');
    type(r, row.querySelector("[class^='priceInputWrapper___'] input"), '990');
    assert.equal(row.querySelector('.ttc-undersell').textContent,
      "Below the shop price. Big Al's Gun Shop pays $1,000 each, $10 more than this (×3: $30).");
  });

  test('the bazaar manage page warns about prices already set', async () => {
    const html = `<div data-testid="sortable-item"><div class="imgContainer___x"><img src="/images/items/206/medium.png" alt=""></div>
      <div class="price___p"><div class="input-money-group"><input class="input-money" value="250"></div></div></div>`;
    const r = run({ html, url: BAZAAR_MANAGE, site: fakeSite() });
    await wait();
    assert.match(r.doc.querySelector('.ttc-undersell').textContent, /^Below the shop price\. Big Al's Gun Shop pays \$1,000 each, \$750 more than this\.$/);
  });

  test('the warning goes under the filler\'s button when there is one', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite() });
    await wait();
    const row = r.doc.querySelector('ul.items-cont > li');
    const group = row.querySelector('.input-money-group');
    const fill = r.doc.createElement('button');
    fill.className = 'ttc-fill';
    group.after(fill);
    type(r, row.querySelector('div.price input'), '900');
    assert.equal(fill.nextElementSibling?.className.includes('ttc-undersell'), true);
  });

  test('stopping the feature takes its warnings away and stops listening', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite() });
    await wait();
    const input = r.doc.querySelector('div.price input');
    type(r, input, '900');
    feature.stop();
    assert.equal(r.doc.querySelectorAll('.ttc-undersell').length, 0);
    type(r, input, '800');
    assert.equal(r.doc.querySelectorAll('.ttc-undersell').length, 0);
  });
});

describe('CMP-109 AC4 the built-in table', () => {
  test('with the site down, the built-in table still warns', async () => {
    const [id, entry] = [...BUILT_IN].find(([, e]) => e.price > 10);
    const html = page('bazaar-add.html').replace('/images/items/206/', `/images/items/${id}/`);
    const r = run({ html, url: BAZAAR_ADD, site: fakeSite(BUILT_IN) });
    await wait();
    type(r, r.doc.querySelector('div.price input'), String(entry.price - 1));
    assert.match(r.doc.querySelector('.ttc-undersell').textContent, /^Below the shop price\. A shop pays/);
  });
});

describe('the readers', () => {
  test('the typed price and the quantity', () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite() });
    const row = r.doc.querySelector('ul.items-cont > li');
    assert.equal(typedPrice(row, 'bazaarAdd'), null);
    row.querySelector('div.price input').value = '$1,250';
    assert.equal(typedPrice(row, 'bazaarAdd'), 1250);
    assert.equal(listedQty(row, 'bazaarAdd'), 12, 'owned, when no quantity is typed');
    row.querySelector('div.amount input').value = '4';
    assert.equal(listedQty(row, 'bazaarAdd'), 4);
  });
});
