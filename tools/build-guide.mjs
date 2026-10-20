// Builds the Companion section of the torn-tracker.com knowledge base from guide/.
//
//   node tools/build-guide.mjs <out-dir> [--commit <sha>]
//
// The site reads each section as a bundle: manifest.json (schema version 2), pages/ and
// assets/, the same layout as the Discord bot's guide bundle, which the site already
// reads. This is a fresh implementation of that format for this repository, not a copy
// of the bot's exporter. Every page is checked first, and the bundle is not written while
// anything is wrong: a broken link fails the build, not the page.
//
// Front matter is one `key: value` per line between `---` lines. Required: title,
// summary, section, order, type, audience, icon, tier. Optional: seo_title, group,
// keywords, duration, guide_step. `updated` is the page file's last commit date.

import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const GUIDE = join(ROOT, 'guide');

export const SCHEMA_VERSION = 2;
export const SECTIONS = ['Get started', 'Guides', 'Concepts', 'Reference', 'Help'];
export const TYPES = ['tutorial', 'how-to', 'explanation', 'reference', 'faq'];
export const AUDIENCES = ['leaders', 'members', 'everyone'];
export const TIERS = ['core', 'pro', 'mixed', 'na'];
/** The icon names the site draws (the same set the bot's pages may use). */
export const ICONS = new Set([
  'academic-cap', 'adjustments-horizontal', 'arrow-path', 'arrow-trending-up', 'banknotes', 'bell',
  'bell-alert', 'bolt', 'book-open', 'bug-ant', 'building-office-2', 'chart-bar',
  'chat-bubble-left-right', 'check-circle', 'clipboard-document-check', 'clock', 'cloud',
  'command-line', 'computer-desktop', 'cube', 'device-phone-mobile', 'document-text',
  'exclamation-triangle', 'eye', 'eye-slash', 'face-smile', 'finger-print', 'fire', 'flag', 'gift',
  'globe-alt', 'hand-raised', 'hashtag', 'heart', 'identification', 'information-circle', 'key',
  'lifebuoy', 'light-bulb', 'link', 'lock-closed', 'magnifying-glass', 'map', 'megaphone',
  'minus-circle', 'no-symbol', 'puzzle-piece', 'question-mark-circle', 'queue-list', 'rocket-launch',
  'shield-check', 'sparkles', 'star', 'ticket', 'trophy', 'user-group', 'user-plus', 'users',
  'viewfinder-circle', 'wrench-screwdriver', 'x-circle',
]);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASSET = /^[a-z0-9]+(?:[-_][a-z0-9]+)*\.(?:png|jpg|webp)$/;
const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/;
const FENCE = /^```[\s\S]*?^```/gm;
const INLINE_CODE = /`[^`\n]*`/g;
const LINK = /\]\(([^)\s]+)\)/g;
const HEADING = /^#{2,6}\s+(.+?)\s*#*\s*$/gm;
/** Other sections are checked by the site when it builds the combined index. */
const OTHER_SECTION = /^(website|bot):[a-z0-9]+(?:-[a-z0-9]+)*\.md(?:#[a-z0-9-]+)?$/;
const MARKER = 'Built by tools/build-guide.mjs';
const FIELDS = new Set([
  'title', 'seo_title', 'summary', 'section', 'order', 'type', 'audience', 'icon', 'tier', 'group',
  'keywords', 'duration', 'guide_step',
]);

export class GuideError extends Error {}

/** A heading's anchor, as the site makes it: lower case, words joined by hyphens. */
export function anchor(heading) {
  return heading.toLowerCase().replace(/[`*_]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

/** One page file -> {page, body}, or throws with the reason. */
export function parsePage(name, text) {
  const slug = name.replace(/\.md$/, '');
  const clean = text.replace(/\r\n/g, '\n');
  const match = FRONT_MATTER.exec(clean);
  if (!match) throw new GuideError(`${name}: missing front matter`);
  const fields = {};
  for (const line of match[1].split('\n')) {
    const cut = line.indexOf(':');
    if (cut === -1) throw new GuideError(`${name}: front matter line ${JSON.stringify(line)} is not 'key: value'`);
    const key = line.slice(0, cut).trim();
    if (!FIELDS.has(key)) throw new GuideError(`${name}: unknown front matter field ${key}`);
    fields[key] = line.slice(cut + 1).trim();
  }
  const problem = (msg) => { throw new GuideError(`${name}: ${msg}`); };
  for (const key of ['title', 'summary', 'section', 'order', 'type', 'audience', 'icon', 'tier']) {
    if (!fields[key]) problem(`${key} is required`);
  }
  if (fields.summary.length > 160) problem('summary is longer than 160 characters');
  if (fields.seo_title && fields.seo_title.length > 60) problem('seo_title is longer than 60 characters');
  if (!SECTIONS.includes(fields.section)) problem(`section must be one of ${SECTIONS.join(', ')}`);
  if (!TYPES.includes(fields.type)) problem(`type must be one of ${TYPES.join(', ')}`);
  if (!AUDIENCES.includes(fields.audience)) problem(`audience must be one of ${AUDIENCES.join(', ')}`);
  if (!TIERS.includes(fields.tier)) problem(`tier must be one of ${TIERS.join(', ')}`);
  if (!ICONS.has(fields.icon)) problem(`icon ${fields.icon} is not one the site draws`);
  if (!/^-?\d+$/.test(fields.order)) problem('order must be a whole number');
  if (fields.guide_step && !/^\d+$/.test(fields.guide_step)) problem('guide_step must be a whole number');
  if (fields.group && !/^[a-z][a-z0-9-]*$/.test(fields.group)) problem('group must be a lower-case key');
  if (fields.section === 'Guides' && !fields.group) problem('a Guides page needs a group from groups.toml');
  if (fields.section !== 'Guides' && fields.group) problem('only Guides pages have a group');

  const page = {
    slug,
    title: fields.title,
    ...(fields.seo_title ? { seo_title: fields.seo_title } : {}),
    summary: fields.summary,
    section: fields.section,
    order: Number(fields.order),
    type: fields.type,
    audience: fields.audience,
    icon: fields.icon,
    tier: fields.tier,
    ...(fields.group ? { group: fields.group } : {}),
    ...(fields.duration ? { duration: fields.duration } : {}),
    keywords: (fields.keywords || '').split(',').map((k) => k.trim()).filter(Boolean),
    ...(fields.guide_step ? { guide_step: Number(fields.guide_step) } : {}),
    updated: null,
  };
  return { page, body: clean.slice(match[0].length).replace(/^\n+/, '') };
}

/** `[x]: groups.toml`'s tables, in file order: key, title, icon, summary. */
export function parseGroups(text) {
  const groups = [];
  let current = null;
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const table = /^\[([a-z][a-z0-9-]*)\]$/.exec(line);
    if (table) {
      current = { key: table[1] };
      groups.push(current);
      continue;
    }
    const pair = /^([a-z_]+)\s*=\s*"((?:[^"\\]|\\.)*)"$/.exec(line);
    if (!pair || !current) throw new GuideError(`groups.toml: cannot read ${JSON.stringify(line)}`);
    current[pair[1]] = pair[2];
  }
  for (const g of groups) {
    if (!g.title || g.title.length > 40 || !ICONS.has(g.icon) || !g.summary || g.summary.length > 160) {
      throw new GuideError(`groups.toml: group ${g.key} needs a title (40), a known icon and a summary (160)`);
    }
  }
  return groups;
}

function headingsOf(body) {
  return new Set([...body.replace(FENCE, '').matchAll(HEADING)].map((m) => anchor(m[1])));
}

/** Every link in a page's prose resolves; code is not checked. */
export function checkLinks(slug, body, bodies, assets) {
  const problems = [];
  const prose = body.replace(FENCE, '').replace(INLINE_CODE, '');
  for (const [, target] of prose.matchAll(LINK)) {
    if (target.startsWith('https://') || OTHER_SECTION.test(target)) continue;
    const local = target.startsWith('companion:') ? target.slice('companion:'.length) : target;
    const [path, fragment] = local.split('#');
    if (path.startsWith('assets/')) {
      if (!assets.has(path.slice('assets/'.length)) || fragment) problems.push(`${slug}: no asset ${target}`);
      continue;
    }
    let heads;
    if (path === '') {
      if (!fragment) {
        problems.push(`${slug}: empty link`);
        continue;
      }
      heads = headingsOf(body);
    } else if (path.endsWith('.md') && bodies.has(path.slice(0, -3))) {
      heads = headingsOf(bodies.get(path.slice(0, -3)));
    } else {
      problems.push(`${slug}: link ${target} is not a companion page, another section's page, an asset or https`);
      continue;
    }
    if (fragment && !heads.has(fragment)) problems.push(`${slug}: no heading for ${target}`);
  }
  return problems;
}

/** Reads and checks the whole guide; throws with every problem at once. */
export async function loadGuide(dir = GUIDE) {
  const problems = [];
  const pages = [];
  for (const name of (await readdir(dir)).filter((n) => n.endsWith('.md')).sort()) {
    const slug = name.slice(0, -3);
    if (!SLUG.test(slug) || slug === 'assets') {
      problems.push(`${name}: file name is not a usable page slug`);
      continue;
    }
    try {
      pages.push(parsePage(name, await readFile(join(dir, name), 'utf8')));
    } catch (err) {
      if (!(err instanceof GuideError)) throw err;
      problems.push(err.message);
    }
  }
  let groups = [];
  try {
    groups = parseGroups(await readFile(join(dir, 'groups.toml'), 'utf8'));
  } catch (err) {
    problems.push(err instanceof GuideError ? err.message : 'groups.toml: missing');
  }
  const keys = new Set(groups.map((g) => g.key));
  for (const { page } of pages) {
    if (page.group && !keys.has(page.group)) problems.push(`${page.slug}.md: group ${page.group} is not in groups.toml`);
  }
  const used = new Set(pages.map(({ page }) => page.group).filter(Boolean));
  for (const g of groups) if (!used.has(g.key)) problems.push(`groups.toml: group ${g.key} has no pages`);

  let assets = [];
  try {
    assets = (await readdir(join(dir, 'assets'))).sort();
  } catch { /* no assets yet */ }
  for (const a of assets) if (!ASSET.test(a)) problems.push(`assets/${a}: name must be lower-case png, jpg or webp`);
  if (!pages.some(({ page }) => page.slug === 'index')) problems.push('index.md: the section needs a front page');

  const bodies = new Map(pages.map(({ page, body }) => [page.slug, body]));
  const assetSet = new Set(assets);
  for (const { page, body } of pages) problems.push(...checkLinks(page.slug, body, bodies, assetSet));
  if (problems.length) throw new GuideError(problems.join('\n'));
  pages.sort((a, b) => a.page.order - b.page.order || a.page.slug.localeCompare(b.page.slug));
  return { pages, groups, assets };
}

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

/** Writes a fresh bundle to `out`, refusing to replace a folder that is not one. */
export async function writeBundle(out, { dir = GUIDE, commit = git('rev-parse', 'HEAD') ?? 'unknown', version } = {}) {
  const { pages, groups, assets } = await loadGuide(dir);
  for (const entry of pages) {
    const date = git('log', '-1', '--format=%cs', '--', join(dir, `${entry.page.slug}.md`));
    entry.page.updated = date;
  }
  try {
    await stat(out);
    const readme = await readFile(join(out, 'README.md'), 'utf8').catch(() => '');
    if (!readme.includes(MARKER)) throw new GuideError(`${out} exists and is not a bundle; refusing to replace it`);
    await rm(out, { recursive: true });
  } catch (err) {
    if (err instanceof GuideError) throw err;
  }
  await mkdir(join(out, 'pages'), { recursive: true });
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const manifest = {
    schema_version: SCHEMA_VERSION,
    section: 'companion',
    version: version ?? pkg.version,
    source_commit: commit,
    pages: pages.map(({ page }) => page),
    modules: [],
    groups,
    assets,
  };
  const json = (v) => `${JSON.stringify(v, null, 2)}\n`;
  await writeFile(join(out, 'README.md'), `# Companion guide bundle\n\n${MARKER} at commit ${commit}.\nDo not edit: change guide/ in torn-tracker-companion and rebuild.\n`);
  await writeFile(join(out, 'manifest.json'), json(manifest));
  for (const { page, body } of pages) await writeFile(join(out, 'pages', `${page.slug}.md`), body);
  if (assets.length) {
    await mkdir(join(out, 'assets'));
    for (const a of assets) await copyFile(join(dir, 'assets', a), join(out, 'assets', a));
  }
  return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [out, ...rest] = process.argv.slice(2);
  const at = rest.indexOf('--commit');
  try {
    if (!out) throw new GuideError('say where to write the bundle: node tools/build-guide.mjs <out-dir>');
    const manifest = await writeBundle(out, at === -1 ? {} : { commit: rest[at + 1] });
    console.log(`wrote ${manifest.pages.length} pages to ${out} at ${manifest.source_commit}`);
  } catch (err) {
    console.error(err instanceof GuideError ? err.message : err);
    process.exit(1);
  }
}
