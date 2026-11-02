// No feature puts its look off for ever on a busy page (hq #454).
//
// A debounce that clears its timer and sets it again on every change never fires while
// something on the page keeps changing (a clock, a chat, another script). Features wait
// with `settler` from core/dom.js instead, which looks by a deadline at the latest.
// STILL_DEBOUNCED lists the features not converted yet; it only ever shrinks.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const FEATURES = new URL('../../src/features/', import.meta.url);
const STILL_DEBOUNCED = new Set([
  'race-templates', 'shop-highlighter', 'stock-advisor', 'trade-value',
  'undersell-warning', 'wallet-reminder', 'war-page',
]);
/** `x.clearTimeout(t);` followed by `t = x.setTimeout(`: the timer starts again on every change. */
const RESTART = /clearTimeout\(([\w.]+)\);\s*\n\s*\1 = [\w.]+\.setTimeout\(/;

const restarts = (name) => RESTART.test(readFileSync(new URL(`${name}/index.js`, FEATURES), 'utf8'));
const features = readdirSync(FEATURES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

describe('hq #454 features wait with settler', () => {
  test('no feature outside the list restarts its timer on every change', () => {
    const found = features.filter((name) => !STILL_DEBOUNCED.has(name) && restarts(name));
    assert.deepEqual(found, []);
  });

  test('the list holds only features that still need converting', () => {
    const done = [...STILL_DEBOUNCED].filter((name) => !restarts(name));
    assert.deepEqual(done, [], 'take converted features off STILL_DEBOUNCED');
  });
});
