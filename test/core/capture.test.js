import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createGate, isVisible } from '../../src/core/capture.js';

describe('CMP-104 TRV-051 a fact is reported at most once per window', () => {
  test('the same key twice inside the window goes through once', () => {
    let clock = 0;
    const gate = createGate({ windowMs: 30_000, now: () => clock });
    assert.equal(gate.allow('mexico'), true);
    clock = 29_999;
    assert.equal(gate.allow('mexico'), false);
    assert.equal(gate.allow('canada'), true, 'another key is its own fact');
    clock = 30_000;
    assert.equal(gate.allow('mexico'), true);
  });

  test('reset forgets everything', () => {
    const gate = createGate({ windowMs: 30_000, now: () => 0 });
    gate.allow('a');
    gate.reset();
    assert.equal(gate.allow('a'), true);
  });
});

describe('TRV-051 nothing is reported from a tab the player is not looking at', () => {
  test('visible, hidden, and no visibility API at all', () => {
    assert.equal(isVisible({ visibilityState: 'visible' }), true);
    assert.equal(isVisible({ visibilityState: 'hidden' }), false);
    assert.equal(isVisible({}), true);
  });
});
