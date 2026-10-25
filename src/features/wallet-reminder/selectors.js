// Where Torn shows the cash the player carries (CMP-006: one file to fix when Torn changes).
//
// UNVERIFIED: `#user-money` with the amount in `data-money` is the sidebar's money line
// as TornTools (GPLv3) reads it, not taken from a capture. When it isn't found the
// reminder stays away. Replace with a capture (hq #313).

export const MONEY = '#user-money';
