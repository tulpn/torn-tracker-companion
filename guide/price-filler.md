---
title: Price filler
summary: A Fill button on each row of the bazaar and item market sell forms puts in the market value minus your undercut; you still press Torn's button.
section: Guides
group: features
order: 250
type: how-to
audience: everyone
icon: banknotes
tier: core
keywords: torn bazaar price, fill price torn, item market undercut
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone. Needs your script key.

## Fill a price

On the bazaar's add and manage pages and on the item market's sell form, each item gets a
**Fill** button showing the price it will put in: torn-tracker.com's market value minus
your undercut. One press fills that row's price and how many you own.

It never fills a price below what a shop in Torn pays for the item. When the market value
minus your undercut would be lower, it fills the shop's price instead and the button says
so, like **Fill $1,000 (shop price)**; hover over it to see which shop. The
[shop price guard](shop-price-guard.md) also warns you when a price you type yourself is
below a shop's.

You still press Torn's own button to list. The companion never submits anything, and one
press fills one row only: there's no "fill all".

## Set your undercut

In the settings, under **Features**, set **Undercut the market value by ($)**. It's $1 to start
with.

> **What it reads and sends.** It reads the items on the form and asks torn-tracker.com
> for their market values, and once a day for what shops pay, with no key. Nothing is shared.
