// One toast stack, above Torn's chat bar (hq #557 A8).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { STACK_ID, showToast } from '../../src/core/toasts.js';
import { ROOT } from '../helpers.js';

const page = () => new JSDOM('<!doctype html><html><head></head><body></body></html>').window.document;

describe('hq #557 A8 one toast stack above the chat bar', () => {
  test('toasts go into one stack, in the order they came; the style is added once', () => {
    const doc = page();
    const a = showToast(doc, doc.createElement('div'));
    const b = showToast(doc, doc.createElement('div'));
    const stack = doc.getElementById(STACK_ID);
    assert.deepEqual([...stack.children], [a, b]);
    assert.equal(doc.querySelectorAll(`#${STACK_ID}`).length, 1);
    assert.equal(doc.querySelectorAll(`#${STACK_ID}-style`).length, 1);
    assert.ok(stack.hasAttribute('data-ttc-own'));
    a.remove();
    b.remove();
    assert.equal(stack.children.length, 0);
  });

  test('the stack sits clear of the chat bar, on a desktop and on a phone', () => {
    const doc = page();
    showToast(doc, doc.createElement('div'));
    const css = doc.getElementById(`${STACK_ID}-style`).textContent;
    assert.match(css, /position: fixed; right: 16px; bottom: 56px;/);
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*bottom: 72px;/);
    assert.match(css, /:empty \{ display: none; \}/);
  });

  test('the achievement toast and the watch notice use the stack, not a place of their own', () => {
    for (const file of ['unlocks.js', 'rota.js']) {
      const source = fs.readFileSync(path.join(ROOT, 'src', 'core', file), 'utf8');
      assert.match(source, /showToast\(doc, /, file);
      assert.doesNotMatch(source, /position: fixed/, file);
    }
  });
});
