// The chain watch rota: the site calls (CHW-040 to CHW-043, mocked), the controller, the
// Settings section, the sidebar line and the slot-start notice (CHW-011, CHW-026).
import { after, afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createCache } from '../../src/core/cache.js';
import { CHAIN_WATCH_URL, SPACES, createSite, readSidebar } from '../../src/core/site.js';
import {
  BOARD_URL, NOTICE_ID, createRota, mountSlotNotice, replyText, rotaSection, syncRota, watchLine,
} from '../../src/core/rota.js';
import { el } from '../../src/core/dom.js';

const KEY = `tt_feed_${'E'.repeat(43)}`;
const T0 = Date.UTC(2026, 9, 27, 12, 0, 0);
const SLOT = 30 * 60_000;
const iso = (ms) => new Date(ms).toISOString();
const settle = () => new Promise((resolve) => setImmediate(resolve));

let store;
beforeEach(() => {
  store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});
afterEach(() => {
  delete globalThis.localStorage;
  delete globalThis.PDA_httpGet;
});

const windows = [];
after(() => windows.forEach((w) => w.close()));

function rig(reply = () => ({ ok: true, status: 200, data: {} })) {
  const calls = [];
  const site = createSite({
    getKey: () => KEY,
    send: async (url, opts) => {
      calls.push({ url, ...opts });
      return reply(url, opts);
    },
    cache: createCache(SPACES, { now: () => T0 }),
    now: () => T0,
  });
  return { site, calls };
}

const ROWS = [
  { slot_start: iso(T0), role: 'lead', torn_id: 7, name: 'Medic', mine: true },
  { slot_start: iso(T0 + SLOT), role: 'backup_1', torn_id: 8, name: 'Other', mine: false },
  { slot_start: '2026-10-27T12:10:00Z', role: 'lead', torn_id: 9, name: 'Off', mine: false },
  { slot_start: iso(T0), role: 'captain', torn_id: 9, name: 'Odd', mine: false },
];

describe('CHW-040 reading the rota', () => {
  test('one GET to torn-tracker.com, from the slot, for the hours asked; rows that do not fit are dropped', async () => {
    const r = rig(() => ({ ok: true, status: 200, data: { server_time: iso(T0 + 5000), slots: ROWS, gaps: [iso(T0 + SLOT), 'nope'] } }));
    const got = await r.site.chainWatch(T0 + 7 * 60_000, 24);
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].method, 'GET');
    assert.equal(r.calls[0].url, `${CHAIN_WATCH_URL}?from=${encodeURIComponent(iso(T0))}&hours=24`);
    assert.ok(r.calls[0].url.startsWith('https://www.torn-tracker.com/'));
    assert.equal(got.status, 'ok');
    assert.deepEqual(got.slots, [
      { slotStart: T0, role: 'lead', id: 7, name: 'Medic', mine: true },
      { slotStart: T0 + SLOT, role: 'backup_1', id: 8, name: 'Other', mine: false },
    ]);
    assert.deepEqual(got.gaps, [T0 + SLOT]);
    assert.equal(got.skew, 5000);
  });

  test('no faction, a refused key, a wait and silence each come back by name', async () => {
    const cases = [
      [{ ok: false, status: 404, data: { reason: 'no_faction' } }, { status: 'no_faction' }],
      [{ ok: false, status: 429, data: null, retryAfter: '30' }, { status: 'wait', retryMs: 30_000 }],
      [{ ok: false, status: 0, data: null }, { status: 'failed' }],
      [{ ok: true, status: 200, data: { slots: 'x' } }, { status: 'failed' }],
    ];
    for (const [answer, want] of cases) {
      const r = rig(() => answer);
      assert.deepEqual(await r.site.chainWatch(T0), want);
    }
  });
});

describe('CHW-041 signing up, all or nothing', () => {
  test('a POST with start, slots and role; 201 is saved', async () => {
    const r = rig(() => ({ ok: true, status: 201, data: [{ slot_start: iso(T0), role: 'lead', torn_id: 7, name: 'Medic', mine: true }] }));
    const got = await r.site.watchSignUp({ start: T0, slots: 2, role: 'lead' });
    assert.equal(r.calls[0].method, 'POST');
    assert.equal(r.calls[0].url, CHAIN_WATCH_URL);
    assert.deepEqual(JSON.parse(r.calls[0].body), { start: iso(T0), slots: 2, role: 'lead' });
    assert.equal(got.status, 'saved');
    assert.equal(got.slots.length, 1);
  });

  test('409 names the clashes and what is still free', async () => {
    const r = rig(() => ({
      ok: false,
      status: 409,
      data: { clashes: [{ slot_start: iso(T0 + SLOT), role: 'lead', name: 'Other' }], free: { [iso(T0 + SLOT)]: ['backup_2', 'backup_1'] } },
    }));
    const got = await r.site.watchSignUp({ start: T0, slots: 2, role: 'lead' });
    assert.equal(got.status, 'clash');
    assert.deepEqual(got.clashes, [{ slotStart: T0 + SLOT, role: 'lead', name: 'Other' }]);
    assert.deepEqual([...got.free], [[T0 + SLOT, ['backup_1', 'backup_2']]]);
  });

  test('400 passes on a short reason; a bad ask is never sent', async () => {
    const r = rig(() => ({ ok: false, status: 400, data: { detail: 'start is in the past' } }));
    assert.deepEqual(await r.site.watchSignUp({ start: T0, slots: 1, role: 'lead' }), { status: 'invalid', detail: 'start is in the past' });
    assert.equal(r.calls.length, 1);
    for (const ask of [{ start: T0 + 60_000, slots: 1, role: 'lead' }, { start: T0, slots: 25, role: 'lead' }, { start: T0, slots: 1, role: 'boss' }]) {
      assert.equal((await r.site.watchSignUp(ask)).status, 'invalid');
    }
    assert.equal(r.calls.length, 1);
  });
});

describe('CHW-042 dropping', () => {
  test('a DELETE for the stretch', async () => {
    const r = rig(() => ({ ok: true, status: 204, data: null }));
    assert.deepEqual(await r.site.watchDrop({ start: T0, slots: 2 }), { status: 'dropped' });
    assert.equal(r.calls[0].method, 'DELETE');
    assert.equal(r.calls[0].url, `${CHAIN_WATCH_URL}?start=${encodeURIComponent(iso(T0))}&slots=2`);
  });

  test('in Torn PDA it asks nothing and says so', async () => {
    globalThis.PDA_httpGet = () => {};
    const r = rig();
    assert.deepEqual(await r.site.watchDrop({ start: T0, slots: 1 }), { status: 'pda' });
    assert.equal(r.calls.length, 0);
    assert.match(replyText({ status: 'pda' }), /chain board/);
  });
});

describe('CHW-043 the sidebar item', () => {
  test('now, next (on the local clock) and the gap count', () => {
    const data = { server_time: iso(T0), watch: { now: null, next: { slot_start: iso(T0 + SLOT), role: 'backup_1' }, gaps_24h: 3 } };
    assert.deepEqual(readSidebar(data, ['watch'], 2000).items.get('watch'),
      { now: null, next: { role: 'backup_1', slotStart: T0 + SLOT, startsAt: T0 + SLOT - 2000 }, gaps: 3 });
    assert.deepEqual(readSidebar({ watch: { now: { role: 'lead' }, next: null, gaps_24h: 0 } }, ['watch'], 0).items.get('watch'),
      { now: 'lead', next: null, gaps: 0 });
    assert.equal(readSidebar({ watch: { now: { role: 'boss' } } }, ['watch'], 0).items.get('watch'), null);
  });

  test('acceptance test 14: the line reads now, next, or a way to sign up', () => {
    assert.equal(watchLine({ now: 'lead' }), 'Watching now · Lead');
    assert.equal(watchLine({ now: null, next: { role: 'backup_2', slotStart: Date.UTC(2026, 9, 28, 3, 0) } }), 'Next watch 03:00 TCT · Backup 2');
    assert.equal(watchLine({ now: null, next: null, gaps: 0 }), 'Sign up to watch');
  });
});

// ------------------------------------------------------------ the controller and the section

function fakeSite({ slots = [{ slotStart: T0, role: 'lead', id: 7, name: 'Medic', mine: true }, { slotStart: T0 + SLOT, role: 'lead', id: 8, name: 'Other', mine: false }], gaps = [T0 + 2 * SLOT], signUp, drop } = {}) {
  const asked = [];
  return {
    asked,
    async chainWatch(from, hours) {
      asked.push(['read', from, hours]);
      return { status: 'ok', slots, gaps, skew: 0 };
    },
    async watchSignUp(ask) {
      asked.push(['sign-up', ask]);
      return signUp ? signUp(ask) : { status: 'saved', slots: [] };
    },
    async watchDrop(ask) {
      asked.push(['drop', ask]);
      return drop ? drop(ask) : { status: 'dropped' };
    },
  };
}

function section(site) {
  const { window } = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.torn.com/' });
  windows.push(window);
  const doc = window.document;
  const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);
  const rota = createRota({ site, now: () => T0 + 60_000 });
  const container = h('div', null, rotaSection(h, rota));
  doc.body.append(container);
  rota.onChange(() => syncRota(h, container, rota));
  const act = (name) => container.querySelector(`[data-rota-act="${name}"]`);
  return { window, doc, rota, container, act, click: (b) => b.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) };
}

describe('CHW-011 the rota in Settings → Chain watch', () => {
  test('asks nothing until the member asks for it, then one read of 24 hours', async () => {
    const site = fakeSite();
    const t = section(site);
    await settle();
    assert.equal(site.asked.length, 0);
    assert.match(t.container.textContent, /every member of your faction sees them/);
    t.click(t.act('load'));
    await settle();
    assert.deepEqual(site.asked, [['read', T0, 24]]);
    assert.equal(t.container.querySelectorAll('tbody tr').length, 48);
  });

  test('own slots are marked with Drop, others show a name, gaps are flagged', async () => {
    const site = fakeSite();
    const t = section(site);
    await t.rota.load();
    const first = t.container.querySelector(`tr[data-slot="${T0}"]`);
    assert.ok(first.querySelector('.ttc-rota-mine'));
    assert.ok(first.querySelector('[data-rota-act="drop"]'));
    assert.match(first.textContent, /free/, 'the other roles in my slot are not offered to me');
    assert.match(t.container.querySelector(`tr[data-slot="${T0 + SLOT}"]`).textContent, /Other/);
    assert.match(t.container.querySelector(`tr[data-slot="${T0 + 2 * SLOT}"]`).textContent, /no Lead/);
    assert.ok(t.container.querySelector(`a[href="${BOARD_URL}"]`));
  });

  test('sign-up sends the form’s ask and reloads; a clash is shown in place', async () => {
    const site = fakeSite({
      signUp: () => ({ status: 'clash', clashes: [{ slotStart: T0 + SLOT, role: 'lead', name: 'Other' }], free: new Map([[T0 + SLOT, ['backup_2']]]) }),
    });
    const t = section(site);
    await t.rota.load();
    t.container.querySelector('[data-rota="start"]').value = String(T0);
    t.container.querySelector('[data-rota="length"]').value = '2';
    t.container.querySelector('[data-rota="role"]').value = 'lead';
    t.click(t.act('sign-up'));
    await settle();
    await settle();
    assert.deepEqual(site.asked[1], ['sign-up', { start: T0, slots: 2, role: 'lead' }]);
    assert.equal(site.asked[2][0], 'read', 'reloaded after the clash');
    assert.equal(t.container.querySelector('[data-rota="reply"]').textContent,
      'Nothing was saved. Already taken: Lead at 12:30 (Other). Still free: 12:30: Backup 2.');
  });

  test('Take and Drop each send one slot', async () => {
    const site = fakeSite();
    const t = section(site);
    await t.rota.load();
    t.click(t.container.querySelector(`tr[data-slot="${T0 + SLOT}"] [data-rota-act="take"]`));
    await settle();
    await settle();
    assert.deepEqual(site.asked[1], ['sign-up', { start: T0 + SLOT, slots: 1, role: 'backup_1' }]);
    t.click(t.container.querySelector('[data-rota-act="drop"]'));
    await settle();
    await settle();
    assert.ok(site.asked.some(([kind, ask]) => kind === 'drop' && ask.start === T0 && ask.slots === 1));
  });

  test('no faction is said in words, with a way to try again', async () => {
    const t = section({ async chainWatch() { return { status: 'no_faction' }; } });
    await t.rota.load();
    assert.match(t.container.textContent, /not in a faction/);
    assert.ok(t.act('load'));
  });
});

// ------------------------------------------------------------ the slot-start notice

function fakeWatch(on = false) {
  const listeners = new Set();
  const w = {
    on,
    isOn: () => w.on,
    setOn(v) {
      w.on = v;
      listeners.forEach((fn) => fn());
    },
    toggle: () => w.setOn(!w.on),
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return w;
}

function noticeRig({ on = false } = {}) {
  const { window } = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.torn.com/' });
  windows.push(window);
  let clock = T0 - 10_000;
  const pending = new Map();
  let id = 1;
  const timers = {
    setTimeout(fn, ms) {
      pending.set(id, { fn, ms });
      return id++;
    },
    clearTimeout: (n) => pending.delete(n),
  };
  const watch = fakeWatch(on);
  const notice = mountSlotNotice({ doc: window.document, watch, timers, now: () => clock });
  return {
    window, watch, notice, pending,
    fire(ms) {
      clock += ms;
      const due = [...pending.values()];
      pending.clear();
      due.forEach((t) => t.fn());
    },
    shown: () => window.document.getElementById(NOTICE_ID),
  };
}

describe('CHW-026 the slot-start notice', () => {
  test('when a slot starts with watch mode off: a notice, never watch mode by itself', () => {
    const t = noticeRig();
    t.notice.fromSidebar({ now: null, next: { role: 'lead', slotStart: T0, startsAt: T0 }, gaps: 0 });
    assert.equal([...t.pending.values()][0].ms, 10_000);
    t.fire(10_000);
    assert.match(t.shown().textContent, /Your chain watch \(Lead\) starts now/);
    assert.equal(t.watch.isOn(), false);
    t.shown().querySelector('.ttc-watch-notice-on').dispatchEvent(new t.window.MouseEvent('click'));
    assert.equal(t.watch.isOn(), true);
    assert.equal(t.shown(), null);
  });

  test('with watch mode on there is nothing to say; a slot is announced once', () => {
    const t = noticeRig({ on: true });
    t.notice.plan({ role: 'lead', startsAt: T0 });
    t.fire(10_000);
    assert.equal(t.shown(), null);
    t.notice.plan({ role: 'lead', startsAt: T0 });
    assert.equal(t.pending.size, 0);
  });

  test('✕ dismisses it, and turning watch mode on elsewhere hides it', () => {
    const t = noticeRig();
    t.notice.plan({ role: 'backup_1', startsAt: T0 });
    t.fire(10_000);
    t.shown().querySelector('.ttc-watch-notice-close').dispatchEvent(new t.window.MouseEvent('click'));
    assert.equal(t.shown(), null);
    t.notice.plan({ role: 'backup_1', startsAt: T0 + SLOT });
    t.fire(SLOT);
    assert.ok(t.shown());
    t.watch.setOn(true);
    assert.equal(t.shown(), null);
    t.notice.destroy();
  });
});
