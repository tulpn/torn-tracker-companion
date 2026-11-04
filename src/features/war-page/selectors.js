// Where the ranked-war page keeps its member lists (CMP-006: one file to fix when Torn
// changes).
//
// Facts, not code, from Torn War Stuff Enhanced v2.1 (MIT, xentac,
// greasyfork.org/scripts/529238, getMemberLists, getMemberRows, parseCanonicalStatus;
// read 2026-10) and FF Scouter V2 (GPLv3).

/** Both factions' member lists. */
export const LISTS = 'ul.members-list';

/** An opponent's row; our own members are `li.your`. */
export const ENEMY_ROW = 'li.enemy';

/** The cell with the member's name and profile link; the dibs button goes here. */
export const MEMBER = '.member';

export const PROFILE_LINK = "a[href*='profiles.php']";

export const LEVEL = '.level';

/** Torn marks the status cell with a class per state; "Okay" is the text otherwise. */
export const STATUS = '.status';

/**
 * A status cell another script already draws its own countdown or destination in (Torn
 * War Stuff Enhanced marks it so and hides Torn's text). Our timer stays out of it (hq #535).
 */
export const STATUS_TAKEN = '[data-twse-overridden="true"]';
