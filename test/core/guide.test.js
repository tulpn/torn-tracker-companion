// The guide's next step in the settings page (hq #155, WP-GDE-4; GDE-007): the read, its
// pacing, and the strip.

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createGuide, stripOf } from '../../src/core/guide.js';
import { GUIDE_URL, SPACES, createSite, readGuide, validGuide } from '../../src/core/site.js';
import { createCache } from '../../src/core/cache.js';
import { createRegistry } from '../../src/core/registry.js';
import { defaults, normalize } from '../../src/core/settings.js';
import { mountPanel } from '../../src/core/panel.js';
import { emptyKeys } from '../../src/core/keys.js';

const KEY = `tt_feed_${'G'.repeat(43)}`;
const windows = [];
after(() => windows.forEach((w) => w.close()));

const REPLY = {
  started: true,
  offer: false,
  done: 6,
  total: 9,
  next: { key: 'alerts', title: 'Set your first alerts', outcome: 'Get told when your faction’s chain is about to drop.', cta_label: 'Set an alert', cta_url: '/alerts/new/' },
  url: 'https://www.torn-tracker.com/guide/',
};

const at = (url) => {
  const u = new URL(url);
  return { pathname: u.pathname, search: u.search, hash: u.hash };
};

function siteRig({ reply = () => ({ ok: true, status: 200, data: REPLY }), key = KEY } = {}) {
  let clock = Date.UTC(2026, 9, 24, 12);
  const calls = [];
  const site = createSite({
    getKey: () => key,
    send: async (url, opts) => {
      calls.push({ url, ...opts });
      return reply();
    },
    cache: createCache(SPACES, { now: () => clock }),
  });
  return { site, calls, tick: (ms) => { clock += ms; } };
}

describe('GDE-007 the guide read', () => {
  test('only what fits is kept; a path on our site becomes a link on it, any other host is dropped', () => {
    const read = readGuide(REPLY);
    assert.deepEqual(read.next, {
      title: 'Set your first alerts', outcome: 'Get told when your faction’s chain is about to drop.', cta: 'Set an alert',
      href: 'https://www.torn-tracker.com/alerts/new/',
    });
    assert.equal(validGuide(read), true);
    assert.equal(readGuide({ ...REPLY, next: { ...REPLY.next, cta_url: 'https://evil.example/' } }).next, null);
    assert.equal(readGuide({ ...REPLY, next: { ...REPLY.next, cta_url: '//evil.example/' } }).next, null);
    assert.equal(readGuide({ ...REPLY, url: 'javascript:alert(1)' }).url, 'https://www.torn-tracker.com/guide/');
    assert.equal(readGuide({ ...REPLY, done: 12 }).done, 9);
    assert.equal(readGuide({ ...REPLY, total: 0 }), null);
    assert.equal(readGuide({ done: 1, total: 9 }), null, 'started is required');
    assert.equal(validGuide({ ...read, next: { ...read.next, href: 'https://evil.example/' } }), false);
  });

  test('one request with the script key, then the kept answer for 15 minutes; no key asks nothing', async () => {
    const r = siteRig();
    assert.equal((await r.site.guide()).done, 6);
    assert.equal(r.calls[0].url, GUIDE_URL);
    assert.equal(r.calls[0].headers.Authorization, `Bearer ${KEY}`);
    await r.site.guide();
    assert.equal(r.calls.length, 1);
    assert.equal(r.site.guideHeld().total, 9);
    r.tick(15 * 60_000);
    assert.equal(r.site.guideHeld(), null);
    await r.site.guide();
    assert.equal(r.calls.length, 2);
    const none = siteRig({ key: '' });
    assert.equal(await none.site.guide(), null);
    assert.equal(none.calls.length, 0);
  });
});

describe('GDE-007 the strip', () => {
  test('the next step while the guide runs; the offer only while the site still offers it; nothing when it’s finished', () => {
    assert.equal(stripOf(readGuide(REPLY)).kind, 'next');
    assert.equal(stripOf(readGuide({ ...REPLY, started: false, offer: true, next: null })).kind, 'offer');
    assert.equal(stripOf(readGuide({ ...REPLY, started: false, offer: false })), null, 'dismissed on the site');
    assert.equal(stripOf(readGuide({ ...REPLY, done: 9, next: null })), null, 'finished');
    assert.equal(stripOf(null), null);
  });

  test('it asks on a Torn page load while nothing fresh is kept, never on the attack page or a hidden tab, and not when switched off', async () => {
    const { window } = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.torn.com/' });
    windows.push(window);
    const r = siteRig();
    let settings = defaults(createRegistry([]));
    const guide = createGuide({ doc: window.document, site: r.site, getSettings: () => settings });
    let told = 0;
    guide.onChange(() => { told += 1; });

    guide.update(at('https://www.torn.com/loader.php?sid=attack&user2ID=1'));
    await guide.settled();
    assert.equal(r.calls.length, 0);
    Object.defineProperty(window.document, 'visibilityState', { value: 'hidden', configurable: true });
    guide.update(at('https://www.torn.com/index.php'));
    assert.equal(r.calls.length, 0);
    Object.defineProperty(window.document, 'visibilityState', { value: 'visible', configurable: true });
    guide.update(at('https://www.torn.com/index.php'));
    await guide.settled();
    assert.equal(r.calls.length, 1);
    assert.equal(told, 1);
    assert.equal(guide.strip().title, 'Set your first alerts');
    guide.update(at('https://www.torn.com/index.php'));
    await guide.settled();
    assert.equal(r.calls.length, 1, 'the kept answer is used');

    settings = normalize({ guideStrip: false }, createRegistry([]));
    assert.equal(guide.strip(), null);
    r.tick(15 * 60_000);
    guide.update(at('https://www.torn.com/index.php'));
    await guide.settled();
    assert.equal(r.calls.length, 1);
  });

  test('the settings page shows it above every section, with its call to action; the switch is under General', async () => {
    const { window } = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.torn.com/' });
    windows.push(window);
    const registry = createRegistry([]);
    assert.equal(defaults(registry).guideStrip, true);
    let current = defaults(registry);
    const saves = [];
    let strip = stripOf(readGuide(REPLY));
    const listeners = new Set();
    const guide = { strip: () => strip, onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
    const panel = mountPanel({
      doc: window.document,
      registry,
      version: '9.9.9',
      getSettings: () => current,
      getKeys: () => emptyKeys(),
      onSave: async (s) => { saves.push(s); current = s; return true; },
      onReset: async () => {},
      onForget: async () => true,
      credits: [],
      guide,
    });
    panel.open('features');
    const box = panel.panel.querySelector('#ttc-guide');
    assert.match(box.textContent, /6 of 9 done.*Set your first alerts/s);
    const links = [...box.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]);
    assert.deepEqual(links, [['Set an alert', 'https://www.torn-tracker.com/alerts/new/'], ['The whole guide', 'https://www.torn-tracker.com/guide/']]);

    strip = stripOf(readGuide({ ...REPLY, started: false, offer: true, next: null }));
    listeners.forEach((fn) => fn());
    assert.match(panel.panel.querySelector('#ttc-guide').textContent, /Start the guide/);
    strip = null;
    listeners.forEach((fn) => fn());
    assert.equal(panel.panel.querySelector('#ttc-guide'), null);
    assert.doesNotMatch(panel.panel.querySelector('main').textContent, /^null/);

    panel.open('general');
    const sw = panel.panel.querySelector('[data-setting=guideStrip]');
    sw.checked = false;
    sw.dispatchEvent(new window.Event('change', { bubbles: true }));
    panel.panel.querySelector('[data-act=save]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(saves.at(-1).guideStrip, false);
    panel.destroy();
  });
});
