// Wallet reminder, against saved sell forms with a synthetic money line (TRU-025, PERS-012).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { cashOnHand, reminderText } from '../../src/features/wallet-reminder/index.js';
import { page, runFeature } from '../feature-harness.js';

const BAZAAR_ADD = 'https://www.torn.com/bazaar.php#/add';
const MARKET_ADD = 'https://www.torn.com/page.php?sid=ItemMarket#/addListing';
const PROFILE = 'https://www.torn.com/profiles.php?XID=2000001';

const money = (n) => `<span id="user-money" data-money="${n}">$${n.toLocaleString('en-US')}</span>`;

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { settings: feature.defaults, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

describe('wallet reminder', () => {
  test('reads the cash from the data attribute, else the text, and nothing odd', () => {
    const r = run({ html: money(2_500_000), url: PROFILE });
    assert.equal(cashOnHand(r.doc), 2_500_000);
    r.doc.getElementById('user-money').removeAttribute('data-money');
    assert.equal(cashOnHand(r.doc), 2_500_000);
    r.doc.getElementById('user-money').textContent = 'lots';
    assert.equal(cashOnHand(r.doc), null);
    r.doc.getElementById('user-money').remove();
    assert.equal(cashOnHand(r.doc), null);
  });

  test('above the threshold on the bazaar form, one reminder above the list', () => {
    const r = run({ html: money(2_500_000) + page('bazaar-add.html'), url: BAZAAR_ADD });
    const shown = r.doc.querySelectorAll('.ttc-wallet');
    assert.equal(shown.length, 1);
    assert.equal(shown[0].querySelector('.ttc-wallet-text').textContent, reminderText(2_500_000));
    assert.match(reminderText(2_500_000), /^You're carrying \$2,500,000\. .*bank it before you list\.$/);
    assert.equal(shown[0].nextElementSibling, r.doc.querySelector('ul.items-cont'));
  });

  test('on the item market form too', () => {
    const r = run({ html: money(5_000_000) + page('market-add.html'), url: MARKET_ADD });
    assert.equal(r.doc.querySelectorAll('.ttc-wallet').length, 1);
  });

  test('below the threshold, without a money line, or off the sell forms: nothing', () => {
    assert.equal(run({ html: money(999_999) + page('bazaar-add.html'), url: BAZAAR_ADD }).doc.querySelector('.ttc-wallet'), null);
    assert.equal(run({ html: page('bazaar-add.html'), url: BAZAAR_ADD }).doc.querySelector('.ttc-wallet'), null);
    assert.equal(run({ html: money(9_000_000), url: PROFILE }).doc.querySelector('.ttc-wallet'), null);
  });

  test('follows the threshold set, and ignores an odd one', () => {
    const html = money(50_000) + page('bazaar-add.html');
    assert.ok(run({ html, url: BAZAAR_ADD, settings: { enabled: true, minCash: 10_000 } }).doc.querySelector('.ttc-wallet'));
    assert.equal(run({ html, url: BAZAAR_ADD, settings: { enabled: true, minCash: -5 } }).doc.querySelector('.ttc-wallet'), null);
  });

  test('follows the money line, goes when the cash is banked, and Not now hides it', async () => {
    const r = run({ html: money(2_500_000) + page('bazaar-add.html'), url: BAZAAR_ADD });
    const line = r.doc.getElementById('user-money');
    // Torn updates the amount and its text together; the text change is what is watched.
    const set = (n) => {
      line.setAttribute('data-money', String(n));
      line.textContent = `$${n.toLocaleString('en-US')}`;
    };
    set(3_000_000);
    await wait();
    assert.equal(r.doc.querySelector('.ttc-wallet-text').textContent, reminderText(3_000_000));
    set(0);
    await wait();
    assert.equal(r.doc.querySelector('.ttc-wallet'), null);
    set(4_000_000);
    await wait();
    r.doc.querySelector('.ttc-wallet-dismiss').dispatchEvent(new r.window.MouseEvent('click', { bubbles: true }));
    assert.equal(r.doc.querySelector('.ttc-wallet'), null);
    set(5_000_000);
    await wait();
    assert.equal(r.doc.querySelector('.ttc-wallet'), null);
  });

  test('stop takes it away', () => {
    const r = run({ html: money(2_500_000) + page('bazaar-add.html'), url: BAZAAR_ADD });
    r.stop();
    assert.equal(r.doc.querySelector('.ttc-wallet'), null);
  });
});
