# Releasing

A release reaches every install at once, by itself. That is the whole point of the update
channel, and the reason this page is a checklist rather than a paragraph.

## How an install updates itself

Tampermonkey, Violentmonkey and Torn PDA all do the same thing: they fetch the small
`.meta.js`, compare its `@version` with the one they have, and fetch the full `.user.js`
when it is newer. Both files are release assets:

- `https://github.com/tulpn/torn-tracker-companion/releases/latest/download/torn-tracker-companion.user.js`
- `https://github.com/tulpn/torn-tracker-companion/releases/latest/download/torn-tracker-companion.meta.js`

`latest/download` always resolves to the newest release that is not a prerelease, so those
two URLs never change and never need to be edited in the header.

The sources on `main` are **not** an update channel. An unreleased commit must never reach
a player.

## Branches

From v0.9.0 the work moves through three branches (hq #447):

- `development`: every feature and fix PR targets it, with auto-merge, and so does the
  release commit.
- `testing`: what the next release will be. `development` is merged into it by a PR
  when an update is ready.
- `main`: what is released. `testing` is merged into it by a PR, and that merge publishes
  (hq D-163).

Promotion PRs (`development` → `testing`, `testing` → `main`) wait for the owner's go.
All three branches require the `test` and `author-check` checks; `testing` and `main` also
require `version-check` (the `promotion-check` workflow).

**Every promotion starts with the bump.** The merge into `main` publishes the version in
`package.json`, and a version that is already tagged publishes nothing. So before a
promotion PR is opened, the release commit (below) must have merged into `development`.
`version-check` fails a promotion PR into `testing` or `main` whose version is already
tagged: "bump the version on development before promoting (RELEASING.md)" (hq #506).

## Cutting one

This is the first step of every promotion. Cut the release on a branch from
`development`, and ship it like any other PR:

```bash
git fetch origin && git checkout -b chore/release-vX.Y.Z origin/development
npm ci && npm test && npm run lint:rules
npm run release -- patch --allow-branch   # or minor, major, beta, or an explicit 1.2.3
```

That bumps `package.json`, moves everything under `## Unreleased` in the CHANGELOG into a
dated section, rebuilds so the header's `@version` follows, and commits
`chore(release): vX.Y.Z`. It doesn't tag. Push the branch and open its PR into
`development` with auto-merge. Then the owner promotes `development` → `testing` →
`main`, each with `--merge`.

### Before the promotion into main

- [ ] **Install `dist/torn-tracker-companion.user.js` where the change matters and use it**:
      Torn PDA on a device whenever PDA's path changed (it is a different WebView, storage
      shim and network path, and the hardest place to fix after the fact), Tampermonkey
      and Violentmonkey when the network or the header changed.
- [ ] The README's Torn API terms table matches the observation kinds this version can
      actually share. A new kind means a new row, and the owner words it.
- [ ] `src/data/items.js` is generated, not the placeholder (`TORN_API_KEY=… npm run
  data:items`, then commit). The release tool refuses the placeholder. Re-run it when
  Torn adds items.
- [ ] The CHANGELOG section reads like something a player would want to know.
- [ ] The forum post waits for the public launch (hq #9, D-163). During the private test
      the script is installed by URL from the release.

### The merge into main is the publish

On every push to `main`, the release workflow reads `package.json`:

- `vX.Y.Z` is already tagged: the push isn't a release (a back-merge, a docs fix), and
  nothing is published.
- `vX.Y.Z` is new: it runs the tests and the rules lint, checks that `package.json` and
  the built header say the same version, then tags that commit and attaches both files
  to a GitHub release with the CHANGELOG section as its notes.

A tag pushed by hand still publishes, once; a version that already has a release is
skipped. Nobody needs to push tags any more.

Afterwards, merge `main` back into `development` by a PR, so the tag's commit is in
`development`'s history for the next round.

## Public testing (0.x)

Until the public launch (hq D-068), releases are numbered 0.x: `npm run release -- 0.9.0`,
then `patch` for 0.9.1 and so on. They are ordinary releases, so they become `latest` and
testers' installs update themselves. A 0.x release may ship while some kinds have no
"what is shared" line yet: the panel keeps those sharing switches hidden, and the release
tool only notes them. From 1.0.0 the tool refuses any missing wording.

## Prereleases

`npm run release -- beta` makes `vX.Y.Z-beta.N`, published as a GitHub prerelease. A
prerelease is never `latest`, so no stable install will ever update itself to one. Beta
testers install it from its own asset URL.

## Rollback

Never delete or replace a release asset: installs point at it, and a missing asset is a
broken update for everyone who has it.

To undo a bad release, publish a higher patch version that reverts the change. That is the
only rollback the update channel understands.

## Greasy Fork

The Greasy Fork listing syncs from the release asset URL through a GitHub webhook, so a
published release appears there within minutes without a second upload.

Answered (Q-CMP-2): **one file serves both channels, with no `greasyfork` variant.**

- Greasy Fork strips `@updateURL` and `@downloadURL` from every version it stores, and
  serves its own instead
  ([meta keys](https://greasyfork.org/en/help/meta-keys): "Greasy Fork will strip these
  keys, which makes any script installed from Greasy Fork only update from Greasy Fork").
  Installs from GitHub keep updating from GitHub.
- The sync URL is the `releases/latest/download/torn-tracker-companion.user.js` asset. Only
  a *published* release event triggers it, and the asset must already be attached when the
  release is published. If it isn't, Greasy Fork falls back to reading the file from git
  at the tag, and `dist/` isn't in git. `gh release create` with files does this right: it
  keeps the release as a draft until every asset is uploaded, then publishes. Don't
  publish a release by hand and attach the files afterwards.
- [Code rules](https://greasyfork.org/en/help/code-rules): a bundle is fine "in
  non-minified form". `test/meta.test.js` keeps the build unminified.

## Torn PDA updates

Answered (Q-CMP-1) from PDA's source (torn-pda `390987e`, `lib/drawer.dart` and
`lib/providers/userscripts_provider.dart`):

- PDA checks for updates on app start and when the app comes back to the front, at most
  once an hour, plus a manual button in its UserScripts settings. It has no other timer.
- It never applies an update by itself. It marks the script "update available" (with an
  optional notification), and the player applies it from a review list. An update that
  asks for new grants is not preselected in that list, so keep `@grant none`.
- A script edited inside PDA is marked locally modified, and PDA stops checking it.
- It reads `@updateURL`'s `.meta.js` for the version, and after an update takes the
  script's URL from `@downloadURL`. Versions compare as three numeric parts. A version
  with a `-suffix` counts as older than the same plain version. A version that isn't
  three parts falls to a looser comparison that gets some orders wrong, so `@version`
  stays strict `X.Y.Z` (tested).
- Its header parser needs exactly one space after `//` (`// @key value`), which the
  generated header does (tested).

So a release reaches PDA players the next time they open the app, as a prompt they
accept.
