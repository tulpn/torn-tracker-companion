// Bust safety on the jail page (CMP-303, hq #219).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { HOURS_BANDS, LEVEL_BANDS, bandOf, hoursOf, levelOf, score } from '../../src/features/bust-safety/index.js';
import { checkObservation } from '../../src/core/kinds.js';
import { runFeature } from '../feature-harness.js';

const JAIL = 'https://www.torn.com/jailview.php';

/** Synthetic: classes and texts as TornTools (GPLv3) and Bustr+ (MIT) read them. */
const row = (id, level, time) => `<li><a class="user name" href="/profiles.php?XID=${id}">Prisoner ${id}</a>
  <span class="info-wrap"><span class="time">TIME: ${time}</span><span class="level">LEVEL: ${level}</span><span class="reason">Burglary</span></span>
  <a class="bust" href="jailview.php?XID=${id}&action=rescue&step=breakout"><span class="bust-icon"></span></a>
  <a class="bye" href="jailview.php?XID=${id}&action=rescue&step=buy"><span class="bye-icon"></span></a></li>`;
const HTML = `<div class="userlist-wrapper"><ul class="users-list">${row(900001, 5, '30m')}${row(900002, 40, '1h 15m')}${row(900003, 80, '1d 2h')}</ul></div>`;

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: JAIL, html: HTML, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const badge = (r, id) => r.doc.querySelector(`a[href$="XID=${id}"] + .ttc-bust`);

describe('CMP-303 the rule of thumb (AC1)', () => {
  test('level and time read from the row only', () => {
    assert.equal(levelOf('LEVEL: 25'), 25);
    assert.equal(levelOf('Level 101'), null);
    assert.equal(hoursOf('TIME: 1d 2h 15m'), 26.25);
    assert.equal(hoursOf('45m'), 0.75);
    assert.equal(hoursOf('soon'), null);
  });

  test('level x (hours left + 3)', () => {
    assert.equal(score(40, 1.25), 170);
    assert.equal(score(5, 0.5), 18);
  });

  test('closed bands', () => {
    assert.equal(bandOf(40, LEVEL_BANDS), '26-50');
    assert.equal(bandOf(26, HOURS_BANDS), '24+');
    assert.equal(bandOf(0.5, HOURS_BANDS), '<1');
  });
});

describe('CMP-303 on the jail page', () => {
  test('a coloured score beside each prisoner, labelled as a rule of thumb, not Torn’s odds', async () => {
    const r = run();
    await wait();
    assert.equal(badge(r, 900001).textContent, '18');
    assert.equal(badge(r, 900001).dataset.band, 'easy');
    assert.equal(badge(r, 900002).dataset.band, 'medium');
    assert.equal(badge(r, 900003).dataset.band, 'hard');
    assert.match(badge(r, 900002).title, /Rule of thumb, not Torn's odds/);
  });

  test('AC1b and AC3: no bust or bail link is changed, and nothing is clicked', async () => {
    const r = run();
    const before = [...r.doc.querySelectorAll('a.bust, a.bye')].map((a) => a.getAttribute('href'));
    await wait();
    assert.deepEqual([...r.doc.querySelectorAll('a.bust, a.bye')].map((a) => a.getAttribute('href')), before);
    assert.ok(before.every((h) => /step=(breakout|buy)$/.test(h)), 'never breakout1 or buy1');
    assert.deepEqual(r.violations, []);
  });

  test('AC2: jail_difficulty carries the two bands and nothing about who (field walk)', async () => {
    const r = run();
    await wait();
    assert.equal(r.shared.length, 3);
    for (const { kind, ...fields } of r.shared) {
      assert.deepEqual(Object.keys(fields).sort(), ['hours_left_band', 'level_band']);
      assert.doesNotMatch(JSON.stringify(fields), /Prisoner|XID|90000/);
      assert.equal(checkObservation({ kind, observed_at: '2026-10-22T12:00:00Z', script_version: '0.9.0', ...fields }).error, undefined);
    }
    assert.deepEqual(r.shared[1], { kind: 'jail_difficulty', level_band: '26-50', hours_left_band: '1-3' });
  });

  test('each prisoner once in ten minutes; a hidden tab shares nothing', async () => {
    const r = run();
    await wait();
    r.doc.querySelector('.users-list').append(r.doc.createElement('li'));
    await wait();
    assert.equal(r.shared.length, 3);
    const hidden = run({ visibility: 'hidden' });
    await wait();
    assert.equal(hidden.shared.length, 0);
  });

  test('the thresholds come from the settings', async () => {
    const r = run({ settings: { enabled: true, easyUpTo: 200, hardFrom: 1000 } });
    await wait();
    assert.equal(badge(r, 900002).dataset.band, 'easy');
    assert.equal(badge(r, 900003).dataset.band, 'hard');
  });
});
