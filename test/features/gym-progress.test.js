// Gym progress, against a synthetic gym page and its own answers (CMP-206, D-073).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature from '../../src/features/gym-progress/index.js';
import { readInitial, readProgress, readTrain, statValue } from '../../src/features/gym-progress/read.js';
import { gymStep } from '../../src/features/gym-progress/selectors.js';
import { checkObservation } from '../../src/core/kinds.js';
import { runFeature } from '../feature-harness.js';

const GYM = 'https://www.torn.com/gym.php';
const INITIAL = 'https://www.torn.com/gym.php?step=getInitialGymInfo';
const TRAIN = 'https://www.torn.com/gym.php?step=train';

/** Synthetic: classes as TornTools and Auto gym switch (MIT) match them. */
const HTML = `<div id="gymroot"><div class="gym___a1">
  <div class="gymList___b2">
    <div class="category___c3">
      <button class="gymButton___d4 active___e5"><span class="gym-1 icon___f6"></span></button>
      <button class="gymButton___d4 inProgress___g7"><span class="gym-2 icon___f6"></span><span class="percentage___h8">62%</span></button>
    </div>
  </div>
</div></div>`;

const INITIAL_ANSWER = {
  stats: { strength: { value: '1,000.50' }, defense: { value: '900' }, speed: { value: '800' }, dexterity: { value: '700' } },
  gyms: { lightweight: [{ id: 1, name: 'Premier Fitness', energyCost: 5, status: 'active' }, { id: 2, name: 'Average Joes', energyCost: 5, status: 'available' }] },
};

function fakeSite(answer = { gym_id: 2, percent: 62, next_gym_energy_estimate: 190 }) {
  const calls = [];
  return {
    calls,
    async meGym() {
      calls.push('meGym');
      return answer;
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: GYM, html: HTML, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 700) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CMP-206 reading the gym page', () => {
  test('steps of the page’s own gym requests only', () => {
    assert.equal(gymStep(TRAIN), 'train');
    assert.equal(gymStep('https://www.torn.com/page.php?step=train'), null);
  });

  test('values, the active gym, and a train’s new value', () => {
    assert.equal(statValue('10,885.76'), 10885.76);
    assert.equal(statValue('lots'), null);
    const initial = readInitial(INITIAL_ANSWER);
    assert.equal(initial.active, 1);
    assert.equal(initial.stats.get('strength'), 1000.5);
    assert.deepEqual(readTrain({ success: true, stat: { name: 'strength', newValue: '1,010.75' } }), { stat: 'strength', value: 1010.75 });
    assert.equal(readTrain({ success: false, stat: { name: 'strength', newValue: '1' } }), null);
    assert.equal(readTrain({ success: true, stat: { name: 'endurance', newValue: '1' } }), null);
  });

  test('the gym in progress: its id from its gym-<n> class, and its percentage', () => {
    const r = run({ settings: { enabled: false } });
    const progress = readProgress(r.doc);
    assert.equal(progress.gym_id, 2);
    assert.equal(progress.percent, 62);
  });
});

describe('CMP-206 sharing, own view only', () => {
  test('progress once per gym and percentage; each train its gain; both as the site takes them', async () => {
    const r = run({ site: fakeSite() });
    r.respond(INITIAL, INITIAL_ANSWER);
    await wait();
    r.respond(TRAIN, { success: true, stat: { name: 'strength', newValue: '1,010.75' } });
    r.respond(TRAIN, { success: true, stat: { name: 'strength', newValue: '1,020.75' } });
    await wait();
    assert.deepEqual(r.shared.map(({ kind, ...f }) => [kind, f]), [
      ['gym_progress', { gym_id: 2, percent: 62 }],
      ['gym_train', { gym_id: 1, stat: 'strength', gained: 10.25, trains: null, energy: null }],
      ['gym_train', { gym_id: 1, stat: 'strength', gained: 10, trains: null, energy: null }],
    ]);
    for (const { kind, ...fields } of r.shared) {
      assert.equal(checkObservation({ kind, observed_at: '2026-10-20T12:00:00Z', script_version: '0.9.0', ...fields }).error, undefined);
    }
    assert.deepEqual(r.violations, []);
  });

  test('a train without the value before only seeds the next one', async () => {
    const r = run({ site: fakeSite() });
    r.respond(TRAIN, { success: true, stat: { name: 'speed', newValue: '800' } });
    assert.equal(r.shared.filter((o) => o.kind === 'gym_train').length, 0);
  });
});

describe('CMP-206 the estimate beside the gym in progress', () => {
  test('shown, labelled as an estimate, when the site’s gym is the one on the page', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    const label = r.doc.querySelector('.ttc-gym');
    assert.equal(label.textContent, 'about 190 energy to go (an estimate)');
    assert.ok(label.closest('[class*="inProgress_"]'));
  });

  test('not shown for another gym', async () => {
    const r = run({ site: fakeSite({ gym_id: 9, percent: 10, next_gym_energy_estimate: 50 }) });
    await wait();
    assert.equal(r.doc.querySelector('.ttc-gym'), null);
  });

  test('not shown without an estimate', async () => {
    const r = run({ site: fakeSite({ gym_id: 2, percent: 62, next_gym_energy_estimate: null }) });
    await wait();
    assert.equal(r.doc.querySelector('.ttc-gym'), null);
  });
});
