// development is always ready to promote (hq #708, #715).
//
//   npm run check:version                 compare HEAD with origin/development
//   node tools/version-guard.mjs --base <ref>
//
// Fails when package.json's version is already tagged (published) and the change since
// <base> touches src/ or the CHANGELOG's "Unreleased" section: that change would sit on
// development under a version that is already out, and the promotion into main would
// publish nothing (promotion-check.yml). The fix is the release commit (RELEASING.md,
// "Cutting one") or a version bump in the same branch. A docs-only change passes.
//
// CI runs it on every PR into development and on every push to development (test.yml);
// `npm test` runs it locally, so the failure shows before the push. It imports nothing
// outside Node, so CI needs no install. Without a base to compare with (a shallow clone,
// no origin/development), it says so and passes.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The decision table, kept pure so it is tested on its own.
 * @param {{version: string, tagged: boolean, srcChanged: boolean, unreleasedChanged: boolean}} state
 * @returns {{ok: boolean, message: string}}
 */
export function decide({ version, tagged, srcChanged, unreleasedChanged }) {
  if (!tagged) return { ok: true, message: `${version} is not published yet: development stays promotable.` };
  if (srcChanged || unreleasedChanged) {
    return {
      ok: false,
      message: `${version} is already published: cut the release (RELEASING.md, Cutting one) or bump the version.`,
    };
  }
  return { ok: true, message: `${version} is published, and this change leaves src/ and Unreleased alone.` };
}

/** The CHANGELOG's "Unreleased" body, trimmed; null when there is no such section. */
export function unreleasedSection(changelog) {
  if (changelog == null) return null;
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === '## Unreleased');
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n').trim();
}

/** True when the two CHANGELOG texts differ in their "Unreleased" section. */
export function unreleasedDiffers(before, after) {
  return unreleasedSection(before) !== unreleasedSection(after);
}

/** True when any path is under src/. */
export function touchesSrc(paths) {
  return paths.some((path) => path.replace(/\\/g, '/').startsWith('src/'));
}

// ---------------------------------------------------------------- git

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

/** Tags on origin when it answers, else the local ones. */
function isTagged(tag) {
  const remote = tryGit(['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]);
  if (remote !== null) return remote.trim() !== '';
  return (tryGit(['tag', '--list', tag]) ?? '').trim() !== '';
}

function parseArgs(argv) {
  const at = argv.indexOf('--base');
  return { base: at >= 0 ? argv[at + 1] : null };
}

function main() {
  const { base: given } = parseArgs(process.argv.slice(2));
  const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const tag = `v${version}`;

  const ref = given ?? 'origin/development';
  const base = tryGit(['merge-base', ref, 'HEAD'])?.trim();
  if (!base) {
    console.log(`version-guard: no ${ref} to compare with; skipped.`);
    return;
  }

  const paths = git(['diff', '--name-only', base, 'HEAD']).split('\n').filter(Boolean);
  const before = tryGit(['show', `${base}:CHANGELOG.md`]);
  const after = tryGit(['show', 'HEAD:CHANGELOG.md']);
  const { ok, message } = decide({
    version,
    tagged: isTagged(tag),
    srcChanged: touchesSrc(paths),
    unreleasedChanged: unreleasedDiffers(before, after),
  });
  if (ok) {
    console.log(`version-guard: ${message}`);
  } else {
    console.error(`::error file=package.json::${message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
