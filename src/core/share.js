// The gate every observation passes before it can be uploaded (CMP-014).
//
// Two conditions, both of which must hold, and neither of which a feature can skip:
// the feature declared the kind in its descriptor, and the player switched that kind on.
// Turning a feature on never turns sharing on.
//
// The queue and the flush behind `sink` land with WP-CMP-4; the gate is here because it
// is the part that must never be optional.

import { isShared } from './settings.js';
import { VERSION } from './version.js';
import { log, warn } from './log.js';

/**
 * @param {object} opts
 * @param {object} opts.descriptor
 * @param {() => object} opts.getSettings
 * @param {(observation: object) => void} opts.sink
 * @returns {(kind: string, data: object) => boolean} true when the observation was queued
 */
export function createSharer({ descriptor, getSettings, sink }) {
  return function share(kind, data) {
    if (!descriptor.shares.includes(kind)) {
      warn(`feature "${descriptor.id}" tried to share "${kind}", which it does not declare`);
      return false;
    }
    if (!isShared(getSettings(), kind)) return false;

    sink({
      kind,
      // The device clock; the server's offset correction arrives with the queue.
      observed_at: new Date().toISOString(),
      script_version: VERSION,
      data,
    });
    log('queued', kind, 'from', descriptor.id);
    return true;
  };
}
