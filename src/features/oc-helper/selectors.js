// Where the faction's Organized Crimes 2.0 page keeps its crimes (CMP-006: one file to
// fix when Torn changes).
//
// Facts, not code, from TornTools (GPLv3, src/common/pages/factions-page.ts and the
// oc-weights, oc2-filter and highlight-oc features) and OC2.0 Helper by Strigwulf (GPLv3,
// greasyfork.org/scripts/577968), read 2026-10. That `data-oc-id` holds Torn's crime id
// is inferred: no source reads its value. Confirm with a capture.

/** One crime card; its attribute is the crime's id. */
export const CARD = '#faction-crimes-root [data-oc-id]';
export const CARD_ID = 'ocId';

/** The crime's name, as Torn names the scenario ("Pet Project"). */
export const NAME = "[class*='panelTitle']";

/** One slot in a card, its header, and the role's title ("Looter #1"). */
export const SLOT = "[class*='contentLayer___'] > [class*='wrapper___'] > [class*='wrapper___']";
export const SLOT_HEADER = "[class*='slotHeader___']";
export const SLOT_TITLE = "[class*='title___']";
