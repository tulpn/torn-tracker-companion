// Add to list end to end (CMP-110, hq #391, #312): the real site client, fed the backend's
// own replies (tc-targets#360) from test/fixtures/site/lists.json, under the feature on the
// profile fixture. Each refusal is checked from the reply to what the player sees.

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import feature, { KEYS_HREF, SAY } from '../../src/features/add-to-list/index.js';
import { createCache } from '../../src/core/cache.js';
import { LISTS_URL, SPACES, createSite } from '../../src/core/site.js';
import { page, runFeature } from '../feature-harness.js';
import { ROOT } from '../helpers.js';

const REPLIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'site', 'lists.json'), 'utf8'));
const KEY = `tt_feed_${'E'.repeat(43)}`;
const PROFILE = 'https://www.torn.com/profiles.php?XID=55';
const CHAIN = REPLIES.read.data.lists[0].uuid;
const HITS = REPLIES.read.data.lists[1].uuid;

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

const running = [];
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
  delete globalThis.localStorage;
});

/** The profile with the real site client; every POST answers with the named reply. */
function profile(post) {
  const sent = [];
  const site = createSite({
    getKey: () => KEY,
    send: async (url, opts) => {
      sent.push({ url, method: opts.method });
      const reply = opts.method === 'GET' ? REPLIES.read : REPLIES[post];
      return { ok: reply.status < 300, status: reply.status, data: structuredClone(reply.data) };
    },
    cache: createCache(SPACES),
    now: () => Date.parse('2026-10-26T00:00:00Z'),
  });
  const r = runFeature(feature, { html: page('profile.html'), url: PROFILE, site });
  running.push(r);
  return { ...r, sent };
}

const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const press = (node) => node.dispatchEvent(new node.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
const items = (r) => [...r.doc.querySelectorAll('.ttc-lists-item')].map((n) => n.textContent);
const noteText = (r) => r.doc.querySelector('.ttc-lists-note')?.textContent;

/** Opens the menu and presses the list with the given uuid's entry. */
async function pressList(r, uuid) {
  press(r.doc.querySelector('.ttc-lists-arrow'));
  await wait(50);
  const at = REPLIES.read.data.lists.findIndex((l) => l.uuid === uuid);
  press(r.doc.querySelectorAll('.ttc-lists-item')[at]);
  await wait(50);
}

describe('CMP-110 end to end: the backend\'s replies to what the player sees', () => {
  test('the profile reads its menu once, and an add is one POST to the list', async () => {
    const r = profile('added');
    await wait();
    assert.equal(r.doc.querySelector('.ttc-lists-main').textContent, 'Add to Chain targets');
    press(r.doc.querySelector('.ttc-lists-main'));
    await wait(50);
    assert.deepEqual(r.sent, [
      { url: `${LISTS_URL}?player=55`, method: 'GET' },
      { url: `${LISTS_URL}/${CHAIN}/entries`, method: 'POST' },
    ]);
    assert.equal(noteText(r), 'Added to Chain targets. On 2 lists.');
    assert.deepEqual(r.violations, []);
  });

  test('403 not_your_entry: says who can take them off, and the list stays', async () => {
    const r = profile('not_your_entry');
    await wait();
    await pressList(r, HITS);
    assert.equal(noteText(r), SAY.not_your_entry);
    assert.deepEqual(items(r), ['Chain targets', '✓ Faction hits (faction)']);
  });

  for (const code of ['list_read_only', 'list_not_found']) {
    test(`${REPLIES[code].status} ${code}: the list isn't yours, and it leaves the menu`, async () => {
      const r = profile(code);
      await wait();
      await pressList(r, HITS);
      assert.equal(noteText(r), SAY.not_yours);
      assert.deepEqual(items(r), ['Chain targets']);
    });
  }

  test('400 on_ares_list: this player can\'t be added, and the menu is unchanged', async () => {
    const r = profile('on_ares_list');
    await wait();
    await pressList(r, CHAIN);
    assert.equal(noteText(r), SAY.not_allowed);
    assert.deepEqual(items(r), ['Chain targets', '✓ Faction hits (faction)']);
  });

  test('403 without the lists scope: the button becomes the keys link', async () => {
    const r = profile('no_scope');
    await wait();
    await pressList(r, CHAIN);
    const link = r.doc.querySelector('.ttc-lists-key');
    assert.equal(link?.getAttribute('href'), KEYS_HREF);
    assert.equal(r.doc.querySelector('.ttc-lists-main'), null);
    assert.equal(r.doc.querySelector('.ttc-lists-menu'), null);
  });

  test('429 on a press: busy, and nothing else changes', async () => {
    const r = profile('busy');
    await wait();
    await pressList(r, CHAIN);
    assert.equal(noteText(r), SAY.busy);
    assert.deepEqual(items(r), ['Chain targets', '✓ Faction hits (faction)']);
  });

  test('every refusal is still one POST, never a second call or a Torn request', async () => {
    for (const code of ['not_your_entry', 'list_read_only', 'list_not_found', 'on_ares_list', 'no_scope', 'busy']) {
      const r = profile(code);
      await wait();
      await pressList(r, CHAIN);
      assert.equal(r.sent.filter((s) => s.method === 'POST').length, 1, code);
      assert.ok(r.sent.every((s) => s.url.startsWith(LISTS_URL)), code);
      assert.deepEqual(r.violations, [], code);
      r.stop();
    }
  });
});
