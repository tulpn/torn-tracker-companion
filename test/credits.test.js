// Every script this one took from is named, in the code and in CREDITS.md (CMP-040).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { CREDITS, CREDITS_URL } from '../src/credits.js';
import features from '../src/features/index.js';
import { ROOT } from './helpers.js';

const LICENCES = /^(MIT|BSD[- ].*|GPL-3\.0(-or-later)?|GPLv3|none)$/;

describe('CMP-040 every credit is complete and listed', () => {
  test('each row names the script, author, licence, link and what was taken', () => {
    for (const row of CREDITS) {
      for (const field of ['name', 'author', 'licence', 'url', 'taken']) {
        assert.equal(typeof row[field], 'string', `${row.name}: ${field}`);
        assert.ok(row[field].trim(), `${row.name}: ${field} is empty`);
      }
      assert.match(row.licence, LICENCES, `${row.name}: licence`);
      assert.match(row.url, /^https:\/\//, `${row.name}: url`);
      assert.equal(typeof row.merged, 'boolean', `${row.name}: merged`);
      if (row.licence === 'none') assert.equal(row.merged, false, `${row.name}: code with no licence is never merged`);
    }
  });

  test('every name a feature credits is in the panel\'s list and in CREDITS.md', () => {
    const markdown = fs.readFileSync(path.join(ROOT, 'CREDITS.md'), 'utf8');
    for (const feature of features) {
      for (const credit of feature.credits) {
        const name = credit.split('(')[0].trim();
        assert.ok(CREDITS.some((row) => row.name === name), `${feature.id}: "${name}" is not in src/credits.js`);
        assert.ok(markdown.includes(name), `${feature.id}: "${name}" is not in CREDITS.md`);
      }
    }
  });

  test('the panel links to the full credits in this repository', () => {
    assert.match(CREDITS_URL, /^https:\/\/github\.com\/tulpn\/torn-tracker-companion\/blob\/main\/CREDITS\.md$/);
  });
});
