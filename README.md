# Torn Tracker Companion

[![test](https://github.com/tulpn/torn-tracker-companion/actions/workflows/test.yml/badge.svg)](https://github.com/tulpn/torn-tracker-companion/actions/workflows/test.yml)

**Status: in development. There is no release yet.**

One userscript for [Torn](https://www.torn.com) that brings [torn-tracker.com](https://www.torn-tracker.com) and the best of the community's tools onto the pages you already use: fair-fight estimates, the war page, travel and foreign stock, trading and pricing, crimes, organised crimes and more. Every feature can be switched on or off on its own.

It is planned to run in the browser with Tampermonkey or Violentmonkey, and on the phone in [Torn PDA](https://github.com/Manuito83/torn-pda).

## What it will and will not do

- It reads only the Torn pages you open yourself. It never loads torn.com pages in the background.
- One click does at most one game action. It fills in fields for you but never submits them.
- It shares what it sees on those pages with torn-tracker.com, which publishes the combined data openly for every player and tool. You choose which kinds of data it shares, and the exact list will be in the Torn API terms table below before the first release.
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

## API Terms of Service

The table will be filled in before the first release, in Torn's five-column format (data storage, data sharing, purpose of use, key storage and sharing, key access level).

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
| `src/core/` | storage, settings, the page router, DOM reads, the read-only response reader, the network layer, the panel |
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
