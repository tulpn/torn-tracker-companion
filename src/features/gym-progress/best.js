// Best gain yet (hq #800, ENG-078). Each stat's best single train, kept on this device
// only: never shared, never uploaded. A train that beats it gets one line, saying since
// when the record runs; any other train, and the first one ever, shows nothing.

import { STATS } from './selectors.js';

const MAX_GAIN = 1e12;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NAMES = Object.freeze({ strength: 'Strength', defense: 'Defense', speed: 'Speed', dexterity: 'Dexterity' });

/** What storage holds is checked field by field: per stat, a gain and when the record began. */
export function validateBest(raw) {
  const given = raw?.best && typeof raw.best === 'object' ? raw.best : {};
  const best = {};
  for (const stat of STATS) {
    const b = given[stat];
    if (!b || typeof b !== 'object') continue;
    const gain = typeof b.gain === 'number' && Number.isFinite(b.gain) && b.gain > 0 && b.gain <= MAX_GAIN ? b.gain : null;
    const since = Number.isInteger(b.since) && b.since > 0 ? b.since : null;
    if (gain !== null && since !== null) best[stat] = { gain, since };
  }
  return { best };
}

/**
 * The data after one train, and whether it beat the record. The first train of a stat only
 * starts its record; `since` stays the first train's time, so the line can say how long the
 * record has run.
 * @returns {{ data: { best: object }, beaten: { gain: number, since: number } | null }}
 */
export function withTrain(data, stat, gain, at) {
  const { best } = validateBest(data);
  if (!STATS.includes(stat) || !(gain > 0) || gain > MAX_GAIN || !Number.isInteger(at) || at <= 0) {
    return { data: { best }, beaten: null };
  }
  const record = best[stat];
  if (!record) return { data: { best: { ...best, [stat]: { gain, since: at } } }, beaten: null };
  if (gain <= record.gain) return { data: { best }, beaten: null };
  return { data: { best: { ...best, [stat]: { gain, since: record.since } } }, beaten: { gain, since: record.since } };
}

/** "3 Nov", in Torn's time (UTC). */
export function shortDate(ms) {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "+1,204 Strength. Your best single train since 3 Nov." */
export function bestText(stat, gain, since) {
  const amount = gain.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `+${amount} ${NAMES[stat] || stat}. Your best single train since ${shortDate(since)}.`;
}
