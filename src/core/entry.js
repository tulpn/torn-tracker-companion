// The one way into the settings (CMP-107 as reworked on the owner's review, 2026-10-23).
//
// A "Torn Tracker" entry in Torn's Areas list in the left sidebar, directly after
// TornTools' "TornTools Settings" when that's there, otherwise last. It's a plain link to
// /index.php#/torn-tracker, the settings route (core/page.js): following it is the
// player's own navigation, so the script requests nothing and handles no click.
//
// The entry is a copy of one of Torn's own Areas entries, so it looks like them in light
// and dark, on a desktop and in the phone or PDA slide-out. The copy loses its ids,
// counters, badges and "active" classes, and its icon becomes our mark. Torn redraws its
// sidebar now and then; the entry is put back each time. Nothing is ever added to Torn's
// top header, and there's no edge tab or floating button.
//
// Facts, not code: where TornTools (GPLv3, features/settings-link) puts its own link and
// the two places it looks for Areas; that The Contract (torncontracts.online) clones an
// Areas entry and routes its page through the hash. No code was taken from either.

import { el } from './dom.js';

const P = 'ttc';
export const ROUTE_HREF = '/index.php#/torn-tracker';
/** Torn's Areas list: the slide-out menu on a phone and in PDA, the sidebar on a desktop. */
export const SIDEBAR = ".areasWrapper [class*='toggle-content__'], #sidebar [class*='areas___']";
export const LINK_ID = `${P}-sidebar-link`;
const LABEL = 'Torn Tracker';

/** Class names on a copied entry that carry Torn's state, not its look. */
const STATE_CLASS = /active|selected|current|highlight|blink|notification/i;
/** Nodes in a copied entry that show Torn's counters. */
const COUNTERS = "[class*='amount'], [class*='counter'], [class*='badge'], [class*='notification'], [class*='timer']";

const STYLE = `
  .${P}-mark {
    display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex: none;
    border-radius: 4px; background: #2e7d4f; color: #fff; font: 700 9px/1 Arial, sans-serif; letter-spacing: -.02em;
  }
  #${LINK_ID}[data-own] {
    display: flex; align-items: center; gap: 6px; min-height: 23px; margin: 2px 0; padding: 0 6px;
    border-top-right-radius: 5px; border-bottom-right-radius: 5px; text-decoration: none;
    background-color: var(--default-bg-panel-color, #f2f2f2); color: var(--default-font-color, #333);
  }
  #${LINK_ID}[aria-current="page"], #${LINK_ID} [aria-current="page"] { font-weight: 700; }
  #${LINK_ID}[data-own][aria-current="page"] { background-color: var(--default-bg-panel-active-color, #e4e4e4); }
`;

function addStyle(doc) {
  if (doc.getElementById(`${P}-entry-style`)) return;
  const style = el('style', { id: `${P}-entry-style`, ownerDocument: doc });
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/** Our mark: the letters TT on our green, drawn with text, never with markup. */
const mark = (doc) => el('span', { class: `${P}-mark`, 'aria-hidden': 'true', ownerDocument: doc }, 'TT');

/** TornTools' own entry, found by its words: it has no stable id. */
function tornToolsEntry(parent) {
  return [...parent.children].find((n) => n.id !== LINK_ID && /TornTools Settings/.test(n.textContent || ''));
}

/** Strips a copied node of everything that belongs to the entry it was copied from. */
function scrub(root) {
  for (const node of root.querySelectorAll(COUNTERS)) node.remove();
  for (const node of [root, ...root.querySelectorAll('*')]) {
    for (const name of node.getAttributeNames()) {
      if (name === 'id' || name === 'aria-current' || name.startsWith('on') || name.startsWith('data-')) node.removeAttribute(name);
    }
    for (const token of [...node.classList]) if (STATE_CLASS.test(token)) node.classList.remove(token);
  }
}

/**
 * A copy of one of Torn's Areas entries, pointing at our route; null when there's none
 * to copy (then the entry is drawn in Torn's panel colours instead).
 */
export function copyEntry(parent, doc = parent.ownerDocument) {
  const source = [...parent.children].find((n) => n.id !== LINK_ID
    && !/TornTools/.test(n.textContent || '')
    && (n.matches('a[href]') || n.querySelector('a[href]')));
  if (!source) return null;
  const copy = source.cloneNode(true);
  scrub(copy);
  const anchors = copy.matches('a[href]') ? [copy] : [...copy.querySelectorAll('a[href]')];
  const link = anchors[0];
  for (const extra of anchors.slice(1)) extra.remove();
  link.setAttribute('href', ROUTE_HREF);
  link.removeAttribute('target');
  // The name: Torn's own name span when it has one, otherwise the link's text.
  const name = link.querySelector("[class*='linkName'], [class*='name']");
  if (name) name.textContent = LABEL;
  const icon = link.querySelector('svg')?.parentElement;
  if (icon && icon !== link) icon.replaceChildren(mark(doc));
  else link.querySelector('svg')?.replaceWith(mark(doc));
  if (!name) {
    for (const node of [...link.childNodes]) if (node.nodeType === 3) node.remove();
    link.append(doc.createTextNode(LABEL));
  }
  copy.id = LINK_ID;
  copy.dataset.ttcOpen = 'sidebar';
  return copy;
}

function ownEntry(doc) {
  return el('a', {
    href: ROUTE_HREF, id: LINK_ID, 'data-ttc-open': 'sidebar', 'data-own': '', ownerDocument: doc,
  }, mark(doc), el('span', { ownerDocument: doc }, LABEL));
}

/**
 * @param {object} opts
 * @param {Document} opts.doc
 * @param {() => boolean} [opts.isCurrent]  whether the settings route is showing
 * @param {(handler: (records: MutationRecord[]) => void, doc: Document) => () => void} opts.onMutation
 */
export function mountEntry({ doc = globalThis.document, isCurrent = () => false, onMutation }) {
  addStyle(doc);

  function place() {
    const parent = doc.querySelector(SIDEBAR);
    let entry = doc.getElementById(LINK_ID);
    if (!parent) return false;
    if (!entry || !entry.isConnected) entry = copyEntry(parent, doc) || ownEntry(doc);
    const after = tornToolsEntry(parent);
    if (after) {
      if (after.nextElementSibling !== entry) after.after(entry);
    } else if (entry.parentElement !== parent || entry.nextElementSibling) {
      parent.append(entry);
    }
    const link = entry.matches('a') ? entry : entry.querySelector('a');
    if (isCurrent()) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
    return true;
  }

  // Torn redraws its sidebar (for example when the layout changes); put the entry back
  // each time. Our own nodes changing is no reason to look.
  let timer = null;
  const view = doc.defaultView || globalThis;
  const stopWatching = onMutation((records) => {
    const ours = records.every((r) => [r.target, ...r.addedNodes, ...r.removedNodes]
      .every((n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(`[data-ttc-open], [data-ttc-own]`)));
    if (ours) return;
    view.clearTimeout(timer);
    timer = view.setTimeout(place, 200);
  }, doc);
  place();

  return {
    place,
    destroy() {
      stopWatching?.();
      view.clearTimeout(timer);
      for (const node of doc.querySelectorAll('[data-ttc-open]')) node.remove();
    },
  };
}
