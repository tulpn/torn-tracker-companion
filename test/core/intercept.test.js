// The page's own responses may be read. They may never be changed, and we may never
// make a request of our own (CMP-006, CMP-030).

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { formOf, install, onJson, uninstall } from '../../src/core/intercept.js';

const BODY = JSON.stringify({ items: [{ id: 1, quantity: 7, cost: 500 }] });

/** A window just real enough: the page's fetch, and an XHR we can finish by hand. */
function fakeWindow({ body = BODY, status = 200 } = {}) {
  const calls = [];
  class FakeXHR extends EventTarget {
    constructor() {
      super();
      this.responseType = '';
      this.responseText = '';
      this.sent = [];
    }

    open(method, url) {
      this.method = method;
      this.url = url;
    }

    send(payload) {
      this.sent.push(payload ?? null);
    }

    finish(text) {
      this.responseText = text;
      this.dispatchEvent(new Event('loadend'));
    }
  }
  return {
    calls,
    XMLHttpRequest: FakeXHR,
    async fetch(url, init) {
      calls.push([url, init]);
      return new Response(body, { status, headers: { 'content-type': 'application/json' } });
    },
  };
}

afterEach(uninstall);

describe('CMP-006 responses are read, never altered', () => {
  test('the page gets its response back byte for byte', async () => {
    const win = fakeWindow();
    const original = win.fetch;
    install(win);
    const seen = [];
    onJson(() => true, (event) => seen.push(event), win);

    const response = await win.fetch('https://www.torn.com/page.php?sid=travel');
    assert.equal(await response.text(), BODY);
    assert.equal(response.status, 200);

    await new Promise((r) => setTimeout(r, 5));
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0].data, JSON.parse(BODY));
    assert.notEqual(win.fetch, original, 'the wrapper should be in place');
  });

  test('the page\'s own arguments reach its fetch untouched', async () => {
    const win = fakeWindow();
    install(win);
    const init = { method: 'POST', body: 'a=1' };
    await win.fetch('https://www.torn.com/x.php', init);
    assert.deepEqual(win.calls[0][0], 'https://www.torn.com/x.php');
    assert.equal(win.calls[0][1], init);
  });

  test('only matching URLs are delivered', async () => {
    const win = fakeWindow();
    install(win);
    const seen = [];
    onJson((url) => url.includes('travel'), (event) => seen.push(event), win);
    await win.fetch('https://www.torn.com/item.php');
    await win.fetch('https://www.torn.com/travel.php');
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(seen.map((e) => e.url), ['https://www.torn.com/travel.php']);
  });

  test('a response that is not JSON is simply not delivered', async () => {
    const win = fakeWindow({ body: '<html>no</html>' });
    install(win);
    const seen = [];
    onJson(() => true, (event) => seen.push(event), win);
    await win.fetch('https://www.torn.com/x.php');
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(seen, []);
  });

  test('a subscriber that throws does not break the page\'s request', async () => {
    const win = fakeWindow();
    install(win);
    onJson(() => true, () => {
      throw new Error('bad handler');
    }, win);
    const response = await win.fetch('https://www.torn.com/x.php');
    assert.equal(await response.text(), BODY);
  });

  test('XHR responses are read without touching the request', () => {
    const win = fakeWindow();
    install(win);
    const seen = [];
    onJson((url) => url.includes('sidebar'), (event) => seen.push(event), win);

    const request = new win.XMLHttpRequest();
    request.open('GET', 'https://www.torn.com/sidebarInfo.php');
    request.send('payload');
    request.finish(BODY);

    assert.deepEqual(request.sent, ['payload']);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].method, 'GET');
    assert.deepEqual(seen[0].data, JSON.parse(BODY));
  });

  test('the form fields of the request come along, read from its body without touching it', async () => {
    const win = fakeWindow();
    install(win);
    const seen = [];
    onJson(() => true, (event) => seen.push(event), win);

    const body = new FormData();
    body.append('typeID', '7');
    body.append('crimeID', '42');
    const init = { method: 'POST', body };
    await win.fetch('https://www.torn.com/page.php?sid=crimesData&step=attempt', init);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(win.calls[0][1].body, body, 'the body object the page gave goes through');
    assert.deepEqual([...body.entries()], [['typeID', '7'], ['crimeID', '42']], 'and is still whole');
    assert.equal(seen[0].form.get('typeID'), '7');

    const request = new win.XMLHttpRequest();
    request.open('POST', 'https://www.torn.com/x.php');
    request.send('a=1&b=2');
    request.finish(BODY);
    assert.deepEqual(request.sent, ['a=1&b=2']);
    assert.equal(seen[1].form.get('b'), '2');
  });

  test('only a form is a form: JSON, streams and nothing are not', () => {
    assert.equal(formOf('{"a":1}'), null);
    assert.equal(formOf(undefined), null);
    assert.equal(formOf(new Blob(['a=1'])), null);
    assert.equal(formOf(new URLSearchParams('x=1')).get('x'), '1');
    const data = new FormData();
    data.append('file', new Blob(['x']), 'f.txt');
    data.append('k', 'v');
    assert.deepEqual([...formOf(data).entries()], [['k', 'v']]);
  });

  test('unsubscribing stops delivery', async () => {
    const win = fakeWindow();
    install(win);
    const seen = [];
    const off = onJson(() => true, (event) => seen.push(event), win);
    off();
    await win.fetch('https://www.torn.com/x.php');
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(seen, []);
  });

  test('uninstall puts the page\'s own fetch and XHR back', async () => {
    const win = fakeWindow();
    const originalFetch = win.fetch;
    const originalOpen = win.XMLHttpRequest.prototype.open;
    install(win);
    uninstall();
    assert.equal(win.fetch, originalFetch);
    assert.equal(win.XMLHttpRequest.prototype.open, originalOpen);
  });
});

describe('CMP-030 the interceptor only observes', () => {
  test('its source issues no request of its own', () => {
    const source = fs.readFileSync(new URL('../../src/core/intercept.js', import.meta.url), 'utf8');
    // The only calls are through the originals it captured.
    assert.ok(!/\boriginal\s*\(\s*['"`]http/.test(source));
    assert.ok(!/new\s+(win\.)?XMLHttpRequest\s*\(/.test(source), 'it must not create requests');
    assert.ok(!/sendBeacon|new Image/.test(source));
  });
});
