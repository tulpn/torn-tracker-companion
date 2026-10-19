// Bundles src/ into the two files a release publishes (CMP-001).
//
//   dist/torn-tracker-companion.user.js   header + bundle, what players install
//   dist/torn-tracker-companion.meta.js   the header alone, what update checks fetch
//
// The output is deliberately unminified: Greasy Fork's review rules and GPLv3's
// "preferred form for making modifications" are both satisfied by the published file.

import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LICENCE_NOTICE, buildHeader } from './header.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const NAME = 'torn-tracker-companion';

export async function buildScript({ outdir = DIST } = {}) {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const { default: meta } = await import(`file://${join(ROOT, 'src', 'meta.js')}`);
  const header = buildHeader(meta, pkg.version);

  await mkdir(outdir, { recursive: true });

  const userScript = join(outdir, `${NAME}.user.js`);
  await build({
    entryPoints: [join(ROOT, 'src', 'main.js')],
    outfile: userScript,
    bundle: true,
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
    charset: 'utf8',
    minify: false,
    legalComments: 'inline',
    // The runtime reads its own version from here; uploads carry it as script_version
    // (CMP-014) and the panel shows it.
    define: { __TTC_VERSION__: JSON.stringify(pkg.version) },
    banner: { js: `${header.trimEnd()}\n${LICENCE_NOTICE}` },
    logLevel: 'warning',
  });

  const metaScript = join(outdir, `${NAME}.meta.js`);
  await writeFile(metaScript, header, 'utf8');

  return { header, version: pkg.version, userScript, metaScript };
}

// Only build when run directly, so tests can import buildScript().
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { version, userScript, metaScript } = await buildScript();
  console.log(`built v${version}\n  ${userScript}\n  ${metaScript}`);
}
