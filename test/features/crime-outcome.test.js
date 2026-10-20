// Your own crime outcomes, from the page's own attempt response (CMP-205, hq #124).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature from '../../src/features/crime-outcome/index.js';
import { attemptOf, outcomeOf } from '../../src/features/crime-outcome/read.js';
import { checkObservation } from '../../src/core/kinds.js';
import { runFeature } from '../feature-harness.js';

const CRIMES = 'https://www.torn.com/page.php?sid=crimes#/burglary';
const ATTEMPT = 'https://www.torn.com/page.php?sid=crimesData&step=attempt&typeID=7&crimeID=42';

/** An attempt response as TornTools types it (synthetic). */
const answer = (result, rewards = []) => ({ DB: { demMod: 10, outcome: { ID: 1, result, story: ['…'], rewards } } });

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: CRIMES, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});

describe('CMP-205 reading an attempt', () => {
  test('the page’s own ids, from the address or the request’s form', () => {
    assert.deepEqual(attemptOf(ATTEMPT), { type_id: 7, page_crime_id: 42 });
    const form = new URLSearchParams('typeID=5&crimeID=3');
    assert.deepEqual(attemptOf('https://www.torn.com/page.php?sid=crimesData&step=attempt', form), { type_id: 5, page_crime_id: 3 });
    assert.equal(attemptOf('https://www.torn.com/page.php?sid=crimesData&step=crimesList&typeID=7&crimeID=42'), null);
    assert.equal(attemptOf('https://www.torn.com/page.php?sid=crimesData&step=attempt&typeID=7'), null);
  });

  test('outcome, money and items; an unknown result or an error is nothing', () => {
    assert.deepEqual(outcomeOf(answer('success', [
      { type: 'money', value: 1200 },
      { type: 'items', value: [{ id: 206, name: 'Xanax', amount: 1 }, { id: 0, amount: 1 }] },
      { type: 'other', text: 'You feel great' },
    ])), { outcome: 'success', money_gained: 1200, items: [{ item_id: 206, amount: 1 }] });
    assert.deepEqual(outcomeOf(answer('Critical failure')), { outcome: 'critical_failure', money_gained: 0, items: [] });
    assert.equal(outcomeOf(answer('jailed')), null);
    assert.equal(outcomeOf({ error: 'Not enough nerve', DB: { outcome: { result: 'failure' } } }), null);
    assert.equal(outcomeOf({}), null);
  });
});

describe('CMP-205 sharing your outcomes', () => {
  test('one observation per attempt, in the shape the site takes', () => {
    const r = run();
    r.respond(ATTEMPT, answer('failure', [{ type: 'money', value: 0 }]));
    assert.equal(r.shared.length, 1);
    const { kind, ...fields } = r.shared[0];
    assert.deepEqual(fields, { type_id: 7, page_crime_id: 42, outcome: 'failure', money_gained: 0, items: [] });
    assert.equal(checkObservation({ kind, observed_at: '2026-10-20T12:00:00Z', script_version: '0.9.0', ...fields }).error, undefined);
    assert.deepEqual(r.violations, []);
  });

  test('the ids may come in the request’s form', () => {
    const r = run();
    r.respond('https://www.torn.com/page.php?sid=crimesData&step=attempt', answer('success'), 'POST', new URLSearchParams('typeID=12&crimeID=9'));
    assert.deepEqual(r.shared.map((o) => [o.type_id, o.page_crime_id]), [[12, 9]]);
  });

  test('lists, hub loads and other pages share nothing', () => {
    const r = run();
    r.respond('https://www.torn.com/page.php?sid=crimesData&step=hub', answer('success'));
    r.respond('https://www.torn.com/page.php?sid=bazaarData&step=attempt&typeID=1&crimeID=1', answer('success'));
    assert.deepEqual(r.shared, []);
  });
});
