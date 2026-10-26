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

> **What it reads and sends.** It reads Torn's chain bar on the page you're on. When
> there's none, it asks torn-tracker.com for your faction's chain with your script key,
> at most every 30 seconds while watch mode is on and the tab is on screen. It sends
> nothing else. Its settings are kept on this device only and sent nowhere; "Forget me"
> clears them.
