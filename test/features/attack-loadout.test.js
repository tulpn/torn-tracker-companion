// Attack loadouts, against saved attack data (CMP-103, D-041, D-053).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature from '../../src/features/attack-loadout/index.js';
import { defenderInUrl, fromAttackData } from '../../src/features/attack-loadout/read.js';
import { isAttackData } from '../../src/features/attack-loadout/selectors.js';
import { checkObservation } from '../../src/core/kinds.js';
import { matchesAny } from '../../src/core/routes.js';
import { json, runFeature } from '../feature-harness.js';

const DATA_URL = 'https://www.torn.com/page.php?sid=attackData&mode=json';
const ATTACK = 'https://www.torn.com/page.php?sid=attack&user2ID=2000001';

const running = [];
const run = (opts = {}) => {
  const r = runFeature(feature, { url: ATTACK, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});

const EXPECTED = {
  kind: 'loadout',
  player_id: 2000001,
  context: 'attack',
  slots: {
    primary: { item_id: 399, damage: 52.34, accuracy: 61.2, bonuses: [{ name: 'Puncture', value: 12 }, { name: 'Deadeye', value: 25 }] },
    secondary: { item_id: 177, damage: 40, accuracy: 50, bonuses: [] },
    melee: { item_id: 4, damage: 20, accuracy: 55, bonuses: [] },
    body: { item_id: 1035, bonuses: [{ name: 'Impenetrable', value: 20 }] },
    helmet: { item_id: 1040, bonuses: [] },
  },
};

describe('CMP-103 the defender\'s visible loadout is reported once the page shows it', () => {
  test('weapons and armour from the page\'s own attackData, by slot', () => {
    const r = run();
    r.respond(DATA_URL, json('attack-data.json'));
    assert.deepEqual(r.shared, [EXPECTED]);
    assert.deepEqual(r.violations, []);
  });

  test('the report is one the site will accept', () => {
    const r = run();
    r.respond(DATA_URL, json('attack-data.json'));
    const { kind, ...data } = r.shared[0];
    const checked = checkObservation({ kind, ...data, observed_at: new Date().toISOString(), script_version: '1.0.0' });
    assert.ok(checked.value, checked.error);
  });

  test('nothing is read before the page shows the defender\'s items', () => {
    const r = run();
    r.respond(DATA_URL, json('attack-data-before.json'));
    assert.deepEqual(r.shared, []);
    r.respond(DATA_URL, json('attack-data.json'));
    assert.equal(r.shared.length, 1, 'and it is reported as soon as they appear');
  });

  test('Torn polling the fight does not report the same loadout again', () => {
    const r = run();
    for (let i = 0; i < 5; i += 1) r.respond(DATA_URL, json('attack-data.json'));
    assert.equal(r.shared.length, 1);
  });

  test('the attacker\'s own items are never part of it', () => {
    const r = run();
    r.respond(DATA_URL, json('attack-data.json'));
    const ids = Object.values(r.shared[0].slots).map((slot) => slot.item_id);
    assert.equal(ids.includes(1), false, "the attacker's item 1 is not in the defender's loadout");
    assert.notEqual(r.shared[0].slots.primary.damage, 99);
  });

  test('the attack page under loader.php shares the same loadout (hq #384)', () => {
    const loc = { pathname: '/loader.php', search: '?sid=attack&user2ID=2000001', hash: '' };
    assert.equal(matchesAny(feature.routes, loc), true);
    const r = run({ url: 'https://www.torn.com/loader.php?sid=attack&user2ID=2000001' });
    r.respond('https://www.torn.com/loader.php?sid=attackData&mode=json', json('attack-data.json'));
    assert.equal(r.shared.length, 1);
    assert.equal(r.shared[0].player_id, 2000001);
  });

  test('a response about someone other than the player in the URL is ignored', () => {
    const r = run({ url: 'https://www.torn.com/page.php?sid=attack&user2ID=3' });
    r.respond(DATA_URL, json('attack-data.json'));
    assert.deepEqual(r.shared, []);
  });

  test('a hidden tab reports nothing', () => {
    const r = run({ visibility: 'hidden' });
    r.respond(DATA_URL, json('attack-data.json'));
    assert.deepEqual(r.shared, []);
  });

  test('other responses are ignored', () => {
    const r = run();
    r.respond('https://www.torn.com/page.php?sid=attackLog&ID=1', json('attack-data.json'));
    assert.deepEqual(r.shared, []);
  });
});

describe('CMP-006 the reader leaves out what it cannot read', () => {
  test('no defender, or no items, is no loadout', () => {
    assert.equal(fromAttackData(null), null);
    assert.equal(fromAttackData({ DB: { defenderItems: { 1: { item: [{ ID: 1 }] } } } }), null);
    assert.equal(fromAttackData({ DB: { defenderUser: { userID: 5 }, defenderItems: {} } }), null);
  });

  test('a bonus without a readable name or value is dropped, and at most two are kept', () => {
    const data = { DB: { defenderUser: { userID: 5 }, defenderItems: { 1: { item: [{ ID: 1, currentBonuses: [
      { name: '', value: 1 }, { name: 'NoValue' }, { name: 'x'.repeat(41), value: 1 }, { name: 'Ok', value: 'lots' },
      { name: 'A', value: 1 }, { name: 'B', value: 2 }, { name: 'C', value: 3 },
    ] }] } } } };
    assert.deepEqual(fromAttackData(data).slots.primary.bonuses, [{ name: 'A', value: 1 }, { name: 'B', value: 2 }]);
  });

  test('armour never carries damage or accuracy, even if the response has them', () => {
    const { slots } = fromAttackData(json('attack-data.json'));
    assert.equal('damage' in slots.body, false);
    assert.equal('accuracy' in slots.body, false);
  });

  test('the defender in the URL', () => {
    assert.equal(defenderInUrl(new URL(ATTACK)), 2000001);
    assert.equal(defenderInUrl(new URL('https://www.torn.com/page.php?sid=attack')), null);
  });

  test('which responses are the fight\'s state', () => {
    assert.equal(isAttackData(DATA_URL), true);
    assert.equal(isAttackData('https://www.torn.com/page.php?sid=attackDataX'), false);
  });
});
