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
// The copy is only ever made from one of Torn's own entries, never from a row another
// script added. The source is never touched: it is cloned first and only the clone is
// edited. Our row carries `data-own` so other scripts' clone logic can skip it.
//
// Other scripts copy *our* row (hq #453: The Contract cloned it, our attributes and mark
// included, and showed TT as its icon). So our row keeps Torn's icon, hidden only while
// the row has our id, and our mark shows only under that id: a copy without our id looks
// like a copy of Torn's row. A mark or `data-ttc-open` of ours found on a node that isn't
// our row is taken off again. Our row is known by its id, never by attributes a copy
// carries along.
//
// Facts, not code: where TornTools (GPLv3, features/settings-link) puts its own link and
// the two places it looks for Areas; that The Contract (torncontracts.online) clones an
// Areas entry and routes its page through the hash. No code was taken from either.

import { el, ownChange } from './dom.js';
import { log } from './log.js';
import { followTorn } from './tokens.js';

const P = 'ttc';
export const ROUTE_HREF = '/index.php#/torn-tracker';
/** Torn's Areas list: the slide-out menu on a phone and in PDA, the sidebar on a desktop. */
export const SIDEBAR = ".areasWrapper [class*='toggle-content__'], #sidebar [class*='areas___']";
export const LINK_ID = `${P}-sidebar-link`;
const LABEL = 'Torn Tracker';

/** Class names on a copied entry that carry Torn's state, not its look. */
const STATE_CLASS = /active|selected|current|highlight|blink|notification|attention/i;
/** Nodes in a copied entry that show Torn's counters, or act on the entry it came from. */
const COUNTERS = "[class*='amount'], [class*='Amount'], [class*='counter'], [class*='badge'], [class*='notification'], [class*='timer'], button";
/**
 * One of Torn's own area entries, as the captured sidebar has them (2026-10-23):
 * `#nav-home.area-desktop___…` holding `a.desktopLink___…` and `span.linkName___…`. The
 * Areas list also holds its collapsible header, which has a link too: that is never
 * the one copied.
 */
const AREA_ENTRY = "[id^='nav-'], [class*='area-desktop'], [class*='area-mobile']";
const LINK_NAME = "[class*='linkName']";
/** Attributes a copy keeps: Torn's look and the link. Everything else was the source's. */
const KEEP = new Set(['class', 'href', 'role', 'aria-hidden']);
/** Attributes that mark a node as ours or another script's: such a row is never copied. */
const FOREIGN = /^data-(own|ttc|tc)(-|$)/;
const TORN_HOSTS = new Set(['torn.com', 'www.torn.com']);
/**
 * Every node the entry, the page host and the sidebar block add. The entry is known by
 * its id: a copy another script makes of it keeps `data-ttc-open`, and its changes to
 * that copy are not ours (hq #453).
 */
export const OURS = `#${LINK_ID}, [data-ttc-own]`;

const STYLE = `
  ${followTorn(`.${P}-mark`)}
  .${P}-mark {
    display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex: none;
    border-radius: 4px; background: var(--primary); color: var(--primary-foreground); font: 700 9px/1 Arial, sans-serif; letter-spacing: -.02em;
  }
  .${P}-mark.${P}-entry-mark { display: none; }
  #${LINK_ID} .${P}-mark.${P}-entry-mark { display: inline-flex; }
  #${LINK_ID} svg { display: none; }
  #${LINK_ID}[data-ttc-plain] {
    display: flex; align-items: center; gap: 6px; min-height: 23px; margin: 2px 0; padding: 0 6px;
    border-top-right-radius: 5px; border-bottom-right-radius: 5px; text-decoration: none;
    background-color: var(--default-bg-panel-color, #f2f2f2); color: var(--default-font-color, #333);
  }
  #${LINK_ID}[aria-current="page"], #${LINK_ID} [aria-current="page"] { font-weight: 700; }
  #${LINK_ID}[data-ttc-plain][aria-current="page"] { background-color: var(--default-bg-panel-active-color, #e4e4e4); }
`;

function addStyle(doc) {
  if (doc.getElementById(`${P}-entry-style`)) return;
  const style = el('style', { id: `${P}-entry-style`, ownerDocument: doc });
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/** Our mark: the letters TT on our green, drawn with text, never with markup. */
const mark = (doc) => el('span', { class: `${P}-mark ${P}-entry-mark`, 'aria-hidden': 'true', ownerDocument: doc }, 'TT');

/** TornTools' own entry, found by its words: it has no stable id. */
function tornToolsEntry(parent) {
  return [...parent.children].find((n) => n.id !== LINK_ID && /TornTools Settings/.test(n.textContent || ''));
}

/** A link to one of Torn's own pages: on torn.com, and not a script's `#/…` route. */
export function tornHref(href, base = 'https://www.torn.com/') {
  let url;
  try {
    url = new URL(href, base);
  } catch {
    return false;
  }
  return TORN_HOSTS.has(url.hostname) && !url.hash.startsWith('#/');
}

const nodesOf = (root) => [root, ...root.querySelectorAll('*')];
const dataNames = (node) => node.getAttributeNames().filter((name) => name.startsWith('data-'));

/**
 * One of Torn's own Areas entries: Torn's shape, every link to a Torn page, and nothing
 * on it that we or another script put there. A row without Torn's `nav-` id must carry
 * no data attribute at all.
 */
export function nativeEntry(node) {
  if (node.id === LINK_ID || !node.matches(AREA_ENTRY)) return false;
  const links = node.matches('a[href]') ? [node] : [...node.querySelectorAll('a[href]')];
  if (!links.length || !node.querySelector(LINK_NAME)) return false;
  if (!links.every((a) => tornHref(a.getAttribute('href'), node.ownerDocument?.baseURI))) return false;
  const nav = node.id.startsWith('nav-');
  return nodesOf(node).every((n) => !n.classList.contains(`${P}-mark`)
    && dataNames(n).every((name) => nav && !FOREIGN.test(name)));
}

/** Strips a copied node of everything that belongs to the entry it was copied from. */
function scrub(root) {
  for (const node of root.querySelectorAll(COUNTERS)) node.remove();
  // A child that carries data is a counter or another script's addition, never Torn's look.
  for (const node of root.querySelectorAll('*')) if (dataNames(node).length) node.remove();
  for (const node of nodesOf(root)) {
    const inIcon = !!node.closest('svg');
    for (const name of node.getAttributeNames()) {
      const drop = inIcon
        ? name === 'id' || name.startsWith('on') || name.startsWith('data-')
        : !KEEP.has(name);
      if (drop) node.removeAttribute(name);
    }
    for (const token of [...node.classList]) if (STATE_CLASS.test(token)) node.classList.remove(token);
  }
}

/**
 * A copy of one of Torn's Areas entries, pointing at our route; null when there's none
 * to copy (then the entry is drawn in Torn's panel colours instead).
 */
export function copyEntry(parent, doc = parent.ownerDocument) {
  const entries = [...parent.children].filter(nativeEntry);
  const source = entries.find((n) => n.id === 'nav-home') || entries[0];
  if (!source) return null;
  const copy = source.cloneNode(true);
  scrub(copy);
  const anchors = copy.matches('a[href]') ? [copy] : [...copy.querySelectorAll('a[href]')];
  const link = anchors[0];
  for (const extra of anchors.slice(1)) extra.remove();
  link.setAttribute('href', ROUTE_HREF);
  link.removeAttribute('target');
  // The name: Torn's own name span when it has one, otherwise the link's text.
  const name = link.querySelector(LINK_NAME);
  if (name) name.textContent = LABEL;
  // Torn's icon stays, hidden under our id, so a script that copies our row gets Torn's.
  link.querySelector('svg')?.after(mark(doc));
  if (!name) {
    for (const node of [...link.childNodes]) if (node.nodeType === 3) node.remove();
    link.append(doc.createTextNode(LABEL));
  }
  copy.id = LINK_ID;
  copy.dataset.ttcOpen = 'sidebar';
  copy.dataset.own = '';
  return copy;
}

function ownEntry(doc) {
  return el('a', {
    href: ROUTE_HREF, id: LINK_ID, 'data-ttc-open': 'sidebar', 'data-own': '', 'data-ttc-plain': '', ownerDocument: doc,
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
  let toldStray = false;

  /**
   * Another script copied our row: take our mark and our open marker off its copy. Our
   * row is the one with our id; the copy may carry every other attribute of ours.
   */
  function removeStrays() {
    const own = doc.getElementById(LINK_ID);
    const ours = (node) => own?.contains(node) || node.closest('[data-ttc-own]');
    let took = false;
    for (const node of doc.querySelectorAll(`.${P}-entry-mark`)) {
      if (ours(node)) continue;
      node.remove();
      took = true;
    }
    for (const node of doc.querySelectorAll('[data-ttc-open]')) {
      if (node === own) continue;
      node.removeAttribute('data-ttc-open');
      took = true;
    }
    if (took && !toldStray) {
      toldStray = true;
      log('entry: took our mark off a row another script copied from our Areas entry');
    }
  }

  function place() {
    removeStrays();
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
    if (records.every((r) => ownChange(r, OURS))) return;
    view.clearTimeout(timer);
    timer = view.setTimeout(place, 200);
  }, doc);
  place();

  return {
    place,
    destroy() {
      stopWatching?.();
      view.clearTimeout(timer);
      doc.getElementById(LINK_ID)?.remove();
    },
  };
}
