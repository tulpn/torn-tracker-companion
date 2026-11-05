# Page fixtures

Saved Torn pages and the JSON responses Torn's own pages request, for feature tests.

| File | What it is | Provenance |
|---|---|---|
| `travel-shop.json` | `page.php?sid=travelData&step=shop`, grouped by shop | **Synthetic**, built from the fields TornTools reads (GPLv3, `src/common/pages/travel-abroad-page.ts`, 2026-10). Replace with a capture. |
| `travel-shop-flat.json` | the same response in its older flat form | **Synthetic**, as above |
| `travel-shop.html` | the shop's shelves as the page renders them | **Synthetic**, class names as TornTools and Torn PDA match them |
| `faction-war.html` | a ranked war's two member lists | **Synthetic**, classes as FF Scouter V2 and Torn War Stuff Enhanced match them |
| `faction-war-captured.html` | a ranked war's two member lists: eight opponent rows (okay, hospital with and without Torn War Stuff Enhanced's countdown, travelling, abroad) and three of our own (hq #535) | **Captured** by the owner on 2026-11-03, with Torn War Stuff Enhanced and FF Scouter on. Names, player and faction ids, faction names, levels, estimates and activity times replaced with made-up values; the companion's nodes removed, images emptied, scripts and styles dropped |
| `bazaar-add.html` | the bazaar's add-items list | **Synthetic**, classes as Torn Bazaar Filler (MIT) matches them |
| `market-add.html` | the item market's sell form | **Synthetic**, classes as Torn Market Filler (MIT) matches them |
| `trade-view.html` | a trade's two sides, `trade.php#step=view` | **Synthetic**, classes and texts as TornTools and Torn PDA (both GPLv3) match them |
| `faction-crimes.html` | two OC 2.0 crime cards on the faction's crimes tab | **Synthetic**, classes as TornTools and OC2.0 Helper (both GPLv3) match them; `data-oc-id` as the crime id is inferred |
| `auction-house.html` | `amarket.php`, weapons tab: three listings | **Captured** by the owner on 2026-10-20, names, player ids and item uids replaced. A fourth, anonymous-seller row is synthetic |
| `crimes-burglary.html`, `crimes-burglary.json` | the burglary crime's target list, and the page's own `crimesData` response for it | **Synthetic**, classes and fields as Crime Morale (MIT) and the burglary helpers (MIT) read them |
| `attack-data.json` | `page.php?sid=attackData` during a fight | **Synthetic**, fields as TornTools types them and Torn Loadout Share (MIT) reads them. Replace with a capture. |
| `sidebar-desktop.html` | Torn's desktop sidebar: the Areas list (its header, four entries, TornTools' settings pill) and the Lists header with its three entries | **Captured** by the owner on 2026-10-23, with TornTools on. Nothing about the player; nodes the companion and The Contract had added removed; icons emptied |
| `sidebar-home.html` | Torn's sidebar on the Home page, `index.php`: the Areas list (its header, the area entries, The Contract's and TornTools' entries) and the Lists header with its three entries (hq #488) | **Captured** by the owner on 2026-11-02, with TornTools, FF Scouter and The Contract on. The Information panel, TornTools' awards and NPC containers and the companion's nodes removed; list counts and The Contract's rank made up; icons, scripts and styles dropped |
| `awards-merits.html` | the merits tab, `page.php?sid=awards&tab=merits`: the merits panel only | **Captured** by the owner on 2026-10-23. Torn's structure and class names as captured; every level, count and total made up, icons emptied |
| `profile.html` | a player's profile, `profiles.php?XID=…`: the heading and the basic information table | **Synthetic**, the heading and table shaped as in `profile-npc.html`; the player, faction and level made up. Its Level row is not how Torn shows the level (see `profile-player.html`); kept for the table fallback and the message-template tests |
| `profile-player.html` | an ordinary player's profile, `profiles.php?XID=…`: the title bar, the Level, Rank and Age boxes, and the basic information table | **Captured** by the owner on 2026-10-28. Name, id, faction, spouse, property and every number replaced with made-up values; TornTools', FF Scouter's and the companion's nodes removed, scripts and icons dropped. The level is in the Level box, one digit per cell; the table has no Level row |
| `profile-npc.html` | Duke's profile, `profiles.php?XID=4`: the title bar (heading "Duke [4]", Torn's page links) and the basic information table | **Captured** by the owner on 2026-10-20. An NPC, so nothing about a player; TornTools' and FF Scouter's nodes removed, scripts and icons dropped. Its table has no Level row, and Faction reads "N/A" |
| `attack-data-before.json` | the same before the fight starts, defender's items not shown | **Synthetic**, as above |
| `gym.html` | the gym page, `gym.php`: Torn's welcome box (its welcome and energy lines), two stats and the gym grid with the active gym, the one in progress at 84 % and locked ones (hq #610) | **Synthetic**, laid out as the owner's screenshot of 2026-11-05 shows it; classes as TornTools (GPLv3) and Auto gym switch (MIT) match the gym buttons, the welcome box's class names made up (the line is found by its "energy available" text). Replace with a capture. |
| `bounties.html` | the bounty board, `bounties.php`: three bounties (one anonymous, two in hospital) | **Synthetic**, from the board's long-standing class names; targets and listers made up. Replace with a capture. |

A capture replaces a synthetic file one for one. Strip anything about the player (name,
id, money) before committing: this repository is public.
