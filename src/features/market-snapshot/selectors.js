// Where the item market shows one item's listings (CMP-006: one file to fix when Torn
// changes).
//
// Facts, not code, from TornTools (GPLv3, src/common/pages/itemmarket-page.ts,
// features/highlight-cheap-items and item-market-fill-max), read 2026-10. No source reads
// the page's own listings answer (page.php?sid=iMarket&step=getListing), so the rows
// are read from the page.

/** One listing row, and its price and quantity. The mobile header row has neither. */
export const ROW = "[class*='sellerList___'] [class*='rowWrapper___']";
export const PRICE = "[class*='price___']";
export const AVAILABLE = "[class*='available___']";

/** The item's image beside the list, when the hash has no itemID. */
export const LIST_WRAPPER = "[class*='sellerListWrapper___']";
export const ITEM_IMAGE = 'img.torn-item';
