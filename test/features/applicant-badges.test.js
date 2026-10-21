// Applicant badges on Torn's application lists (JOB-072, CMP-302, hq #79).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import feature, { badgeText, boardOf } from '../../src/features/applicant-badges/index.js';
import { runFeature } from '../feature-harness.js';

const COMPANY = 'https://www.torn.com/companies.php?step=your&type=1#/option=applications';
const FACTION = 'https://www.torn.com/factions.php?step=your#/tab=controls&option=application';

/** Synthetic: no source reads these lists' markup; a capture should replace it. */
const HTML = `<div id="sidebar"><a href="/profiles.php?XID=9">Me in the sidebar</a></div>
<div class="content-wrapper"><ul class="applications">
  <li><a href="/profiles.php?XID=101">Applicant One</a> <span>Message: hi</span></li>
  <li><a href="/profiles.php?XID=102">Applicant Two</a></li>
  <li><a href="/profiles.php?XID=103">Applicant Three</a></li>
</ul></div>`;

function fakeSite({ allowed = true, cards = {
  101: { merits: 10, job_points: 1234, fit: 'good', card_url: 'https://www.torn-tracker.com/jobs/c/1/' },
  102: { merits: null, job_points: null, fit: 'poor', card_url: null },
} } = {}) {
  const calls = [];
  return {
    calls,
    async applicantCards(board, ids) {
      calls.push([board, [...ids]]);
      return { allowed, cards: new Map(allowed ? ids.filter((id) => id in cards).map((id) => [id, cards[id]]) : []) };
    },
  };
}

const running = [];
const run = (opts) => {
  const r = runFeature(feature, { url: COMPANY, html: HTML, ...opts });
  running.push(r);
  return r;
};
afterEach(() => {
  for (const r of running.splice(0)) r.stop();
});
const wait = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));
const badge = (r, id) => r.doc.querySelector(`a[href="/profiles.php?XID=${id}"] + .ttc-applicant`);

describe('JOB-072 which list this is', () => {
  test('company and faction application lists, and nothing else', () => {
    assert.equal(boardOf(new URL(COMPANY)), 'company');
    assert.equal(boardOf(new URL(FACTION)), 'faction');
    assert.equal(boardOf(new URL('https://www.torn.com/companies.php#/option=employees')), null);
    assert.equal(boardOf(new URL('https://www.torn.com/factions.php?step=your#/tab=controls&option=give-to-user')), null);
  });

  test('the badge words', () => {
    assert.equal(badgeText({ merits: 10, job_points: 1234, fit: 'good' }), '10 merits · 1,234 job points · good fit');
    assert.equal(badgeText({ merits: null, job_points: null, fit: null }), 'shared card');
  });
});

describe('JOB-072 on the list', () => {
  test('one ask for the applicants in the content, not the sidebar; badges for those with cards', async () => {
    const site = fakeSite();
    const r = run({ site });
    await wait();
    assert.deepEqual(site.calls, [['company', [101, 102, 103]]]);
    assert.equal(badge(r, 101).textContent, '10 merits · 1,234 job points · good fit');
    assert.equal(badge(r, 101).getAttribute('href'), 'https://www.torn-tracker.com/jobs/c/1/');
    assert.equal(badge(r, 102).textContent, 'poor fit');
    assert.equal(badge(r, 103), null);
    assert.deepEqual(r.shared, [], 'nothing from application pages is ever shared');
    assert.deepEqual(r.violations, []);
  });

  test('the faction list asks for the faction board', async () => {
    const site = fakeSite();
    run({ url: FACTION, site });
    await wait();
    assert.equal(site.calls[0][0], 'faction');
  });

  test('not the director or recruiter: no badges, and not asked again', async () => {
    const site = fakeSite({ allowed: false });
    const r = run({ site });
    await wait();
    r.doc.querySelector('ul').insertAdjacentHTML('beforeend', '<li><a href="/profiles.php?XID=104">Four</a></li>');
    await wait();
    assert.equal(site.calls.length, 1);
    assert.equal(r.doc.querySelectorAll('.ttc-applicant').length, 0);
  });

  test('a new applicant on the list is asked for alone', async () => {
    const site = fakeSite();
    const r = run({ site });
    await wait();
    r.doc.querySelector('ul').insertAdjacentHTML('beforeend', '<li><a href="/profiles.php?XID=104">Four</a></li>');
    await wait();
    assert.deepEqual(site.calls, [['company', [101, 102, 103]], ['company', [104]]]);
  });

  test('any other company or faction page: nothing asked', async () => {
    const site = fakeSite();
    run({ url: 'https://www.torn.com/companies.php#/option=employees', site });
    await wait();
    assert.deepEqual(site.calls, []);
  });
});
