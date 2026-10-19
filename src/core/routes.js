// Route keys (CMP-005).
//
// A feature declares the pages it belongs on as strings matched against the location the
// player is already on. The matcher never changes the location and never navigates.
//
//   '*'                      every page
//   'factions.php'           that page, whatever the query or hash
//   'factions.php#/war/'     that page, hash starting with /war/
//   'loader.php?sid=attack'  that page, with sid=attack among the query parameters
//   '#/war/'                 any page whose hash starts with /war/

/** '/factions.php' -> 'factions.php', '/' -> '' */
function pageOf(pathname) {
  const path = String(pathname || '');
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * @param {string} route  a route key
 * @param {{pathname: string, search: string, hash: string}} loc
 */
export function matchRoute(route, loc) {
  if (typeof route !== 'string' || route === '') return false;
  if (route === '*') return true;

  const cut = route.indexOf('#');
  const head = cut === -1 ? route : route.slice(0, cut);
  const wantHash = cut === -1 ? null : route.slice(cut + 1);

  if (head) {
    const [wantPage, wantQuery] = head.split('?');
    if (wantPage && pageOf(wantPage) !== pageOf(loc.pathname)) return false;
    if (wantQuery) {
      const have = new URLSearchParams(String(loc.search || ''));
      for (const [key, value] of new URLSearchParams(wantQuery)) {
        if (have.get(key) !== value) return false;
      }
    }
  }

  if (wantHash !== null) {
    const hash = String(loc.hash || '').replace(/^#/, '');
    if (!hash.startsWith(wantHash)) return false;
  }

  return true;
}

export function matchesAny(routes, loc) {
  return Array.isArray(routes) && routes.some((route) => matchRoute(route, loc));
}
