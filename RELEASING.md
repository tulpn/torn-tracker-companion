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

## Cutting one

```bash
git checkout main && git pull
npm ci && npm test && npm run lint:rules
npm run release -- patch      # or minor, major, beta, or an explicit 1.2.3
```

That bumps `package.json`, moves everything under `## Unreleased` in the CHANGELOG into a
dated section, rebuilds so the header's `@version` follows, commits `chore(release): vX.Y.Z`
and tags it. Nothing is published yet.

### Before you push the tag

- [ ] **Install `dist/torn-tracker-companion.user.js` in Torn PDA on a device and use it.**
      Not the browser: PDA is a different WebView, a different storage shim and a
      different network path, and it is where the script is hardest to fix after the fact.
- [ ] The README's Torn API terms table matches the observation kinds this version can
      actually share. A new kind means a new row, and the owner words it.
- [ ] The CHANGELOG section reads like something a player would want to know.
- [ ] The forum post is updated for anything that changed in what the script does.

```bash
git push origin main vX.Y.Z
```

Pushing the tag is the publish. The workflow builds from the tagged commit, checks that the
tag, `package.json` and the built header all say the same version, runs the tests and the
rules lint, and attaches both files to a GitHub release with the CHANGELOG section as its
notes.

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

Open question (Q-CMP-2 in the spec): whether Greasy Fork accepts a synced script whose
`@updateURL` and `@downloadURL` point at GitHub, or whether that variant must drop them so
installs made there update from Greasy Fork instead. If it must, the build gains a
`greasyfork` variant and this page says so.

## Open question on Torn PDA

Q-CMP-1: whether PDA applies an update by itself or only flags it, and how often it checks.
This needs confirming on a device, and the README states the answer once it is known.
