// The built file, on a page, under the runtime guard (CMP-001, CMP-007, CMP-030).

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { PREFIX, boot, closeAll, fakePdaStorage, readBuilt, readPackage } from './helpers.js';

const { version } = readPackage();

after(closeAll);

// A thin stand-in for a Torn page. Feature tests bring fixtures of the real markup.
const PAGE = '<div id="mainContainer"><div class="content-wrapper"><div class="home">Torn home</div></div></div>';

/** Torn's sidebar, as TornTools finds it, with or without TornTools' own entry. */
const SIDEBAR = (tornTools) => `<div id="sidebar"><div class="sidebar-block___a"><div class="toggle-block___b">
    <h2 class="title___c">Areas</h2>
    <div class="areas___x1">
      <div id="nav-home" class="area-desktop___d active___z"><div class="area-row___e"><a href="/index.php" class="desktopLink___f"><span class="svgIconWrap___g"><svg></svg></span><span class="linkName___h">Home</span></a></div></div>
      <div id="nav-items" class="area-desktop___d"><div class="area-row___e"><a href="/item.php" class="desktopLink___f"><span class="svgIconWrap___g"><svg></svg></span><span class="linkName___h">Items</span><span class="amount___i">12</span></a></div></div>
      ${tornTools ? '<div class="settings___tt pill"><span>TornTools Settings</span></div>' : ''}
      <div id="nav-city" class="area-desktop___d"><div class="area-row___e"><a href="/city.php" class="desktopLink___f"><span class="linkName___h">City</span></a></div></div>
    </div></div></div>
    <div class="sidebar-block___a"><div class="toggle-block___b"><h2 class="title___c">Lists</h2><div class="toggle-content___j">Friends</div></div></div>
  </div>`;

/** Opens the settings on one of its sections, the way a player's link does. */
async function openOn(t, tab) {
  await t.go(`#/torn-tracker/${tab}`);
}

/** A player ticking a box: the property changes, then the browser says so. */
function userCheck(t, input, checked = true) {
  input.checked = checked;
  input.dispatchEvent(new t.window.Event('change', { bubbles: true }));
}

describe('CMP-001 the built file boots on a Torn page', () => {
  test('it adds a way into the settings, and the settings page only on its route', async () => {
    const t = await boot(SIDEBAR(false) + PAGE);
    assert.ok(t.entry(), 'no way into the settings');
    assert.equal(t.panel(), null);
  });

  test('it leaves Torn\'s own markup alone', async () => {
    const t = await boot(PAGE);
    assert.ok(t.doc.querySelector('#mainContainer .content-wrapper'));
    assert.equal(t.doc.querySelector('#mainContainer').children.length, 1);
  });

  test('CMP-030 it makes no request to torn.com, clicks nothing and submits nothing', async () => {
    const t = await boot(SIDEBAR(true) + PAGE, { url: 'https://www.torn.com/factions.php#/war/rank' });
    await t.tick();
    assert.ok(t.entry());
    assert.deepEqual(t.violations, []);
  });
});

describe('CMP-107 the panel tells the player where their settings live', () => {
  test('it opens on its route and shows the version and where things are kept', async () => {
    const t = await boot(PAGE);
    await t.go('#/torn-tracker');
    assert.ok(t.panel());
    await openOn(t, 'general');
    assert.match(t.panel().textContent, new RegExp(`version ${version.replace(/\./g, '\\.')}\\b`));
    await openOn(t, 'data');
    assert.match(t.panel().textContent, /localStorage/);
  });

  test('the features in this build are listed by area, each with its switch', async () => {
    const t = await boot(PAGE);
    await openOn(t, 'features');
    assert.match(t.panel().textContent, /Travel/);
    assert.equal(t.panel().querySelector(`#${PREFIX}-feature-foreign-stock`).checked, true);
  });

  test('saving keeps the page open and says so', async () => {
    const t = await boot(PAGE);
    await openOn(t, 'general');
    t.userClick(t.panel().querySelector('button[data-act="save"]'));
    await t.tick();
    assert.match(t.panel().textContent, /Saved\./);
  });
});

describe('CMP-008 settings are kept on the device and validated on the way in', () => {
  test('a change is saved to localStorage', async () => {
    const t = await boot(PAGE);
    await openOn(t, 'general');
    userCheck(t, t.panel().querySelector(`#${PREFIX}-debug`));
    t.userClick(t.panel().querySelector('button[data-act="save"]'));
    await t.tick();

    assert.equal(JSON.parse(t.window.localStorage.getItem(`${PREFIX}_settings`)).debug, true);
  });

  test('garbage in storage falls back to the defaults', async () => {
    const t = await boot(PAGE, { savedSettings: '{"debug":"yes","junk":true}' });
    await openOn(t, 'general');
    assert.equal(t.panel().querySelector(`#${PREFIX}-debug`).checked, false);
  });

  test('settings that are not JSON at all do not stop the script', async () => {
    const t = await boot(SIDEBAR(false) + PAGE, { savedSettings: 'not json' });
    assert.ok(t.entry());
  });

  test('"Forget me" asks once, then clears every key', async () => {
    const t = await boot(PAGE);
    for (const key of ['ttc_settings', 'ttc_keys', 'ttc_queue', 'ttc_cache']) {
      t.window.localStorage.setItem(key, '{"x":1}');
    }
    await openOn(t, 'data');

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
    await openOn(t, 'data');
    assert.match(t.panel().textContent, /PDA_storage/);

    t.userClick(t.panel().querySelector('button[data-act="save"]'));
    await t.tick();
    assert.equal(pda.store.has(`${PREFIX}_settings`), true);
    assert.equal(t.window.localStorage.getItem(`${PREFIX}_settings`), null);
  });

  test('the settings page is built for a thumb, and folds its menu on a phone', () => {
    const built = readBuilt();
    assert.match(built, /min-height: 44px; min-width: 44px/, 'every button is at least 44 px');
    assert.match(built, /@container \(max-width: 600px\)/, 'the left menu becomes a top menu under 600 px');
    assert.doesNotMatch(built, /ttc-fab/, 'no floating button is left');
  });
});

describe('CMP-011 the script key is kept on the device and never logged', () => {
  const KEY = `tt_feed_${'D'.repeat(43)}`;

  test('a key typed in the panel is saved to ttc_keys', async () => {
    const t = await boot(PAGE);
    await openOn(t, 'keys');
    const field = t.panel().querySelector(`#${PREFIX}-key-script`);
    field.value = KEY;
    field.dispatchEvent(new t.window.Event('input', { bubbles: true }));
    t.userClick(t.panel().querySelector('button[data-act="save"]'));
    await t.tick();
    assert.equal(JSON.parse(t.window.localStorage.getItem(`${PREFIX}_keys`)).script, KEY);
    assert.deepEqual(t.violations, []);
  });

  test('with debug on, the key never reaches the console', async () => {
    const seen = [];
    const original = { log: console.log, warn: console.warn, error: console.error };
    for (const level of Object.keys(original)) console[level] = (...args) => seen.push(args.map(String).join(' '));
    try {
      const t = await boot(PAGE, { savedSettings: '{"debug":true}' });
      t.window.localStorage.setItem(`${PREFIX}_keys`, JSON.stringify({ script: KEY }));
      await openOn(t, 'keys');
      const field = t.panel().querySelector(`#${PREFIX}-key-script`);
      field.value = KEY;
      field.dispatchEvent(new t.window.Event('input', { bubbles: true }));
      t.userClick(t.panel().querySelector('button[data-act="save"]'));
      await t.tick(10);
    } finally {
      Object.assign(console, original);
    }
    assert.ok(seen.length > 0, 'debug logging was on');
    assert.equal(seen.some((line) => line.includes(KEY)), false);
  });
});

describe('CMP-014 CMP-015 the built file sends nothing on its own', () => {
  test('a page view with no key and nothing switched on makes no request at all', async () => {
    const t = await boot(PAGE);
    const calls = [];
    const guarded = t.window.fetch;
    t.window.fetch = (...args) => {
      calls.push(String(args[0]));
      return guarded(...args);
    };
    t.window.dispatchEvent(new t.window.Event('pagehide'));
    await t.tick(10);
    assert.deepEqual(calls, []);
    assert.deepEqual(t.violations, []);
  });

  test('this build offers a switch for each kind it can share, every one off', async () => {
    const t = await boot(PAGE);
    await openOn(t, 'sharing');
    const switches = [...t.panel().querySelectorAll('[data-share]')];
    assert.deepEqual(switches.map((s) => s.dataset.share).sort(), ['auction_listing', 'bazaar_listing', 'crime_outcome', 'foreign_stock', 'gym_progress', 'gym_train', 'item_market_snapshot', 'jail_difficulty', 'loadout']);
    assert.ok(switches.every((s) => !s.checked && !s.disabled));
    assert.match(t.panel().textContent, /Share the kinds I picked/);
  });
});

describe('CMP-107 the one way in, and the settings route (2026-10-23)', () => {
  const HEADER = '<div id="topHeaderBanner"><div class="header-wrapper-top"><div class="menu"><a class="avatar___h1" href="/profiles.php?XID=1"><img src="/avatar.png"></a></div></div></div>';

  test('AC1: with TornTools, the entry sits directly after "TornTools Settings"', async () => {
    const t = await boot(SIDEBAR(true) + PAGE);
    const entry = t.entry();
    assert.ok(entry);
    assert.equal(entry.previousElementSibling.textContent, 'TornTools Settings');
    assert.match(entry.textContent, /Torn Tracker/);
  });

  test('AC1: without TornTools, it is the last entry in Areas', async () => {
    const t = await boot(SIDEBAR(false) + PAGE);
    const entry = t.entry();
    assert.equal(entry.parentElement.className, 'areas___x1');
    assert.equal(entry.nextElementSibling, null);
  });

  test('AC1: in PDA\u2019s slide-out menu too', async () => {
    const t = await boot(`<div class="areasWrapper"><div class="toggle-content___m">
      <div class="area-mobile___n"><a href="/index.php"><span class="linkName___h">Home</span></a></div></div></div>${PAGE}`);
    assert.equal(t.entry().parentElement.className, 'toggle-content___m');
  });

  test('it is a copy of Torn\u2019s own entry: a plain link to the route, without ids, counters or "active"', async () => {
    const t = await boot(SIDEBAR(false) + PAGE);
    const entry = t.entry();
    assert.equal(entry.className, 'area-desktop___d', 'Torn\u2019s look, without its active class');
    const link = entry.querySelector('a');
    assert.equal(link.getAttribute('href'), '/index.php#/torn-tracker');
    assert.equal(link.querySelector('[class*="linkName"]').textContent, 'Torn Tracker');
    assert.equal(entry.querySelector('svg'), null, 'our mark replaces Torn\u2019s icon');
    assert.equal(entry.querySelector('[class*="amount"]'), null);
    assert.equal(entry.querySelectorAll('[id]').length, 0);
    assert.equal(t.doc.querySelectorAll('#nav-home').length, 1, 'Torn\u2019s own entry is untouched');
  });

  test('AC2: nothing is added to Torn\u2019s header; no icon, edge tab or floating element anywhere', async () => {
    for (const page of [SIDEBAR(true) + HEADER + PAGE, HEADER + PAGE, PAGE]) {
      const t = await boot(page);
      const header = t.doc.getElementById('topHeaderBanner');
      if (header) assert.equal(header.querySelector('[id^="ttc"], [class*="ttc"], [data-ttc-open]'), null);
      for (const id of ['ttc-header-link', 'ttc-edge-tab', 'ttc-fab']) assert.equal(t.doc.getElementById(id), null, id);
      const fixed = [...t.doc.querySelectorAll('[id^="ttc"], [class^="ttc"], [data-ttc-own], [data-ttc-open]')]
        .filter((n) => t.window.getComputedStyle(n).position === 'fixed');
      assert.deepEqual(fixed, []);
    }
  });

  test('AC3: the route shows the settings in the main column; Back brings Torn\u2019s home page back as it was', async () => {
    const t = await boot(SIDEBAR(false) + PAGE);
    const column = t.doc.querySelector('#mainContainer .content-wrapper');
    const before = t.doc.querySelectorAll('*').length;
    const home = column.querySelector('.home');

    await t.go('#/torn-tracker');
    assert.ok(t.panel());
    assert.equal(t.doc.getElementById('ttc-page-host').parentElement, column);
    assert.ok(t.doc.body.classList.contains('ttc-page'));
    assert.equal(t.window.getComputedStyle(home).display, 'none', 'Torn\u2019s nodes are hidden');
    assert.ok(home.isConnected, 'and never removed');
    assert.equal(t.entry().querySelector('a').getAttribute('aria-current'), 'page');
    assert.ok(t.doc.getElementById('sidebar').isConnected, 'the sidebar stays');

    await t.go('');
    assert.equal(t.panel(), null);
    assert.equal(t.doc.body.classList.contains('ttc-page'), false);
    assert.notEqual(t.window.getComputedStyle(home).display, 'none');
    assert.equal(column.querySelector('.home'), home);
    assert.equal(t.doc.querySelectorAll('*').length, before, 'the same nodes as before');
    assert.equal(t.entry().querySelector('a').hasAttribute('aria-current'), false);
  });

  test('AC4: the route makes no request on mount, in any section', async () => {
    const t = await boot(PAGE);
    const calls = [];
    const guarded = t.window.fetch;
    t.window.fetch = (...args) => {
      calls.push(String(args[0]));
      return guarded(...args);
    };
    for (const section of ['', 'general', 'features', 'sidebar', 'sharing', 'keys', 'data', 'credits', 'help']) {
      await t.go(`#/torn-tracker${section ? `/${section}` : ''}`);
    }
    assert.deepEqual(calls, []);
    assert.deepEqual(t.violations, []);
  });

  test('AC5: #/torn-tracker/sharing opens straight on Sharing; an unknown section opens General', async () => {
    const t = await boot(PAGE, { url: 'https://www.torn.com/index.php#/torn-tracker/sharing' });
    assert.equal(t.panel().querySelector('[aria-selected=true]').textContent, 'Sharing');
    await t.go('#/torn-tracker/nonsense');
    assert.equal(t.panel().querySelector('[aria-selected=true]').textContent, 'General');
  });

  test('the route lives only on Torn\u2019s home page', async () => {
    const t = await boot(PAGE, { url: 'https://www.torn.com/factions.php#/torn-tracker' });
    assert.equal(t.panel(), null);
  });

  test('AC6: settings saved by the last version carry over unchanged', async () => {
    const saved = JSON.stringify({ debug: true, sharingConsent: 0, features: { 'foreign-stock': { enabled: false } }, shares: {} });
    const t = await boot(PAGE, { savedSettings: saved });
    await openOn(t, 'features');
    assert.equal(t.panel().querySelector('#ttc-feature-foreign-stock').checked, false);
    await openOn(t, 'general');
    assert.equal(t.panel().querySelector('#ttc-debug').checked, true);
  });

  test('when Torn redraws its sidebar, the entry comes back', async () => {
    const t = await boot(SIDEBAR(false) + PAGE);
    const areas = t.doc.querySelector('.areas___x1');
    areas.replaceChildren(t.doc.createElement('div'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.ok(t.entry()?.isConnected);
    assert.deepEqual(t.violations, []);
  });
});
