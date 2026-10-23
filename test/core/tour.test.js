// The tour engine and the companion's tours (hq #237, WP-UX-4).

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { LAYER_ID, LIMITS, checkTour, findAnchor, runTour, typing } from '../../src/core/tour.js';
import { PENDING_MS, TOURS, cleanProgress, createTours } from '../../src/core/tours.js';
import { ROOT } from '../helpers.js';

const windows = [];
after(() => windows.forEach((w) => w.close()));

function page(body = '', url = 'https://www.torn.com/index.php') {
  const { window } = new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, { url, pretendToBeVisual: true });
  windows.push(window);
  return window;
}

const tour = (steps, extra = {}) => checkTour({
  id: 'test', version: 1, surface: 'companion', page: '*', title: 'A test', steps, ...extra,
});
const step = (target, more = {}) => ({ target, title: `About ${target}`, body: `What ${target} does.`, ...more });
const ANCHORS = '<button data-tour="a">A</button><span data-tour="b">B</span><div data-tour="c" aria-label="The C box">c</div>';

function key(doc, name, opts = {}) {
  const target = opts.target || doc.activeElement || doc.body;
  target.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...opts }));
}

describe('UXT-001 tours are data, and checked', () => {
  test('every companion tour passes the checks, and every anchor it names exists in the code', () => {
    const sources = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.js') && !full.endsWith(path.join('core', 'tours.js'))) sources.push(fs.readFileSync(full, 'utf8'));
    });
    walk(path.join(ROOT, 'src'));
    const code = sources.join('\n');
    for (const t of TOURS) {
      assert.doesNotThrow(() => checkTour(t));
      for (const s of t.steps) {
        const named = code.includes(`'data-tour': '${s.target}'`)
          || (s.target.endsWith('-tab') && code.includes("'data-tour': `companion-${id}-tab`"));
        assert.ok(named, `${t.id}: no element carries data-tour="${s.target}"`);
      }
    }
  });

  test('titles of at most 40 characters, bodies of at most 160, real anchors, https links', () => {
    assert.deepEqual(LIMITS, { title: 40, body: 160 });
    const bad = [
      [step('a', { title: 'x'.repeat(41) })],
      [step('a', { body: 'x'.repeat(161) })],
      [step('.a-class')],
      [step('a'), step('a')],
      [step('a', { cta: { label: 'Go', href: 'javascript:alert(1)' } })],
      [step('a', { example: { lines: [1] } })],
      [],
    ];
    for (const steps of bad) assert.throws(() => tour(steps), undefined, JSON.stringify(steps));
    assert.throws(() => tour([step('a')], { surface: 'site' }));
    assert.doesNotThrow(() => tour([step('a', { title: 'x'.repeat(40), body: 'y'.repeat(160) })]));
  });
});

describe('the engine', () => {
  test('steps in order, skipping a missing anchor and an unmet requirement, then done', () => {
    const win = page(ANCHORS);
    const doc = win.document;
    const ends = [];
    const run = runTour(doc, tour([step('a'), step('gone'), step('b', { requires: 'no' }), step('c')]), {
      isMet: (r) => r !== 'no', onEnd: (r) => ends.push(r),
    });
    const card = doc.querySelector(`#${LAYER_ID} [role=dialog]`);
    assert.match(card.textContent, /1 of 2/);
    assert.match(card.textContent, /About a/);
    run.next();
    assert.match(card.textContent, /2 of 2/);
    assert.equal(card.querySelector('[data-tour-act="next"]').textContent, 'Done');
    run.next();
    assert.equal(doc.getElementById(LAYER_ID), null, 'nothing is left on the page');
    assert.deepEqual(ends, [{ reason: 'done', seen: ['a', 'c'] }]);
  });

  test('a tour with no anchor on the page shows nothing', async () => {
    const win = page('');
    const ends = [];
    runTour(win.document, tour([step('a')]), { onEnd: (r) => ends.push(r) });
    await Promise.resolve();
    assert.equal(win.document.getElementById(LAYER_ID), null);
    assert.deepEqual(ends, [{ reason: 'empty', seen: [] }]);
  });

  test('UXT-005 a labelled dialog that names what is highlighted, and gives focus back', () => {
    const win = page(`<input id="before">${ANCHORS}`);
    const doc = win.document;
    doc.getElementById('before').focus();
    const run = runTour(doc, tour([step('c')]));
    const card = doc.querySelector('[role=dialog]');
    assert.equal(card.getAttribute('aria-modal'), 'true');
    assert.equal(doc.getElementById(card.getAttribute('aria-labelledby')).textContent, 'About c');
    const described = card.getAttribute('aria-describedby').split(' ').map((id) => doc.getElementById(id).textContent);
    assert.deepEqual(described, ['What c does.', 'Highlighted: The C box']);
    assert.equal(doc.activeElement, card);
    run.skip();
    assert.equal(doc.activeElement.id, 'before');
  });

  test('UXT-005 keys: the right arrow or Enter go on, the left arrow back, Esc skips; Tab stays inside', () => {
    const win = page(ANCHORS);
    const doc = win.document;
    const ends = [];
    runTour(doc, tour([step('a'), step('b'), step('c')]), { onEnd: (r) => ends.push(r) });
    const card = doc.querySelector('[role=dialog]');
    key(doc, 'ArrowRight');
    assert.match(card.textContent, /2 of 3/);
    key(doc, 'ArrowLeft');
    assert.match(card.textContent, /1 of 3/);
    key(doc, 'Enter', { target: card });
    assert.match(card.textContent, /2 of 3/);
    const buttons = [...card.querySelectorAll('button:not([disabled])')];
    buttons.at(-1).focus();
    key(doc, 'Tab', { target: buttons.at(-1) });
    assert.equal(doc.activeElement, buttons[0], 'Tab from the last control wraps to the first');
    key(doc, 'Tab', { target: buttons[0], shiftKey: true });
    assert.equal(doc.activeElement, buttons.at(-1));
    key(doc, 'Escape');
    assert.equal(ends[0].reason, 'skipped');
    assert.deepEqual(ends[0].seen, ['a', 'b']);
  });

  test('UXT-006 a swipe to the left goes on', () => {
    const win = page(ANCHORS);
    const doc = win.document;
    runTour(doc, tour([step('a'), step('b')]));
    const card = doc.querySelector('[role=dialog]');
    const touch = (type, x) => {
      const event = new win.Event(type, { bubbles: true });
      event.changedTouches = [{ clientX: x }];
      card.dispatchEvent(event);
    };
    touch('touchstart', 300);
    touch('touchend', 280);
    assert.match(card.textContent, /1 of 2/, 'a small move is not a swipe');
    touch('touchstart', 300);
    touch('touchend', 200);
    assert.match(card.textContent, /2 of 2/);
  });

  test('UXT-006 and UXT-005: a bottom sheet with 44 px buttons at 640 px, a plain fade with reduced motion', () => {
    const win = page(ANCHORS);
    runTour(win.document, tour([step('a')]));
    const css = win.document.querySelector(`#${LAYER_ID} style`).textContent;
    assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*bottom: 0;[\s\S]*min-height: 44px/);
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*tour-fade/);
    assert.doesNotMatch(css, /:hover/, 'no hover states');
  });

  test('a new version shows only the steps not seen yet', () => {
    const win = page(ANCHORS);
    runTour(win.document, tour([step('a'), step('b'), step('c')]), { skip: ['a', 'c'] });
    const card = win.document.querySelector('[role=dialog]');
    assert.match(card.textContent, /1 of 1/);
    assert.match(card.textContent, /About b/);
  });

  test('UXT-002 an example is marked as one; a link opens in a new tab', () => {
    const win = page(ANCHORS);
    runTour(win.document, tour([step('a', {
      example: { lines: ['Ares · level 74'] }, cta: { label: 'Read more', href: 'https://www.torn-tracker.com/guide/' },
    })]));
    const example = win.document.querySelector(`#${LAYER_ID} [role=note]`);
    assert.equal(example.getAttribute('aria-label'), 'Example with sample data');
    assert.equal(example.textContent, 'Ares · level 74');
    assert.match(win.document.querySelector(`#${LAYER_ID} style`).textContent, /content: "Example"/);
    const link = win.document.querySelector(`#${LAYER_ID} a`);
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer');
  });

  test('anchors are found inside the settings page’s Shadow DOM, and hidden ones are passed over', () => {
    const win = page('<div id="host"></div><i data-tour="x" hidden></i>');
    const root = win.document.getElementById('host').attachShadow({ mode: 'open' });
    root.append(win.document.createElement('b'));
    root.firstChild.dataset.tour = 'x';
    assert.equal(findAnchor([win.document, root], 'x'), root.firstChild);
  });

  test('it takes the theme it is given', () => {
    const win = page(ANCHORS);
    runTour(win.document, tour([step('a')]), { theme: 'light' });
    assert.equal(win.document.getElementById(LAYER_ID).dataset.theme, 'light');
  });

  test('typing is a text field with focus, not a switch', () => {
    const win = page('<input id="t"><input id="c" type="checkbox"><textarea id="x"></textarea>');
    const doc = win.document;
    assert.equal(typing(doc), false);
    doc.getElementById('t').focus();
    assert.equal(typing(doc), true);
    doc.getElementById('c').focus();
    assert.equal(typing(doc), false);
    doc.getElementById('x').focus();
    assert.equal(typing(doc), true);
  });
});

describe('UXT-003 and UXT-022 when tours run, and what is kept', () => {
  function manager(win, { stored = null, now = () => 1_000_000, isMet = () => true } = {}) {
    const writes = [];
    const tours = createTours({
      win,
      store: { read: async () => stored, write: async (value) => { writes.push(JSON.parse(JSON.stringify(value))); return true; } },
      isMet,
      onMutation: (handler, doc) => {
        const observer = new win.MutationObserver(handler);
        observer.observe(doc.body, { childList: true, subtree: true });
        return () => observer.disconnect();
      },
      now,
    });
    return { tours, writes };
  }
  const SETTINGS = '<div data-tour="companion-settings">s</div><button data-tour="companion-save">Save</button>';

  test('stored progress is checked field by field, and an old request expires', () => {
    const clean = cleanProgress({
      tours: { settings: { version: 1, seen: ['companion-save', 'nope', 5], done: 'yes' }, other: { version: 1 } },
      pending: { id: 'war-page', at: 0 },
    }, PENDING_MS + 1);
    assert.deepEqual(clean, { tours: { settings: { version: 1, seen: ['companion-save'], done: false, skipped: false } }, pending: null });
    assert.equal(cleanProgress({ pending: { id: 'war-page', at: 10 } }, 20).pending.id, 'war-page');
    assert.deepEqual(cleanProgress('junk'), { tours: {}, pending: null });
  });

  test('the settings tour runs by itself once; finished or skipped, it waits for a new version', async () => {
    const win = page(SETTINGS);
    const { tours, writes } = manager(win);
    await tours.load();
    assert.equal(tours.auto('settings'), true);
    tours.running.skip();
    assert.equal(writes.at(-1).tours.settings.skipped, true);
    assert.equal(tours.auto('settings'), false);
    assert.equal(tours.list().find((t) => t.id === 'settings').done, false, 'skipped is not done');
    assert.equal(tours.start('settings'), true, 'on demand it always runs');
    tours.running.next();
    tours.running.next();
    assert.equal(tours.list().find((t) => t.id === 'settings').done, true);
  });

  test('a new version replays only the steps not seen', async () => {
    const win = page(SETTINGS);
    const { tours } = manager(win, { stored: { tours: { settings: { version: 0, seen: ['companion-settings'], done: true } } } });
    await tours.load();
    assert.equal(tours.auto('settings'), true);
    assert.match(win.document.querySelector('[role=dialog]').textContent, /1 of 1.*Save when/s);
  });

  test('never by itself on the attack page, or over a field being typed in', async () => {
    const attack = page(SETTINGS, 'https://www.torn.com/loader.php?sid=attack&user2ID=1');
    const a = manager(attack);
    await a.tours.load();
    assert.equal(a.tours.auto('settings'), false);
    const typingPage = page(`${SETTINGS}<input id="t">`);
    typingPage.document.getElementById('t').focus();
    const b = manager(typingPage);
    await b.tours.load();
    assert.equal(b.tours.auto('settings'), false);
  });

  test('a tour of another page starts there, once its first anchor shows, and only once', async () => {
    const win = page('', 'https://www.torn.com/factions.php?step=your#/war/rank');
    const { tours, writes } = manager(win);
    await tours.load();
    await tours.request('war-page');
    assert.equal(writes.at(-1).pending.id, 'war-page');
    tours.update({ pathname: '/index.php', search: '', hash: '' });
    assert.equal(tours.running, null, 'not on another page');
    tours.update(win.location);
    assert.equal(tours.running, null, 'not before an anchor shows');
    const bar = win.document.createElement('div');
    bar.dataset.tour = 'war-sort';
    win.document.body.append(bar);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(tours.running, 'it starts once the anchor is there');
    assert.equal(writes.at(-1).pending, null, 'and the request is used up');
  });

  test('a request older than ten minutes is dropped', async () => {
    let clock = 0;
    const win = page('<div data-tour="war-sort"></div>', 'https://www.torn.com/factions.php?step=your#/war/rank');
    const { tours } = manager(win, { now: () => clock });
    await tours.load();
    await tours.request('war-page');
    clock = PENDING_MS;
    tours.update(win.location);
    assert.equal(tours.running, null);
  });

  test('"Forget me" during a tour isn’t undone by the tour ending; a page closing ends its tour unrecorded', async () => {
    const win = page(SETTINGS);
    const { tours, writes } = manager(win);
    await tours.load();
    tours.auto('settings');
    tours.reset();
    assert.equal(win.document.getElementById(LAYER_ID), null);
    assert.equal(writes.length, 0);
    tours.auto('settings');
    tours.stop();
    assert.equal(writes.length, 0);
    assert.equal(tours.auto('settings'), true, 'it comes back next time');
  });
});
