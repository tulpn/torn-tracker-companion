// Reads the defender's loadout from the attack page's own `attackData` response
// (CMP-103, D-041). Pure: in, the response; out, a loadout or null. A slot, a number or
// a bonus that cannot be read is left out, never guessed.

import { SLOTS, WEAPON_SLOTS } from './selectors.js';

/** A number, or a string that is exactly one; anything else is null. */
function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}

const positiveInt = (value) => {
  const n = number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

function bonusesOf(item) {
  if (!Array.isArray(item.currentBonuses)) return [];
  const out = [];
  for (const b of item.currentBonuses) {
    const name = typeof b?.name === 'string' ? b.name : b?.title;
    const value = number(b?.value);
    if (typeof name === 'string' && name.trim() && name.length <= 40 && value !== null) {
      out.push({ name: name.trim(), value });
    }
    if (out.length === 2) break;
  }
  return out;
}

/**
 * @param {unknown} data  the JSON of `page.php?sid=attackData`
 * @returns {{player_id: number, slots: object} | null}  null until the page shows items
 */
export function fromAttackData(data) {
  const db = data?.DB;
  const player_id = positiveInt(db?.defenderUser?.userID);
  const items = db?.defenderItems;
  if (!player_id || !items || typeof items !== 'object') return null;

  const slots = {};
  for (const [number_, name] of Object.entries(SLOTS)) {
    const slot = items[number_];
    const item = Array.isArray(slot?.item) ? slot.item[0] : slot?.item;
    const item_id = positiveInt(item?.ID);
    if (!item_id) continue;

    const read = { item_id, bonuses: bonusesOf(item) };
    if (WEAPON_SLOTS.includes(name)) {
      const damage = number(item.dmg);
      const accuracy = number(item.acc);
      if (damage !== null && damage >= 0) read.damage = damage;
      if (accuracy !== null && accuracy >= 0) read.accuracy = accuracy;
    }
    slots[name] = read;
  }
  return Object.keys(slots).length ? { player_id, slots } : null;
}

/** The defender the player opened the page for, from `user2ID`, or null. */
export function defenderInUrl(loc) {
  return positiveInt(new URLSearchParams(String(loc?.search || '')).get('user2ID'));
}
