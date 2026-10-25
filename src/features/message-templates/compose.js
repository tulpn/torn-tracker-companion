// Torn's write-a-message page, for message templates (CMP-307, CMP-006: one file to fix
// when Torn changes).
//
// UNVERIFIED: these selectors are candidates, not read from a capture. Torn's profile
// links to `messages.php#/p=compose&XID=<id>`; the recipient field `#ac-search-0` is a
// fact from TornBuddy (MIT, by Upsilon). The subject and the message body (a rich-text
// editor in an iframe, or a plain textarea) are matched loosely; when none is found the
// page gets nothing and the profile's Copy still works. Replace with a capture (hq #313).

import { BODY, SUBJECT } from './limits.js';

/** Sets a field as if the player had typed it, and says so with `input` and `change`. */
function setValue(field, value) {
  const win = field.ownerDocument.defaultView;
  const proto = field.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
  field.dispatchEvent(new win.Event('input', { bubbles: true }));
  field.dispatchEvent(new win.Event('change', { bubbles: true }));
}

export const SUBJECT_FIELD = "input[name='subject'], input#subject, .subject input[type='text']";
export const BODY_FIELD = "textarea[name='message'], textarea#mailcompose, textarea[name='mailcompose']";
export const BODY_EDITOR = "iframe[id$='_ifr'], .mce-content-body[contenteditable='true'], form [contenteditable='true']";

/** Where a draft waits while the player's browser opens the compose page. */
export const DRAFT_KEY = 'ttc-msg-draft';
/** A draft older than this is not used: the player went elsewhere. */
export const DRAFT_MS = 10 * 60_000;

/** The compose page's link for a player. Opening it is the player's own navigation. */
export function composeHref(id) {
  return `/messages.php#/p=compose&XID=${id}`;
}

/** The player the compose page is written to, from its address; null elsewhere. */
export function composeTarget(loc) {
  if (String(loc?.pathname || '').split('/').pop() !== 'messages.php') return null;
  const params = new URLSearchParams(String(loc?.hash || '').replace(/^#\/?/, ''));
  if (params.get('p') !== 'compose') return null;
  const id = Number(params.get('XID'));
  return Number.isInteger(id) && id > 0 ? id : 0;
}

/** A stored draft, checked field by field: for this player, recent, within the limits. */
export function validDraft(raw, id, now = Date.now()) {
  let d;
  try {
    d = JSON.parse(String(raw ?? ''));
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object' || d.id !== id || !Number.isInteger(id) || id <= 0) return null;
  if (typeof d.subject !== 'string' || d.subject.length > SUBJECT) return null;
  if (typeof d.body !== 'string' || d.body.length > BODY) return null;
  if (!Number.isInteger(d.at) || d.at > now || now - d.at > DRAFT_MS) return null;
  return { id, subject: d.subject, body: d.body };
}

/** The page's subject field and message body, or null for each it doesn't show. */
export function findCompose(doc) {
  const subject = doc.querySelector(SUBJECT_FIELD);
  const field = doc.querySelector(BODY_FIELD);
  const node = doc.querySelector(BODY_EDITOR);
  let editor = null;
  if (node?.tagName === 'IFRAME') {
    try {
      editor = node.contentDocument?.body || null;
    } catch { /* another origin's frame: not ours to write */ }
  } else editor = node;
  const visible = (n) => n && n.type !== 'hidden';
  return { subject: visible(subject) ? subject : null, field, editor, anchor: editor && node ? node : field };
}

/** The body's text now, from the editor if there is one. */
export function bodyText({ field, editor }) {
  if (editor) return [...editor.childNodes].map((n) => n.textContent).join('\n').trim();
  return field ? field.value : '';
}

/** Writes the subject, as the player would by typing it. */
export function writeSubject({ subject }, text) {
  if (!subject) return false;
  setValue(subject, String(text));
  return true;
}

/**
 * Writes the message into the body, as the player would by typing it: the editor gets one
 * paragraph per line, a plain field its value. Nothing is sent.
 */
export function writeBody(compose, text) {
  const { field, editor } = compose;
  if (editor) {
    const own = editor.ownerDocument;
    editor.replaceChildren(...String(text).split('\n').map((line) => {
      const p = own.createElement('p');
      if (line) p.textContent = line;
      else p.append(own.createElement('br'));
      return p;
    }));
    editor.dispatchEvent(new own.defaultView.Event('input', { bubbles: true }));
  }
  if (field) setValue(field, text);
  return Boolean(editor || field);
}
