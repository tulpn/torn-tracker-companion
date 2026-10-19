// Foreign shop stock, against saved shop data (CMP-104, TRV-051).

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature from '../../src/features/foreign-stock/index.js';
import { countryKey, fromPage, fromResponse } from '../../src/features/foreign-stock/read.js';
import { isShopResponse } from '../../src/features/foreign-stock/selectors.js';
import { checkObservation } from '../../src/core/kinds.js';
import { json, page, runFeature } from '../feature-harness.js';

const SHOP_URL = 'https://www.torn.com/page.php?sid=travelData&step=shop';

let running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: 'https://www.torn.com/page.php?sid=travel', ...opts });
  r.doc.body.dataset.abroad = opts?.abroad ?? 'true';
  if (opts?.bodyCountry) r.doc.body.dataset.country = opts.bodyCountry;
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

describe('CMP-104 every shelf of the shop is reported, empty ones included', () => {
  test('the page\'s own response, grouped by shop', () => {
    const r = run();
    r.respond(SHOP_URL, json('travel-shop.json'));
    assert.deepEqual(r.shared, [
      { kind: 'foreign_stock', country: 'mexico', item_id: 258, quantity: 1234, price: 10000 },
      { kind: 'foreign_stock', country: 'mexico', item_id: 260, quantity: 0, price: 300 },
      { kind: 'foreign_stock', country: 'mexico', item_id: 399, quantity: 7, price: 2500000 },
    ]);
    assert.deepEqual(r.violations, []);
  });

  test('the older flat form, with Torn\'s slug for the country', () => {
    const r = run();
    r.respond(SHOP_URL, json('travel-shop-flat.json'));
    assert.deepEqual(r.shared.map((o) => [o.country, o.item_id, o.quantity]), [['uk', 268, 52], ['uk', 267, 0]]);
  });

  test('every report is one the site will accept', () => {
    const r = run();
    r.respond(SHOP_URL, json('travel-shop.json'));
    for (const o of r.shared) {
      const checked = checkObservation({ ...o, observed_at: new Date().toISOString(), script_version: '1.0.0' });
      assert.ok(checked.value, checked.error);
    }
  });

  test('with no country in the response, the page body says which', () => {
    const r = run({ bodyCountry: 'cayman-islands' });
    const { country, ...rest } = json('travel-shop-flat.json');
    r.respond(SHOP_URL, rest);
    assert.ok(r.shared.length > 0);
    assert.ok(r.shared.every((o) => o.country === 'cayman'));
  });

  test('a country the site does not know is not reported', () => {
    const r = run();
    r.respond(SHOP_URL, { ...json('travel-shop-flat.json'), country: 'Atlantis' });
    assert.deepEqual(r.shared, []);
  });

  test('other responses are ignored', () => {
    const r = run();
    r.respond('https://www.torn.com/page.php?sid=travelData&step=buy&itemID=258&amount=1', json('travel-shop.json'));
    assert.deepEqual(r.shared, []);
  });
});

describe('TRV-051 at most once per country every 30 s, and only from a visible tab', () => {
  test('a second response for the same country inside 30 s is not reported again', () => {
    let clock = 0;
    const r = run({ now: () => clock });
    r.respond(SHOP_URL, json('travel-shop.json'));
    clock = 29_000;
    r.respond(SHOP_URL, json('travel-shop.json'));
    assert.equal(r.shared.length, 3);
    clock = 30_000;
    r.respond(SHOP_URL, json('travel-shop.json'));
    assert.equal(r.shared.length, 6);
  });

  test('a hidden tab reports nothing', () => {
    const r = run({ visibility: 'hidden' });
    r.respond(SHOP_URL, json('travel-shop.json'));
    assert.deepEqual(r.shared, []);
  });

  test('a player still in the air reports nothing', () => {
    const r = run();
    r.doc.body.dataset.traveling = 'true';
    r.respond(SHOP_URL, json('travel-shop.json'));
    assert.deepEqual(r.shared, []);
  });

  test('a page that says the player is at home reports nothing', () => {
    const r = run({ abroad: 'false' });
    r.respond(SHOP_URL, json('travel-shop.json'));
    assert.deepEqual(r.shared, []);
  });
});

describe('CMP-104 when the response was missed, the shelves on the page are read', () => {
  test('rows that can be read are reported; a row that cannot is left out, not guessed', async () => {
    const r = run({ html: page('travel-shop.html'), bodyCountry: 'mexico' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(r.shared, [
      { kind: 'foreign_stock', country: 'mexico', item_id: 258, quantity: 1234, price: 10000 },
      { kind: 'foreign_stock', country: 'mexico', item_id: 260, quantity: 0, price: 300 },
    ]);
    assert.deepEqual(r.violations, [], 'the Buy buttons are never pressed');
  });

  test('once the response has been read, the page is not read as well', async () => {
    const r = run({ html: page('travel-shop.html'), bodyCountry: 'mexico' });
    r.respond(SHOP_URL, json('travel-shop.json'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(r.shared.length, 3);
  });

  test('stopping the feature cancels the fallback', async () => {
    const r = run({ html: page('travel-shop.html'), bodyCountry: 'mexico' });
    r.stop();
    running = running.filter((x) => x !== r);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(r.shared, []);
  });
});

describe('CMP-006 the readers return nothing rather than guess', () => {
  test('a response of the wrong shape reads as nothing', () => {
    assert.equal(fromResponse(null), null);
    assert.equal(fromResponse({ shops: [{ stock: 'lots' }] }), null);
    assert.deepEqual(fromResponse({ stock: [{ ID: 1, stock: -1, price: 5 }, { ID: 2, stock: 1, price: '5' }] }).items, []);
  });

  test('country names and slugs map onto the site\'s closed list', () => {
    assert.equal(countryKey('South Africa'), 'south-africa');
    assert.equal(countryKey('United Arab Emirates'), 'uae');
    assert.equal(countryKey('united_kingdom'), 'uk');
    assert.equal(countryKey('Torn'), null);
    assert.equal(countryKey(7), null);
  });

  test('which responses are the shop', () => {
    assert.equal(isShopResponse(SHOP_URL), true);
    assert.equal(isShopResponse('https://www.torn.com/page.php?sid=travelData&step=shopping'), false);
    assert.equal(isShopResponse('https://www.torn.com/page.php?sid=travel'), false);
  });

  test('an empty page reads as no rows', () => {
    const r = run({ html: '<div></div>' });
    assert.deepEqual(fromPage(r.doc), []);
  });
});

