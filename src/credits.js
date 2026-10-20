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
    taken: 'where the foreign shop and the attack page keep their data, where the shop shows your money and capacity, how to set a React field so the form sees it, and totalling each side of a trade',
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
  {
    name: 'Torn War Stuff Enhanced',
    author: 'xentac, after Torn War Stuff by tos',
    licence: 'MIT',
    url: 'https://greasyfork.org/scripts/529238',
    taken: "sorting the ranked war's opponents, where the member lists and status cells are, and moving Torn's rows rather than copying them",
    merged: false,
  },
  {
    name: 'Cortex RW Auction Insights',
    author: 'its Greasy Fork author',
    licence: 'MIT',
    url: 'https://greasyfork.org/scripts/587466',
    taken: "where the auction house rows keep the item's own id, the bids and the bonuses",
    merged: false,
  },
  {
    name: 'OpenMarket',
    author: 'its Greasy Fork author',
    licence: 'GPL-3.0',
    url: 'https://greasyfork.org/scripts/571158',
    taken: "reading each auction row's damage, accuracy and armour",
    merged: false,
  },
  {
    name: 'Crime Morale',
    author: 'tobytorn',
    licence: 'MIT',
    url: 'https://github.com/tobytorn/crime-morale',
    taken: "that crime morale is 100 minus the crimes page's demoralisation, and that burglary targets carry when they expire",
    merged: false,
  },
  {
    name: 'OC2.0 Helper',
    author: 'Strigwulf, with JohnNash and Seberus',
    licence: 'GPL-3.0',
    url: 'https://greasyfork.org/scripts/577968',
    taken: "role weights beside each slot of an organized crime, and where the crime cards and slots are",
    merged: false,
  },
  {
    name: 'Torn PDA',
    author: 'Manuito and contributors',
    licence: 'GPL-3.0',
    url: 'https://github.com/Manuito83/torn-pda',
    taken: "where the trade page's sides, money and items are, and copying the other side's total",
    merged: false,
  },
]);

export const CREDITS_URL = 'https://github.com/tulpn/torn-tracker-companion/blob/main/CREDITS.md';
