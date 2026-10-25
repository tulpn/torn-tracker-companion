// Which player a page or a link is about (CMP-006: one place to fix when Torn changes).

/** Torn's attack page, under both addresses it is reached by. */
export const ATTACK_ROUTES = Object.freeze(['page.php?sid=attack', 'loader.php?sid=attack']);
const SUBJECT_PAGES = Object.freeze(['profiles.php', 'page.php', 'loader.php']);

const positive = (n) => (Number.isInteger(n) && n > 0 ? n : null);

/** The player id in a profile link, or null. */
export function idFromHref(href) {
  const m = /[?&]XID=(\d+)/.exec(String(href || ''));
  return m ? Number(m[1]) : null;
}

/** The player a profile (`XID`) or attack page (`user2ID`) is about, or null. */
export function pageSubject(loc) {
  const params = new URLSearchParams(String(loc?.search || ''));
  return positive(Number(params.get('XID') || params.get('user2ID')));
}

/** Whether the location is a profile or the attack page. */
export function onSubjectPage(loc) {
  return SUBJECT_PAGES.includes(String(loc?.pathname || '').split('/').pop());
}
