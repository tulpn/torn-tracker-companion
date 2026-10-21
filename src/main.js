// Boot: load the settings, keys and upload queue, start the router, put the panel on the
// page.
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
import { startRouter } from './core/router.js';
import { VERSION } from './core/version.js';
import { defaults, isShared, load, normalize, save } from './core/settings.js';
import { forget } from './core/storage.js';
import { error, log, setDebug } from './core/log.js';
import * as dom from './core/dom.js';
import * as net from './core/net.js';
import * as intercept from './core/intercept.js';

export async function boot(win = globalThis) {
  const registry = createRegistry(features);
  let settings = await load(registry);
  let keys = await loadKeys();
  setDebug(settings.debug);

  let panel = null;
  const uploader = createUploader({
    getKey: () => keys.script,
    timers: win,
    onChange: () => panel?.updateQueue(),
  });
  await uploader.load();
  const site = createSite({ getKey: () => keys.script });
  await site.cache.load();
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
      /** Saves the feature's own data; returns it as stored, after its checks. */
      saveData: async (value) => {
        settings = normalize({ ...settings, featureData: { ...settings.featureData, [descriptor.id]: value } }, registry);
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
    return ok;
  };

  const applyKeys = async (next) => {
    const keyChanged = next.script !== keys.script;
    keys = { ...next };
    const ok = await saveKeys(keys);
    if (keyChanged) uploader.keyChanged();
    return ok;
  };

  const stopRouter = startRouter((loc) => runner.update(loc), win);

  panel = mountPanel({
    doc: win.document,
    registry,
    version: VERSION,
    getSettings: () => settings,
    getKeys: () => keys,
    getQueue: () => uploader.status(),
    onSave: async (nextSettings, nextKeys) => {
      const savedKeys = await applyKeys(nextKeys);
      // The panel edits options and switches; features' own data is never its to change.
      const savedSettings = await apply({ ...nextSettings, featureData: settings.featureData });
      return savedKeys && savedSettings;
    },
    onReset: () => apply({ ...defaults(registry), featureData: settings.featureData }),
    onForget: async () => {
      uploader.clear();
      site.cache.clear();
      const ok = await forget();
      settings = defaults(registry);
      keys = emptyKeys();
      setDebug(false);
      restart();
      return ok;
    },
  });

  // The sidebar link, the header icon, or the edge tab where neither fits (CMP-107).
  const entry = mountEntry({ doc: win.document, onOpen: () => panel.toggle(), onMutation: dom.onMutation });

  log('started', VERSION, `${registry.length} features`);

  return {
    registry,
    runner,
    panel,
    entry,
    uploader,
    get settings() {
      return settings;
    },
    stop() {
      stopRouter();
      uploader.stop();
      win.removeEventListener('pagehide', onPageHide);
      runner.reset();
      entry.destroy();
      panel.destroy();
    },
  };
}

// The bundle runs as soon as the manager injects it; tests import boot() instead.
if (globalThis.document) {
  boot(globalThis).catch((err) => error('failed to start', err));
}
