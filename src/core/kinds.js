// The observation kinds this build can share, checked before anything is queued
// (CMP-008, CMP-014; the server side is CAPI-010 in specs/companion-api.md).
//
// The site refuses a whole batch when one entry in it is wrong, and refuses any field it
// did not ask for. So every observation is checked here, field by field, against the
// same shapes and ranges, and one that does not fit is dropped with a warning rather
// than queued to spoil a batch. A kind arrives here with the feature that produces it:
// wave 1 brings foreign stock, foreign shop shelves and loadouts; wave 2 brings bazaars, auctions, your own crime outcomes and your own gym progress
// (D-073: own view only, never published). NPC loot levels are
// not captured by the script (D-062: the site takes them from a loot-timer service).
//
// The country list is the site's closed list, word for word.

export const COUNTRIES = Object.freeze([
  'mexico', 'cayman', 'canada', 'hawaii', 'uk', 'argentina',
  'switzerland', 'japan', 'china', 'uae', 'south-africa',
]);

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

/** A field the site takes as null when the page did not show it. */
const nullable = (value, check) => (value === null ? null : check(value));

function shelfItem(entry, field) {
  object(entry, field, ['item_id', 'quantity', 'price']);
  return {
    item_id: itemId(entry.item_id, `${field}.item_id`),
    quantity: int(entry.quantity, `${field}.quantity`, 0, MAX_QUANTITY),
    price: int(entry.price, `${field}.price`, 0, MAX_PRICE),
  };
}

/** An item a crime gave: its id and how many. */
function crimeItem(entry, field) {
  object(entry, field, ['item_id', 'amount']);
  return {
    item_id: itemId(entry.item_id, `${field}.item_id`),
    amount: int(entry.amount, `${field}.amount`, 1, MAX_QUANTITY),
  };
}

/** One item market listing: its price and quantity, never its seller. */
function marketListing(entry, field) {
  object(entry, field, ['price', 'quantity']);
  return {
    price: int(entry.price, `${field}.price`, 0, MAX_PRICE),
    quantity: int(entry.quantity, `${field}.quantity`, 1, MAX_QUANTITY),
  };
}

/** One bazaar listing; item_uid only when the page gave the item's own id. */
function listing(entry, field) {
  object(entry, field, ['item_id', 'item_uid', 'quantity', 'price']);
  return optional(entry, {
    item_id: itemId(entry.item_id, `${field}.item_id`),
    quantity: int(entry.quantity, `${field}.quantity`, 1, MAX_QUANTITY),
    price: int(entry.price, `${field}.price`, 0, MAX_PRICE),
  }, {
    item_uid: (v) => int(v, `${field}.item_uid`, 1, Number.MAX_SAFE_INTEGER),
  });
}

/** A bonus as the page names it; the site maps the name onto its bonus table (hq #91). */
function bonus(entry, field) {
  object(entry, field, ['name', 'value']);
  if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 40) {
    throw new Invalid(`${field}.name must be text of 1 to 40 characters`);
  }
  return {
    name: entry.name.trim(),
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
  auction_listing: {
    title: 'Auction listings',
    fields: ['listing_id', 'item_id', 'item_uid', 'seller_id', 'current_bid', 'bid_count', 'time_left_s',
      'bonuses', 'quality', 'rarity', 'damage', 'accuracy', 'armor'],
    // As pinned after hq #122: bonuses by name (the page shows no bonus id), quality
    // nullable (it is only in the info panel), like loadouts after #91; time left in
    // seconds, from which the site derives the end.
    check: (d) => ({
      listing_id: int(d.listing_id, 'listing_id', 1, Number.MAX_SAFE_INTEGER),
      item_id: itemId(d.item_id, 'item_id'),
      item_uid: nullable(d.item_uid, (v) => int(v, 'item_uid', 1, Number.MAX_SAFE_INTEGER)),
      seller_id: nullable(d.seller_id, (v) => int(v, 'seller_id', 1, Number.MAX_SAFE_INTEGER)),
      current_bid: int(d.current_bid, 'current_bid', 0, MAX_PRICE),
      bid_count: int(d.bid_count, 'bid_count', 0, MAX_QUANTITY),
      time_left_s: int(d.time_left_s, 'time_left_s', 0, 30 * 86_400),
      bonuses: list(d.bonuses, 'bonuses', 2, bonus),
      quality: nullable(d.quality, (v) => num(v, 'quality', 0, 1_000)),
      rarity: oneOf(d.rarity, 'rarity', ['yellow', 'orange', 'red', 'none']),
      damage: nullable(d.damage, (v) => num(v, 'damage', 0, MAX_STAT)),
      accuracy: nullable(d.accuracy, (v) => num(v, 'accuracy', 0, MAX_STAT)),
      armor: nullable(d.armor, (v) => num(v, 'armor', 0, MAX_STAT)),
    }),
  },
  crime_outcome: {
    title: 'Your crime outcomes',
    fields: ['type_id', 'page_crime_id', 'outcome', 'money_gained', 'items'],
    // As pinned in hq #124: the page's own ids; the site maps them and adds the nerve.
    check: (d) => ({
      type_id: int(d.type_id, 'type_id', 1, 1_000),
      page_crime_id: int(d.page_crime_id, 'page_crime_id', 1, 1_000_000),
      outcome: oneOf(d.outcome, 'outcome', ['success', 'failure', 'critical_failure']),
      money_gained: int(d.money_gained, 'money_gained', 0, MAX_PRICE),
      items: list(d.items, 'items', 20, crimeItem),
    }),
  },
  gym_progress: {
    title: 'Your gym progress',
    fields: ['gym_id', 'percent'],
    check: (d) => ({
      gym_id: int(d.gym_id, 'gym_id', 1, 1_000),
      percent: num(d.percent, 'percent', 0, 100),
    }),
  },
  gym_train: {
    title: 'Your gym trains',
    fields: ['gym_id', 'stat', 'gained', 'trains', 'energy'],
    check: (d) => ({
      gym_id: int(d.gym_id, 'gym_id', 1, 1_000),
      stat: oneOf(d.stat, 'stat', ['strength', 'defense', 'speed', 'dexterity']),
      gained: num(d.gained, 'gained', 0, 1e12),
      trains: nullable(d.trains, (v) => int(v, 'trains', 1, 10_000)),
      energy: nullable(d.energy, (v) => int(v, 'energy', 1, 1_000_000)),
    }),
  },
  item_market_snapshot: {
    title: 'Item market prices',
    fields: ['item_id', 'listings'],
    // Demand-gated (CAPI-013): sent only for items the site asks for. No seller ids.
    check: (d) => ({
      item_id: itemId(d.item_id, 'item_id'),
      listings: list(d.listings, 'listings', 50, marketListing),
    }),
  },
  jail_difficulty: {
    title: 'Jail difficulty bands',
    fields: ['level_band', 'hours_left_band'],
    // hq #219: two closed bands from a jail row, never who it is.
    check: (d) => ({
      level_band: oneOf(d.level_band, 'level_band', ['1-10', '11-25', '26-50', '51-75', '76-100']),
      hours_left_band: oneOf(d.hours_left_band, 'hours_left_band', ['<1', '1-3', '3-6', '6-12', '12-24', '24+']),
    }),
  },
  bazaar_listing: {
    title: 'Bazaar listings',
    fields: ['owner_id', 'items', 'open', 'complete'],
    check: (d) => ({
      owner_id: int(d.owner_id, 'owner_id', 1, Number.MAX_SAFE_INTEGER),
      items: list(d.items, 'items', 200, listing),
      open: bool(d.open, 'open'),
      complete: bool(d.complete, 'complete'),
    }),
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
