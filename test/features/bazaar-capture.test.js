// Another player's bazaar, against the page's own responses (CMP-203, CAPI-010).

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature from '../../src/features/bazaar-capture/index.js';
import { MAX_ITEMS, createListing, ownIdFrom, ownerFrom, readChunk } from '../../src/features/bazaar-capture/read.js';
import { isItemsResponse } from '../../src/features/bazaar-capture/selectors.js';
import { checkObservation } from '../../src/core/kinds.js';
import { runFeature } from '../feature-harness.js';

const THEIRS = 'https://www.torn.com/bazaar.php?userId=4242#/';
const ITEMS_URL = 'https://www.torn.com/bazaar.php?rfcv=abc&step=getBazaarItems&start=0';

/** A chunk as TornTools types the response (synthetic). */
const chunk = (start, total, rows) => ({
  start, ID: 4242, total,
  list: rows.map(([itemID, amount, price, armoryID = 0]) => ({ itemID, amount, price, armoryID, name: 'x' })),
});

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: THEIRS, ...opts });
  running.push(r);
  return r;
};
beforeEach(() => {
  feature.settleMs = 5;
});
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
  feature.settleMs = 5_000;
});
const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CMP-203 reading a bazaar', () => {
  test('the response, the owner and your own id', () => {
    assert.equal(isItemsResponse(ITEMS_URL), true);
    assert.equal(isItemsResponse('https://www.torn.com/page.php?sid=bazaar&step=getBazaarItems'), false);
    assert.equal(ownerFrom('?userId=4242'), 4242);
    assert.equal(ownerFrom(''), null);
    assert.equal(ownIdFrom('a=1; uid=77; b=2'), 77);
    assert.equal(ownIdFrom('xuid=77'), null);
  });

  test('a chunk: item, the item’s own id when it has one, quantity and price; junk rows left out', () => {
    const read = readChunk(chunk(0, 3, [[206, 5, 800000], [1, 1, 50000, 99887766], [0, 1, 1]]));
    assert.deepEqual(read.items, [
      { item_id: 206, quantity: 5, price: 800000 },
      { item_id: 1, item_uid: 99887766, quantity: 1, price: 50000 },
    ]);
    assert.equal(readChunk({ list: 'no' }), null);
    assert.equal(readChunk({ list: [] }), null, 'no total, no listing');
  });

  test('complete only once every row up to the total was read', () => {
    const listing = createListing();
    listing.add(readChunk(chunk(0, 3, [[206, 5, 1], [207, 1, 2]])));
    assert.equal(listing.result().complete, false);
    listing.add(readChunk(chunk(2, 3, [[208, 1, 3]])));
    assert.deepEqual(listing.result().items.map((i) => i.item_id), [206, 207, 208]);
    assert.equal(listing.result().complete, true);
  });

  test('a row that could not be read, or a list past 200, is never complete', () => {
    const odd = createListing();
    odd.add(readChunk(chunk(0, 2, [[206, 5, 1], [0, 1, 1]])));
    assert.equal(odd.result().complete, false);
    const big = createListing();
    big.add(readChunk(chunk(0, 250, Array.from({ length: 250 }, (_, i) => [i + 1, 1, 1]))));
    assert.equal(big.result().items.length, MAX_ITEMS);
    assert.equal(big.result().complete, false);
  });
});

describe('CMP-203 sharing a bazaar', () => {
  test('one observation when the chunks settle, in the shape the site takes', async () => {
    const r = run();
    r.respond(ITEMS_URL, chunk(0, 2, [[206, 5, 800000]]));
    r.respond(ITEMS_URL, chunk(1, 2, [[1, 1, 50000, 123]]));
    await wait();
    assert.equal(r.shared.length, 1);
    const [obs] = r.shared;
    assert.deepEqual(obs, {
      kind: 'bazaar_listing', owner_id: 4242, open: true, complete: true,
      items: [{ item_id: 206, quantity: 5, price: 800000 }, { item_id: 1, item_uid: 123, quantity: 1, price: 50000 }],
    });
    const { kind, ...fields } = obs;
    const checked = checkObservation({ kind, observed_at: '2026-10-20T12:00:00Z', script_version: '0.9.0', ...fields });
    assert.equal(checked.error, undefined);
    assert.deepEqual(r.violations, []);
  });

  test('a partial list goes as partial, and again once it is complete; not a third time', async () => {
    const r = run();
    r.respond(ITEMS_URL, chunk(0, 2, [[206, 5, 1]]));
    await wait();
    r.respond(ITEMS_URL, chunk(1, 2, [[207, 1, 1]]));
    await wait();
    r.respond(ITEMS_URL, chunk(1, 2, [[207, 1, 1]]));
    await wait();
    assert.deepEqual(r.shared.map((o) => o.complete), [false, true]);
  });

  test('never your own bazaar: no userId, or your own id; it does not even listen', () => {
    const own = run({ url: 'https://www.torn.com/bazaar.php#/manage' });
    own.respond(ITEMS_URL, chunk(0, 1, [[206, 1, 1]]));
    assert.deepEqual(own.shared, []);
    feature.stop();

    let listened = false;
    feature.start({
      win: { location: { search: '?userId=4242' } },
      doc: { cookie: 'theme=dark; uid=4242' },
      now: Date.now,
      log: () => {},
      intercept: { onJson: () => { listened = true; return () => {}; } },
      share: () => { throw new Error('must not share your own bazaar'); },
    });
    assert.equal(listened, false);
  });

  test('an empty bazaar is not reported: it cannot say open or closed', async () => {
    const r = run();
    r.respond(ITEMS_URL, chunk(0, 0, []));
    await wait();
    assert.deepEqual(r.shared, []);
  });

  test('a hidden tab reports nothing', async () => {
    const r = run({ visibility: 'hidden' });
    r.respond(ITEMS_URL, chunk(0, 1, [[206, 1, 1]]));
    await wait();
    assert.deepEqual(r.shared, []);
  });
});
