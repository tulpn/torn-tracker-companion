'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, closeAll, fakePdaStorage, PREFIX } = require('./helpers');

after(closeAll);

// Minimal page. Replace with markup that mimics the real Torn page (copy outerHTML from DevTools).
const PAGE = `
  <div id="list">
    <div class="row"><img alt="Hammer" src="/images/items/1/medium.png"><span>$49</span></div>
  </div>`;

describe('boot', () => {
  test('adds the gear button and a hidden panel, decorates nothing by default', async () => {
    const t = await boot(PAGE);
    assert.ok(t.fab());
    assert.equal(t.panel().hidden, true);
    assert.equal(t.doc.querySelectorAll(`.${PREFIX}-hit`).length, 0);
  });
});

describe('settings panel', () => {
  test('opens, saves to localStorage and applies', async () => {
    const t = await boot(PAGE);
    t.fab().click();
    assert.equal(t.panel().hidden, false);
    assert.match(t.panel().textContent, /localStorage/);
    t.panel().querySelector(`#${PREFIX}-enabled`).checked = false;
    t.panel().querySelector('button[data-act="save"]').click();
    await t.tick();
    assert.equal(t.panel().hidden, true);
    assert.equal(JSON.parse(t.window.localStorage.getItem(`${PREFIX}_settings`)).enabled, false);
  });

  test('uses PDA_storage when Torn PDA injects it', async () => {
    const pda = fakePdaStorage();
    const t = await boot(PAGE, { pdaStorage: pda });
    t.fab().click();
    assert.match(t.panel().textContent, /PDA_storage/);
    t.panel().querySelector('button[data-act="save"]').click();
    await t.tick();
    assert.ok(pda.store.has(`${PREFIX}_settings`));
    assert.equal(t.window.localStorage.getItem(`${PREFIX}_settings`), null);
  });

  test('garbage in storage falls back to defaults', async () => {
    const t = await boot(PAGE, { savedSettings: JSON.stringify({ enabled: 'yes', showBadge: 1, junk: true }) });
    t.fab().click();
    assert.equal(t.panel().querySelector(`#${PREFIX}-enabled`).checked, true);
    assert.equal(t.panel().querySelector(`#${PREFIX}-showBadge`).checked, true);
  });

  test('reset clears storage', async () => {
    const t = await boot(PAGE, { savedSettings: JSON.stringify({ enabled: false }) });
    t.fab().click();
    t.panel().querySelector('button[data-act="reset"]').click();
    await t.tick();
    assert.equal(t.window.localStorage.getItem(`${PREFIX}_settings`), null);
  });
});
