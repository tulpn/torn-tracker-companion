// One place on the page for the companion's toasts (hq #557 A8).
//
// The achievement toast and the chain watch notice used to sit 16 px from the bottom, each
// on its own, over Torn's chat bar. They now go into one stack, raised above the chat bar,
// newest at the bottom, so two never overlap each other or the chat.

import { el } from './dom.js';

const P = 'ttc';
export const STACK_ID = `${P}-toasts`;
/** How far above the window's bottom the stack starts: clear of Torn's chat bar. */
export const STACK_BOTTOM_PX = 56;
/** On a phone, Torn's chat and bottom bar are taller. */
export const STACK_BOTTOM_NARROW_PX = 72;

const STYLE = `
  #${STACK_ID} {
    position: fixed; right: 16px; bottom: ${STACK_BOTTOM_PX}px; z-index: 2147481000;
    display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
    max-width: calc(100vw - 32px); pointer-events: none;
  }
  #${STACK_ID}:empty { display: none; }
  #${STACK_ID} > * { pointer-events: auto; max-width: 100%; }
  @media (max-width: 640px) {
    #${STACK_ID} { left: 16px; right: 16px; bottom: ${STACK_BOTTOM_NARROW_PX}px; align-items: stretch; }
  }
`;

/**
 * Puts a toast into the shared stack, making the stack the first time.
 * @param {Document} doc
 * @param {Element} node
 * @returns {Element} the node
 */
export function showToast(doc, node) {
  if (!doc.getElementById(`${STACK_ID}-style`)) {
    const style = el('style', { id: `${STACK_ID}-style`, ownerDocument: doc });
    style.textContent = STYLE;
    (doc.head || doc.documentElement).append(style);
  }
  let stack = doc.getElementById(STACK_ID);
  if (!stack) {
    stack = el('div', { id: STACK_ID, 'data-ttc-own': '', ownerDocument: doc });
    (doc.body || doc.documentElement).append(stack);
  }
  stack.append(node);
  return node;
}
