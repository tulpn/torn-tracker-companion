# Torn Tracker Companion

[![test](https://github.com/tulpn/torn-tracker-companion/actions/workflows/test.yml/badge.svg)](https://github.com/tulpn/torn-tracker-companion/actions/workflows/test.yml)

**Status: in development. There is no release yet.**

One userscript for [Torn](https://www.torn.com) that brings [torn-tracker.com](https://www.torn-tracker.com) and the best of the community's tools onto the pages you already use: fair-fight estimates, the war page, travel and foreign stock, trading and pricing, crimes, organised crimes and more. Every feature can be switched on or off on its own.

It is planned to run in the browser with Tampermonkey or Violentmonkey, and on the phone in [Torn PDA](https://github.com/Manuito83/torn-pda).

## What it will and will not do

- It reads only the Torn pages you open yourself. It never loads torn.com pages in the background.
- One click does at most one game action. It fills in fields for you but never submits them.
- It can share what it sees on those pages with torn-tracker.com, which publishes the combined data openly for every player and tool. Every kind is off until you switch it on. [What is shared](#what-is-shared) lists each kind exactly.
- It updates itself automatically from this repository.

## Installing it

There is no release yet, so these are the instructions that will apply from v1.0.0.

**In a browser**, with [Tampermonkey](https://www.tampermonkey.net) or
[Violentmonkey](https://violentmonkey.github.io) installed, open the install link on the
[latest release](https://github.com/tulpn/torn-tracker-companion/releases/latest) and
confirm. Your script manager then checks for updates by itself.

**In [Torn PDA](https://github.com/Manuito83/torn-pda)**, add the script **from its URL**,
not by pasting its text:

```
https://github.com/tulpn/torn-tracker-companion/releases/latest/download/torn-tracker-companion.user.js
```

Pasting the text gives you a copy PDA cannot update. Adding it from the URL lets PDA check
the version and keep it current. (Whether PDA installs an update by itself or only tells
you one is waiting is being confirmed on a device; this page will say which.)

Either way the script updates itself from the newest release, and a beta is never installed
over a stable one. How a release is made is in [RELEASING.md](RELEASING.md).

## Settings

The ⚙ button in the bottom right corner opens the panel.

- **Features**: switch each feature on or off, and set its options.
- **Sharing**: choose which kinds of data are shared with torn-tracker.com. Every kind
  starts off, switching a feature on never switches sharing on, and nothing is shared
  until you press "Share the kinds I picked". If the wording of what is shared changes
  in an update, you are asked again. This tab also shows what is waiting to be sent and,
  if sharing has stopped, why.
- **Keys**: your torn-tracker.com script key, which is not a Torn API key. An optional
  Torn API key field will appear here, below Torn's terms table, for features that need
  your own data. "Forget me" clears everything the script keeps on this device.
- **Credits**: every script this one took code or an idea from.

## What is shared

Nothing, until you switch a kind on in the panel's Sharing tab and press "Share the kinds I
picked". Each kind sends only what Torn showed you on a page you opened yourself, with the
time you saw it, to torn-tracker.com with your script key. The script key tells the site
who sent each report, so it can catch false ones. The site never publishes who sent
anything. Nothing is ever sent from Torn's company or faction application pages, whatever
is switched on.

| Kind | What it sends | What torn-tracker.com keeps and publishes |
|---|---|---|
| Foreign stock | On a foreign shop while you are abroad: the country, and each item with its stock and price, empty shelves included. At most once every 30 seconds per country, and only while the tab is on screen. | Each report with who sent it for 30 days, so the site knows you were in that country then. It publishes stock and restock times as "seen at", never by whom. |
| Loadouts | On an attack: the other player's id, and the weapons and armour the attack page shows them wearing, with their damage, accuracy and bonuses. Once per attack. | Reports for 90 days. Each player's latest loadout is published openly, replaced on every new report, and removed once nobody has seen it for 180 days. |

The panel shows the same lines beside each switch. If they change in an update, sharing
stops until you have read the new ones and agreed again.

## API Terms of Service

This version asks for **no Torn API key**: it reads only the pages you open, and talks only
to torn-tracker.com with your torn-tracker.com script key. Torn's terms say that when a tool
does not store or share a key, it is enough to say so. When a feature that uses your own
Torn API key arrives, this section and the panel will show Torn's five-column table (data
storage, data sharing, purpose of use, key storage and sharing, key access level) above
the key field, for exactly the selections it calls.

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
| `tools/` | the build and the Torn-rules lint |
| `test/` | unit tests per module, plus the built script running on a fake Torn page |

## Credits

This script brings together ideas and, where licences allow, code from many community scripts. Every one of them is named in [CREDITS.md](CREDITS.md), with its licence and what was taken, and in the header of the module that uses it. A script with no licence is reimplemented from the idea alone and credited as inspiration; its code is never copied.

## License

[GNU General Public License v3.0](LICENSE). You may use, study, change and share this script; changed versions you share must stay under the same licence.

## Contact

- In game: [ares313377 [4372940]](https://www.torn.com/profiles.php?XID=4372940)
- More scripts: [www.torn-tracker.com/scripts](https://www.torn-tracker.com/scripts)
