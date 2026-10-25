// Attack loadouts (CMP-103, D-041, D-053).
//
// On the attack page the player opened, once the page shows the defender's weapons and
// armour, they are shared as one `loadout` (when the player has switched that kind on).
// The page's own `attackData` response is read; the script never clicks and never asks
// Torn for anything. One report per defender per attack view: Torn polls the fight's
// state every few seconds, and the same loadout again is not news.
//
// Bonuses are sent by the name the page shows; the site maps names to its bonus table
// (hq #91). The page shows no armour value and no item UID, so neither is sent.
//
// Inspiration: TornTools (GPLv3, https://github.com/Mephiles/torntools_extension) and
// Torn Loadout Share by Sigtran (MIT, https://greasyfork.org/scripts/570314) read the same
// response. No code was taken; the field names are recorded in selectors.js with their
// source.

import { createGate, isVisible } from '../../core/capture.js';
import { ATTACK_ROUTES } from '../../core/players.js';
import { defenderInUrl, fromAttackData } from './read.js';
import { isAttackData } from './selectors.js';

/** Longer than any fight: in practice, once per defender per attack view. */
const ONCE_PER_VIEW_MS = 6 * 3_600_000;

let unsubscribe = null;
let gate = null;

export default {
  id: 'attack-loadout',
  wave: 1,
  title: 'Attack loadouts',
  area: 'war',
  guide: 'attack-page',
  summary: 'Lets you share the loadouts the attack page shows you (switch it on under Sharing).',
  routes: [...ATTACK_ROUTES],
  defaults: { enabled: true },
  shares: ['loadout'],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)', 'Torn Loadout Share (MIT)'],

  start(ctx) {
    gate = createGate({ windowMs: ONCE_PER_VIEW_MS, now: ctx.now });
    const opened = defenderInUrl(ctx.win?.location);

    unsubscribe = ctx.intercept.onJson(isAttackData, ({ data }) => {
      const loadout = fromAttackData(data);
      if (!loadout || !isVisible(ctx.doc)) return;
      // The fight the player opened, and no other.
      if (opened && loadout.player_id !== opened) return;
      if (!gate.allow(String(loadout.player_id))) return;
      ctx.share('loadout', { ...loadout, context: 'attack' });
      ctx.log('loadout', loadout.player_id, Object.keys(loadout.slots).length, 'slots');
    }, ctx.win);
  },

  stop() {
    unsubscribe?.();
    unsubscribe = null;
    gate = null;
  },
};
