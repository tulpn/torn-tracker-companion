// Price filler, against saved sell forms (CMP-105, CMP-030 fill-only).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature from '../../src/features/price-filler/index.js';
import { itemIdOf, ownedOf, priceFrom } from '../../src/features/price-filler/fill.js';
import { formFor } from '../../src/features/price-filler/selectors.js';
import { page, runFeature } from '../feature-harness.js';

const BAZAAR_ADD = 'https://www.torn.com/bazaar.php#/add';
const MARKET_ADD = 'https://www.torn.com/page.php?sid=ItemMarket#/addListing';

function fakeSite(prices = { 206: 800_000, 1: 50, 5: 9 }, shops = {}) {
  const lookups = [];
  return {
    lookups,
    async shops() {
      return new Map(Object.entries(shops).map(([id, entry]) => [Number(id), entry]));
    },
    async prices(ids) {
      lookups.push([...ids]);
      return new Map(ids.filter((id) => id in prices).map((id) => [id, prices[id]]));
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

/** A player's press, and every event the page then sees. */
function press(r, button) {
  const seen = [];
  for (const type of ['input', 'change', 'submit', 'click', 'keydown']) {
    r.doc.addEventListener(type, (e) => seen.push(`${type}:${e.target.className || e.target.tagName}`), true);
  }
  button.dispatchEvent(new r.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return seen;
}

describe('CMP-105 a fill button per row; one press fills one row', () => {
  test('rows get a button with the price it will fill, from one price lookup', async () => {
    const site = fakeSite();
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site });
    await wait();
    assert.deepEqual(site.lookups, [[206, 1, 999]]);
    const buttons = [...r.doc.querySelectorAll('.ttc-fill')];
    assert.deepEqual(buttons.map((b) => b.textContent), ['Fill $799,999', 'Fill $49', 'No price']);
    assert.equal(buttons[2].disabled, true);
  });

  test('a press fills that row\'s price (both inputs) and quantity, and nothing else', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite() });
    await wait();
    const [first, second] = r.doc.querySelectorAll('ul.items-cont > li');
    press(r, first.querySelector('.ttc-fill'));
    assert.deepEqual([...first.querySelectorAll('div.price input')].map((i) => i.value), ['799999', '799999']);
    assert.equal(first.querySelector('div.amount input').value, '12');
    assert.equal(second.querySelector('div.price input').value, '', 'the next row is untouched');
  });

  test('only input and change reach the page: no submit, no click on anything of Torn\'s', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite() });
    await wait();
    let submitted = false;
    r.doc.querySelector('form').addEventListener('submit', () => { submitted = true; });
    const seen = press(r, r.doc.querySelector('.ttc-fill'));
    const fromScript = seen.filter((e) => !e.startsWith('click:ttc-fill'));
    assert.ok(fromScript.length > 0);
    assert.ok(fromScript.every((e) => e.startsWith('input:') || e.startsWith('change:')), fromScript.join(', '));
    assert.equal(submitted, false);
    assert.deepEqual(r.violations, []);
  });

  test('a single item behind a checkbox gets its price; the checkbox is left to the player', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite() });
    await wait();
    const row = r.doc.querySelectorAll('ul.items-cont > li')[1];
    press(r, row.querySelector('.ttc-fill'));
    assert.equal(row.querySelector('div.price input').value, '49');
    assert.equal(row.querySelector('input[type=checkbox]').checked, false);
  });

  test('the undercut comes from the player\'s setting', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite(), settings: { enabled: true, undercut: 1000 } });
    await wait();
    assert.equal(r.doc.querySelector('.ttc-fill').textContent, 'Fill $799,000');
  });

  test('the item market sell form: id from the info button, quantity from "x 1,250"', async () => {
    const site = fakeSite();
    const r = run({ html: page('market-add.html'), url: MARKET_ADD, site });
    await wait();
    assert.deepEqual(site.lookups, [[206]], 'a greyed-out row is not offered');
    const row = r.doc.querySelector("[class*='itemRow___']");
    press(r, row.querySelector('.ttc-fill'));
    assert.equal(row.querySelector("[class^='priceInputWrapper___'] input").value, '799999');
    assert.equal(row.querySelector("[class^='amountInputWrapper___'] input").value, '1250');
  });

  test('CMP-109 AC3: never below the shop price, and the button says it stopped there', async () => {
    const shop = { price: 1000, shop: "Big Al's Gun Shop", country: 'Torn' };
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite({ 206: 800, 1: 50 }, { 206: shop }) });
    await wait();
    const button = r.doc.querySelector('.ttc-fill');
    assert.equal(button.textContent, 'Fill $1,000 (shop price)');
    assert.match(button.title, /^Stopped at the shop price: Big Al's Gun Shop pays \$1,000 each/);
    press(r, button);
    assert.equal(r.doc.querySelector('div.price input').value, '1000');
    assert.deepEqual(r.violations, []);
  });

  test('a shop paying less than the market changes nothing', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite(undefined, { 206: { price: 10, shop: null, country: null } }) });
    await wait();
    assert.equal(r.doc.querySelector('.ttc-fill').textContent, 'Fill $799,999');
  });

  test('re-renders do not add a second button', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite() });
    await wait();
    r.doc.querySelector('ul.items-cont').append(r.doc.createElement('div'));
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-fill').length, 3);
  });

  test('stopping the feature takes its buttons away', async () => {
    const r = run({ html: page('bazaar-add.html'), url: BAZAAR_ADD, site: fakeSite() });
    await wait();
    feature.stop();
    assert.equal(r.doc.querySelectorAll('.ttc-fill').length, 0);
  });
});

describe('CMP-006 the readers', () => {
  test('which form the player is on', () => {
    assert.equal(formFor(new URL(BAZAAR_ADD)), 'bazaarAdd');
    assert.equal(formFor(new URL('https://www.torn.com/bazaar.php#/manage')), 'bazaarManage');
    assert.equal(formFor(new URL(MARKET_ADD)), 'marketAdd');
    assert.equal(formFor(new URL('https://www.torn.com/page.php?sid=ItemMarket#/market/view=search')), null);
    assert.equal(formFor(new URL('https://www.torn.com/bazaar.php?userId=1')), null);
  });

  test('price: market minus undercut, never below $1, nothing without a market value', () => {
    assert.equal(priceFrom(1000, 1), 999);
    assert.equal(priceFrom(5, 100), 1);
    assert.equal(priceFrom(undefined, 1), null);
    assert.equal(priceFrom(1000, -50), 1000);
  });

  test('ids and owned counts read as null when the row does not say', async () => {
    const r = run({ html: '<ul class="items-cont"><li><div class="name-wrap">Thing</div></li></ul>', url: BAZAAR_ADD, site: fakeSite() });
    const row = r.doc.querySelector('li');
    assert.equal(itemIdOf(row, 'bazaarAdd'), null);
    assert.equal(ownedOf(row, 'bazaarAdd'), null);
  });
});
