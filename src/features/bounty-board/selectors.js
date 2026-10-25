// Torn's bounty board, bounties.php (BNT-012; CMP-006: one file to fix when Torn changes).
//
// UNVERIFIED: these are candidates, not read from a capture. They follow the list's
// long-standing markup (a `ul.bounties-list` of `li` rows, each with target, level,
// reward, lister and status cells) and are matched loosely; a row without a target link
// is left alone. Replace with a capture (hq #313).

/** The list of bounties; the filter bar goes above it. */
export const LIST = 'ul.bounties-list';

/** One bounty. */
export const ROWS = 'ul.bounties-list > li';

/** The target's profile link inside a row. */
export const TARGET = ".target a[href*='XID='], a[href*='profiles.php?XID=']";

/** The target's level. */
export const LEVEL = '.level';

/** The reward, like "$1,250,000". */
export const REWARD = '.reward';

/** Who listed it; "Anonymous" for an anonymous bounty. */
export const LISTER = '.listed, .lister';

/** The target's status, like "Okay" or "Hospital", with its timer when the page shows one. */
export const STATUS = '.status';
