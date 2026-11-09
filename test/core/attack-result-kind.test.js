// hq #746: the attack_result kind's fields, as agreed on hq #741 (WC-051, D-239). The
// reader comes with the captures; this pins what the site will accept, field by field.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { ATTACK_RESULTS, FINISH_SLOTS, KINDS, checkObservation } from '../../src/core/kinds.js';

const base = (over = {}) => ({
  kind: 'attack_result',
  observed_at: '2026-11-10T01:00:00Z',
  script_version: '0.9.19',
  code: '0123456789abcdef0123456789abcdef',
  defender_id: 123,
  defender_name: 'Someone',
  result: 'hospitalized',
  damage_dealt: 5321,
  damage_taken: 800,
  turns: 6,
  finishing_hit: { slot: 'primary', item_id: 399, damage: 1200 },
  temporaries: { attacker: [{ item_id: 226, uses: 1 }], defender: [] },
  ...over,
});
const ok = (o) => {
  const r = checkObservation(o);
  assert.ok(r.value, `refused: ${r.error}`);
  return r.value;
};
const refused = (o, pattern) => {
  const r = checkObservation(o);
  assert.ok(r.error, `accepted: ${JSON.stringify(o)}`);
  if (pattern) assert.match(r.error, pattern);
};

describe('hq #746 attack_result', () => {
  test('the agreed fields, and no others', () => {
    assert.deepEqual(KINDS.attack_result.fields, ['code', 'defender_id', 'defender_name', 'result',
      'damage_dealt', 'damage_taken', 'turns', 'finishing_hit', 'temporaries']);
    const value = ok(base({ defender_name: '  Someone  ' }));
    assert.equal(value.defender_name, 'Someone');
    assert.deepEqual(value.temporaries, { attacker: [{ item_id: 226, uses: 1 }], defender: [] });
    refused(base({ attacker_id: 1 }), /attacker_id/);
    refused(base({ temporaries: { attacker: [], defender: [], extra: [] } }), /extra/);
  });

  test('every result word and finishing slot is accepted; anything else is refused', () => {
    for (const result of ATTACK_RESULTS) ok(base({ result }));
    for (const result of ['Hospitalized', 'won', '', null]) refused(base({ result }), /result/);
    for (const slot of FINISH_SLOTS) {
      const bare = slot === 'fists' || slot === 'kick';
      ok(base({ finishing_hit: { slot, item_id: bare ? null : 1, damage: 0 } }));
    }
    refused(base({ finishing_hit: { slot: 'boots', item_id: 1, damage: 1 } }), /slot/);
  });

  test('no finishing hit is null, never a guess; fists carry no item, a weapon must', () => {
    assert.equal(ok(base({ result: 'escape', finishing_hit: null })).finishing_hit, null);
    refused(base({ finishing_hit: undefined }), /finishing_hit/);
    refused(base({ finishing_hit: { slot: 'kick', item_id: 5, damage: 1 } }), /item_id/);
    refused(base({ finishing_hit: { slot: 'melee', item_id: null, damage: 1 } }), /item_id/);
  });

  test('the code is 20 to 40 lower-case hex characters', () => {
    ok(base({ code: 'a'.repeat(20) }));
    ok(base({ code: 'f'.repeat(40) }));
    for (const code of ['a'.repeat(19), 'a'.repeat(41), 'A'.repeat(32), 'g'.repeat(32), 12345, '']) {
      refused(base({ code }), /code/);
    }
  });

  test('numbers stay in range', () => {
    for (const [field, bad] of [['defender_id', 0], ['damage_dealt', -1], ['damage_taken', 1.5],
      ['turns', 0], ['turns', 26], ['defender_name', ''], ['defender_name', 'x'.repeat(33)]]) {
      refused(base({ [field]: bad }), new RegExp(field));
    }
    refused(base({ temporaries: { attacker: Array(11).fill({ item_id: 1, uses: 1 }), defender: [] } }), /attacker/);
    refused(base({ temporaries: { attacker: [{ item_id: 1, uses: 0 }], defender: [] } }), /uses/);
  });
});
