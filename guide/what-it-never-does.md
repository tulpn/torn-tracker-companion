---
title: What it never does
seo_title: What the Torn Tracker Companion never does
summary: The companion follows Torn's scripting rules; these are the things it will never do, and how its code is checked for them.
section: Concepts
order: 400
type: explanation
audience: everyone
icon: shield-check
tier: na
keywords: torn scripting rules, is the companion allowed, safe torn userscript
---

> **Test release.** The companion is in public testing. Things may change before version 1.

## The rules it keeps

- **It reads only pages you open yourself.** It never loads a Torn page in the background.
- **One click is at most one game action.** It fills fields for you, but **never submits**
  a form and never presses a game button.
- **No loops on Torn.** No timers, observers or repeats that make requests to Torn.
- **Two hosts only:** torn-tracker.com and Torn's own API. Your script manager shows both
  when you install it.
- **Nothing is shared until you say so.** Every kind starts off.
- **Never your keys in the open.** Your script key stays on your device and is never
  written to the console.
- **Almost nothing about your device.** Each request to torn-tracker.com says only the
  script's version and whether it runs in Torn PDA or a desktop browser, so the guide can
  tick [Use it on your other device](second-device.md) by itself. Torn's API is told
  nothing about the script.

## Things it will never offer

Repeat-click or spam helpers, buying the maximum in one press, switching gyms for you,
moving you to another page, submitting any form, loading pages you didn't open, or
anything that plays the game while you're away.

## How it's checked

Every release is checked automatically: a test fails the build on any request to Torn's
pages, any scripted click, any form submit, or any unsafe way of writing to the page. The
script is open source under the GPLv3, so anyone can read exactly what it does.
