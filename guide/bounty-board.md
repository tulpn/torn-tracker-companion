---
title: Bounty board
seo_title: Fair-fight badges and filters on Torn's bounty board
summary: Fair-fight badges on every target of Torn's bounty board, filters for reward, fair fight and level, and an outline on hospital timers nearly up.
section: Guides
group: features
order: 235
type: how-to
audience: everyone
icon: viewfinder-circle
tier: core
keywords: torn bounties, torn bounty filter, torn bounty hunting, bounty fair fight
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone. The filters need no key; the badges need your script key.

## What you see

On Torn's bounty board:

- **A badge beside each target** with the fair-fight estimate, as on
  [profiles and faction lists](ff-badges.md). A **?** means torn-tracker.com has no
  estimate yet.
- **A filter bar above the list.** Set any of these and the rows outside them are hidden
  at once:
  - **Reward at least**, in dollars;
  - **Fair fight up to**;
  - **Level**, from and to;
  - **Hide anonymous**, for bounties placed anonymously.

  It says how many bounties it's showing, like "2 of 3 shown". Leave a box empty for no
  limit. A row the page or the site says nothing about (no level, no estimate) is never
  hidden for it. The filter is kept until you close the tab.
- **Hospital timers that are nearly up** are outlined in green. Choose how many minutes
  in the [settings](settings-panel.md): **Bounty board**, under **War and attacks**. It's 10 to start
  with.

The companion never attacks or claims anything. You pick the target and press Attack
yourself.

> **What it reads and sends.** It reads the bounty board you have open: each target's
> id, level, reward, lister and hospital timer. It sends the target ids to
> torn-tracker.com in one request to look up their fair-fight estimates, kept for an
> hour. The filter is kept only in this browser tab. Nothing is shared about you or them.
