# Torn Tracker Companion

[![test](https://github.com/tulpn/torn-tracker-companion/actions/workflows/test.yml/badge.svg)](https://github.com/tulpn/torn-tracker-companion/actions/workflows/test.yml)

**Status: in development. There is no release yet.**

One userscript for [Torn](https://www.torn.com) that brings [torn-tracker.com](https://torn-tracker.com) and the best of the community's tools onto the pages you already use: fair-fight estimates, the war page, travel and foreign stock, trading and pricing, crimes, organised crimes and more. Every feature can be switched on or off on its own.

It is planned to run in the browser with Tampermonkey or Violentmonkey, and on the phone in [Torn PDA](https://github.com/Manuito83/torn-pda).

## How to use it

The full guide is the Companion section of the torn-tracker.com knowledge base,
<https://torn-tracker.com/guide/companion/>: installing it, the settings panel, what
each kind of sharing sends, every feature, and troubleshooting. Its pages live in this
repository's [`guide/`](guide/) folder, so you can read them here too.

## What it will and will not do

- It reads only the Torn pages you open yourself. It never loads torn.com pages in the background.
- One click does at most one game action. It fills in fields for you but never submits them.
- It can share what it sees on those pages with torn-tracker.com, which publishes the combined data openly for every player and tool. Every kind is off until you switch it on. [What is shared](#what-is-shared) lists each kind exactly.
- It checks this repository's releases for updates: Tampermonkey and Violentmonkey install them, and Torn PDA tells you one is ready.
- Features that show torn-tracker.com data ask the site with your script key, sending only the ids on the page they need: for example, the players listed for fair-fight badges, or the auction listings for their values. These lookups are not a sharing kind and need no sharing switch.
- Every request it makes to torn-tracker.com says which version of the script is asking and whether it runs in Torn PDA or a desktop browser, so the guide can tick "use it on your second device" by itself. Nothing else about your device is sent, and Torn's API is never told.

## Installing it

**In a browser**, with [Tampermonkey](https://www.tampermonkey.net) or
[Violentmonkey](https://violentmonkey.github.io) installed, open the install link on the
[latest release](https://github.com/tulpn/torn-tracker-companion/releases/latest) and
confirm. Your script manager then checks for updates by itself.

The install page asks to let the script make web requests to `api.torn.com` and
`torn-tracker.com` (listed twice, as `torn-tracker.com` and `www.torn-tracker.com`, the
same site), and to no other site. Torn's pages block requests to other sites, so the
script asks your script manager to make them; the manager allows only the sites listed.
This version never contacts `api.torn.com`; it is listed for the features that will use your
own Torn API key. What torn-tracker.com is sent is under [Settings](#settings) and
[What is shared](#what-is-shared).

**In [Torn PDA](https://github.com/Manuito83/torn-pda)**, add the script **from its URL**,
not by pasting its text:

```
https://github.com/tulpn/torn-tracker-companion/releases/latest/download/torn-tracker-companion.user.js
```

Pasting the text gives you a copy PDA cannot update. Adding it from the URL lets PDA check
the version for you. PDA checks when the app starts or comes back to the front, at most once
an hour, and you can check by hand in its UserScripts settings. It never installs an
update by itself: it marks the script "update available" (and notifies you, if you
switched that on), and you apply it from the UserScripts section. If you edit the script
in PDA, it stops checking that copy until you reload it from its URL.

Either way updates come from the newest release, and a beta is never installed over a stable
one. How a release is made is in [RELEASING.md](RELEASING.md).

## Settings

Open the settings from the **Torn Tracker** entry in Torn's sidebar, in the Areas list
(right under **TornTools Settings** if you have TornTools; in the slide-out menu on a phone
or in Torn PDA). They open as a page inside Torn, at `index.php#/torn-tracker`, with a menu
of sections and a search bar at the top. Nothing is added to Torn's header.

- **General**: the version, a link to check for an update, the page's look, the
  achievement toast switch, and console logging. When torn-tracker.com says you earned an
  achievement, a small toast shows on the Torn page you're on. For that, when you open a
  Torn page and at most once every five minutes, it asks torn-tracker.com with your script
  key for the achievements earned since it last asked; nothing else is sent, and never from
  the attack page. Switch the toast off here and nothing is asked. Pause all, or companion
  toasts off, in your notification settings on torn-tracker.com also stops the toast and
  the chain watch slot notice. Every section starts with
  your next step in the torn-tracker guide, if you started it: for that it asks
  torn-tracker.com with your script key at most once every 15 minutes, when you open a
  Torn page. It has its own switch here.
- **Features**: every feature, grouped by area, with its switch, one line on what it does,
  its options and a link to its guide page.
- **Sidebar**: the Torn Tracker block in Torn's sidebar (at the top unless you move it under General), with your chain, your
  chain watch (now, next, or a way to sign up, with a switch for watch mode), war, dibs,
  med-out partner and OC. Switch it off, or choose which lines it shows. While it is
  open and the tab is visible, it asks torn-tracker.com once a minute for those lines,
  with your script key; nothing else is sent. Its "Below shop price" line is counted on
  the Item Market page itself and asks nothing.
- **Chain watch**: watch mode, a large chain timer over the Torn page you're on, green,
  orange or red by how soon the chain needs a hit, with its size, colours, a preview and
  an optional beep. It reads Torn's chain bar when the page shows it. When it doesn't,
  and only while watch mode is on and the tab is visible, it asks torn-tracker.com for
  your faction's chain with your script key, at most once every 30 seconds; nothing else
  is sent. Its settings are kept on this device only. Below them is your faction's chain
  watch rota: press "Show the next 24 hours" to read it from torn-tracker.com with your
  script key, then sign up for 30-minute slots as Lead, Backup 1 or Backup 2, or drop your
  own. When one of your slots starts and watch mode is off, a small notice offers to turn
  it on; it never turns on by itself.
- **Sharing**: choose which kinds of data are shared with torn-tracker.com. Every kind
  starts off, switching a feature on never switches sharing on, and nothing is shared
  until you tick a kind. Settings save as you change them. If the wording of what is shared changes in an
  update, you are asked again with a "Share the kinds I picked" button. A queue line shows
  how many reports are waiting, when the last upload went and what the site answered; if
  sharing has stopped, it says why. For more, switch on "Log what the script does" under
  General: the browser console then says, for every report, why it was or wasn't shared.
- **Keys**: your torn-tracker.com script key, which is not a Torn API key. Add to list,
  on profiles, also needs the key's lists scope: with it, the companion reads your target
  lists with the profile's player id, to tick the ones they are on, and adds or removes
  them only when you press its button. Nothing else about the profile is read or sent. An optional
  Torn API key field will appear here, below Torn's terms table, for features that need
  your own data.
- **Data**: what the script keeps on this device, export and import for your player notes,
  racing templates and message templates, and "Forget me", which clears it all.
- **Credits**: every script this one took code or an idea from.
- **Help**: the companion guide and where to report a problem.

## What is shared

Nothing, until you switch a kind on under Sharing in the settings. Each kind
sends only what Torn showed you on a page you opened yourself, with the
time you saw it, to torn-tracker.com with your script key. The script key tells the site
who sent each report, so it can catch false ones. The site never publishes who sent
anything, with one exception: a player can see who reported their own loadout. Nothing from Torn's company or faction application pages is ever shared, whatever
is switched on. There, Applicant badges sends torn-tracker.com only the applicants'
player ids and which list it is (company or faction), to show their job-board cards.

| Kind | What it sends | What torn-tracker.com keeps and publishes |
|---|---|---|
| Foreign stock | On a foreign shop while you are abroad: the country, and each item with its stock and price, empty shelves included. At most once every 30 seconds per country, and only while the tab is on screen. | Each report with who sent it for 30 days, so the site knows you were in that country then. It publishes stock and restock times as "seen at", never by whom. |
| Auction listings | On the auction house: each listing the page shows you, with its id, the item and its own id, the seller's id (none when anonymous), the current bid and number of bids, the time left, its rarity, damage, accuracy or armour, and its bonuses. Never the high bidder. A listing is sent at most once every ten minutes while its bid stays the same, and again as soon as its bid changes, only while the tab is on screen. | Reports for 90 days. Price history per item and bonus is published. |
| Your crime outcomes | When you commit a crime: which crime it was (the page's own numbers for it), whether it succeeded, failed or critically failed, and the money and items you got. Only your own attempts, as the page answered them. | Kept 30 days for your own view. Only totals per crime are published, once at least 20 players have reported it, never by whom. |
| Your gym progress | On the gym page: which gym you are working towards and how far in you are, as the page shows it. | Only for your own gym view, on the site and in the bot. Never shown to anyone else, never published, not even in totals. Kept 30 days. |
| Your gym trains | When you train: the gym, the stat, how much it went up, and, when the page's answer gives them, the energy you spent and how many trains it was. | Only for your own gym view, on the site and in the bot. Never shown to anyone else, never published, not even in totals. Kept 30 days. |
| Item market prices | On the item market: the prices and quantities of up to 50 listings of the item you opened, never who is selling. Only for items torn-tracker.com asks for at that moment (Torn's API already has most listings), at most once per item every five minutes, only while the tab is on screen. | Reports for 7 days. A price index per item is published. |
| Jail difficulty bands | On the jail page: for each prisoner, only their level as a band (like 26-50) and their time left as a band (like 1-3 hours). At most once per prisoner every ten minutes, only while the tab is on screen. Never who they are. | Not accepted by the site yet, so nothing is kept or published. |
| Bazaar listings | On another player's bazaar: their id, and each item they list with its quantity and price (and the item's own id where the page shows one), as far as you scroll. At most once per bazaar every five minutes, only while the tab is on screen. Never your own bazaar. | Reports for 7 days. Each player's latest listings are published openly, and prices per item. |
| Loadouts | On an attack: the other player's id, and the weapons and armour the attack page shows them wearing, with their damage, accuracy and bonuses. Once per attack. | Reports for 90 days. Each player's latest loadout is published openly, replaced on every new report, and removed once nobody has seen it for 180 days. **The player it describes can see that you reported it.** |

The panel shows one plain line beside each switch, and these lines in full under **Exactly
what is sent**. If they change in an update, sharing stops until you have read the new ones
and agreed again.

**Chain watch sign-ups** are not a sharing kind: each is sent only when you press Sign up,
Take or Drop under Settings → Chain watch. A sign-up sends torn-tracker.com the slot's start,
how many slots, and the role, with your script key. Every member of your faction can see
your name, the slot and the role, on the site, in the bot and in this script. Your
sign-ups are deleted 7 days after the slot ends. Reading the rota sends nothing about you
beyond your script key.

## API Terms of Service

This version asks for **no Torn API key**: it reads only the pages you open, and talks only
to torn-tracker.com with your torn-tracker.com script key. The one exception is public:
once a day the shop price guard asks torn-tracker.com's item catalogue for what shops in
Torn pay for each item, with no key at all, and uses the table built into the script when
the site can't be reached. Torn's terms say that when a tool
does not store or share a key, it is enough to say so. When a feature that uses your own
Torn API key arrives, this section and the panel will show Torn's terms table above the key
field: the same one row as torn-tracker.com and the bot, with Torn's five columns (Data
storage, Data sharing, Purpose of use, Key storage & sharing, Key access level).

## Building it yourself

The script is written as modules under `src/` and bundled into one readable file. You need Node 22 or newer.

```bash
npm ci
npm run build        # writes dist/torn-tracker-companion.user.js and .meta.js
npm test             # builds, then runs the tests against the built file
npm run lint:rules   # scans the source for anything Torn's scripting rules forbid
```

`lint:rules` is why the promises above are more than promises. It fails the build on a request to torn.com, a synthetic click, a form submit, `innerHTML`, a navigation, or a URL to a host that is not in `@connect`. The tests then boot the built script on a fake Torn page under a guard that fails on the same things actually happening.

The build is never minified, so the file you install is the source you can read and change. `@version` comes from `package.json` and the `@connect` list from `src/hosts.js`, so the header can never promise something the code does not do.

| Where | What is in it |
|---|---|
| `src/core/` | storage, settings, keys, the page router, DOM reads, the read-only response reader, the network layer, the upload queue and the rules each kind of observation must meet, the panel |
| `src/features/` | one folder per feature, each exporting a single descriptor |
| `tools/` | the build, the Torn-rules lint, and `npm run contract`, which writes `contract/site-paths.json` |
| `contract/` | `site-paths.json`: every torn-tracker.com path and method the script calls, generated from `src/`; the site tests its routes against it |
| `test/` | unit tests per module, plus the built script running on a fake Torn page |

## Credits

This script brings together ideas and, where licences allow, code from many community scripts. Every one of them is named in [CREDITS.md](CREDITS.md), with its licence and what was taken, and in the header of the module that uses it. A script with no licence is reimplemented from the idea alone and credited as inspiration; its code is never copied.

## License

[GNU General Public License v3.0](LICENSE). You may use, study, change and share this script; changed versions you share must stay under the same licence.

## Contact

- In game: [ares313377 [4372940]](https://www.torn.com/profiles.php?XID=4372940)
- More scripts: [torn-tracker.com/scripts](https://torn-tracker.com/scripts)
