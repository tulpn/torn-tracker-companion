import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { el, onMutation, readDuration, readInt, readMoney, resetObserver, waitFor } from '../../src/core/dom.js';

function page(html = '') {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: 'https://www.torn.com/',
  });
  return dom.window.document;
}

afterEach(resetObserver);

describe('CMP-006 waitFor finds nodes Torn adds after load', () => {
  test('it resolves straight away when the node is there', async () => {
    const doc = page('<div id="here"></div>');
    const node = await waitFor('#here', { root: doc });
    assert.equal(node.id, 'here');
  });

  test('it resolves when the node appears', async () => {
    const doc = page();
    const pending = waitFor('#later', { root: doc, timeout: 2000 });
    doc.body.appendChild(el('div', { id: 'later', ownerDocument: doc }));
    assert.equal((await pending).id, 'later');
  });

  test('it gives up with null rather than hang', async () => {
    const doc = page();
    assert.equal(await waitFor('#never', { root: doc, timeout: 20 }), null);
  });

  test('one observer serves every subscriber', async () => {
    const doc = page();
    const seen = [];
    const off1 = onMutation(() => seen.push('a'), doc);
    const off2 = onMutation(() => seen.push('b'), doc);
    doc.body.appendChild(doc.createElement('div'));
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual([...new Set(seen)].sort(), ['a', 'b']);
    off1();
    off2();
  });

  test('a subscriber that throws does not silence the others', async () => {
    const doc = page();
    const seen = [];
    const off1 = onMutation(() => {
      throw new Error('bad subscriber');
    }, doc);
    const off2 = onMutation(() => seen.push('b'), doc);
    doc.body.appendChild(doc.createElement('div'));
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(seen, ['b']);
    off1();
    off2();
  });
});

describe('CMP-006 our nodes are built, never parsed', () => {
  test('text children become text, not markup', () => {
    const doc = page();
    const node = el('span', { class: 'ttc-badge', ownerDocument: doc }, '<b>7.5</b>');
    assert.equal(node.children.length, 0);
    assert.equal(node.textContent, '<b>7.5</b>');
    assert.equal(node.className, 'ttc-badge');
  });

  test('element children are appended as nodes', () => {
    const doc = page();
    const child = el('i', { ownerDocument: doc }, 'x');
    const node = el('div', { ownerDocument: doc }, child, null, false, 7);
    assert.equal(node.children.length, 1);
    assert.equal(node.textContent, 'x7');
  });

  test('checked and hidden are set as properties', () => {
    const doc = page();
    const box = el('input', { type: 'checkbox', checked: true, ownerDocument: doc });
    assert.equal(box.checked, true);
    assert.equal(el('div', { hidden: true, ownerDocument: doc }).hidden, true);
  });

  test('the source has no innerHTML anywhere', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/core/dom.js', import.meta.url), 'utf8');
    assert.ok(!/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML\(|document\.write\(/.test(source));
  });
});

describe('CMP-006 text readers return null rather than guess', () => {
  test('readInt', () => {
    assert.equal(readInt('1,234'), 1234);
    assert.equal(readInt(' 42 '), 42);
    assert.equal(readInt('-7'), -7);
    assert.equal(readInt('Level 5'), null);
    assert.equal(readInt('1.5'), null);
    assert.equal(readInt(''), null);
    assert.equal(readInt(null), null);
  });

  test('readMoney', () => {
    assert.equal(readMoney('$1,234'), 1234);
    assert.equal(readMoney('1234'), 1234);
    assert.equal(readMoney('$2.5m'), 2_500_000);
    assert.equal(readMoney('3k'), 3000);
    assert.equal(readMoney('1.25b'), 1_250_000_000);
    assert.equal(readMoney('free'), null);
    assert.equal(readMoney('$'), null);
    assert.equal(readMoney(undefined), null);
  });

  test('readDuration', () => {
    assert.equal(readDuration('45s'), 45);
    assert.equal(readDuration('1h 23m'), 4980);
    assert.equal(readDuration('2d 1h 1m 1s'), 176_461);
    assert.equal(readDuration('23:45'), 1425);
    assert.equal(readDuration('01:02:03'), 3723);
    assert.equal(readDuration('soon'), null);
    assert.equal(readDuration('1h and a bit'), null);
    assert.equal(readDuration(''), null);
  });
});

describe('ownChange: our own re-renders are ours', () => {
  test('inside our node, adding ours, and removing ours (whose ancestors are gone) all count', async () => {
    const { JSDOM: J } = await import('jsdom');
    const { window } = new J('<div id="torn"><div class="ttc-x"><span>old</span></div></div>');
    const { ownChange } = await import('../../src/core/dom.js');
    const records = [];
    const watch = new window.MutationObserver((rs) => records.push(...rs));
    watch.observe(window.document.body, { childList: true, subtree: true });
    const box = window.document.querySelector('.ttc-x');
    box.replaceChildren(window.document.createElement('b')); // a re-render of ours
    const mine = window.document.createElement('i');
    mine.className = 'ttc-x';
    window.document.getElementById('torn').append(mine); // ours added to Torn's node
    window.document.getElementById('torn').append(window.document.createElement('p')); // Torn's own
    await new Promise((r) => setTimeout(r, 0));
    watch.disconnect();
    assert.deepEqual(records.map((r) => ownChange(r, '.ttc-x')), [true, true, false]);
  });
});
