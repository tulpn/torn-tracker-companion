// The torn-tracker mark in the userscript's @icon and the sidebar block's header (hq BRAND-050).

import fs from 'node:fs';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { generate, markFrom, iconFrom, ICON_OUT, OUT, PNG, SVG } from '../../tools/build-brand.mjs';
import { MARK } from '../../src/data/brand.js';
import { ICON_48 } from '../../src/data/icon.js';
import { parseHeader } from '../../tools/header.mjs';
import { META_PATH, SCRIPT_PATH } from '../helpers.js';

describe('BRAND-050 the mark comes from the brand files, unchanged', () => {
  test('src/data/icon.js and brand.js are what the tool writes from assets/brand/', async () => {
    const { icon, mark } = await generate();
    const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    assert.equal(read(ICON_OUT), icon);
    assert.equal(read(OUT), mark);
  });

  test('the icon is favicon-48.png, byte for byte', () => {
    assert.equal(ICON_48, `data:image/png;base64,${fs.readFileSync(PNG).toString('base64')}`);
  });

  test('the mark carries favicon.svg’s tile and raven', () => {
    const svg = fs.readFileSync(SVG, 'utf8');
    assert.equal(MARK.tile.fill, '#0b0b12');
    assert.equal(MARK.raven.fill, '#a78bfa');
    assert.ok(svg.includes(`d="${MARK.raven.d}"`));
  });

  test('anything that isn’t plain shapes and colours is refused', () => {
    const good = fs.readFileSync(SVG, 'utf8');
    assert.throws(() => markFrom(good.replace('fill="#a78bfa"', 'fill="url(#x)"')), /fills/);
    assert.throws(() => markFrom(good.replace(/d="M/, 'd="javascript:M')), /path data/);
    assert.throws(() => markFrom(good.replace(/viewBox="[^"]*"/, 'viewBox="0 0 1"')), /viewBox/);
    assert.throws(() => iconFrom(Buffer.from('<svg/>')), /not a PNG/);
  });
});

describe('BRAND-050 @icon in both built files', () => {
  for (const [name, file] of [['user.js', SCRIPT_PATH], ['meta.js', META_PATH]]) {
    test(`${name} names the mark as @icon, with no URL to fetch`, () => {
      assert.deepEqual(parseHeader(fs.readFileSync(file, 'utf8')).icon, [ICON_48]);
    });
  }

  test('the icon is in the header only, not a second time in the bundle', () => {
    const text = fs.readFileSync(SCRIPT_PATH, 'utf8');
    assert.equal(text.split(ICON_48).length - 1, 1);
  });
});

describe('hq #675 one drawing of the mark, and no "TT" left', () => {
  test('brandMark draws the favicon mark with the given class', async () => {
    const { JSDOM } = await import('jsdom');
    const { brandMark } = await import('../../src/core/brand.js');
    const doc = new JSDOM('<!doctype html><body></body>').window.document;
    const svg = brandMark(doc, 'ttc-a ttc-b');
    assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(svg.getAttribute('class'), 'ttc-a ttc-b');
    assert.equal(svg.getAttribute('aria-hidden'), 'true');
    assert.equal(svg.getAttribute('focusable'), 'false');
    assert.equal(svg.getAttribute('viewBox'), MARK.viewBox);
    assert.equal(svg.querySelector('rect').getAttribute('fill'), MARK.tile.fill);
    assert.equal(svg.querySelector('path').getAttribute('d'), MARK.raven.d);
    assert.notEqual(brandMark(doc, 'x'), svg, 'a fresh node each time');
  });

  test('the built script prints no "TT" mark anywhere', () => {
    const built = fs.readFileSync(SCRIPT_PATH, 'utf8');
    assert.doesNotMatch(built, /['"`]TT['"`]/);
  });
});
