// Reads the JSON that the page itself asked for (CMP-006).
//
// Torn renders much of what we want from its own fetch and XHR responses. Observing them
// is still "the page the player loaded": we never issue a request, never change one, and
// never alter a response. The wrappers hand back exactly what the page would have got,
// and the rules lint and a byte-equal test both hold this file to that (CMP-030).
//
// Whatever window a caller names, the one wrapped is the page's (hq #516): under a script
// manager a feature's `ctx.win` is the sandbox, whose fetch and XHR Torn never calls.
// With debug on, every response a feature wants is logged with how many took it, and each
// other address once, so the console shows whether the page's requests are seen at all.

import { log, warn } from './log.js';
import { pageWindow } from './page-window.js';

/** @type {Set<{test: (url: string) => boolean, handler: Function}>} */
const subscribers = new Set();

let originals = null;
let target = null;

const MARK = '__ttcIntercept';

/** Addresses seen that no feature wanted, logged once each (debug). */
const passedBy = new Set();

/** The address without its query, for the debug log: page.php?sid=… keeps its sid. */
function shortUrl(url) {
  try {
    const u = new URL(String(url), 'https://www.torn.com');
    const sid = u.searchParams.get('sid') || u.searchParams.get('step');
    return `${u.pathname}${sid ? `?${sid}` : ''}`;
  } catch {
    return '?';
  }
}

/** A response no feature wanted: one debug line per address. */
function passed(url) {
  const short = shortUrl(url);
  if (passedBy.has(short) || passedBy.size >= 200) return;
  passedBy.add(short);
  log(`intercept: ${short} seen, no feature wants it`);
}

/**
 * The request's form fields, read from its body without touching it: a form-encoded
 * string, URLSearchParams or FormData (text fields only). Anything else is no form.
 * Some pages send their ids in the body rather than the address.
 */
export function formOf(body, win = globalThis) {
  try {
    if (typeof body === 'string') return body.trim().startsWith('{') ? null : new URLSearchParams(body);
    if (body instanceof (win.URLSearchParams || URLSearchParams)) return new URLSearchParams(body);
    const FormDataType = win.FormData || globalThis.FormData;
    if (FormDataType && body instanceof FormDataType) {
      const form = new URLSearchParams();
      for (const [key, value] of body.entries()) if (typeof value === 'string') form.append(key, value);
      return form;
    }
  } catch { /* an odd body is no form */ }
  return null;
}

function deliver(url, method, data, form = null) {
  let taken = 0;
  for (const sub of [...subscribers]) {
    let wanted = false;
    try {
      wanted = sub.test(url);
    } catch { /* a bad predicate is not the page's problem */ }
    if (!wanted) continue;
    taken += 1;
    try {
      sub.handler({ url, method, data, form });
    } catch (err) {
      warn('interceptor threw', err);
    }
  }
  log(`intercept: ${shortUrl(url)} read, ${taken} feature(s) took it`);
}

function anyWants(url) {
  for (const sub of subscribers) {
    try {
      if (sub.test(url)) return true;
    } catch { /* ignore */ }
  }
  return false;
}

export function install(given = pageWindow()) {
  const win = pageWindow(given);
  if (originals && target === win) return;
  if (originals) uninstallWrappers();
  target = win;
  originals = { fetch: win.fetch, open: win.XMLHttpRequest?.prototype?.open, send: win.XMLHttpRequest?.prototype?.send };

  if (typeof originals.fetch === 'function') {
    const original = originals.fetch;
    win.fetch = function ttcFetch(...args) {
      const promise = original.apply(this, args);
      try {
        observeFetch(args, promise, win);
      } catch { /* never let observing break a page request */ }
      // The page gets the original promise, resolving to the original response.
      return promise;
    };
  }

  const xhr = win.XMLHttpRequest?.prototype;
  if (xhr && typeof originals.open === 'function') {
    const open = originals.open;
    xhr.open = function ttcOpen(method, url, ...rest) {
      try {
        this[MARK] = { method: String(method || 'GET'), url: String(url), form: null };
      } catch { /* a frozen XHR is fine, we just see less */ }
      return open.call(this, method, url, ...rest);
    };
  }
  if (xhr && typeof originals.send === 'function') {
    const send = originals.send;
    xhr.send = function ttcSend(body) {
      try {
        if (this[MARK]) this[MARK].form = formOf(body, win);
        observeXhr(this);
      } catch { /* as above */ }
      return send.call(this, body);
    };
  }
  log(`intercept: watching the ${win === given ? 'page' : 'page window (not the sandbox)'} fetch and XHR`);
}

function observeFetch(args, promise, win) {
  const url = urlOf(args[0]);
  if (!url) return;
  if (!anyWants(url)) {
    passed(url);
    return;
  }
  const method = String(args[1]?.method || args[0]?.method || 'GET');
  const form = formOf(args[1]?.body, win);
  Promise.resolve(promise)
    .then((response) => {
      // clone() throws once the page has read the body. Observation is best-effort:
      // missing one response is always better than racing the page for it.
      if (!response || typeof response.clone !== 'function' || response.bodyUsed) return null;
      return response.clone().json();
    })
    .then((data) => {
      if (data != null) deliver(url, method, data, form);
    })
    .catch(() => { /* not JSON, or already consumed */ });
}

function observeXhr(request) {
  const info = request[MARK];
  if (!info) return;
  request.addEventListener('loadend', () => {
    try {
      if (!anyWants(info.url)) {
        passed(info.url);
        return;
      }
      const type = request.responseType;
      let data = null;
      if (type === 'json') data = request.response;
      else if (type === '' || type === 'text') data = JSON.parse(request.responseText);
      if (data != null) deliver(info.url, info.method, data, info.form);
    } catch { /* not JSON; nothing to read */ }
  });
}

function urlOf(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input.url === 'string') return input.url;
  if (input && typeof input.href === 'string') return input.href;
  return null;
}

/**
 * Watch the page's own JSON responses.
 * @param {(url: string) => boolean} test
 * @param {(event: {url: string, method: string, data: unknown, form: URLSearchParams|null}) => void} handler
 * @returns {() => void} unsubscribe
 */
export function onJson(test, handler, win = pageWindow()) {
  // `win` may be the sandbox (a feature's ctx.win); install() moves to the page's.
  install(win);
  const sub = { test, handler };
  subscribers.add(sub);
  return () => subscribers.delete(sub);
}

function uninstallWrappers() {
  if (originals.fetch) target.fetch = originals.fetch;
  const xhr = target.XMLHttpRequest?.prototype;
  if (xhr && originals.open) xhr.open = originals.open;
  if (xhr && originals.send) xhr.send = originals.send;
  originals = null;
  target = null;
}

/** Puts the page's own fetch and XHR back. Tests use it; the script never does. */
export function uninstall() {
  subscribers.clear();
  passedBy.clear();
  if (!originals || !target) return;
  uninstallWrappers();
}
