// The observation kinds this build can share, checked before anything is queued
// (CMP-008, CMP-014; the server side is CAPI-010 in specs/companion-api.md).
//
// The site refuses a whole batch when one entry in it is wrong, and refuses any field it
// did not ask for. So every observation is checked here, field by field, against the
// same shapes and ranges, and one that does not fit is dropped with a warning rather
// than queued to spoil a batch. A kind arrives here with the feature that produces it:
// wave 1 brings foreign stock, foreign shop shelves, NPC loot levels and loadouts.
//
// The country and NPC lists are the site's closed lists, word for word.

export const COUNTRIES = Object.freeze([
  'mexico', 'cayman', 'canada', 'hawaii', 'uk', 'argentina',
  'switzerland', 'japan', 'china', 'uae', 'south-africa',
]);

/** The NPCs Torn runs loot timers for. */
export const LOOTABLE_NPCS = Object.freeze([4, 10, 15, 17, 19, 20]);

export const LOADOUT_SLOTS = Object.freeze([
  'primary', 'secondary', 'melee', 'temporary', 'helmet', 'body', 'gloves', 'pants', 'boots',
]);

const MAX_ITEM_ID = 10_000_000;
const MAX_PRICE = 1_000_000_000_000;
const MAX_QUANTITY = 1_000_000;
const MAX_STAT = 10_000;

// ---------------------------------------------------------------- field checks
// Each returns the clean value, or throws a short reason that names the field.

class Invalid extends Error {}

function int(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Invalid(`${field} must be a whole number from ${min} to ${max}`);
  }
  return value;
}

function num(value, field, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Invalid(`${field} must be a number from ${min} to ${max}`);
  }
  return value;
}

function oneOf(value, field, allowed) {
  if (!allowed.includes(value)) throw new Invalid(`${field} is not one of the known values`);
  return value;
}

function bool(value, field) {
  if (typeof value !== 'boolean') throw new Invalid(`${field} must be true or false`);
  return value;
}

function list(value, field, max, each) {
  if (!Array.isArray(value) || value.length > max) {
    throw new Invalid(`${field} must be a list of at most ${max}`);
  }
  return value.map((entry, i) => each(entry, `${field}[${i}]`));
}

function object(value, field, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Invalid(`${field} must be an object`);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Invalid(`${field}.${key} is not a field the site accepts`);
  }
  return value;
}

/** Copies the optional fields that are present and not null, each through its check. */
function optional(source, target, checks) {
  for (const [key, check] of Object.entries(checks)) {
    if (source[key] != null) target[key] = check(source[key], key);
  }
  return target;
}

const itemId = (value, field) => int(value, field, 1, MAX_ITEM_ID);

function shelfItem(entry, field) {
  object(entry, field, ['item_id', 'quantity', 'price']);
  return {
    item_id: itemId(entry.item_id, `${field}.item_id`),
    quantity: int(entry.quantity, `${field}.quantity`, 0, MAX_QUANTITY),
    price: int(entry.price, `${field}.price`, 0, MAX_PRICE),
  };
}

function bonus(entry, field) {
  object(entry, field, ['bonus_id', 'value']);
  return {
    bonus_id: int(entry.bonus_id, `${field}.bonus_id`, 1, 10_000),
    value: num(entry.value, `${field}.value`, -MAX_STAT, MAX_STAT),
  };
}

function slot(entry, field) {
  object(entry, field, ['item_id', 'item_uid', 'damage', 'accuracy', 'armor', 'bonuses']);
  return optional(entry, {
    item_id: itemId(entry.item_id, `${field}.item_id`),
    bonuses: list(entry.bonuses ?? [], `${field}.bonuses`, 2, bonus),
  }, {
    item_uid: (v) => int(v, `${field}.item_uid`, 1, Number.MAX_SAFE_INTEGER),
    damage: (v) => num(v, `${field}.damage`, 0, MAX_STAT),
    accuracy: (v) => num(v, `${field}.accuracy`, 0, MAX_STAT),
    armor: (v) => num(v, `${field}.armor`, 0, MAX_STAT),
  });
}

function isoTime(value, field) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Invalid(`${field} must be a date and time`);
  }
  return new Date(value).toISOString();
}

// ---------------------------------------------------------------- the kinds

/**
 * kind -> { title (the panel's name for it), fields (what the site accepts), check }.
 * `check` takes the kind's own fields and returns a clean copy of them.
 */
export const KINDS = Object.freeze({
  foreign_stock: {
    title: 'Foreign stock',
    fields: ['country', 'item_id', 'quantity', 'price'],
    check: (d) => ({
      country: oneOf(d.country, 'country', COUNTRIES),
      ...shelfItem({ item_id: d.item_id, quantity: d.quantity, price: d.price }, 'item'),
    }),
  },
  foreign_shop: {
    title: 'Foreign shop shelves',
    fields: ['country', 'items', 'complete'],
    check: (d) => ({
      country: oneOf(d.country, 'country', COUNTRIES),
      items: list(d.items, 'items', 100, shelfItem),
      complete: bool(d.complete, 'complete'),
    }),
  },
  npc_loot: {
    title: 'NPC loot levels',
    fields: ['npc_id', 'loot_level', 'level_since'],
    check: (d) => optional(d, {
      npc_id: oneOf(d.npc_id, 'npc_id', LOOTABLE_NPCS),
      loot_level: int(d.loot_level, 'loot_level', 1, 5),
    }, { level_since: isoTime }),
  },
  loadout: {
    title: 'Loadouts',
    fields: ['player_id', 'slots', 'context'],
    check: (d) => {
      object(d.slots, 'slots', LOADOUT_SLOTS);
      const slots = {};
      for (const name of LOADOUT_SLOTS) {
        if (d.slots[name] != null) slots[name] = slot(d.slots[name], `slots.${name}`);
      }
      if (Object.keys(slots).length === 0) throw new Invalid('slots must hold at least one item');
      return {
        player_id: int(d.player_id, 'player_id', 1, Number.MAX_SAFE_INTEGER),
        slots,
        context: oneOf(d.context, 'context', ['attack', 'war']),
      };
    },
  },
});

export function isKnownKind(kind) {
  return Object.hasOwn(KINDS, kind);
}

export function kindTitle(kind) {
  return isKnownKind(kind) ? KINDS[kind].title : kind;
}

const ENVELOPE = ['kind', 'observed_at', 'script_version'];

/**
 * Checks one observation exactly as the site will.
 * @param {object} observation  flat: kind, observed_at, script_version and the kind's fields
 * @returns {{value: object} | {error: string}}
 */
export function checkObservation(observation) {
  try {
    if (!observation || typeof observation !== 'object') throw new Invalid('not an object');
    const { kind } = observation;
    if (!isKnownKind(kind)) throw new Invalid(`"${kind}" is not a kind this build can share`);
    const spec = KINDS[kind];
    object(observation, 'observation', [...ENVELOPE, ...spec.fields]);

    const version = observation.script_version;
    if (typeof version !== 'string' || version.length > 20) {
      throw new Invalid('script_version must be text of at most 20 characters');
    }
    return {
      value: {
        kind,
        observed_at: isoTime(observation.observed_at, 'observed_at'),
        script_version: version,
        ...spec.check(observation),
      },
    };
  } catch (err) {
    if (err instanceof Invalid) return { error: err.message };
    throw err;
  }
}
