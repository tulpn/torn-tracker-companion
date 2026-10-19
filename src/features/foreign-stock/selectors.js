// Where Torn keeps the foreign shop's data (CMP-006: one file to fix when Torn changes).
//
// Facts, not code, from TornTools (GPLv3, github.com/Mephiles/torntools_extension,
// src/common/pages/travel-abroad-page.ts and features/travel-item-profits, as of
// 2026-10) and Torn PDA (GPLv3, lib/widgets/webviews/handlers/travel_handler.dart).
// Confirm against a capture from a live page before each release that changes them.

/** The page's own request for the shop's shelves. */
export function isShopResponse(url) {
  return /[?&]sid=travelData(&|$)/.test(url) && /[?&]step=shop(&|$)/.test(url);
}

/** Torn marks the page body while the player is abroad and not in the air. */
export const BODY_ABROAD = 'abroad';
export const BODY_TRAVELING = 'traveling';
export const BODY_COUNTRY = 'country';

// Fallback when the response was missed. Torn's class names carry a hash after "___",
// so they are matched by prefix.
export const ROWS = "[class*='stockTableWrapper___'] [class*='row___']";
export const ITEM_IMAGE = 'img';
export const PRICE = "[class*='displayPrice__']";
