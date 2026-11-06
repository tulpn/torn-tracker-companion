// What a badge looks like (CMP-101). Pure: an estimate in, text and colours out.
//
// The figure is the raw fair fight, the same number FFScouter shows (D-203, hq #592): 1.00
// to 9.99 with two decimals, 10.0 and above with one. Torn pays respect at most 3.00×, and
// the hover text says so once. The colour is the site's difficulty band (D-203): easy up to
// 2.0 muted, moderate to 3.5 green (the respect sweet spot), difficult to 4.5 amber, then
// red. A player the site has no figure for gets a dash on grey, never a guess (hq #492);
// one it knows only a band for gets "?" with the band on hover. An estimate from
// FFScouter says so on hover, as their terms ask (D-171).

import { FF_DIFFICULTIES as DIFFICULTIES } from '../../core/site.js';

const BAND_COLOUR = Object.freeze({
  easy: '#9aa3ad',
  moderate: '#2f9e44',
  difficult: '#f0a020',
  impossible: '#d9342b',
});

const BAND_WORDS = Object.freeze({
  easy: 'easy',
  moderate: 'moderate',
  difficult: 'difficult',
  impossible: 'may be impossible',
});

export const UNKNOWN_COLOUR = '#555555';

/** The site's band for a fair fight, with its edges: 2.0 is easy, 3.5 moderate, 4.5 difficult. */
export function difficultyOf(ff) {
  if (typeof ff !== 'number' || !Number.isFinite(ff)) return null;
  if (ff <= 2) return 'easy';
  if (ff <= 3.5) return 'moderate';
  if (ff <= 4.5) return 'difficult';
  return 'impossible';
}

/** The background for a band, or for an FF value when the site sent no band. */
export function colourFor(ff, difficulty = null) {
  const band = DIFFICULTIES.includes(difficulty) ? difficulty : difficultyOf(ff);
  return band ? BAND_COLOUR[band] : UNKNOWN_COLOUR;
}

/** "2.35", "9.99", "12.4": two decimals below 10, one from 10 up, never wrapped. */
export function ffText(ff) {
  const two = ff.toFixed(2);
  return Number(two) >= 10 ? ff.toFixed(1) : two;
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
 * @param {{ff: number|null, band: string|null, difficulty?: string|null, source?: string|null, estimatedAt?: number|null} | undefined} estimate
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
  const about = band ? ` · stats about ${band}` : '';
  const level = DIFFICULTIES.includes(estimate.difficulty) ? estimate.difficulty : difficultyOf(ff);
  const text = ffText(ff);
  return {
    text,
    title: `Fair fight ${text} · ${BAND_WORDS[level]} · Torn pays respect at most 3.00×${about} (${by(estimate.source)}${when})`,
    background: colourFor(ff, level),
  };
}
