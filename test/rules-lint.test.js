// A lint that never fires is a lint nobody can trust. Every rule in specs/companion.md
// section 6 is planted here and must be caught (CMP-030).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { lint } from '../tools/rules-lint.mjs';
import { ROOT } from './helpers.js';

/** Runs the lint over a throwaway tree. Keys are paths relative to its root. */
async function lintTree(files) {
  const root = await mkdtemp(join(tmpdir(), 'ttc-lint-'));
  for (const [rel, source] of Object.entries(files)) {
    const full = join(root, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, source, 'utf8');
  }
  return lint({ root, dir: join(root, 'src') });
}

/** @returns {Promise<string[]>} the rules that fired for one module of source. */
async function rulesFor(source, path = 'src/features/demo/index.js') {
  const findings = await lintTree({ [path]: source, 'CREDITS.md': '# Credits\n' });
  return [...new Set(findings.map((f) => f.rule))];
}

describe('CMP-030 the lint catches what Torn forbids', () => {
  test('a request to torn.com', async () => {
    assert.deepEqual(await rulesFor("fetch('https://www.torn.com/sidebarInfo.php');"), ['no-torn-requests']);
    assert.deepEqual(await rulesFor("navigator.sendBeacon('https://www.torn.com/x.php', '');"), ['no-torn-requests']);
    assert.deepEqual(await rulesFor('PDA_httpGet(`https://www.torn.com/${page}`);'), ['no-torn-requests']);
  });

  test('a request to a host that is not in @connect', async () => {
    assert.deepEqual(await rulesFor("fetch('https://yata.yt/api/v1/travel/export/');"), ['hosts-allowlist']);
  });

  test('a URL literal for a host nobody declared', async () => {
    assert.deepEqual(await rulesFor("const home = 'https://example.com/';"), ['hosts-allowlist']);
  });

  test('a synthetic click', async () => {
    assert.deepEqual(await rulesFor("document.querySelector('#go').click();"), ['no-synthetic-clicks']);
    assert.deepEqual(
      await rulesFor("node.dispatchEvent(new MouseEvent('click', { bubbles: true }));"),
      ['no-synthetic-clicks'],
    );
    assert.deepEqual(
      await rulesFor("node.dispatchEvent(new KeyboardEvent('keydown'));"),
      ['no-synthetic-clicks'],
    );
  });

  test('a form submit', async () => {
    assert.deepEqual(await rulesFor('form.submit();'), ['no-submit']);
    assert.deepEqual(await rulesFor('form.requestSubmit();'), ['no-submit']);
    assert.deepEqual(await rulesFor("form.dispatchEvent(new Event('submit'));"), ['no-submit']);
  });

  test('navigating for the player', async () => {
    assert.deepEqual(await rulesFor("location.href = 'https://www.torn-tracker.com/';"), ['no-navigation']);
    assert.deepEqual(await rulesFor("window.location.assign('/item.php');"), ['no-navigation']);
    assert.deepEqual(await rulesFor("window.open('https://www.torn.com/item.php');"), ['no-navigation']);
    assert.deepEqual(await rulesFor("history.pushState({}, '', '/item.php');"), ['no-navigation']);
  });

  test('innerHTML and its relatives', async () => {
    for (const source of [
      'node.innerHTML = text;',
      'const html = node.outerHTML;',
      "node.insertAdjacentHTML('beforeend', text);",
      "document.write('<b>x</b>');",
    ]) {
      assert.deepEqual(await rulesFor(source), ['no-innerhtml'], source);
    }
  });

  test('a timer that reaches the network', async () => {
    const source = [
      "import { request } from '../../core/net.js';",
      "setInterval(() => request('https://www.torn-tracker.com/api/feeds/demand'), 1000);",
    ].join('\n');
    assert.deepEqual(await rulesFor(source), ['no-loops-to-network']);
  });

  test('a response the interceptor altered', async () => {
    const path = 'src/core/intercept.js';
    assert.deepEqual(await rulesFor('export function f(response) { response.ok = false; }', path), ['intercept-readonly']);
    assert.deepEqual(await rulesFor('export function f(args) { args[0] = "x"; }', path), ['intercept-readonly']);
    assert.deepEqual(
      await rulesFor('export function f(response) { return response.json(); }', path),
      ['intercept-readonly'],
    );
  });

  test('a credit in the code that is nowhere else', async () => {
    const findings = await lintTree({
      'CREDITS.md': '# Credits\n\nNothing yet.\n',
      'src/features/demo/index.js':
        "export default { id: 'demo', credits: ['FF Scouter V2 (GPLv3)'], start() {}, stop() {} };",
    });
    assert.deepEqual([...new Set(findings.map((f) => f.rule))], ['credits-present']);
    assert.equal(findings.length, 2, 'the missing CREDITS.md row and the missing module notice');
  });

  test('a missing CREDITS.md', async () => {
    const findings = await lintTree({ 'src/features/demo/index.js': 'export default {};' });
    assert.deepEqual(findings.map((f) => f.rule), ['credits-present']);
  });

  test('a finding names the file, the line and the rule', async () => {
    const findings = await lintTree({
      'CREDITS.md': '# Credits\n',
      'src/features/demo/index.js': '\n\nnode.innerHTML = x;\n',
    });
    assert.equal(findings.length, 1);
    assert.match(findings[0].file, /demo/);
    assert.equal(findings[0].line, 3);
    assert.equal(findings[0].rule, 'no-innerhtml');
    assert.ok(findings[0].message.length > 10);
  });
});

describe('CMP-030 the lint leaves honest code alone', () => {
  test('the two allowed hosts pass', async () => {
    assert.deepEqual(await rulesFor("fetch('https://api.torn.com/user/?selections=profile');"), []);
    assert.deepEqual(await rulesFor("fetch('https://www.torn-tracker.com/api/feeds/observations');"), []);
  });

  test('a filler may tell Torn\'s form that a field changed', async () => {
    const source = [
      "input.value = String(price);",
      "input.dispatchEvent(new Event('input', { bubbles: true }));",
      "input.dispatchEvent(new Event('change', { bubbles: true }));",
    ].join('\n');
    assert.deepEqual(await rulesFor(source), []);
  });

  test('the router may wrap history, because that is its job', async () => {
    const source = "history.pushState({}, '', '/x');\nhistory.replaceState = patched;";
    assert.deepEqual(await rulesFor(source, 'src/core/router.js'), []);
    assert.deepEqual(await rulesFor(source, 'src/core/other.js'), ['no-navigation']);
  });

  test('a named flush may be on a timer', async () => {
    const source = [
      "import { request } from '../core/net.js';",
      'export function flush() {',
      "  setTimeout(() => request('https://www.torn-tracker.com/api/feeds/observations'), 15000);",
      '}',
    ].join('\n');
    assert.deepEqual(await rulesFor(source, 'src/core/upload.js'), []);
  });

  test('a link to the repository or the licence is not a request', async () => {
    const source = [
      "const releases = 'https://github.com/tulpn/torn-tracker-companion/releases/latest';",
      "const licence = 'https://www.gnu.org/licenses/';",
      "const thread = 'https://www.torn.com/forums.php#/p=threads&t=1';",
    ].join('\n');
    assert.deepEqual(await rulesFor(source), []);
  });

  test('replacing text in a string is not navigation', async () => {
    assert.deepEqual(await rulesFor("const clean = path.replace(/^\\//, '');"), []);
  });
});

describe('CMP-030 the script itself passes its own lint', () => {
  test('src/ is clean', async () => {
    const findings = await lint({ root: ROOT });
    assert.deepEqual(findings, []);
  });
});
