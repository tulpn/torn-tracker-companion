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

## API Terms of Service

The table will be filled in before the first release, in Torn's five-column format (data storage, data sharing, purpose of use, key storage and sharing, key access level).

## Building it yourself

The script is written as modules under `src/` and bundled into one readable file. You need Node 22 or newer.

```bash
npm ci
npm run build   # writes dist/torn-tracker-companion.user.js and .meta.js
npm test        # builds, then runs the tests against the built file
```

The build is never minified, so the file you install is the source you can read and change. `@version` comes from `package.json` and the `@connect` list from `src/hosts.js`, so the header can never promise something the code does not do.

| Where | What is in it |
|---|---|
| `src/core/` | storage, settings, the page router, DOM reads, the read-only response reader, the network layer, the panel |
| `src/features/` | one folder per feature, each exporting a single descriptor |
| `tools/` | the build and the Torn-rules lint |
| `test/` | unit tests per module, plus the built script running on a fake Torn page |

## Credits

This script brings together ideas and, where licences allow, code from many community scripts. Each one is credited here and in the source when it lands.

## License

[GNU General Public License v3.0](LICENSE). You may use, study, change and share this script; changed versions you share must stay under the same licence.

## Contact

- In game: [ares313377 [4372940]](https://www.torn.com/profiles.php?XID=4372940)
- More scripts: [www.torn-tracker.com/scripts](https://www.torn-tracker.com/scripts)
