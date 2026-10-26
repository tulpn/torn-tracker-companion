// Add to list on profiles (CMP-110, hq #391).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { KEYS_HREF, MANAGE_URL, mainAction } from '../../src/features/add-to-list/index.js';
import { runFeature } from '../feature-harness.js';

const HEADING = '<div class="content-title"><h4>Someone\'s profile</h4></div>';
const PROFILE = 'https://www.torn.com/profiles.php?XID=55';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const chain = (contains = false) => ({ uuid: A, name: 'Chain targets', shared: false, contains });
const hits = (contains = false) => ({ uuid: B, name: 'Faction hits', shared: true, contains });

/** A site with the given menu, which remembers every read and call. */
function fakeSite(menu, entry = (uuid, id, action) => ({ ok: true, state: action === 'add' ? 'on' : 'off', error: null })) {
  const reads = [];
  const calls = [];
  return {
    reads,
    calls,
    async lists(id) {
      reads.push(id);
      return typeof menu === 'function' ? menu() : menu;
    },
    async listEntry(uuid, id, action) {
      calls.push([uuid, id, action]);
      return entry(uuid, id, action);
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, opts);
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});

const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const main = (r) => r.doc.querySelector('.ttc-lists-main');
const arrow = (r) => r.doc.querySelector('.ttc-lists-arrow');
const items = (r) => [...r.doc.querySelectorAll('.ttc-lists-item')];
const press = (node) => node.dispatchEvent(new node.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));

describe('CMP-110 the split button', () => {
  test('the main part names the last-used list, and one press sends exactly one POST', async () => {
    const site = fakeSite({ status: 'ok', lists: [chain(), hits()], lastUsed: A });
    const r = run({ html: HEADING, url: PROFILE, site });
    await wait();
    assert.deepEqual(site.reads, [55]);
    assert.equal(r.doc.querySelector('h4').nextElementSibling.classList.contains('ttc-lists'), true);
    assert.equal(main(r).textContent, 'Add to Chain targets');
    press(main(r));
    await wait(50);
    assert.deepEqual(site.calls, [[A, 55, 'add']]);
    assert.deepEqual(site.reads, [55], 'AC1: no read after the press');
    assert.equal(main(r).textContent, 'On 1 list');
    assert.match(r.doc.querySelector('.ttc-lists-note').textContent, /Added to Chain targets\. On 1 list\./);
    assert.deepEqual(r.violations, []);
  });

  test('the first time, with no last-used list, the main part opens the menu', async () => {
    const site = fakeSite({ status: 'ok', lists: [chain(), hits()], lastUsed: null });
    const r = run({ html: HEADING, url: PROFILE, site });
    await wait();
    assert.equal(main(r).textContent, 'Add to a list');
    press(main(r));
    await wait(50);
    assert.deepEqual(items(r).map((n) => n.textContent), ['Chain targets', 'Faction hits (faction)']);
    assert.equal(r.doc.querySelector('.ttc-lists-manage').getAttribute('href'), MANAGE_URL);
    assert.equal(site.calls.length, 0);
  });

  test('a ticked list takes the player off; an unticked one adds them; the button counts', async () => {
    const site = fakeSite({ status: 'ok', lists: [chain(true), hits()], lastUsed: A });
    const r = run({ html: HEADING, url: PROFILE, site });
    await wait();
    assert.equal(main(r).textContent, 'On 1 list');
    press(arrow(r));
    await wait(50);
    assert.equal(items(r)[0].textContent, '✓ Chain targets');
    assert.equal(items(r)[0].getAttribute('aria-pressed'), 'true');
    press(items(r)[1]);
    await wait(50);
    assert.deepEqual(site.calls, [[B, 55, 'add']]);
    assert.equal(main(r).textContent, 'On 2 lists');
    press(items(r)[0]);
    await wait(50);
    assert.deepEqual(site.calls[1], [A, 55, 'remove']);
    assert.equal(main(r).textContent, 'On 1 list');
    assert.equal(site.reads.length, 1, 'AC1: presses never read');
  });

  test('AC2: after a change, opening the menu again reads it once', async () => {
    const site = fakeSite({ status: 'ok', lists: [chain(), hits()], lastUsed: A });
    const r = run({ html: HEADING, url: PROFILE, site });
    await wait();
    press(main(r));
    await wait(50);
    press(arrow(r));
    await wait(50);
    assert.equal(site.reads.length, 2);
    press(arrow(r));
    press(arrow(r));
    await wait(50);
    assert.equal(site.reads.length, 2, 'closing and opening again uses what was read');
  });

  test('AC3: a list that is not yours says so and leaves the menu', async () => {
    const site = fakeSite({ status: 'ok', lists: [chain(), hits()], lastUsed: null }, () => ({ ok: false, state: null, error: 'not_yours' }));
    const r = run({ html: HEADING, url: PROFILE, site });
    await wait();
    press(main(r));
    await wait(50);
    press(items(r)[1]);
    await wait(50);
    assert.equal(r.doc.querySelector('.ttc-lists-note').textContent, 'That list isn\'t yours to change.');
    assert.deepEqual(items(r).map((n) => n.textContent), ['Chain targets']);
  });

  test('without a key with the lists scope, the button links to the keys settings', async () => {
    const site = fakeSite({ status: 'no_key', lists: [], lastUsed: null });
    const r = run({ html: HEADING, url: PROFILE, site });
    await wait();
    const link = r.doc.querySelector('.ttc-lists-key');
    assert.equal(link.textContent, 'Add your script key');
    assert.equal(link.getAttribute('href'), KEYS_HREF);
    assert.equal(main(r), null);
  });

  test('Torn re-rendering the page adds no second button or read; stopping takes it away', async () => {
    const site = fakeSite({ status: 'ok', lists: [chain()], lastUsed: A });
    const r = run({ html: HEADING, url: PROFILE, site });
    await wait();
    r.doc.body.append(r.doc.createElement('div'));
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-lists-main').length, 1);
    assert.equal(site.reads.length, 1);
    feature.stop();
    assert.equal(r.doc.querySelectorAll('.ttc-lists').length, 0);
  });

  test('when the first read gets no answer, the profile looks as it did, even after Torn re-renders', async () => {
    const site = fakeSite({ status: 'failed', lists: [], lastUsed: null });
    const r = run({ html: HEADING, url: PROFILE, site });
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-lists').length, 0);
    r.doc.body.append(r.doc.createElement('div'));
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-lists').length, 0);
    assert.equal(site.reads.length, 1);
  });

  test('a busy site offers a retry, and the retry reads once', async () => {
    let status = 'busy';
    const site = fakeSite(() => ({ status, lists: status === 'ok' ? [chain()] : [], lastUsed: status === 'ok' ? A : null }));
    const r = run({ html: HEADING, url: PROFILE, site });
    await wait();
    assert.equal(main(r).textContent, 'Lists: try again');
    status = 'ok';
    press(main(r));
    await wait(50);
    assert.equal(site.reads.length, 2);
    assert.equal(main(r).textContent, 'Add to Chain targets');
  });

  test('only profiles: the attack page gets nothing', () => {
    assert.deepEqual(feature.routes, ['profiles.php']);
  });
});

describe('mainAction', () => {
  test('busy or failed reads offer a retry', () => {
    assert.equal(mainAction({ status: 'busy', lists: [], lastUsed: null }).act, 'retry');
    assert.equal(mainAction(null).text, 'Lists: try again');
  });
});
