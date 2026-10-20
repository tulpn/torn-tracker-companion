// Where players appear on the pages that get badges (CMP-006: one file to fix when Torn
// changes).
//
// Facts, not code, from FF Scouter V2 (header licence GPLv3, github.com/xentac/FFScouter,
// src/features/faction/column-population.ts and src/utils/dom.ts, as of 2026-09).

/** Member rows on faction profiles, faction member lists and the ranked-war page. */
export const ROWS = ".table-body > .table-row, li.enemy, li.your";

/** The member's profile link inside a row. */
export const ROW_LINK = ".member a[href*='profiles.php'], a[href*='profiles.php?XID=']";

/** The page heading the single-player badge goes beside, on profiles and the attack page. */
export const HEADING = '.content-title h4, h4';
