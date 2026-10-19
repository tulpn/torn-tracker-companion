// The built file, on a page, under the runtime guard (CMP-001, CMP-007, CMP-030).

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { PREFIX, boot, closeAll, fakePdaStorage, readBuilt, readPackage } from './helpers.js';

const { version } = readPackage();

after(closeAll);

// A thin stand-in for a Torn page. Feature tests bring fixtures of the real markup.
const PAGE = '<div id="mainContainer"><div class="content-wrapper"></div></div>';

describe('CMP-001 the built file boots on a Torn page', () => {
  test('it adds the settings button and a hidden panel', async () => {
    const t = await boot(PAGE);
    assert.ok(t.fab(), 'no settings button');
    assert.equal(t.panel().hidden, true);
  });

  test('it leaves Torn\'s own markup alone', async () => {
    const t = await boot(PAGE);
    assert.ok(t.doc.querySelector('#mainContainer .content-wrapper'));
    assert.equal(t.doc.querySelector('#mainContainer').children.length, 1);
  });

  test('CMP-030 it makes no request to torn.com, clicks nothing and submits nothing', async () => {
    const t = await boot(PAGE, { url: 'https://www.torn.com/factions.php#/war/rank' });
    t.userClick(t.fab());
    await t.tick();
    assert.deepEqual(t.violations, []);
  });
});

describe('CMP-107 the panel tells the player where their settings live', () => {
  test('it opens on the button and shows the version and the backend', async () => {
    const t = await boot(PAGE);
    t.userClick(t.fab());
    assert.equal(t.panel().hidden, false);
    assert.match(t.panel().textContent, new RegExp(`Version ${version.replace(/\./g, '\\.')}\\b`));
    assert.match(t.panel().textContent, /localStorage/);
  });

  test('a build with no features says so rather than showing an empty list', async () => {
    const t = await boot(PAGE);
    t.userClick(t.fab());
    assert.match(t.panel().textContent, /No features in this build yet/);
  });

  test('the button closes the panel again', async () => {
    const t = await boot(PAGE);
    t.userClick(t.fab());
    t.userClick(t.fab());
    assert.equal(t.panel().hidden, true);
  });
});

describe('CMP-008 settings are kept on the device and validated on the way in', () => {
  test('a change is saved to localStorage', async () => {
    const t = await boot(PAGE);
    t.userClick(t.fab());
    t.panel().querySelector(`#${PREFIX}-debug`).checked = true;
    t.userClick(t.panel().querySelector('button[data-act="save"]'));
    await t.tick();

    assert.equal(t.panel().hidden, true);
    assert.equal(JSON.parse(t.window.localStorage.getItem(`${PREFIX}_settings`)).debug, true);
  });

  test('garbage in storage falls back to the defaults', async () => {
    const t = await boot(PAGE, { savedSettings: '{"debug":"yes","junk":true}' });
    t.userClick(t.fab());
    assert.equal(t.panel().querySelector(`#${PREFIX}-debug`).checked, false);
  });

  test('settings that are not JSON at all do not stop the script', async () => {
    const t = await boot(PAGE, { savedSettings: 'not json' });
    assert.ok(t.fab());
  });

  test('"Forget me" asks once, then clears every key', async () => {
    const t = await boot(PAGE);
    for (const key of ['ttc_settings', 'ttc_keys', 'ttc_queue', 'ttc_cache']) {
      t.window.localStorage.setItem(key, '{"x":1}');
    }
    t.userClick(t.fab());

    const forget = () => t.panel().querySelector('button[data-act="forget"]');
    t.userClick(forget());
    await t.tick();
    assert.match(t.panel().textContent, /Really forget everything\?/);
    assert.equal(t.window.localStorage.getItem('ttc_keys'), '{"x":1}', 'nothing is cleared on the first press');

    t.userClick(forget());
    await t.tick();
    for (const key of ['ttc_settings', 'ttc_keys', 'ttc_queue', 'ttc_cache']) {
      assert.equal(t.window.localStorage.getItem(key), null, `${key} survived`);
    }
  });
});

describe('CMP-007 the same file runs in Torn PDA', () => {
  test('settings go to PDA_storage when PDA injects it', async () => {
    const pda = fakePdaStorage();
    const t = await boot(PAGE, { pdaStorage: pda });
    t.userClick(t.fab());
    assert.match(t.panel().textContent, /PDA_storage/);

    t.userClick(t.panel().querySelector('button[data-act="save"]'));
    await t.tick();
    assert.equal(pda.store.has(`${PREFIX}_settings`), true);
    assert.equal(t.window.localStorage.getItem(`${PREFIX}_settings`), null);
  });

  test('the panel is built for a thumb on a 360 px screen', () => {
    const built = readBuilt();
    assert.match(built, /min-height: 44px/);
    assert.match(built, /width: min\(360px, calc\(100vw - 24px\)\)/);
    assert.match(built, /width: 44px; height: 44px/);
  });
});
