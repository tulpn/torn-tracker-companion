// Reads the gym page and its own responses (CMP-206, D-073). Pure.

import { GYM_BUTTON, GYM_ID_CLASS, IN_PROGRESS, PERCENT, STATS } from './selectors.js';

const positive = (v) => (Number.isInteger(v) && v > 0 ? v : null);

/** '1,234.56' -> 1234.56; anything else -> null. */
export function statValue(text) {
  const t = String(text ?? '').replace(/,/g, '').trim();
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** getInitialGymInfo -> the stats' values and the active gym's id. */
export function readInitial(data) {
  const stats = new Map();
  for (const stat of STATS) {
    const value = statValue(data?.stats?.[stat]?.value);
    if (value !== null) stats.set(stat, value);
  }
  let active = null;
  for (const group of Object.values(data?.gyms && typeof data.gyms === 'object' ? data.gyms : {})) {
    for (const gym of Array.isArray(group) ? group : []) {
      if (gym?.status === 'active' && positive(gym.id)) active = gym.id;
    }
  }
  return { stats, active };
}

/** A train answer -> the stat and its new value; null unless it succeeded. */
export function readTrain(data) {
  if (!data?.success) return null;
  const stat = String(data.stat?.name || '').toLowerCase();
  const value = statValue(data.stat?.newValue);
  return STATS.includes(stat) && value !== null ? { stat, value } : null;
}

/**
 * Why readProgress found nothing, for the debug log (hq #576): no gym buttons at all
 * (Torn's markup differs), buttons but none in progress (every gym unlocked, or the
 * markup differs), or a gym in progress whose id or percentage didn't read.
 */
export function whyNoProgress(doc) {
  const buttons = doc.querySelectorAll(GYM_BUTTON).length;
  if (doc.querySelector(IN_PROGRESS)) {
    return 'a gym in progress is on the page, but its gym id or percentage did not read; tell torn-tracker';
  }
  if (buttons === 0) return 'no gym buttons found on the page; the markup differs, tell torn-tracker';
  return `${buttons} gyms on the page, none in progress (every gym unlocked, or the markup differs)`;
}

const SHAPE_KEYS = 30;

/**
 * The field names of a page answer, never its values, for the debug log (hq #576): which
 * field carries a train's energy is learned from a real answer. Nested objects one level
 * down, as `stat{name,newValue}`; at most 30 names.
 */
export function answerShape(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return '';
  const keys = Object.keys(data).filter((k) => /^[\w$-]{1,40}$/.test(k)).sort().slice(0, SHAPE_KEYS);
  return keys.map((k) => {
    const v = data[k];
    if (!v || typeof v !== 'object' || Array.isArray(v)) return k;
    const inner = Object.keys(v).filter((x) => /^[\w$-]{1,40}$/.test(x)).sort().slice(0, SHAPE_KEYS);
    return `${k}{${inner.join(',')}}`;
  }).join(', ');
}

/** The in-progress gym on the page: its id and percentage, or null. */
export function readProgress(doc) {
  const button = doc.querySelector(IN_PROGRESS);
  if (!button) return null;
  let gymId = null;
  for (const node of [button, ...button.querySelectorAll('*')]) {
    const m = GYM_ID_CLASS.exec(typeof node.className === 'string' ? node.className : '');
    if (m) {
      gymId = Number(m[1]);
      break;
    }
  }
  const text = button.querySelector(PERCENT)?.textContent || '';
  const m = /^\s*(\d{1,3}(?:\.\d+)?)\s*%?\s*$/.exec(text);
  const percent = m ? Number(m[1]) : null;
  if (!positive(gymId) || percent === null || percent > 100) return null;
  return { gym_id: gymId, percent, button };
}
