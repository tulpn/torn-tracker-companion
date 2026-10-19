// The gate every observation passes before it can be uploaded (CMP-014).
//
// Four conditions, all of which must hold, and none of which a feature can skip:
// the feature declared the kind in its descriptor, the player switched that kind on, the
// player agreed to the current wording of what is shared (settings.isShared), and the
// player is not on one of Torn's company or faction application pages, which never feed
// crowd data (D-056). Turning a feature on never turns sharing on.
//
// What passes is handed to the upload queue (upload.js) flat, the way the site takes it:
// kind, observed_at and script_version beside the kind's own fields.

import { DISCLOSURE } from './disclosure.js';
import { isShared } from './settings.js';
import { VERSION } from './version.js';
import { log, warn } from './log.js';

/**
 * Torn's company and faction application pages, and the job list's. Matched broadly on
 * purpose: missing one observation is cheap, recording from one of these pages is not.
 * @param {{pathname: string, search: string, hash: string}} loc
 */
export function isApplicationPage(loc) {
  const page = String(loc?.pathname || '').split('/').pop();
  if (!['companies.php', 'factions.php', 'joblist.php'].includes(page)) return false;
  return /applica/i.test(`${loc.search || ''}${loc.hash || ''}`);
}

/**
 * @param {object} opts
 * @param {object} opts.descriptor
 * @param {() => object} opts.getSettings
 * @param {(observation: object) => boolean|void} opts.sink  the upload queue's add()
 * @param {() => number} [opts.now]  the clock observed_at is read from; the queue passes
 *        the device clock corrected by the site's (CMP-014)
 * @param {object} [opts.disclosure]
 * @param {() => object} [opts.getLocation]  where the player is now
 * @returns {(kind: string, data: object) => boolean} true when the observation was queued
 */
export function createSharer({
  descriptor, getSettings, sink, now = Date.now, disclosure = DISCLOSURE, getLocation = () => globalThis.location,
}) {
  return function share(kind, data) {
    if (!descriptor.shares.includes(kind)) {
      warn(`feature "${descriptor.id}" tried to share "${kind}", which it does not declare`);
      return false;
    }
    if (!isShared(getSettings(), kind, disclosure)) return false;
    if (isApplicationPage(getLocation())) return false;

    const queued = sink({
      ...data,
      // Last, so a feature's data can never overwrite them.
      kind,
      observed_at: new Date(now()).toISOString(),
      script_version: VERSION,
    }) !== false;
    if (queued) log('queued', kind, 'from', descriptor.id);
    return queued;
  };
}
