// Where the auction house keeps its listings (CMP-006: one file to fix when Torn changes).
//
// From the owner's capture of amarket.php on 2026-10-20 (test/fixtures/pages/
// auction-house.html), which agrees with TornTools (GPLv3, auction-house-filter), Cortex
// RW Auction Insights (MIT, greasyfork.org/scripts/587466) and OpenMarket (GPLv3,
// greasyfork.org/scripts/571158). No listings response was seen; the rows are read.

/** One listing; its id attribute is the listing's id. Loader and spacer rows have none. */
export const ROW = '#auction-house-tabs .items-list > li[id]';

/** Attributes `item` (item id) and `armoury` (the item's own id). */
export const ITEM = '.item-hover';

/** "Item seller: <a href=…XID=N>"; an anonymous seller has no link. */
export const SELLER = '.seller-wrap .name';
export const PROFILE_LINK = "a[href*='profiles.php?XID=']";

export const BIDS = '.bids-wrap';
export const CURRENT_BID = '.c-bid-wrap';

/** title="Ends on 14:23:11 - 20/10/26", in Torn time (UTC); `timer` is seconds left. */
export const ENDS = '.time-wrap span[title]';
export const TIMER = '.time-wrap .time[timer]';

/** title="<b>Quicken</b><br/>61% increased passive speed while using this weapon" */
export const BONUS_ICON = '.iconsbonuses .bonus-attachment-icons[title]';

/** <i class="bonus-attachment-item-damage-bonus"> beside <span class="label-value">. */
export const STAT = '.infobonuses .bonus-attachment';
export const STAT_VALUE = '.label-value';

/** class glow-yellow, glow-orange or glow-red; none of them is no rarity. */
export const PLATE = '.item-plate';
