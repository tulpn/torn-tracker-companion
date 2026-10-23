import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { HostNotAllowedError, budgetLeft, request, resetBudget, tagged } from '../../src/core/net.js';
import { HOSTS, hostAllowed } from '../../src/hosts.js';

const SITE = 'https://www.torn-tracker.com/api/feeds/prices?ids=1';
const API = 'https://api.torn.com/user/?selections=profile';

function stubFetch(handler) {
  globalThis.fetch = handler;
}

beforeEach(() => {
  resetBudget();
  delete globalThis.PDA_httpGet;
  delete globalThis.PDA_httpPost;
  stubFetch(async () => new Response('{"ok":true}', { status: 200 }));
});

describe('CMP-010 the script talks to two hosts and no others', () => {
  test('the allowlist is exactly those two', () => {
    assert.deepEqual([...HOSTS], ['api.torn.com', 'www.torn-tracker.com']);
  });

  test('a request to www.torn.com is refused before it is made', async () => {
    let called = false;
    stubFetch(async () => {
      called = true;
      return new Response('');
    });
    await assert.rejects(() => request('https://www.torn.com/sidebarInfo.php'), HostNotAllowedError);
    assert.equal(called, false);
  });

  test('any other host is refused too', async () => {
    for (const url of ['https://example.com/x', 'https://yata.yt/api/v1/travel/export/', 'not a url']) {
      await assert.rejects(() => request(url), HostNotAllowedError);
    }
  });

  test('hostAllowed agrees', () => {
    assert.equal(hostAllowed(API), true);
    assert.equal(hostAllowed(SITE), true);
    assert.equal(hostAllowed('https://www.torn.com/'), false);
    assert.equal(hostAllowed('https://evil.torn-tracker.com.example/'), false);
  });
});

describe('CMP-013 the Torn API budget stays well under 100 a minute', () => {
  test('api.torn.com is capped far below the limit', () => {
    const left = budgetLeft('api.torn.com');
    assert.ok(left > 0 && left <= 50, `budget is ${left}`);
  });

  test('once the budget is spent the call is refused, not queued', async () => {
    const limit = budgetLeft('api.torn.com');
    for (let i = 0; i < limit; i += 1) await request(API);

    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      return new Response('{}');
    });
    const result = await request(API);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'budget');
    assert.equal(calls, 0);
  });

  test('the two hosts have their own budgets', async () => {
    const before = budgetLeft('www.torn-tracker.com');
    await request(API);
    assert.equal(budgetLeft('www.torn-tracker.com'), before);
  });
});

describe('CMP-023 the site being unreachable is not an error a feature must handle', () => {
  test('a network failure comes back as a result', async () => {
    stubFetch(async () => {
      throw Object.assign(new Error('offline'), { name: 'TypeError' });
    });
    const result = await request(SITE);
    assert.deepEqual({ ok: result.ok, status: result.status, data: result.data }, { ok: false, status: 0, data: null });
  });

  test('a non-JSON body leaves data null without throwing', async () => {
    stubFetch(async () => new Response('<html>502</html>', { status: 502 }));
    const result = await request(SITE);
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
    assert.equal(result.data, null);
    assert.match(result.text, /502/);
  });

  test('a JSON body is parsed', async () => {
    stubFetch(async () => new Response('{"prices":{"1":500}}', { status: 200 }));
    const result = await request(SITE);
    assert.equal(result.ok, true);
    assert.deepEqual(result.data, { prices: { 1: 500 } });
  });

  test('cookies are never sent: the script key is the only credential', async () => {
    let init = null;
    stubFetch(async (url, options) => {
      init = options;
      return new Response('{}');
    });
    await request(SITE, { headers: { Authorization: 'Bearer tt_feed_test' } });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.headers.Authorization, 'Bearer tt_feed_test');
  });
});

describe('CMP-007 Torn PDA\'s helpers are used when PDA provides them', () => {
  test('a GET goes through PDA_httpGet instead of fetch', async () => {
    let fetched = false;
    stubFetch(async () => {
      fetched = true;
      return new Response('{}');
    });
    const seen = [];
    globalThis.PDA_httpGet = async (url, headers) => {
      seen.push([url, headers]);
      return { status: 200, responseText: '{"via":"pda"}' };
    };

    const result = await request(SITE, { headers: { Authorization: 'Bearer tt_feed_test' } });
    assert.equal(fetched, false);
    assert.deepEqual(result.data, { via: 'pda' });
    assert.equal(seen[0][0], `${SITE}&ttc_v=0.0.0-dev&ttc_p=pda`);
    assert.equal(seen[0][1].Authorization, 'Bearer tt_feed_test');
  });

  test('a POST goes through PDA_httpPost', async () => {
    const seen = [];
    globalThis.PDA_httpPost = async (url, headers, body) => {
      seen.push(body);
      return { status: 201, responseText: '{"accepted":1}' };
    };
    const result = await request(SITE, { method: 'POST', body: '{"batch":[]}' });
    assert.equal(result.status, 201);
    assert.deepEqual(seen, ['{"batch":[]}']);
  });

  test('a PDA build that names the body differently still works', async () => {
    globalThis.PDA_httpGet = async () => ({ statusCode: 200, body: '{"via":"other"}' });
    const result = await request(SITE);
    assert.deepEqual(result.data, { via: 'other' });
  });
});

describe('GDE-008 every torn-tracker.com request says the version and the platform (hq #233)', () => {
  test('desktop or PDA, and the script version, as query parameters', () => {
    assert.equal(tagged('https://www.torn-tracker.com/api/feeds/me/sidebar', {}),
      'https://www.torn-tracker.com/api/feeds/me/sidebar?ttc_v=0.0.0-dev&ttc_p=desktop');
    assert.equal(tagged(SITE, { PDA_httpGet: () => {} }), `${SITE}&ttc_v=0.0.0-dev&ttc_p=pda`);
  });

  test('Torn’s API is never told anything about the script', () => {
    assert.equal(tagged(API, {}), API);
  });

  test('a fetch carries it too', async () => {
    let asked = null;
    stubFetch(async (url) => {
      asked = url;
      return new Response('{}');
    });
    await request(SITE);
    assert.match(asked, /&ttc_v=[^&]+&ttc_p=desktop$/);
  });
});
