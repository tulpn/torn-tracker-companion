---
title: Fair-fight badges
seo_title: Fair-fight badges on Torn profiles and faction lists
summary: A badge beside each player on profiles, faction lists, the war page and the attack page shows torn-tracker.com's fair-fight estimate.
section: Guides
group: features
order: 210
type: how-to
audience: everyone
icon: chart-bar
tier: core
keywords: torn fair fight, ff badge, ff estimate torn
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone. Needs your script key.

## What you see

Beside each player on a profile, a faction member list, the ranked-war page and the attack
page, a small badge shows the fair-fight estimate: how hard a fight that player is for you.
The colours run from blue (easy) through green and yellow to red (hard), the scale many
players already know. A **?** on grey means torn-tracker.com has no estimate for that
player yet: it never guesses.

## How it works

All the players on a page are looked up together, in one request to torn-tracker.com, and
each answer is kept for an hour. The badge only shows: clicking it does nothing.

> **What it reads and sends.** It reads the player ids already on the page and sends
> them to torn-tracker.com to look up their estimates. Nothing is shared about you or them.
