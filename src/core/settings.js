// Settings (CMP-003, CMP-008, CMP-014).
//
// What comes back from storage is never trusted: every field is checked against the
// defaults the registry declares, and anything of the wrong type, or belonging to a
// feature or observation kind this build does not have, is dropped.
//
// A feature may also keep data of its own (its descriptor's `data`: an empty value and a
// validate function), such as saved racing templates. It lives in `featureData`, is
// checked by that function on every load, and goes with "Forget me" like everything else.
//
// Sharing switches are the one place where the default is not negotiable: every kind
// starts off and only the player turns it on (CMP-014). A switch that is on still shares
// nothing until the player has agreed to the current wording of what is shared:
// `sharingConsent` holds the disclosure version they agreed to, 0 for none.
//
// The sidebar block (CMP-108) has a master switch and one switch per item, with the
// defaults its table in the spec gives.

import { KEYS, read, write } from './storage.js';
import { SIDEBAR_ITEMS } from './sidebar.js';
import { inRange, shareKinds } from './registry.js';
import { DISCLOSURE, kindOffered } from './disclosure.js';

export function defaults(registry) {
  return {
    debug: false,
    sharingConsent: 0,
    features: Object.fromEntries(registry.map((d) => [d.id, { ...d.defaults }])),
    shares: Object.fromEntries(shareKinds(registry).map((kind) => [kind, false])),
    featureData: Object.fromEntries(registry.filter((d) => d.data).map((d) => [d.id, d.data.empty])),
    sidebar: {
      enabled: true,
      items: Object.fromEntries(SIDEBAR_ITEMS.map((item) => [item.id, item.on])),
    },
  };
}

/** A feature's own data, checked by its validate function; the empty value when it fails. */
function featureDataOf(d, value) {
  if (value === undefined) return d.data.empty;
  try {
    const clean = d.data.validate(value);
    return clean === undefined ? d.data.empty : clean;
  } catch {
    return d.data.empty;
  }
}

/** Keeps only known fields whose type matches the default's. */
export function normalize(raw, registry) {
  const base = defaults(registry);
  const given = raw && typeof raw === 'object' ? raw : {};

  const out = {
    debug: typeof given.debug === 'boolean' ? given.debug : base.debug,
    sharingConsent: Number.isInteger(given.sharingConsent) && given.sharingConsent > 0
      ? given.sharingConsent
      : base.sharingConsent,
  };

  const givenFeatures = given.features && typeof given.features === 'object' ? given.features : {};
  out.features = {};
  for (const d of registry) {
    const saved = givenFeatures[d.id];
    const values = saved && typeof saved === 'object' ? saved : {};
    const feature = {};
    for (const [key, fallback] of Object.entries(d.defaults)) {
      const value = values[key];
      const option = d.options?.[key];
      const usable = typeof value === typeof fallback
        && (typeof value !== 'number' || (Number.isFinite(value) && inRange(value, option)))
        && (!option?.choices || option.choices.includes(value));
      feature[key] = usable ? value : fallback;
    }
    out.features[d.id] = feature;
  }

  const givenShares = given.shares && typeof given.shares === 'object' ? given.shares : {};
  out.shares = {};
  for (const kind of shareKinds(registry)) {
    out.shares[kind] = givenShares[kind] === true;
  }

  const givenData = given.featureData && typeof given.featureData === 'object' ? given.featureData : {};
  out.featureData = {};
  for (const d of registry.filter((f) => f.data)) out.featureData[d.id] = featureDataOf(d, givenData[d.id]);

  const givenSidebar = given.sidebar && typeof given.sidebar === 'object' ? given.sidebar : {};
  const givenItems = givenSidebar.items && typeof givenSidebar.items === 'object' ? givenSidebar.items : {};
  out.sidebar = {
    enabled: typeof givenSidebar.enabled === 'boolean' ? givenSidebar.enabled : base.sidebar.enabled,
    items: Object.fromEntries(SIDEBAR_ITEMS.map((item) => [
      item.id, typeof givenItems[item.id] === 'boolean' ? givenItems[item.id] : item.on,
    ])),
  };

  return out;
}

export async function load(registry) {
  return normalize(await read(KEYS.settings), registry);
}

export async function save(settings, registry) {
  return write(KEYS.settings, normalize(settings, registry));
}

export function isEnabled(settings, id) {
  return settings?.features?.[id]?.enabled === true;
}

/**
 * A kind is shared only when its switch is on, its wording exists, and the player agreed
 * to the wording as it is now.
 */
export function isShared(settings, kind, disclosure = DISCLOSURE) {
  return settings?.shares?.[kind] === true
    && kindOffered(kind, disclosure)
    && settings.sharingConsent === disclosure.version;
}
