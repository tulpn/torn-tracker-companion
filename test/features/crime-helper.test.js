// The crime helper, against a saved burglary page and its own response (CMP-205).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { lifetime, moraleFrom, propertiesFrom, typeIdOf } from '../../src/features/crime-helper/index.js';
import { isCrimesResponse } from '../../src/features/crime-helper/selectors.js';
import { json, page, runFeature } from '../feature-harness.js';

const BURGLARY = 'https://www.torn.com/page.php?sid=crimes#/burglary';
const RESPONSE = 'https://www.torn.com/page.php?sid=crimesData&step=crimesList&typeID=7';
// The fixture's targets expire 6 h and 3 d 17 h after this.
const NOW = 1_792_478_400_000;

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: BURGLARY, html: page('crimes-burglary.html'), now: () => NOW, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
const badges = (r, kind) => [...r.doc.querySelectorAll(`.ttc-crime[data-kind="${kind}"]`)];

describe('CMP-205 reading the crimes response', () => {
  test('only the page’s own crimesData responses', () => {
    assert.equal(isCrimesResponse(RESPONSE), true);
    assert.equal(isCrimesResponse('https://www.torn.com/page.php?sid=bazaarData'), false);
    assert.equal(isCrimesResponse('not a url %%%'), false);
  });

  test('morale is 100 minus demoralisation; anything odd is none', () => {
    assert.equal(moraleFrom({ DB: { demMod: 13 } }), 87);
    assert.equal(moraleFrom({ DB: { demMod: '13' } }), null);
    assert.equal(moraleFrom({ DB: { demMod: 140 } }), null);
    assert.equal(moraleFrom(null), null);
  });

  test('targets by title with their expiry; rows that do not fit are left out', () => {
    const props = propertiesFrom(json('crimes-burglary.json'));
    assert.deepEqual([...props.keys()], ['Shack on Marshall Road', 'Warehouse on Elm Street']);
    assert.equal(props.get('Shack on Marshall Road'), 1_792_500_000_000);
  });

  test('time left and how urgent', () => {
    assert.deepEqual(lifetime(6 * 3_600_000), { text: '6h', left: 'short' });
    assert.deepEqual(lifetime(30 * 3_600_000), { text: '30h', left: 'day' });
    assert.deepEqual(lifetime(84 * 3_600_000), { text: '3d 12h', left: 'long' });
    assert.deepEqual(lifetime(-5), { text: '0m', left: 'short' });
  });
});

describe('CMP-205 on the page', () => {
  test('morale in the header, time left beside each known target, nothing guessed', async () => {
    const r = run();
    r.respond(RESPONSE, json('crimes-burglary.json'));
    await wait();
    assert.deepEqual(badges(r, 'morale').map((n) => n.textContent), ['Morale 87%']);
    assert.deepEqual(badges(r, 'left').map((n) => [n.textContent, n.dataset.left]), [['6h', 'short'], ['3d 17h', 'long']]);
    assert.deepEqual(r.violations, []);
  });

  test('a recycled row takes the badge of the target it now shows', async () => {
    const r = run();
    r.respond(RESPONSE, json('crimes-burglary.json'));
    await wait();
    const cell = r.doc.querySelector('.virtual-item [class*="crimeOptionSection"]');
    cell.firstChild.nextSibling.textContent = 'Unknown Place';
    await wait();
    assert.deepEqual(badges(r, 'left').map((n) => n.textContent), ['3d 17h']);
  });

  test('before the page has answered: nothing shown', async () => {
    const r = run();
    await wait();
    assert.equal(r.doc.querySelectorAll('.ttc-crime').length, 0);
  });

  test('stopping takes everything off', async () => {
    const r = run();
    r.respond(RESPONSE, json('crimes-burglary.json'));
    await wait();
    feature.stop();
    assert.equal(r.doc.querySelectorAll('.ttc-crime').length, 0);
  });
});

describe('CMP-205 value per nerve beside each crime option', () => {
  const SEARCH = `<div class="crimes-app-header"></div><div class="currentCrime___a1"><div class="virtualList___b2">
    <div class="virtual-item"><div class="crimeOptionSection___d4">Search the Trash</div></div>
    <div class="virtual-item"><div class="crimeOptionSection___d4">Search the Junkyard</div></div>
  </div></div>`;
  const site = (rows) => {
    const calls = [];
    return { calls, async crimeValue(id) { calls.push(id); return rows; } };
  };

  test('the crime from the address or the form', () => {
    assert.equal(typeIdOf('https://www.torn.com/page.php?sid=crimesData&step=crimesList&typeID=1'), 1);
    assert.equal(typeIdOf('https://www.torn.com/page.php?sid=crimesData', new URLSearchParams('typeID=7')), 7);
    assert.equal(typeIdOf('https://www.torn.com/page.php?sid=crimesData'), null);
  });

  test('one read per crime; a line only where the site has a value', async () => {
    const s = site([
      { name: 'Search the Trash', value_per_nerve: 310.5, success_rate: 91, reporters: 40 },
      { name: 'Search the Junkyard', value_per_nerve: null, success_rate: null, reporters: 4 },
    ]);
    const r = run({ html: SEARCH, url: 'https://www.torn.com/page.php?sid=crimes#/searchforcash', site: s });
    r.respond('https://www.torn.com/page.php?sid=crimesData&step=crimesList&typeID=1', { DB: { demMod: 0 } });
    r.respond('https://www.torn.com/page.php?sid=crimesData&step=crimesList&typeID=1', { DB: { demMod: 0 } });
    await wait();
    assert.deepEqual(s.calls, [1]);
    assert.deepEqual(badges(r, 'value').map((n) => n.textContent), ['$311/nerve']);
    assert.match(badges(r, 'value')[0].title, /40 players/);
  });

  test('without a site answer: no value line', async () => {
    const r = run({ html: SEARCH, url: 'https://www.torn.com/page.php?sid=crimes#/searchforcash', site: site([]) });
    r.respond('https://www.torn.com/page.php?sid=crimesData&step=crimesList&typeID=1', { DB: { demMod: 0 } });
    await wait();
    assert.equal(badges(r, 'value').length, 0);
  });
});
