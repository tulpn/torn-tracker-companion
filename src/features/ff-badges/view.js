// What a badge looks like (CMP-101). Pure: an estimate in, text and colours out.
//
// The colours follow FF Scouter V2's default scale so players read them the way they
// already do: FF 1 to 5 in eleven steps from blue (easy) through green and yellow to red
// (hard). A player the site does not know gets "?" on grey, never a guess.

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

/** @param {{ff: number|null, band: string|null} | undefined} estimate */
export function describe(estimate) {
  const ff = estimate?.ff;
  if (typeof ff !== 'number') {
    return { text: '?', title: 'Fair fight: no estimate for this player yet', background: UNKNOWN_COLOUR };
  }
  const band = estimate.band ? `, stats about ${estimate.band}` : '';
  return { text: ff.toFixed(2), title: `Fair fight ${ff.toFixed(2)}${band} (torn-tracker.com)`, background: colourFor(ff) };
}
