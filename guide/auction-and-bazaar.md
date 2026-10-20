---
title: Auctions and bazaars
summary: Share the bazaar, auction and item market listings you see, so torn-tracker.com can publish prices Torn's API doesn't.
section: Guides
group: features
order: 270
type: how-to
audience: everyone
icon: magnifying-glass
tier: core
keywords: torn bazaar prices, auction house prices, item market prices torn
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone. Needs your script key. Each kind is off until you switch it on.

Torn's API has no player's bazaar listings and no live auctions. When you browse them, the
companion can share what the page shows, and torn-tracker.com publishes the combined
prices openly. Every detail is in [Sharing kinds, one by one](sharing-kinds.md).

## Bazaars

On another player's bazaar: their id and each item listed with its quantity and price, as
far as you scroll. At most once per bazaar every five minutes. **Never your own bazaar.**

## Auctions

On the auction house: each listing you see, with the seller (none when anonymous), the bid,
the time left, rarity, stats and bonuses. **Never the high bidder.** A listing is sent
again only when its bid changes.

## Item market

The item market's listings are mostly in Torn's API already. When torn-tracker.com needs
fresh prices for an item you open, the prices and quantities of up to 50 listings can be
sent, **never who's selling.**

> **What it reads and sends.** With the kind switched on: what each page shows, as above.
> Nothing is bought or bid on, and nothing is clicked.
