# Page fixtures

Saved Torn pages and the JSON responses Torn's own pages request, for feature tests.

| File | What it is | Provenance |
|---|---|---|
| `travel-shop.json` | `page.php?sid=travelData&step=shop`, grouped by shop | **Synthetic**, built from the fields TornTools reads (GPLv3, `src/common/pages/travel-abroad-page.ts`, 2026-10). Replace with a capture. |
| `travel-shop-flat.json` | the same response in its older flat form | **Synthetic**, as above |
| `travel-shop.html` | the shop's shelves as the page renders them | **Synthetic**, class names as TornTools and Torn PDA match them |
| `attack-data.json` | `page.php?sid=attackData` during a fight | **Synthetic**, fields as TornTools types them and Torn Loadout Share (MIT) reads them. Replace with a capture. |
| `attack-data-before.json` | the same before the fight starts, defender's items not shown | **Synthetic**, as above |

A capture replaces a synthetic file one for one. Strip anything about the player (name,
id, money) before committing: this repository is public.
