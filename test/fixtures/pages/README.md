# Page fixtures

Saved Torn pages and the JSON responses Torn's own pages request, for feature tests.

| File | What it is | Provenance |
|---|---|---|
| `travel-shop.json` | `page.php?sid=travelData&step=shop`, grouped by shop | **Synthetic**, built from the fields TornTools reads (GPLv3, `src/common/pages/travel-abroad-page.ts`, 2026-10). Replace with a capture. |
| `travel-shop-flat.json` | the same response in its older flat form | **Synthetic**, as above |
| `travel-shop.html` | the shop's shelves as the page renders them | **Synthetic**, class names as TornTools and Torn PDA match them |
| `faction-war.html` | a ranked war's two member lists | **Synthetic**, classes as FF Scouter V2 and Torn War Stuff Enhanced match them |
| `bazaar-add.html` | the bazaar's add-items list | **Synthetic**, classes as Torn Bazaar Filler (MIT) matches them |
| `market-add.html` | the item market's sell form | **Synthetic**, classes as Torn Market Filler (MIT) matches them |
| `trade-view.html` | a trade's two sides, `trade.php#step=view` | **Synthetic**, classes and texts as TornTools and Torn PDA (both GPLv3) match them |
| `faction-crimes.html` | two OC 2.0 crime cards on the faction's crimes tab | **Synthetic**, classes as TornTools and OC2.0 Helper (both GPLv3) match them; `data-oc-id` as the crime id is inferred |
| `auction-house.html` | `amarket.php`, weapons tab: three listings | **Captured** by the owner on 2026-10-20, names, player ids and item uids replaced. A fourth, anonymous-seller row is synthetic |
| `crimes-burglary.html`, `crimes-burglary.json` | the burglary crime's target list, and the page's own `crimesData` response for it | **Synthetic**, classes and fields as Crime Morale (MIT) and the burglary helpers (MIT) read them |
| `attack-data.json` | `page.php?sid=attackData` during a fight | **Synthetic**, fields as TornTools types them and Torn Loadout Share (MIT) reads them. Replace with a capture. |
| `sidebar-desktop.html` | Torn's desktop sidebar: the Areas list (its header, four entries, TornTools' settings pill) and the Lists header with its three entries | **Captured** by the owner on 2026-10-23, with TornTools on. Nothing about the player; nodes the companion and The Contract had added removed; icons emptied |
| `attack-data-before.json` | the same before the fight starts, defender's items not shown | **Synthetic**, as above |

A capture replaces a synthetic file one for one. Strip anything about the player (name,
id, money) before committing: this repository is public.
