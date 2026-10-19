// Stand-in feature descriptors. Real features arrive with WP-CMP-5 and WP-CMP-6; the
// core is tested against these so it keeps working whatever the features do.

export function descriptor(over = {}) {
  return {
    id: 'war-enhancer',
    wave: 1,
    title: 'War page',
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
