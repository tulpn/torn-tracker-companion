// Where the trade page keeps each side's offer (CMP-006: one file to fix when Torn
// changes).
//
// Facts, not code, from TornTools (GPLv3, src/common/pages/trade-page.ts and the
// trade-values feature) and Torn PDA (GPLv3, webview_full.dart _assessTrades), read
// 2026-10. The left side is the player's own; the right side is the other trader's.

/** The other trader's side of the trade. */
export const THEIR_SIDE = '.user.right';

/** Their name, above their side. */
export const THEIR_NAME = '.title-black';

/** One line per entry; "No money in trade" and "No items in trade" when empty. */
export const MONEY = '.cont .color1 .desc > li .name';
export const ITEMS = '.cont .color2 .desc > li .name';

/** The hash steps on which a trade's contents are shown. */
export const STEPS = Object.freeze(['view', 'initiateTrade', 'accept']);
