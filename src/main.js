// Boot: load the settings, start the router, put the panel on the page.
//
// Torn Tracker Companion — https://github.com/tulpn/torn-tracker-companion
// Copyright (C) 2026 tulpn. Licensed under the GNU GPL, version 3 or later.

import features from './features/index.js';
import { createRegistry } from './core/registry.js';
import { FeatureRunner } from './core/runner.js';
import { createSharer } from './core/share.js';
import { mountPanel } from './core/panel.js';
import { startRouter } from './core/router.js';
import { VERSION } from './core/version.js';
import { defaults, load, normalize, save } from './core/settings.js';
import { forget } from './core/storage.js';
import { error, log, setDebug } from './core/log.js';
import * as dom from './core/dom.js';
import * as net from './core/net.js';
import * as intercept from './core/intercept.js';

/** Mirrors the queue's own limit (CMP-008) so nothing grows without bound before WP-CMP-4. */
const MAX_PENDING = 200;

export async function boot(win = globalThis) {
  const registry = createRegistry(features);
  let settings = await load(registry);
  setDebug(settings.debug);

  // Observations wait here until the upload queue lands (WP-CMP-4). Nothing is sent yet.
  const pending = [];
  const sink = (observation) => {
    pending.push(observation);
    if (pending.length > MAX_PENDING) pending.shift();
  };

  const runner = new FeatureRunner({
    registry,
    getSettings: () => settings,
    makeContext: (descriptor) => ({
      id: descriptor.id,
      version: VERSION,
      settings: settings.features[descriptor.id],
      dom,
      net,
      intercept,
      log,
      share: createSharer({ descriptor, getSettings: () => settings, sink }),
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

  const stopRouter = startRouter((loc) => runner.update(loc), win);

  const panel = mountPanel({
    doc: win.document,
    registry,
    version: VERSION,
    getSettings: () => settings,
    onSave: apply,
    onReset: () => apply(defaults(registry)),
    onForget: async () => {
      const ok = await forget();
      settings = defaults(registry);
      setDebug(false);
      restart();
      return ok;
    },
  });

  log('started', VERSION, `${registry.length} features`);

  return {
    registry,
    runner,
    panel,
    pending,
    get settings() {
      return settings;
    },
    stop() {
      stopRouter();
      runner.reset();
      panel.destroy();
    },
  };
}

// The bundle runs as soon as the manager injects it; tests import boot() instead.
if (globalThis.document) {
  boot(globalThis).catch((err) => error('failed to start', err));
}
