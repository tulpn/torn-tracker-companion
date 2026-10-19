// The feature descriptor (CMP-002) and the registry built from it.
//
// Every feature exports exactly one of these. The registry is validated when the script
// boots, so a malformed descriptor is a test failure rather than a page that half works.

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
  if (!d.needs || typeof d.needs.apiKey !== 'boolean' || typeof d.needs.scriptKey !== 'boolean') {
    fail(id, 'needs must declare apiKey and scriptKey');
  }
  if (!Array.isArray(d.credits) || d.credits.some((c) => typeof c !== 'string')) {
    fail(id, 'credits must be an array of strings');
  }
  if (typeof d.start !== 'function' || typeof d.stop !== 'function') {
    fail(id, 'start and stop must be functions');
  }
  return d;
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
