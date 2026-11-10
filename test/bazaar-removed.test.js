// hq #829 (D-262, D-263): after Torn's API change of 10 November 2026 the companion no
// longer reads or sends another player's bazaar. The `bazaar_listing` kind and the
// bazaar-capture feature are gone; helpers on the player's own bazaar pages stay.

import fs from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import features from '../src/features/index.js';
import { createRegistry } from '../src/core/registry.js';
import { DISCLOSURE } from '../src/core/disclosure.js';
import { isKnownKind } from '../src/core/kinds.js';
import { normalize } from '../src/core/settings.js';
import { ROOT } from './helpers.js';

describe('hq #829 no other player\'s bazaar is read or shared', () => {
  const registry = createRegistry(features);

  test('the kind is unknown, offered by no feature and has no wording', () => {
    assert.equal(isKnownKind('bazaar_listing'), false);
    assert.equal(features.some((f) => f.id === 'bazaar-capture'), false);
    assert.equal(features.some((f) => (f.shares || []).includes('bazaar_listing')), false);
    assert.ok(Object.keys(DISCLOSURE.kinds).length > 0);
    assert.equal(Object.hasOwn(DISCLOSURE.kinds, 'bazaar_listing'), false);
    assert.equal(Object.hasOwn(DISCLOSURE.short, 'bazaar_listing'), false);
  });

  test('a stored "on" from an older version is dropped', () => {
    const settings = normalize({ shares: { bazaar_listing: true, foreign_stock: true } }, registry);
    assert.equal(Object.hasOwn(settings.shares, 'bazaar_listing'), false);
    assert.equal(settings.shares.foreign_stock, true);
  });

  test('no feature runs on another player\'s bazaar (bazaar.php?userId=N); own pages keep their helpers', () => {
    const onBazaar = features.filter((f) => (f.routes || []).some((r) => r.startsWith('bazaar.php')));
    assert.ok(onBazaar.length > 0, 'the price filler, undersell warning and wallet reminder stay');
    for (const f of onBazaar) {
      for (const r of f.routes.filter((x) => x.startsWith('bazaar.php'))) {
        assert.match(r, /^bazaar\.php#\/(add|manage)$/, `${f.id} runs on ${r}`);
      }
    }
  });

  for (const name of ['torn-tracker-companion.user.js']) {
    test(`dist/${name} names neither the kind nor the feature`, () => {
      const file = join(ROOT, 'dist', name);
      if (!fs.existsSync(file)) return;
      const text = fs.readFileSync(file, 'utf8');
      assert.equal(text.includes('bazaar_listing'), false);
      assert.equal(text.includes('bazaar-capture'), false);
    });
  }
});
