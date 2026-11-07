// Other scripts found only by their marks on the page (hq #557 F40).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { NEIGHBOURS, shownByOther } from '../../src/core/neighbours.js';
import { ROOT } from '../helpers.js';

describe('hq #557 F40 other scripts on the page', () => {
  test('a mark on the place itself or inside it; none, or no place, is no', () => {
    const doc = new JSDOM('<div id="card" data-tt-weights="true"></div><div id="row"><span class="bustr-plus-hardness-wrap"></span></div><div id="plain"></div>').window.document;
    assert.equal(shownByOther(doc.getElementById('card'), 'ocWeights'), true);
    assert.equal(shownByOther(doc.getElementById('row'), 'bustScore'), true);
    assert.equal(shownByOther(doc.getElementById('plain'), 'bustScore'), false);
    assert.equal(shownByOther(doc, 'crimeMorale'), false);
    assert.equal(shownByOther(null, 'gymProgress'), false);
    for (const { by, marker } of Object.values(NEIGHBOURS)) {
      assert.ok(by && marker);
      doc.querySelector(marker);
    }
  });

  test('found by the page only: no storage of theirs is read', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src', 'core', 'neighbours.js'), 'utf8');
    assert.doesNotMatch(source, /localStorage|indexedDB|GM_getValue|GM\.getValue|sessionStorage|chrome\./);
  });
});
