---
title: Chain watch
seo_title: A big Torn chain timer for faction chain watchers
summary: Watch mode puts a large chain timer over the Torn page you're on, coloured by how soon the chain needs a hit.
section: Guides
group: features
order: 215
type: how-to
audience: everyone
icon: clock
tier: core
keywords: torn chain watch, torn chain timer, torn chain watcher, torn chain bar alert, torn faction chain
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone. Watch mode needs no key on a page that shows Torn's chain bar.

## What you see

Torn's chain bar is small and easy to miss from another window. Watch mode puts a large
box over the Torn page you're on with the time the chain has left, the chain count, and
where the timer came from:

| Time left | The box | It says |
|---|---|---|
| More than 1:00 | Green | **OK** |
| 1:00 to 0:30 | Orange | **HIT SOON** |
| Under 0:30 | Red, flashing with white once every 2 seconds | **HIT NOW** |
| No chain running | Grey | **No chain** |
| No timer for over 90 seconds | Grey stripes | **No data** |

Every state says its name in words, so you don't have to tell the colours apart. The
flash is slow on purpose (once every 2 seconds) and no setting makes it faster.

Watch mode only shows the timer. It never hits for you, and it never clicks anything on
Torn's page. Outside its top bar and its ✕, clicks go straight through to the page
underneath.

## Turning it on

Open the [settings](settings-panel.md), **Chain watch**, and tick **Watch mode**. It
stays on, on every Torn page, until you turn it off there or with the ✕ on the box.

## Where the timer comes from

1. **Torn's chain bar**, when the page you're on shows it. The box reads it from the page
   and says "from Torn's chain bar". This asks nothing.
2. Otherwise, **torn-tracker.com's copy of your faction's chain**, with your
   [script key](settings-panel.md). The box says "from torn-tracker · up to N s old". It
   asks at most once every 30 seconds, only while watch mode is on and the tab is on
   screen, and counts down by itself in between. A hit since then only adds time, so
   this timer can run early but never late.

With neither for more than 90 seconds, the box turns to grey stripes and says **No
data**. A box that has lost its timer never looks safe.

## Size, place and colours

Under **Chain watch** in the settings:

- **Size:** width and height as a share of the screen. On a computer it starts at 40% by
  25%; on a phone or in Torn PDA at 90% by 20%. Drag the box by its top bar to move it,
  or focus the bar and use the arrow keys. **Reset size and position** puts it back at
  the top centre.
- **Colours:** OK, Warning, Danger and Danger's flash. The text turns black or white by
  itself, whichever reads better. **Reset colours** brings back the defaults.
- **Preview:** runs the box on a made-up timer from 1:10 down to 0:20, through OK,
  Warning and Danger, then stops by itself. It reads no real timer and asks nothing.
- **Sound:** a short beep once each time the box turns Danger. Off to start with. Your
  browser may keep it quiet until you've clicked on the page.

## Your faction's rota

Below watch mode's settings is your faction's chain watch rota: 30-minute slots, each with
a Lead and two backups. It asks nothing until you press **Show the next 24 hours**; then it
reads the rota from torn-tracker.com with your script key, and again after each change or
when you press **Refresh**.

- **The table:** the next 24 hours, in TCT with your own time beside it. Your slots are
  highlighted with a **Drop** button, other members show by name, and a free role has a
  **Take** button. A slot with no Lead is flagged "no Lead".
- **Sign up:** pick a start, a length (30 minutes to 12 hours) and a role, and press
  **Sign up**. It's all or nothing: if any slot in that stretch is already taken, nothing
  is saved, and the reply says who has which slot and which roles are still free.
- **Drop** gives back one of your own slots. In Torn PDA, drop it on
  [the chain board](https://www.torn-tracker.com/faction/chains/) instead.

Your faction's leaders manage the rota on torn-tracker.com.

## When your slot starts

When one of your slots starts and watch mode is off, a small notice at the bottom of the
page says "Your chain watch (Lead) starts now", with a **Turn on watch mode** button and a
✕. It never turns watch mode on by itself, and each slot is announced once.

## In the sidebar

The Torn Tracker block in Torn's sidebar has a **Watch** line: "Watching now · Lead", your
next slot like "Next watch 03:00 TCT · Backup 1", or "Sign up to watch". It adds how many
slots in the next 24 hours have no Lead, and has a switch for watch mode. You can hide the
line under Settings → Sidebar.

> **What it reads and sends.** It reads Torn's chain bar on the page you're on. When
> there's none, it asks torn-tracker.com for your faction's chain with your script key,
> at most every 30 seconds while watch mode is on and the tab is on screen. It sends
> nothing else. Its settings are kept on this device only and sent nowhere; "Forget me"
> clears them.
>
> **The rota.** Reading it sends your script key only. A sign-up sends the slot's start,
> how many slots and the role, with your script key, and only when you press Sign up or
> Take. Every member of your faction sees your name, the slot and the role. Sign-ups are
> deleted 7 days after the slot ends.
