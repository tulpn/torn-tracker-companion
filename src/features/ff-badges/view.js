// What a badge looks like (CMP-101). Pure: an estimate in, text and colours out.
//
// The colours follow FF Scouter V2's default scale so players read them the way they
// already do: FF 1 to 5 in eleven steps from blue (easy) through green and yellow to red
// (hard). A player the site has no figure for gets a dash on grey, never a guess (hq #492);
// one it knows only a band for gets "?" with the band on hover. An estimate from
// FFScouter says so on hover, as their terms ask (D-171).

const SCALE = [
  '#1734e8', '#1788e8', '#17dbe8', '#17e8a1', '#17e84e', '#34e817',
  '#88e817', '#dbe817', '#e8a117', '#e84e17', '#e81734',
];

export const UNKNOWN_COLOUR = '#555555';

/** The background for an FF value; FF above 5 is as hard as the scale goes. */
export function colourFor(ff) {
  if (typeof ff !== 'number' || !Number.isFinite(ff)) return UNKNOWN_COLOUR;
  const clamped = Math.min(5, Math.max(1, ff));
  return SCALE[Math.min(SCALE.length - 1, Math.floor(((clamped - 1) / 4) * 10))];
}

/** Black or white, whichever reads on the background. */
export function textColourFor(background) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(background);
  if (!m) return '#ffffff';
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 126 ? '#000000' : '#ffffff';
}

export const NO_ESTIMATE = '–';

/** "today", "1 day ago", "12 days ago": how old an estimate is. */
function age(at, now) {
  if (typeof at !== 'number' || !Number.isFinite(at)) return '';
  const days = Math.floor(Math.max(0, now - at) / 86_400_000);
  if (days === 0) return ', estimated today';
  return days === 1 ? ', estimated 1 day ago' : `, estimated ${days} days ago`;
}

/** Whose figure it is, for the hover text. */
function by(source) {
  return source === 'ffscouter' ? 'estimate by FFScouter, ffscouter.com, via torn-tracker.com' : 'torn-tracker.com';
}

/**
 * @param {{ff: number|null, band: string|null, source?: string|null, estimatedAt?: number|null} | undefined} estimate
 * @param {number} [now]
 */
export function describe(estimate, now = Date.now()) {
  const ff = estimate?.ff;
  const band = typeof estimate?.band === 'string' && estimate.band ? estimate.band : null;
  const when = age(estimate?.estimatedAt, now);
  if (typeof ff !== 'number') {
    if (band) {
      return { text: '?', title: `Fair fight: no exact figure, stats about ${band} (${by(estimate.source)}${when})`, background: UNKNOWN_COLOUR };
    }
    return { text: NO_ESTIMATE, title: 'Fair fight: no estimate for this player yet', background: UNKNOWN_COLOUR };
  }
  const about = band ? `, stats about ${band}` : '';
  return { text: ff.toFixed(2), title: `Fair fight ${ff.toFixed(2)}${about} (${by(estimate.source)}${when})`, background: colourFor(ff) };
}
