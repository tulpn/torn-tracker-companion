// hq #756: Torn PDA reads the installed script as single-byte text, so every raw UTF-8
// character in the bundle showed as mojibake (the middle dot as "Â·", the link arrow as
// "â" and two boxes). The published files must be 7-bit; the release workflow runs this.

import fs from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toAscii } from '../tools/build.mjs';
import { ROOT } from './helpers.js';

for (const name of ['torn-tracker-companion.user.js', 'torn-tracker-companion.meta.js']) {
  test(`hq #756 dist/${name} has no byte above 0x7F`, () => {
    const bytes = fs.readFileSync(join(ROOT, 'dist', name));
    const high = [];
    bytes.forEach((b, i) => { if (b > 0x7f && high.length < 5) high.push(i); });
    const context = high.map((i) => bytes.subarray(Math.max(0, i - 40), i + 4).toString('utf8'));
    assert.deepEqual(context, []);
  });
}

test('hq #756 toAscii keeps strings, templates and regex literals meaning the same', () => {
  const source = [
    'const a = "Watching now · Lead ↗";',
    'const b = `Help → Tours ▾`;',
    "const c = /^[\\p{L}' ’.]+$/u.test('Rhino’s Horn');",
    "const d = /’/.test('it’s');",
    'const e = "flag 🏁";',
    '// a comment with — and ©',
    'return [a, b, c, d, e];',
  ].join('\n');
  const ascii = toAscii(source);
  assert.ok(!/[^\x00-\x7f]/.test(ascii));
  assert.deepEqual(new Function(ascii)(), new Function(source)());
  assert.deepEqual(new Function(ascii)(), ['Watching now · Lead ↗', 'Help → Tours ▾', true, true, 'flag 🏁']);
});
