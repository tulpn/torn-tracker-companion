// development is always ready to promote (hq #708, #715): a change to the script on top of
// a version that is already published fails before the push and on the PR.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { decide, touchesSrc, unreleasedDiffers } from '../tools/version-guard.mjs';

const state = (over) => ({ version: '0.9.17', tagged: true, srcChanged: false, unreleasedChanged: false, ...over });

describe('hq #715 the version guard decides', () => {
  test('a published version with a src/ change fails, and says how to fix it', () => {
    const { ok, message } = decide(state({ srcChanged: true }));
    assert.equal(ok, false);
    assert.equal(
      message,
      '0.9.17 is already published: cut the release (RELEASING.md, Cutting one) or bump the version.',
    );
  });

  test('a published version with a new Unreleased entry fails', () => {
    assert.equal(decide(state({ unreleasedChanged: true })).ok, false);
  });

  test('a published version with a docs-only change passes', () => {
    assert.equal(decide(state()).ok, true);
  });

  test('a version not yet published passes, whatever changed', () => {
    for (const srcChanged of [false, true]) {
      for (const unreleasedChanged of [false, true]) {
        assert.equal(decide(state({ tagged: false, srcChanged, unreleasedChanged })).ok, true);
      }
    }
  });
});

describe('hq #715 what counts as a change to the script', () => {
  test('only paths under src/', () => {
    assert.equal(touchesSrc(['src/core/age.js']), true);
    assert.equal(touchesSrc(['src\\features\\gym.js']), true);
    assert.equal(touchesSrc(['README.md', 'tools/release.mjs', 'test/src/x.test.js']), false);
    assert.equal(touchesSrc([]), false);
  });

  const log = (unreleased, rest = '## 0.9.17 — 2026-11-08\n\n- Old entry.\n') =>
    `# Changelog\n\nIntro.\n\n## Unreleased\n${unreleased}\n${rest}`;

  test('a new line under Unreleased is a change', () => {
    assert.equal(unreleasedDiffers(log(''), log('\n- New entry.\n')), true);
  });

  test('an edit to a published section is not', () => {
    assert.equal(unreleasedDiffers(log(''), log('', '## 0.9.17 — 2026-11-08\n\n- Reworded entry.\n')), false);
  });

  test('the release commit, which empties Unreleased, is a change, but its version is new', () => {
    assert.equal(unreleasedDiffers(log('\n- Entry.\n'), log('', '## 0.9.18 — 2026-11-09\n\n- Entry.\n')), true);
    assert.equal(decide(state({ version: '0.9.18', tagged: false, unreleasedChanged: true })).ok, true);
  });

  test('a CHANGELOG missing on one side counts as a change', () => {
    assert.equal(unreleasedDiffers(null, log('')), true);
  });
});
