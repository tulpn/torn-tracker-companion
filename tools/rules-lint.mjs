// Torn's scripting rules, enforced on the source (CMP-030).
//
// The rules the script lives by are not promises in a README: this scan fails the build
// on the shapes that would break them. It is the first of two layers — the second is the
// runtime guard the tests boot every page under (test/helpers.js), which fails on the
// same things actually happening.
//
//   npm run lint:rules
//
// Every finding names the file, the line and the rule. If a rule is wrong, change the
// rule here and say why in the commit, rather than working around it at the call site.

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';

import { HOSTS } from '../src/hosts.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The only hosts a request may name. Kept in one place: src/hosts.js. */
const ALLOWED_HOSTS = new Set(HOSTS);

/**
 * Hosts that may appear in the source as a link or as header metadata — the repository,
 * the licence, the forum thread. A URL on one of these may never be a request target:
 * that is checked separately, so www.torn.com being here does not weaken anything.
 */
const LINK_HOSTS = new Set(['github.com', 'www.gnu.org', 'www.torn.com', 'greasyfork.org']);

/** A filler may tell Torn's form that a field changed. It may do nothing else. */
const ALLOWED_EVENTS = new Set(['input', 'change']);

/** Wrapping history belongs to the router and nowhere else. */
const HISTORY_OWNER = join('src', 'core', 'router.js');
const INTERCEPT = join('src', 'core', 'intercept.js');
const NET = join('src', 'core', 'net.js');

/** setTimeout/setInterval callbacks that are allowed to reach the network. */
const TIMER_EXCEPTIONS = new Set(['flush', 'refreshDibs']);

const REQUEST_CALLEES = new Set(['fetch', 'sendBeacon', 'PDA_httpGet', 'PDA_httpPost']);

// ---------------------------------------------------------------- helpers

/** 'a.b.c' for a member expression, 'x' for an identifier, null otherwise. */
function dotted(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'ThisExpression') return 'this';
  if (node.type === 'MemberExpression' && !node.computed) {
    const object = dotted(node.object);
    const property = node.property.name || node.property.value;
    return object ? `${object}.${property}` : property;
  }
  return null;
}

function propertyName(node) {
  if (node?.type !== 'MemberExpression' || node.computed) return null;
  return node.property.name ?? node.property.value ?? null;
}

/** The string a node spells out, when it spells one out at all. */
function staticString(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral') {
    // Only the fixed parts are knowable; join them so a host hidden in one is still seen.
    return node.quasis.map((q) => q.value.cooked ?? '').join('\u0000');
  }
  return null;
}

function hostOf(text) {
  const match = /^https?:\/\/([^/\s'"`]+)/i.exec(text);
  return match ? match[1].toLowerCase() : null;
}

function mentionsTorn(text) {
  return /(^|[^.\w-])(www\.)?torn\.com/i.test(text.replace(/api\.torn\.com/gi, ''));
}

// ---------------------------------------------------------------- the rules

function checkFile(relPath, source, report) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const at = (node) => node.loc.start.line;
  const add = (rule, node, message) => report({ file: relPath, line: at(node), rule, message });

  const isRouter = relPath === HISTORY_OWNER;
  const isIntercept = relPath === INTERCEPT;

  /** Every URL literal, wherever it is: a host we do not know has no business here. */
  const checkUrlLiteral = (node, text, { asRequestTarget = false } = {}) => {
    const host = hostOf(text);
    if (!host) {
      if (asRequestTarget && mentionsTorn(text)) {
        add('no-torn-requests', node, 'a request naming torn.com');
      }
      return;
    }
    if (ALLOWED_HOSTS.has(host)) return;
    if (asRequestTarget) {
      add(
        mentionsTorn(text) ? 'no-torn-requests' : 'hosts-allowlist',
        node,
        `a request to ${host}; only ${[...ALLOWED_HOSTS].join(' and ')} are in @connect`,
      );
      return;
    }
    if (!LINK_HOSTS.has(host)) {
      add('hosts-allowlist', node, `the URL ${host} is neither an allowed host nor a known link`);
    }
  };

  const checkRequestArgs = (node) => {
    for (const argument of node.arguments || []) {
      const text = staticString(argument);
      if (text) checkUrlLiteral(argument, text, { asRequestTarget: true });
    }
  };

  // Names imported from core/net.js, so a timer that reaches one can be spotted.
  const netImports = new Set();
  for (const statement of ast.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    if (!String(statement.source.value).includes('net.js')) continue;
    for (const specifier of statement.specifiers) netImports.add(specifier.local.name);
  }

  walk.full(ast, (node) => {
    // ---- no-innerhtml
    const property = propertyName(node);
    if (node.type === 'MemberExpression' && ['innerHTML', 'outerHTML', 'insertAdjacentHTML'].includes(property)) {
      add('no-innerhtml', node, `${property} is never used; build nodes with createElement`);
    }
    if (node.type === 'CallExpression' && ['document.write', 'document.writeln'].includes(dotted(node.callee))) {
      add('no-innerhtml', node, 'document.write is never used');
    }

    if (node.type === 'CallExpression') {
      const calleeName = dotted(node.callee);
      const calleeProperty = propertyName(node.callee);

      // ---- no-synthetic-clicks
      if (calleeProperty === 'click') {
        add('no-synthetic-clicks', node, 'the player clicks, the script never does');
      }

      // ---- no-submit
      if (calleeProperty === 'submit' || calleeProperty === 'requestSubmit') {
        add('no-submit', node, 'fields are filled, forms are never submitted');
      }

      // ---- no-synthetic-clicks / fill-only
      if (calleeProperty === 'dispatchEvent') {
        const type = eventTypeOf(node.arguments[0]);
        if (type === null) {
          add('no-synthetic-clicks', node,
            'the event type must be a literal so this rule can read it');
        } else if (!ALLOWED_EVENTS.has(type)) {
          add(
            type === 'submit' ? 'no-submit' : 'no-synthetic-clicks',
            node,
            `dispatching "${type}"; only ${[...ALLOWED_EVENTS].join(' and ')} may be dispatched, to tell Torn's form a field changed`,
          );
        }
      }

      // ---- no-navigation
      if (calleeName === 'window.open' || calleeName === 'open') {
        add('no-navigation', node, 'the script never opens a page for the player');
      }
      if ((calleeProperty === 'pushState' || calleeProperty === 'replaceState') && !isRouter) {
        add('no-navigation', node, `${calleeProperty} belongs to ${HISTORY_OWNER}`);
      }
      if (['assign', 'replace'].includes(calleeProperty) && /(^|\.)location$/.test(dotted(node.callee.object) || '')) {
        add('no-navigation', node, 'the script never changes the location');
      }

      // ---- no-torn-requests / hosts-allowlist
      if (REQUEST_CALLEES.has(calleeName) || REQUEST_CALLEES.has(calleeProperty)
        || (calleeProperty === 'open' && calleeName !== 'window.open')) {
        checkRequestArgs(node);
      }

    }

    if (node.type === 'ImportExpression') {
      const text = staticString(node.source);
      if (text) checkUrlLiteral(node.source, text, { asRequestTarget: true });
    }

    // ---- hosts-allowlist, for every other URL that appears
    if (node.type === 'Literal' || node.type === 'TemplateLiteral') {
      const text = staticString(node);
      if (text && /^https?:\/\//i.test(text)) checkUrlLiteral(node, text);
    }

    if (node.type === 'AssignmentExpression') {
      const left = dotted(node.left);

      // ---- no-navigation
      if (left === 'location' || /(^|\.)location$/.test(left || '') || /(^|\.)location\.href$/.test(left || '')) {
        add('no-navigation', node, 'the script never changes the location');
      }

      // ---- no-navigation: only the router may wrap history
      if (!isRouter && /(^|\.)history(\.|$)/.test(left || '')) {
        add('no-navigation', node, `wrapping history belongs to ${HISTORY_OWNER}`);
      }
      if (!isRouter && node.left.type === 'MemberExpression' && node.left.computed
        && /(^|\.)history$/.test(dotted(node.left.object) || '')) {
        add('no-navigation', node, `wrapping history belongs to ${HISTORY_OWNER}`);
      }

      // ---- intercept-readonly
      if (isIntercept && node.left.type === 'MemberExpression') {
        const owner = dotted(node.left.object) || '';
        if (/^(response|request|args|init|headers)(\.|$)/.test(owner) && propertyName(node.left) !== null) {
          add('intercept-readonly', node, `${left} is the page's, not ours; observe it, never change it`);
        }
        if (node.left.computed && /^(args|arguments)$/.test(owner)) {
          add('intercept-readonly', node, 'the page\'s own request arguments are passed on untouched');
        }
      }
    }

    // ---- intercept-readonly: read a clone, never the response the page will read
    if (isIntercept && node.type === 'CallExpression') {
      const reader = propertyName(node.callee);
      const readFrom = node.callee.object;
      if (['json', 'text', 'arrayBuffer', 'blob'].includes(reader)
        && !(readFrom?.type === 'CallExpression' && propertyName(readFrom.callee) === 'clone')) {
        add('intercept-readonly', node, `read ${reader}() from a clone(), so the page still has its body`);
      }
    }
  });

  // ---- no-loops-to-network (needs the enclosing function's name, so its own pass)
  if (netImports.size) checkTimers(ast, netImports, add);
}

/** Flags a setTimeout/setInterval whose callback reaches core/net.js. */
function checkTimers(ast, netImports, add) {
  walk.ancestor(ast, {
    CallExpression(node, _state, ancestors) {
      const name = dotted(node.callee);
      const property = propertyName(node.callee);
      const isTimer = ['setTimeout', 'setInterval'].includes(name)
        || ['setTimeout', 'setInterval'].includes(property);
      if (!isTimer) return;

      const callback = node.arguments?.[0];
      if (!callback || !['FunctionExpression', 'ArrowFunctionExpression'].includes(callback.type)) return;

      let reaches = false;
      walk.full(callback, (inner) => {
        if (reaches || inner.type !== 'CallExpression') return;
        const root = rootName(inner.callee);
        if (root && netImports.has(root)) reaches = true;
      });
      if (!reaches) return;

      if (TIMER_EXCEPTIONS.has(enclosingName(ancestors))) return;
      add('no-loops-to-network', node,
        `a timer that reaches core/net.js; only ${[...TIMER_EXCEPTIONS].join(' and ')} may, and they are named exceptions`);
    },
  });
}

/** The name of the nearest enclosing function, however it was written. */
function enclosingName(ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const node = ancestors[i];
    if (!['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) continue;
    if (node.id?.name) return node.id.name;
    const parent = ancestors[i - 1];
    if (parent?.type === 'VariableDeclarator') return parent.id?.name ?? null;
    if (parent?.type === 'Property' || parent?.type === 'MethodDefinition') return propertyNameOf(parent);
    if (parent?.type === 'AssignmentExpression') return propertyName(parent.left) ?? dotted(parent.left);
    return null;
  }
  return null;
}

function eventTypeOf(argument) {
  if (!argument) return null;
  const direct = staticString(argument);
  if (direct !== null) return direct;
  if (argument.type === 'NewExpression') return staticString(argument.arguments?.[0]);
  return null;
}

function rootName(node) {
  let current = node;
  while (current?.type === 'MemberExpression') current = current.object;
  return current?.type === 'Identifier' ? current.name : null;
}

// ---------------------------------------------------------------- credits

async function checkCredits(root, files, report) {
  const featureFiles = files.filter((f) => f.rel.startsWith(join('src', 'features') + sep));
  if (featureFiles.length === 0) return;

  let credits = '';
  try {
    credits = await readFile(join(root, 'CREDITS.md'), 'utf8');
  } catch {
    report({ file: 'CREDITS.md', line: 1, rule: 'credits-present', message: 'CREDITS.md is missing' });
    return;
  }

  for (const file of featureFiles) {
    const ast = parse(file.source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    walk.full(ast, (node) => {
      if (node.type !== 'Property' || propertyNameOf(node) !== 'credits') return;
      if (node.value.type !== 'ArrayExpression') return;
      for (const element of node.value.elements) {
        const text = staticString(element);
        if (!text) continue;
        const name = text.split('(')[0].trim();
        if (!credits.includes(name)) {
          report({
            file: file.rel,
            line: element.loc.start.line,
            rule: 'credits-present',
            message: `"${name}" is credited in the code but not in CREDITS.md`,
          });
        }
        if (!file.source.slice(0, node.start).includes(name)) {
          report({
            file: file.rel,
            line: element.loc.start.line,
            rule: 'credits-present',
            message: `"${name}" needs a notice in this module's header comment`,
          });
        }
      }
    });
  }
}

function propertyNameOf(property) {
  return property.key?.name ?? property.key?.value ?? null;
}

// ---------------------------------------------------------------- driver

async function collect(dir, root, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await collect(full, root, out);
    else if (entry.name.endsWith('.js')) {
      out.push({ rel: relative(root, full), source: await readFile(full, 'utf8') });
    }
  }
  return out;
}

/** @returns {Promise<Array<{file: string, line: number, rule: string, message: string}>>} */
export async function lint({ root = ROOT, dir = join(root, 'src') } = {}) {
  const findings = [];
  const report = (finding) => findings.push(finding);
  const files = await collect(dir, root);

  for (const file of files) {
    try {
      checkFile(file.rel, file.source, report);
    } catch (err) {
      report({ file: file.rel, line: err.loc?.line ?? 1, rule: 'parse', message: err.message });
    }
  }
  await checkCredits(root, files, report);

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return findings;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const findings = await lint();
  for (const { file, line, rule, message } of findings) {
    console.error(`${file}:${line}  ${rule}  ${message}`);
  }
  if (findings.length) {
    console.error(`\n${findings.length} violation(s) of Torn's scripting rules. See specs/companion.md section 6.`);
    process.exit(1);
  }
  console.log("rules lint: clean — no request to torn.com, no synthetic click, no submit, no innerHTML.");
}
