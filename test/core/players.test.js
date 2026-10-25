// Which player a page or link is about (CMP-006).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { ATTACK_ROUTES, idFromHref, onSubjectPage, pageSubject } from '../../src/core/players.js';
import features from '../../src/features/index.js';

const at = (url) => new URL(url);

describe('the player a page is about', () => {
  test('a profile by XID, the attack page by user2ID, under both attack addresses', () => {
    assert.equal(pageSubject(at('https://www.torn.com/profiles.php?XID=5')), 5);
    assert.equal(pageSubject(at('https://www.torn.com/page.php?sid=attack&user2ID=7')), 7);
    assert.equal(pageSubject(at('https://www.torn.com/loader.php?sid=attack&user2ID=8')), 8);
    assert.equal(pageSubject(at('https://www.torn.com/profiles.php?XID=0')), null);
    assert.equal(pageSubject(at('https://www.torn.com/profiles.php?XID=x')), null);
    assert.equal(pageSubject(null), null);
  });

  test('only profiles and the attack page count as a player\'s page', () => {
    assert.equal(onSubjectPage(at('https://www.torn.com/profiles.php?XID=5')), true);
    assert.equal(onSubjectPage(at('https://www.torn.com/loader.php?sid=attack&user2ID=8')), true);
    assert.equal(onSubjectPage(at('https://www.torn.com/factions.php?XID=5')), false);
  });

  test('a profile link\'s id comes from XID and nothing else', () => {
    assert.equal(idFromHref('/profiles.php?XID=123'), 123);
    assert.equal(idFromHref('/profiles.php?ID=5'), null);
  });

  test('every feature that shows something on the attack page runs under both of its addresses', () => {
    // The loadout capture shares data: where it runs is left as reviewed (hq #384).
    for (const f of features.filter((x) => x.shares.length === 0)) {
      const attack = f.routes.filter((r) => /sid=attack$/.test(r));
      if (attack.length) assert.deepEqual([...attack].sort(), [...ATTACK_ROUTES].sort(), f.id);
    }
  });
});
