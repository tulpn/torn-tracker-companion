// Links in the site's replies on either spelling of our host (hq #312, D-162).
//
// Requests go to the bare host since hq #450, but the live site still writes the links in
// its replies on www (the sidebar's quick links, the guide, the achievements page, the war
// brief). Both spellings are ours; a link to any other host is still dropped.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  APPLICANTS_URL, SPACES, createSite, readAchievements, readGuide, readSidebar, validGuide,
} from '../../src/core/site.js';

const WWW = 'https://www.torn-tracker.com';
const BARE = 'https://torn-tracker.com';

describe('site links on www', () => {
  test('the sidebar keeps its quick links on either host and drops others', () => {
    const { links } = readSidebar({ links: [
      { label: 'Dashboard', url: `${WWW}/dashboard/` },
      { label: 'Chains', url: `${BARE}/faction/chains/` },
      { label: 'Elsewhere', url: 'https://evil.example/' },
      { label: 'Lookalike', url: 'https://www.torn-tracker.com.evil.example/' },
    ] }, []);
    assert.deepEqual(links, [
      { label: 'Dashboard', url: `${WWW}/dashboard/` },
      { label: 'Chains', url: `${BARE}/faction/chains/` },
    ]);
  });

  test("the achievements page link on www is kept, another host's falls back", () => {
    assert.equal(readAchievements({ url: `${WWW}/me/achievements/` }).url, `${WWW}/me/achievements/`);
    assert.equal(readAchievements({ url: 'https://evil.example/' }).url, `${BARE}/me/achievements/`);
  });

  test('a guide answer with www links survives the cache check', () => {
    const guide = readGuide({
      started: true, offer: false, done: 2, total: 5, url: `${WWW}/guide/`,
      next: { title: 'Link your key', cta_label: 'Open', cta_url: `${WWW}/guide/key/` },
    });
    assert.equal(guide.url, `${WWW}/guide/`);
    assert.equal(validGuide(guide), true);
    assert.equal(validGuide({ ...guide, url: 'https://evil.example/' }), false);
    assert.equal(validGuide({ ...guide, next: { ...guide.next, href: 'https://evil.example/' } }), false);
  });

  test('the trust link is cached on either host', () => {
    assert.equal(SPACES.trustLink.valid(`${WWW}/trust/`), true);
    assert.equal(SPACES.trustLink.valid(`${BARE}/trust/`), true);
    assert.equal(SPACES.trustLink.valid('https://evil.example/'), false);
  });

  test("an applicant card's link on www is kept", async () => {
    const site = createSite({
      getKey: () => `tt_feed_${'E'.repeat(43)}`,
      send: async (url) => {
        assert.equal(url, APPLICANTS_URL);
        return { ok: true, status: 200, data: { cards: [
          { id: 1, merits: 1, job_points: 1, fit: 'good', card_url: `${WWW}/jobs/c/1/` },
          { id: 2, merits: 1, job_points: 1, fit: 'good', card_url: 'https://evil.example/' },
        ] } };
      },
    });
    const { cards } = await site.applicantCards('faction', [1, 2]);
    assert.equal(cards.get(1).card_url, `${WWW}/jobs/c/1/`);
    assert.equal(cards.get(2).card_url, null);
  });
});
