import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BATCH_MAX, ENDPOINT, FLUSH_GAP_MS, MAX_AGE_MS, MAX_QUEUE, RETRY_MS,
  createUploader, normalizeState, retryAfterMs,
} from '../../src/core/upload.js';
import { loadoutData, observation } from '../fixtures.js';

const KEY = `tt_feed_${'B'.repeat(43)}`;
const T0 = Date.UTC(2026, 9, 19, 12);

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
});

const settle = () => new Promise((resolve) => setImmediate(resolve));

/** An uploader on a fake clock, fake timers and a fake site. */
function rig({ key = KEY, replies = [] } = {}) {
  let clock = T0;
  const timers = [];
  const sent = [];
  const queue = [...replies];
  const changes = [];
  const uploader = createUploader({
    getKey: () => key,
    now: () => clock,
    timers: {
      setTimeout(fn, ms) {
        timers.push({ fn, at: clock + ms });
        return timers.length;
      },
      clearTimeout(id) {
        if (timers[id - 1]) timers[id - 1].fn = null;
      },
    },
    send: async (url, opts) => {
      sent.push({ url, ...opts, observations: JSON.parse(opts.body).observations });
      return queue.shift() ?? { ok: true, status: 200, data: { accepted: 1, duplicates: 0, rejected: 0 } };
    },
    onChange: (status) => changes.push(status),
  });
  return {
    uploader,
    sent,
    changes,
    timers,
    get now() { return clock; },
    advance(ms) { clock += ms; },
    /** Runs every timer that is due, as the browser would. */
    async runDue() {
      for (const t of timers) {
        if (t.fn && t.at <= clock) {
          const { fn } = t;
          t.fn = null;
          fn();
        }
      }
      await settle();
    },
    setKey(next) { key = next; },
  };
}

const at = (r, over) => observation(over, r.now);

describe('CMP-014 observations are sent in batches, at most once every 15 s', () => {
  test('the first observation of a page view goes straight away, to our host only', async () => {
    const r = rig();
    r.uploader.add(at(r));
    await r.runDue();
    assert.equal(r.sent.length, 1);
    assert.equal(r.sent[0].url, ENDPOINT);
    assert.match(ENDPOINT, /^https:\/\/www\.torn-tracker\.com\//);
    assert.equal(r.sent[0].method, 'POST');
    assert.equal(r.sent[0].headers.Authorization, `Bearer ${KEY}`);
    assert.equal(r.uploader.status().queued, 0);
  });

  test('what comes in the next 15 s waits, then goes as one batch', async () => {
    const r = rig();
    r.uploader.add(at(r));
    await r.runDue();
    for (let i = 0; i < 3; i += 1) r.uploader.add(at(r, { item_id: 300 + i }));
    await r.runDue();
    assert.equal(r.sent.length, 1, 'nothing sent inside the gap');
    r.advance(FLUSH_GAP_MS);
    await r.runDue();
    assert.equal(r.sent.length, 2);
    assert.equal(r.sent[1].observations.length, 3);
  });

  test('a batch holds at most 50, all of one kind', async () => {
    const r = rig();
    for (let i = 0; i < 60; i += 1) r.uploader.add(at(r, { item_id: 1 + i }));
    r.uploader.add({ kind: 'loadout', observed_at: new Date(r.now).toISOString(), script_version: '1.0.0', ...loadoutData() });
    await r.runDue();
    assert.equal(r.sent[0].observations.length, BATCH_MAX);
    assert.ok(r.sent[0].observations.every((o) => o.kind === 'foreign_stock'));
    r.advance(FLUSH_GAP_MS);
    await r.runDue();
    assert.equal(r.sent[1].observations.length, 10);
    r.advance(FLUSH_GAP_MS);
    await r.runDue();
    assert.deepEqual(r.sent[2].observations.map((o) => o.kind), ['loadout']);
  });

  test('without a script key nothing is sent and nothing is lost', async () => {
    const r = rig({ key: '' });
    r.uploader.add(at(r));
    await r.runDue();
    assert.equal(r.sent.length, 0);
    assert.equal(r.uploader.status().queued, 1);
    assert.equal(r.uploader.status().hasKey, false);
  });

  test('an observation that does not fit its kind is dropped, never queued to spoil a batch', () => {
    const r = rig();
    assert.equal(r.uploader.add(at(r, { country: 'atlantis' })), false);
    assert.equal(r.uploader.status().queued, 0);
  });

  test('the server clock in the reply corrects the device clock', async () => {
    const r = rig({ replies: [{ ok: true, status: 200, data: { accepted: 1, server_time: new Date(T0 + 5000).toISOString() } }] });
    r.uploader.add(at(r));
    await r.runDue();
    assert.equal(r.uploader.serverNow(), r.now + 5000);
  });

  test('a server clock a day out is not believed', async () => {
    const r = rig({ replies: [{ ok: true, status: 200, data: { server_time: (T0 + 2 * 86_400_000) / 1000 } }] });
    r.uploader.add(at(r));
    await r.runDue();
    assert.equal(r.uploader.serverNow(), r.now);
  });
});

describe('CMP-014 the queue stays small and fresh', () => {
  test('at most 200 are kept, the oldest dropped first', () => {
    const r = rig({ key: '' });
    for (let i = 0; i < MAX_QUEUE + 5; i += 1) r.uploader.add(at(r, { item_id: 1 + i }));
    assert.equal(r.uploader.status().queued, MAX_QUEUE);
  });

  test('anything older than 10 minutes is dropped before a flush', async () => {
    const r = rig({ key: '' });
    r.uploader.add(at(r));
    r.advance(MAX_AGE_MS + 1);
    r.setKey(KEY);
    await r.uploader.flush();
    assert.equal(r.sent.length, 0);
    assert.equal(r.uploader.status().queued, 0);
  });

  test('the queue survives a page change in ttc_queue', async () => {
    const r = rig({ key: '' });
    r.uploader.add(at(r));
    await settle();
    const saved = JSON.parse(store.get('ttc_queue'));
    assert.equal(saved.items.length, 1);

    const next = rig({ key: '' });
    assert.equal((await next.uploader.load()).queued, 1);
  });

  test('a stored queue is checked field by field', () => {
    const state = normalizeState({
      items: [observation({}, T0), { kind: 'foreign_stock', evil: true }, 'junk'],
      retryAt: 'soon',
      authFailed: 'yes',
      blocked: { loadout: '1.2.0', battle: '1.0.0', foreign_stock: 'latest' },
      offsetMs: 1e12,
    });
    assert.equal(state.items.length, 1);
    assert.equal(state.retryAt, 0);
    assert.equal(state.authFailed, false);
    assert.deepEqual(state.blocked, { loadout: '1.2.0' });
    assert.equal(state.offsetMs, 0);
  });
});

describe('CMP-014 the site\'s answers are respected', () => {
  test('429 waits out Retry-After, then carries on', async () => {
    const r = rig({ replies: [{ ok: false, status: 429, retryAfter: '120', data: null }] });
    r.uploader.add(at(r));
    await r.runDue();
    assert.equal(r.uploader.status().retryAt, T0 + 120_000);
    assert.equal(r.uploader.status().queued, 1);

    r.advance(60_000);
    await r.runDue();
    assert.equal(r.sent.length, 1, 'nothing before the time is up');
    r.advance(60_000);
    await r.runDue();
    assert.equal(r.sent.length, 2);
    assert.equal(r.uploader.status().queued, 0);
  });

  test('429 without Retry-After waits a minute', async () => {
    const r = rig({ replies: [{ ok: false, status: 429, retryAfter: null, data: null }] });
    r.uploader.add(at(r));
    await r.runDue();
    assert.equal(r.uploader.status().retryAt, T0 + RETRY_MS);
  });

  test('401 pauses sharing, keeps the batch, and a new key resumes it', async () => {
    const r = rig({ replies: [{ ok: false, status: 401, data: null }] });
    r.uploader.add(at(r));
    await r.runDue();
    assert.equal(r.uploader.status().authFailed, true);
    assert.equal(r.uploader.status().queued, 1);

    r.advance(FLUSH_GAP_MS);
    r.uploader.add(at(r));
    await r.runDue();
    assert.equal(r.sent.length, 1, 'a refused key is not tried again on its own');

    r.uploader.keyChanged();
    await r.runDue();
    assert.equal(r.sent.length, 2);
    assert.equal(r.uploader.status().authFailed, false);
  });

  test('ADM-068 a banned account pauses sharing and says so; a new key clears it', async () => {
    const r = rig({ replies: [{ ok: false, status: 403, data: { error: 'account_banned' } }] });
    r.uploader.add(at(r));
    await r.runDue();
    assert.equal(r.uploader.status().authFailed, true);
    assert.equal(r.uploader.status().banned, true);
    r.uploader.keyChanged();
    assert.equal(r.uploader.status().banned, false);
  });

  test('ADM-068 a ban seen by a read stops sharing too', () => {
    const r = rig();
    r.uploader.banned();
    assert.equal(r.uploader.status().authFailed, true);
    assert.equal(r.uploader.status().banned, true);
  });

  test('a stored ban counts only with the key refusal it came with', () => {
    assert.equal(normalizeState({ authFailed: true, banned: true }).banned, true);
    assert.equal(normalizeState({ authFailed: false, banned: true }).banned, false);
    assert.equal(normalizeState({ authFailed: true, banned: 'yes' }).banned, false);
  });

  test('CMP-023 426 stops that kind until the script is updated, others carry on', async () => {
    const r = rig({ replies: [{ ok: false, status: 426, data: { min_version: '1.4.0' } }] });
    r.uploader.add(at(r));
    r.uploader.add({ kind: 'loadout', observed_at: new Date(r.now).toISOString(), script_version: '1.0.0', ...loadoutData() });
    await r.runDue();
    assert.deepEqual(r.uploader.status().blocked, { foreign_stock: '1.4.0' });
    assert.equal(r.uploader.add(at(r)), false, 'a blocked kind is not queued');

    r.advance(FLUSH_GAP_MS);
    await r.runDue();
    assert.deepEqual(r.sent[1].observations.map((o) => o.kind), ['loadout']);
  });

  test('a batch the site calls malformed is dropped, not retried forever', async () => {
    const r = rig({ replies: [{ ok: false, status: 422, data: null }] });
    r.uploader.add(at(r));
    await r.runDue();
    assert.equal(r.uploader.status().queued, 0);
    assert.equal(r.uploader.status().last.outcome, 'refused');
  });

  test('CMP-023 an unreachable site keeps everything and tries again later', async () => {
    const r = rig({ replies: [{ ok: false, status: 0, error: 'TypeError', data: null }] });
    r.uploader.add(at(r));
    await r.runDue();
    assert.equal(r.uploader.status().queued, 1);
    assert.equal(r.uploader.status().retryAt, T0 + RETRY_MS);

    r.advance(RETRY_MS);
    await r.runDue();
    assert.equal(r.sent.length, 2, 'it tries again by itself once the wait is over');
    assert.equal(r.uploader.status().queued, 0);
  });

  test('Retry-After as seconds or a date', () => {
    assert.equal(retryAfterMs('30', T0), 30_000);
    assert.equal(retryAfterMs(new Date(T0 + 90_000).toUTCString(), T0), 90_000);
    assert.equal(retryAfterMs('soon', T0), null);
    assert.equal(retryAfterMs(null, T0), null);
  });
});

describe('CMP-014 leaving the page sends what is waiting', () => {
  test('pagehide flushes at once with keepalive, inside the 15 s gap', async () => {
    const r = rig();
    r.uploader.add(at(r));
    await r.runDue();
    r.uploader.add(at(r, { item_id: 999 }));
    await r.uploader.flush({ keepalive: true });
    assert.equal(r.sent.length, 2);
    assert.equal(r.sent[1].keepalive, true);
  });

  test('a keepalive batch is cut to fit the browser\'s 64 KiB limit', async () => {
    const r = rig({ key: '' });
    const items = Array.from({ length: 100 }, (_, i) => ({ item_id: 1 + i, quantity: 1, price: 1 }));
    for (let i = 0; i < 20; i += 1) {
      r.uploader.add({ kind: 'foreign_shop', observed_at: new Date(r.now).toISOString(), script_version: '1.0.0', country: 'uk', items, complete: true });
    }
    r.setKey(KEY);
    await r.uploader.flush({ keepalive: true });
    assert.ok(r.sent[0].body.length < 64 * 1024);
    assert.ok(r.sent[0].observations.length < 20);
  });
});

describe('CMP-008 "Forget me" leaves nothing behind', () => {
  test('clear() empties the queue, and a write already on its way does not bring it back', async () => {
    const r = rig({ key: '' });
    r.uploader.add(at(r));
    r.uploader.clear();
    store.clear();
    await settle();
    assert.equal(store.has('ttc_queue'), false);
    assert.equal(r.uploader.status().queued, 0);
  });
});
