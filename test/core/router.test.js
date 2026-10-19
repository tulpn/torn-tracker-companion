import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { startRouter } from '../../src/core/router.js';

const open = [];
afterEach(() => {
  for (const { stop, window } of open.splice(0)) {
    stop();
    window.close();
  }
});

function router(href = 'https://www.torn.com/factions.php') {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: href });
  const { window } = dom;
  const seen = [];
  const stop = startRouter((loc) => seen.push(`${loc.pathname}${loc.search}${loc.hash}`), window);
  open.push({ stop, window });
  return { window, seen, stop };
}

/** Waits for the router to report, without pinning the test to a timer. */
async function settle(seen, count = 1) {
  const until = Date.now() + 2000;
  const target = (seen?.length ?? 0) + count;
  while (seen && seen.length < target && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 2));
  }
  // A last quiet moment, so "exactly one update" can be checked too.
  await new Promise((r) => setTimeout(r, 10));
}

describe('CMP-005 the router follows Torn\'s in-page navigation', () => {
  test('it reports where the player already is', () => {
    const { seen } = router('https://www.torn.com/factions.php#/war/rank');
    assert.deepEqual(seen, ['/factions.php#/war/rank']);
  });

  test('a hash change is a new location', async () => {
    const { window, seen } = router();
    window.location.hash = '#/war/rank';
    await settle(seen);
    assert.equal(seen.at(-1), '/factions.php#/war/rank');
  });

  test('a pushState is a new location, and still does what the page asked', async () => {
    const { window, seen } = router();
    window.history.pushState({}, '', '/profiles.php?XID=1');
    await settle(seen);
    assert.equal(window.location.pathname, '/profiles.php');
    assert.equal(seen.at(-1), '/profiles.php?XID=1');
  });

  test('replaceState counts too', async () => {
    const { window, seen } = router();
    window.history.replaceState({}, '', '/item.php');
    await settle(seen);
    assert.equal(seen.at(-1), '/item.php');
  });

  test('a burst of navigations settles into one update', async () => {
    const { window, seen } = router();
    const before = seen.length;
    window.history.pushState({}, '', '/a.php');
    window.history.pushState({}, '', '/b.php');
    window.history.pushState({}, '', '/c.php');
    await settle(seen);
    assert.equal(seen.length - before, 1);
    assert.equal(seen.at(-1), '/c.php');
  });

  test('stop() leaves the page as it found it', async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.torn.com/' });
    const { window } = dom;
    const before = window.history.pushState;
    const seen = [];
    const stop = startRouter((loc) => seen.push(loc.pathname), window);
    stop();

    assert.equal(window.history.pushState, before);
    window.history.pushState({}, '', '/after.php');
    window.location.hash = '#/war/';
    await settle();
    assert.deepEqual(seen, ['/']);
    window.close();
  });

  test('CMP-030 the router never navigates by itself', async () => {
    const { window, seen } = router('https://www.torn.com/factions.php#/war/rank');
    await settle();
    assert.equal(window.location.href, 'https://www.torn.com/factions.php#/war/rank');
    assert.equal(seen.length, 1);
  });
});
