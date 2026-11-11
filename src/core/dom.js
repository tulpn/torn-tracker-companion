// Shared DOM reads and the nodes we add (CMP-006).
//
// Reading: attributes first (data-*, href ids, aria-label), text only through the readers
// below, which return null rather than guess. A Torn redesign should be a change to one
// feature's selectors.js, not a hunt through the codebase.
//
// Writing: we add our own nodes beside Torn's, built with createElement and textContent.
// Never innerHTML, and never rewriting the text of Torn's own nodes.

const handlers = new Set();
let observer = null;
let observed = null;

function ensureObserver(doc) {
  const root = doc?.body || doc?.documentElement;
  if (!root) return;
  if (observer && observed === root) return;
  observer?.disconnect();
  observed = root;
  observer = new doc.defaultView.MutationObserver((records) => {
    for (const handler of [...handlers]) {
      try {
        handler(records);
      } catch { /* one subscriber's fault is not another's */ }
    }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
}

/**
 * Subscribe to page changes. One MutationObserver serves every caller.
 * @returns {() => void} unsubscribe
 */
export function onMutation(handler, doc = globalThis.document) {
  ensureObserver(doc);
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) {
      observer?.disconnect();
      observer = null;
      observed = null;
    }
  };
}

/**
 * Runs `fn` once the page has been quiet for `ms`, and never later than `maxMs` after
 * the first change, however busy the page stays (hq #466). A plain "wait for quiet" is
 * put off for ever by anything that keeps changing: Torn's clock, a chat, another
 * script's counter. That kept the sidebar block from ever being placed beside The
 * Contract, and kept a capture from ever reading the page it was on.
 * @param {() => void} fn
 * @param {number} ms
 * @param {{timers?: {setTimeout: Function, clearTimeout: Function}, maxMs?: number}} [opts]
 * @returns {{poke: () => void, cancel: () => void}}
 */
export function settler(fn, ms, { timers = globalThis, maxMs = Math.max(ms * 3, 1000) } = {}) {
  let quiet = null;
  let deadline = null;
  const cancel = () => {
    if (quiet !== null) timers.clearTimeout(quiet);
    if (deadline !== null) timers.clearTimeout(deadline);
    quiet = null;
    deadline = null;
  };
  const fire = () => {
    cancel();
    fn();
  };
  return {
    poke() {
      if (quiet !== null) timers.clearTimeout(quiet);
      quiet = timers.setTimeout(fire, ms);
      if (deadline === null) deadline = timers.setTimeout(fire, Math.max(maxMs, ms));
    },
    cancel,
  };
}

/**
 * Whether a mutation is only our own doing: it happened inside one of our nodes, or it
 * only added or removed our nodes. A removed node has no ancestors left, so closest()
 * can't place it; it's judged by itself. Every observer uses this, so a re-render of our
 * own content is never mistaken for Torn's and never wakes us again (a loop that kept
 * the page busy, found on the owner's capture of 2026-10-23).
 * @param {MutationRecord} record
 * @param {string} selector  what our nodes match
 */
export function ownChange(record, selector) {
  const own = (n) => Boolean((n.nodeType === 1 ? n : n.parentElement)?.closest?.(selector));
  const moved = [...record.addedNodes, ...record.removedNodes];
  return own(record.target) || (moved.length > 0 && moved.every(own));
}

/** Drops the shared observer. Tests use it between cases. */
export function resetObserver() {
  handlers.clear();
  observer?.disconnect();
  observer = null;
  observed = null;
}

/**
 * Resolves with the first matching element, or null when the timeout passes.
 * Torn renders much of a page after load, so most reads start here.
 */
export function waitFor(selector, { root = globalThis.document, timeout = 10000 } = {}) {
  const found = root.querySelector(selector);
  if (found) return Promise.resolve(found);

  return new Promise((resolve) => {
    const doc = root.ownerDocument || root;
    const view = doc.defaultView || globalThis;
    let done = false;

    const finish = (value) => {
      if (done) return;
      done = true;
      unsubscribe();
      view.clearTimeout(timer);
      resolve(value);
    };

    const timer = view.setTimeout(() => finish(null), timeout);
    const unsubscribe = onMutation(() => {
      const node = root.querySelector(selector);
      if (node) finish(node);
    }, doc);
  });
}

/**
 * Fields the browser would offer saved values on. Every one we build has autocomplete off
 * (hq #850): no suggestions while typing, and a key field never offered to the password
 * manager as a Torn password. The rules lint keeps them all coming through here.
 */
const NO_AUTOCOMPLETE = new Set(['input', 'textarea', 'form']);

/** Builds an element. Children are text nodes or elements, never parsed markup. */
export function el(tag, attrs, ...children) {
  const doc = attrs?.ownerDocument || globalThis.document;
  const node = doc.createElement(tag);
  if (NO_AUTOCOMPLETE.has(String(tag).toLowerCase())) node.setAttribute('autocomplete', 'off');
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false || key === 'ownerDocument') continue;
    if (key === 'checked' || key === 'selected' || key === 'hidden' || key === 'disabled') node[key] = value;
    else if (key === 'value') node.value = String(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(typeof child === 'object' ? child : doc.createTextNode(String(child)));
  }
  return node;
}

// ---------------------------------------------------------------- text readers
// Each returns null when the text is not exactly what it claims to be. A feature that
// gets null shows "?" and never a guess.

/** '1,234' -> 1234; 'Level 5' -> null */
export function readInt(text) {
  const trimmed = String(text ?? '').replace(/[\s,]/g, '');
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** '$1,234' -> 1234; '2.5m' -> 2500000; 'free' -> null */
export function readMoney(text) {
  const trimmed = String(text ?? '').replace(/[\s,]/g, '').replace(/^\$/, '');
  const m = /^(-?\d+(?:\.\d+)?)([kmb])?$/i.exec(trimmed);
  if (!m) return null;
  const scale = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] ?? 1;
  return Math.round(Number(m[1]) * scale);
}

const oneDecimal = (n) => n.toFixed(1).replace(/\.0$/, '');

/**
 * Short money for a line: $950, $13.5k, $1.2m, $2.5b. 999,999 reads "$1m", never
 * "$1000k" (hq #845); readMoney reads it back.
 */
export function shortMoney(n) {
  if (n < 1e3) return `$${n}`;
  const k = oneDecimal(n / 1e3);
  if (Number(k) < 1e3) return `$${k}k`;
  const m = oneDecimal(n / 1e6);
  if (Number(m) < 1e3) return `$${m}m`;
  return `$${oneDecimal(n / 1e9)}b`;
}

/** '1h 23m', '23:45', '01:02:03' -> seconds; anything else -> null */
export function readDuration(text) {
  const trimmed = String(text ?? '').trim().toLowerCase();
  if (!trimmed) return null;

  if (/^\d+(:\d{2}){1,2}$/.test(trimmed)) {
    return trimmed.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  }

  const units = { d: 86400, h: 3600, m: 60, s: 1 };
  let seconds = 0;
  let matched = false;
  const rest = trimmed.replace(/(\d+)\s*([dhms])/g, (_, value, unit) => {
    matched = true;
    seconds += Number(value) * units[unit];
    return '';
  });
  // Anything left over means we read something we did not understand.
  return matched && rest.trim() === '' ? seconds : null;
}
