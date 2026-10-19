// Runs the built userscript against a fake Torn page inside jsdom, under the runtime
// guard that enforces Torn's scripting rules (CMP-030).
//
// The guard is defence in depth behind the rules lint: it fails the test if the script
// requests a torn.com page, calls .click() on anything, or submits a form. Tests
// simulate a player's click with userClick(), which uses the native dispatch captured
// before the guard is installed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const DIST = path.join(ROOT, 'dist');
export const SCRIPT_PATH = path.join(DIST, 'torn-tracker-companion.user.js');
export const META_PATH = path.join(DIST, 'torn-tracker-companion.meta.js');
export const PREFIX = 'ttc';

export const readBuilt = () => fs.readFileSync(SCRIPT_PATH, 'utf8');
export const readPackage = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const windows = [];
export function closeAll() {
  for (const window of windows.splice(0)) window.close();
}

/** In-memory stand-in for Torn PDA's PDA_storage. */
export function fakePdaStorage() {
  const store = new Map();
  return {
    store,
    async get(key, fallback) {
      return store.has(key) ? store.get(key) : fallback;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

const CLICKY = new Set(['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'submit']);

function isTornPage(url) {
  const text = String(url);
  if (text.includes('api.torn.com')) return false;
  return /(^|\/\/|\.)torn\.com/.test(text);
}

function installGuard(window, violations) {
  const nativeDispatch = window.EventTarget.prototype.dispatchEvent;

  window.fetch = function guardedFetch(input) {
    const url = typeof input === 'string' ? input : input?.url ?? '';
    if (isTornPage(url)) violations.push(`fetch ${url}`);
    return Promise.reject(new Error('no network in tests'));
  };

  const open = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function guardedOpen(method, url, ...rest) {
    if (isTornPage(url)) violations.push(`xhr ${url}`);
    return open.call(this, method, url, ...rest);
  };

  window.navigator.sendBeacon = function guardedBeacon(url) {
    if (isTornPage(url)) violations.push(`sendBeacon ${url}`);
    return true;
  };

  window.HTMLElement.prototype.click = function guardedClick() {
    violations.push(`click() on <${this.tagName.toLowerCase()}>`);
    throw new Error('the script must never call .click()');
  };

  window.HTMLFormElement.prototype.submit = function guardedSubmit() {
    violations.push('form.submit()');
    throw new Error('the script must never submit a form');
  };

  window.EventTarget.prototype.dispatchEvent = function guardedDispatch(event) {
    if (CLICKY.has(event?.type)) {
      violations.push(`dispatchEvent(${event.type})`);
      throw new Error(`the script must never dispatch ${event.type}`);
    }
    return nativeDispatch.call(this, event);
  };

  return { nativeDispatch };
}

/**
 * @param {string} bodyHtml             markup for <body>, mimicking the Torn page
 * @param {object} [opts]
 * @param {string} [opts.url]           the page the player is on
 * @param {string} [opts.savedSettings] JSON seeded into localStorage before boot
 * @param {object} [opts.pdaStorage]    exposed as window.PDA_storage
 */
export async function boot(bodyHtml = '', opts = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${bodyHtml}</body></html>`, {
    url: opts.url || 'https://www.torn.com/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      if (opts.savedSettings) window.localStorage.setItem(`${PREFIX}_settings`, opts.savedSettings);
      if (opts.pdaStorage) window.PDA_storage = opts.pdaStorage;
    },
  });
  const { window } = dom;
  windows.push(window);

  const violations = [];
  const { nativeDispatch } = installGuard(window, violations);

  window.eval(readBuilt());
  await tick(); // boot() reads storage asynchronously

  const doc = window.document;
  return {
    dom,
    window,
    doc,
    violations,
    fab: () => doc.getElementById(`${PREFIX}-fab`),
    panel: () => doc.getElementById(`${PREFIX}-panel`),
    /** A player's click: a trusted event, not the .click() the guard forbids. */
    userClick(node) {
      nativeDispatch.call(node, new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    },
    tick,
  };
}
