// Every script this one took code or an idea from (CMP-040, CMP-107).
//
// The panel's Credits page is built from this list, CREDITS.md says the same in prose,
// and a test checks that every name a feature lists in its `credits` is here. A row is
// added in the same commit as the code or idea it credits.
//
//   { name, author, licence, url, taken, merged }
//   merged: true when code was merged (MIT, BSD or GPLv3 only); false for an idea that
//   was reimplemented, which is the only way a script with no licence is ever used.

export const CREDITS = Object.freeze([]);

export const CREDITS_URL = 'https://github.com/tulpn/torn-tracker-companion/blob/main/CREDITS.md';
