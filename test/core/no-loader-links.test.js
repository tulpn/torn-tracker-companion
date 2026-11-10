// hq #753 (D-245): Torn retired loader.php. Every Torn link the companion builds is
// page.php; loader.php stays only in route keys, which match where a member already is.
// This guard fails on any string literal in src/ that starts a /loader.php path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.js') ? [path] : [];
  });
}

test('hq #753 no built link in src/ starts a /loader.php path', () => {
  const built = /['"`](?:https:\/\/www\.torn\.com)?\/loader\.php/;
  const found = [];
  for (const path of files(SRC)) {
    readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
      if (built.test(line)) found.push(`${path}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(found, []);
});

test('hq #753 the guard catches a built loader.php link', () => {
  const built = /['"`](?:https:\/\/www\.torn\.com)?\/loader\.php/;
  assert.ok(built.test("link(`/loader.php?sid=attack&user2ID=${id}`)"));
  assert.ok(built.test("'https://www.torn.com/loader.php?sid=racing'"));
  assert.ok(!built.test("routes: ['page.php?sid=crimes', 'loader.php?sid=crimes']"));
});
