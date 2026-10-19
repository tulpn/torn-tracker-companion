// The userscript header as data (CMP-001).
//
// `tools/build.mjs` turns this into the ==UserScript== block at the top of both built
// files. @version is never written here: it comes from package.json so the two cannot
// disagree. @connect comes from hosts.js for the same reason.

import { HOSTS } from './hosts.js';

const RELEASE = 'https://github.com/tulpn/torn-tracker-companion/releases/latest/download';

export default {
  name: 'Torn Tracker Companion',
  namespace: 'https://github.com/tulpn/torn-tracker-companion',
  description:
    'Brings torn-tracker.com and the best community tools onto the Torn pages you use: '
    + 'estimates, war, travel, trading, crimes and more.',
  author: 'ares313377',
  homepageURL: 'https://www.torn-tracker.com/scripts',
  supportURL: 'https://www.torn.com/forums.php#/p=threads&f=67&t={{THREAD_ID}}&b=0&a=0',
  license: 'GPL-3.0-or-later',
  match: ['https://www.torn.com/*'],
  connect: HOSTS,
  // Torn PDA and the browser managers all poll the small .meta.js and compare @version
  // before fetching the full script (CMP-020, CMP-021). `latest/download` always resolves
  // to the newest non-prerelease, so these URLs never change.
  downloadURL: `${RELEASE}/torn-tracker-companion.user.js`,
  updateURL: `${RELEASE}/torn-tracker-companion.meta.js`,
  runAt: 'document-idle',
  // No GM_* functions anywhere: that is what lets the same file run in Torn PDA (CMP-007).
  grant: ['none'],
};
