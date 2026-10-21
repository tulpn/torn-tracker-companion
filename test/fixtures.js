// Stand-in feature descriptors. Real features arrive with WP-CMP-5 and WP-CMP-6; the
// core is tested against these so it keeps working whatever the features do.

export function descriptor(over = {}) {
  return {
    id: 'war-enhancer',
    wave: 1,
    title: 'War page',
    area: 'war',
    guide: 'war-page',
    summary: 'Sorts opponents and shows dibs.',
    routes: ['factions.php#/war/'],
    defaults: { enabled: true, sortBy: 'status' },
    shares: ['loadout'],
    needs: { apiKey: false, scriptKey: true },
    credits: ['Torn War Stuff Enhanced (MIT)'],
    start() {},
    stop() {},
    ...over,
  };
}

/** A descriptor that records what the runner did to it. */
export function spyDescriptor(over = {}) {
  const calls = [];
  const { start: onStart, stop: onStop, ...rest } = over;
  const d = descriptor({
    ...rest,
    start(ctx) {
      calls.push(['start', ctx]);
      if (onStart) onStart(ctx);
    },
    stop() {
      calls.push(['stop']);
      if (onStop) onStop();
    },
  });
  d.calls = calls;
  return d;
}

export function locationOf(href) {
  const url = new URL(href, 'https://www.torn.com');
  return { pathname: url.pathname, search: url.search, hash: url.hash };
}

/**
 * A disclosure with every text filled in, so the gated parts of the panel and the
 * sharing gate can be tested. The words are placeholders for tests only; the real ones
 * are the owner's (src/core/disclosure.js).
 */
/** A build with no wording at all: every part that needs words stays closed. */
export const UNWORDED = Object.freeze({ version: 0, firstRun: null, kinds: Object.freeze({}), tosTable: null });

export const WORDED = Object.freeze({
  version: 2,
  firstRun: 'TEST first-run notice.',
  kinds: { loadout: 'TEST loadout line.', foreign_stock: 'TEST foreign stock line.' },
  tosTable: {
    dataStorage: 'TEST storage',
    dataSharing: 'TEST sharing',
    purposeOfUse: 'TEST purpose',
    keyStorageSharing: 'TEST key storage',
    keyAccessLevel: 'TEST access',
  },
});

/** A loadout as a feature would hand it to share(). */
export function loadoutData(over = {}) {
  return {
    player_id: 123,
    context: 'attack',
    slots: { primary: { item_id: 1, damage: 50.5, accuracy: 60, bonuses: [{ name: 'Puncture', value: 12 }] } },
    ...over,
  };
}

/** A complete, valid observation, as the sharing gate hands it to the queue. */
export function observation(over = {}, at = Date.now()) {
  return {
    kind: 'foreign_stock',
    observed_at: new Date(at).toISOString(),
    script_version: '1.0.0',
    country: 'mexico',
    item_id: 206,
    quantity: 1000,
    price: 5000,
    ...over,
  };
}
