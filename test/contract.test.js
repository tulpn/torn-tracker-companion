// The site paths contract (hq #471, #469): the committed contract/site-paths.json is what
// the source calls, and the generator reads every shape of call the source uses.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { CONTRACT, buildContract, contractFrom, contractText } from '../tools/build-contract.mjs';

const SITE_DECL = "import { SITE } from '../hosts.js';\n";

describe('hq #471 contract/site-paths.json', () => {
  test('the committed file matches the source (run npm run contract after changing a call)', async () => {
    assert.equal(await readFile(CONTRACT, 'utf8'), contractText(await buildContract()));
  });

  test('every path is on the site, with a method and how it is asked', async () => {
    const { host, paths } = await buildContract();
    assert.equal(host, 'https://torn-tracker.com');
    assert.ok(paths.length > 20);
    for (const p of paths) {
      assert.match(p.path, /^\/api\/(feeds|open)\/[\w/{}.-]+$/);
      assert.ok(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(p.method));
      assert.equal(p.auth, p.path.startsWith('/api/open/') ? 'none' : 'script_key');
    }
    assert.ok(paths.some((p) => p.method === 'POST' && p.path === '/api/feeds/observations'), 'the upload is in it');
  });

  test('path parameters, queries, one row per path and method', () => {
    const { paths } = contractFrom([['a.js', `${SITE_DECL}
      const A_URL = \`\${SITE}/api/feeds/a\`;
      call(\`\${A_URL}/\${encodeURIComponent(playerId)}/entries?limit=\${n}&from=\${f}\`, { method: 'post' });
      call(\`\${A_URL}?x=1\`, { method: 'GET' });
      call(A_URL, { method: 'GET' });
      call(\`\${A_URL}\${query}\`, { method: 'GET' });
    `]]);
    assert.deepEqual(paths, [
      { method: 'GET', path: '/api/feeds/a', query: ['x'], auth: 'script_key' },
      { method: 'POST', path: '/api/feeds/a/{player_id}/entries', query: ['from', 'limit'], auth: 'script_key' },
    ]);
  });

  test('a URL nobody calls, or a call with no literal method, fails the build', () => {
    assert.throws(() => contractFrom([['a.js', `${SITE_DECL}const B_URL = \`\${SITE}/api/feeds/b\`;`]]), /B_URL .* never called/);
    assert.throws(() => contractFrom([['a.js', `${SITE_DECL}const B_URL = \`\${SITE}/api/feeds/b\`; call(B_URL, { method: verb });`]]), /a\.js:2: a call to B_URL with no literal method/);
  });

  test("a file's own constant of the same name, such as a page link, is not the API one", () => {
    const { paths } = contractFrom([
      ['a.js', `${SITE_DECL}export const G_URL = \`\${SITE}/api/feeds/g\`; call(G_URL, { method: 'GET' });`],
      ['b.js', `${SITE_DECL}const G_URL = \`\${SITE}/g/\`; link(G_URL, 'Guide');`],
    ]);
    assert.equal(paths.length, 1);
  });
});
