// The words the owner writes (CMP-012, CMP-014; hq RULES section 6).
//
// The Torn API terms table, the first-run notice and the "what is shared" line for each
// kind are the owner's to word, never the code's. Until a text is here, the part of the
// panel that needs it stays closed: no sharing switch can be turned on without its line
// and the first-run notice, and the optional Torn API key field does not appear without
// the terms table. tools/release.mjs refuses to cut a release that ships a feature whose
// words are missing (disclosureGaps below).
//
// `version` goes up whenever any wording changes. A player who agreed to an older
// version shares nothing until they have read the new one and pressed "Share the kinds
// I picked" again.
//
// Wording is tracked in the hq repo, issue #9.

export const DISCLOSURE = Object.freeze({
  version: 0,
  /** Shown once, above the sharing switches, before any kind can be switched on. */
  firstRun: null,
  /** kind -> one line saying what that kind shares, shown beside its switch. */
  kinds: Object.freeze({}),
  /**
   * Torn's five-column terms table, shown above the Torn API key field:
   * { dataStorage, dataSharing, purposeOfUse, keyStorageSharing, keyAccessLevel }
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
