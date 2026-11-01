// The page's own window (D-161, hq #448).
//
// The header grants the script manager's request, so Tampermonkey and Violentmonkey run
// the script in their sandbox, where `window` is the manager's wrapper. Torn's own fetch,
// XMLHttpRequest and history live on the page's window, which the manager hands over as
// `unsafeWindow`. Torn PDA ignores grants and injects into the page, so there, and in the
// tests, the page's window is simply the global one.
//
// The DOM, localStorage, events and timers are the same either way; only what the page
// calls (fetch, XHR, history) has to be reached through here.

/* global unsafeWindow */

export function pageWindow(fallback = globalThis) {
  try {
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow) return unsafeWindow;
  } catch { /* a manager that throws on the lookup: stay in our own window */ }
  return fallback;
}
