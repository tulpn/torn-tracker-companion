// The Torn Tracker entry in Torn's Areas list (CMP-107) beside other scripts' rows
// (hq #453): it is only ever copied from Torn's own entries, and never changes theirs.

import fs from 'node:fs';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { LINK_ID, ROUTE_HREF, SIDEBAR, mountEntry, nativeEntry, tornHref } from '../../src/core/entry.js';
import { ROOT } from '../helpers.js';

const REAL = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'pages', 'sidebar-desktop.html'), 'utf8');

/** The Contract's row as the owner's DOM showed it (hq #453), before it carried our mark. */
const CONTRACT = `<div class="area-desktop___yee1a notList___jrp60" id="nav-the-contract"><div class="areaRow___Eheay">
  <a href="/index.php#/the-contract" class="link___tg6eQ desktopLink___dcGFC" i-data="i_0_689_172_23">
  <span class="svgIconWrap___MDuQ8"><span class="defaultIcon___GnL0d mobile___nUzYc"><svg viewBox="0 0 1 1"></svg></span></span>
  <span class="linkName___YZMai">The Contract</span><span data-tc-chip="">#7</span></a></div></div>`;

const windows = [];
after(() => windows.forEach((w) => w.close()));

function boot(html = REAL, { contractFirst = true } = {}) {
  const window = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, { url: 'https://www.torn.com/index.php' }).window;
  windows.push(window);
  const doc = window.document;
  const areas = doc.querySelector(SIDEBAR);
  if (contractFirst) areas.prepend(JSDOM.fragment(CONTRACT));
  const others = () => [...areas.children].filter((n) => n.id !== LINK_ID).map((n) => n.outerHTML);
  return { window, doc, areas, others, contract: () => doc.getElementById('nav-the-contract') };
}

const mount = (t) => mountEntry({ doc: t.doc, onMutation: () => () => {} });
const marksOutside = (doc) => [...doc.querySelectorAll('.ttc-mark')].filter((m) => !m.closest(`#${LINK_ID}`));

describe('hq #453 the entry is copied from Torn, never from another script', () => {
  test('a link to a Torn page is Torn’s; a script’s hash route or another host is not', () => {
    for (const href of ['/index.php', 'https://www.torn.com/page.php?sid=travel', 'https://torn.com/item.php', 'https://www.torn.com/preferences.php#tab=navigation-settings']) {
      assert.equal(tornHref(href), true, href);
    }
    for (const href of ['/index.php#/the-contract', ROUTE_HREF, 'https://torncontracts.online/x', '//evil.example/', 'javascript:void(0)']) {
      assert.equal(tornHref(href), false, href);
    }
  });

  test('with The Contract’s row first and TornTools present, the copy comes from a Torn row and every other row is untouched', () => {
    const t = boot();
    t.doc.getElementById('nav-home').remove(); // no preferred source: the first native one must still win
    const before = t.others();
    assert.equal(nativeEntry(t.contract()), false);
    mount(t);
    const entry = t.doc.getElementById(LINK_ID);
    assert.ok(entry);
    assert.deepEqual(t.others(), before, 'no other row changed');
    assert.equal(entry.querySelector('a').getAttribute('href'), ROUTE_HREF);
    assert.equal(entry.querySelector("[class*='linkName']").textContent, 'Torn Tracker');
    assert.doesNotMatch(entry.outerHTML, /i-data|data-tc|The Contract|#7/);
    assert.equal(entry.previousElementSibling.textContent.trim(), 'TornTools Settings');
    assert.equal(t.doc.querySelectorAll(`#${LINK_ID}`).length, 1);
    assert.deepEqual(marksOutside(t.doc), []);
  });

  test('the source is cloned first and stays byte-equal; the copy loses every foreign attribute and child', () => {
    const t = boot(REAL, { contractFirst: false });
    const home = t.doc.getElementById('nav-home');
    const link = home.querySelector('a');
    link.setAttribute('i-data', 'i_0_1_2_3');
    link.append(JSDOM.fragment('<span data-tc-chip="">#7</span>'));
    const source = home.outerHTML;
    mount(t);
    assert.equal(t.doc.getElementById('nav-home').outerHTML, source);
    const entry = t.doc.getElementById(LINK_ID);
    assert.doesNotMatch(entry.outerHTML, /i-data|data-tc|#7/);
    assert.match(entry.className, /area-desktop/);
  });

  test('a row carrying our or another script’s data is never a source', () => {
    const t = boot(REAL, { contractFirst: false });
    const rows = [...t.areas.children].filter((n) => n.id.startsWith('nav-'));
    for (const [i, name] of ['data-own', 'data-ttc-open', 'data-tc-chip'].entries()) {
      rows[i].setAttribute(name, '');
      assert.equal(nativeEntry(rows[i]), false, name);
      rows[i].removeAttribute(name);
    }
    rows[0].querySelector('.linkName___YZMai').append(JSDOM.fragment('<span class="ttc-mark">TT</span>'));
    assert.equal(nativeEntry(rows[0]), false, 'a row with our mark in it');
  });

  test('our row carries data-own, so other scripts can skip it', () => {
    const t = boot();
    mount(t);
    assert.ok(t.doc.getElementById(LINK_ID).hasAttribute('data-own'));
  });

  test('after ten redraws in which another script copies our row: one entry, no mark of ours outside it', () => {
    const t = boot();
    const entry = mount(t);
    for (let i = 0; i < 10; i += 1) {
      // The other script clones the last row (ours) and makes it its own.
      const clone = t.doc.getElementById(LINK_ID).cloneNode(true);
      clone.removeAttribute('id');
      clone.removeAttribute('data-ttc-open');
      clone.removeAttribute('data-own');
      clone.querySelector('a').setAttribute('href', `/index.php#/other-${i}`);
      t.areas.append(clone);
      if (i % 3 === 0) t.doc.getElementById(LINK_ID).remove(); // and Torn sometimes drops ours
      entry.place();
      assert.equal(t.doc.querySelectorAll(`#${LINK_ID}`).length, 1, `redraw ${i + 1}`);
      assert.deepEqual(marksOutside(t.doc), [], `redraw ${i + 1}`);
    }
    assert.equal(t.doc.getElementById(LINK_ID).querySelectorAll('.ttc-mark').length, 1, 'ours keeps its mark');
    const contract = t.contract();
    assert.ok(contract.querySelector('svg'), 'The Contract’s icon intact');
    assert.equal(contract.querySelector('[data-tc-chip]').textContent, '#7', 'and its chip');
  });
});
