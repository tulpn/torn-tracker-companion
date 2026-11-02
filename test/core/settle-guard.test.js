// No feature puts its look off for ever on a busy page (hq #454).
//
// A debounce that clears its timer and sets it again on every change never fires while
// something on the page keeps changing (a clock, a chat, another script). Features wait
// with `settler` from core/dom.js instead, which looks by a deadline at the latest.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const FEATURES = new URL('../../src/features/', import.meta.url);
/** `x.clearTimeout(t);` followed by `t = x.setTimeout(`: the timer starts again on every change. */
const RESTART = /clearTimeout\(([\w.]+)\);\s*\n\s*\1 = [\w.]+\.setTimeout\(/;

const restarts = (name) => RESTART.test(readFileSync(new URL(`${name}/index.js`, FEATURES), 'utf8'));
const features = readdirSync(FEATURES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

describe('hq #454 features wait with settler', () => {
  test('no feature restarts its timer on every change', () => {
    assert.ok(features.length > 20);
    assert.deepEqual(features.filter(restarts), []);
  });
});
