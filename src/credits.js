// Every script this one took code or an idea from (CMP-040, CMP-107).
//
// The panel's Credits page is built from this list, CREDITS.md says the same in prose,
// and a test checks that every name a feature lists in its `credits` is here. A row is
// added in the same commit as the code or idea it credits.
//
//   { name, author, licence, url, taken, merged }
//   merged: true when code was merged (MIT, BSD or GPLv3 only); false for an idea that
//   was reimplemented, which is the only way a script with no licence is ever used.

export const CREDITS = Object.freeze([
  {
    name: 'TornTools',
    author: 'Mephiles and contributors',
    licence: 'GPL-3.0',
    url: 'https://github.com/Mephiles/torntools_extension',
    taken: 'where the foreign shop and the attack page keep their data, and how to set a React field so the form sees it',
    merged: false,
  },
  {
    name: 'Torn Loadout Share',
    author: 'Sigtran',
    licence: 'MIT',
    url: 'https://greasyfork.org/scripts/570314',
    taken: "reading the defender's loadout from the attack page's own attackData response, and the slot numbers",
    merged: false,
  },
  {
    name: 'FF Scouter V2',
    author: 'xentac and contributors',
    licence: 'GPL-3.0',
    url: 'https://github.com/xentac/FFScouter',
    taken: 'fair-fight badges beside players, where the member rows are, and the colour scale',
    merged: false,
  },
  {
    name: 'Torn Bazaar Filler',
    author: 'Ramin Quluzade and Silmaril',
    licence: 'MIT',
    url: 'https://greasyfork.org/scripts/473470',
    taken: "a fill button per row on the bazaar's add and manage pages, and where their fields are",
    merged: false,
  },
  {
    name: 'Torn Market Filler',
    author: 'Silmaril',
    licence: 'MIT',
    url: 'https://greasyfork.org/scripts/513920',
    taken: "where the item market sell form's rows, price and quantity fields are",
    merged: false,
  },
]);

export const CREDITS_URL = 'https://github.com/tulpn/torn-tracker-companion/blob/main/CREDITS.md';
