// Finding Item Market listings and judging them against a shop's price (CMP-109).
//
// From Torn Item Market - Shop Sell Price Highlighter v0.5.1
// (https://github.com/tulpn/torn-item-market-highlighter, by ares313377 [4372940]),
// contributed by its author under GPLv3. The methods are the script's: a listing is found
// by its item image and the nearest "$1,234" text, and is decorated through attributes
// only, so no node is ever inserted into Torn's listing markup.

export const PRICE_RE = /\$\s?([\d,]+)/;
const IMG_ID_RE = /\/images\/items\/(\d+)\//;
// "x 12", "12x", "qty 12", "quantity: 12": the digits must not be part of a price.
const QTY_RE = /(?:^|[^\w$])x\s?(\d[\d,]*)|(?:^|[^$\d,])(\d[\d,]*)\s?x(?!\w)|\b(?:qty|quantity)\s*:?\s*(\d[\d,]*)/i;

/** The tiers, best first, each with a minimum per mode in the feature's settings. */
export const TIERS = Object.freeze(['green', 'yellow', 'red', 'blue']);

/** The setting holding a tier's minimum: absGreen, pctBlue. */
export const tierKey = (mode, tier) => `${mode}${tier[0].toUpperCase()}${tier.slice(1)}`;

export function parsePrice(text) {
  const m = PRICE_RE.exec(text);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

export function parseQty(text) {
  const m = QTY_RE.exec(text);
  if (!m) return 1;
  const n = Number((m[1] || m[2] || m[3] || '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** The item id in an image's src, or null. */
export function itemIdOfImage(img) {
  const m = IMG_ID_RE.exec(img.getAttribute('src') || '');
  return m ? Number(m[1]) : null;
}

/** Images that are the page's controls rather than listings: dropdowns, filters, buttons, ours. */
export function isChrome(img) {
  return Boolean(img.closest(
    "[role='listbox'], [role='option'], button, [class*='filtersWrapper'], [class*='dropdown'], [class*='Dropdown'], [data-ttc-own], [class^='ttc-'], [class*=' ttc-']",
  ));
}

/**
 * Walks up from the item image to the first element whose text holds a price. When that
 * element holds more than one item image it is a list, not a listing: null.
 */
export function findRow(img) {
  let node = img.parentElement;
  for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
    if (!PRICE_RE.test(node.textContent)) continue;
    if (node.querySelectorAll("img[src*='/images/items/']").length > 1) return null;
    return node;
  }
  return null;
}

/**
 * The price and the deepest element whose own text holds it: the dot and label go there.
 * The price is read from that text alone, because a row's whole text runs "$900" into the
 * "1 available" beside it.
 */
export function findPrice(row) {
  const doc = row.ownerDocument;
  const walker = doc.createTreeWalker(row, doc.defaultView.NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const price = parsePrice(node.nodeValue);
    if (price !== null) return { price, el: node.parentElement };
  }
  return null;
}

/**
 * Profit per item, margin in % of the listing's price, and the tier it reaches (null when
 * it isn't below the shop's price, or reaches no tier).
 */
export function judge(price, shopPrice, settings) {
  const profit = shopPrice - price;
  const margin = (profit / price) * 100;
  const mode = settings.mode === 'pct' ? 'pct' : 'abs';
  const metric = mode === 'pct' ? margin : profit;
  const tier = shopPrice > 0 && profit > 0
    ? TIERS.find((t) => Number.isFinite(settings[tierKey(mode, t)]) && metric >= settings[tierKey(mode, t)]) || null
    : null;
  return { profit, margin, tier };
}

const trimZeros = (s) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);

/** 12.5k, 1.25m, 3b. */
export function short(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return `${trimZeros((n / 1e9).toFixed(2))}b`;
  if (a >= 1e6) return `${trimZeros((n / 1e6).toFixed(2))}m`;
  if (a >= 1e3) return `${trimZeros((n / 1e3).toFixed(1))}k`;
  return String(Math.round(n));
}
