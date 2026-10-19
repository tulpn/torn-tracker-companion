# Changelog

Everything worth knowing about each release. The newest is at the top. Versions follow
[semantic versioning](https://semver.org): the patch number changes for fixes, the minor
for new features, the major when something you rely on changes.

A release is made by tagging `vX.Y.Z`; the workflow publishes the built script and uses
the section below for its notes. `## Unreleased` collects what is coming next.

## Unreleased

### Added

- The script is built from modules under `src/` by esbuild, into one readable file plus
  the small `.meta.js` that update checks fetch.
- A lint that fails the build on anything Torn's scripting rules forbid, and a runtime
  guard the tests boot every page under.
- The settings panel has four tabs: Features (a switch per feature, with its options),
  Sharing, Keys and Credits. Edits are kept until you press Save, even when you move
  between tabs.
- A field for your torn-tracker.com script key. It is kept only on this device and is
  never written to the console, even with logging on.
- The upload queue. Whatever you choose to share waits on your device and goes to
  torn-tracker.com in small batches, at most once every 15 seconds and when you leave a
  page. It never holds more than 200 and drops anything older than 10 minutes. If the
  site asks it to slow down, refuses your key or needs a newer script, it stops and the
  Sharing tab tells you why.
- Every observation is checked against the site's rules for its kind before it is
  queued, so one bad entry can never spoil a batch.
- **Foreign shop stock** (wave 1). When you land abroad, the stock and price of every
  item in the shop, empty shelves included, can be shared with torn-tracker.com for its
  restock predictions. It reads what the shop page already loaded, at most once per
  country every 30 seconds and only while you are looking at the tab. It never buys
  anything. Like every kind of sharing, it is off until you switch it on.
- **Attack loadouts** (wave 1). On the attack page, once Torn shows the defender's
  weapons and armour, they can be shared with torn-tracker.com: each item, a weapon's
  damage and accuracy, and its bonuses as Torn names them. One report per fight, read
  from what the page already loaded; the script never clicks. Off until you switch it on.
- Nothing is ever shared from Torn's company or faction application pages, whatever is
  switched on.

### Notes

- Nothing can be shared yet. The sharing switches and the optional Torn API key field
  stay closed until the notice saying exactly what is shared, and Torn's terms table,
  are written. A release cannot be cut while a feature in it is missing that wording.

- There is no public release yet. Wave 1 — fair-fight badges, the war page, foreign stock
  and the price filler — will be v1.0.0.
