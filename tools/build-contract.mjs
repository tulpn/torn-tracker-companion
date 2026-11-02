// The site paths the companion calls, as a contract torn-tracker.com tests against
// (hq #471, #469).
//
//   npm run contract
//
// It reads src/ with acorn: every constant built from `${SITE}/api/…`, and every call
// whose first argument is one of them (alone or with more path and a query after it) and
// whose second names a `method`. It writes contract/site-paths.json. The site fetches that
// file and checks each path resolves to a view that answers the method; the test in
// test/contract.test.js fails when the committed file and the source disagree.
//
// A URL constant that no call uses with a readable method fails the build: a new way of
// calling the site has to be taught here, never left out of the contract.

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';

import { SITE } from '../src/hosts.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CONTRACT = join(ROOT, 'contract', 'site-paths.json');

/** camelCase to snake_case, for a path parameter's name. */
const snake = (name) => name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** The name a path parameter goes by: the variable, or the one passed to encodeURIComponent. */
function paramName(node) {
  if (node.type === 'Identifier') return snake(node.name);
  if (node.type === 'CallExpression' && node.arguments[0]?.type === 'Identifier') return snake(node.arguments[0].name);
  return 'param';
}

/** `${SITE}/api/…` with nothing else in it: the path, or null. */
function sitePath(init) {
  if (init?.type !== 'TemplateLiteral' || init.expressions.length !== 1) return null;
  const [head, tail] = init.quasis;
  if (head.value.cooked !== '' || init.expressions[0].type !== 'Identifier' || init.expressions[0].name !== 'SITE') return null;
  return tail.value.cooked.startsWith('/api/') ? tail.value.cooked : null;
}

/** The literal `method` of a call's options, or null. */
function methodOf(options) {
  if (options?.type !== 'ObjectExpression') return null;
  const prop = options.properties.find((p) => p.type === 'Property' && !p.computed && (p.key.name ?? p.key.value) === 'method');
  return prop?.value.type === 'Literal' && typeof prop.value.value === 'string' ? prop.value.value.toUpperCase() : null;
}

/**
 * The path and query names a call's URL argument asks for, or null when it isn't built
 * from a URL constant. Text after `?` is the query; a value spliced in before it is a path
 * parameter when it follows a `/`, and otherwise (an optional query held in a variable)
 * left out.
 */
function urlOf(arg, constants) {
  if (arg.type === 'Identifier') return constants.has(arg.name) ? { name: arg.name, path: constants.get(arg.name), query: [] } : null;
  if (arg.type !== 'TemplateLiteral' || arg.quasis[0].value.cooked !== '') return null;
  const first = arg.expressions[0];
  if (first?.type !== 'Identifier' || !constants.has(first.name)) return null;
  let path = constants.get(first.name);
  let text = '';
  let inQuery = false;
  for (let i = 1; i < arg.quasis.length; i++) {
    const quasi = arg.quasis[i].value.cooked;
    const q = quasi.indexOf('?');
    if (!inQuery) path += q === -1 ? quasi : quasi.slice(0, q);
    if (q !== -1) inQuery = true;
    text += quasi;
    const expr = arg.expressions[i];
    if (expr && !inQuery && path.endsWith('/')) path += `{${paramName(expr)}}`;
  }
  const query = [...text.matchAll(/[?&]([\w.-]+)=/g)].map((m) => m[1]);
  return { name: first.name, path, query };
}

async function sources(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await sources(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out.sort();
}

/**
 * The contract from source files, given as [name, text] pairs.
 * @param {Array<[string, string]>} files
 */
export function contractFrom(files) {
  const parsed = files.map(([name, text]) => [name, parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true })]);
  const constants = new Map();
  const ownNames = new Map();
  for (const [file, ast] of parsed) {
    const own = new Set();
    walk.simple(ast, {
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier') return;
        const path = sitePath(node.init);
        if (path) constants.set(node.id.name, path);
        else own.add(node.id.name);
      },
    });
    ownNames.set(file, own);
  }

  const seen = new Map();
  const used = new Set();
  const problems = [];
  for (const [file, ast] of parsed) {
    // A file's own constant of the same name (a page link, say) hides the API one.
    const visible = new Map([...constants].filter(([name]) => !ownNames.get(file).has(name)));
    walk.simple(ast, {
      CallExpression(node) {
        const url = node.arguments[0] && urlOf(node.arguments[0], visible);
        if (!url) return;
        const method = methodOf(node.arguments[1]);
        if (!method) {
          problems.push(`${file}:${node.loc.start.line}: a call to ${url.name} with no literal method`);
          return;
        }
        used.add(url.name);
        const key = `${url.path} ${method}`;
        const row = seen.get(key) ?? {
          method,
          path: url.path,
          query: [],
          auth: url.path.startsWith('/api/open/') ? 'none' : 'script_key',
        };
        row.query = [...new Set([...row.query, ...url.query])].sort();
        seen.set(key, row);
      },
    });
  }
  for (const name of constants.keys()) {
    if (!used.has(name)) problems.push(`${name} (${constants.get(name)}) is never called with a method`);
  }
  if (problems.length) throw new Error(`site-paths contract:\n${problems.join('\n')}`);

  const paths = [...seen.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return {
    about: 'The torn-tracker.com paths the companion calls. Generated by tools/build-contract.mjs from src/; do not edit.',
    host: SITE,
    paths,
  };
}

/** The contract as the committed file holds it. */
export const contractText = (contract) => `${JSON.stringify(contract, null, 2)}\n`;

export async function buildContract() {
  const files = await sources(join(ROOT, 'src'));
  return contractFrom(await Promise.all(files.map(async (f) => [relative(ROOT, f).split(sep).join('/'), await readFile(f, 'utf8')])));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const contract = await buildContract();
  await mkdir(join(ROOT, 'contract'), { recursive: true });
  await writeFile(CONTRACT, contractText(contract));
  console.log(`contract/site-paths.json: ${contract.paths.length} paths`);
}
