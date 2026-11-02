// Property tests for every reader in core/ (hq #471, D-167): whatever Torn's page or
// torn-tracker.com sends, a reader never throws and never guesses, and a number it reads
// back from its own formatting is the number it started from.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { readDuration, readInt, readMoney } from '../../src/core/dom.js';
import {
  SIDEBAR_KEYS, readAchievements, readBuylist, readDashboard, readDibs, readGuide, readLists,
  readRosterRow, readRun, readSidebar,
} from '../../src/core/site.js';
import { readShopReply, validShopRows } from '../../src/core/shops.js';
import { checkObservation } from '../../src/core/kinds.js';
import { formOf } from '../../src/core/intercept.js';

const RUNS = { numRuns: 500 };
const nullOrInt = (v) => v === null || Number.isSafeInteger(v);
/** Text as a page may hold it: any string, often with digits, units and separators. */
const pageText = fc.oneof(
  fc.string(),
  fc.stringMatching(/^[\s$\-\d,.:kmbdhs]{0,20}$/),
  fc.constantFrom(null, undefined, '', ' ', '?', 'N/A', 'free', '1e5', 'Infinity', '0x10', '1.2.3'),
);

describe('hq #471 text readers never throw and never guess', () => {
  test('readInt: null or a whole number; formatting round-trips', () => {
    fc.assert(fc.property(pageText, (t) => nullOrInt(readInt(t))), RUNS);
    fc.assert(fc.property(fc.integer({ min: -1e12, max: 1e12 }), (n) => {
      assert.equal(readInt(n.toLocaleString('en-US')), n);
      assert.equal(readInt(` ${n} `), n);
    }), RUNS);
    fc.assert(fc.property(fc.stringMatching(/[a-zA-Z.]/), (t) => readInt(t) === null), RUNS);
  });

  test('readMoney: null or a whole number; $ and k/m/b round-trip', () => {
    fc.assert(fc.property(pageText, (t) => nullOrInt(readMoney(t))), RUNS);
    fc.assert(fc.property(fc.integer({ min: 0, max: 1e13 }), (n) => {
      assert.equal(readMoney(`$${n.toLocaleString('en-US')}`), n);
    }), RUNS);
    fc.assert(fc.property(fc.integer({ min: 0, max: 999 }), fc.constantFrom(['k', 1e3], ['m', 1e6], ['b', 1e9]), (n, [unit, scale]) => {
      assert.equal(readMoney(`${n}${unit}`), n * scale);
      assert.equal(readMoney(`$${n}${unit.toUpperCase()}`), n * scale);
    }), RUNS);
  });

  test('readDuration: null or seconds at or above 0; both spellings round-trip', () => {
    fc.assert(fc.property(pageText, (t) => {
      const v = readDuration(t);
      return v === null || (Number.isSafeInteger(v) && v >= 0);
    }), RUNS);
    fc.assert(fc.property(fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 59 }), fc.integer({ min: 0, max: 59 }), (h, m, s) => {
      const seconds = h * 3600 + m * 60 + s;
      const two = (n) => String(n).padStart(2, '0');
      assert.equal(readDuration(`${two(h)}:${two(m)}:${two(s)}`), seconds);
      assert.equal(readDuration(`${h}h ${m}m ${s}s`), seconds);
      assert.equal(readDuration(`${h}H${m}M${s}S`), seconds);
    }), RUNS);
    fc.assert(fc.property(fc.stringMatching(/[a-ce-gi-ln-rt-z]/), (t) => readDuration(t) === null), RUNS);
  });
});

/** Anything a reply could carry, and objects shaped like the real ones with junk inside. */
const junk = fc.anything({ withNullPrototype: true, withBigInt: true, withDate: true, withMap: true, withSet: true, withTypedArray: true, withSparseArray: true, maxDepth: 4 });
const shaped = (keys) => fc.dictionary(fc.constantFrom(...keys), junk, { maxKeys: keys.length });

describe('hq #471 JSON readers never throw on any reply', () => {
  const readers = [
    ['readDibs', (d) => readDibs(d, 0), ['player_id', 'name', 'claimed_by', 'claimed_at', 'expires_at', 'target_id']],
    ['readRosterRow', (d) => readRosterRow(d, 0), ['torn_id', 'name', 'level', 'status', 'until', 'last_action']],
    ['readRun', (d) => readRun(d, 0), ['id', 'name', 'started_at', 'ends_at', 'members', 'status']],
    ['readSidebar', (d) => readSidebar(d, SIDEBAR_KEYS, 0), ['items', 'links', ...SIDEBAR_KEYS]],
    ['readAchievements', readAchievements, ['next', 'done', 'total', 'items']],
    ['readGuide', readGuide, ['steps', 'done', 'total', 'url']],
    ['readLists', readLists, ['lists', 'items', 'updated_at']],
    ['readBuylist', readBuylist, ['trader', 'prices', 'page_url', 'calc_url', 'receipts']],
    ['readDashboard', (d) => readDashboard(d, 0), ['hero', 'cards', 'links', 'server_time']],
    ['readShopReply', readShopReply, ['shops', 'items', 'updated_at']],
    ['validShopRows', validShopRows, ['0', '1', 'length']],
    ['checkObservation', checkObservation, ['kind', 'observed_at', 'script_version', 'id', 'value']],
  ];
  for (const [name, read, keys] of readers) {
    test(name, () => {
      fc.assert(fc.property(fc.oneof(junk, shaped(keys)), (data) => {
        read(data);
      }), { numRuns: 300 });
    });
  }

  test('a buy list never has a price at or below 0, or one that is not whole', () => {
    fc.assert(fc.property(fc.dictionary(fc.string({ maxLength: 8 }), junk), (prices) => {
      const list = readBuylist({ trader: { torn_id: 2000001, name: 'ExampleTrader' }, prices });
      for (const [id, price] of list.prices) {
        assert.ok(Number.isSafeInteger(id) && id > 0);
        assert.ok(Number.isSafeInteger(price) && price > 0);
      }
    }), RUNS);
  });

  test('an observation is either a value or an error, never both, never neither', () => {
    fc.assert(fc.property(fc.oneof(junk, shaped(['kind', 'observed_at', 'script_version'])), (o) => {
      const r = checkObservation(o);
      assert.equal(('value' in r) !== ('error' in r), true);
    }), RUNS);
  });

  test('formOf: no form or a URLSearchParams, for any body', () => {
    fc.assert(fc.property(fc.oneof(junk, fc.string()), (body) => {
      const form = formOf(body);
      assert.ok(form === null || form instanceof URLSearchParams);
    }), RUNS);
  });
});
