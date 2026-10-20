// Cutting a release (CMP-022).
//
//   npm run release -- patch|minor|major|1.2.3|beta
//
// Bumps package.json, moves what is under "Unreleased" in the CHANGELOG into a dated
// section, rebuilds so the header's @version follows, commits and tags. Pushing the tag
// is the publish: the release workflow builds, checks that the tag, package.json and the
// built header all say the same thing, runs the tests and the lint, and attaches the two
// files that installs point at.
//
// The workflow also calls this file:
//   --verify v1.2.3   the tag, package.json and dist all agree, and no feature in the
//                     build is missing the owner's wording it needs (src/core/disclosure.js)
//   --notes  v1.2.3   print that version's CHANGELOG section

import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseHeader } from './header.mjs';
import { buildScript } from './build.mjs';
import features from '../src/features/index.js';
import { createRegistry } from '../src/core/registry.js';
import { disclosureGaps } from '../src/core/disclosure.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PKG = join(ROOT, 'package.json');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const META_FILE = join(ROOT, 'dist', 'torn-tracker-companion.meta.js');

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.]+))?$/;

// ---------------------------------------------------------------- pure helpers

/**
 * @param {string} current  the version in package.json
 * @param {string} kind     patch | minor | major | beta | an explicit version
 */
export function nextVersion(current, kind) {
  const parts = SEMVER.exec(current);
  if (!parts) throw new Error(`package.json has a version that is not semver: ${current}`);
  const [, major, minor, patch, pre] = parts;
  const n = (value) => Number(value);

  if (SEMVER.test(kind)) return kind;
  switch (kind) {
    case 'major':
      return `${n(major) + 1}.0.0`;
    case 'minor':
      return `${n(major)}.${n(minor) + 1}.0`;
    case 'patch':
      // Coming off a prerelease, the release is that version without the suffix.
      return pre ? `${n(major)}.${n(minor)}.${n(patch)}` : `${n(major)}.${n(minor)}.${n(patch) + 1}`;
    case 'beta': {
      const number = pre?.startsWith('beta.') ? Number(pre.slice(5)) + 1 : 1;
      const base = pre ? `${n(major)}.${n(minor)}.${n(patch)}` : `${n(major)}.${n(minor)}.${n(patch) + 1}`;
      return `${base}-beta.${number}`;
    }
    default:
      throw new Error(`release: say patch, minor, major, beta, or a version; got "${kind}"`);
  }
}

/** A prerelease is never the newest release, so it never updates a stable install. */
export function isPrerelease(version) {
  return version.includes('-');
}

// A checkout on Windows can hand us CRLF, so the CHANGELOG is read line-wise rather
// than split on '\n' alone, and written back with the endings it came with.
const splitLines = (text) => text.split(/\r?\n/);
const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');

/** Where one version's section starts and ends, by line. */
function bounds(lines, version) {
  const heading = `## ${version}`;
  const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} `));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return { start, end };
}

/** The CHANGELOG body for one version, without its heading. */
export function sectionFor(changelog, version) {
  const lines = splitLines(changelog);
  const found = bounds(lines, version);
  return found ? lines.slice(found.start + 1, found.end).join('\n').trim() : null;
}

/** Moves "Unreleased" into a dated section for the new version. */
export function promoteUnreleased(changelog, version, date) {
  const unreleased = sectionFor(changelog, 'Unreleased');
  if (unreleased === null) throw new Error('CHANGELOG.md has no "## Unreleased" section');
  if (!unreleased) throw new Error('nothing is listed under "## Unreleased"');

  const lines = splitLines(changelog);
  const { start, end } = bounds(lines, 'Unreleased');
  const replacement = ['## Unreleased', '', `## ${version} — ${date}`, '', ...splitLines(unreleased), ''];
  return [...lines.slice(0, start), ...replacement, ...lines.slice(end)].join(eolOf(changelog));
}

/**
 * The owner's words a release would ship without. A sharing switch, or the Torn API key
 * field, is never published ahead of the text that explains it (hq RULES section 6).
 */
export function wordingProblems(registry = createRegistry(features), disclosure = undefined) {
  return disclosureGaps(registry, disclosure).map((gap) => `missing the owner's wording: ${gap}`);
}

/**
 * Generated tables a release would ship unfilled. src/data/items.js starts as a
 * placeholder with only the items the tests use, until tools/build-items.mjs runs with a
 * key; a release with it would price almost nothing on the trade page.
 */
export function dataProblems(itemsSource) {
  return /PLACEHOLDER/.test(itemsSource)
    ? ['src/data/items.js is the placeholder; run `TORN_API_KEY=… npm run data:items` and commit it']
    : [];
}

const ITEMS_FILE = join(ROOT, 'src', 'data', 'items.js');

// ---------------------------------------------------------------- commands

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function verify(tag) {
  const version = tag.replace(/^v/, '');
  const pkg = await readJson(PKG);
  const problems = [];

  if (!SEMVER.test(version)) problems.push(`the tag ${tag} is not a semver version`);
  if (pkg.version !== version) problems.push(`package.json says ${pkg.version}, the tag says ${version}`);

  try {
    const header = parseHeader(await readFile(META_FILE, 'utf8'));
    if (header.version?.[0] !== version) {
      problems.push(`the built header says ${header.version?.[0]}, the tag says ${version}`);
    }
  } catch (err) {
    problems.push(`could not read the built header: ${err.message}`);
  }
  problems.push(...wordingProblems());
  problems.push(...dataProblems(await readFile(ITEMS_FILE, 'utf8')));

  if (problems.length) {
    console.error(`release ${tag} does not add up:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(`${tag}: the tag, package.json and the built header all say ${version}.`);
}

async function notes(tag) {
  const version = tag.replace(/^v/, '');
  const section = sectionFor(await readFile(CHANGELOG, 'utf8'), version);
  if (!section) {
    console.error(`CHANGELOG.md has no section for ${version}`);
    process.exit(1);
  }
  console.log(section);
}

async function cut(kind, { allowBranch = false } = {}) {
  if (git('status', '--porcelain')) {
    throw new Error('the working tree has changes; commit or stash them before a release');
  }
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== 'main' && !allowBranch) {
    throw new Error(`releases are cut from main, not ${branch} (pass --allow-branch if you mean it)`);
  }

  const missing = [...wordingProblems(), ...dataProblems(await readFile(ITEMS_FILE, 'utf8'))];
  if (missing.length) throw new Error(`not releasable yet:\n  - ${missing.join('\n  - ')}`);

  const pkg = await readJson(PKG);
  const version = nextVersion(pkg.version, kind);
  const tag = `v${version}`;
  if (git('tag', '--list', tag)) throw new Error(`${tag} already exists`);

  const changelog = promoteUnreleased(
    await readFile(CHANGELOG, 'utf8'),
    version,
    new Date().toISOString().slice(0, 10),
  );

  pkg.version = version;
  await writeFile(PKG, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  await writeFile(CHANGELOG, changelog, 'utf8');
  await buildScript();

  git('add', 'package.json', 'CHANGELOG.md');
  git('commit', '-m', `chore(release): ${tag}`);
  git('tag', '-a', tag, '-m', tag);

  console.log([
    `${tag} is committed and tagged.`,
    '',
    'Before you push the tag, the release checklist in RELEASING.md:',
    '  - the script installed from dist/ and smoke-tested in Torn PDA on a device;',
    '  - the README terms table matching the kinds this version can share;',
    '  - the forum post updated.',
    '',
    `Then: git push origin main ${tag}`,
    isPrerelease(version)
      ? 'This is a prerelease: it will not be "latest", so stable installs stay where they are.'
      : 'This becomes "latest", and installs will update themselves to it.',
  ].join('\n'));
}

// ---------------------------------------------------------------- cli

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [command, ...rest] = process.argv.slice(2);
  try {
    if (command === '--verify') await verify(rest[0]);
    else if (command === '--notes') await notes(rest[0]);
    else if (!command) throw new Error('say patch, minor, major, beta, or a version');
    else await cut(command, { allowBranch: rest.includes('--allow-branch') });
  } catch (err) {
    console.error(`release: ${err.message}`);
    process.exit(1);
  }
}
