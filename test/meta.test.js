// The userscript header: one source, and the promises it makes about the network.

import fs from 'node:fs';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildHeader, parseHeader } from '../tools/header.mjs';
import META from '../src/meta.js';
import { HOSTS } from '../src/hosts.js';
import { META_PATH, SCRIPT_PATH, readPackage } from './helpers.js';

const pkg = readPackage();
const built = fs.readFileSync(SCRIPT_PATH, 'utf8');
const metaFile = fs.readFileSync(META_PATH, 'utf8');
const header = parseHeader(built);

describe('CMP-001 the header is generated, never hand-edited', () => {
  test('both built files start with the same header', () => {
    const expected = buildHeader(META, pkg.version);
    assert.equal(metaFile, expected);
    assert.ok(built.startsWith(expected.trimEnd()));
  });

  test('@version is package.json\'s version', () => {
    assert.deepEqual(header.version, [pkg.version]);
  });

  test('buildHeader refuses a version that is not semver', () => {
    assert.throws(() => buildHeader(META, 'v1.2'), /semver/);
  });

  test('the bundle carries that version at runtime, not a placeholder', () => {
    assert.ok(built.includes(`"${pkg.version}"`), 'the version was not substituted into the bundle');
    assert.ok(!built.includes('__TTC_VERSION__'), 'the build placeholder survived');
  });
});

describe('CMP-010 only two hosts are ever contacted', () => {
  test('@connect is exactly the allowlist in hosts.js', () => {
    assert.deepEqual(header.connect, [...HOSTS]);
  });

  test('www.torn.com is not among them', () => {
    assert.ok(!HOSTS.includes('www.torn.com'));
  });
});

describe('CMP-007 the same file runs in Torn PDA', () => {
  test('@grant is none, so there are no GM_* functions to miss', () => {
    assert.deepEqual(header.grant, ['none']);
    assert.ok(!/\bGM_\w+/.test(built), 'bundle uses a GM_* function');
  });

  test('it runs on Torn only', () => {
    assert.deepEqual(header.match, ['https://www.torn.com/*']);
  });
});

describe('CMP-020 update channel', () => {
  test('@downloadURL and @updateURL resolve to the newest release', () => {
    assert.deepEqual(header.downloadURL, [
      'https://github.com/tulpn/torn-tracker-companion/releases/latest/download/torn-tracker-companion.user.js',
    ]);
    assert.deepEqual(header.updateURL, [
      'https://github.com/tulpn/torn-tracker-companion/releases/latest/download/torn-tracker-companion.meta.js',
    ]);
  });

  test('CMP-021 @version is plain semver, which PDA compares correctly', () => {
    assert.match(header.version[0], /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/);
  });

  test('CMP-021 every key is written "// @key", the one spacing PDA\'s header parser reads', () => {
    // PDA's parseHeader matches `\/\/\x20(@\S+)`: one space, no tab (torn-pda 390987e,
    // lib/models/userscript_model.dart). A key it can't read is a missing @updateURL.
    const lines = metaFile.split('\n').filter((line) => line.includes('@'));
    assert.ok(lines.length > 5);
    for (const line of lines) assert.match(line, /^\/\/ @\S+/, line);
  });
});

describe('CMP-040 the licence travels with the file', () => {
  test('@license is GPLv3 or later', () => {
    assert.deepEqual(header.license, ['GPL-3.0-or-later']);
  });

  test('the bundle keeps its licence notice', () => {
    assert.match(built, /GNU GPL, version 3 or later/);
  });
});

describe('CMP-001 the build is readable', () => {
  test('it is not minified', () => {
    const lines = built.split('\n');
    assert.ok(lines.length > 200, `only ${lines.length} lines; minified?`);
    assert.ok(lines.every((line) => line.length < 500), 'a very long line suggests minification');
  });
});
