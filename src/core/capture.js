// Shared rules for features that read a page and share what it showed (CMP-103, CMP-104,
// CMP-106; TRV-051).
//
// Two rules every capture follows:
//   - a fact is reported at most once per window (one shop per country every 30 s, one
//     loadout per attack view): the player reloading a page is not new information;
//   - nothing is reported from a tab the player is not looking at. Torn keeps background
//     tabs alive, and a page sitting open in one is no longer "the page the player opened".

/**
 * Lets each key through at most once per window.
 * @param {object} opts
 * @param {number} opts.windowMs
 * @param {() => number} [opts.now]
 */
export function createGate({ windowMs, now = Date.now }) {
  /** @type {Map<string, number>} key -> when it last went through */
  const seen = new Map();
  return {
    /** True, and remembered, when this key has not gone through within the window. */
    allow(key) {
      const at = now();
      for (const [k, t] of seen) if (at - t >= windowMs) seen.delete(k);
      if (seen.has(key)) return false;
      seen.set(key, at);
      return true;
    },
    reset() {
      seen.clear();
    },
  };
}

/** True when the player can see this tab. A document with no visibility API counts as seen. */
export function isVisible(doc = globalThis.document) {
  return !doc || doc.visibilityState === undefined || doc.visibilityState === 'visible';
}
