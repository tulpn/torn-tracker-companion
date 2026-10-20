// What the script tells players about sharing (CMP-012, CMP-014).
//
// The Torn API terms table, the first-run notice and the "what is shared" line for each
// kind. Until a text is here, the part of the panel that needs it stays closed: no sharing
// switch can be turned on without its line and the first-run notice, and the optional
// Torn API key field does not appear without the terms table. tools/release.mjs refuses
// a 1.0.0-or-later release that ships a feature whose words are missing (disclosureGaps
// below); a 0.x testing release only notes them.
//
// The owner delegated this wording to the lanes on 2026-10-20 (hq #108). Each line states
// only what the code and specs/companion-api.md say happens: what is read, when, what the
// site keeps and for how long, and what it publishes. Change a line only with the facts.
//
// `version` goes up whenever any wording changes. A player who agreed to an older
// version shares nothing until they have read the new one and pressed "Share the kinds
// I picked" again.

export const DISCLOSURE = Object.freeze({
  version: 1,
  /** Shown once, above the sharing switches, before any kind can be switched on. */
  firstRun: [
    'Sharing sends torn-tracker.com what Torn showed you on pages you opened yourself, so it can',
    "publish what Torn's API doesn't: foreign stock, loadouts and more. Every kind is off until",
    'you switch it on here and press "Share the kinds I picked". Each one sends only what its',
    'line below says, with the time you saw it, and never anything from company or faction',
    'application pages. It goes with your script key, so the site knows who sent each report and',
    'can catch false ones; it never publishes who sent anything. The site combines what players',
    'send and publishes the result openly, for every player and tool. Switch a kind off here at',
    'any time to stop sharing it.',
  ].join(' '),
  /** kind -> one line saying what that kind shares, shown beside its switch. */
  kinds: Object.freeze({
    foreign_stock: [
      'On a foreign shop while you are abroad: the country, and each item with its stock and price,',
      'empty shelves included, at most once every 30 seconds per country and only while the tab is',
      'on screen. The site keeps each report with who sent it for 30 days, so it knows you were in',
      'that country then; it publishes stock and restock times as "seen at", never by whom.',
    ].join(' '),
    loadout: [
      "On an attack: the other player's id, and the weapons and armour the attack page shows them",
      'wearing, with their damage, accuracy and bonuses, once per attack. The site keeps reports for',
      "90 days and publishes each player's latest loadout openly, replacing it on every new report",
      'and removing it once nobody has seen it for 180 days.',
    ].join(' '),
  }),
  /**
   * Torn's five-column terms table, shown above the Torn API key field:
   * { dataStorage, dataSharing, purposeOfUse, keyStorageSharing, keyAccessLevel }
   * No feature takes a Torn API key yet. The table comes with the first one, stating the
   * selections it really calls.
   */
  tosTable: null,
});

/** Torn's own names for the five columns, in Torn's order. */
export const TOS_COLUMNS = Object.freeze([
  ['dataStorage', 'Data storage'],
  ['dataSharing', 'Data sharing'],
  ['purposeOfUse', 'Purpose of use'],
  ['keyStorageSharing', 'Key storage & sharing'],
  ['keyAccessLevel', 'Key access level'],
]);

const text = (value) => typeof value === 'string' && value.trim() !== '';

export function hasTosTable(disclosure = DISCLOSURE) {
  const table = disclosure.tosTable;
  return Boolean(table) && TOS_COLUMNS.every(([key]) => text(table[key]));
}

/** Sharing can be offered at all: there is a notice to show and a version to agree to. */
export function sharingOffered(disclosure = DISCLOSURE) {
  return Number.isInteger(disclosure.version) && disclosure.version > 0 && text(disclosure.firstRun);
}

/** This kind's switch can be offered: the notice exists and the kind has its line. */
export function kindOffered(kind, disclosure = DISCLOSURE) {
  return sharingOffered(disclosure) && text(disclosure.kinds?.[kind]);
}

/**
 * What a build would ship without its words. Empty means the build may be released.
 * @param {ReadonlyArray<object>} registry
 * @returns {string[]}
 */
export function disclosureGaps(registry, disclosure = DISCLOSURE) {
  const gaps = [];
  const kinds = [...new Set(registry.flatMap((d) => d.shares))].sort();
  if (kinds.length && !sharingOffered(disclosure)) {
    gaps.push('the first-run notice (and a disclosure version above 0)');
  }
  for (const kind of kinds) {
    if (!text(disclosure.kinds?.[kind])) gaps.push(`the "what is shared" line for ${kind}`);
  }
  const keyed = registry.filter((d) => d.needs.apiKey).map((d) => d.id);
  if (keyed.length && !hasTosTable(disclosure)) {
    gaps.push(`the Torn API terms table (needed by ${keyed.join(', ')})`);
  }
  return gaps;
}
