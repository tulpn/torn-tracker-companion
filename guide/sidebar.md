---
title: The Torn Tracker sidebar block
summary: A small block in Torn's sidebar, under Lists, with your chain, war, dibs, med-out partner and OC at a glance; choose what it shows.
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

A **Torn Tracker** block sits in Torn's sidebar, right under **Lists**. Press its title to
open or close it; the companion remembers which on this device. On a desktop it starts
open. On a phone or in Torn PDA it sits in the slide-out menu and starts closed.

Each line is one thing you'd otherwise open the website or Discord for:

| Line | What it shows | Starts |
|---|---|---|
| **Chain** | your faction's chain, like "412 / 500", with the timeout counting down | on |
| **Ranked war** | how far you're ahead or behind, your score against the target, and roughly when it ends | on |
| **War terms** | the terms your faction agreed, or "NOT TERMED" | on |
| **Med-out partner** | your partner, linking to their profile | on |
| **My dibs** | the targets you hold, each with its time left, linking to its attack page | on |
| **Organised Crime** | your OC and its state, and **needs you** when it's waiting on you | on |
| **Guide** | your progress in the torn-tracker guide, and any bonus to claim | on |
| **Quick links** | your dashboard and the guide on torn-tracker.com | on |
| **Best travel run** | your planner's best run, like "Mexico · Jaguar Plushie · +$13.5k/h" | off |
| **NPC loot** | the next loot level per NPC and when it comes, with its source named | off |
| **Gym** | how far you are towards your next gym | off |
| **Stock watches** | how many of your watched stocks crossed their line | off |

The war lines show only during a war. A line with nothing to say (no chain, no partner, no
OC) is left out rather than showing "none", and when every line is empty the block hides
itself.

## Choose what it shows

1. Open the [settings](settings-panel.md) and go to **Sidebar**.
2. Switch the block off altogether, or switch single lines on or off.
3. Press **Save**. The block changes straight away.

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
