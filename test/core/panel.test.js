// The panel module on its own, with filled-in wording where a test needs the gated parts
// (CMP-011, CMP-012, CMP-014, CMP-107). The built file's panel is covered in
// test/script.test.js.

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { exportText, importText, mountPanel } from '../../src/core/panel.js';
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
  tours = undefined,
  unlocks = undefined,
} = {}) {
  const { window } = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.torn.com/' });
  windows.push(window);
  if (pda) window.PDA_httpGet = () => {};
  const saves = [];
  let current = settings;
  let currentKeys = keys;
  // The page lives in a Shadow DOM host, as core/page.js mounts it.
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const panel = mountPanel({
    doc: window.document,
    root,
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
    tours,
    unlocks,
  });
  const $ = (sel) => panel.panel.querySelector(sel);
  const click = (node) => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const change = (node, value) => {
    if (typeof value === 'boolean') node.checked = value;
    else node.value = value;
    node.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  // What the router does: arriving on #/torn-tracker, or on #/torn-tracker/<tab>.
  const open = (tab) => panel.open(tab ?? '');
  return { panel, root, window, saves, $, click, change, open, text: () => panel.panel.textContent };
}

describe('CMP-107 the settings page has a section for each job', () => {
  test('General, Features, Sidebar, Chain watch, Sharing, Keys, Data, Credits and Help, starting on Features', () => {
    const t = mount();
    t.open();
    const tabs = [...t.panel.panel.querySelectorAll('[role=tab]')].map((b) => b.textContent);
    assert.deepEqual(tabs, ['General', 'Features', 'Sidebar', 'Chain watch', 'Sharing', 'Keys', 'Data', 'Credits', 'Help']);
    assert.equal(t.$('[aria-selected=true]').textContent, 'Features');
  });

  test('each section is a plain link to its own route, so Back and Forward work', () => {
    const t = mount();
    t.open();
    const hrefs = [...t.panel.panel.querySelectorAll('[role=tab]')].map((a) => [a.tagName, a.getAttribute('href')]);
    assert.ok(hrefs.every(([tag]) => tag === 'A'));
    assert.deepEqual(hrefs.map(([, href]) => href).slice(0, 2), ['#/torn-tracker/general', '#/torn-tracker/features']);
  });

  test('AC5: a named section opens on it, an unknown one opens General, none keeps the last', () => {
    const t = mount();
    t.open('sharing');
    assert.equal(t.$('[aria-selected=true]').textContent, 'Sharing');
    t.open('nonsense');
    assert.equal(t.$('[aria-selected=true]').textContent, 'General');
    t.open('keys');
    t.panel.close();
    t.open();
    assert.equal(t.$('[aria-selected=true]').textContent, 'Keys');
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
    assert.equal(t.$('[role=status]').textContent, 'Saved.');
  });

  test('leaving the route without saving throws the draft away', async () => {
    const t = mount();
    t.open();
    t.change(t.$('#ttc-feature-war-enhancer'), false);
    t.panel.close();
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

  test('without a script key: one banner that leads to Keys, and each card that needs it is marked', () => {
    const t = mount();
    t.open();
    assert.match(t.text(), /Add your script key to see torn-tracker\.com data/);
    assert.equal(t.$('[data-card="war-enhancer"]').dataset.needsKey, 'true');
    assert.equal(t.$('.ttc-keyhint a').getAttribute('href'), '#/torn-tracker/keys');
  });

  test('with a script key: no banner', () => {
    const t = mount({ keys: { ...emptyKeys(), script: KEY } });
    t.open();
    assert.equal(t.$('.ttc-keyhint'), null);
  });

  test('a choice shows its name, not its value', () => {
    const t = mount({
      registry: createRegistry([descriptor({
        defaults: { enabled: true, sortBy: 'torn' },
        options: { sortBy: { label: 'Sort by', choices: ['torn', 'level'], labels: { torn: "Torn's order", level: 'Level' } } },
      })]),
    });
    t.open();
    assert.deepEqual([...t.$('#ttc-opt-war-enhancer-sortBy').options].map((o) => [o.value, o.textContent]), [['torn', "Torn's order"], ['level', 'Level']]);
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

  test('"Share the kinds I picked" records agreement to a changed wording with the picks', async () => {
    const t = mount({ settings: { ...defaults(createRegistry([descriptor()])), sharingConsent: WORDED.version - 1 } });
    t.open('sharing');
    t.change(t.$('#ttc-share-loadout'), true);
    t.click(t.$('button[data-act="consent"]'));
    await settle();
    assert.equal(t.saves[0].settings.shares.loadout, true);
    assert.equal(t.saves[0].settings.sharingConsent, WORDED.version);

    t.open('sharing');
    assert.equal(t.$('button[data-act="consent"]'), null, 'asked once per wording');
  });

  test('hq #454: the first Save with a kind ticked is the agreement, and the tab says so', async () => {
    const t = mount();
    t.open('sharing');
    assert.equal(t.$('button[data-act="consent"]'), null, 'no separate button before any agreement');
    assert.match(t.$('#ttc-consent-state').textContent, /Nothing is shared yet.*press Save/);
    t.change(t.$('#ttc-share-loadout'), true);
    t.click(t.$('button[data-act="save"]'));
    await settle();
    assert.equal(t.saves[0].settings.shares.loadout, true);
    assert.equal(t.saves[0].settings.sharingConsent, WORDED.version);
    assert.match(t.text(), /Saved\. Sharing is on for the kinds you ticked\./);
    assert.equal(t.$('#ttc-consent-state').textContent, 'Sharing is on for the kinds ticked above.');
  });

  test('Save with no kind ticked agrees to nothing', async () => {
    const t = mount();
    t.open('sharing');
    t.click(t.$('button[data-act="save"]'));
    await settle();
    assert.equal(t.saves[0].settings.sharingConsent, 0);
    assert.match(t.$('#ttc-consent-state').textContent, /Nothing is shared yet/);
  });

  test('a kind ticked earlier without agreement: the next Save records it', async () => {
    const settings = defaults(createRegistry([descriptor()]));
    settings.shares.loadout = true;
    const t = mount({ settings });
    t.open('features');
    t.click(t.$('button[data-act="save"]'));
    await settle();
    assert.equal(t.saves[0].settings.sharingConsent, WORDED.version);
  });

  test('new wording asks again, with its own button; plain Save keeps the old agreement', async () => {
    const settings = { ...defaults(createRegistry([descriptor()])), sharingConsent: WORDED.version - 1 };
    settings.shares.loadout = true;
    const t = mount({ settings });
    t.open('sharing');
    assert.ok(t.$('button[data-act="consent"]'));
    assert.match(t.$('#ttc-consent-state').textContent, /worded differently.*nothing is shared/);
    t.click(t.$('button[data-act="save"]'));
    await settle();
    assert.equal(t.saves[0].settings.sharingConsent, WORDED.version - 1);
    assert.ok(t.$('button[data-act="consent"]'), 'still asked');
    t.click(t.$('button[data-act="consent"]'));
    await settle();
    assert.equal(t.saves[1].settings.sharingConsent, WORDED.version);
  });

  test('the queue\'s trouble is spelled out', () => {
    const t = mount({
      queue: { queued: 3, hasKey: true, authFailed: true, retryAt: Date.now() + 60_000, blocked: { loadout: '1.4.0' }, last: null },
    });
    t.open('sharing');
    assert.match(t.text(), /did not accept your script key/);
    assert.match(t.text(), /asked the script to wait/);
    assert.match(t.text(), /Update the script to keep sharing loadouts \(1\.4\.0 or newer\)/);
    assert.match(t.text(), /Queue: 3 waiting · last upload none yet · last answer —/);
  });

  test('hq #454: the queue line shows waiting, the last upload and the last answer, live', () => {
    const queue = {
      queued: 2, hasKey: true, authFailed: false, retryAt: 0, blocked: {},
      last: { outcome: 'sent', at: Date.now() - 125_000, accepted: 5, status: 200 },
    };
    const t = mount({ queue });
    t.open('sharing');
    assert.equal(t.$('#ttc-queue-line').textContent, 'Queue: 2 waiting · last upload 2m ago (5 accepted) · last answer 200');
    // A flush answered 429: updateQueue redraws the line without touching the draft.
    t.change(t.$('#ttc-share-loadout'), true);
    Object.assign(queue, { queued: 0, retryAt: Date.now() + 60_000, last: { outcome: 'slowed down', at: Date.now() - 1000, accepted: 0, status: 429 } });
    t.panel.updateQueue();
    assert.equal(t.$('#ttc-queue-line').textContent, 'Queue: 0 waiting · last upload just now · last answer 429');
    assert.equal(t.$('#ttc-share-loadout').checked, true);
    // No answer at all: the outcome stands in for the status.
    Object.assign(queue, { last: { outcome: 'unreachable', at: Date.now() - 3_600_000, accepted: 0, status: 0 } });
    t.panel.updateQueue();
    assert.match(t.$('#ttc-queue-line').textContent, /last upload 1h ago · last answer unreachable$/);
  });

  test('ADM-068 Q-ADM-5 a banned account sees the neutral notice, with no reason', () => {
    const t = mount({ queue: { queued: 0, hasKey: true, authFailed: true, banned: true, retryAt: 0, blocked: {}, last: null } });
    t.open('sharing');
    const notice = t.$('.ttc-banned');
    assert.equal(notice.hidden, false);
    assert.equal(notice.getAttribute('role'), 'alert');
    assert.match(notice.textContent, /This account can't use torn-tracker\.com\./);
    assert.match(notice.textContent, /If you think this is a mistake/);
    assert.match(t.text(), /Sharing is off for this account/);
    assert.doesNotMatch(t.text(), /did not accept your script key/);
  });

  test('no notice for an account that is not banned', () => {
    const t = mount({ queue: { queued: 0, hasKey: true, authFailed: true, retryAt: 0, blocked: {}, last: null } });
    t.open('sharing');
    assert.equal(t.$('.ttc-banned').hidden, true);
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
    assert.match(t.text(), /also needs the key’s lists scope/);
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

  test('the version and the update link are under General', () => {
    const t = mount();
    t.open('general');
    assert.match(t.text(), /version 9\.9\.9\./);
    assert.match(t.text(), /Check for an update/);
  });
});

describe('CMP-107 the settings page, as reworked on the owner\u2019s review', () => {
  const two = () => createRegistry([
    descriptor(),
    descriptor({ id: 'gym-thing', title: 'Gym thing', area: 'gym', guide: 'gym-progress', summary: 'Shows gym progress.', shares: [] }),
  ]);

  test('features are grouped by area, each with its line and a Learn more link to its page', () => {
    const t = mount({ registry: two() });
    t.open('features');
    assert.deepEqual([...t.panel.panel.querySelectorAll('main h4')].map((n) => n.textContent), ['War and attacks', 'Gym']);
    const learn = t.$('[data-card="gym-thing"] a');
    assert.equal(learn.textContent, 'Learn more');
    assert.equal(learn.getAttribute('href'), 'https://torn-tracker.com/guide/companion/gym-progress/');
    assert.match(t.$('[data-card="gym-thing"]').textContent, /Shows gym progress\./);
  });

  test('search finds a setting in any section, and a switch found there is saved like any other', async () => {
    const t = mount({ registry: two() });
    t.open('general');
    const search = t.$('#ttc-search');
    search.value = 'gym';
    search.dispatchEvent(new t.window.Event('input', { bubbles: true }));
    assert.ok(t.$('[data-card="gym-thing"]'));
    assert.equal(t.$('[data-card="war-enhancer"]'), null);
    t.change(t.$('#ttc-feature-gym-thing'), false);
    t.click(t.$('button[data-act="save"]'));
    await settle();
    assert.equal(t.saves[0].settings.features['gym-thing'].enabled, false);
  });

  test('a search that matches nothing says so', () => {
    const t = mount();
    t.open();
    const search = t.$('#ttc-search');
    search.value = 'zzzz';
    search.dispatchEvent(new t.window.Event('input', { bubbles: true }));
    assert.match(t.text(), /Nothing matches/);
  });

  test('both Close links lead back to Torn\u2019s home page, without saving', () => {
    const t = mount();
    t.open();
    const closes = [...t.panel.panel.querySelectorAll('[data-act="close"]')];
    assert.equal(closes.length, 2);
    assert.ok(closes.every((a) => a.tagName === 'A' && a.getAttribute('href') === '#'));
    assert.equal(t.saves.length, 0);
  });

  test('it is a page, not an overlay: it lives in its root and leaves Torn\u2019s page alone', () => {
    const t = mount();
    t.open();
    assert.equal(t.panel.panel.parentNode, t.root);
    assert.ok(t.root.querySelector('#ttc-style'), 'its styles stay inside the Shadow DOM');
    assert.equal(t.window.document.head.querySelector('#ttc-style'), null);
    assert.equal(t.window.document.body.style.overflow, '');
    assert.doesNotMatch(t.root.querySelector('#ttc-style').textContent, /position: fixed/);
  });

  test('its look is dark by default, even on Torn\u2019s light theme (WP-UI-8)', () => {
    const t = mount();
    t.open();
    assert.equal(t.panel.panel.dataset.theme, 'dark');
  });

  test('set to Torn\u2019s look, it follows Torn\u2019s theme', () => {
    const t = mount({ settings: { ...defaults(createRegistry([descriptor()])), look: 'torn' } });
    t.open();
    assert.equal(t.panel.panel.dataset.theme, 'light');
    t.window.document.body.classList.add('dark-mode');
    t.panel.close();
    t.open();
    assert.equal(t.panel.panel.dataset.theme, 'dark');
  });

  test('a new look shows at once, is kept by Save, and Close without Save puts it back', () => {
    const t = mount();
    t.open('general');
    t.change(t.$('#ttc-look'), 'light');
    assert.equal(t.panel.panel.dataset.theme, 'light');
    t.panel.close();
    t.open('general');
    assert.equal(t.panel.panel.dataset.theme, 'dark');
    assert.equal(t.$('#ttc-look').value, 'dark');
    t.change(t.$('#ttc-look'), 'light');
    t.click(t.$('button[data-act="save"]'));
    assert.equal(t.saves.at(-1).settings.look, 'light');
  });

  test('its colours are the suite\u2019s tokens, for both themes, inside its Shadow DOM', () => {
    const t = mount();
    t.open();
    const css = t.root.querySelector('#ttc-style').textContent;
    assert.match(css, /#ttc-panel \{\s*--accent: /);
    assert.match(css, /#ttc-panel\[data-theme="light"\] \{ --accent: /);
  });

  test('Forget me lives under Data, and asks before clearing', async () => {
    const t = mount();
    t.open('data');
    assert.match(t.text(), /stored only on this device/);
    t.click(t.$('button[data-act="forget"]'));
    assert.equal(t.$('button[data-act="forget"]').textContent, 'Really forget everything?');
  });

  test('notes and templates export as text and import back, each kind checked by its feature', async () => {
    const notes = descriptor({ id: 'notes', title: 'Player notes', data: { empty: { notes: [] }, validate: (v) => ({ notes: Array.isArray(v?.notes) ? v.notes.filter(Number.isInteger) : [] }) } });
    const registry = createRegistry([notes]);
    const t = mount({ registry, settings: { ...defaults(registry), featureData: { notes: { notes: [1, 2] } } } });
    t.open('data');
    assert.match(t.text(), /Your player notes as text/);
    t.click(t.$('button[data-act="export"]'));
    await settle();
    const text = t.$('#ttc-transfer').value;
    assert.deepEqual(JSON.parse(text), { kind: 'ttc-feature-data', version: 1, data: { notes: { notes: [1, 2] } } });

    t.$('#ttc-transfer').value = JSON.stringify({ kind: 'ttc-feature-data', version: 1, data: { notes: { notes: [3, 'x'] }, other: {} } });
    t.click(t.$('button[data-act="import"]'));
    await settle();
    assert.deepEqual(t.saves.at(-1).settings.featureData.notes, { notes: [3] });
    assert.match(t.text(), /Imported: Player notes\./);

    t.$('#ttc-transfer').value = '{"not":"ours"}';
    t.click(t.$('button[data-act="import"]'));
    await settle();
    assert.equal(t.saves.length, 1, 'text that is not an export saves nothing');
    assert.match(t.text(), /isn’t an export from the companion/);
  });

  test('the import text is checked before anything is read from it', () => {
    const registry = createRegistry([descriptor({ id: 'n', data: { empty: { a: [] }, validate: () => ({ a: [] }) } })]);
    assert.equal(importText(registry, 'not json'), null);
    assert.equal(importText(registry, JSON.stringify({ kind: 'ttc-feature-data', version: 2, data: { n: {} } })), null);
    assert.equal(importText(registry, JSON.stringify({ kind: 'ttc-feature-data', version: 1, data: { unknown: {} } })), null);
    assert.equal(importText(registry, 'x'.repeat(500_001)), null);
    assert.deepEqual(importText(registry, exportText(registry, { featureData: {} })), { n: { a: [] } });
  });

  test('Help links to the companion guide and to support', () => {
    const t = mount();
    t.open('help');
    const hrefs = [...t.panel.panel.querySelectorAll('main a')].map((a) => a.getAttribute('href'));
    assert.ok(hrefs.includes('https://torn-tracker.com/guide/companion/'));
    assert.ok(hrefs.some((h) => h.endsWith('/issues')));
  });

  test('opening it makes no request (AC5)', () => {
    const t = mount();
    let asked = 0;
    t.window.fetch = () => { asked += 1; return Promise.reject(new Error('no')); };
    t.open();
    for (const [id] of [['general'], ['features'], ['sidebar'], ['sharing'], ['keys'], ['data'], ['credits'], ['help']]) t.open(id);
    assert.equal(asked, 0);
  });
});

describe('CMP-108 Settings \u2192 Sidebar', () => {
  test('a master switch and one switch per item, with the spec\u2019s defaults', () => {
    const t = mount();
    t.open('sidebar');
    assert.equal(t.$('#ttc-sidebar-enabled').checked, true);
    const on = [...t.panel.panel.querySelectorAll('[data-sidebar]')]
      .filter((n) => n.dataset.sidebar !== 'enabled' && n.checked).map((n) => n.dataset.sidebar);
    assert.deepEqual(on, ['chain', 'watch', 'war', 'terms', 'partner', 'dibs', 'oc', 'guide', 'shops', 'links']);
    for (const off of ['travel', 'loot', 'gym', 'stocks']) assert.equal(t.$(`#ttc-sidebar-${off}`).checked, false, off);
    assert.match(t.text(), /Core \(free\)/);
  });

  test('switches are saved with the rest, and the master switch greys the items out', async () => {
    const t = mount();
    t.open('sidebar');
    t.change(t.$('#ttc-sidebar-gym'), true);
    t.change(t.$('#ttc-sidebar-chain'), false);
    t.change(t.$('#ttc-sidebar-enabled'), false);
    assert.equal(t.$('#ttc-sidebar-war').disabled, true);
    t.click(t.$('button[data-act="save"]'));
    await settle();
    const saved = t.saves[0].settings.sidebar;
    assert.equal(saved.enabled, false);
    assert.equal(saved.items.gym, true);
    assert.equal(saved.items.chain, false);
  });

  test('search finds a sidebar item', () => {
    const t = mount();
    t.open('general');
    const search = t.$('#ttc-search');
    search.value = 'med-out';
    search.dispatchEvent(new t.window.Event('input', { bubbles: true }));
    assert.ok(t.$('#ttc-sidebar-partner'));
  });
});

describe('WP-UX-4 tours from the settings page (UXT-022)', () => {
  function fakeTours() {
    const calls = [];
    let done = false;
    return {
      calls,
      finish: () => { done = true; },
      list: () => [
        { id: 'settings', title: 'The settings page', href: null, done },
        { id: 'war-page', title: 'The ranked-war page', href: 'https://www.torn.com/factions.php?step=your#/war/rank', done: false },
      ],
      auto: (id, opts) => calls.push(['auto', id, opts]),
      start: (id, opts) => calls.push(['start', id, opts]),
      request: (id) => calls.push(['request', id]),
      stop: () => calls.push(['stop']),
      onChange(fn) { this.changed = fn; return () => {}; },
    };
  }

  test('the first time it opens, it offers its own tour, with its anchors and its look', () => {
    const tours = fakeTours();
    const t = mount({ tours });
    t.open();
    const [act, id, opts] = tours.calls[0];
    assert.deepEqual([act, id], ['auto', 'settings']);
    assert.equal(opts.roots[0], t.root);
    assert.equal(opts.theme, 'dark');
  });

  test('"?" in the header shows this page’s tour again', () => {
    const tours = fakeTours();
    const t = mount({ tours });
    t.open();
    const help = t.$('[data-tour="companion-tour-button"]');
    assert.equal(help.getAttribute('aria-label'), 'Show me around this page');
    t.click(help);
    assert.deepEqual(tours.calls.at(-1).slice(0, 2), ['start', 'settings']);
  });

  test('Help → Tours lists every tour with done or not; another page’s tour is a plain link, noted first', () => {
    const tours = fakeTours();
    const t = mount({ tours });
    t.open('help');
    const box = t.$('#ttc-tours');
    assert.match(box.textContent, /Show me the settings page\s*Not done yet/);
    const link = box.querySelector('a[data-tour-page="war-page"]');
    assert.equal(link.getAttribute('href'), 'https://www.torn.com/factions.php?step=your#/war/rank');
    t.click(link);
    assert.deepEqual(tours.calls.at(-1), ['request', 'war-page']);
    tours.finish();
    tours.changed();
    assert.match(t.$('#ttc-tours').textContent, /Show me the settings page\s*Done/);
  });

  test('closing the page ends its tour; the sections and Save carry anchors', () => {
    const tours = fakeTours();
    const t = mount({ tours });
    t.open();
    for (const anchor of ['companion-settings', 'companion-sections', 'companion-keys-tab', 'companion-sharing-tab', 'companion-save']) {
      assert.ok(t.root.querySelector(`[data-tour="${anchor}"]`), anchor);
    }
    t.panel.close();
    assert.deepEqual(tours.calls.at(-1), ['stop']);
  });

  test('without tours there is no "?" and no Tours list', () => {
    const t = mount();
    t.open('help');
    assert.equal(t.$('[data-tour="companion-tour-button"]'), null);
    assert.equal(t.$('#ttc-tours'), null);
  });
});

describe('hq #489 the search bar, the header, and no stray null', () => {
  const two = () => createRegistry([
    descriptor(),
    descriptor({ id: 'gym-thing', title: 'Gym thing', area: 'gym', guide: 'gym-progress', summary: 'Shows gym progress.', shares: [] }),
  ]);
  /** Every text node, empty paragraph and empty muted line under main. */
  function strays(t) {
    const main = t.$('main');
    const walker = t.window.document.createTreeWalker(main, t.window.NodeFilter.SHOW_TEXT);
    const bad = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (/\b(null|undefined)\b/.test(n.textContent)) bad.push(`text: ${n.textContent.trim().slice(0, 60)}`);
    }
    for (const p of main.querySelectorAll('p, .ttc-muted')) {
      if (!p.textContent.trim() && !p.children.length) bad.push(`empty ${p.tagName.toLowerCase()}.${p.className}`);
    }
    return bad;
  }
  const SECTIONS = ['general', 'features', 'sidebar', 'watch', 'sharing', 'keys', 'data', 'credits', 'help'];

  for (const silenced of [true, false]) {
    test(`no section writes null, undefined or an empty line (site toasts ${silenced ? 'silenced' : 'on'})`, () => {
      const t = mount({ unlocks: { featured: () => [], silenced: () => silenced, onChange: () => () => {} } });
      for (const id of SECTIONS) {
        t.open(id);
        assert.deepEqual(strays(t), [], id);
      }
      for (const q of ['gym', 'key', 'zzzz']) {
        const search = t.$('#ttc-search');
        search.value = q;
        search.dispatchEvent(new t.window.Event('input', { bubbles: true }));
        assert.deepEqual(strays(t), [], `search ${q}`);
      }
    });
  }

  test('no section writes null with no achievements module at all', () => {
    const t = mount();
    for (const id of SECTIONS) {
      t.open(id);
      assert.deepEqual(strays(t), [], id);
    }
  });

  test('the header holds the title, the version and the key state, and no achievements', async () => {
    const t = mount({ unlocks: { featured: () => [{ id: 'a', name: 'Chain tracker', tier: 'gold' }], silenced: () => false, onChange: () => () => {} } });
    t.open('general');
    assert.equal(t.$('.ttc-featured'), null);
    assert.doesNotMatch(t.$('.ttc-head').textContent, /Chain tracker/);
    assert.match(t.$('.ttc-head').textContent, /9\.9\.9/);
    assert.equal(t.$('.ttc-keystate').textContent, 'No script key');
    assert.equal(t.$('.ttc-keystate').dataset.key, 'none');
    assert.equal(t.$('.ttc-head #ttc-search'), null);

    const k = mount({ keys: { ...emptyKeys(), script: KEY } });
    k.open('general');
    assert.equal(k.$('.ttc-keystate').textContent, 'Script key saved');
    assert.equal(k.$('.ttc-keystate').dataset.key, 'set');
    assert.doesNotMatch(k.$('.ttc-head').textContent, /tt_feed_/);
  });

  test('the search bar comes first, under the header, and the clear button empties it', () => {
    const t = mount({ registry: two() });
    t.open('features');
    const find = t.$('.ttc-find');
    assert.equal(find.getAttribute('role'), 'search');
    assert.equal(find.previousElementSibling.classList.contains('ttc-head'), true);
    const search = find.querySelector('#ttc-search');
    const clear = find.querySelector('[data-act="clear-search"]');
    assert.equal(clear.getAttribute('aria-label'), 'Clear the search');
    assert.equal(clear.hidden, true);
    search.value = 'gym';
    search.dispatchEvent(new t.window.Event('input', { bubbles: true }));
    assert.equal(clear.hidden, false);
    assert.equal(t.$('[data-card="war-enhancer"]'), null);
    t.click(clear);
    assert.equal(search.value, '');
    assert.equal(clear.hidden, true);
    assert.ok(t.$('[data-card="war-enhancer"]'));
    assert.equal(t.window.document.activeElement === search || t.root.activeElement === search, true);
  });
});

describe('hq #507 Settings \u2192 General: where the sidebar block sits', () => {
  test('a select with the four places, Top chosen on a fresh install, and no note', () => {
    const t = mount();
    t.open('general');
    const select = t.$('#ttc-sidebar-position');
    assert.ok(select);
    assert.deepEqual([...select.options].map((o) => o.value), ['top', 'areas', 'lists', 'bottom']);
    assert.equal(select.value, 'top');
    assert.equal(t.$('[data-sidebar-moved]'), null);
    assert.match(t.text(), /On this device/);
  });

  test('an install that was moved says so until the player saves', async () => {
    const settings = defaults(createRegistry([]));
    settings.sidebar.moved = true;
    const t = mount({ registry: createRegistry([]), settings });
    t.open('general');
    assert.match(t.$('[data-sidebar-moved]').textContent, /moved to the top of Torn.s sidebar in 0\.9\.8/);
    t.change(t.$('#ttc-sidebar-position'), 'lists');
    t.click(t.$('button[data-act="save"]'));
    await settle();
    const saved = t.saves[0].settings.sidebar;
    assert.equal(saved.position, 'lists');
    assert.equal(saved.moved, false);
  });

  test('a value that is not a place is not taken', async () => {
    const t = mount();
    t.open('general');
    const select = t.$('#ttc-sidebar-position');
    const bad = t.window.document.createElement('option');
    bad.value = 'middle';
    select.append(bad);
    t.change(select, 'middle');
    t.click(t.$('button[data-act="save"]'));
    await settle();
    assert.equal(t.saves[0].settings.sidebar.position, 'top');
  });
});
