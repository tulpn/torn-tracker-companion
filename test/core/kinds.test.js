import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { COUNTRIES, KINDS, LOOTABLE_NPCS, checkObservation, isKnownKind } from '../../src/core/kinds.js';
import { loadoutData, observation } from '../fixtures.js';

const ok = (o) => {
  const result = checkObservation(o);
  assert.ok(result.value, `refused: ${result.error}`);
  return result.value;
};
const refused = (o, pattern) => {
  const result = checkObservation(o);
  assert.ok(result.error, 'was accepted');
  if (pattern) assert.match(result.error, pattern);
};

describe('CMP-008 the queue holds only observations the site will accept', () => {
  test('wave 1 brings four kinds', () => {
    assert.deepEqual(Object.keys(KINDS).sort(), ['foreign_shop', 'foreign_stock', 'loadout', 'npc_loot']);
    assert.equal(isKnownKind('crime_outcome'), false);
    assert.equal(isKnownKind('toString'), false);
  });

  test('the closed lists match the site word for word', () => {
    assert.deepEqual([...COUNTRIES], ['mexico', 'cayman', 'canada', 'hawaii', 'uk', 'argentina',
      'switzerland', 'japan', 'china', 'uae', 'south-africa']);
    assert.deepEqual([...LOOTABLE_NPCS], [4, 10, 15, 17, 19, 20]);
  });

  test('a valid foreign stock sighting passes, normalised', () => {
    const value = ok(observation({ observed_at: '2026-10-19T12:00:00Z' }));
    assert.equal(value.observed_at, '2026-10-19T12:00:00.000Z');
    assert.deepEqual(Object.keys(value).sort(),
      ['country', 'item_id', 'kind', 'observed_at', 'price', 'quantity', 'script_version']);
  });

  test('zero stock is a fact worth sending', () => {
    ok(observation({ quantity: 0 }));
  });

  test('a field the site did not ask for is refused, not dropped', () => {
    refused(observation({ player_id: 1 }), /player_id/);
    refused(observation({ seen_by: 'me' }), /seen_by/);
  });

  test('each range is held', () => {
    refused(observation({ country: 'mex' }), /country/);
    refused(observation({ item_id: 0 }), /item_id/);
    refused(observation({ item_id: 1.5 }), /item_id/);
    refused(observation({ quantity: -1 }), /quantity/);
    refused(observation({ quantity: 1_000_001 }), /quantity/);
    refused(observation({ price: 1e13 }), /price/);
    refused(observation({ price: '5000' }), /price/);
  });

  test('the envelope is checked too', () => {
    refused(observation({ kind: 'battle' }), /not a kind/);
    refused(observation({ observed_at: 'yesterday' }), /observed_at/);
    refused(observation({ script_version: 'x'.repeat(21) }), /script_version/);
    refused(observation({ script_version: 1 }), /script_version/);
    refused(null);
  });

  test('a foreign shop holds up to 100 shelf items and says whether it is complete', () => {
    const shop = (items, complete = true) => observation({
      kind: 'foreign_shop', items, complete, item_id: undefined, quantity: undefined, price: undefined,
    });
    const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
    const item = { item_id: 206, quantity: 0, price: 5000 };
    ok(strip(shop([item])));
    ok(strip(shop([])));
    refused(strip(shop(Array(101).fill(item))), /items/);
    refused(strip(shop([{ ...item, extra: 1 }])), /extra/);
    refused(strip(shop([item], 'yes')), /complete/);
  });

  test('NPC loot: a closed NPC list, levels 1 to 5, the timer optional', () => {
    const loot = (over) => ({ kind: 'npc_loot', observed_at: new Date().toISOString(), script_version: '1.0.0', npc_id: 4, loot_level: 3, ...over });
    assert.equal('level_since' in ok(loot({ level_since: null })), false, 'a null timer is left out');
    assert.ok(ok(loot({ level_since: '2026-10-19T11:00:00Z' })).level_since);
    refused(loot({ npc_id: 5 }), /npc_id/);
    refused(loot({ loot_level: 6 }), /loot_level/);
  });

  test('a loadout: closed slots, at most two bonuses, attack or war', () => {
    const loadout = (over) => ({ kind: 'loadout', observed_at: new Date().toISOString(), script_version: '1.0.0', ...loadoutData(over) });
    const value = ok(loadout());
    assert.deepEqual(value.slots.primary.bonuses, [{ bonus_id: 7, value: 12 }]);
    refused(loadout({ context: 'gym' }), /context/);
    refused(loadout({ slots: { cape: { item_id: 1 } } }), /cape/);
    refused(loadout({ slots: {} }), /at least one/);
    refused(loadout({ slots: { primary: { item_id: 1, bonuses: [1, 2, 3].map((n) => ({ bonus_id: n, value: 1 })) } } }), /bonuses/);
    refused(loadout({ slots: { primary: { item_id: 1, strength: 9 } } }), /strength/);
    refused(loadout({ player_id: 0 }), /player_id/);
  });

  test('battle stats can never ride along on a loadout', () => {
    for (const field of ['strength', 'defense', 'speed', 'dexterity', 'networth', 'money', 'energy']) {
      refused({ kind: 'loadout', observed_at: new Date().toISOString(), script_version: '1', ...loadoutData(), [field]: 1 }, new RegExp(field));
    }
  });
});
