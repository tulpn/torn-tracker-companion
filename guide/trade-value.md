---
title: Trade value
summary: On a trade, a total at market value or at a buy list on torn-tracker.com (yours or a trader's), with a Copy receipt button for the chat.
section: Guides
group: features
order: 260
type: how-to
audience: everyone
icon: clipboard-document-check
tier: core
keywords: torn trade value, trade receipt torn, trade calculator, torn buy list, trader buy list
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone. Needs your script key.

## Total a trade

Under the trade, across its full width, a line shows **Their offer at market value**:
their money plus each item at torn-tracker.com's market value. An item without a price is
counted ("1 without a price") and never guessed.

## Price a trade at a buy list

In the [settings](settings-panel.md), under **Trade value**, **Price a trade at** has three
choices:

- **Market value (their side):** as above.
- **Your own buy list (their side, you buy):** the other trader's items at the prices of
  your buy list on torn-tracker.com.
- **A trader's buy list (your side, you sell):** your own items at a trader's public buy
  list. Put the trader's name or id in **The trader's name or id**.

The line then reads **Items at ExampleTrader's buy list** with the total, and links to the
list on torn-tracker.com. Only items count: money in the trade isn't part of a buy list. An
item the list doesn't buy shows as **not on the list**, never as $0.

If the line says something else:

- **Add your script key:** add it under **Keys** in the settings.
- **No public buy list by that name:** check the name, or ask the trader to publish it.
- **Asked to wait:** torn-tracker.com limits how often a list is read. It's read again
  after a minute.

## Copy a receipt

**Copy receipt** puts a plain-text receipt on your clipboard, ready to paste in the chat:
each item with its price, the money, and the total. Where your browser has no clipboard,
the receipt opens in a box for you to copy by hand.

The companion never accepts, adds to or changes a trade, and never fills in the money.

> **What it reads and sends.** It reads the items and money on the side it totals and asks
> torn-tracker.com for the items' market values, or, at a buy list, for that list with your
> script key, at most once every five minutes per list. Nothing is shared.
