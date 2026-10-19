// Starts and stops features as the player moves around the site (CMP-003, CMP-004).
//
// Two rules matter more than the mechanics:
//   - a feature switched off never has start() called, so nothing of it runs;
//   - a feature that throws is caught here, logged once, and switched off for the rest of
//     the page view, while every other feature carries on.

import { matchesAny } from './routes.js';
import { isEnabled } from './settings.js';
import { error, log } from './log.js';

export class FeatureRunner {
  /**
   * @param {object} opts
   * @param {ReadonlyArray<object>} opts.registry
   * @param {() => object} opts.getSettings   read afresh, so a panel save takes effect
   * @param {(descriptor: object) => object} opts.makeContext
   */
  constructor({ registry, getSettings, makeContext }) {
    this.registry = registry;
    this.getSettings = getSettings;
    this.makeContext = makeContext;
    /** @type {Set<string>} features currently started */
    this.active = new Set();
    /** @type {Set<string>} features that threw; not started again this page view */
    this.broken = new Set();
  }

  /** @param {{pathname: string, search: string, hash: string}} loc */
  update(loc) {
    const settings = this.getSettings();
    for (const d of this.registry) {
      const wanted = !this.broken.has(d.id)
        && isEnabled(settings, d.id)
        && matchesAny(d.routes, loc);
      if (wanted && !this.active.has(d.id)) this.#start(d);
      else if (!wanted && this.active.has(d.id)) this.#stop(d);
    }
  }

  stopAll() {
    for (const d of this.registry) if (this.active.has(d.id)) this.#stop(d);
  }

  /** A new page view forgives the features that broke on the last one. */
  reset() {
    this.stopAll();
    this.broken.clear();
  }

  #start(d) {
    this.active.add(d.id);
    try {
      d.start(this.makeContext(d));
      log('started', d.id);
    } catch (err) {
      this.#disable(d, 'start', err);
    }
  }

  #stop(d) {
    this.active.delete(d.id);
    try {
      d.stop();
    } catch (err) {
      this.#disable(d, 'stop', err);
    }
  }

  #disable(d, phase, err) {
    this.active.delete(d.id);
    this.broken.add(d.id);
    error(`feature "${d.id}" failed in ${phase} and is off for this page view`, err);
    if (phase === 'start') {
      // It may have got halfway; let it clean up, but never let that failure spread.
      try {
        d.stop();
      } catch { /* already reported */ }
    }
  }
}
