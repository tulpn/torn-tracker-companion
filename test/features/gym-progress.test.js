// Gym progress, against a synthetic gym page and its own answers (CMP-206, D-073).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature from '../../src/features/gym-progress/index.js';
import { answerShape, gainFromMessage, gymName, listShape, progressText, readActive, readInitial, readProgress, readStatuses, readTrain, statValue, whyNoProgress } from '../../src/features/gym-progress/read.js';
import { gymStep } from '../../src/features/gym-progress/selectors.js';
import { checkObservation } from '../../src/core/kinds.js';
import { page, runFeature } from '../feature-harness.js';

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
    assert.deepEqual(readTrain({ success: true, stat: { name: 'strength', newValue: '1,010.75' } }), { stat: 'strength', value: 1010.75, gain: null, energy: null, trains: null });
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

  test('hq #515: a gym page with no gym in progress says so once in the debug log', async () => {
    const r = run({ site: fakeSite(), html: '<div id="gymroot"></div>' });
    r.respond(INITIAL, INITIAL_ANSWER);
    await wait();
    const none = r.logs.filter((line) => line.startsWith('gym_progress: nothing captured'));
    assert.equal(none.length, 1);
    assert.equal(r.shared.filter((o) => o.kind === 'gym_progress').length, 0);
  });
});

describe('hq #576 the debug log says why nothing was captured', () => {
  const doc = (html) => {
    const r = run({ settings: { enabled: false }, html });
    return r.doc;
  };

  test('no gym buttons, buttons with none in progress, and an unreadable gym in progress are told apart', () => {
    assert.match(whyNoProgress(doc('<div id="gymroot"></div>')), /^no gym buttons found on the page; the markup differs/);
    assert.match(
      whyNoProgress(doc('<button class="gymButton___d4 active___e5"><span class="gym-1"></span></button><button class="gymButton___d4"><span class="gym-2"></span></button>')),
      /^2 gyms on the page, none in progress \(every gym unlocked/,
    );
    assert.match(
      whyNoProgress(doc('<button class="gymButton___d4 inProgress___g7"><span class="percentage___h8">62%</span></button>')),
      /^a gym in progress is on the page, but its gym id did not read \(classes: gymButton inProgress percentage\)/,
    );
  });

  test('the page log names the reason', async () => {
    const r = run({ site: fakeSite(), html: '<button class="gymButton___d4"><span class="gym-1"></span></button>' });
    await wait();
    assert.deepEqual(r.logs.filter((l) => l.startsWith('gym_progress:')), [
      'gym_progress: nothing captured (1 gyms on the page, none in progress (every gym unlocked, or the markup differs))',
    ]);
  });

  test('a train answer’s field names, never its values, once per page', async () => {
    assert.equal(answerShape({ success: true, stat: { name: 'strength', newValue: '1' }, message: 'x', list: [1] }), 'list, message, stat{name,newValue}, success');
    assert.equal(answerShape(null), '');
    assert.equal(answerShape([1, 2]), '');
    const r = run({ site: fakeSite() });
    r.respond(TRAIN, { success: true, energyUsed: 150, stat: { name: 'speed', newValue: '800' } });
    r.respond(TRAIN, { success: true, energyUsed: 150, stat: { name: 'speed', newValue: '810' } });
    const shape = r.logs.filter((l) => l.startsWith('gym_train: answer fields'));
    assert.deepEqual(shape, ['gym_train: answer fields: energyUsed, stat{name,newValue}, success']);
    assert.ok(!r.logs.some((l) => l.includes('800') || l.includes('150')));
  });

  test('a train that is not shared says why', async () => {
    const r = run({ site: fakeSite() });
    r.respond(TRAIN, { success: true, stat: { name: 'speed', newValue: '800' } });
    r.respond(TRAIN, { success: false });
    assert.deepEqual(r.logs.filter((l) => l.startsWith('gym_train: not shared')), [
      "gym_train: not shared (the answer's message named no gain, and no speed value from before this train)",
      'gym_train: not shared (the answer was not a successful train)',
    ]);
  });

  test('the page info read is logged with the stat count and the active gym', async () => {
    const r = run({ site: fakeSite() });
    r.respond(INITIAL, INITIAL_ANSWER);
    assert.ok(r.logs.includes('gym: page info read (4 stats, active gym 1)'));
  });
});

describe('hq #576 a train shared from its own answer', () => {
  /** The owner's train answer's shape (2026-11-05), with made-up values. */
  const ANSWER = {
    success: true,
    energy: { available: 0, max: 150, step: 5 },
    energySpent: 150,
    repeats: 30,
    gainMessage: 'You used 150 energy training your dexterity 30 times in Average Joes. You gained 1,234.56 dexterity.',
    gymsStatuses: [{ id: 1, status: 'available' }, { id: 2, status: 'active' }, { id: 3, status: 'inProgress', percentage: 41.5 }],
    message: 'x',
    percentages: { strength: 1, defense: 1, speed: 1, dexterity: 1 },
    reload: false,
    stat: { name: 'dexterity', newValue: '20,000.00' },
  };

  test('the gain from the message, the energy and the trains from the answer', () => {
    assert.equal(gainFromMessage(ANSWER.gainMessage, 'dexterity'), 1234.56);
    assert.equal(gainFromMessage('12.5 <b>defence</b>', 'defense'), 12.5);
    assert.equal(gainFromMessage('nothing here', 'speed'), null);
    assert.deepEqual(readTrain(ANSWER), { stat: 'dexterity', value: 20000, gain: 1234.56, energy: 150, trains: 30 });
  });

  test('the active gym and the gym in progress from gymsStatuses, its shape by name only', () => {
    assert.deepEqual(readStatuses(ANSWER.gymsStatuses), { active: 2, progress: { gym_id: 3, percent: 41.5 } });
    assert.deepEqual(readStatuses('x'), { active: null, progress: null });
    assert.equal(listShape(ANSWER.gymsStatuses), 'id, percentage, status');
  });

  test('without the page’s gym info and with an unreadable page, the train and the progress are still shared', async () => {
    const r = run({ site: fakeSite(), html: '<button class="gymButton___d4 inProgress___g7"><span class="percentage___h8">62%</span></button>' });
    r.respond(TRAIN, ANSWER);
    await wait();
    assert.deepEqual(r.shared.map(({ kind, ...f }) => [kind, f]), [
      ['gym_progress', { gym_id: 3, percent: 41.5 }],
      ['gym_train', { gym_id: 2, stat: 'dexterity', gained: 1234.56, trains: 30, energy: 150 }],
    ]);
    for (const { kind, ...fields } of r.shared) {
      assert.equal(checkObservation({ kind, observed_at: '2026-11-05T12:00:00Z', script_version: '0.9.13', ...fields }).error, undefined);
    }
    assert.ok(r.logs.includes('gym_train: gymsStatuses entry fields: id, percentage, status'));
    assert.ok(!r.logs.some((l) => l.includes('1,234') || l.includes('20,000') || l.includes('1234')));
  });

  test('the page’s gym ids with a hashed class, and the active gym from the page', () => {
    const r = run({ settings: { enabled: false }, html: '<button class="gymButton___d4 active___e5"><span class="gym-7___x1"></span></button><button class="gymButton___d4 inProgress___g7"><span class="gym-8___x1"></span><span>55%</span></button>' });
    assert.equal(readActive(r.doc), 7);
    assert.deepEqual({ ...readProgress(r.doc), button: undefined }, { gym_id: 8, percent: 55, button: undefined });
  });
});

// hq #610: one line in Torn's welcome box, after Torn's lines; nothing on or under a tile.
describe('hq #610 the progress line in Torn’s welcome box', () => {
  const OWNER_GYM = page('gym.html');
  const CARDIO = {
    stats: INITIAL_ANSWER.stats,
    gyms: { heavyweight: [
      { id: 18, name: 'Complete Cardio', status: 'active' },
      { id: 19, name: 'Legs, Bums and Tums', status: 'available' },
    ] },
  };
  const site = (extra = {}) => fakeSite({ gym_id: 19, percent: 84, next_gym_energy_estimate: 2896, ...extra });
  const box = (doc) => doc.querySelector('[class*="notificationText_"]');

  test('one line at the end of the welcome box, with the gym’s name, in thousands', async () => {
    const r = run({ html: OWNER_GYM, site: site() });
    r.respond(INITIAL, CARDIO);
    await wait();
    const line = r.doc.querySelector('.ttc-gym');
    assert.equal(line.textContent, 'Next gym (Legs, Bums and Tums): 84 %, about 2,896 E to go (estimate)');
    assert.equal(line.parentElement, box(r.doc));
    assert.equal(box(r.doc).lastElementChild, line, 'after Torn’s own lines');
    assert.match(line.title, /estimate/);
  });

  test('hq #557 F40: with TornTools’ energy line in the box, ours stays off', async () => {
    const r = run({ html: OWNER_GYM, site: site() });
    r.respond(INITIAL, CARDIO);
    await wait();
    assert.ok(r.doc.querySelector('.ttc-gym'));
    // What TornTools' gym-progress appends to the gym's notification.
    const theirs = r.doc.createElement('p');
    theirs.className = 'tt-gym-energy-progress';
    box(r.doc).append(theirs);
    await wait();
    assert.equal(r.doc.querySelector('.ttc-gym'), null);
  });

  test('nothing on or under any gym tile; the tile keeps only Torn’s own percentage', async () => {
    const r = run({ html: OWNER_GYM, site: site() });
    await wait();
    assert.ok(r.doc.querySelector('.ttc-gym'));
    assert.equal(r.doc.querySelector('[class*="gymList_"] .ttc-gym'), null);
    assert.equal(r.doc.querySelector('[class*="inProgress_"]').textContent, '84%');
  });

  test('with the site’s whole estimate for the gym: done and total too', async () => {
    const r = run({ html: OWNER_GYM, site: site({ next_gym_energy_total: 18000 }) });
    r.respond(INITIAL, CARDIO);
    await wait();
    assert.equal(r.doc.querySelector('.ttc-gym').textContent, 'Next gym (Legs, Bums and Tums): 15,104 / 18,000 E, 84 %, about 2,896 E to go (estimate)');
  });

  test('with Torn Stats’ line in the box: ours comes after it, once', async () => {
    const withTs = OWNER_GYM.replace('energy available to use.</p>', 'energy available to use.</p><p class="tornstats-gym">Estimated Energy progress: <span>15,120/18,000E</span>.</p>');
    const r = run({ html: withTs, site: site() });
    await wait();
    const lines = r.doc.querySelectorAll('.ttc-gym');
    assert.equal(lines.length, 1);
    assert.equal(lines[0].previousElementSibling.className, 'tornstats-gym');
  });

  test('a welcome box that is one element with <br> between its lines', async () => {
    const html = OWNER_GYM.replace(/<div class="notificationText___n1">[\s\S]*?<\/div>/, '<div class="notificationText___n1">Welcome to <b>Complete Cardio</b>!<br>You have <span>90/150</span> energy available to use.</div>');
    const r = run({ html, site: site() });
    await wait();
    assert.equal(r.doc.querySelector('.ttc-gym').parentElement, box(r.doc));
  });

  test('no welcome box: the line sits directly above the gym grid', async () => {
    const html = OWNER_GYM.replace(/<div class="gymContent___k1">[\s\S]*?<ul /, '<ul ');
    const r = run({ html, site: site() });
    await wait();
    const line = r.doc.querySelector('.ttc-gym');
    assert.ok(line.nextElementSibling.matches('[class*="gymList_"]'));
  });

  test('no name from the page: the line still reads', async () => {
    const r = run({ html: OWNER_GYM, site: site() });
    await wait();
    assert.equal(r.doc.querySelector('.ttc-gym').textContent, 'Next gym: 84 %, about 2,896 E to go (estimate)');
  });

  test('not shown for another gym, or without an estimate; gone when the feature stops', async () => {
    const other = run({ html: OWNER_GYM, site: site({ gym_id: 9 }) });
    const none = run({ html: OWNER_GYM, site: site({ next_gym_energy_estimate: null }) });
    const shown = run({ html: OWNER_GYM, site: site() });
    await wait();
    assert.equal(other.doc.querySelector('.ttc-gym'), null);
    assert.equal(none.doc.querySelector('.ttc-gym'), null);
    assert.ok(shown.doc.querySelector('.ttc-gym'));
    shown.stop();
    assert.equal(shown.doc.querySelector('.ttc-gym'), null);
  });

  test('a gym name is plain words or nothing', () => {
    assert.equal(gymName('  Legs, Bums  and Tums '), 'Legs, Bums and Tums');
    assert.equal(gymName('George’s'), 'George’s');
    for (const bad of [null, 5, '', '<b>x</b>', 'x'.repeat(41)]) assert.equal(gymName(bad), null, String(bad));
  });

  test('the words', () => {
    assert.equal(progressText({ percent: 62, toGo: 190 }), 'Next gym: 62 %, about 190 E to go (estimate)');
    assert.equal(progressText({ name: 'Gym', percent: 1, toGo: 1200, total: 1000 }), 'Next gym (Gym): 1 %, about 1,200 E to go (estimate)', 'a total under what is left is dropped');
  });
});
