// Where Torn keeps the attack page's state (CMP-006: one file to fix when Torn changes).
//
// Facts, not code, from TornTools (GPLv3, src/common/pages/attack-loader-page.ts, as of
// 2026-10) and Torn Loadout Share by Sigtran (MIT, Greasy Fork 570314, v1.1.10). Confirm
// against a captured `attackData` response before the first release that ships this.

/** The page's own request for the fight's state. Torn polls it during a fight. */
export function isAttackData(url) {
  return /[?&]sid=attackData(&|$)/.test(url);
}

/** Torn numbers the slots; these are the ones a loadout has. 10 and 999 are not slots. */
export const SLOTS = Object.freeze({
  1: 'primary',
  2: 'secondary',
  3: 'melee',
  5: 'temporary',
  4: 'body',
  6: 'helmet',
  7: 'pants',
  8: 'boots',
  9: 'gloves',
});

/** Weapons carry damage and accuracy; armour carries neither on this page. */
export const WEAPON_SLOTS = Object.freeze(['primary', 'secondary', 'melee', 'temporary']);
