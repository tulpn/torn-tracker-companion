// Auction house listings, against the owner's capture of amarket.php (CMP-202, CAPI-010
// as proposed in hq #122).

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature from '../../src/features/auction-capture/index.js';
import { readBids, readBonus, readEnds, readRow } from '../../src/features/auction-capture/read.js';
import { checkObservation } from '../../src/core/kinds.js';
import { page, runFeature } from '../feature-harness.js';

const AUCTIONS = 'https://www.torn.com/amarket.php';
const NOW = Date.parse('2026-10-20T14:15:00Z');

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: AUCTIONS, html: page('auction-house.html'), now: () => NOW, ...opts });
  running.push(r);
  return r;
};
beforeEach(() => {
  feature.settleMs = 5;
});
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
  feature.settleMs = 1_000;
});
const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CMP-202 reading a listing', () => {
  test('the end time is Torn time, exact; a broken date is none', () => {
    assert.equal(readEnds('Ends on 14:23:11 - 20/10/26'), '2026-10-20T14:23:11.000Z');
    assert.equal(readEnds('Ends on 14:23:11 - 31/02/26'), null);
    assert.equal(readEnds('soon'), null);
  });

  test('bid counts, bonuses by name with their value', () => {
    assert.equal(readBids('7 bids'), 7);
    assert.equal(readBids(' 1 bid '), 1);
    assert.equal(readBids('No bids'), 0);
    assert.equal(readBids('lots'), null);
    assert.deepEqual(readBonus('<b>Quicken</b><br/>61% increased passive speed while using this weapon'), { name: 'Quicken', value: 61 });
    assert.deepEqual(readBonus('<b>Comeback</b><br/>52% increased damage when brought below ¼ life'), { name: 'Comeback', value: 52 });
    assert.equal(readBonus('<b>Blank</b><br/>no number'), null);
    assert.equal(readBonus('plain text'), null);
  });

  test('the first captured row, field by field; quality stays null and the bidder is not read', () => {
    const r = run({ settings: { enabled: false } });
    const row = r.doc.querySelector('li[id="579754"]');
    assert.deepEqual(readRow(row, NOW), {
      listing_id: 579754,
      item_id: 486,
      item_uid: 900001,
      seller_id: 1000,
      current_bid: 27_374_758,
      bid_count: 7,
      ends_at: '2026-10-20T14:23:11.000Z',
      bonuses: [{ name: 'Quicken', value: 61 }],
      quality: null,
      rarity: 'yellow',
      damage: 43.77,
      accuracy: 48.67,
      armor: null,
    });
  });

  test('an anonymous seller is null, not left out', () => {
    const r = run({ settings: { enabled: false } });
    assert.equal(readRow(r.doc.querySelector('li[id="579999"]'), NOW).seller_id, null);
  });

  test('a row without what the site needs is left out', () => {
    const r = run({ settings: { enabled: false } });
    const row = r.doc.querySelector('li[id="579754"]');
    row.querySelector('.c-bid-wrap').textContent = 'ask';
    assert.equal(readRow(row, NOW), null);
  });
});

describe('CMP-202 sharing listings', () => {
  test('one observation per listing, each one the site will take', async () => {
    const r = run();
    await wait();
    assert.deepEqual(r.shared.map((o) => o.listing_id), [579754, 580753, 580754, 579999]);
    for (const { kind, ...fields } of r.shared) {
      const checked = checkObservation({ kind, observed_at: '2026-10-20T14:15:00Z', script_version: '0.9.0', ...fields });
      assert.equal(checked.error, undefined, JSON.stringify(fields));
    }
    assert.ok(r.shared.every((o) => !('high_bidder' in o) && !JSON.stringify(o).includes('1001')),
      'the high bidder (player 1001 in the fixture) is never sent');
    assert.deepEqual(r.violations, []);
  });

  test('a countdown tick is not a new listing; a new bid is', async () => {
    const r = run();
    await wait();
    const row = r.doc.querySelector('li[id="579754"]');
    row.querySelector('.dh-time').textContent = '7m 56s ';
    await wait();
    assert.equal(r.shared.length, 4);
    row.querySelector('.c-bid-wrap').textContent = ' $28,000,000 ';
    await wait();
    assert.equal(r.shared.length, 5);
    assert.equal(r.shared.at(-1).current_bid, 28_000_000);
  });

  test('a hidden tab shares nothing', async () => {
    const r = run({ visibility: 'hidden' });
    await wait();
    assert.deepEqual(r.shared, []);
  });
});
