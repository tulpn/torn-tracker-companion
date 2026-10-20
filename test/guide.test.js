// The Companion section of the knowledge base: every page checks out, and the bundle has
// the layout the site reads (tools/build-guide.mjs).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { GuideError, anchor, checkLinks, loadGuide, parsePage, writeBundle } from '../tools/build-guide.mjs';

const page = (front, body = 'Text.\n') => `---\n${front}\n---\n\n${body}`;
const GOOD = [
  'title: A page', 'summary: What it does.', 'section: Get started', 'order: 10', 'type: how-to',
  'audience: everyone', 'icon: star', 'tier: core',
].join('\n');

describe('KB-011 front matter', () => {
  test('a good page parses, with keywords and the guide step', () => {
    const { page: p, body } = parsePage('a-page.md', page(`${GOOD}\nkeywords: one, two\nguide_step: 4`, '# Hi\n'));
    assert.equal(p.slug, 'a-page');
    assert.deepEqual(p.keywords, ['one', 'two']);
    assert.equal(p.guide_step, 4);
    assert.equal(p.tier, 'core');
    assert.equal(body, '# Hi\n');
  });

  test('a title may hold a colon: the value is everything after the first one', () => {
    assert.equal(parsePage('x.md', page(GOOD.replace('title: A page', 'title: Abroad: best buy'))).page.title, 'Abroad: best buy');
  });

  test('what the site would refuse is refused here', () => {
    const bad = [
      [GOOD.replace('tier: core', 'tier: gold'), /tier must be/],
      [GOOD.replace('section: Get started', 'section: Stuff'), /section must be/],
      [GOOD.replace('icon: star', 'icon: rocket'), /icon rocket/],
      [GOOD.replace('tier: core', ''), /front matter line|tier is required/],
      [`${GOOD}\nmodule: x`, /unknown front matter field module/],
      [GOOD.replace('summary: What it does.', `summary: ${'x'.repeat(161)}`), /summary is longer/],
      [GOOD.replace('section: Get started', 'section: Guides'), /needs a group/],
    ];
    for (const [front, why] of bad) assert.throws(() => parsePage('x.md', page(front)), why);
    assert.throws(() => parsePage('x.md', 'no front matter'), GuideError);
  });
});

describe('KB-012 links are checked when the bundle is built', () => {
  const bodies = new Map([['install', '## Add the script\n'], ['faq', 'x']]);
  test('pages and their headings, other sections, https and assets', () => {
    const body = [
      '[a](install.md) [b](install.md#add-the-script) [c](companion:faq.md) [d](website:script-key.md)',
      '[e](bot:gym.md#top) [f](https://example.org) [g](#here)', '## Here', '`[code](nowhere.md)`',
    ].join('\n');
    assert.deepEqual(checkLinks('p', body, bodies, new Set()), []);
  });

  test('a missing page, heading or asset fails', () => {
    const problems = checkLinks('p', '[a](gone.md) [b](install.md#nope) [c](assets/x.png) [d](http://x.org)', bodies, new Set());
    assert.equal(problems.length, 4);
  });

  test('anchors as the site makes them', () => {
    assert.equal(anchor('Add the script from its URL'), 'add-the-script-from-its-url');
    assert.equal(anchor('What `it` reads, and sends!'), 'what-it-reads-and-sends');
  });
});

describe('KB-008 this repository’s guide', () => {
  test('every page checks out: front matter, groups, links', async () => {
    const { pages, groups } = await loadGuide();
    assert.ok(pages.length >= 22);
    assert.deepEqual(groups.map((g) => g.key), ['settings', 'features']);
    assert.ok(pages.some(({ page: p }) => p.slug === 'index'));
  });

  test('every page says it is a test release, and a feature page says Core or Pro near the top', async () => {
    const { pages } = await loadGuide();
    for (const { page: p, body } of pages) {
      const top = body.split('\n').slice(0, 6).join('\n');
      assert.match(top, /\*\*Test release\.\*\*/, p.slug);
      if (p.tier !== 'na') assert.match(top, /\*\*(Core|Pro)[:*]/, `${p.slug} states Core or Pro`);
    }
  });

  test('no internal ids or repo names on a page', async () => {
    const { pages } = await loadGuide();
    for (const { page: p, body } of pages) {
      assert.doesNotMatch(body, /\b(D-0\d\d|WP-[A-Z]+-\d+|CMP-\d+|CAPI-\d+|LDT-\d+|tc-targets|torn-tracker-hq|torn-tracker-dcbot)\b/, p.slug);
    }
  });

  test('the bundle: manifest schema 2, one file per page, and it will not overwrite a stranger', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-guide-'));
    const target = path.join(out, 'bundle');
    const manifest = await writeBundle(target, { commit: 'abc123' });
    assert.equal(manifest.schema_version, 2);
    assert.equal(manifest.section, 'companion');
    assert.equal(manifest.source_commit, 'abc123');
    assert.equal(fs.readdirSync(path.join(target, 'pages')).length, manifest.pages.length);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8')).pages.length, manifest.pages.length);
    await writeBundle(target, { commit: 'def456' });
    const stranger = path.join(out, 'stranger');
    fs.mkdirSync(stranger);
    await assert.rejects(writeBundle(stranger), /not a bundle/);
    fs.rmSync(out, { recursive: true, force: true });
  });
});
