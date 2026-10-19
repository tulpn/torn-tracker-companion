import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { DISCLOSURE, disclosureGaps, hasTosTable, kindOffered, sharingOffered } from '../../src/core/disclosure.js';
import { createRegistry } from '../../src/core/registry.js';
import { WORDED, descriptor } from '../fixtures.js';

describe('CMP-014 the owner\'s words open the parts of the panel that need them', () => {
  test('this build carries no invented wording: every text is still empty', () => {
    assert.equal(DISCLOSURE.version, 0);
    assert.equal(DISCLOSURE.firstRun, null);
    assert.deepEqual(DISCLOSURE.kinds, {});
    assert.equal(DISCLOSURE.tosTable, null);
  });

  test('without them nothing is offered', () => {
    assert.equal(sharingOffered(DISCLOSURE), false);
    assert.equal(kindOffered('loadout', DISCLOSURE), false);
    assert.equal(hasTosTable(DISCLOSURE), false);
  });

  test('with them, each part opens', () => {
    assert.equal(sharingOffered(WORDED), true);
    assert.equal(kindOffered('loadout', WORDED), true);
    assert.equal(kindOffered('npc_loot', WORDED), false, 'a kind without its own line stays closed');
    assert.equal(hasTosTable(WORDED), true);
  });

  test('a terms table missing a column is no table', () => {
    assert.equal(hasTosTable({ ...WORDED, tosTable: { ...WORDED.tosTable, keyAccessLevel: ' ' } }), false);
  });

  test('a notice without a version above 0 cannot be agreed to', () => {
    assert.equal(sharingOffered({ ...WORDED, version: 0 }), false);
  });
});

describe('CMP-022 a release never ships a feature without its words', () => {
  test('a sharing feature without its wording is a gap', () => {
    const registry = createRegistry([descriptor({ shares: ['loadout'] })]);
    assert.deepEqual(disclosureGaps(registry, DISCLOSURE), [
      'the first-run notice (and a disclosure version above 0)',
      'the "what is shared" line for loadout',
    ]);
    assert.deepEqual(disclosureGaps(registry, WORDED), []);
  });

  test('a feature that needs an API key needs the terms table', () => {
    const registry = createRegistry([descriptor({ shares: [], needs: { apiKey: true, scriptKey: false } })]);
    assert.match(disclosureGaps(registry, DISCLOSURE)[0], /terms table \(needed by war-enhancer\)/);
  });
});
