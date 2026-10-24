---
title: Shop price guard
summary: Item Market listings below what a shop pays are outlined with their profit, and your sell forms warn before you list below a shop's price.
section: Guides
group: features
order: 255
type: how-to
audience: everyone
icon: shield-check
tier: core
keywords: torn shop sell price, torn item market profit, sell to shop torn, torn undersell, item market highlighter
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone. Works without a script key.

Shops in Torn buy many items at a fixed price. Two features use those prices: one finds
listings you can buy and sell straight on to a shop at a profit, the other stops you
selling your own items for less than a shop would pay.

## Spot listings below a shop's price

On the Item Market, a listing priced below what a shop pays for the item gets a coloured
outline, a dot and its profit per item beside the price, like **+12.5k**. Hover over the
price, or hold it on a phone, for the details: what it's listed at, which shop pays how
much, the profit each, the margin, and the total for everything in that listing.

The colour says how good the deal is:

| Colour | Profit per item at least | or margin at least |
|---|---|---|
| Green | $50,000 | 100% |
| Yellow | $10,000 | 50% |
| Red | $1,000 | 20% |
| Blue | $1 | 1% |

A listing at or above the shop's price gets nothing. The [sidebar block](sidebar.md) counts
the listings on screen that are below a shop's price, in its **Below shop price** line.

It only marks listings. Buying is still your own press on Torn's **Buy** button, and selling
to the shop is still your own trip to it.

## Get warned before you undersell

On the Item Market's add-listing form and on your bazaar's add and manage pages, a price
below what a shop pays shows a warning under the field as you type:

> Below the shop price. Big Al's Gun Shop pays $1,250 each, $310 more than this (×12: $3,720).

Raise the price to the shop's or above and the warning goes away. It never stops you: nothing
is disabled, changed or submitted, and you can still list at any price you like. Items no
shop buys never get a warning.

The [price filler](price-filler.md) follows the same rule: it never fills a price below what
a shop pays, and its button says **(shop price)** when it stopped there.

## Change how it looks

In the [settings](settings-panel.md), under **Features**, **Shop price highlighter** has:

- **Colour listings by**: profit per item in dollars, or the margin in percent;
- the minimum for each colour, in either mode;
- **Show the profit beside the price**;
- **Add the listing's total**, the profit times how many are listed;
- **Hide listings that are not below a shop price**, which leaves only the deals on screen.

**Undersell warning** has its own switch. Both start on.

## Where the prices come from

The prices are the highest that any shop pays for each item, from Torn's own item data.
The companion gets them from torn-tracker.com's public item catalogue once a day, without
your script key or anything else about you. When the site can't be reached, it uses the
table built into this version of the script, so both features keep working.

> **What it reads and sends.** It reads the listings and the sell forms on the pages you
> open. Once a day it asks torn-tracker.com for the shop prices, sending no key. Nothing is
> shared, and Torn's API is never asked.

Based on [Torn Item Market - Shop Sell Price Highlighter](https://github.com/tulpn/torn-item-market-highlighter)
by ares313377 [4372940], under the GNU GPL v3.
