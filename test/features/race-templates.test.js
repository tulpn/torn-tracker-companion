// Racing templates on the custom race form (CMP-305).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { MAX_TEMPLATES, fillForm, readForm, validateTemplates } from '../../src/features/race-templates/index.js';
import { normalize, defaults } from '../../src/core/settings.js';
import { createRegistry } from '../../src/core/registry.js';
import features from '../../src/features/index.js';
import { runFeature } from '../feature-harness.js';

const RACING = 'https://www.torn.com/loader.php?sid=racing&tab=customrace';

/** Synthetic: field names as TornTools, f2404 (GPLv3) and br41nslug (MIT) read them. */
const FORM = `<div id="racingAdditionalContainer"><div class="form-custom-wrap"><form id="createCustomRace">
  <input id="racename" name="title" value="">
  <select id="select-racing-track" name="trackID"><option value="6">Uptown</option><option value="9">Parkland</option><option value="21">Speedway</option></select>
  <input name="laps" value="">
  <input name="minDrivers" value="">
  <input name="maxDrivers" value="">
  <select id="select-allow-upgrades" name="carsTypeAllowed"><option value="1">Allow upgrades</option><option value="2">Stock cars only</option></select>
  <input id="betAmount" name="betAmount" value="">
  <input id="waitTime" name="waitTime" value="">
  <input id="password" name="password" value="">
  <div class="custom-btn-wrap"><input type="submit" class="btn-action-form" value="START"></div>
</form></div></div>`;

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: RACING, html: FORM, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const press = (r, label) => {
  const button = [...r.doc.querySelectorAll('.ttc-race button')].find((b) => b.textContent === label);
  button.dispatchEvent(new r.window.MouseEvent('click', { bubbles: true, cancelable: true }));
};

describe('CMP-305 what is kept', () => {
  test('known fields only, named, at most ten, no duplicates', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `T${i}`, fields: { laps: '5' } }));
    assert.equal(validateTemplates({ templates: many }).templates.length, MAX_TEMPLATES);
    assert.deepEqual(validateTemplates({ templates: [
      { name: ' Daily ', fields: { laps: '5', trackID: '21', evil: 'x', betAmount: 5 } },
      { name: 'Daily', fields: {} },
      { name: '', fields: {} },
      { name: 'x'.repeat(26), fields: {} },
    ] }), { templates: [{ name: 'Daily', fields: { laps: '5', trackID: '21' } }] });
    assert.deepEqual(validateTemplates('junk'), { templates: [] });
  });

  test('templates live in settings, checked on load, and go with Forget me (defaults)', () => {
    const registry = createRegistry(features);
    const saved = normalize({ featureData: { 'race-templates': { templates: [{ name: 'Daily', fields: { laps: '5' } }] } } }, registry);
    assert.deepEqual(saved.featureData['race-templates'].templates, [{ name: 'Daily', fields: { laps: '5' } }]);
    assert.deepEqual(defaults(registry).featureData['race-templates'], { templates: [] });
    assert.deepEqual(normalize({ featureData: { 'race-templates': 'junk' } }, registry).featureData['race-templates'], { templates: [] });
  });
});

describe('CMP-305 on the form', () => {
  test('save the settings, then fill a fresh form from them; never pressing Start', async () => {
    const r = run();
    await wait();
    const form = r.doc.querySelector('#createCustomRace');
    const set = (name, value) => { form.querySelector(`[name="${name}"]`).value = value; };
    set('title', 'Speed run'); set('trackID', '21'); set('laps', '50'); set('carsTypeAllowed', '2'); set('password', 'pw');
    r.doc.querySelector('.ttc-race-name').value = 'Speedway 50';
    press(r, 'Save these settings');
    await wait(50);
    assert.match(r.doc.querySelector('.ttc-race-note').textContent, /Saved/);

    for (const name of ['title', 'laps', 'password']) set(name, '');
    set('trackID', '6');
    let submitted = 0;
    form.addEventListener('submit', () => { submitted += 1; });
    r.doc.querySelector('.ttc-race-pick').value = 'Speedway 50';
    press(r, 'Fill the form');
    assert.deepEqual(readForm(form), {
      title: 'Speed run', trackID: '21', laps: '50', minDrivers: '', maxDrivers: '', carsTypeAllowed: '2', betAmount: '', waitTime: '', password: 'pw',
    });
    assert.equal(submitted, 0);
    assert.deepEqual(r.violations, []);
  });

  test('a field the form no longer has, or a track it no longer lists, is skipped and said once', async () => {
    const r = run({ data: { templates: [{ name: 'Old', fields: { laps: '5', trackID: '99', minClass: 'A' } }] } });
    await wait();
    r.doc.querySelector('[name="laps"]').remove();
    r.doc.querySelector('.ttc-race-pick').value = 'Old';
    press(r, 'Fill the form');
    assert.match(r.doc.querySelector('.ttc-race-note').textContent, /no longer has: trackID, laps/);
    press(r, 'Fill the form');
    assert.doesNotMatch(r.doc.querySelector('.ttc-race-note').textContent, /no longer has/);
  });

  test('delete a template', async () => {
    const r = run({ data: { templates: [{ name: 'A', fields: {} }, { name: 'B', fields: {} }] } });
    await wait();
    r.doc.querySelector('.ttc-race-pick').value = 'A';
    press(r, 'Delete');
    await wait(50);
    assert.deepEqual([...r.doc.querySelectorAll('.ttc-race-pick option')].map((o) => o.value), ['', 'B']);
  });

  test('fillForm alone: sets inputs and selects, reports what is missing', () => {
    const r = run({ settings: { enabled: false } });
    const form = r.doc.querySelector('#createCustomRace');
    assert.deepEqual(fillForm(form, { fields: { laps: '7', trackID: '9' } }), []);
    assert.equal(form.querySelector('[name="trackID"]').value, '9');
  });
});
