// How old the data in a block is (hq #687, WP-BL-28): every block that shows data from
// Torn or torn-tracker.com says when it was updated, and once it's older than the block
// expects, says it may be out of date. One helper, so every block words it the same way.
//
// The age line is a node that carries its own time: a block's existing timer repaints it
// with repaintAges(), and nothing here reaches the network.

/** "just now", "40s", "3m", "2h", "2d": how long, in the companion's one short form. */
export function since(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

/** "just now", "40s ago", "3m ago", "2h ago", "2d ago": how long since. */
export function ago(ms) {
  const t = since(ms);
  return t === 'just now' ? t : `${t} ago`;
}

/**
 * A block's age in words: "Updated 3m ago", or "Updated 2h ago · may be out of date" once
 * it's `staleAfterMs` old or older. Null when the time isn't known: no line beats a wrong one.
 * @returns {{text: string, stale: boolean}|null}
 */
export function freshness(at, now, staleAfterMs) {
  if (typeof at !== 'number' || !Number.isFinite(at) || !Number.isFinite(now)) return null;
  const age = Math.max(0, now - at);
  const stale = age >= staleAfterMs;
  return { stale, text: `Updated ${ago(age)}${stale ? ' · may be out of date' : ''}` };
}

const AT = 'ttcAgeAt';
const AFTER = 'ttcAgeStaleAfter';

function paint(node, now) {
  const f = freshness(Number(node.dataset[AT]), now, Number(node.dataset[AFTER]));
  if (!f) return;
  if (node.textContent !== f.text) node.textContent = f.text;
  if (f.stale) node.dataset.stale = 'true';
  else delete node.dataset.stale;
}

/**
 * The age line as an element of `tag` with class `cls`, or null when the time isn't known.
 * A stale one carries `data-stale="true"` so the block's style can mark it.
 */
export function ageNode(doc, { at, now, staleAfterMs, cls = 'ttc-age', tag = 'span' }) {
  if (!freshness(at, now, staleAfterMs)) return null;
  const node = doc.createElement(tag);
  node.className = cls;
  node.dataset[AT] = String(at);
  node.dataset[AFTER] = String(staleAfterMs);
  paint(node, now);
  return node;
}

/** Brings every age line under `root` up to `now`; nothing else changes. */
export function repaintAges(root, now) {
  for (const node of root?.querySelectorAll?.('[data-ttc-age-at]') || []) paint(node, now);
}

/**
 * Repaints the age lines under `root` every `everyMs` for a block with no timer of its own.
 * @returns {() => void} stops it
 */
export function tickAges(timers, root, now, everyMs = 30_000) {
  const id = timers.setInterval(() => repaintAges(root, now()), everyMs);
  return () => timers.clearInterval(id);
}

/** The age line's look under `sel`: quiet, and plain text once it's stale. */
export const ageCss = (sel) => `${sel} { font-size: 12px; color: var(--muted-foreground); }
  ${sel}[data-stale] { color: var(--foreground); font-weight: 600; }`;
