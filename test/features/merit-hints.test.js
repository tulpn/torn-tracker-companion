// Merit hints on the merits tab (CMP-301), against the owner's capture of the tab
// (test/fixtures/pages/awards-merits.html: Torn's markup, made-up numbers).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { freeMerits, nextCost, readMerit } from '../../src/features/merit-hints/index.js';
import { page, runFeature } from '../feature-harness.js';

const URL = 'https://www.torn.com/page.php?sid=awards&tab=merits';
const HTML = page('awards-merits.html');
/** The same tab with no free merits left. */
const NONE = HTML.replace('You have <strong>2 merits</strong>', 'You have <strong>0 merits</strong>')
  .replace(/(Available Merits:<\/span><span class="violet___aGb13"> )2/, '$10');

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: URL, html: HTML, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const merit = (r, name) => r.doc.querySelector(`li[aria-label^="${name}."]`);
const hint = (r, name) => merit(r, name)?.querySelector('.ttc-merits');

describe('CMP-301 reading the tab', () => {
  test('a merit’s name and level from its own label', () => {
    assert.deepEqual(readMerit('Nerve Bar. Upgraded: 1 / 10. '), { name: 'Nerve Bar', level: 1, max: 10 });
    assert.deepEqual(readMerit('Heavy Artillery Mastery. Upgraded: 0 / 10. '), { name: 'Heavy Artillery Mastery', level: 0, max: 10 });
    assert.equal(readMerit('Nerve Bar. Upgraded: 11 / 10.'), null);
    assert.equal(readMerit('Something else'), null);
  });

  test('the free merits from "Available Merits"', () => {
    const r = run();
    assert.equal(freeMerits(r.doc.querySelector('#merits-panel')), 2);
  });

  test('a next level costs one more than the current one, as the tab says', () => {
    assert.equal(nextCost(0), 1);
    assert.equal(nextCost(9), 10);
    // The capture's levels add up to its "Merits Used" under that rule.
    const r = run();
    const used = [...r.doc.querySelectorAll('li[aria-label]')]
      .map((li) => readMerit(li.getAttribute('aria-label')).level)
      .reduce((sum, level) => sum + (level * (level + 1)) / 2, 0);
    assert.match(r.doc.querySelector('#merits-panel').textContent, new RegExp(`Merits Used: ${used}\\b`));
  });
});

describe('CMP-301 AC1 hints only with free merits', () => {
  test('every merit below its maximum gets its next cost; a maxed one gets nothing', async () => {
    const r = run();
    await wait();
    assert.equal(hint(r, 'Nerve Bar').textContent, 'next 4');
    assert.equal(hint(r, 'Nerve Bar').parentElement.className.includes('iconWrap'), true, 'pinned on the icon, taking no line');
    assert.equal(hint(r, 'Nerve Bar').dataset.tone, 'neutral', 'more than the 2 free');
    assert.equal(hint(r, 'Bank Interest').textContent, 'next 2');
    assert.equal(hint(r, 'Bank Interest').dataset.tone, 'good');
    assert.equal(hint(r, 'Stealth').textContent, 'next 1');
    assert.match(hint(r, 'Stealth').title, /can raise Stealth to level 1/);
    assert.equal(hint(r, 'Critical Hit Rate'), null);
    const below = [...r.doc.querySelectorAll('li[aria-label]')].filter((li) => !/10 \/ 10/.test(li.getAttribute('aria-label')));
    assert.equal(r.doc.querySelectorAll('li .ttc-merits').length, below.length);
  });

  test('the strip names what the free merits can raise, cheapest steps only', async () => {
    const r = run();
    await wait();
    const box = r.doc.querySelector('.ttc-merits-strip');
    assert.match(box.textContent, /You have 2 merits to spend/);
    assert.match(box.textContent, /Bank Interest \(2\)/);
    assert.match(box.textContent, /Stealth \(1\)/);
    assert.doesNotMatch(box.textContent, /Nerve Bar|Brawn/);
    assert.equal(box.nextElementSibling.className.includes('meritsList'), true, 'above the list');
  });

  test('with no free merits, nothing at all', async () => {
    const r = run({ html: NONE });
    await wait();
    assert.equal(r.doc.querySelector('.ttc-merits'), null);
  });

  test('on another awards tab, nothing', async () => {
    const r = run({ url: 'https://www.torn.com/page.php?sid=awards', html: '<div id="honors-panel"></div>' });
    await wait();
    assert.equal(r.doc.querySelector('.ttc-merits'), null);
  });
});

describe('CMP-301 AC2 AC3 it reads the page and never upgrades', () => {
  test('pressing a name in the strip scrolls to that merit and nothing else', async () => {
    const r = run();
    await wait();
    const target = merit(r, 'Stealth');
    let scrolled = null;
    target.scrollIntoView = (opts) => { scrolled = opts; };
    let rowPressed = false;
    for (const li of r.doc.querySelectorAll('li[aria-label]')) li.addEventListener('click', () => { rowPressed = true; });
    const link = [...r.doc.querySelectorAll('.ttc-merits-strip a')].find((a) => a.textContent === 'Stealth');
    link.dispatchEvent(new r.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.deepEqual(scrolled, { block: 'center', behavior: 'smooth' });
    assert.equal(rowPressed, false, 'no merit row is pressed');
    assert.equal(r.window.location.hash, '', 'and the page does not move');
  });

  test('it asks nothing of anyone', async () => {
    let asked = 0;
    const r = run();
    r.window.fetch = () => { asked += 1; return Promise.reject(new Error('no')); };
    await wait();
    assert.equal(asked, 0);
    assert.deepEqual(feature.shares, []);
    assert.equal(feature.needs.scriptKey, false);
  });

  test('switching it off takes every hint away', async () => {
    const r = run();
    await wait();
    r.stop();
    assert.equal(r.doc.querySelector('.ttc-merits'), null);
  });
});
