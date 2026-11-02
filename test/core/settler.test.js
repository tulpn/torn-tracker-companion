// The settler (hq #466): it waits for the page to go quiet, but never longer than its
// deadline, so a page that keeps changing still gets looked at.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { settler } from '../../src/core/dom.js';

/** Timers on a clock the test moves by hand. */
function clock() {
  let now = 0;
  let next = 1;
  const pending = new Map();
  return {
    pending,
    setTimeout(fn, ms) {
      const id = next++;
      pending.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    /** Moves the clock on by `ms`, running each timer that falls due on the way. */
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...pending.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        pending.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
  };
}

describe('hq #466 settler', () => {
  test('one change: it runs once, after the quiet time', () => {
    const timers = clock();
    let runs = 0;
    const s = settler(() => { runs += 1; }, 200, { timers });
    s.poke();
    timers.advance(199);
    assert.equal(runs, 0);
    timers.advance(1);
    assert.equal(runs, 1);
    timers.advance(5_000);
    assert.equal(runs, 1, 'the deadline does not run it a second time');
    assert.equal(timers.pending.size, 0);
  });

  test('a burst of changes runs it once, after the last', () => {
    const timers = clock();
    let runs = 0;
    const s = settler(() => { runs += 1; }, 200, { timers });
    for (let i = 0; i < 5; i += 1) {
      s.poke();
      timers.advance(50);
    }
    assert.equal(runs, 0);
    timers.advance(150);
    assert.equal(runs, 1);
  });

  test('a page that never goes quiet still gets looked at by the deadline, and again after it', () => {
    const timers = clock();
    let runs = 0;
    const s = settler(() => { runs += 1; }, 200, { timers });
    // A change every 100 ms for five seconds: a plain "wait for quiet" never ran.
    for (let i = 0; i < 50; i += 1) {
      s.poke();
      timers.advance(100);
    }
    assert.ok(runs >= 4, `ran ${runs} times`);
    assert.ok(runs <= 5, `ran ${runs} times`);
  });

  test('the deadline is at least the quiet time, and can be set', () => {
    const timers = clock();
    let runs = 0;
    const s = settler(() => { runs += 1; }, 1_000, { timers, maxMs: 10 });
    s.poke();
    timers.advance(999);
    assert.equal(runs, 0);
    timers.advance(1);
    assert.equal(runs, 1);
  });

  test('cancel stops both timers', () => {
    const timers = clock();
    let runs = 0;
    const s = settler(() => { runs += 1; }, 200, { timers });
    s.poke();
    s.cancel();
    timers.advance(10_000);
    assert.equal(runs, 0);
    assert.equal(timers.pending.size, 0);
  });
});
