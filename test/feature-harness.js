// Runs one feature against a saved page (CMP-002, CMP-030).
//
// The page is a fixture under test/fixtures/pages/, loaded into jsdom at the URL the
// player would be on. The page's own JSON responses are fed in by the test through a
// stand-in for core/intercept.js, so a feature that reads a response and one that reads
// the DOM are tested the same way. What the feature shares is collected, and the same
// runtime guard as the built-file tests fails on a click, a submit, or a torn.com request.

import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import * as dom from '../src/core/dom.js';
import { ROOT } from './helpers.js';

export const PAGES = path.join(ROOT, 'test', 'fixtures', 'pages');

export function page(name) {
  return fs.readFileSync(path.join(PAGES, name), 'utf8');
}

export function json(name) {
  return JSON.parse(page(name));
}

/**
 * @param {object} feature   the descriptor
 * @param {object} opts
 * @param {string} [opts.html]   markup for <body>
 * @param {string} opts.url      the page the player is on
 * @param {object} [opts.settings]  the feature's settings; defaults to its defaults
 * @param {() => number} [opts.now]
 * @param {string} [opts.visibility]  'visible' (default) or 'hidden'
 */
export function runFeature(feature, {
  html = '', url, settings, now = Date.now, visibility = 'visible', site = null, sharing = () => true,
} = {}) {
  const { window } = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    url, pretendToBeVisual: true,
  });
  Object.defineProperty(window.document, 'visibilityState', { get: () => visibility, configurable: true });

  const violations = [];
  window.HTMLElement.prototype.click = function guardedClick() {
    violations.push('click()');
    throw new Error('the script must never call .click()');
  };
  window.HTMLFormElement.prototype.submit = function guardedSubmit() {
    violations.push('submit()');
    throw new Error('the script must never submit a form');
  };
  window.fetch = (input) => {
    violations.push(`fetch ${input}`);
    return Promise.reject(new Error('no network in feature tests'));
  };

  const subscribers = new Set();
  const intercept = {
    onJson(test, handler) {
      const sub = { test, handler };
      subscribers.add(sub);
      return () => subscribers.delete(sub);
    },
  };

  const shared = [];
  const ctx = {
    id: feature.id,
    version: '1.0.0',
    settings: settings ?? { ...feature.defaults },
    win: window,
    doc: window.document,
    dom,
    intercept,
    net: null,
    site,
    log: () => {},
    now,
    sharing: (kind) => feature.shares.includes(kind) && sharing(kind),
    share(kind, data) {
      if (!feature.shares.includes(kind)) throw new Error(`${feature.id} shared ${kind}, which it does not declare`);
      shared.push({ kind, ...data });
      return true;
    },
  };

  feature.start(ctx);

  return {
    window,
    doc: window.document,
    shared,
    violations,
    /** The page receiving one of its own JSON responses. */
    respond(url, data, method = 'GET', form = null) {
      for (const sub of [...subscribers]) if (sub.test(url)) sub.handler({ url, method, data, form });
    },
    /** Lets MutationObserver callbacks and promises run. */
    settle: () => new Promise((resolve) => setTimeout(resolve, 0)),
    stop() {
      feature.stop();
      dom.resetObserver();
      window.close();
    },
  };
}
