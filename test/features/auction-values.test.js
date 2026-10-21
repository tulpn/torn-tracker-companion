// Value badges on the auction house, against the owner's capture (AUC-020, hq #199).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { badgeFor, short } from '../../src/features/auction-values/index.js';
import { page, runFeature } from '../feature-harness.js';

const AUCTIONS = 'https://www.torn.com/amarket.php';

function fakeSite(values = {
  579754: { estimate: 27_400_000, sales: 12, basis: 'auctions', deal: false },
  580753: { estimate: null, sales: 3, basis: 'auctions', deal: false },
  580754: { estimate: 600_000_000, sales: 8, basis: 'auctions', deal: true },
}) {
  const calls = [];
  return {
    calls,
    async auctionValues(ids) {
      calls.push([...ids]);
      return new Map(ids.filter((id) => id in values).map((id) => [id, values[id]]));
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: AUCTIONS, html: page('auction-house.html'), ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 900) => new Promise((resolve) => setTimeout(resolve, ms));
const badge = (r, id) => r.doc.querySelector(`li[id="${id}"] .ttc-auc`);

describe('AUC-020 the badge', () => {
  test('short money', () => {
    assert.equal(short(27_400_000), '$27.4m');
    assert.equal(short(950_000), '$950k');
    assert.equal(short(1_200_000_000), '$1.2b');
    assert.equal(short(441_000_000), '$441m');
    assert.equal(short(800), '$800');
  });

  test('an estimate, too few sales, and a plain item from the market', () => {
    assert.equal(badgeFor({ estimate: 27_400_000, sales: 12, basis: 'auctions', deal: false }).text, 'about $27.4m, 12 sales');
    assert.equal(badgeFor({ estimate: null, sales: 3, basis: 'auctions', deal: false }).text, 'not enough sales');
    const market = badgeFor({ estimate: 830_000, sales: 0, basis: 'market', deal: false });
    assert.equal(market.text, 'about $830k');
    assert.match(market.title, /item market/);
  });
});

describe('AUC-020 on the auction house', () => {
  test('one read for the listings on the page; a badge in each known row; deals tagged', async () => {
    const site = fakeSite();
    const r = run({ site });
    await wait();
    assert.deepEqual(site.calls, [[579754, 580753, 580754, 579999]]);
    assert.equal(badge(r, 579754).textContent, 'about $27.4m, 12 sales');
    assert.equal(badge(r, 580753).textContent, 'not enough sales');
    assert.equal(badge(r, 580754).textContent, 'about $600m, 8 sales · deal');
    assert.equal(badge(r, 579999), null, 'a listing the site has not seen gets nothing');
    assert.deepEqual(r.violations, []);
  });

  test('a countdown tick is no reason to ask again', async () => {
    const site = fakeSite();
    const r = run({ site });
    await wait();
    r.doc.querySelector('li[id="579754"] .dh-time').textContent = '7m 50s ';
    await wait();
    assert.equal(site.calls.length, 1);
  });

  test('stopping takes the badges off', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    feature.stop();
    assert.equal(r.doc.querySelectorAll('.ttc-auc').length, 0);
  });
});
