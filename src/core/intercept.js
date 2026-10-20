// Reads the JSON that the page itself asked for (CMP-006).
//
// Torn renders much of what we want from its own fetch and XHR responses. Observing them
// is still "the page the player loaded": we never issue a request, never change one, and
// never alter a response. The wrappers hand back exactly what the page would have got,
// and the rules lint and a byte-equal test both hold this file to that (CMP-030).

import { warn } from './log.js';

/** @type {Set<{test: (url: string) => boolean, handler: Function}>} */
const subscribers = new Set();

let originals = null;
let target = null;

const MARK = '__ttcIntercept';

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
  for (const sub of [...subscribers]) {
    let wanted = false;
    try {
      wanted = sub.test(url);
    } catch { /* a bad predicate is not the page's problem */ }
    if (!wanted) continue;
    try {
      sub.handler({ url, method, data, form });
    } catch (err) {
      warn('interceptor threw', err);
    }
  }
}

function anyWants(url) {
  for (const sub of subscribers) {
    try {
      if (sub.test(url)) return true;
    } catch { /* ignore */ }
  }
  return false;
}

export function install(win = globalThis) {
  if (originals && target === win) return;
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
}

function observeFetch(args, promise, win) {
  const url = urlOf(args[0]);
  if (!url || !anyWants(url)) return;
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
      if (!anyWants(info.url)) return;
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
export function onJson(test, handler, win = globalThis) {
  install(win);
  const sub = { test, handler };
  subscribers.add(sub);
  return () => subscribers.delete(sub);
}

/** Puts the page's own fetch and XHR back. Tests use it; the script never does. */
export function uninstall() {
  if (!originals || !target) return;
  if (originals.fetch) target.fetch = originals.fetch;
  const xhr = target.XMLHttpRequest?.prototype;
  if (xhr && originals.open) xhr.open = originals.open;
  if (xhr && originals.send) xhr.send = originals.send;
  subscribers.clear();
  originals = null;
  target = null;
}
