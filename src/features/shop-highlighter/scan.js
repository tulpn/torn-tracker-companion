// Finding Item Market listings and judging them against a shop's price (CMP-109).
//
// From Torn Item Market - Shop Sell Price Highlighter v0.5.1
// (https://github.com/tulpn/torn-item-market-highlighter, by ares313377 [4372940]),
// contributed by its author under GPLv3. The methods are the script's: a listing is found
// by its item image and the nearest "$1,234" text, and is decorated through attributes
// only, so no node is ever inserted into Torn's listing markup.

// A price starts with a digit: "$," alone is no price, never $0 (hq #845).
export const PRICE_RE = /\$\s?(\d[\d,]*)/;
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

/** An element's own text: its text children joined, without the text of child elements. */
function ownText(el) {
  let text = '';
  for (const node of el.childNodes) if (node.nodeType === 3) text += node.nodeValue;
  return text;
}

/**
 * The price and the deepest element that holds it: the dot and label go there. The price
 * is read from that element alone, because a row's whole text runs "$900" into the
 * "1 available" beside it.
 *
 * Live, Torn renders "$" and the number as two text nodes of one element (hq #826: on
 * the owner's page, 60 listings and no price read), so an element's own text nodes are
 * joined first. A price split over child elements ("<span>$</span><span>900</span>") is
 * then found as the first element whose whole text holds a price and none of whose
 * children does.
 */
export function findPrice(row) {
  const els = [row, ...row.querySelectorAll('*')];
  for (const el of els) {
    const price = parsePrice(ownText(el));
    if (price !== null) return { price, el };
  }
  for (const el of els) {
    if (!PRICE_RE.test(el.textContent)) continue;
    if ([...el.children].some((child) => PRICE_RE.test(child.textContent))) continue;
    return { price: parsePrice(el.textContent), el };
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

/** Each unit with the decimals it is shown with, smallest first. */
const UNITS = [[1e3, 'k', 1], [1e6, 'm', 2], [1e9, 'b', 2]];

/**
 * 12.5k, 1.25m, 3b. A number is shown in the smallest unit that keeps it under 1000 once
 * rounded, so 999,999 reads "1m", never "1000k" (hq #845).
 */
export function short(n) {
  if (Math.abs(Math.round(n)) < 1e3) return String(Math.round(n));
  for (const [size, suffix, digits] of UNITS) {
    const s = (n / size).toFixed(digits);
    if (Math.abs(Number(s)) < 1e3 || suffix === 'b') return `${trimZeros(s)}${suffix}`;
  }
  return String(Math.round(n));
}
