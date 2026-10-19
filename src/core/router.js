// Watches where the player is (CMP-005).
//
// Torn navigates inside a page as often as it loads a new one, so a hash change or a
// pushState has to count as arriving somewhere. This module observes those; it never
// calls pushState itself and never changes the location. It is the only file allowed to
// wrap history.pushState, and the rules lint enforces that by path (CMP-030).

const EVENTS = ['hashchange', 'popstate'];

/**
 * @param {(loc: {pathname: string, search: string, hash: string}) => void} onNavigate
 *        called once immediately, then after every navigation
 * @param {object} [win]
 * @returns {() => void} stop
 */
export function startRouter(onNavigate, win = globalThis) {
  const history = win.history;
  const wrapped = [];
  let timer = null;
  let stopped = false;

  const notify = () => {
    if (stopped) return;
    win.clearTimeout(timer);
    // Torn fires several of these in a row; one run per settled location is enough.
    timer = win.setTimeout(() => {
      if (!stopped) onNavigate(win.location);
    }, 0);
  };

  for (const name of EVENTS) win.addEventListener(name, notify);

  for (const name of ['pushState', 'replaceState']) {
    const original = history?.[name];
    if (typeof original !== 'function') continue;
    const patched = function (...args) {
      const result = original.apply(this, args);
      notify();
      return result;
    };
    history[name] = patched;
    wrapped.push([name, original, patched]);
  }

  onNavigate(win.location);

  return function stop() {
    stopped = true;
    win.clearTimeout(timer);
    for (const name of EVENTS) win.removeEventListener(name, notify);
    // Only put ours back if nobody wrapped on top of it in the meantime.
    for (const [name, original, patched] of wrapped) {
      if (history[name] === patched) history[name] = original;
    }
  };
}
