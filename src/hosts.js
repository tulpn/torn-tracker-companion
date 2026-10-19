// The only hosts this script may ever contact (CMP-010).
//
// The userscript header's @connect list and core/net.js both read this file, so the
// promise in the header and the code that makes requests cannot drift apart. The rules
// lint checks every URL literal in the bundle against it.
//
// www.torn.com is deliberately absent: the script reads the page the player opened and
// never requests a torn.com page of its own (CMP-030).

export const HOSTS = Object.freeze(['api.torn.com', 'www.torn-tracker.com']);

export const TORN_API = 'https://api.torn.com';
export const SITE = 'https://www.torn-tracker.com';

/**
 * True when the URL's host is one we are allowed to contact. The URL must be absolute:
 * resolving a relative one against a base would let any path through, and a request
 * target is never implicit here.
 */
export function hostAllowed(url) {
  try {
    return HOSTS.includes(new URL(url).host);
  } catch {
    return false;
  }
}
