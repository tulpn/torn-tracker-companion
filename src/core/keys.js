// The player's keys (CMP-008, CMP-011, CMP-012).
//
// Two keys, both optional, both kept only on this device:
//   - the script key (tt_feed_…), minted on torn-tracker.com. It is sent only to the
//     site's companion API, as a bearer token, and it is not a Torn API key;
//   - a Torn API key, used only against api.torn.com, by features that need the player's
//     own data. On Torn PDA the player may instead let PDA fill in its own key.
//
// Neither is ever logged or uploaded. Values from storage are checked against the key's
// shape and dropped if they do not fit.

import { KEYS, read, write } from './storage.js';

/** secrets.token_urlsafe(32) on the site gives 43 characters; allow some room. */
export const SCRIPT_KEY = /^tt_feed_[A-Za-z0-9_-]{32,64}$/;
export const API_KEY = /^[A-Za-z0-9]{16}$/;

// Torn PDA replaces this exact text with the player's key when it injects the script.
// Anywhere else it stays as written, fails the shape check, and is never used.
const PDA_KEY = '###PDA-APIKEY###';

export function emptyKeys() {
  return { script: '', api: '', usePdaKey: false };
}

export function normalizeKeys(raw) {
  const given = raw && typeof raw === 'object' ? raw : {};
  return {
    script: typeof given.script === 'string' && SCRIPT_KEY.test(given.script) ? given.script : '',
    api: typeof given.api === 'string' && API_KEY.test(given.api) ? given.api : '',
    usePdaKey: given.usePdaKey === true,
  };
}

/**
 * Checks what the player typed. Blank clears a key.
 * @returns {{keys: object} | {error: string}}
 */
export function checkTyped({ script = '', api = '', usePdaKey = false }) {
  const s = String(script).trim();
  const a = String(api).trim();
  if (s && !SCRIPT_KEY.test(s)) {
    return { error: API_KEY.test(s)
      ? 'That looks like a Torn API key. The script key comes from torn-tracker.com and starts with tt_feed_.'
      : 'The script key starts with tt_feed_ and comes from your torn-tracker.com settings.' };
  }
  if (a && !API_KEY.test(a)) {
    return { error: a.startsWith('tt_feed_')
      ? 'That is a script key, not a Torn API key.'
      : 'A Torn API key is 16 letters and digits.' };
  }
  return { keys: { script: s, api: a, usePdaKey: usePdaKey === true } };
}

export async function loadKeys() {
  return normalizeKeys(await read(KEYS.keys));
}

export async function saveKeys(keys) {
  return write(KEYS.keys, normalizeKeys(keys));
}

/** True when this looks like Torn PDA, so the panel can offer PDA's own key. */
export function onPda(win = globalThis) {
  return typeof win.PDA_httpGet === 'function' || Boolean(win.PDA_storage);
}

/** The Torn API key to use, or '' when there is none. */
export function apiKeyFor(keys, pdaKey = PDA_KEY) {
  if (keys.usePdaKey && API_KEY.test(pdaKey)) return pdaKey;
  return keys.api;
}
