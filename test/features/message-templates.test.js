// Message templates on a player's profile (CMP-307).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, {
  BODY, MAX_TEMPLATES, NAME, STARTERS, fill, ownValues, readProfile, validateTemplates, withTemplate,
} from '../../src/features/message-templates/index.js';
import { defaults, normalize } from '../../src/core/settings.js';
import { createRegistry } from '../../src/core/registry.js';
import features from '../../src/features/index.js';
import { page, runFeature } from '../feature-harness.js';

const PROFILE = 'https://www.torn.com/profiles.php?XID=2000001';
const OWN = { ...feature.defaults, myName: 'Me', myBuylist: 'https://example.com/list', pct: 92 };
const T = { name: 'Hello', subject: 'Hi {name}', body: 'Hi {name} [{id}] of {faction}, level {level}. {my_name}' };

const running = [];
const run = (opts) => {
  const r = runFeature(feature, opts);
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));
const press = (r, label) => {
  const button = [...r.doc.querySelectorAll('.ttc-msg button, button.ttc-msg')].find((b) => b.textContent === label);
  assert.ok(button, `a ${label} button`);
  button.dispatchEvent(new r.window.MouseEvent('click', { bubbles: true, cancelable: true }));
};

describe('CMP-307 what is kept', () => {
  test('at most 20 named templates, each part within its length', () => {
    assert.deepEqual(validateTemplates({ templates: [
      T,
      { ...T, body: 'same name again' },
      { name: '  ', subject: '', body: '' },
      { name: 'x'.repeat(NAME + 1), subject: '', body: '' },
      { name: 'Long', subject: '', body: 'x'.repeat(BODY + 1) },
      { name: 'No subject', body: 'x' },
      'junk',
    ] }), { templates: [T] });
    assert.deepEqual(validateTemplates(null), { templates: [] });
    const many = Array.from({ length: MAX_TEMPLATES + 3 }, (_, i) => ({ name: `T${i}`, subject: '', body: '' }));
    assert.equal(validateTemplates({ templates: many }).templates.length, MAX_TEMPLATES);
  });

  test('the starter set is valid and is what a new player has', () => {
    assert.equal(validateTemplates({ templates: STARTERS }).templates.length, STARTERS.length);
    const registry = createRegistry(features);
    assert.deepEqual(defaults(registry).featureData['message-templates'].templates.map((t) => t.name),
      STARTERS.map((t) => t.name));
    const saved = normalize({ featureData: { 'message-templates': { templates: [T, { name: 1 }] } } }, registry);
    assert.deepEqual(saved.featureData['message-templates'].templates, [T]);
    assert.deepEqual(feature.shares, [], 'nothing is uploaded');
  });

  test('saving replaces in place, renames, appends, and deletes', () => {
    const two = { templates: [T, { name: 'B', subject: '', body: 'b' }] };
    assert.deepEqual(withTemplate(two, 'Hello', { ...T, body: 'new' }).templates.map((t) => t.body), ['new', 'b']);
    assert.deepEqual(withTemplate(two, 'Hello', { ...T, name: 'A' }).templates.map((t) => t.name), ['A', 'B']);
    assert.deepEqual(withTemplate(two, null, { name: 'C', subject: '', body: '' }).templates.map((t) => t.name), ['Hello', 'B', 'C']);
    assert.deepEqual(withTemplate(two, 'B', null).templates.map((t) => t.name), ['Hello']);
  });

  test('your own text options are bounded', () => {
    const registry = createRegistry(features);
    const saved = normalize({ features: { 'message-templates': { myName: 'x'.repeat(NAME + 1), myCalc: 'https://c', pct: 500 } } }, registry);
    assert.equal(saved.features['message-templates'].myName, '');
    assert.equal(saved.features['message-templates'].myCalc, 'https://c');
    assert.equal(saved.features['message-templates'].pct, 90);
  });
});

describe('CMP-307 filling in', () => {
  test('known values go in; AC2: an unknown one stays as written and is listed', () => {
    const out = fill('Hi {name}, {faction} {name} {nope}', { name: 'Ann', faction: null });
    assert.equal(out.text, 'Hi Ann, {faction} Ann {nope}');
    assert.deepEqual(out.missing, ['{faction}', '{nope}']);
    assert.deepEqual(out.parts[1], { text: 'Ann' });
    assert.deepEqual(out.parts[3], { flag: '{faction}' });
  });

  test('the profile gives name, ID, faction and level; nothing else is guessed', () => {
    const r = run({ url: PROFILE, html: page('profile.html') });
    assert.deepEqual(readProfile(r.doc, 2000001), { name: 'Example', id: '2000001', faction: 'Example Faction', level: '42' });
    assert.equal(readProfile(r.doc, 5).name, null, 'a name for another ID is not used');
    r.doc.querySelector('.info-table a').remove();
    assert.equal(readProfile(r.doc, 2000001).faction, null);
  });

  test('your values come from the settings, blank ones stay unset', () => {
    assert.deepEqual(ownValues(OWN), { my_name: 'Me', my_buylist: 'https://example.com/list', my_calc: null, pct: '92' });
  });
});

describe('CMP-307 on the profile', () => {
  test('Messages opens a preview filled in for this player', async () => {
    const r = run({ url: PROFILE, html: page('profile.html'), settings: OWN, data: { templates: [T] } });
    await wait();
    press(r, 'Messages');
    const preview = r.doc.querySelector('.ttc-msg-preview');
    assert.equal(preview.textContent, 'Hi ExampleHi Example [2000001] of Example Faction, level 42. Me');
    assert.equal(r.doc.querySelector('.ttc-msg-missing'), null);
    assert.deepEqual(r.violations, []);
  });

  test('AC2: what the page and settings lack is marked and explained', async () => {
    const html = page('profile.html').replace(/<li><div[^>]*><span class="bold">Faction[\s\S]*?<\/li>/, '');
    const r = run({ url: PROFILE, html, data: { templates: [T] } });
    await wait();
    press(r, 'Messages');
    assert.deepEqual([...r.doc.querySelectorAll('.ttc-msg-preview mark')].map((m) => m.textContent), ['{faction}', '{my_name}']);
    const why = [...r.doc.querySelectorAll('.ttc-msg-missing')].map((n) => n.textContent);
    assert.match(why[0], /Not on this page: \{faction\}/);
    assert.match(why[1], /Not set: \{my_name\}/);
  });

  test('AC1: Copy puts the message on the clipboard and nothing is sent', async () => {
    const r = run({ url: PROFILE, html: page('profile.html'), settings: OWN, data: { templates: [T] } });
    const copied = [];
    Object.defineProperty(r.window.navigator, 'clipboard', { value: { writeText: async (t) => copied.push(t) }, configurable: true });
    await wait();
    press(r, 'Messages');
    press(r, 'Copy message');
    await wait(0);
    assert.deepEqual(copied, ['Hi Example [2000001] of Example Faction, level 42. Me']);
    assert.deepEqual(r.violations, []);
  });

  test('without a clipboard the message is shown to copy by hand', async () => {
    const r = run({ url: PROFILE, html: page('profile.html'), settings: OWN, data: { templates: [T] } });
    Object.defineProperty(r.window.navigator, 'clipboard', { value: undefined, configurable: true });
    await wait();
    press(r, 'Messages');
    press(r, 'Copy message');
    await wait(0);
    assert.match(r.doc.querySelector('.ttc-msg-manual').value, /^Hi Example/);
  });

  test('a new template is saved, and an edit can delete it', async () => {
    const r = run({ url: PROFILE, html: page('profile.html'), settings: OWN, data: { templates: [] } });
    await wait();
    press(r, 'Messages');
    assert.match(r.doc.querySelector('.ttc-msg-body').textContent, /No templates yet/);
    press(r, 'New template');
    const [name, subject] = r.doc.querySelectorAll('.ttc-msg-body input');
    name.value = 'Thanks';
    subject.value = 'Thanks';
    r.doc.querySelector('.ttc-msg-body textarea').value = 'Thanks, {name}!';
    press(r, 'Save template');
    await r.settle();
    await wait(0);
    assert.deepEqual(r.stored().templates, [{ name: 'Thanks', subject: 'Thanks', body: 'Thanks, {name}!' }]);
    assert.match(r.doc.querySelector('.ttc-msg-preview').textContent, /Thanks, Example!/);
    press(r, 'Edit');
    press(r, 'Delete');
    await r.settle();
    await wait(0);
    assert.deepEqual(r.stored().templates, []);
  });

  test('a template needs a name of its own', async () => {
    const r = run({ url: PROFILE, html: page('profile.html'), data: { templates: [T] } });
    await wait();
    press(r, 'Messages');
    press(r, 'New template');
    press(r, 'Save template');
    assert.equal(r.doc.querySelector('.ttc-msg-say').textContent, 'Give it a name first.');
    r.doc.querySelector('.ttc-msg-body input').value = 'Hello';
    press(r, 'Save template');
    assert.equal(r.doc.querySelector('.ttc-msg-say').textContent, 'A template has that name already.');
  });

  test('AC3: only on one player\'s profile; stop removes everything', async () => {
    const r = run({ url: 'https://www.torn.com/profiles.php', html: page('profile.html') });
    await wait();
    assert.equal(r.doc.querySelector('.ttc-msg-toggle'), null);
    const p = run({ url: PROFILE, html: page('profile.html') });
    await wait();
    assert.equal(p.doc.querySelectorAll('.ttc-msg-toggle').length, 1);
    feature.stop();
    assert.equal(p.doc.querySelectorAll('.ttc-msg').length, 0);
    assert.deepEqual(p.violations, []);
  });
});
