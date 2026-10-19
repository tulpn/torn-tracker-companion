// Releasing is the one thing that reaches every install at once, so the parts that
// decide a version number and the notes that go with it are tested (CMP-020..022).

import fs from 'node:fs';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { isPrerelease, nextVersion, promoteUnreleased, sectionFor } from '../tools/release.mjs';
import { ROOT, readPackage } from './helpers.js';

const CHANGELOG = fs.readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');

describe('CMP-021 a version PDA and the browser managers compare correctly', () => {
  test('patch, minor and major do what they say', () => {
    assert.equal(nextVersion('1.4.2', 'patch'), '1.4.3');
    assert.equal(nextVersion('1.4.2', 'minor'), '1.5.0');
    assert.equal(nextVersion('1.4.2', 'major'), '2.0.0');
  });

  test('an explicit version is taken as given', () => {
    assert.equal(nextVersion('0.1.0', '1.0.0'), '1.0.0');
  });

  test('a beta counts up, and releasing from one drops the suffix', () => {
    assert.equal(nextVersion('1.4.2', 'beta'), '1.4.3-beta.1');
    assert.equal(nextVersion('1.4.3-beta.1', 'beta'), '1.4.3-beta.2');
    assert.equal(nextVersion('1.4.3-beta.2', 'patch'), '1.4.3');
  });

  test('anything else is refused rather than guessed', () => {
    assert.throws(() => nextVersion('1.4.2', 'next'), /patch, minor, major/);
    assert.throws(() => nextVersion('1.4.2', 'v2'), /patch, minor, major/);
    assert.throws(() => nextVersion('not-a-version', 'patch'), /not semver/);
  });

  test('a prerelease is never the newest release', () => {
    assert.equal(isPrerelease('1.4.3-beta.1'), true);
    assert.equal(isPrerelease('1.4.3'), false);
  });
});

describe('CMP-022 the release notes come from the CHANGELOG', () => {
  const sample = [
    '# Changelog',
    '',
    '## Unreleased',
    '',
    '### Added',
    '- a new thing',
    '',
    '## 1.0.0 — 2026-10-01',
    '',
    '### Added',
    '- the first release',
    '',
  ].join('\n');

  test('a version\'s own section is found', () => {
    assert.equal(sectionFor(sample, '1.0.0'), '### Added\n- the first release');
    assert.equal(sectionFor(sample, 'Unreleased'), '### Added\n- a new thing');
  });

  test('a version with no section is reported, not invented', () => {
    assert.equal(sectionFor(sample, '2.0.0'), null);
  });

  test('a version is not confused with one whose number starts the same', () => {
    const text = '## 1.0.0 — 2026-10-01\n\n- right\n\n## 1.0.0-beta.1 — 2026-09-01\n\n- wrong\n';
    assert.equal(sectionFor(text, '1.0.0'), '- right');
    assert.equal(sectionFor(text, '1.0.0-beta.1'), '- wrong');
  });

  test('promoting Unreleased dates it and leaves the heading ready for next time', () => {
    const next = promoteUnreleased(sample, '1.1.0', '2026-11-02');
    assert.match(next, /## 1\.1\.0 — 2026-11-02/);
    assert.equal(sectionFor(next, '1.1.0'), '### Added\n- a new thing');
    assert.equal(sectionFor(next, 'Unreleased'), '');
    assert.equal(sectionFor(next, '1.0.0'), '### Added\n- the first release');
  });

  test('releasing nothing is refused', () => {
    assert.throws(() => promoteUnreleased('# Changelog\n\n## Unreleased\n\n## 1.0.0 — x\n\n- a\n', '1.1.0', 'd'),
      /nothing is listed/);
    assert.throws(() => promoteUnreleased('# Changelog\n', '1.1.0', 'd'), /no "## Unreleased"/);
  });
});

describe('CMP-022 this repository is ready to cut a release', () => {
  test('the CHANGELOG has an Unreleased section', () => {
    assert.notEqual(sectionFor(CHANGELOG, 'Unreleased'), null);
  });

  test('the version in package.json is one a release could use', () => {
    assert.match(readPackage().version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/);
  });

  test('the release workflow publishes both files and nothing else', () => {
    const workflow = fs.readFileSync(join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
    assert.match(workflow, /dist\/torn-tracker-companion\.user\.js/);
    assert.match(workflow, /dist\/torn-tracker-companion\.meta\.js/);
    assert.match(workflow, /--verify/, 'the workflow must check the tag against package.json');
    assert.match(workflow, /npm test/);
    assert.match(workflow, /lint:rules/);
    assert.match(workflow, /--prerelease/, 'a beta must not become the latest release');
  });
});
