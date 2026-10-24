// Player notes on profiles, faction lists and the attack page (CMP-308).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { MAX_NOTES, TEXT, badgeText, validateNotes, withNote } from '../../src/features/player-notes/index.js';
import { defaults, normalize } from '../../src/core/settings.js';
import { createRegistry } from '../../src/core/registry.js';
import features from '../../src/features/index.js';
import { page, runFeature } from '../feature-harness.js';

const PROFILE = 'https://www.torn.com/profiles.php?XID=55';
const PROFILE_HTML = '<div class="content-title"><h4>Someone\'s profile</h4></div><div class="profile-wrapper"></div>';
const WAR = 'https://www.torn.com/factions.php?step=your#/war/rank';
const NOTE = { id: 101, tag: 'enemy', text: 'Hits back hard after a loss, wait an hour', at: 1 };

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
  const button = [...r.doc.querySelectorAll('.ttc-notes button, button.ttc-notes')].find((b) => b.textContent === label);
  button.dispatchEvent(new r.window.MouseEvent('click', { bubbles: true, cancelable: true }));
};

describe('CMP-308 what is kept', () => {
  test('one note per player, a known tag, at most 300 characters', () => {
    assert.deepEqual(validateNotes({ notes: [
      NOTE,
      { ...NOTE, text: 'second for the same player' },
      { id: 2, tag: 'rival', text: 'x', at: 1 },
      { id: 3, tag: 'friend', text: 'x'.repeat(TEXT + 1), at: 1 },
      { id: -4, tag: 'friend', text: '', at: 1 },
      { id: 5, tag: 'friend', text: '', at: 'yesterday' },
      'junk',
    ] }), { notes: [NOTE, { id: 5, tag: 'friend', text: '', at: 0 }] });
    assert.deepEqual(validateNotes(null), { notes: [] });
    const many = Array.from({ length: MAX_NOTES + 5 }, (_, i) => ({ id: i + 1, tag: 'note', text: '', at: 1 }));
    assert.equal(validateNotes({ notes: many }).notes.length, MAX_NOTES);
  });

  test('setting a note puts it first; null removes it', () => {
    const one = withNote({ notes: [NOTE] }, 7, { tag: 'friend', text: 'Gym buddy', at: 2 });
    assert.deepEqual(one.notes.map((n) => n.id), [7, 101]);
    assert.deepEqual(withNote(one, 101, null).notes.map((n) => n.id), [7]);
  });

  test('the badge carries the tag and the start of the note', () => {
    assert.equal(badgeText(NOTE), 'Enemy: Hits back hard after a…');
    assert.equal(badgeText({ tag: 'friend', text: '  ' }), 'Friend');
    assert.equal(badgeText({ tag: 'ally', text: 'Short' }), 'Ally: Short');
  });

  test('AC2: notes live in settings, checked on load, and go with Forget me (defaults)', () => {
    const registry = createRegistry(features);
    const saved = normalize({ featureData: { 'player-notes': { notes: [NOTE, { id: 'x' }] } } }, registry);
    assert.deepEqual(saved.featureData['player-notes'].notes, [NOTE]);
    assert.deepEqual(defaults(registry).featureData['player-notes'], { notes: [] });
    assert.deepEqual(feature.shares, [], 'nothing is uploaded');
  });
});

describe('CMP-308 on the pages the player opened', () => {
  test('a profile: write a note, and it shows beside the name', async () => {
    const r = run({ url: PROFILE, html: PROFILE_HTML });
    await wait();
    assert.equal(r.doc.querySelector('.ttc-notes-badge'), null);
    press(r, 'Add note');
    const editor = r.doc.querySelector('.ttc-notes-editor');
    assert.ok(editor, 'the editor opens under the heading');
    editor.querySelector('select').value = 'watch';
    editor.querySelector('input').value = 'Sells Xanax cheap';
    press(r, 'Save note');
    await r.settle();
    await wait(0);
    const badge = r.doc.querySelector('.ttc-notes-badge');
    assert.equal(badge.textContent, 'Watch: Sells Xanax cheap');
    assert.equal(badge.dataset.tone, 'warn');
    assert.equal(r.doc.querySelector('.ttc-notes-toggle').textContent, 'Edit note');
    assert.deepEqual(r.violations, []);
  });

  test('a profile: delete removes the note and its badge', async () => {
    const r = run({ url: PROFILE, html: PROFILE_HTML, data: { notes: [{ ...NOTE, id: 55 }] } });
    await wait();
    assert.match(r.doc.querySelector('.ttc-notes-badge').title, /Hits back hard/);
    press(r, 'Edit note');
    assert.equal(r.doc.querySelector('.ttc-notes-editor input').value, NOTE.text);
    press(r, 'Delete');
    await r.settle();
    await wait(0);
    assert.equal(r.doc.querySelector('.ttc-notes-badge'), null);
    assert.equal(r.doc.querySelector('.ttc-notes-toggle').textContent, 'Add note');
  });

  test('a faction list: a badge only beside players with a note', async () => {
    const r = run({ url: WAR, html: page('faction-war.html'), data: { notes: [NOTE] } });
    await wait();
    const badges = [...r.doc.querySelectorAll('.ttc-notes-badge')];
    assert.equal(badges.length, 1);
    assert.equal(badges[0].dataset.player, '101');
    assert.equal(badges[0].previousElementSibling.getAttribute('href'), '/profiles.php?XID=101');
    assert.equal(r.doc.querySelector('.ttc-notes-toggle'), null, 'notes are written on the profile');
  });

  test('the attack page: the badge beside the heading, no editor', async () => {
    const r = run({ url: 'https://www.torn.com/page.php?sid=attack&user2ID=101', html: '<div class="content-title"><h4>Attacking</h4></div>', data: { notes: [NOTE] } });
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-notes-badge').length, 1);
    assert.equal(r.doc.querySelector('.ttc-notes-toggle'), null);
  });

  test('AC1: no lookup is made; stop removes everything', async () => {
    const r = run({ url: WAR, html: page('faction-war.html'), data: { notes: [NOTE] }, site: null });
    await wait();
    feature.stop();
    assert.equal(r.doc.querySelectorAll('.ttc-notes').length, 0);
    assert.deepEqual(r.violations, []);
  });
});
