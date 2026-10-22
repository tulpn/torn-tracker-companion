---
title: Updates and test releases
summary: How the companion updates itself, what a test release is, and how a bad update is put right.
section: Get started
order: 50
type: explanation
audience: everyone
icon: arrow-path
tier: na
keywords: companion update, torn userscript update, test release
---

> **Test release.** The companion is in public testing. Things may change before version 1.

## How updates arrive

The companion updates from its newest release on GitHub. Nothing is updated from
unreleased code.

- **In a browser**, your script manager checks the release link now and then and installs
  a newer version when there is one.
- **In Torn PDA**, the app checks when it starts or comes back to the front, at most once
  an hour. It doesn't install the update by itself: it marks the companion "update
  available" in its UserScripts settings, and you apply it there. See
  [Install in Torn PDA](install-pda.md#updates).

## Test releases

Until version 1, releases are numbered 0.something. They are ordinary releases, so they
update themselves the same way. While a kind of sharing has no explanation written yet,
its switch stays hidden, so nothing can be shared without you being told what it sends.

## When an update goes wrong

A bad release is never replaced or deleted, because installs point at it. It is put right
by a newer version that undoes the change, which your install picks up as usual. What
changed in each version is in the release notes on GitHub.
