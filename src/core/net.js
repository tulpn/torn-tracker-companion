// Every request the script makes goes through here (CMP-007, CMP-010, CMP-013).
//
// Two hosts, and no others: hosts.js holds the list that the header's @connect is built
// from. Three transports, in this order (D-161, hq #448):
//   - Torn PDA's cross-origin helpers, when PDA provides them (PDA ignores grants);
//   - the script manager's request (GM_xmlhttpRequest or GM.xmlHttpRequest), which the
//     manager makes outside the page, so torn.com's Content Security Policy, whose
//     connect-src names only torn.com and api.torn.com, does not apply; @connect does;
//   - the page's fetch, only when neither exists (it is refused on torn.com itself).
// Callers do not care which.
//
// Nothing here ever reaches www.torn.com. The page's own requests are observed in
// intercept.js and never repeated.

import { HOSTS, SITE, hostAllowed } from '../hosts.js';
import { log, warn } from './log.js';
import { onPda } from './keys.js';
import { VERSION } from './version.js';

/**
 * Whether torn-tracker.com refused the player's account: a ban (ADM-061, ADM-068). The
 * site says no more than that, and the script shows no more.
 */
export function accountBanned(result) {
  return result?.status === 403 && result.data?.error === 'account_banned';
}

/**
 * Whether torn-tracker.com refused the script key itself: a 401, a 403 because the key
 * lacks a scope (CAPI-020), or a ban. Every other 403 (not a director, no faction, Pro
 * only) answers one read and says nothing about the key.
 */
export function keyRefused(result) {
  if (result?.status === 401 || accountBanned(result)) return true;
  return result?.status === 403 && /\blacks the \S+ scope\b/.test(String(result.data?.detail ?? ''));
}

export class HostNotAllowedError extends Error {
  constructor(url) {
    super(`refusing a request to a host outside @connect: ${url}`);
    this.name = 'HostNotAllowedError';
  }
}

// Torn allows 100 calls a minute per user across every script they run, so we stay well
// under half of it and leave room for the player's other tools (CMP-013).
const BUDGETS = {
  'api.torn.com': { limit: 40, windowMs: 60_000 },
  'www.torn-tracker.com': { limit: 120, windowMs: 60_000 },
};

/** @type {Map<string, number[]>} host -> timestamps of recent calls */
const recent = new Map();

function prune(host, now) {
  const budget = BUDGETS[host];
  const times = (recent.get(host) || []).filter((t) => now - t < budget.windowMs);
  recent.set(host, times);
  return times;
}

export function budgetLeft(host, now = Date.now()) {
  if (!BUDGETS[host]) return 0;
  return BUDGETS[host].limit - prune(host, now).length;
}

function take(host, now = Date.now()) {
  if (budgetLeft(host, now) <= 0) return false;
  recent.get(host).push(now);
  return true;
}

/** Tests start from a clean budget. */
export function resetBudget() {
  recent.clear();
}

/** 'pda' inside Torn PDA, 'desktop' anywhere else: the only thing said about the device. */
export function platform(win = globalThis) {
  return onPda(win) ? 'pda' : 'desktop';
}

/**
 * Every request to torn-tracker.com says which version of the script asks and whether
 * it runs in Torn PDA or a browser (GDE-008, hq #233), so the guide's second-device step
 * can tick itself. Query parameters rather than a header: a server that doesn't know them
 * ignores them, and they never change a browser's CORS preflight. Torn's API is never
 * told anything about us.
 */
export function tagged(url, win = globalThis) {
  if (!url.startsWith(`${SITE}/`)) return url;
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}ttc_v=${encodeURIComponent(VERSION)}&ttc_p=${platform(win)}`;
}

/* global GM, GM_xmlhttpRequest */

/** The script manager's request function, or null outside a manager that granted it. */
export function gmTransport(scope = globalThis) {
  try {
    const legacy = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : scope.GM_xmlhttpRequest;
    if (typeof legacy === 'function') return legacy;
    const gm = typeof GM !== 'undefined' ? GM : scope.GM;
    if (gm && typeof gm.xmlHttpRequest === 'function') return (details) => gm.xmlHttpRequest(details);
  } catch { /* a manager that throws on the lookup has none to give */ }
  return null;
}

function pdaTransport(method) {
  const fn = method === 'GET' ? globalThis.PDA_httpGet : globalThis.PDA_httpPost;
  return typeof fn === 'function' ? fn : null;
}

// Torn PDA's helpers have varied across versions in what they name the body and the
// status; read whichever is there rather than assume one shape. Confirmed on a device as
// part of the release checklist.
function normalizePda(res) {
  const status = Number(res?.status ?? res?.statusCode ?? 0) || 0;
  const text = res?.responseText ?? res?.body ?? res?.text ?? '';
  const headers = res?.headers && typeof res.headers === 'object' ? res.headers : {};
  const retryAfter = headers['retry-after'] ?? headers['Retry-After'] ?? null;
  return {
    status,
    text: typeof text === 'string' ? text : JSON.stringify(text),
    retryAfter: retryAfter == null ? null : String(retryAfter),
  };
}

/**
 * @param {string} url  absolute, on an allowed host
 * @param {object} [opts]
 * @param {boolean} [opts.keepalive]  let the request outlive the page (the pagehide flush);
 *        for the page's fetch only: the manager's request outlives the page by itself,
 *        and PDA's helpers have no such thing
 * @returns {Promise<{ok: boolean, status: number, text: string, data: unknown,
 *          retryAfter: string|null, error: string|null}>}
 *          Network trouble is a result, never a throw: a feature must keep working when
 *          the site is unreachable (CMP-023). A disallowed host is a bug and does throw.
 */
export async function request(url, {
  method = 'GET', headers = {}, body = null, timeout = 15_000, keepalive = false,
} = {}) {
  if (!hostAllowed(url)) throw new HostNotAllowedError(url);
  const host = new URL(url).host;

  if (!take(host)) {
    warn('call budget spent for', host);
    return { ok: false, status: 0, text: '', data: null, retryAfter: null, error: 'budget' };
  }

  const verb = String(method).toUpperCase();
  const sent = tagged(url);
  try {
    const pda = pdaTransport(verb);
    const gm = pda ? null : gmTransport();
    let reply;
    if (pda) reply = normalizePda(await pda(sent, headers, body));
    else if (gm) reply = await viaGm(gm, sent, { method: verb, headers, body, timeout });
    else reply = await viaFetch(sent, { method: verb, headers, body, timeout, keepalive });
    const { status, text, retryAfter } = reply;

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch { /* not JSON; callers that wanted JSON see data === null */ }

    log(verb, url, status);
    return { ok: status >= 200 && status < 300, status, text, data, retryAfter, error: null };
  } catch (err) {
    warn('request failed', url, err && err.name);
    return { ok: false, status: 0, text: '', data: null, retryAfter: null, error: err?.name || 'error' };
  }
}

/** Retry-After out of the raw header block the manager hands back. */
export function retryAfterOf(rawHeaders) {
  const match = /^retry-after:\s*(.+?)\s*$/im.exec(String(rawHeaders ?? ''));
  return match ? match[1] : null;
}

// The manager's request outlives the page by itself, so the pagehide flush needs no
// keepalive here. `anonymous` is the manager's word for credentials: 'omit'.
function viaGm(gm, url, { method, headers, body, timeout }) {
  return new Promise((resolve, reject) => {
    const fail = (name) => () => {
      const err = new Error(`the request ${name}`);
      err.name = name === 'timed out' ? 'TimeoutError' : 'NetworkError';
      reject(err);
    };
    try {
      const pending = gm({
        method,
        url,
        headers,
        data: body ?? undefined,
        timeout,
        anonymous: true,
        responseType: 'text',
        onload: (res) => resolve({
          status: Number(res?.status) || 0,
          text: typeof res?.responseText === 'string' ? res.responseText : '',
          retryAfter: retryAfterOf(res?.responseHeaders),
        }),
        onerror: fail('failed'),
        ontimeout: fail('timed out'),
        onabort: fail('was aborted'),
      });
      // GM.xmlHttpRequest also returns a promise; its rejection is the onerror above.
      pending?.catch?.(() => {});
    } catch (err) {
      reject(err);
    }
  });
}

async function viaFetch(url, { method, headers, body, timeout, keepalive }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await globalThis.fetch(url, {
      method,
      headers,
      body,
      // Never send Torn's or the site's cookies: the script key is the only credential.
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      keepalive,
      signal: controller.signal,
    });
    return {
      status: response.status,
      text: await response.text(),
      retryAfter: response.headers?.get?.('Retry-After') ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export { HOSTS };
