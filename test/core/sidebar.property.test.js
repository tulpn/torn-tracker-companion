// Property tests for what the sidebar read hands back (hq #846, from #471). The readers
// are already tested never to throw; these check what comes out of them. Whatever the
// site sends, an item is null or holds only finite numbers, non-empty strings and
// booleans, its counts stay within their totals, and its states are ones we know.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { SIDEBAR_KEYS, WATCH_ROLES, readSidebar } from '../../src/core/site.js';

const RUNS = { numRuns: 1000 };

/** Values a reply's fields could hold: the right shape often, junk and edge cases too. */
const iso = fc.oneof(
  fc.integer({ min: 0, max: 4e12 }).map((ms) => new Date(ms).toISOString()),
  fc.integer({ min: 0, max: 2e6 }).map((half) => new Date(half * 1_800_000).toISOString()),
  fc.constantFrom('', 'soon', '2026-13-40T00:00:00Z', 'Infinity', '1e300'),
);
const num = fc.oneof(
  { weight: 6, arbitrary: fc.integer({ min: -5, max: 200 }) },
  fc.integer({ min: -1e10, max: 1e10 }),
  fc.double(),
  fc.constantFrom(0, 1, 100, 1e5, 1e7, 1e9, NaN, Infinity, -Infinity, -0),
);
const text = fc.oneof(
  fc.string({ maxLength: 70 }),
  fc.constantFrom('', ' ', 'Example', 'mexico', 'south-africa', 'Lead', 'running', '\u0000'),
);
const anyField = fc.oneof(num, text, iso, fc.boolean(), fc.constant(null), fc.anything({ maxDepth: 2 }));
const field = (...shaped) => fc.oneof({ weight: 12, arbitrary: fc.oneof(...shaped) }, { weight: 1, arbitrary: anyField });
const rec = (shape) => fc.oneof({ weight: 6, arbitrary: fc.record(shape, { requiredKeys: [] }) }, { weight: 1, arbitrary: anyField });
const list = (shape) => fc.oneof({ weight: 6, arbitrary: fc.array(rec(shape), { maxLength: 14 }) }, { weight: 1, arbitrary: anyField });

const role = field(fc.constantFrom(...WATCH_ROLES), text);
const run = {
  country: field(fc.constantFrom('mexico', 'uk', 'south-africa'), text),
  stops: field(fc.array(fc.constantFrom('mexico', 'uk'), { maxLength: 4 }), fc.array(text, { maxLength: 3 })),
  lands_at: field(iso), hours: field(fc.double({ min: 0, max: 120, noNaN: true }), num), item_id: field(num), item_name: field(text), quantity: field(num),
  cash_needed: field(num), profit: field(num), profit_per_hour: field(num), accuracy: field(text), data_age_s: field(num),
};

const reply = fc.record({
  chain: rec({ current: field(num), max: field(num), timeout_at: field(iso, fc.constant(null)), as_of: field(iso, fc.constant(null)) }),
  watch: rec({
    now: field(rec({ role }), fc.constant(null)),
    next: field(rec({ role, slot_start: field(iso) }), fc.constant(null)),
    gaps_24h: field(num), open: field(fc.boolean()),
  }),
  war: rec({
    opponent_name: field(text), our_score: field(num), their_score: field(num), target: field(num),
    finish_eta: field(iso, fc.constant(null)), id: field(num), state: field(fc.constantFrom('matched', 'running', 'ended'), text),
    starts_at: field(iso, fc.constant(null)),
  }),
  terms: rec({ label: field(text) }),
  partner: rec({ torn_id: field(num), name: field(text) }),
  dibs: list({ target_id: field(num), target_name: field(text), expires_at: field(iso) }),
  oc: rec({
    crime_id: field(num), name: field(text), state: field(fc.constantFrom('recruiting', 'planning', 'ready', 'running', 'done'), text),
    ready_at: field(iso, fc.constant(null)), needs_me: field(fc.boolean()), expired_at: field(iso, fc.constant(null)),
  }),
  guide: rec({ done: field(num), total: field(num), bonuses_unclaimed: field(num) }),
  travel: rec(run),
  loot: list({ npc_id: field(num), name: field(text), level: field(num), next_level_at: field(iso, fc.constant(null)) }),
  source: field(fc.constantFrom('yata', 'loot rangers', 'x'), text),
  gym: rec({ next_gym: field(text, fc.constant(null)), percent: field(num, fc.constant(null)), energy_to_next: field(num) }),
  stocks: rec({ watched: field(num), crossed: field(num) }),
  routine: rec({
    key_needed: field(fc.boolean()), casino_off: field(fc.boolean()), day_ends_at: field(iso, fc.constant(null)),
    lines: list({
      key: field(fc.constantFrom('bank', 'xanax', 'casino_spin'), text), text: field(text), done: field(fc.boolean()),
      url: field(fc.constantFrom('/bank.php', 'https://www.torn.com/loader.php?sid=casino', '//evil.example/'), text),
      as_of: field(iso, fc.constant(null)), casino: field(fc.boolean()),
    }),
  }),
}, { requiredKeys: [] });

const skew = fc.oneof(fc.constant(0), fc.integer({ min: -86_400_000, max: 86_400_000 }));

/** Every leaf is null, a boolean, a finite number or a non-empty string. */
function leavesOk(value, path) {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path}: ${value}`);
    return;
  }
  if (typeof value === 'string') {
    assert.ok(value.trim().length > 0, `${path}: empty text`);
    return;
  }
  assert.ok(typeof value === 'object', `${path}: ${typeof value}`);
  for (const [k, v] of Object.entries(value)) leavesOk(v, `${path}.${k}`);
}

const count = (v, max = Infinity) => Number.isSafeInteger(v) && v >= 0 && v <= max;

describe('hq #846 the sidebar items hold only what they say', () => {
  test('every item is null or plain values: finite numbers, real text, booleans', () => {
    fc.assert(fc.property(reply, skew, (data, s) => {
      const { items } = readSidebar(data, SIDEBAR_KEYS, s);
      assert.deepEqual([...items.keys()], SIDEBAR_KEYS);
      for (const [key, value] of items) leavesOk(value, key);
    }), RUNS);
  });

  test("each item's numbers stay in range and its states are known", () => {
    fc.assert(fc.property(reply, skew, (data, s) => {
      const items = readSidebar(data, SIDEBAR_KEYS, s).items;
      const chain = items.get('chain');
      if (chain) assert.ok(count(chain.current, 1e5) && count(chain.max, 1e5));
      const watch = items.get('watch');
      if (watch) {
        assert.ok(watch.now === null || WATCH_ROLES.includes(watch.now));
        assert.ok(count(watch.gaps, 48));
        if (watch.next) assert.equal(watch.next.slotStart % 1_800_000, 0);
      }
      const war = items.get('war');
      if (war) {
        for (const k of ['ours', 'theirs', 'target']) assert.ok(count(war[k], 1e7), k);
        assert.ok(war.state === null || ['matched', 'running'].includes(war.state));
        assert.ok(war.id === null || count(war.id) && war.id > 0);
      }
      const oc = items.get('oc');
      if (oc) assert.ok(['recruiting', 'planning', 'ready', 'running', 'done'].includes(oc.state));
      const guide = items.get('guide');
      if (guide) assert.ok(guide.total > 0 && count(guide.done, guide.total) && count(guide.bonuses, 100));
      const stocks = items.get('stocks');
      if (stocks) assert.ok(stocks.watched > 0 && count(stocks.crossed, stocks.watched));
      const gym = items.get('gym');
      if (gym && gym.percent !== null) assert.ok(gym.percent >= 0 && gym.percent <= 100);
      for (const key of ['dibs']) {
        const rows = items.get(key);
        if (rows) assert.ok(rows.length >= 1 && rows.length <= 10 && rows.every((r) => count(r.id) && r.id > 0));
      }
      const loot = items.get('loot');
      if (loot) assert.ok(loot.npcs.length >= 1 && loot.npcs.length <= 10 && loot.npcs.every((n) => count(n.level, 10)));
      const travel = items.get('travel');
      if (travel) assert.ok(count(travel.item_id) && travel.item_id > 0 && count(travel.quantity) && travel.quantity > 0);
      const routine = items.get('routine');
      if (routine) {
        assert.equal(routine.undone, routine.lines.filter((l) => !l.done).length);
        assert.ok(routine.lines.length <= 40);
        assert.ok(routine.lines.every((l) => l.href.startsWith('/') && !l.href.startsWith('//')));
        if (data.routine?.casino_off === true) assert.ok(routine.lines.every((l) => !l.casino));
      }
    }), RUNS);
  });

  test('a time read with a skew is the same time read without one, moved by the skew', () => {
    fc.assert(fc.property(reply, skew, (data, s) => {
      const plain = readSidebar(data, SIDEBAR_KEYS, 0).items;
      const moved = readSidebar(data, SIDEBAR_KEYS, s).items;
      const pairs = [
        ['chain', 'timeoutAt'], ['chain', 'asOf'], ['war', 'finishAt'], ['war', 'startsAt'],
        ['oc', 'readyAt'], ['oc', 'expiredAt'], ['travel', 'lands_at'], ['routine', 'endsAt'],
      ];
      for (const [key, at] of pairs) {
        const a = plain.get(key)?.[at];
        const b = moved.get(key)?.[at];
        if (a == null) assert.ok(b == null, `${key}.${at}`);
        else assert.equal(b, a - s, `${key}.${at}`);
      }
    }), RUNS);
  });
});
