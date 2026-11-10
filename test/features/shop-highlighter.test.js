// Shop price highlighter, against synthetic Item Market listings (CMP-109 AC1, AC4, AC5).
// The listing markup is shaped like Torn Item Market - Shop Sell Price Highlighter's own
// test pages: an item image, a quantity and a price per row, and a filter list whose
// images are not listings.

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { labelFor, scanLine, stoppedAt, tooltipFor } from '../../src/features/shop-highlighter/index.js';
import { findRow, judge, parsePrice, parseQty, short } from '../../src/features/shop-highlighter/scan.js';
import { BUILT_IN, onProfitable, profitableCount } from '../../src/core/shops.js';
import { page as capturedPage, runFeature } from '../feature-harness.js';

const MARKET = 'https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=206';
const BIG_AL = { price: 1000, shop: "Big Al's Gun Shop", country: 'Torn' };

const listing = (id, price, qty = 1, name = 'Xanax') => `
  <li class="rowWrapper___x"><div class="sellerRow___y">
    <div class="thumbnail___z"><img src="/images/items/${id}/large.png" alt="${name}"></div>
    <div class="details___w"><div class="price___v">$${price.toLocaleString('en-US')}</div><div class="available___u">x${qty}</div></div>
    <button type="button" class="buyButton___t">Buy</button>
  </div></li>`;

const page = (...rows) => `
  <div class="filtersWrapper___f"><ul role="listbox"><li role="option"><img src="/images/items/206/small.png" alt="Xanax"> $5</li></ul></div>
  <ul class="sellerList___s">${rows.join('')}</ul>`;

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

const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
const rows = (r) => [...r.doc.querySelectorAll("[class*='sellerRow___']")];

describe('CMP-109 AC1 listings below the shop price', () => {
  test('$900 against a shop paying $1,000: blue, "+100", a tooltip; above it, nothing', async () => {
    const r = run({ html: page(listing(206, 900), listing(206, 1200)), url: MARKET, site: fakeSite() });
    await wait();
    const [below, above] = rows(r);
    assert.equal(below.getAttribute('data-ttc-shop'), 'blue');
    const price = below.querySelector("[class*='price___']");
    assert.equal(price.getAttribute('data-ttc-shop-dot'), 'blue');
    assert.equal(price.getAttribute('data-ttc-shop-label'), '+100');
    assert.equal(price.getAttribute('title'), "Xanax\nListed at $900 · Big Al's Gun Shop pays $1,000\nProfit $100 each (11.1%)");
    assert.equal(above.hasAttribute('data-ttc-shop'), false);
    assert.equal(above.querySelector('[data-ttc-shop-dot]'), null);
    assert.equal(profitableCount(), 1);
  });

  test('the tiers by profit per item, and by margin', async () => {
    const shops = { 1: { price: 100_000, shop: null, country: null } };
    const r = run({ html: page(listing(1, 40_000), listing(1, 85_000), listing(1, 98_000), listing(1, 99_999)), url: MARKET, site: fakeSite(shops) });
    await wait();
    assert.deepEqual(rows(r).map((row) => row.getAttribute('data-ttc-shop')), ['green', 'yellow', 'red', 'blue']);

    const pct = run({
      html: page(listing(1, 40_000), listing(1, 60_000), listing(1, 80_000), listing(1, 99_000)),
      url: MARKET, site: fakeSite(shops), settings: { ...feature.defaults, mode: 'pct' },
    });
    await wait();
    assert.deepEqual(rows(pct).map((row) => row.getAttribute('data-ttc-shop')), ['green', 'yellow', 'red', 'blue']);
  });

  test('the listing total, the label switched off, and hiding the rest', async () => {
    const r = run({
      html: page(listing(206, 900, 12), listing(206, 1200)), url: MARKET, site: fakeSite(),
      settings: { ...feature.defaults, inlineLabel: false, hideUnprofitable: true },
    });
    await wait();
    const [below, above] = rows(r);
    const price = below.querySelector('[data-ttc-shop-dot]');
    assert.equal(price.hasAttribute('data-ttc-shop-label'), false);
    assert.match(price.getAttribute('title'), /12 listed: \$1,200 in all$/);
    assert.equal(above.hasAttribute('data-ttc-shop-hide'), true);
  });

  test('the filter list is not a listing', async () => {
    const r = run({ html: page(), url: MARKET, site: fakeSite() });
    await wait();
    assert.equal(r.doc.querySelectorAll('[data-ttc-shop], [data-ttc-shop-dot]').length, 0);
  });

  test('new listings and changed prices are picked up', async () => {
    const r = run({ html: page(listing(206, 1200)), url: MARKET, site: fakeSite() });
    await wait();
    assert.equal(r.doc.querySelectorAll('[data-ttc-shop]').length, 0);
    r.doc.querySelector('ul.sellerList___s').insertAdjacentHTML('beforeend', listing(206, 500));
    r.doc.querySelector("[class*='price___']").textContent = '$950';
    await wait();
    assert.deepEqual(rows(r).map((row) => row.getAttribute('data-ttc-shop')), ['blue', 'blue']);
    assert.equal(profitableCount(), 2);
  });

  test('the sidebar hears the count; stopping takes every mark away and counts nothing', async () => {
    const heard = [];
    const off = onProfitable((n) => heard.push(n));
    const r = run({ html: page(listing(206, 900)), url: MARKET, site: fakeSite() });
    await wait();
    feature.stop();
    off();
    assert.deepEqual(heard, [1, 0]);
    assert.equal(r.doc.querySelectorAll('[data-ttc-shop], [data-ttc-shop-dot], [data-ttc-shop-label], [title]').length, 0);
  });
});

describe('CMP-109 AC4 and AC5', () => {
  test('with the site down, the built-in table still highlights', async () => {
    const [id, entry] = [...BUILT_IN].find(([, e]) => e.price > 10);
    const r = run({ html: page(listing(id, entry.price - 1)), url: MARKET, site: fakeSite(BUILT_IN) });
    await wait();
    assert.equal(rows(r)[0].getAttribute('data-ttc-shop'), 'blue');
  });

  test('no node is added to a listing row, and nothing is clicked', async () => {
    const r = run({ html: page(listing(206, 900, 3), listing(206, 1200)), url: MARKET, site: fakeSite() });
    const before = rows(r).map((row) => row.querySelectorAll('*').length);
    await wait();
    assert.deepEqual(rows(r).map((row) => row.querySelectorAll('*').length), before);
    assert.deepEqual(r.violations, []);
  });

  test('nothing on the add-listing form', async () => {
    const r = run({ html: page(listing(206, 900)), url: 'https://www.torn.com/page.php?sid=ItemMarket#/addListing', site: fakeSite() });
    await wait();
    assert.equal(r.doc.querySelectorAll('[data-ttc-shop]').length, 0);
  });
});

describe('the readers', () => {
  test('prices, quantities and short amounts', () => {
    assert.equal(parsePrice('Xanax $1,234,567 x3'), 1_234_567);
    assert.equal(parsePrice('no price'), null);
    assert.equal(parseQty('x 12'), 12);
    assert.equal(parseQty('1,250x'), 1250);
    assert.equal(parseQty('qty: 7'), 7);
    assert.equal(parseQty('$1,250'), 1);
    assert.equal(short(12_500), '12.5k');
    assert.equal(short(1_250_000), '1.25m');
    assert.equal(short(3e9), '3b');
    assert.equal(short(100), '100');
  });

  test('judging, labels and the tooltip', () => {
    const settings = { ...feature.defaults };
    assert.deepEqual(judge(900, 1000, settings).tier, 'blue');
    assert.equal(judge(1000, 1000, settings).tier, null);
    assert.equal(judge(900, 0, settings).tier, null);
    assert.equal(labelFor({ profit: 12_500, margin: 25, qty: 4 }, settings), '+12.5k (50k)');
    assert.equal(labelFor({ profit: 12_500, margin: 25, qty: 4 }, { ...settings, mode: 'pct', showTotal: false }), '+25%');
    assert.match(tooltipFor({ name: 'X', price: 1, entry: { price: 2, shop: null }, profit: 1, margin: 100, qty: 1 }), /A shop pays \$2/);
  });

  test('a list holding more than one item is not a row', () => {
    const r = run({ html: page(listing(206, 900), listing(206, 950)), url: MARKET, site: fakeSite() });
    assert.equal(findRow(r.doc.querySelector('ul.sellerList___s')), null);
  });
});

describe('hq #557 B15 the total stays off narrow listings', () => {
  test('the total is its own attribute; under 400 px the label shows the profit each only', async () => {
    const r = run({ html: page(listing(206, 900, 4)), url: MARKET, site: fakeSite() });
    await wait();
    const price = rows(r)[0].querySelector("[class*='price___']");
    assert.equal(price.getAttribute('data-ttc-shop-label'), '+100');
    assert.equal(price.getAttribute('data-ttc-shop-total'), ' (400)');
    assert.match(price.getAttribute('title'), /4 listed: \$400 in all/);
    const css = [...r.doc.querySelectorAll('style')].map((n) => n.textContent).join('\n');
    assert.match(css, /content: attr\(data-ttc-shop-label\) attr\(data-ttc-shop-total\);/);
    assert.match(css, /@media \(max-width: 400px\) \{\s*\[data-ttc-shop-label\]::after \{ content: attr\(data-ttc-shop-label\); \}/);
  });
});

// hq #826: on a fresh install the owner saw no mark and no line saying why. The scan now
// says, with debug on, where it stopped; the captured listings and the category tiles
// (classes as captured on 2026-11-03, `item-market-listings.html`) are both marked.
describe('hq #826 the scan says where it stopped', () => {
  const CAPTURED = 'https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=1123';
  const CATEGORY = 'https://www.torn.com/page.php?sid=ItemMarket#/market/view=category&categoryName=Most%20Popular';
  const spyCamera = (price) => fakeSite({ 1123: { price, shop: 'A shop', country: 'Torn' } });
  const lines = (r) => r.logs.filter((l) => l.startsWith('shop highlighter:'));

  /** One category tile, shaped as the captured item tile: image, name, "$430", "(211,122)". */
  const tile = (id, name, price) => `<li><div class="itemTile___gJeSo">
    <div class="baseItemTileWrapper___tV9VZ large___dkKZ0"><div class="tileImage___mbztJ">
      <img class="torn-item image___S3vQy" alt="${name}" src="/images/items/${id}/large.png"></div>
      <div class="actionsWrapper___t9l4N"><button type="button" class="actionButton___okbi2" aria-label="Buy item ${name}, $${price}."><span class="title___Qu9TR">Buy Item</span></button></div></div>
    <div class="title___nHwkf"><div class="name___HtUo7">${name}</div>
      <div class="priceAndTotal___Enq_i"><span>$${price.toLocaleString('en-US')}</span><span class="titleTotal___Vcj9r"> (1,204)</span></div></div>
  </div></li>`;

  /**
   * Splits every "$430" text node into "$" and "430", as Torn's React renders `${price}`
   * live: the serialized capture shows them joined (the owner's line on hq #826: 60
   * listings, 0 prices).
   */
  const splitPrices = (doc) => {
    const walker = doc.createTreeWalker(doc.body, doc.defaultView.NodeFilter.SHOW_TEXT);
    const texts = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (/^\s*\$\d/.test(node.nodeValue)) texts.push(node);
    for (const node of texts) node.splitText(node.nodeValue.indexOf('$') + 1);
    return texts.length;
  };

  test('live markup: "$" and the number are two text nodes; every listing is still read and marked', async () => {
    const r = run({ html: capturedPage('item-market-listings.html'), url: CAPTURED, site: spyCamera(600) });
    assert.ok(splitPrices(r.doc) >= 9);
    await wait();
    assert.equal(r.doc.querySelectorAll('[data-ttc-shop]').length, 5);
    const dots = [...r.doc.querySelectorAll('[data-ttc-shop-dot]')];
    assert.deepEqual(dots.map((d) => d.textContent), ['$430', '$430', '$540', '$550', '$599']);
    assert.match(dots[1].className, /^price___/);
    assert.match(lines(r)[0], /^shop highlighter: marked; .* 9 item images, 9 listings, 9 prices, 0 with no shop price, 5 below a shop price, 5 marked;/);
  });

  test('a price split over child elements is found on the element holding both', async () => {
    const r = run({ html: page(listing(206, 900).replace('>$900<', '><span>$</span><span>900</span><')), url: MARKET, site: fakeSite() });
    await wait();
    const price = rows(r)[0].querySelector("[class*='price___']");
    assert.equal(price.getAttribute('data-ttc-shop-dot'), 'blue');
    assert.equal(price.getAttribute('data-ttc-shop-label'), '+100');
  });

  test('captured listings with default settings: the tile and every seller below the shop price are marked', async () => {
    const r = run({ html: capturedPage('item-market-listings.html'), url: CAPTURED, site: spyCamera(600) });
    await wait();
    // $430, $540, $550 and $599 are below $600; the tile shows the lowest, $430.
    assert.equal(r.doc.querySelectorAll('[data-ttc-shop]').length, 5);
    assert.equal(profitableCount(), 5);
    assert.deepEqual(lines(r), [
      'shop highlighter: marked; 1 shop prices (site), 9 item images, 9 listings, 9 prices, 0 with no shop price, 5 below a shop price, 5 marked; by profit, lowest tier $1',
    ]);
  });

  test('a category view marks the tiles below a shop price', async () => {
    const shops = { 206: BIG_AL, 180: { price: 10, shop: 'A shop', country: 'Torn' } };
    const html = `<ul class="itemList___aHzcT">${tile(206, 'Xanax', 800)}${tile(180, 'Bottle of Beer', 700)}${tile(1, 'Hammer', 5)}</ul>`;
    const r = run({ html, url: CATEGORY, site: fakeSite(shops) });
    await wait();
    const tiles = [...r.doc.querySelectorAll("[class*='itemTile___']")];
    assert.deepEqual(tiles.map((t) => t.getAttribute('data-ttc-shop')), ['blue', null, null]);
    assert.equal(tiles[0].querySelector('[data-ttc-shop-dot]').textContent, '$800');
    assert.match(lines(r)[0], /^shop highlighter: marked; .* 3 item images, 3 listings, 3 prices, 1 with no shop price, 1 below a shop price, 1 marked;/);
  });

  test('nothing below a shop price says so, once, until the numbers change', async () => {
    const r = run({ html: capturedPage('item-market-listings.html'), url: CAPTURED, site: spyCamera(100) });
    await wait();
    r.doc.querySelector('ul').append(r.doc.createElement('li'));
    await wait();
    assert.equal(lines(r).length, 1);
    assert.match(lines(r)[0], /^shop highlighter: no listing below a shop price; /);
    assert.equal(r.doc.querySelector('[data-ttc-shop]'), null);
  });

  test('where a scan stops, step by step, and the margin mode', () => {
    const n = { images: 0, rows: 0, prices: 0, unknown: 0, below: 0, marked: 0 };
    assert.equal(stoppedAt(n), 'no item images outside the filters');
    assert.equal(stoppedAt({ ...n, images: 2 }), 'no listing row around the images');
    assert.equal(stoppedAt({ ...n, images: 2, rows: 2 }), 'no price in the listing rows');
    assert.equal(stoppedAt({ ...n, images: 2, rows: 2, prices: 2 }), 'no listing below a shop price');
    assert.equal(stoppedAt({ ...n, images: 2, rows: 2, prices: 2, below: 1 }), 'no listing reaches the lowest tier');
    const line = scanLine({ ...n, images: 2, rows: 2, prices: 2, below: 1 }, BUILT_IN, { ...feature.defaults, mode: 'pct', pctBlue: 5 });
    assert.match(line, /^shop highlighter: no listing reaches the lowest tier; \d+ shop prices \(built-in\), .* by margin, lowest tier 5%$/);
  });

  test('the add-listing form says why nothing is marked', async () => {
    const r = run({ html: page(listing(206, 900)), url: 'https://www.torn.com/page.php?sid=ItemMarket#/addListing', site: fakeSite() });
    await wait();
    assert.deepEqual(lines(r), ['shop highlighter: the add-listing form, nothing is listed here']);
  });
});
