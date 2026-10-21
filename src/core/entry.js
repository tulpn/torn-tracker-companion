// The ways into the settings page (CMP-107 as reworked on the owner's review, 2026-10-22).
//
//   - A "Torn Tracker" link in Torn's sidebar, right after TornTools' own "TornTools
//     Settings" link when TornTools is there, otherwise at the end of the Areas list.
//   - A small icon in Torn's top header, by the player's avatar.
//   - Only when neither place exists on a page: a slim tab on the screen's edge. There is
//     never a floating button.
//
// Every one is placed by reading the page the player opened, and put back when Torn
// redraws its sidebar or header. None of them makes a request; each only opens our page.
//
// Facts, not code, from TornTools (GPLv3, features/settings-link and custom-links): where
// its sidebar link goes and how it looks (Torn's own panel colours). Torn PDA (GPLv3) gave
// the header's wrapper.

import { el } from './dom.js';

const P = 'ttc';
/** Torn's Areas list, the same two places TornTools looks. */
export const SIDEBAR = ".areasWrapper [class*='toggle-content__'], #sidebar [class*='areas___']";
/** Torn's top header bar. */
export const HEADER = '#topHeaderBanner .header-wrapper-top';
export const AVATAR = "[class*='avatar'], img[src*='avatar']";
const LABEL = 'Torn Tracker settings';

const STYLE = `
  #${P}-sidebar-link {
    display: flex; align-items: center; gap: 6px; min-height: 23px; margin: 2px 0; padding: 0 6px;
    border-top-right-radius: 5px; border-bottom-right-radius: 5px; cursor: pointer; text-decoration: none;
    background-color: var(--default-bg-panel-color, #f2f2f2); color: var(--default-font-color, #333);
    font: inherit; border: 0; width: 100%; text-align: left; box-sizing: border-box;
  }
  #${P}-sidebar-link:hover { background-color: var(--default-bg-panel-active-color, #e4e4e4); }
  .${P}-mark {
    display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex: none;
    border-radius: 4px; background: #2e7d4f; color: #fff; font: 700 9px/1 Arial, sans-serif; letter-spacing: -.02em;
  }
  #${P}-header-link {
    display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px;
    margin: 0 2px; padding: 0; background: none; border: 0; cursor: pointer; vertical-align: middle;
  }
  #${P}-header-link .${P}-mark { width: 24px; height: 24px; font-size: 11px; }
  #${P}-edge-tab {
    position: fixed; right: 0; top: 40%; z-index: 99990; writing-mode: vertical-rl; padding: 10px 4px;
    min-width: 28px; background: #2e7d4f; color: #fff; border: 0; border-radius: 6px 0 0 6px; cursor: pointer;
    font: 700 11px Arial, sans-serif; box-shadow: -1px 0 4px rgba(0,0,0,.3);
  }
`;

function addStyle(doc) {
  if (doc.getElementById(`${P}-entry-style`)) return;
  const style = el('style', { id: `${P}-entry-style`, ownerDocument: doc });
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/** Our mark: the letters TT on our green, drawn with text, never with markup. */
const mark = (doc) => el('span', { class: `${P}-mark`, 'aria-hidden': 'true', ownerDocument: doc }, 'TT');

/** TornTools' own sidebar link, found by its words: it has no stable id. */
function tornToolsLink(parent) {
  return [...parent.children].find((n) => n.id !== `${P}-sidebar-link` && /TornTools Settings/.test(n.textContent || ''));
}

/**
 * @param {object} opts
 * @param {Document} opts.doc
 * @param {() => void} opts.onOpen  opens the settings page
 * @param {(handler: () => void, doc: Document) => () => void} opts.onMutation
 */
export function mountEntry({ doc = globalThis.document, onOpen, onMutation }) {
  addStyle(doc);
  const open = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onOpen();
  };

  function sidebarLink() {
    const parent = doc.querySelector(SIDEBAR);
    if (!parent) return false;
    let link = doc.getElementById(`${P}-sidebar-link`);
    if (!link) {
      link = el('button', {
        type: 'button', id: `${P}-sidebar-link`, 'data-ttc-open': 'sidebar', title: LABEL, ownerDocument: doc,
      }, mark(doc), el('span', { ownerDocument: doc }, 'Torn Tracker'));
      link.addEventListener('click', open);
    }
    const after = tornToolsLink(parent);
    if (after) {
      if (after.nextElementSibling !== link) after.after(link);
    } else if (link.parentElement !== parent || link.nextElementSibling) {
      parent.append(link);
    }
    return true;
  }

  function headerLink() {
    const header = doc.querySelector(HEADER);
    if (!header) return false;
    if (doc.getElementById(`${P}-header-link`)?.isConnected && header.contains(doc.getElementById(`${P}-header-link`))) return true;
    const link = el('button', {
      type: 'button', id: `${P}-header-link`, 'data-ttc-open': 'header', title: LABEL, 'aria-label': LABEL, ownerDocument: doc,
    }, mark(doc));
    link.addEventListener('click', open);
    // Beside the avatar when the header shows one; otherwise at the end of the bar.
    const avatar = header.querySelector(AVATAR);
    const spot = avatar?.closest('a, li, div') || avatar;
    if (spot && spot !== header) spot.before(link);
    else header.append(link);
    return true;
  }

  function edgeTab(needed) {
    let tab = doc.getElementById(`${P}-edge-tab`);
    if (!needed) {
      tab?.remove();
      return;
    }
    if (tab) return;
    tab = el('button', {
      type: 'button', id: `${P}-edge-tab`, 'data-ttc-open': 'edge', title: LABEL, 'aria-label': LABEL, ownerDocument: doc,
    }, 'Torn Tracker');
    tab.addEventListener('click', open);
    doc.body.append(tab);
  }

  function place() {
    const inSidebar = sidebarLink();
    const inHeader = headerLink();
    edgeTab(!inSidebar && !inHeader);
  }

  // Torn redraws its sidebar and header (for example when the layout changes); put the
  // ways in back each time. Our own nodes changing is no reason to look.
  let timer = null;
  const view = doc.defaultView || globalThis;
  const stopWatching = onMutation((records) => {
    const ours = records.every((r) => [r.target, ...r.addedNodes, ...r.removedNodes]
      .every((n) => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(`[data-ttc-open], #${P}-panel`)));
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
