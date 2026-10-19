// Shared helpers: runs the userscript against a fake Torn page inside jsdom.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SCRIPT_PATH = path.join(__dirname, '..', 'torn-tracker-companion.user.js');
const SCRIPT = fs.readFileSync(SCRIPT_PATH, 'utf8');
const PREFIX = 'ttc';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// Every window we open; closed by closeAll() so the test process can exit cleanly.
const windows = [];
function closeAll() {
  for (const w of windows.splice(0)) w.close();
}

// In-memory stand-in for Torn PDA's PDA_storage (async, per-script key/value store).
function fakePdaStorage() {
  const store = new Map();
  return {
    store,
    async get(key, def) { return store.has(key) ? store.get(key) : def; },
    async set(key, value) { store.set(key, JSON.parse(JSON.stringify(value))); },
    async delete(key) { store.delete(key); },
  };
}

/**
 * Boots the script on a page.
 * @param {string} bodyHtml             markup for <body>, mimicking the Torn page under test
 * @param {object} [opts]
 * @param {string} [opts.savedSettings] JSON to seed localStorage with before the script runs
 * @param {object} [opts.pdaStorage]    object to expose as window.PDA_storage
 */
async function boot(bodyHtml, opts = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${bodyHtml}</body></html>`, {
    url: 'https://www.torn.com/',
    runScripts: 'outside-only',
    beforeParse(window) {
      if (opts.savedSettings) window.localStorage.setItem(`${PREFIX}_settings`, opts.savedSettings);
      if (opts.pdaStorage) window.PDA_storage = opts.pdaStorage;
    },
  });
  const { window } = dom;
  windows.push(window);
  window.eval(SCRIPT);
  await tick(); // boot() is async (storage load)
  const doc = window.document;
  return {
    dom,
    window,
    doc,
    fab: () => doc.getElementById(`${PREFIX}-fab`),
    panel: () => doc.getElementById(`${PREFIX}-panel`),
    badge: () => doc.querySelector(`#${PREFIX}-fab .${PREFIX}-count`),
    tick,
  };
}

module.exports = { boot, closeAll, tick, fakePdaStorage, PREFIX, SCRIPT };
