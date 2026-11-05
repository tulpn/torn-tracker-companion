// Reads the gym page and its own responses (CMP-206, D-073). Pure.

import { ACTIVE, GYM_BUTTON, GYM_ID_CLASS, IN_PROGRESS, PERCENT, STATS } from './selectors.js';

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

const count = (v, max) => (Number.isInteger(v) && v > 0 && v <= max ? v : null);

/**
 * The gain a train answer's own message names (hq #576): "… gained 12.34 dexterity" or
 * "12.34 dexterity". Null when the message names no such number.
 */
export function gainFromMessage(message, stat) {
  const text = String(message ?? '').replace(/<[^>]*>/g, ' ').slice(0, 500);
  const m = /gained\s+([\d,]+(?:\.\d+)?)/i.exec(text)
    || new RegExp(`([\\d,]+(?:\\.\\d+)?)\\s+${stat === 'defense' ? 'defen[cs]e' : stat}\\b`, 'i').exec(text);
  const gain = m ? statValue(m[1]) : null;
  return gain !== null && gain > 0 ? gain : null;
}

/**
 * A train answer -> the stat, its new value, and what the answer itself says of the train
 * (hq #576): the gain from its message, the energy spent and the number of trains. Null
 * unless it succeeded.
 */
export function readTrain(data) {
  if (!data?.success) return null;
  const stat = String(data.stat?.name || '').toLowerCase();
  const value = statValue(data.stat?.newValue);
  if (!STATS.includes(stat) || value === null) return null;
  return {
    stat,
    value,
    gain: gainFromMessage(data.gainMessage, stat),
    energy: count(data.energySpent, 1_000_000),
    trains: count(data.repeats, 10_000),
  };
}

const ID_KEYS = ['id', 'gymID', 'gymId', 'gym_id', 'ID'];
const PERCENT_KEYS = ['percentage', 'percent', 'progress'];

/**
 * A train answer's gymsStatuses (hq #576) -> the active gym and the gym in progress with
 * its percentage, where its entries say so. Its shape is learned from a real answer (the
 * debug log names it); entries that don't read are skipped.
 */
export function readStatuses(list) {
  let active = null;
  let progress = null;
  for (const entry of Array.isArray(list) ? list.slice(0, 100) : []) {
    if (!entry || typeof entry !== 'object') continue;
    const id = positive(Number(ID_KEYS.map((k) => entry[k]).find((v) => v !== undefined)));
    if (!id) continue;
    const status = String(entry.status ?? entry.state ?? '').toLowerCase().replace(/[\s_-]/g, '');
    const raw = PERCENT_KEYS.map((k) => entry[k]).find((v) => v !== undefined);
    const percent = raw === undefined ? null : Number(String(raw).replace('%', ''));
    if (status === 'active') active = id;
    if ((status === 'inprogress' || status === 'progress') && Number.isFinite(percent) && percent >= 0 && percent <= 100) {
      progress = { gym_id: id, percent };
    }
  }
  return { active, progress };
}

/** The field names of an answer's list entries, all entries together, never values (hq #576). */
export function listShape(list) {
  if (!Array.isArray(list)) return '';
  const merged = {};
  for (const entry of list.slice(0, 100)) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      for (const k of Object.keys(entry)) merged[k] ??= entry[k] && typeof entry[k] === 'object' ? entry[k] : 0;
    }
  }
  return answerShape(merged);
}

/** A gym button's id, from the gym-<n> class on it or a child; null if none reads. */
export function buttonGymId(button) {
  for (const node of [button, ...button.querySelectorAll('*')].slice(0, 50)) {
    const m = GYM_ID_CLASS.exec(typeof node.className === 'string' ? node.className : '');
    if (m) return positive(Number(m[1]));
  }
  return null;
}

/** A gym button's percentage: its percentage element, else any "62%" text in it. */
function buttonPercent(button) {
  const texts = [button.querySelector(PERCENT)?.textContent, button.textContent];
  for (const text of texts) {
    const m = /(?:^|\s)(\d{1,3}(?:\.\d+)?)\s*%/.exec(String(text ?? ''));
    if (m && Number(m[1]) <= 100) return Number(m[1]);
  }
  return null;
}

/** The gym the page marks active, or null. */
export function readActive(doc) {
  const button = doc.querySelector(ACTIVE);
  return button ? buttonGymId(button) : null;
}

/** Torn's class names in a button, cut at the hash, never text: for the debug log. */
function classNames(button) {
  const names = new Set();
  for (const node of [button, ...button.querySelectorAll('*')].slice(0, 50)) {
    for (const c of String(typeof node.className === 'string' ? node.className : '').split(/\s+/)) {
      const name = c.split('___')[0];
      if (/^[\w-]{1,40}$/.test(name)) names.add(name);
    }
  }
  return [...names].slice(0, 20).join(' ');
}

/**
 * Why readProgress found nothing, for the debug log (hq #515, #576): no gym buttons at all
 * (Torn's markup differs), buttons but none in progress (every gym unlocked, or the
 * markup differs), or a gym in progress whose id or percentage didn't read, with Torn's
 * class names in it so the reader can be fixed.
 */
export function whyNoProgress(doc) {
  const buttons = doc.querySelectorAll(GYM_BUTTON).length;
  const inProgress = doc.querySelector(IN_PROGRESS);
  if (inProgress) {
    const missing = [buttonGymId(inProgress) ? null : 'gym id', buttonPercent(inProgress) === null ? 'percentage' : null].filter(Boolean);
    return `a gym in progress is on the page, but its ${missing.join(' and ')} did not read (classes: ${classNames(inProgress) || 'none'}); tell torn-tracker`;
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
  const gymId = buttonGymId(button);
  const percent = buttonPercent(button);
  if (!gymId || percent === null) return null;
  return { gym_id: gymId, percent, button };
}
