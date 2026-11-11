// Award countdown on Torn's awards page (hq #785, ENG-063), against the owner's capture of
// the merits tab (test/fixtures/pages/awards-merits.html) and the dashboard read's
// `awards` card as the site sends it, checked by the real reader.

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { countdown, dayText } from '../../src/features/award-countdown/index.js';
import { readDashboard } from '../../src/core/site.js';
import { page, runFeature } from '../feature-harness.js';

const URL = 'https://www.torn.com/page.php?sid=awards&tab=merits';
const HTML = page('awards-merits.html');
const AWARDS = 'https://www.torn-tracker.com/awards/';
const NEXT = 'https://www.torn-tracker.com/awards/next/';
// Thursday 2026-11-12, noon UTC.
const NOW = Date.UTC(2026, 10, 12, 12);

const nearest = [
  { id: 7, kind: 'honor', name: 'Bar Breaker', description: 'Bust 1,000 players', pct: 99.7, current: 997, goal: 1000, remaining: 3, detail: '3 to go', url: AWARDS },
  { id: 9, kind: 'medal', name: 'Frequent Flyer', pct: 80, current: 80, goal: 100, url: AWARDS },
];
const next = [
  { id: 7, kind: 'honor', name: 'Bar Breaker', remaining: 3, unit: 'busts', eta_days: 3, url: NEXT },
  { id: 11, kind: 'honor', name: 'Mile High', remaining: 17, unit: 'trips', eta_days: null, url: NEXT },
];
const card = (awards) => readDashboard({ server_time: Math.floor(NOW / 1000), awards }).cards.get('awards');

const running = [];
const run = (awards, opts = {}) => {
  let asked = 0;
  const site = {
    async dashboard() {
      asked += 1;
      return opts.answer ?? { status: 'ok', cards: new Map([['awards', awards === undefined ? null : card(awards)]]) };
    },
  };
  const r = runFeature(feature, { url: URL, html: HTML, site, now: () => NOW, ...opts });
  r.asked = () => asked;
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));
const box = (r) => r.doc.querySelector('.ttc-award-next');

describe('hq #785 the awards card reader', () => {
  test('`next` is optional: today’s reply reads as before, with no next rows', () => {
    const c = card({ nearest });
    assert.equal(c.nearest.length, 2);
    assert.deepEqual(c.next, []);
  });

  test('next rows are checked field by field; a bad row is dropped, never guessed', () => {
    const c = card({ nearest, next: [
      ...next,
      { id: 12, kind: 'honor', name: 'Third', remaining: 1, eta_days: 2, url: NEXT },
    ] });
    assert.equal(c.next.length, 2, 'at most two');
    assert.deepEqual(c.next[0], { id: 7, kind: 'honor', name: 'Bar Breaker', remaining: 3, unit: 'busts', etaDays: 3, url: NEXT });
    assert.equal(c.next[1].etaDays, null);
    for (const bad of [
      { ...next[0], remaining: 0 }, { ...next[0], remaining: 2.5 }, { ...next[0], eta_days: -1 },
      { ...next[0], eta_days: 1.5 }, { ...next[0], kind: 'merit' }, { ...next[0], name: ' ' },
    ]) assert.deepEqual(card({ nearest, next: [bad] }).next, [], JSON.stringify(bad));
    assert.equal(card({ nearest, next: [{ ...next[0], url: 'https://evil.example/' }] }).next[0].url, null, 'a link off our site is dropped');
    assert.equal(card({ nearest, next: [{ ...next[0], unit: 'x'.repeat(21) }] }).next[0].unit, null);
  });

  test('a card with only next rows still shows', () => {
    assert.equal(card({ nearest: [], next }).next.length, 2);
  });
});

describe('hq #785 what the strip says', () => {
  test('the day: today, tomorrow, a weekday within the week, else the date', () => {
    assert.equal(dayText(0, NOW), 'today');
    assert.equal(dayText(1, NOW), 'tomorrow');
    assert.equal(dayText(3, NOW), 'Sunday');
    assert.equal(dayText(9, NOW), 'on 21 Nov');
  });

  test('with next rows: the count, the unit, the award and the day', () => {
    const said = countdown(card({ nearest, next }), NOW);
    assert.deepEqual(said.lines.map((l) => `${l.lead}${l.name}${l.tail}`), [
      '3 busts to your next award, Bar Breaker. At your pace: Sunday.',
      '17 trips to the one after, Mile High.',
    ]);
    assert.equal(said.lines[0].url, NEXT);
  });

  test('without them: the award nearest completion, with no day', () => {
    const said = countdown(card({ nearest }), NOW);
    assert.deepEqual(said.lines.map((l) => `${l.lead}${l.name}${l.tail}`), ['Closest to earning: Bar Breaker, 3 to go.']);
    assert.equal(countdown(card({ nearest: [nearest[1]] }), NOW).lines[0].tail, ', 80% done.');
    assert.equal(countdown(null, NOW), null);
  });
});

describe('hq #785 the strip on the awards page', () => {
  test('one strip above the tab panel, its link opening our site in a new tab', async () => {
    const r = run({ nearest, next });
    await wait();
    const b = box(r);
    assert.ok(b);
    assert.equal(b.nextElementSibling, r.doc.querySelector("[role='tabpanel']"));
    assert.match(b.textContent, /3 busts to your next award, Bar Breaker\. At your pace: Sunday\./);
    const link = b.querySelector('a');
    assert.equal(link.href, NEXT);
    assert.equal(link.target, '_blank');
    assert.equal(r.asked(), 1, 'one read when the page opens');
  });

  test('Torn redrawing the panel puts the strip back, once', async () => {
    const r = run({ nearest });
    await wait();
    const panel = r.doc.querySelector("[role='tabpanel']");
    const fresh = panel.cloneNode(true);
    box(r).remove();
    panel.replaceWith(fresh);
    await wait(500);
    assert.equal(r.doc.querySelectorAll('.ttc-award-next').length, 1);
    assert.equal(box(r).nextElementSibling, fresh);
    assert.equal(r.asked(), 1, 'no second read');
  });

  test('nothing to show, no key or a failed read: no strip', async () => {
    for (const opts of [{}, { answer: { status: 'no_key' } }, { answer: { status: 'failed' } }]) {
      const r = run(undefined, opts);
      await wait();
      assert.equal(box(r), null, JSON.stringify(opts));
    }
  });

  test('stopping removes the strip', async () => {
    const r = run({ nearest });
    await wait();
    r.stop();
    assert.equal(r.doc.querySelector('.ttc-award-next'), null);
  });
});
