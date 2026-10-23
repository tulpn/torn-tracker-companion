// The settings route: /index.php#/torn-tracker (CMP-107 as reworked, 2026-10-23).
//
// The settings are a page inside Torn rather than a popup. On Torn's home page (`/` or
// /index.php) with the hash #/torn-tracker, or #/torn-tracker/<section>, the script:
//   - sets the body class `ttc-page`;
//   - hides Torn's own children of the main column with CSS only, never removing or
//     changing them;
//   - puts the settings page in their place, inside a Shadow DOM host, so Torn's styles
//     and ours don't leak into each other.
// Torn's header, sidebar and chat stay as they are. Leaving the route (any link, Back, or
// the page's own Close) takes the host out and the class off, and Torn's home page is
// back as it was. Arriving here is the player's own navigation: nothing is requested.
//
// The router (core/router.js) reports every hash change, so Back and Forward work.

const P = 'ttc';
export const HOST_ID = `${P}-page-host`;
export const BODY_CLASS = `${P}-page`;
/** Torn's main column, then the container around it if a page has no wrapper. */
const COLUMNS = ['#mainContainer .content-wrapper', '#mainContainer'];

/**
 * The section the location asks for: '' for the route's root, a name for a section, or
 * null when the location isn't the settings route at all.
 * @param {{pathname: string, hash: string}} loc
 */
export function routeOf(loc) {
  if (!['/', '/index.php'].includes(loc?.pathname)) return null;
  const match = /^#\/torn-tracker(?:\/([a-z-]*))?\/?$/.exec(loc.hash || '');
  return match ? match[1] || '' : null;
}

const hideRule = (column) => `body.${BODY_CLASS} ${column} > :not(#${HOST_ID}) { display: none !important; }`;

/**
 * @param {object} opts
 * @param {Document} opts.doc
 * @param {(root: ShadowRoot) => void} opts.fill    puts the settings page in the host, once
 * @param {(section: string) => void} opts.onEnter  the route opened, or moved to another section
 * @param {() => void} opts.onLeave
 */
export function mountPage({ doc = globalThis.document, fill, onEnter, onLeave }) {
  const host = doc.createElement('div');
  host.id = HOST_ID;
  host.dataset.ttcOwn = '';
  const root = host.attachShadow({ mode: 'open' });
  fill(root);
  let open = false;
  let column = null;

  const style = doc.createElement('style');
  style.id = `${P}-page-style`;

  function enter(section) {
    column = COLUMNS.find((selector) => doc.querySelector(selector)) ?? null;
    const parent = column ? doc.querySelector(column) : doc.body;
    style.textContent = column ? hideRule(column) : '';
    if (!style.isConnected) doc.head.append(style);
    if (host.parentElement !== parent) parent.prepend(host);
    doc.body.classList.add(BODY_CLASS);
    open = true;
    onEnter(section);
  }

  function leave() {
    if (!open) return;
    open = false;
    host.remove();
    style.remove();
    doc.body.classList.remove(BODY_CLASS);
    onLeave();
  }

  return {
    host,
    root,
    isOpen: () => open,
    /** Called with every location the router reports. */
    update(loc) {
      const section = routeOf(loc);
      if (section === null) leave();
      else enter(section);
    },
    /** Torn redrew its main column and took the host with it: put it back. */
    restore() {
      if (open && !host.isConnected) enter(null);
    },
    destroy() {
      leave();
    },
  };
}
