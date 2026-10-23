// The tour engine (hq #237, WP-UX-4: UXT-001 to UXT-006, UXT-020 to UXT-022).
//
// A tour is data (core/tours.js): an id, a version, the page it belongs on, and steps that
// each point at a `data-tour="…"` anchor. The engine highlights the anchor and shows the
// step beside it as a labelled dialog; at 640 px wide or less the step is a bottom sheet
// and the anchor scrolls into view above it. Steps whose anchor isn't on the page, or whose
// `requires` isn't met, are skipped, never guessed (UXT-021).
//
// Keys: Esc skips the tour, the right arrow or Enter goes on, the left arrow goes back;
// Tab stays inside the step, and focus goes back where it was afterwards. On a touch
// screen a swipe to the left goes on. With reduced motion, steps only fade.
//
// It is plain DOM built on the suite's tokens (core/tokens.js), with no library: a
// userscript loads no outside code (CMP-010). It only reads the page and listens for
// scrolling and resizing to keep the highlight in place; it never clicks or requests
// anything.

import { el } from './dom.js';
import { declarations } from './tokens.js';

const P = 'ttc';
export const LAYER_ID = `${P}-tour`;
export const LIMITS = Object.freeze({ title: 40, body: 160 });
const SWIPE_PX = 50;

const STYLE = `
  #${LAYER_ID} { ${declarations('dark')} position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; }
  #${LAYER_ID}[data-theme="light"] { ${declarations('light')} }
  #${LAYER_ID} .${P}-tour-ring {
    position: fixed; border-radius: var(--radius); pointer-events: none;
    box-shadow: 0 0 0 3px var(--ring), 0 0 0 9999px color-mix(in srgb, #000 55%, transparent);
    transition: top var(--tt-duration-normal) var(--tt-ease), left var(--tt-duration-normal) var(--tt-ease),
      width var(--tt-duration-normal) var(--tt-ease), height var(--tt-duration-normal) var(--tt-ease);
  }
  #${LAYER_ID} .${P}-tour-card {
    position: fixed; box-sizing: border-box; width: min(340px, calc(100vw - 24px)); padding: 14px 16px 12px;
    pointer-events: auto; border-radius: var(--radius); border: 1px solid var(--border);
    background: var(--popover); color: var(--popover-foreground); box-shadow: var(--tt-shadow-md);
    font: 14px/1.5 var(--tt-font-sans); overflow-wrap: anywhere;
    animation: ${P}-tour-in var(--tt-duration-normal) var(--tt-ease);
  }
  #${LAYER_ID} .${P}-tour-card:focus { outline: none; }
  #${LAYER_ID} .${P}-tour-count { margin: 0 0 2px; font-size: 12px; color: var(--muted-foreground); }
  #${LAYER_ID} .${P}-tour-card h2 { margin: 0 0 4px; font-size: 16px; font-weight: 700; }
  #${LAYER_ID} .${P}-tour-card p { margin: 0; }
  #${LAYER_ID} .${P}-tour-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  #${LAYER_ID} .${P}-tour-example {
    position: relative; margin: 10px 0 0; padding: 18px 10px 8px; border-radius: var(--radius);
    border: 1px dashed var(--border); background: var(--card); color: var(--card-foreground); font-size: 13px;
  }
  #${LAYER_ID} .${P}-tour-example::before {
    content: "Example"; position: absolute; top: 0; left: 0; padding: 1px 8px; border-radius: var(--radius) 0 var(--radius) 0;
    background: var(--secondary); color: var(--secondary-foreground); font-size: 11px; font-weight: 700;
  }
  #${LAYER_ID} .${P}-tour-example div + div { margin-top: 2px; }
  #${LAYER_ID} .${P}-tour-cta { display: inline-block; margin-top: 8px; color: var(--ring); font-weight: 600; }
  #${LAYER_ID} .${P}-tour-bar { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  #${LAYER_ID} .${P}-tour-bar button {
    min-height: 36px; min-width: 44px; padding: 4px 14px; border-radius: var(--radius); cursor: pointer;
    font: 600 13px/1 var(--tt-font-sans); border: 1px solid var(--input); background: transparent; color: var(--foreground);
  }
  #${LAYER_ID} .${P}-tour-bar [data-tour-act="skip"] { margin-right: auto; border-color: transparent; color: var(--muted-foreground); }
  #${LAYER_ID} .${P}-tour-bar [data-tour-act="next"] { background: var(--primary); border-color: var(--primary); color: var(--primary-foreground); }
  #${LAYER_ID} .${P}-tour-bar button:focus-visible, #${LAYER_ID} .${P}-tour-cta:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  @media (max-width: 640px) {
    #${LAYER_ID} .${P}-tour-card {
      left: 0 !important; right: 0; top: auto !important; bottom: 0; width: 100%;
      border-radius: var(--radius) var(--radius) 0 0; padding-bottom: max(12px, env(safe-area-inset-bottom));
      animation-name: ${P}-tour-up;
    }
    #${LAYER_ID} .${P}-tour-bar button { min-height: 44px; flex: 1; }
    #${LAYER_ID} .${P}-tour-bar [data-tour-act="skip"] { flex: none; }
  }
  @media (pointer: coarse) { #${LAYER_ID} .${P}-tour-bar button { min-height: 44px; } }
  @keyframes ${P}-tour-in { from { opacity: 0; transform: translateY(4px); } }
  @keyframes ${P}-tour-up { from { opacity: 0; transform: translateY(24px); } }
  @media (prefers-reduced-motion: reduce) {
    #${LAYER_ID} .${P}-tour-ring { transition: none; }
    #${LAYER_ID} .${P}-tour-card { animation: ${P}-tour-fade var(--tt-duration-normal) linear; }
    @keyframes ${P}-tour-fade { from { opacity: 0; } }
  }
`;

/**
 * Checks a tour's shape (UXT-001); throws on the first problem.
 * @returns {object} the tour
 */
export function checkTour(tour) {
  const fail = (why) => { throw new Error(`tour ${tour?.id}: ${why}`); };
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(tour?.id || '')) fail('bad id');
  if (!Number.isInteger(tour.version) || tour.version < 1) fail('bad version');
  if (tour.surface !== 'companion') fail('surface must be companion');
  if (typeof tour.page !== 'string' || !tour.page) fail('no page');
  if (typeof tour.title !== 'string' || !tour.title) fail('no title');
  if (!Array.isArray(tour.steps) || tour.steps.length === 0) fail('no steps');
  const ids = new Set();
  for (const step of tour.steps) {
    if (!/^[a-z][a-z0-9-]{0,60}$/.test(step.target || '')) fail(`bad target ${step.target}`);
    const id = stepId(step);
    if (ids.has(id)) fail(`step ${id} twice`);
    ids.add(id);
    if (typeof step.title !== 'string' || !step.title || step.title.length > LIMITS.title) fail(`title of ${id}`);
    if (typeof step.body !== 'string' || !step.body || step.body.length > LIMITS.body) fail(`body of ${id}`);
    if (step.example !== undefined && (!Array.isArray(step.example?.lines) || step.example.lines.some((l) => typeof l !== 'string'))) {
      fail(`example of ${id}`);
    }
    if (step.cta !== undefined && !(typeof step.cta?.label === 'string' && /^https:\/\//.test(step.cta?.href || ''))) {
      fail(`cta of ${id}`);
    }
  }
  return tour;
}

/** A step is known by its id, or by its anchor when it has none. */
export const stepId = (step) => step.id || step.target;

/** Whether an element shows; where the browser can't say (an older one, a test), not hidden is enough. */
function shown(node) {
  if (!node.isConnected || node.closest('[hidden]')) return false;
  return typeof node.checkVisibility === 'function' ? node.checkVisibility() : true;
}

/** The first element showing with this anchor, looking into each root in turn. */
export function findAnchor(roots, target) {
  for (const root of roots) {
    for (const node of root?.querySelectorAll?.(`[data-tour="${target}"]`) || []) {
      if (shown(node)) return node;
    }
  }
  return null;
}

/** The element that has focus, looking through shadow roots. */
export function activeElement(doc) {
  let node = doc.activeElement;
  while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
  return node;
}

/** Whether the player is typing into a field, which a tour must never cover (UXT-003). */
export function typing(doc) {
  const node = activeElement(doc);
  if (!node || node === doc.body) return false;
  if (node.isContentEditable) return true;
  if (node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') return true;
  return node.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(node.type);
}

/** A short name for the highlighted element, for a screen reader. */
function nameOf(node) {
  const label = node.getAttribute('aria-label') || node.getAttribute('title') || node.textContent || '';
  const text = label.replace(/\s+/g, ' ').trim();
  return text.length > 60 ? `${text.slice(0, 59)}…` : text;
}

/**
 * Runs a tour on the page.
 * @param {Document} doc
 * @param {object} tour                  a checked tour
 * @param {object} [opts]
 * @param {Array<ParentNode>} [opts.roots]  where anchors are looked for (the document, the settings page's shadow root)
 * @param {'dark'|'light'} [opts.theme]
 * @param {(requires: string) => boolean} [opts.isMet]  whether a step's `requires` holds
 * @param {Iterable<string>} [opts.skip]  ids of steps already seen (a new version shows only its new steps)
 * @param {(result: {reason: 'done'|'skipped'|'empty', seen: string[]}) => void} [opts.onEnd]
 * @returns {{next(): void, back(): void, skip(): void, stop(): void, readonly step: object|null}}
 */
export function runTour(doc, tour, { roots = [doc], theme = 'dark', isMet = () => true, skip = [], onEnd = () => {} } = {}) {
  const win = doc.defaultView || globalThis;
  const skipped = new Set(skip);
  const steps = tour.steps.filter((step) => !skipped.has(stepId(step)) && (!step.requires || isMet(step.requires)));
  const seen = new Set();
  const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);
  const returnTo = activeElement(doc);

  let index = -1;
  let anchor = null;
  let ended = false;
  let touchX = null;

  // Steps whose anchor isn't there now are left out, so the count is honest.
  const present = () => steps.filter((step) => findAnchor(roots, step.target));
  let live = present();
  if (live.length === 0) {
    queueMicrotask(() => onEnd({ reason: 'empty', seen: [] }));
    return { next() {}, back() {}, skip() {}, stop() {}, get step() { return null; } };
  }

  doc.getElementById(LAYER_ID)?.remove();
  // The styles go with the layer, so a finished tour leaves nothing on the page.
  const style = h('style');
  style.textContent = STYLE;
  const ring = h('div', { class: `${P}-tour-ring`, 'aria-hidden': 'true' });
  const count = h('p', { class: `${P}-tour-count` });
  const title = h('h2', { id: `${LAYER_ID}-title` });
  const body = h('p', { id: `${LAYER_ID}-body` });
  const where = h('span', { id: `${LAYER_ID}-where`, class: `${P}-tour-sr` });
  const extra = h('div');
  const back = h('button', { type: 'button', 'data-tour-act': 'back' }, 'Back');
  const next = h('button', { type: 'button', 'data-tour-act': 'next' }, 'Next');
  const skipButton = h('button', { type: 'button', 'data-tour-act': 'skip' }, 'Skip tour');
  const card = h('div', {
    class: `${P}-tour-card`, role: 'dialog', 'aria-modal': 'true', tabindex: '-1',
    'aria-labelledby': `${LAYER_ID}-title`, 'aria-describedby': `${LAYER_ID}-body ${LAYER_ID}-where`,
  }, count, title, body, where, extra, h('div', { class: `${P}-tour-bar` }, skipButton, back, next));
  const layer = h('div', { id: LAYER_ID, 'data-theme': theme === 'light' ? 'light' : 'dark', 'data-ttc-own': '' }, style, ring, card);
  doc.body.append(layer);

  const narrow = () => (win.innerWidth || 1024) <= 640;

  function place() {
    if (!anchor) return;
    const box = anchor.getBoundingClientRect();
    const pad = 4;
    Object.assign(ring.style, {
      top: `${box.top - pad}px`, left: `${box.left - pad}px`, width: `${box.width + pad * 2}px`, height: `${box.height + pad * 2}px`,
    });
    if (narrow()) return;
    const width = card.offsetWidth || 340;
    const height = card.offsetHeight || 180;
    const viewW = win.innerWidth || 1024;
    const viewH = win.innerHeight || 768;
    const below = box.bottom + 12;
    const top = below + height <= viewH ? below : Math.max(12, box.top - 12 - height);
    const left = Math.min(Math.max(12, box.left), Math.max(12, viewW - width - 12));
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  }

  function show(at) {
    live = present();
    if (at >= live.length) return end('done');
    index = Math.max(0, at);
    const step = live[index];
    anchor = findAnchor(roots, step.target);
    if (!anchor) return show(index + 1);
    seen.add(stepId(step));
    count.textContent = `${index + 1} of ${live.length}`;
    title.textContent = step.title;
    body.textContent = step.body;
    where.textContent = nameOf(anchor) ? `Highlighted: ${nameOf(anchor)}` : '';
    extra.replaceChildren();
    if (step.example) {
      extra.append(h('div', { class: `${P}-tour-example`, role: 'note', 'aria-label': 'Example with sample data' },
        ...step.example.lines.map((line) => h('div', null, line))));
    }
    if (step.cta) {
      extra.append(h('a', { class: `${P}-tour-cta`, href: step.cta.href, target: '_blank', rel: 'noopener noreferrer' }, step.cta.label));
    }
    back.disabled = index === 0;
    next.textContent = index === live.length - 1 ? 'Done' : 'Next';
    anchor.scrollIntoView?.({ block: narrow() ? 'start' : 'nearest', behavior: 'auto' });
    if (narrow()) win.scrollBy?.(0, -16);
    place();
    card.focus({ preventScroll: true });
    return undefined;
  }

  function end(reason) {
    if (ended) return;
    ended = true;
    win.removeEventListener('scroll', place, true);
    win.removeEventListener('resize', place);
    doc.removeEventListener('keydown', onKey, true);
    layer.remove();
    try {
      (returnTo && returnTo !== doc.body ? returnTo : anchor)?.focus?.({ preventScroll: true });
    } catch { /* focus is a courtesy */ }
    onEnd({ reason, seen: [...seen] });
  }

  function focusables() {
    return [...card.querySelectorAll('button:not([disabled]), a[href]')];
  }

  function onKey(event) {
    if (ended) return;
    const inCard = card.contains(event.target);
    if (event.key === 'Escape') {
      event.preventDefault();
      end('skipped');
    } else if (event.key === 'ArrowRight' || (event.key === 'Enter' && (!inCard || event.target === card))) {
      event.preventDefault();
      show(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (index > 0) show(index - 1);
    } else if (event.key === 'Tab') {
      const list = focusables();
      if (list.length === 0) return;
      const at = list.indexOf(event.target);
      const to = event.shiftKey ? (at <= 0 ? list.length - 1 : at - 1) : (at === -1 || at === list.length - 1 ? 0 : at + 1);
      event.preventDefault();
      list[to].focus();
    }
  }

  card.addEventListener('click', (event) => {
    const act = event.target.closest?.('[data-tour-act]')?.dataset.tourAct;
    if (act === 'next') show(index + 1);
    else if (act === 'back' && index > 0) show(index - 1);
    else if (act === 'skip') end('skipped');
  });
  card.addEventListener('touchstart', (event) => { touchX = event.changedTouches?.[0]?.clientX ?? null; }, { passive: true });
  card.addEventListener('touchend', (event) => {
    const x = event.changedTouches?.[0]?.clientX;
    if (touchX !== null && typeof x === 'number' && touchX - x > SWIPE_PX) show(index + 1);
    touchX = null;
  }, { passive: true });
  win.addEventListener('scroll', place, true);
  win.addEventListener('resize', place);
  doc.addEventListener('keydown', onKey, true);

  show(0);

  return {
    next: () => show(index + 1),
    back: () => { if (index > 0) show(index - 1); },
    skip: () => end('skipped'),
    stop: () => end('skipped'),
    get step() { return ended ? null : live[index] || null; },
  };
}
