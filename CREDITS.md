# Credits

This script stands on the work of the Torn scripting community. Every idea and every line
taken from another script is named here.

The rules we hold ourselves to:

- Code from a GPLv3 script is merged with its notice intact.
- Code from an MIT or BSD script is merged with its copyright and permission notice kept
  in the module's header comment, as those licences require.
- A script with no licence, or one that asks not to be copied, is **reimplemented from the
  idea alone** and credited as inspiration. Its code is never copied.
- Before merging another author's code we send them a message in game. The licence does
  not require it; the community does.

`npm run lint:rules` fails if a feature credits a script that is not listed below, or if
the module itself carries no notice. The panel's Credits tab is built from
`src/credits.js`, and a test fails if a feature credits a script missing there.

## Merged code

| Script | Author | Licence | What was taken | Where |
|---|---|---|---|---|
| _none yet_ | | | | |

## Inspiration

| Script | Author | What the idea was | Where |
|---|---|---|---|
| [TornTools](https://github.com/Mephiles/torntools_extension) (GPLv3) | Mephiles and contributors | Reading the foreign shop's stock from the page's own `travelData` response, and where the shelves sit on the page; where the attack page keeps its state; setting a React field so the form sees the value; where the shop shows your money and how much you can still carry; totalling each side of a trade | `src/features/foreign-stock/`, `src/features/best-buy/`, `src/features/trade-value/`, `src/features/attack-loadout/`, `src/features/price-filler/` |
| [FF Scouter V2](https://github.com/xentac/FFScouter) (GPLv3 per its header) | xentac and contributors | Fair-fight badges beside each player, where the member rows sit on faction and war pages, and the colour scale players already know | `src/features/ff-badges/` |
| [Torn Bazaar Filler](https://greasyfork.org/scripts/473470) (MIT) | Ramin Quluzade and Silmaril | A fill button per row on the bazaar's add and manage pages, and where their fields are | `src/features/price-filler/` |
| [Torn Market Filler](https://greasyfork.org/scripts/513920) (MIT) | Silmaril | Where the item market sell form's rows, price and quantity fields are | `src/features/price-filler/` |
| [Torn War Stuff Enhanced](https://greasyfork.org/scripts/529238) (MIT), after [Torn War Stuff](https://greasyfork.org/scripts/448681) (MIT) | xentac; tos | Sorting the ranked war's opponents, where the member lists and status cells are, and moving Torn's own rows rather than copying them | `src/features/war-page/` |
| [Auto gym switch](https://greasyfork.org/scripts/480060) (MIT) | Stephen Lynx | The gym page's own answers, and the gym id class on each gym's button | `src/features/gym-progress/` |
| [Cortex RW Auction Insights](https://greasyfork.org/scripts/587466) (MIT) | its Greasy Fork author | Where the auction house rows keep the item's own id, the bids and the bonuses | `src/features/auction-capture/` |
| [OpenMarket](https://greasyfork.org/scripts/571158) (GPLv3) | its Greasy Fork author | Reading each auction row's damage, accuracy and armour | `src/features/auction-capture/` |
| [Crime Morale](https://github.com/tobytorn/crime-morale) (MIT) | tobytorn | That crime morale is 100 minus the crimes page's demoralisation, and that burglary targets carry when they expire | `src/features/crime-helper/` |
| [OC2.0 Helper](https://greasyfork.org/scripts/577968) (GPLv3) | Strigwulf, with JohnNash and Seberus | Role weights beside each slot of an organized crime, and where the crime cards and slots are | `src/features/oc-helper/` |
| [Torn PDA](https://github.com/Manuito83/torn-pda) (GPLv3) | Manuito and contributors | Where the trade page's sides, money and items are, and copying the other side's total | `src/features/trade-value/` |
| [Torn Loadout Share](https://greasyfork.org/scripts/570314) (MIT) | Sigtran | Reading the defender's loadout from the attack page's own `attackData` response, and which slot number is which | `src/features/attack-loadout/` |

## This script

Torn Tracker Companion is © 2026 tulpn and released under the
[GNU General Public License v3.0 or later](LICENSE).
