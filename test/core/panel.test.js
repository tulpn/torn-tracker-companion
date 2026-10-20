// The panel module on its own, with filled-in wording where a test needs the gated parts
// (CMP-011, CMP-012, CMP-014, CMP-107). The built file's panel is covered in
// test/script.test.js.

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { mountPanel } from '../../src/core/panel.js';
import { createRegistry } from '../../src/core/registry.js';
import { defaults } from '../../src/core/settings.js';
import { DISCLOSURE } from '../../src/core/disclosure.js';
import { emptyKeys } from '../../src/core/keys.js';
import { UNWORDED, WORDED, descriptor } from '../fixtures.js';

const KEY = `tt_feed_${'C'.repeat(43)}`;
const windows = [];
after(() => windows.forEach((w) => w.close()));

const settle = () => new Promise((resolve) => setImmediate(resolve));

function mount({
  registry = createRegistry([descriptor({
    defaults: { enabled: true, sortBy: 'status', undercut: 1 },
    options: { sortBy: { label: 'Sort by', choices: ['status', 'level'] }, undercut: { label: 'Undercut ($)', min: 0 } },
  })]),
  disclosure = WORDED,
  settings = defaults(registry),
  keys = emptyKeys(),
  queue = null,
  credits = [],
  pda = false,
} = {}) {
  const { window } = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.torn.com/' });
  windows.push(window);
  if (pda) window.PDA_httpGet = () => {};
  const saves = [];
  let current = settings;
  let currentKeys = keys;
  const panel = mountPanel({
    doc: window.document,
    registry,
    version: '9.9.9',
    getSettings: () => current,
    getKeys: () => currentKeys,
    getQueue: () => queue,
    onSave: async (s, k) => {
      saves.push({ settings: s, keys: k });
      current = s;
      currentKeys = k;
      return true;
    },
    onReset: async () => {},
    onForget: async () => true,
    disclosure,
    credits,
  });
  const $ = (sel) => panel.panel.querySelector(sel);
  const click = (node) => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const change = (node, value) => {
    if (typeof value === 'boolean') node.checked = value;
    else node.value = value;
    node.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  const open = (tab) => {
    if (panel.panel.hidden) click(panel.fab);
    if (tab) click($(`button[data-tab="${tab}"]`));
  };
  return { panel, window, saves, $, click, change, open, text: () => panel.panel.textContent };
}

describe('CMP-107 the panel has a tab for each job', () => {
  test('Features, Sharing, Keys and Credits', () => {
    const t = mount();
    t.open();
    const tabs = [...t.panel.panel.querySelectorAll('[role=tab]')].map((b) => b.textContent);
    assert.deepEqual(tabs, ['Features', 'Sharing', 'Keys', 'Credits']);
    assert.equal(t.$('[aria-selected=true]').textContent, 'Features');
  });

  test('an edit survives moving between tabs and is saved with the rest', async () => {
    const t = mount();
    t.open();
    t.change(t.$('#ttc-feature-war-enhancer'), false);
    t.open('keys');
    t.change(t.$('#ttc-key-script'), KEY);
    t.open('features');
    assert.equal(t.$('#ttc-feature-war-enhancer').checked, false);
    t.click(t.$('button[data-act="save"]'));
    await settle();
    assert.equal(t.saves[0].settings.features['war-enhancer'].enabled, false);
    assert.equal(t.saves[0].keys.script, KEY);
    assert.equal(t.panel.panel.hidden, true);
  });

  test('closing without saving throws the draft away', async () => {
    const t = mount();
    t.open();
    t.change(t.$('#ttc-feature-war-enhancer'), false);
    t.click(t.$('button[data-act="close"]'));
    t.open();
    assert.equal(t.$('#ttc-feature-war-enhancer').checked, true);
  });

  test('a feature\'s described options are shown and saved with their type', async () => {
    const t = mount();
    t.open();
    const select = t.$('#ttc-opt-war-enhancer-sortBy');
    assert.equal(select.tagName, 'SELECT');
    t.change(select, 'level');
    t.change(t.$('#ttc-opt-war-enhancer-undercut'), '250');
    t.click(t.$('button[data-act="save"]'));
    await settle();
    assert.equal(t.saves[0].settings.features['war-enhancer'].sortBy, 'level');
    assert.equal(t.saves[0].settings.features['war-enhancer'].undercut, 250);
  });

  test('a feature that needs the script key says so while there is none', () => {
    const t = mount();
    t.open();
    assert.match(t.text(), /Needs your script key/);
  });
});

describe('CMP-014 sharing opens only with the owner\'s wording, and starts off', () => {
  test('without the wording, no switch is offered and the panel says why', () => {
    const t = mount({ disclosure: UNWORDED });
    t.open('sharing');
    assert.equal(t.panel.panel.querySelector('[data-share]'), null);
    assert.match(t.text(), /Nothing is shared by this version/);
  });

  test('with it, the first-run notice is shown above switches that all start off', () => {
    const t = mount();
    t.open('sharing');
    assert.equal(t.$('#ttc-first-run').textContent, WORDED.firstRun);
    assert.equal(t.$('#ttc-share-loadout').checked, false);
    assert.match(t.text(), /TEST loadout line\./);
  });

  test('"Share the kinds I picked" records agreement to this wording with the picks', async () => {
    const t = mount();
    t.open('sharing');
    t.change(t.$('#ttc-share-loadout'), true);
    t.click(t.$('button[data-act="consent"]'));
    await settle();
    assert.equal(t.saves[0].settings.shares.loadout, true);
    assert.equal(t.saves[0].settings.sharingConsent, WORDED.version);

    t.open('sharing');
    assert.equal(t.$('button[data-act="consent"]'), null, 'asked once per wording');
  });

  test('plain Save does not count as agreement', async () => {
    const t = mount();
    t.open('sharing');
    t.change(t.$('#ttc-share-loadout'), true);
    t.click(t.$('button[data-act="save"]'));
    await settle();
    assert.equal(t.saves[0].settings.sharingConsent, 0);
  });

  test('new wording asks again', () => {
    const settings = { ...defaults(createRegistry([descriptor()])), sharingConsent: WORDED.version - 1 };
    const t = mount({ settings });
    t.open('sharing');
    assert.ok(t.$('button[data-act="consent"]'));
  });

  test('the queue\'s trouble is spelled out', () => {
    const t = mount({
      queue: { queued: 3, hasKey: true, authFailed: true, retryAt: Date.now() + 60_000, blocked: { loadout: '1.4.0' }, last: null },
    });
    t.open('sharing');
    assert.match(t.text(), /did not accept your script key/);
    assert.match(t.text(), /asked the script to wait/);
    assert.match(t.text(), /Update the script to keep sharing loadouts \(1\.4\.0 or newer\)/);
    assert.match(t.text(), /3 waiting to be sent/);
  });

  test('a switch that is on without a key asks for the key', () => {
    const settings = defaults(createRegistry([descriptor()]));
    settings.shares.loadout = true;
    const t = mount({ settings, queue: { queued: 0, hasKey: false, authFailed: false, retryAt: 0, blocked: {}, last: null } });
    t.open('sharing');
    assert.match(t.text(), /Add your script key/);
  });
});

describe('CMP-011 CMP-012 the keys', () => {
  test('the script key field says it is not a Torn API key, and hides what is typed', () => {
    const t = mount();
    t.open('keys');
    assert.equal(t.$('#ttc-key-script').type, 'password');
    assert.match(t.text(), /It is not a Torn API key/);
  });

  test('a mistyped key is not saved; the panel says what is wrong', async () => {
    const t = mount();
    t.open('keys');
    t.change(t.$('#ttc-key-script'), 'abcdEFGH12345678');
    t.click(t.$('button[data-act="save"]'));
    await settle();
    assert.equal(t.saves.length, 0);
    assert.match(t.$('[role=status]').textContent, /looks like a Torn API key/);
  });

  test('without the terms table there is no Torn API key field', () => {
    const t = mount({ disclosure: UNWORDED });
    t.open('keys');
    assert.equal(t.$('#ttc-key-api'), null);
    assert.equal(t.$('#ttc-tos'), null);
  });

  test('with it, the five columns come first, then the field', () => {
    const t = mount();
    t.open('keys');
    const terms = t.$('#ttc-tos');
    const field = t.$('#ttc-key-api');
    assert.deepEqual([...terms.querySelectorAll('dt')].map((n) => n.textContent),
      ['Data storage', 'Data sharing', 'Purpose of use', 'Key storage & sharing', 'Key access level']);
    assert.ok(terms.compareDocumentPosition(field) & t.window.Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test('on Torn PDA the player may use PDA\'s own key instead', async () => {
    const t = mount({ pda: true });
    t.open('keys');
    t.change(t.$('#ttc-key-pda'), true);
    assert.equal(t.$('#ttc-key-api').disabled, true);
    t.click(t.$('button[data-act="save"]'));
    await settle();
    assert.equal(t.saves[0].keys.usePdaKey, true);
  });

  test('outside PDA that choice is not offered', () => {
    const t = mount();
    t.open('keys');
    assert.equal(t.$('#ttc-key-pda'), null);
  });
});

describe('CMP-107 credits and the version', () => {
  test('every credited script is listed with its author, licence and link', () => {
    const t = mount({
      credits: [{ name: 'Some Script', author: 'someone', licence: 'MIT', url: 'https://greasyfork.org/scripts/1', taken: 'the sort', merged: true }],
    });
    t.open('credits');
    const link = t.$('.ttc-credits a');
    assert.equal(link.textContent, 'Some Script');
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
    assert.match(t.text(), /by someone, MIT\. Code: the sort/);
  });

  test('a build with no credits says so', () => {
    const t = mount();
    t.open('credits');
    assert.match(t.text(), /no other script's code or ideas yet/);
  });

  test('the version and the update link are on every tab', () => {
    const t = mount();
    for (const tab of ['features', 'sharing', 'keys', 'credits']) {
      t.open(tab);
      assert.match(t.text(), /Version 9\.9\.9\. Check for an update/);
    }
  });
});
