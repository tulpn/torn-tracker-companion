// Watch mode (CHW-020 to CHW-028) on its own: a page with or without Torn's chain bar, a
// stand-in for the site, and a clock and timers the test turns by hand. Acceptance tests
// 9 to 13 of specs/chain-watch.md.

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  ASK_EVERY_MS, BOX_ID, DEFAULT_COLOURS, DESKTOP_SIZE, FLASH_HALF_MS, PHONE_SIZE, PREVIEW_FROM_S, PREVIEW_TO_S,
  STALE_AFTER_MS, clockText, mountWatch, normalizeWatch, readChainBar, stateFor, textOn, watchDefaults,
} from '../../src/core/watch.js';
import { readSidebar } from '../../src/core/site.js';
import * as dom from '../../src/core/dom.js';

const windows = [];
after(() => windows.forEach((w) => w.close()));
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** Torn's chain bar as TornTools matches it (synthetic until a capture, Q-CHW-6). */
const BAR = (time, value = '412 / 500') => `<div id="sidebar"><a id="barChain" class="chain-bar___x">
  <p class="bar-name___a">Chain:</p><p class="bar-value___b">${value}</p><p class="bar-timeleft___c">${time}</p></a></div>`;

function fakeTimers() {
  let next = 1;
  const pending = new Map();
  const intervals = new Map();
  return {
    pending,
    intervals,
    setTimeout(fn, ms) {
      const id = next++;
      pending.set(id, { fn, ms });
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    setInterval(fn, ms) {
      const id = next++;
      intervals.set(id, { fn, ms });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    /** Runs every timeout that's waiting, once. */
    run() {
      const due = [...pending.entries()];
      pending.clear();
      for (const [, t] of due) t.fn();
    },
    /** One beat of the drawing interval. */
    beat() {
      for (const [, t] of intervals) t.fn();
    },
  };
}

const at = (iso) => new Date(iso).getTime();
const T0 = at('2026-10-26T20:00:00Z');

/**
 * @param {object} [o]
 * @param {string} [o.html]
 * @param {object} [o.saved]    what `ttc_watch` holds
 * @param {Function} [o.answer] the site's sidebar answer, by call
 * @param {boolean} [o.key]
 */
async function mount({ html = '', saved = { on: true }, answer, key = true, width = 1280, pda = false } = {}) {
  dom.resetObserver();
  const { window } = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, { url: 'https://www.torn.com/' });
  windows.push(window);
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  if (pda) window.PDA_httpGet = () => {};
  let hidden = false;
  Object.defineProperty(window.document, 'visibilityState', { get: () => (hidden ? 'hidden' : 'visible'), configurable: true });
  const clock = { now: T0 };
  const asks = [];
  const site = {
    async sidebar(items) {
      asks.push({ items, at: clock.now });
      return answer ? answer(asks.length, clock) : { status: 'ok', items: new Map([['chain', null]]), links: [] };
    },
  };
  const writes = [];
  const timers = fakeTimers();
  const beeps = [];
  const watch = mountWatch({
    win: window,
    site,
    hasKey: () => key,
    store: { read: async () => saved, write: async (v) => { writes.push(structuredClone(v)); return true; } },
    timers,
    now: () => clock.now,
    onMutation: dom.onMutation,
    beep: () => beeps.push(clock.now),
  });
  await watch.ready;
  await settle();
  const box = () => window.document.getElementById(BOX_ID);
  return {
    window,
    doc: window.document,
    watch,
    timers,
    clock,
    asks,
    writes,
    beeps,
    box,
    text: (cls) => box()?.querySelector(`.ttc-watch-${cls}`)?.textContent,
    state: () => box()?.dataset.state,
    /** Lets time pass, beat by beat, as the drawing interval would. */
    async pass(ms, step = 250) {
      for (let done = 0; done < ms; done += step) {
        clock.now += Math.min(step, ms - done);
        timers.beat();
      }
      await settle();
    },
    hide(value = true) {
      hidden = value;
      window.document.dispatchEvent(new window.Event('visibilitychange'));
    },
    setBar(time, value) {
      const node = window.document.getElementById('barChain');
      node.querySelector('[class*="bar-timeleft"]').textContent = time;
      if (value) node.querySelector('[class*="bar-value"]').textContent = value;
    },
  };
}

/** A sidebar answer with a chain that times out in `secondsLeft`, read `ageS` ago. */
const chainAnswer = (clock, secondsLeft, ageS = 0) => {
  const iso = (ms) => new Date(ms).toISOString();
  const body = { server_time: iso(clock.now), chain: { current: 88, max: 100, timeout_at: iso(clock.now + secondsLeft * 1000), as_of: iso(clock.now - ageS * 1000) } };
  return { status: 'ok', ...readSidebar(body, ['chain'], 0) };
};

describe('the pieces', () => {
  test('the thresholds: above 1:00 OK, 1:00 to 0:30 Warning, under 0:30 Danger, 0 No chain', () => {
    assert.equal(stateFor(61), 'ok');
    assert.equal(stateFor(60), 'warning');
    assert.equal(stateFor(30), 'warning');
    assert.equal(stateFor(29), 'danger');
    assert.equal(stateFor(1), 'danger');
    assert.equal(stateFor(0), 'nochain');
  });

  test('the clock reads like Torn\'s', () => {
    assert.equal(clockText(90), '1:30');
    assert.equal(clockText(5), '0:05');
    assert.equal(clockText(3729), '1:02:09');
  });

  test('the chain bar is read, never changed; anything odd is no bar', () => {
    const { window } = new JSDOM(`<!doctype html><body>${BAR('2:31', '1,204 / 2,500')}</body>`);
    windows.push(window);
    const before = window.document.body.innerHTML;
    assert.deepEqual(readChainBar(window.document), { current: 1204, max: 2500, seconds: 151 });
    assert.equal(window.document.body.innerHTML, before);
    window.document.querySelector('[class*="bar-timeleft"]').textContent = 'soon';
    assert.equal(readChainBar(window.document), null);
    window.document.getElementById('barChain').remove();
    assert.equal(readChainBar(window.document), null);
  });

  test('text is black or white, whichever reads better on the colour', () => {
    assert.equal(textOn('#ffffff'), '#000000');
    assert.equal(textOn('#000000'), '#ffffff');
    assert.equal(textOn(DEFAULT_COLOURS.danger), '#ffffff');
    assert.equal(textOn(DEFAULT_COLOURS.warning), '#000000');
  });

  test('stored settings are taken field by field, anything odd falling back', () => {
    assert.deepEqual(normalizeWatch(null), watchDefaults());
    const odd = normalizeWatch({ on: 'yes', width: 5, height: 50, left: -3, top: 10, colours: { ok: '#ABCDEF', danger: 'red' }, sound: true });
    assert.equal(odd.on, false);
    assert.equal(odd.width, null);
    assert.equal(odd.height, 50);
    assert.equal(odd.left, null);
    assert.equal(odd.top, 10);
    assert.equal(odd.colours.ok, '#abcdef');
    assert.equal(odd.colours.danger, DEFAULT_COLOURS.danger);
    assert.equal(odd.sound, true);
  });

  test('watch mode starts off', () => {
    assert.equal(watchDefaults().on, false);
    assert.equal(watchDefaults().sound, false);
  });
});

describe('acceptance test 9: the states from Torn\'s chain bar', () => {
  for (const [time, state, label] of [['1:30', 'ok', 'OK'], ['0:45', 'warning', 'HIT SOON'], ['0:20', 'danger', 'HIT NOW']]) {
    test(`a bar at ${time} shows ${label}`, async () => {
      const t = await mount({ html: BAR(time) });
      assert.equal(t.state(), state);
      assert.equal(t.text('time'), time);
      assert.equal(t.text('state'), label);
      assert.equal(t.text('count'), '412 / 500');
      assert.equal(t.text('source'), 'from Torn’s chain bar');
      assert.equal(t.asks.length, 0, 'the bar is there: nothing is asked');
    });
  }

  test('the box follows the bar as it changes', async () => {
    const t = await mount({ html: BAR('1:30') });
    t.setBar('0:25');
    await t.pass(250);
    assert.equal(t.state(), 'danger');
  });

  test('every state carries its name as text, not colour only', async () => {
    const t = await mount({ html: BAR('1:30') });
    assert.equal(t.text('state'), 'OK');
    assert.equal(t.box().querySelector('[role=status]').getAttribute('aria-live'), 'polite');
  });

  test('a chain at 0 is No chain, in grey', async () => {
    const t = await mount({ html: BAR('0:00', '0 / 10') });
    assert.equal(t.state(), 'nochain');
    assert.equal(t.text('state'), 'No chain');
  });
});

describe('acceptance test 13: the flash is fixed at 0.5 per second', () => {
  test('Danger alternates the danger and flash colours every second', async () => {
    const t = await mount({ html: BAR('0:20') });
    const colours = [];
    for (let i = 0; i < 6; i += 1) {
      colours.push(t.box().style.getPropertyValue('background-color'));
      t.setBar(`0:${String(19 - i).padStart(2, '0')}`);
      await t.pass(1000);
    }
    const [a, b] = colours;
    assert.notEqual(a, b);
    assert.deepEqual(colours, [a, b, a, b, a, b]);
  });

  test('the flash half is one second and no setting reaches it', async () => {
    assert.equal(FLASH_HALF_MS, 1000);
    const t = await mount({ html: BAR('0:20') });
    await t.watch.change({ flashMs: 50, colours: { flash: '#000000' } });
    assert.equal('flashMs' in t.watch.settings(), false);
    const first = t.box().style.getPropertyValue('background-color');
    await t.pass(500);
    assert.equal(t.box().style.getPropertyValue('background-color'), first, 'still the same colour half a second on');
  });
});

describe('acceptance test 10: without a chain bar, the site\'s chain, and never too often', () => {
  test('the sidebar read is used, counted down, with its source line', async () => {
    const t = await mount({ answer: (n, clock) => chainAnswer(clock, 45, 10) });
    assert.equal(t.state(), 'warning');
    assert.equal(t.text('count'), '88 / 100');
    assert.match(t.text('source'), /^from torn-tracker · up to 10 s old$/);
    await t.pass(20_000);
    assert.equal(t.state(), 'danger', 'counted down locally');
  });

  test('it asks at most every 30 seconds, and only for the chain', async () => {
    const t = await mount();
    assert.equal(t.asks.length, 1);
    assert.deepEqual(t.asks[0].items, ['chain']);
    t.timers.run();
    await settle();
    assert.equal(t.asks.length, 1, 'no time has passed');
    t.clock.now += ASK_EVERY_MS;
    t.timers.run();
    await settle();
    assert.equal(t.asks.length, 2);
    t.clock.now += ASK_EVERY_MS - 1;
    t.timers.run();
    await settle();
    assert.equal(t.asks.length, 2);
    for (const [, timer] of t.timers.pending) assert.equal(timer.ms, ASK_EVERY_MS);
  });

  test('never while the tab is hidden; it asks again when it comes back', async () => {
    const t = await mount();
    t.hide();
    t.clock.now += ASK_EVERY_MS * 3;
    t.timers.run();
    t.timers.run();
    await settle();
    assert.equal(t.asks.length, 1);
    t.hide(false);
    await settle();
    assert.equal(t.asks.length, 2);
  });

  test('never while watch mode is off', async () => {
    const t = await mount({ saved: { on: false } });
    t.clock.now += ASK_EVERY_MS * 3;
    t.timers.run();
    await settle();
    assert.equal(t.asks.length, 0);
    assert.equal(t.box(), null);
  });

  test('never while the page has a chain bar', async () => {
    const t = await mount({ html: BAR('2:00') });
    for (let i = 0; i < 4; i += 1) {
      t.clock.now += ASK_EVERY_MS;
      t.timers.beat();
      t.timers.run();
    }
    await settle();
    assert.equal(t.asks.length, 0);
  });

  test('a "wait" answer is honoured', async () => {
    const t = await mount({ answer: (n) => (n === 1 ? { status: 'wait', retryMs: 120_000 } : { status: 'ok', items: new Map([['chain', null]]), links: [] }) });
    t.clock.now += ASK_EVERY_MS;
    t.timers.run();
    await settle();
    assert.equal(t.asks.length, 1);
    t.clock.now += 90_000;
    t.timers.run();
    await settle();
    assert.equal(t.asks.length, 2);
  });

  test('no faction chain is No chain, from torn-tracker', async () => {
    const t = await mount();
    assert.equal(t.state(), 'nochain');
    assert.match(t.text('source'), /^from torn-tracker/);
  });
});

describe('acceptance test 11: a stale box never looks safe', () => {
  test('91 seconds with no source is No data, never green', async () => {
    const t = await mount({ answer: (n, clock) => (n === 1 ? chainAnswer(clock, 300) : { status: 'failed' }) });
    assert.equal(t.state(), 'ok');
    for (let s = 0; s < 91; s += 1) {
      await t.pass(1000, 1000);
      t.timers.run();
      await settle();
      if (s < 90) assert.notEqual(t.state(), 'nodata', `at ${s + 1} s`);
    }
    assert.equal(t.state(), 'nodata');
    assert.equal(t.text('state'), 'No data');
    assert.notEqual(t.box().style.getPropertyValue('background-color'), t.box().style.getPropertyValue('color'));
  });

  test('a chain bar that goes away is stale after 90 s, unless the site answers', async () => {
    const t = await mount({ html: BAR('5:00'), key: false });
    t.doc.getElementById('barChain').remove();
    await t.pass(STALE_AFTER_MS + 1000, 1000);
    assert.equal(t.state(), 'nodata');
  });

  test('no script key and no bar: No data, saying why', async () => {
    const t = await mount({ key: false });
    assert.equal(t.asks.length, 0);
    assert.equal(t.state(), 'nodata');
    assert.match(t.text('source'), /script key/);
  });

  test('a refused key: No data, saying why', async () => {
    const t = await mount({ answer: () => ({ status: 'refused' }) });
    assert.equal(t.state(), 'nodata');
    assert.match(t.text('source'), /refused/);
  });
});

describe('acceptance test 12: the box stays out of the way', () => {
  test('it lets clicks through except on its handle and close control, each 44 px or more', async () => {
    const t = await mount({ html: BAR('1:30') });
    const css = t.doc.getElementById('ttc-watch-style').textContent;
    assert.match(css, /#ttc-watch \{[^}]*pointer-events: none;/);
    assert.match(css, /\.ttc-watch-handle, #ttc-watch \.ttc-watch-close \{[^}]*pointer-events: auto;[^}]*min-height: 44px; min-width: 44px;/);
  });

  test('it never touches Torn\'s chain bar', async () => {
    const t = await mount({ html: BAR('0:20') });
    const before = t.doc.getElementById('sidebar').outerHTML;
    await t.pass(3000);
    assert.equal(t.doc.getElementById('sidebar').outerHTML, before);
  });

  test('the close control turns watch mode off, and that is saved', async () => {
    const t = await mount({ html: BAR('1:30') });
    t.box().querySelector('.ttc-watch-close').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
    await settle();
    assert.equal(t.box(), null);
    assert.equal(t.writes.at(-1).on, false);
  });
});

describe('CHW-025, CHW-027 size, place and colours, kept on this device', () => {
  test('desktop default: 40% by 25% at the top centre', async () => {
    const t = await mount({ html: BAR('1:30') });
    assert.deepEqual(t.watch.sizeOf(), DESKTOP_SIZE);
    assert.equal(t.box().style.getPropertyValue('width'), '40vw');
    assert.equal(t.box().style.getPropertyValue('left'), '30vw');
  });

  test('on a phone or in PDA: 90% by 20%', async () => {
    assert.deepEqual((await mount({ width: 400 })).watch.sizeOf(), PHONE_SIZE);
    assert.deepEqual((await mount({ pda: true })).watch.sizeOf(), PHONE_SIZE);
  });

  test('changes show at once, are saved, and the resets bring the defaults back', async () => {
    const t = await mount({ html: BAR('1:30') });
    await t.watch.change({ width: 60, colours: { ok: '#0000ff' } });
    assert.equal(t.box().style.getPropertyValue('width'), '60vw');
    assert.equal(t.writes.at(-1).width, 60);
    assert.equal(t.writes.at(-1).colours.ok, '#0000ff');
    assert.equal(t.box().style.getPropertyValue('color'), 'rgb(255, 255, 255)');
    await t.watch.resetSize();
    assert.equal(t.writes.at(-1).width, null);
    assert.equal(t.box().style.getPropertyValue('width'), '40vw');
    await t.watch.resetColours();
    assert.deepEqual(t.writes.at(-1).colours, DEFAULT_COLOURS);
  });

  test('saved settings come back on the next page', async () => {
    const t = await mount({ html: BAR('1:30'), saved: { on: true, width: 55, height: 30, left: 5, top: 50, colours: { ok: '#123456' } } });
    assert.equal(t.box().style.getPropertyValue('width'), '55vw');
    assert.equal(t.box().style.getPropertyValue('top'), '50vh');
    assert.equal(t.watch.settings().colours.ok, '#123456');
  });

  test('arrow keys on the handle move the box, and it stays on screen', async () => {
    const t = await mount({ html: BAR('1:30') });
    const handle = t.box().querySelector('.ttc-watch-handle');
    handle.dispatchEvent(new t.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(t.box().style.getPropertyValue('left'), '32vw');
    for (let i = 0; i < 40; i += 1) handle.dispatchEvent(new t.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(t.box().style.getPropertyValue('left'), '60vw');
    assert.equal(t.writes.at(-1).left, 60);
  });

  test('"Forget me" puts everything back and takes the box away', async () => {
    const t = await mount({ html: BAR('1:30'), saved: { on: true, width: 70 } });
    t.watch.forgotten();
    assert.equal(t.box(), null);
    assert.deepEqual(t.watch.settings(), watchDefaults());
  });
});

describe('CHW-025 the preview', () => {
  test('it runs through OK, Warning and Danger, stops by itself, and asks nothing', async () => {
    const t = await mount({ saved: { on: false }, key: true });
    t.watch.preview();
    const seen = new Set([t.state()]);
    assert.equal(t.text('time'), clockText(PREVIEW_FROM_S));
    assert.match(t.text('source'), /Preview/);
    for (let i = 0; i < (PREVIEW_FROM_S - PREVIEW_TO_S) * 4; i += 1) {
      await t.pass(250);
      if (t.box()) seen.add(t.state());
    }
    assert.deepEqual([...seen].sort(), ['danger', 'ok', 'warning']);
    assert.equal(t.watch.previewing(), false);
    assert.equal(t.box(), null, 'watch mode was off, so the box goes with the preview');
    assert.equal(t.asks.length, 0);
    assert.equal(t.writes.length, 0, 'a preview changes no setting');
  });

  test('no beep in the preview, even with the beep on', async () => {
    const t = await mount({ saved: { on: false, sound: true } });
    t.watch.preview();
    await t.pass((PREVIEW_FROM_S - PREVIEW_TO_S) * 1000, 1000);
    assert.deepEqual(t.beeps, []);
  });
});

describe('CHW-028 the beep', () => {
  test('off by default; when on, once on entering Danger, not every second', async () => {
    const quiet = await mount({ html: BAR('0:20') });
    assert.deepEqual(quiet.beeps, []);
    const t = await mount({ html: BAR('0:35'), saved: { on: true, sound: true } });
    assert.deepEqual(t.beeps, []);
    t.setBar('0:29');
    await t.pass(3000);
    assert.equal(t.beeps.length, 1);
  });
});
