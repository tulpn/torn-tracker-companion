import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { DISCLOSURE, disclosureGaps, hasTosTable, kindOffered, sharingOffered } from '../../src/core/disclosure.js';
import { createRegistry } from '../../src/core/registry.js';
import { UNWORDED, WORDED, descriptor } from '../fixtures.js';
import fs from 'node:fs';
import { join } from 'node:path';

import features from '../../src/features/index.js';
import { kindTitle } from '../../src/core/kinds.js';
import { ROOT } from '../helpers.js';

describe('CMP-014 the owner\'s words open the parts of the panel that need them', () => {
  test('this build words every kind it can share, and nothing it cannot', () => {
    const registry = createRegistry(features);
    assert.deepEqual(disclosureGaps(registry, DISCLOSURE), []);
    const shared = new Set(registry.flatMap((d) => d.shares));
    assert.deepEqual(Object.keys(DISCLOSURE.kinds).sort(), [...shared].sort());
    assert.ok(DISCLOSURE.version >= 1);
  });

  test('the README lists each worded kind, under the title the panel gives it', () => {
    const readme = fs.readFileSync(join(ROOT, 'README.md'), 'utf8');
    for (const kind of Object.keys(DISCLOSURE.kinds)) {
      assert.ok(readme.split('\n').some((line) => line.startsWith(`| ${kindTitle(kind)} | `)), kind);
    }
  });

  test('no feature takes a Torn API key yet, so there is no terms table to show', () => {
    assert.equal(createRegistry(features).some((d) => d.needs.apiKey), false);
    assert.equal(DISCLOSURE.tosTable, null);
  });

  test('without them nothing is offered', () => {
    assert.equal(sharingOffered(UNWORDED), false);
    assert.equal(kindOffered('loadout', UNWORDED), false);
    assert.equal(hasTosTable(UNWORDED), false);
  });

  test('with them, each part opens', () => {
    assert.equal(sharingOffered(WORDED), true);
    assert.equal(kindOffered('loadout', WORDED), true);
    assert.equal(kindOffered('foreign_shop', WORDED), false, 'a kind without its own line stays closed');
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
    assert.deepEqual(disclosureGaps(registry, UNWORDED), [
      'the first-run notice (and a disclosure version above 0)',
      'the "what is shared" line for loadout',
    ]);
    assert.deepEqual(disclosureGaps(registry, WORDED), []);
  });

  test('a feature that needs an API key needs the terms table', () => {
    const registry = createRegistry([descriptor({ shares: [], needs: { apiKey: true, scriptKey: false } })]);
    assert.match(disclosureGaps(registry, UNWORDED)[0], /terms table \(needed by war-enhancer\)/);
  });
});

describe('hq #649 the lines say what the code sends', () => {
  const read = (f) => fs.readFileSync(join(ROOT, f), 'utf8').replace(/^> /gm, '').replace(/\s+/g, ' ');

  test('a train names the energy and the trains, which the page\'s answer may give', () => {
    assert.match(DISCLOSURE.kinds.gym_train, /the energy you spent and how many trains it was/);
  });

  test('jail bands: the site keeps and publishes nothing until it accepts them', () => {
    assert.match(DISCLOSURE.kinds.jail_difficulty, /does not accept these reports yet/);
    assert.doesNotMatch(DISCLOSURE.kinds.jail_difficulty, /count prisoners/);
  });

  test('an auction listing is sent again on a new bid, or after ten minutes', () => {
    assert.match(DISCLOSURE.kinds.auction_listing, /at most once every ten minutes while its bid stays the same, and again as soon as its bid changes/);
  });

  test('the README and the guide name what Applicant badges sends', () => {
    for (const f of ['README.md', 'guide/what-is-shared.md']) {
      assert.match(read(f), /Applicant badges sends torn-tracker\.com only the applicants' player ids/, f);
    }
  });

  test('the guide has a section for every kind, jail bands included', () => {
    assert.match(read('guide/sharing-kinds.md'), /## Jail difficulty bands/);
  });

  test('no guide page or the README asks the player to press Save', () => {
    const files = ['README.md', ...fs.readdirSync(join(ROOT, 'guide')).filter((f) => f.endsWith('.md')).map((f) => `guide/${f}`)];
    for (const f of files) assert.doesNotMatch(read(f), /press \*\*Save\*\*|Press \*\*Save\*\*|press Save/, f);
  });
});
