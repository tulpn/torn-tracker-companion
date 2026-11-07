// Readable sizes at 360 px (hq #557 F12): no text under 12 px, and buttons at 13 px.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith('.js') ? [path] : [];
  });
}

/** Every px font size in the styles: `font-size: Npx` and the size in a `font:` shorthand. */
function sizes(text) {
  const found = [];
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) found.push({ line: i + 1, px: Number(m[1]), text: line.trim() });
    for (const m of line.matchAll(/font:\s*(?:[a-z0-9-]+\s+)*?(\d+(?:\.\d+)?)px/g)) found.push({ line: i + 1, px: Number(m[1]), text: line.trim() });
  });
  return found;
}

// The sidebar entry's "TT" mark is an 18 px logo, hidden from screen readers, not text to read.
const LOGO = /\.\$\{P\}-mark \{/;

describe('hq #557 F12 sizes', () => {
  test('no style in src sets text under 12 px', () => {
    const small = [];
    for (const file of files(SRC)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const s of sizes(lines.join('\n'))) {
        if (s.px >= 12) continue;
        if (LOGO.test(lines[s.line - 2] ?? '') || LOGO.test(lines[s.line - 3] ?? '')) continue;
        small.push(`${file.slice(SRC.length)}:${s.line} ${s.px}px`);
      }
    }
    assert.deepEqual(small, []);
  });

  test('the shared buttons and the sidebar switch are 13 px', async () => {
    const ui = readFileSync(join(SRC, 'core/ui.js'), 'utf8');
    for (const rule of [/export function buttonCss[^`]*`\s*\$\{sel\} \{[^}]*\}/, /\$\{SMALL\} \{[^}]*\}/, /\$\{INLINE\} \{[^}]*\}/]) {
      const body = ui.match(rule)?.[0];
      assert.ok(body, String(rule));
      assert.match(body, /font: 600 13px\//);
    }
    const sidebar = readFileSync(join(SRC, 'core/sidebar.js'), 'utf8');
    assert.match(sidebar.match(/-sb-switch \{[^}]*\}/)[0], /font: 600 13px\//);
  });
});
