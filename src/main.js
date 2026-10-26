// Boot: load the settings, keys and upload queue, start the router, put the way into the
// settings and the sidebar block in Torn's sidebar, and watch for new achievements and the
// guide's next step.
//
// Torn Tracker Companion — https://github.com/tulpn/torn-tracker-companion
// Copyright (C) 2026 tulpn. Licensed under the GNU GPL, version 3 or later.

import features from './features/index.js';
import { createRegistry } from './core/registry.js';
import { FeatureRunner } from './core/runner.js';
import { createSharer } from './core/share.js';
import { createUploader } from './core/upload.js';
import { createSite } from './core/site.js';
import { emptyKeys, loadKeys, saveKeys } from './core/keys.js';
import { mountPanel } from './core/panel.js';
import { mountEntry } from './core/entry.js';
import { mountPage } from './core/page.js';
import { mountSidebarBlock } from './core/sidebar.js';
import { createTours } from './core/tours.js';
import { createUnlocks } from './core/unlocks.js';
import { createGuide } from './core/guide.js';
import { tornTheme } from './core/tokens.js';
import { startRouter } from './core/router.js';
import { VERSION } from './core/version.js';
import { defaults, isEnabled, isShared, load, normalize, save } from './core/settings.js';
import { KEYS, forget, read, write } from './core/storage.js';
import { error, log, setDebug, warn } from './core/log.js';
import * as dom from './core/dom.js';
import * as net from './core/net.js';
import * as intercept from './core/intercept.js';

export async function boot(win = globalThis) {
  const registry = createRegistry(features);
  let settings = await load(registry);
  let keys = await loadKeys();
  setDebug(settings.debug);

  let panel = null;
  let block = null;

  // Tours (UXT-022): a step's `requires` is a feature switch, a missing key or the sidebar block.
  const tours = createTours({
    win,
    store: { read: () => read(KEYS.tours), write: (value) => write(KEYS.tours, value) },
    isMet: (requires) => {
      if (requires.startsWith('feature:')) return isEnabled(settings, requires.slice('feature:'.length));
      if (requires === 'nokey:script') return !keys.script;
      if (requires === 'sidebar') return settings.sidebar?.enabled === true;
      return false;
    },
    onMutation: dom.onMutation,
  });
  await tours.load();
  const uploader = createUploader({
    getKey: () => keys.script,
    timers: win,
    onChange: () => panel?.updateQueue(),
  });
  await uploader.load();
  const site = createSite({ getKey: () => keys.script, onBanned: () => uploader.banned() });
  await site.cache.load();
  // Achievements (WP-UX-8): a toast when one is earned, the featured ones in the settings header.
  const unlocks = createUnlocks({
    doc: win.document,
    site,
    getSettings: () => settings,
    store: { read: () => read(KEYS.unlocks), write: (value) => write(KEYS.unlocks, value) },
    timers: win,
    now: uploader.serverNow,
  });
  await unlocks.load();
  // The guide's next step on the settings page (GDE-007).
  const guide = createGuide({ doc: win.document, site, getSettings: () => settings });
  // Leaving the page is the player's own action; whatever is waiting goes with it.
  const onPageHide = () => uploader.flush({ keepalive: true });
  win.addEventListener('pagehide', onPageHide);

  const runner = new FeatureRunner({
    registry,
    getSettings: () => settings,
    makeContext: (descriptor) => ({
      id: descriptor.id,
      version: VERSION,
      settings: settings.features[descriptor.id],
      // Features read the page through these rather than globals, so a test can hand
      // them a saved page.
      win,
      doc: win.document,
      now: uploader.serverNow,
      site,
      dom,
      net,
      intercept,
      log,
      share: createSharer({
        descriptor,
        getSettings: () => settings,
        sink: (observation) => uploader.add(observation),
        now: uploader.serverNow,
        getLocation: () => win.location,
      }),
      /** Whether the player shares this kind now; features ask before costly work for it. */
      sharing: (kind) => descriptor.shares.includes(kind) && isShared(settings, kind),
      /** The feature's own saved data (its descriptor's `data`), checked on load. */
      data: () => settings.featureData?.[descriptor.id],
      /**
       * Saves the feature's own data; returns it as stored, after its checks. Given a
       * function, it is applied to the data as storage holds it now, so a save made in
       * another tab since this one loaded is kept.
       */
      saveData: async (value) => {
        const next = typeof value === 'function' ? value((await load(registry)).featureData?.[descriptor.id]) : value;
        settings = normalize({ ...settings, featureData: { ...settings.featureData, [descriptor.id]: next } }, registry);
        await save(settings, registry);
        return settings.featureData[descriptor.id];
      },
    }),
  });

  const restart = () => {
    runner.reset();
    runner.update(win.location);
  };

  const apply = async (next) => {
    settings = normalize(next, registry);
    setDebug(settings.debug);
    const ok = await save(settings, registry);
    restart();
    block?.update();
    return ok;
  };

  const applyKeys = async (next) => {
    const keyChanged = next.script !== keys.script;
    keys = { ...next };
    const ok = await saveKeys(keys);
    if (keyChanged) uploader.keyChanged();
    return ok;
  };

  const panelOptions = {
    registry,
    version: VERSION,
    getSettings: () => settings,
    getKeys: () => keys,
    getQueue: () => uploader.status(),
    tours,
    unlocks,
    guide,
    onSave: async (nextSettings, nextKeys) => {
      const savedKeys = await applyKeys(nextKeys);
      const wasOn = new Set(registry.filter((d) => isEnabled(settings, d.id)).map((d) => d.id));
      // The panel edits options and switches; features' own data is never its to change.
      const savedSettings = await apply({ ...nextSettings, featureData: settings.featureData });
      // A feature just switched on: its page's tour starts at it next time (UXT-003).
      if (savedSettings) await tours.unlocked(registry.filter((d) => isEnabled(settings, d.id) && !wasOn.has(d.id)).map((d) => d.id));
      return savedKeys && savedSettings;
    },
    onReset: () => apply({ ...defaults(registry), featureData: settings.featureData }),
    onForget: async () => {
      uploader.clear();
      site.cache.clear();
      tours.reset();
      unlocks.reset();
      const ok = await forget();
      settings = defaults(registry);
      keys = emptyKeys();
      setDebug(false);
      restart();
      block?.update();
      return ok;
    },
  };

  // The settings route (CMP-107): the page lives in a Shadow DOM host in Torn's main
  // column while the location is /index.php#/torn-tracker.
  let entry = null;
  const page = mountPage({
    doc: win.document,
    fill: (root) => {
      panel = mountPanel({ doc: win.document, root, ...panelOptions });
    },
    onEnter: (section) => {
      panel.open(section);
      entry?.place();
    },
    onLeave: () => {
      panel.close();
      entry?.place();
    },
  });

  // The one way in: the "Torn Tracker" entry in Torn's sidebar (CMP-107). No header icon.
  entry = mountEntry({ doc: win.document, isCurrent: page.isOpen, onMutation: dom.onMutation });
  const stopPageWatch = dom.onMutation(() => page.restore(), win.document);

  // The Torn Tracker block under Lists (CMP-108).
  block = mountSidebarBlock({
    doc: win.document,
    site,
    getSettings: () => settings,
    onMutation: dom.onMutation,
    store: { read: () => read(KEYS.sidebar), write: (value) => write(KEYS.sidebar, value) },
    timers: win,
    now: uploader.serverNow,
  });

  const stopRouter = startRouter((loc) => {
    page.update(loc);
    runner.update(loc);
    tours.update(loc, { theme: tornTheme(win.document) });
    unlocks.update(loc);
    guide.update(loc);
  }, win);

  log('started', VERSION, `${registry.length} features`);

  return {
    registry,
    runner,
    panel,
    page,
    entry,
    block,
    tours,
    unlocks,
    uploader,
    get settings() {
      return settings;
    },
    stop() {
      stopRouter();
      tours.destroy();
      unlocks.destroy();
      guide.destroy();
      uploader.stop();
      win.removeEventListener('pagehide', onPageHide);
      runner.reset();
      stopPageWatch();
      page.destroy();
      entry.destroy();
      block.destroy();
      panel.destroy();
    },
  };
}

const RUNNING = 'data-ttc-running';

/**
 * One copy per page (hq #407). Installed twice (Greasy Fork and GitHub, or twice in PDA), the
 * script would start twice: two entries, two panels, every read asked twice. The first
 * copy marks <html>, which every manager's sandbox shares; a later one starts nothing.
 * @returns {string|null} null when the page is ours, else the version already running
 */
export function claimPage(doc) {
  const root = doc.documentElement;
  if (root.hasAttribute(RUNNING)) return root.getAttribute(RUNNING) || '?';
  root.setAttribute(RUNNING, VERSION);
  return null;
}

// The bundle runs as soon as the manager injects it; tests import boot() instead.
if (globalThis.document) {
  const running = claimPage(globalThis.document);
  if (running) warn(`version ${running} already runs on this page; this copy starts nothing. Remove one install.`);
  else boot(globalThis).catch((err) => error('failed to start', err));
}
