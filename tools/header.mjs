// Turns src/meta.js plus the package version into the ==UserScript== header (CMP-001).
//
// Shared by the build and by test/meta.test.js, so the test checks the same text players
// install rather than a second copy of the rules.

// GPLv3 asks for the notice to travel with the file, not only with the repository.
// The `!` keeps esbuild's legal-comment handling from dropping it.
export const LICENCE_NOTICE = `/*!
 * Torn Tracker Companion — https://github.com/tulpn/torn-tracker-companion
 * Copyright (C) 2026 tulpn
 *
 * @license GPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under the
 * terms of the GNU GPL, version 3 or later, as published by the Free Software
 * Foundation. It is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See <https://www.gnu.org/licenses/> for the full text.
 *
 * The source this file was built from, and the credits for every merged script, are in
 * the repository above.
 */`;

/** Fields in the order they appear in the header. Arrays become one line each. */
const FIELDS = [
  ['name', 'name'],
  ['namespace', 'namespace'],
  ['version', 'version'],
  ['description', 'description'],
  ['author', 'author'],
  ['homepageURL', 'homepageURL'],
  ['supportURL', 'supportURL'],
  ['license', 'license'],
  ['match', 'match'],
  ['connect', 'connect'],
  ['downloadURL', 'downloadURL'],
  ['updateURL', 'updateURL'],
  ['runAt', 'run-at'],
  ['grant', 'grant'],
];

const KEY_WIDTH = 13;

/**
 * @param {object} meta     the default export of src/meta.js
 * @param {string} version  package.json's version; strict semver, no suffix PDA could
 *                          misread (CMP-021)
 * @returns {string} the header block, ending in a newline
 */
export function buildHeader(meta, version) {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(String(version))) {
    throw new Error(`version is not semver: ${version}`);
  }
  const values = { ...meta, version };
  const lines = ['// ==UserScript=='];
  for (const [key, tag] of FIELDS) {
    const value = values[key];
    if (value == null) continue;
    for (const one of Array.isArray(value) ? value : [value]) {
      lines.push(`// ${`@${tag}`.padEnd(KEY_WIDTH)}${one}`);
    }
  }
  lines.push('// ==/UserScript==');
  return `${lines.join('\n')}\n`;
}

/** Reads @version, @connect and friends back out of a built header. */
export function parseHeader(text) {
  const block = /\/\/ ==UserScript==\n([\s\S]*?)\/\/ ==\/UserScript==/.exec(text);
  if (!block) throw new Error('no ==UserScript== block');
  const out = {};
  for (const line of block[1].split('\n')) {
    const m = /^\/\/\s+@(\S+)\s+(.*?)\s*$/.exec(line);
    if (!m) continue;
    (out[m[1]] ||= []).push(m[2]);
  }
  return out;
}
