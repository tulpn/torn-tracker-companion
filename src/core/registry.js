// The feature descriptor (CMP-002) and the registry built from it.
//
// Every feature exports exactly one of these. The registry is validated when the script
// boots, so a malformed descriptor is a test failure rather than a page that half works.

import { isKnownKind } from './kinds.js';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The areas the settings page groups features by (CMP-107). */
export const AREA_KEYS = Object.freeze(['war', 'travel', 'market', 'crimes', 'gym', 'jobs', 'other']);

/** Option values a feature may keep in settings: scalars only, so they validate cleanly. */
const SCALAR = new Set(['boolean', 'number', 'string']);

function fail(id, message) {
  throw new Error(`feature ${id ? `"${id}"` : '(no id)'}: ${message}`);
}

export function validateDescriptor(d) {
  if (!d || typeof d !== 'object') fail(null, 'is not an object');
  const { id } = d;
  if (typeof id !== 'string' || !ID.test(id)) fail(id, 'id must be kebab-case');
  if (!Number.isInteger(d.wave) || d.wave < 1) fail(id, 'wave must be 1, 2 or 3');
  if (typeof d.title !== 'string' || !d.title) fail(id, 'title is required');
  if (!AREA_KEYS.includes(d.area)) fail(id, `area must be one of ${AREA_KEYS.join(', ')}`);
  if (typeof d.guide !== 'string' || !ID.test(d.guide)) fail(id, 'guide must name its knowledge base page');
  if (typeof d.summary !== 'string' || !d.summary || d.summary.length > 140) fail(id, 'summary must be one line of at most 140 characters');
  if (!Array.isArray(d.routes) || d.routes.length === 0) fail(id, 'routes must be a non-empty array');
  if (d.routes.some((r) => typeof r !== 'string' || !r)) fail(id, 'routes must be strings');

  if (!d.defaults || typeof d.defaults !== 'object') fail(id, 'defaults must be an object');
  if (typeof d.defaults.enabled !== 'boolean') fail(id, 'defaults.enabled must be a boolean');
  for (const [key, value] of Object.entries(d.defaults)) {
    if (!SCALAR.has(typeof value)) fail(id, `defaults.${key} must be a boolean, number or string`);
  }

  if (!Array.isArray(d.shares) || d.shares.some((k) => typeof k !== 'string')) {
    fail(id, 'shares must be an array of observation kinds');
  }
  for (const kind of d.shares) {
    if (!isKnownKind(kind)) fail(id, `shares "${kind}", which core/kinds.js does not define`);
  }
  validateOptions(d);
  if (!d.needs || typeof d.needs.apiKey !== 'boolean' || typeof d.needs.scriptKey !== 'boolean') {
    fail(id, 'needs must declare apiKey and scriptKey');
  }
  if (!Array.isArray(d.credits) || d.credits.some((c) => typeof c !== 'string')) {
    fail(id, 'credits must be an array of strings');
  }
  if (d.data !== undefined) {
    if (!d.data || typeof d.data.validate !== 'function' || d.data.empty === undefined) {
      fail(id, 'data must have an empty value and a validate function');
    }
  }
  if (typeof d.start !== 'function' || typeof d.stop !== 'function') {
    fail(id, 'start and stop must be functions');
  }
  return d;
}

/**
 * The panel shows an option only when the descriptor describes it:
 *   options: { sortBy: { label: 'Sort by', choices: ['status', 'level'] },
 *              undercut: { label: 'Undercut by ($)', min: 0, max: 1000000 } }
 * Every described option has a default, and `enabled` is the feature's own switch.
 */
function validateOptions(d) {
  if (d.options === undefined) return;
  const { id } = d;
  if (!d.options || typeof d.options !== 'object') fail(id, 'options must be an object');
  for (const [key, option] of Object.entries(d.options)) {
    if (key === 'enabled') fail(id, 'options.enabled: the feature switch is not an option');
    if (!Object.hasOwn(d.defaults, key)) fail(id, `options.${key} has no default`);
    if (!option || typeof option.label !== 'string' || !option.label) fail(id, `options.${key}.label is required`);
    const fallback = d.defaults[key];
    if (option.choices !== undefined) {
      if (!Array.isArray(option.choices) || option.choices.length === 0
        || option.choices.some((c) => typeof c !== typeof fallback)) {
        fail(id, `options.${key}.choices must be a list of values like its default`);
      }
      if (!option.choices.includes(fallback)) fail(id, `options.${key}: the default is not one of the choices`);
      if (option.labels !== undefined && (typeof option.labels !== 'object'
        || Object.values(option.labels).some((l) => typeof l !== 'string' || !l))) {
        fail(id, `options.${key}.labels must give each choice a name`);
      }
    }
    for (const bound of ['min', 'max']) {
      if (option[bound] === undefined) continue;
      if (typeof fallback !== 'number' || !Number.isFinite(option[bound])) {
        fail(id, `options.${key}.${bound} needs a number option and a number`);
      }
    }
    if (typeof fallback === 'number' && !inRange(fallback, option)) fail(id, `options.${key}: the default is out of range`);
  }
}

/** True when a number option's value is within its min and max. */
export function inRange(value, option = {}) {
  return (option.min === undefined || value >= option.min) && (option.max === undefined || value <= option.max);
}

export function createRegistry(descriptors) {
  if (!Array.isArray(descriptors)) throw new Error('registry: descriptors must be an array');
  const seen = new Set();
  for (const d of descriptors) {
    validateDescriptor(d);
    if (seen.has(d.id)) fail(d.id, 'duplicate id');
    seen.add(d.id);
  }
  return Object.freeze([...descriptors]);
}

/** Every observation kind any feature can produce, for the panel's sharing switches. */
export function shareKinds(registry) {
  const kinds = new Set();
  for (const d of registry) for (const kind of d.shares) kinds.add(kind);
  return [...kinds].sort();
}

export function byId(registry, id) {
  return registry.find((d) => d.id === id) || null;
}
