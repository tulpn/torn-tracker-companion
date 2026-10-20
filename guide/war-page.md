---
title: The war page
seo_title: Torn ranked war page helper with dibs and timers
summary: Sort your ranked-war opponents, see hospital timers and where they're flying, and call dibs so two members don't hit the same target.
section: Guides
group: features
order: 220
type: how-to
audience: everyone
icon: flag
tier: mixed
keywords: torn ranked war, war dibs, hospital timers torn, war page script
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** sorting, timers and dibs are free. **Pro:** the enemy loadout overlay, when it
arrives. Needs your script key.

## Sort your opponents

Above the opponents' list, choose an order: **Torn's order**, **Status** (hittable first),
**Out soonest** (who leaves hospital next), **Level** or **Fair fight**. Torn's own rows
are moved, never copied, and **Torn's order** puts them back. Pick the default in the
panel's Features tab.

## Timers and destinations

Beside each opponent's status, a countdown shows when they leave hospital or jail, and
travellers show where they're flying (`→ Mexico`, `← Japan`). These come from your
faction's war room on torn-tracker.com. The script never asks Torn about the other
faction.

## Call dibs

Each opponent has a dibs button:

- **Dibs**: nobody has called them. Press it to claim them for a few minutes.
- **Mine 4:12**: your dibs, with the time left. Press to release them.
- **Ares 2:40**: someone else in your faction has them.

Pressing the button tells torn-tracker.com, and your faction sees it at once on the site,
in the bot and on their own war page. It does nothing in the game. Dibs refresh every 15
seconds while the page is on screen.

> **What it reads and sends.** It reads the opponents already on the page. It asks
> torn-tracker.com for your faction's dibs and the war room's timers, and sends your dibs
> when you press the button. Nothing else.
