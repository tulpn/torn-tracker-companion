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
// defaults its table in the spec gives, and where it sits (hq #507): `position`, Top by
// default. An install from before 0.9.8 has no position saved: it moves to Top, and
// `moved` keeps the settings page's note about it until the player picks a place.
//
// `look` is the settings page's theme (WP-UI-8): dark, light, or Torn's own.
//
// `achievements` holds the two switches of core/unlocks.js: the unlock toast and the
// featured achievements in the settings header (WP-UX-8). Both start on.
//
// `guideStrip` is the switch for the guide's next step on the settings page (GDE-007,
// core/guide.js). It starts on.
//
// `dashboard` is the preview switch for the dashboard page inside Torn (hq #465,
// core/dashboard.js). It starts off until the site answers its read everywhere.

import { KEYS, read, write } from './storage.js';
import { DEFAULT_POSITION, POSITIONS, SIDEBAR_ITEMS } from './sidebar.js';
import { inRange, shareKinds } from './registry.js';
import { DISCLOSURE, kindOffered } from './disclosure.js';
import { DEFAULT_LOOK, LOOKS } from './tokens.js';
import { ACHIEVEMENT_DEFAULTS } from './unlocks.js';

export function defaults(registry) {
  return {
    debug: false,
    look: DEFAULT_LOOK,
    sharingConsent: 0,
    achievements: { ...ACHIEVEMENT_DEFAULTS },
    guideStrip: true,
    dashboard: false,
    features: Object.fromEntries(registry.map((d) => [d.id, { ...d.defaults }])),
    shares: Object.fromEntries(shareKinds(registry).map((kind) => [kind, false])),
    featureData: Object.fromEntries(registry.filter((d) => d.data).map((d) => [d.id, d.data.empty])),
    sidebar: {
      enabled: true,
      position: DEFAULT_POSITION,
      moved: false,
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
    guideStrip: typeof given.guideStrip === 'boolean' ? given.guideStrip : base.guideStrip,
    dashboard: typeof given.dashboard === 'boolean' ? given.dashboard : base.dashboard,
    look: LOOKS.includes(given.look) ? given.look : base.look,
    sharingConsent: Number.isInteger(given.sharingConsent) && given.sharingConsent > 0
      ? given.sharingConsent
      : base.sharingConsent,
  };

  const givenAchievements = given.achievements && typeof given.achievements === 'object' ? given.achievements : {};
  out.achievements = Object.fromEntries(Object.entries(ACHIEVEMENT_DEFAULTS).map(([key, on]) => [
    key, typeof givenAchievements[key] === 'boolean' ? givenAchievements[key] : on,
  ]));

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
        && (typeof value !== 'string' || option?.maxLength === undefined || value.length <= option.maxLength)
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
  const hasPosition = POSITIONS.includes(givenSidebar.position);
  // Saved settings with a sidebar but no position come from before 0.9.8 (hq #507).
  const fromBefore = !hasPosition && Object.keys(givenSidebar).length > 0;
  out.sidebar = {
    enabled: typeof givenSidebar.enabled === 'boolean' ? givenSidebar.enabled : base.sidebar.enabled,
    position: hasPosition ? givenSidebar.position : base.sidebar.position,
    moved: fromBefore || (hasPosition && givenSidebar.moved === true),
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
 * Why a kind is not shared right now, in the words the debug log uses; null when it is.
 * A kind is shared only when its switch is on, its wording exists, and the player agreed
 * to the wording as it is now.
 * @returns {'kind off'|'no wording'|'no consent'|'wording changed'|null}
 */
export function shareRefusal(settings, kind, disclosure = DISCLOSURE) {
  if (settings?.shares?.[kind] !== true) return 'kind off';
  if (!kindOffered(kind, disclosure)) return 'no wording';
  if (settings.sharingConsent !== disclosure.version) return settings.sharingConsent > 0 ? 'wording changed' : 'no consent';
  return null;
}

export function isShared(settings, kind, disclosure = DISCLOSURE) {
  return shareRefusal(settings, kind, disclosure) === null;
}

/**
 * hq #758: a kind is ticked but held because the wording changed since the player agreed.
 * The sidebar and the panel's header say so; only the player's own press agrees (D-072).
 */
export function sharingPaused(settings, disclosure = DISCLOSURE) {
  return Object.keys(settings?.shares || {}).some((kind) => shareRefusal(settings, kind, disclosure) === 'wording changed');
}
