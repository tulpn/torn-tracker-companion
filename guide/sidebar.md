---
title: The Torn Tracker sidebar block
summary: A small block in Torn's sidebar, at the top or wherever you put it, with your chain, war, dibs, med-out partner and OC at a glance; choose what it shows.
section: Guides
group: features
order: 200
type: how-to
audience: everyone
icon: queue-list
tier: core
keywords: torn sidebar chain timer, torn tracker sidebar, torn war score sidebar, torn dibs sidebar
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone. Needs your [script key](website:script-key.md).

## What you see

A **Torn Tracker** block sits at the top of Torn's sidebar, above **Areas**; you can
[move it](#choose-where-it-sits). Press its title to open or close it; the companion remembers which on this device. On a desktop it starts
open. On a phone or in Torn PDA it sits in the slide-out menu and starts closed.

Each line is one thing you'd otherwise open the website or Discord for:

| Line | What it shows | Starts |
|---|---|---|
| **Chain** | your faction's chain, like "412 / 500", with the timeout counting down, then **timed out** | on |
| **Ranked war** | how far you're ahead or behind, your score against the target, and a countdown to the start while the war is set but not yet begun, then to roughly when it ends. **War** opens your faction's ranked war on Torn | on |
| **War terms** | the terms your faction agreed, or "NOT TERMED" | on |
| **Med-out partner** | your partner, linking to their profile | on |
| **My dibs** | the targets you hold, each with its time left, linking to its attack page | on |
| **Organised Crime** | your OC and its state, a countdown while it's being planned, then **ready**; **expired** when a crime that hasn't started runs past its expiry; and **needs you** when it's waiting on you. **OC** opens your faction's crimes | on |
| **Guide** | your progress in the torn-tracker guide, and any bonus to claim | on |
| **Routine** | how many of today's routine lines on torn-tracker.com are still undone, like "Routine 3 left today", and when the day resets. Tap it for the list: each line opens its Torn page in the same tab, and a reading older than 90 minutes says how old it is. With **Casino off** on the site, no casino line ever shows | on |
| **Below shop price** | on the Item Market, how many listings on screen sell below what a shop pays (see [Shop price guard](shop-price-guard.md)) | on |
| **Quick links** | your dashboard and the guide on torn-tracker.com | on |
| **Best travel run** | your planner's best run, like "Mexico ↗ · Jaguar Plushie · +$13.5k/h"; the country links to the planner | off |
| **NPC loot** | the next loot level per NPC and when it comes, with its source named | off |
| **Gym** | how far you are towards your next gym | off |
| **Stock watches** | how many of your watched stocks crossed their line | off |

The countdowns tick every second from your own clock, between the block's reads once a
minute, and rest while the tab is in the background. When one reaches zero the line says
what happened (**ready**, **timed out**, **ending**) until the next read confirms it. The
**War** and **OC** links open Torn's pages in the same tab, like any link in Torn's sidebar.
A link to torn-tracker.com carries **↗** and opens in a new tab, so Torn stays where it was.

The war lines show only during a war. A line with nothing to say (no chain, no partner, no
OC) is left out rather than showing "none", and when every line is empty the block hides
itself.

If your account has no faction linked on torn-tracker.com, the chain, war and dibs lines
have nothing to show. The block then says **Link your faction on torn-tracker.com to see
chain, war and dibs**, linking to the faction page on torn-tracker.com.

## Choose where it sits

1. Open the [settings](settings-panel.md) and go to **Sidebar**, then **Where the block sits**.
2. Pick a place: **At the top, above Areas** (the default), **After Areas**, **After
   Lists** or **At the bottom**.
3. It saves at once. The choice is kept on this device, and holds on a phone too.

A page whose sidebar has no such place (some pages have no Lists) shows the block at the
next place down.

Before 0.9.8 the block always sat under **Lists**. Version 0.9.8 moves it to the top once;
the settings page says so under **Sidebar** until you change a sidebar setting, and **After Lists** puts it
back where it was.

## Choose what it shows

1. Open the [settings](settings-panel.md) and go to **Sidebar**.
2. Switch the block off altogether, or switch single lines on or off.
3. It saves at once. The block changes straight away.

## What it never does

Every line is a plain link: a profile, an attack page, or torn-tracker.com. Pressing one
only opens the page. Attacking, joining an OC or anything else in the game is still your
own press on Torn's page.

> **What it reads and sends.** While the block is open and you're looking at the tab, it
> asks torn-tracker.com once a minute for the lines you switched on, with your script key.
> It sends nothing else, and nothing is asked while the block is closed or the tab is in
> the background. torn-tracker.com answers from what it already keeps: no Torn page and no
> Torn API call is made for it. The answer isn't stored on your device.

## If a line says "no data"

torn-tracker.com didn't answer, or doesn't serve this yet. The block tries again a minute
later. If it says **Add your script key**, add or check your key under **Keys** in the
settings.
