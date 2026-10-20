// Where another player's bazaar keeps its listings (CMP-006: one file to fix when Torn
// changes).
//
// Facts, not code, from TornTools (GPLv3, src/common/pages/bazaar-page.ts,
// features/bazaar-worth, read 2026-10) and Torn PDA (GPLv3, js_snippets.dart). Confirm
// against a capture of a live response before relying on the field names.

/** The page's own request for a chunk of listings: bazaar.php?…step=getBazaarItems. */
export function isItemsResponse(url) {
  const u = String(url || '');
  return /\/bazaar\.php(\?|$)/.test(u) && /[?&]step=getBazaarItems(&|$)/.test(u);
}

/** Someone else's bazaar is bazaar.php?userId=N; your own pages are #/, #/add, #/manage. */
export const OWNER_PARAM = 'userId';

/** The page's cookie with the logged-in player's id, as TornTools reads it. */
export const OWN_ID_COOKIE = 'uid';
