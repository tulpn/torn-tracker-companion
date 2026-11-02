// Our profile buttons as one group (hq #467): one row inside Torn's title box, below its
// title row and above its rule, in one order whichever feature comes first, and nothing of
// Torn's touched.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { PROFILE_ACTIONS, button, profileAction } from '../../src/core/ui.js';
import { page } from '../feature-harness.js';

const load = (name) => new JSDOM(`<!doctype html><html><head></head><body>${page(name)}</body></html>`).window.document;
const torns = (title) => [...title.children].filter((n) => !n.matches(`.${PROFILE_ACTIONS}`)).map((n) => n.outerHTML);

describe('hq #467 the profile\'s row of our buttons', () => {
  for (const fixture of ['profile-npc.html', 'profile-player.html']) {
    test(`${fixture}: one row above Torn's rule, in a fixed order, Torn's nodes byte for byte`, () => {
      const doc = load(fixture);
      const title = doc.querySelector('.content-title');
      const heading = doc.querySelector('.content-title h4');
      const before = torns(title);
      profileAction(doc, heading, 'notes', button(doc, { cls: 'n' }, 'Add note'));
      profileAction(doc, heading, 'lists', button(doc, { cls: 'l' }, 'Add to a list'));
      profileAction(doc, heading, 'messages', button(doc, { cls: 'm' }, 'Messages'));
      const rows = doc.querySelectorAll(`.${PROFILE_ACTIONS}`);
      assert.equal(rows.length, 1);
      const row = rows[0];
      assert.equal(row.parentElement, title);
      assert.ok(row.nextElementSibling.matches('hr.page-head-delimiter'));
      assert.equal(row.getAttribute('role'), 'group');
      assert.equal(row.getAttribute('aria-label'), 'Torn Tracker');
      assert.deepEqual([...row.children].map((n) => n.className.split(' ').pop()), ['l', 'm', 'n']);
      assert.ok([...row.querySelectorAll('button')].every((b) => b.type === 'button'), 'keyboard reachable, never submits');
      assert.deepEqual(torns(title), before);
    });
  }

  test('without Torn\'s title box the row goes after the heading', () => {
    const doc = new JSDOM('<!doctype html><body><h4>Someone [1]</h4><p>x</p></body>').window.document;
    profileAction(doc, doc.querySelector('h4'), 'notes', button(doc, {}, 'Add note'));
    assert.ok(doc.querySelector('h4').nextElementSibling.matches(`.${PROFILE_ACTIONS}`));
  });

  test('the row hides while empty, and draws with Torn\'s button look and our accent', () => {
    const doc = load('profile-npc.html');
    profileAction(doc, doc.querySelector('h4'), 'lists', button(doc, {}, 'x'));
    const css = doc.getElementById('ttc-ui-style').textContent;
    assert.match(css, /\.ttc-profile-actions:empty \{ display: none; \}/);
    assert.match(css, /var\(--btn-background, var\(--card\)\)/);
    assert.match(css, /border-radius: 5px/);
    assert.match(css, /border-left: 3px solid var\(--primary\)/);
    assert.match(css, /\.ttc-profile-actions\.ttc-profile-actions \.ttc-ui-button:focus-visible/);
    assert.match(css, /\.ttc-profile-actions\.ttc-profile-actions \.ttc-ui-button::before, [^{]*\{ content: none; display: none; \}/,
      "Torn's divider before each title-box button stays off ours");
    assert.match(css, /min-height: 44px; min-width: 44px/);
  });
});
