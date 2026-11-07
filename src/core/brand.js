// The torn-tracker mark (hq BRAND-050): the lavender raven on its ink tile, from
// favicon.svg. One drawing for every place the companion shows its mark: the sidebar
// entry, the sidebar block's header, the settings page and the dashboard (hq #675).
//
// Drawn node by node with createElementNS from the checked values in src/data/brand.js:
// no markup ever reaches the page. The mark is decoration; the name beside it is the label.

import { MARK } from '../data/brand.js';

const NS = 'http://www.w3.org/2000/svg';

/** A fresh `<svg>` of the mark with the given class, hidden from screen readers. */
export function brandMark(doc, cls) {
  const node = (tag, attrs) => {
    const n = doc.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const svg = node('svg', { class: cls, viewBox: MARK.viewBox, 'aria-hidden': 'true', focusable: 'false' });
  svg.append(node('rect', MARK.tile), node('path', { ...MARK.raven, 'fill-rule': 'evenodd' }));
  return svg;
}
