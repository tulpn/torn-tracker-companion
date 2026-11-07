// The OC helper, against a saved crimes tab and a stand-in for the site (CMP-204).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { roleKey, successTone } from '../../src/features/oc-helper/index.js';
import { page, runFeature } from '../feature-harness.js';

const CRIMES = 'https://www.torn.com/factions.php?step=your#/tab=crimes';

function fakeSite(answers = {
  'Pet Project': {
    roles: [
      { position_id: 'P1', label: 'Kidnapper', weight: 30.9 },
      { position_id: 'P2', label: 'Muscle', weight: 32.6 },
      { position_id: 'P3', label: 'Picklock', weight: null },
    ],
    crimes: new Map([[501, 72.5]]),
    weightsSource: 'tornprobability.com',
  },
  'Mob Mentality': { roles: [{ position_id: 'P1', label: 'Looter 1', weight: 34 }], crimes: new Map(), weightsSource: 'tornprobability.com' },
}) {
  const calls = [];
  return {
    calls,
    async oc(name) {
      calls.push(name);
      return answers[name] ?? { roles: null, crimes: new Map() };
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: CRIMES, html: page('faction-crimes.html'), ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const labels = (r, kind) => [...r.doc.querySelectorAll(`.ttc-oc[data-kind="${kind}"]`)].map((n) => n.textContent);

describe('CMP-204 weights and success from torn-tracker.com', () => {
  test('hq #557 E35: success is green only when likely, red when unlikely', () => {
    assert.equal(successTone(70), 'good');
    assert.equal(successTone(69.9), 'warn');
    assert.equal(successTone(40), 'warn');
    assert.equal(successTone(20), 'bad');
  });

  test('roles match by the title the page shows', () => {
    assert.equal(roleKey('Looter #1'), roleKey('Looter 1'));
    assert.equal(roleKey('Looter1'), roleKey('looter #1'));
    assert.notEqual(roleKey('Looter #1'), roleKey('Looter #2'));
  });

  test('one call per crime name; a weight beside each known role, the estimate beside the crime', async () => {
    const site = fakeSite();
    const r = run({ site });
    await wait();
    assert.deepEqual(site.calls, ['Pet Project', 'Mob Mentality']);
    assert.deepEqual(labels(r, 'weight'), ['30.9%', '32.6%', '34%']);
    assert.deepEqual(labels(r, 'success'), ['~72.5%']);
    assert.ok(r.doc.querySelector('[data-oc-id="501"] .ttc-oc[data-kind="success"]'));
    // hq #557 E35: the tone comes from the value; 72.5 % is green.
    assert.equal(r.doc.querySelector('.ttc-oc[data-kind="success"]').dataset.tone, 'good');
    assert.equal(r.doc.querySelector('.ttc-oc[data-kind="weight"]').dataset.tone, 'info');
    assert.deepEqual(r.violations, []);
  });

  test('a re-render does not ask again or double the labels; the name is read clean', async () => {
    const site = fakeSite();
    const r = run({ site });
    await wait();
    r.doc.querySelector('[data-oc-id="502"]').append(r.doc.createElement('i'));
    await wait();
    assert.equal(site.calls.length, 2);
    assert.equal(r.doc.querySelectorAll('.ttc-oc').length, 5, 'four labels and one credit line');
  });

  test('the weights are credited where they show (D-074): one line under the crimes (hq #557 A6), and each tooltip', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    const credits = r.doc.querySelectorAll('.ttc-oc-credit');
    assert.equal(credits.length, 1);
    assert.equal(credits[0].textContent, 'Role weights: tornprobability.com, via torn-tracker.com');
    const cards = r.doc.querySelectorAll('[data-oc-id]');
    assert.equal(credits[0].previousElementSibling, cards[cards.length - 1]);
    assert.ok([...r.doc.querySelectorAll('.ttc-oc[data-kind="weight"]')].every((n) => n.title.includes('tornprobability.com')));
  });

  test('no answer: no labels, no guess', async () => {
    const r = run({ site: fakeSite({}) });
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-oc').length, 0);
  });

  test('stopping takes the labels off', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    feature.stop();
    assert.equal(r.doc.querySelectorAll('.ttc-oc').length, 0);
  });
});

describe('hq #522 the figures are compact badges beside the slot', () => {
  const press = (node) => node.dispatchEvent(new node.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  const badges = (r) => [...r.doc.querySelectorAll('.ttc-oc[data-kind="weight"], .ttc-oc[data-kind="success"]')];

  test('each is a compact badge: one short line, the figure only', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    assert.equal(badges(r).length, 4);
    for (const n of badges(r)) {
      assert.ok(n.classList.contains('ttc-ui-compact'), n.className);
      assert.equal(n.tagName, 'SPAN', "Torn's slot header is a button; buttons don't nest");
      assert.match(n.textContent, /^~?\d+(\.\d)?%$/);
    }
    const css = r.doc.getElementById('ttc-ui-style').textContent;
    const rule = css.slice(css.indexOf('.ttc-ui-compact.ttc-ui-compact {'));
    const body = rule.slice(0, rule.indexOf('}'));
    assert.match(body, /white-space: nowrap/);
    assert.match(body, /font: 600 12px\/16px/);
    assert.match(body, /height: 16px/);
  });

  test('the detail is in the title, and a tap opens it under the badge', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    const n = r.doc.querySelector('.ttc-oc[data-kind="weight"]');
    assert.match(n.title, /counts towards success/);
    assert.equal(n.dataset.detail, n.title);
    assert.ok(n.closest('[class*="slotHeader___"]'), 'beside the role, in the slot header');
    assert.equal(n.dataset.open, 'false');
    let reached = 0;
    n.parentElement.addEventListener('click', () => { reached += 1; });
    press(n);
    assert.equal(n.dataset.open, 'true');
    press(n);
    assert.equal(n.dataset.open, 'false');
    assert.equal(reached, 0, "the tap never reaches Torn's handlers on the slot");
    const css = r.doc.getElementById('ttc-ui-style').textContent;
    assert.match(css, /\.ttc-ui-compact\.ttc-ui-compact\[data-open="true"\]::after \{\s*content: attr\(data-detail\)/);
  });

  test('a repaint keeps one badge per slot and the tap state', async () => {
    const r = run({ site: fakeSite() });
    await wait();
    const n = r.doc.querySelector('.ttc-oc[data-kind="weight"]');
    press(n);
    await wait();
    assert.equal(badges(r).length, 4);
    assert.equal(n.dataset.open, 'true');
  });
});
