// Where the gym page keeps what the gym helper reads (CMP-006: one file to fix when Torn
// changes).
//
// Facts, not code, from TornTools (GPLv3, src/common/features/gym-progress and
// src/common/pages/gym-page.ts) and Auto gym switch by Stephen Lynx (MIT,
// greasyfork.org/scripts/480060), read 2026-10. That the page's gym ids are the API's
// TornGym ids is inferred from the latter's id table; a capture should confirm.

/** The page's own gym requests: gym.php?step=getInitialGymInfo, step=train, … */
export function gymStep(url) {
  try {
    const u = new URL(String(url), 'https://www.torn.com');
    return u.pathname === '/gym.php' ? u.searchParams.get('step') : null;
  } catch {
    return null;
  }
}

/** The gym the player is working towards, and its percentage text. */
export const IN_PROGRESS = "[class*='gymButton_'][class*='inProgress_']";
export const PERCENT = "[class*='percentage_']";

/** A child of each gym button carries a class gym-<id>. */
export const GYM_ID_CLASS = /(?:^|\s)gym-(\d+)(?:\s|$)/;

export const STATS = Object.freeze(['strength', 'defense', 'speed', 'dexterity']);
