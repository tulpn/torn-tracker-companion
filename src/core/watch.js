// Watch mode: a large chain timer over the Torn page (CHW-020 to CHW-028).
//
// A watcher in another tab or window misses Torn's small chain bar. Watch mode puts a big
// box over the page instead: the time left in large type, the chain count and the source
// of the timer, coloured by state (OK, Warning, Danger, No chain, No data). It never hits
// for the player: the box is visual, and outside its handle and close control it lets
// every click through to Torn's page underneath (pointer-events: none).
//
// Where the timer comes from (CHW-020), best first:
//   1. Torn's own chain bar on the page the player has open, read from the page without
//      touching it. Live, and it costs nothing.
//   2. Otherwise the site's stored chain, from the sidebar read (`chain.timeout_at`,
//      `as_of`), asked at most every 30 seconds while watch mode is on and the tab is
//      visible, never while it's hidden, and counted down locally between answers. A hit
//      since `as_of` only raises the real timeout, so this timer can only run early: it may
//      raise a false alarm but never hides a real one. `refreshChainWatch` is the named
//      timer that asks (CMP-030, like the sidebar block's and the dibs refresher).
// With neither for more than 90 seconds, or with no script key and no chain bar, the box
// says "No data" in grey stripes: a stale box must never look safe.
//
// Danger flashes once every 2 seconds (1 s the danger colour, 1 s the flash colour): 0.5
// per second, well under WCAG 2.3.1's 3 per second. The period is a constant here and no
// setting reaches it. Every state also carries its name as text ("OK", "HIT NOW"), so a
// member who can't tell the colours apart still reads it.
//
// Size, position, colours and the optional beep are kept on this device only
// (`ttc_watch`, CMP-008) and sent nowhere. The preview runs the box on a made-up timer
// from 1:10 down to 0:20, through all three states, and asks nothing.

import { el } from './dom.js';
import { onPda } from './keys.js';

const P = 'ttc';
export const BOX_ID = `${P}-watch`;

/** Thresholds in seconds (the owner's numbers, Q-CHW-4: fixed, not a setting). */
export const WARNING_AT = 60;
export const DANGER_BELOW = 30;
/** One half of a flash. A full flash is twice this: 2 s, 0.5 per second. Not a setting. */
export const FLASH_HALF_MS = 1000;
/** The fallback read: at most this often, while on and visible (CHW-020). */
export const ASK_EVERY_MS = 30_000;
/** No source for longer than this: No data (CHW-023). */
export const STALE_AFTER_MS = 90_000;
/** How often the box is drawn. Reading the page and the clock only, never the network. */
export const DRAW_EVERY_MS = 250;
/** The preview's made-up timer: from 1:10 down to 0:20. */
export const PREVIEW_FROM_S = 70;
export const PREVIEW_TO_S = 20;

export const DEFAULT_COLOURS = Object.freeze({ ok: '#16a34a', warning: '#f97316', danger: '#dc2626', flash: '#ffffff' });
export const COLOUR_KEYS = Object.freeze(Object.keys(DEFAULT_COLOURS));
/** The box's default size in % of the viewport: on a desktop, and on a phone or in PDA (CHW-027). */
export const DESKTOP_SIZE = Object.freeze({ width: 40, height: 25 });
export const PHONE_SIZE = Object.freeze({ width: 90, height: 20 });
export const SIZE_MIN = 20;
export const SIZE_MAX = 90;

const HEX = /^#[0-9a-f]{6}$/;

/** What `ttc_watch` holds before the member changes anything. */
export function watchDefaults() {
  return { on: false, width: null, height: null, left: null, top: null, colours: { ...DEFAULT_COLOURS }, sound: false };
}

const size = (v) => (Number.isInteger(v) && v >= SIZE_MIN && v <= SIZE_MAX ? v : null);
const spot = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null);

/** `ttc_watch` field by field; anything that doesn't fit is the default. */
export function normalizeWatch(raw) {
  const given = raw && typeof raw === 'object' ? raw : {};
  const colours = given.colours && typeof given.colours === 'object' ? given.colours : {};
  return {
    on: given.on === true,
    width: size(given.width),
    height: size(given.height),
    left: spot(given.left),
    top: spot(given.top),
    colours: Object.fromEntries(COLOUR_KEYS.map((key) => {
      const value = typeof colours[key] === 'string' ? colours[key].toLowerCase() : '';
      return [key, HEX.test(value) ? value : DEFAULT_COLOURS[key]];
    })),
    sound: given.sound === true,
  };
}

/** Black or white, whichever reads better on this background (WCAG relative luminance). */
export function textOn(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  // Contrast with black is (L + .05) / .05, with white 1.05 / (L + .05).
  return (lum + 0.05) / 0.05 >= 1.05 / (lum + 0.05) ? '#000000' : '#ffffff';
}

/** Whole seconds left, as the box shows them; 0 once it has run out. */
export const secondsLeft = (ms) => Math.max(0, Math.ceil(ms / 1000));

/** '2:31', '1:02:09' */
export function clockText(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** The state for a number of whole seconds left (CHW-023). */
export function stateFor(seconds) {
  if (seconds <= 0) return 'nochain';
  if (seconds > WARNING_AT) return 'ok';
  if (seconds >= DANGER_BELOW) return 'warning';
  return 'danger';
}

export const LABELS = Object.freeze({ ok: 'OK', warning: 'HIT SOON', danger: 'HIT NOW', nochain: 'No chain', nodata: 'No data' });

// ------------------------------------------------------------ Torn's chain bar

/**
 * Torn's chain bar in the sidebar. Synthetic until a capture confirms it (Q-CHW-6): the
 * id and the class stems as TornTools (GPLv3) matches them. Facts, not code.
 */
export const CHAIN_BAR = Object.freeze({
  bar: '#barChain',
  value: "[class*='bar-value']",
  time: "[class*='bar-timeleft']",
});

/**
 * Reads the chain bar, or null when there isn't one or it doesn't say what it should.
 * Read only: the bar is never touched.
 * @returns {{current: number, max: number, seconds: number}|null}
 */
export function readChainBar(doc) {
  const bar = doc.querySelector(CHAIN_BAR.bar);
  if (!bar) return null;
  const value = /^\s*([\d,]+)\s*\/\s*([\d,]+)\s*$/.exec(bar.querySelector(CHAIN_BAR.value)?.textContent ?? '');
  const time = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*$/.exec(bar.querySelector(CHAIN_BAR.time)?.textContent ?? '');
  if (!value || !time) return null;
  const current = Number(value[1].replace(/,/g, ''));
  const max = Number(value[2].replace(/,/g, ''));
  const seconds = Number(time[1] || 0) * 3600 + Number(time[2]) * 60 + Number(time[3]);
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(max) || Number(time[3]) > 59) return null;
  return { current, max, seconds };
}

// ------------------------------------------------------------ the box

const STYLE = `
  #${BOX_ID} {
    position: fixed; z-index: 2147482000; box-sizing: border-box; display: grid;
    grid-template-rows: auto 1fr auto auto; justify-items: center; align-items: center;
    padding: 0 10px 8px; border-radius: 14px; overflow: hidden; pointer-events: none;
    container-type: size; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 8px 28px rgba(0, 0, 0, .35); transition: none;
  }
  #${BOX_ID}[hidden] { display: none; }
  #${BOX_ID}[data-state="nodata"] {
    background-image: repeating-linear-gradient(45deg, rgba(255, 255, 255, .14) 0 14px, transparent 14px 28px);
  }
  #${BOX_ID} .${P}-watch-bar { display: flex; align-items: stretch; width: calc(100% + 20px); margin: 0 -10px; }
  #${BOX_ID} .${P}-watch-handle, #${BOX_ID} .${P}-watch-close {
    pointer-events: auto; min-height: 44px; min-width: 44px; border: 0; margin: 0; padding: 0 12px;
    background: rgba(0, 0, 0, .18); color: inherit; font-family: inherit; font-size: 13px; font-weight: 600; line-height: 44px; touch-action: none;
  }
  #${BOX_ID} .${P}-watch-handle { flex: 1; text-align: left; cursor: move; user-select: none; -webkit-user-select: none; }
  #${BOX_ID} .${P}-watch-close { cursor: pointer; font-size: 18px; }
  #${BOX_ID} .${P}-watch-handle:focus-visible, #${BOX_ID} .${P}-watch-close:focus-visible { outline: 3px solid currentColor; outline-offset: -3px; }
  #${BOX_ID} .${P}-watch-time {
    font-weight: 800; line-height: 1; font-size: 48px; font-size: clamp(28px, 42cqh, 40cqw); font-variant-numeric: tabular-nums; letter-spacing: -.02em;
  }
  #${BOX_ID} .${P}-watch-state { font-weight: 800; line-height: 1.1; font-size: 18px; font-size: clamp(14px, 11cqh, 30px); letter-spacing: .06em; }
  #${BOX_ID} .${P}-watch-count { font-weight: 700; font-size: 15px; line-height: 1.2; font-variant-numeric: tabular-nums; }
  #${BOX_ID} .${P}-watch-source { font-weight: 500; font-size: 12px; line-height: 1.3; opacity: .85; text-align: center; }
`;

function addStyle(doc) {
  if (doc.getElementById(`${P}-watch-style`)) return;
  const style = el('style', { id: `${P}-watch-style`, ownerDocument: doc });
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

const NO_DATA = '#4b5563';
const NO_CHAIN = '#6b7280';

/**
 * @param {object} opts
 * @param {Window} opts.win
 * @param {object} opts.site                 core/site.js (its sidebar read)
 * @param {() => boolean} opts.hasKey        a script key is set
 * @param {{read: Function, write: Function}} opts.store  `ttc_watch`
 * @param {object} [opts.timers]
 * @param {() => number} [opts.now]
 * @param {(handler: Function, doc: Document) => () => void} [opts.onMutation]
 * @param {() => void} [opts.beep]           plays the Danger beep (CHW-028)
 */
export function mountWatch({
  win = globalThis, site, hasKey = () => false, store, timers = win, now = Date.now, onMutation = null, beep = null,
}) {
  const doc = win.document;
  const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);
  addStyle(doc);

  let settings = watchDefaults();
  let loaded = false;
  let stopped = false;
  /** The newest reading: where it came from, the count, when the chain times out, when it came. */
  let reading = null;
  /** The site's last answer was: no key, refused. */
  let siteRefused = false;
  let lastAsked = -Infinity;
  let notBefore = 0;
  let askTimer = null;
  let asking = false;
  let drawTimer = null;
  /** When the preview started; null when it isn't running. */
  let previewSince = null;
  /** When the current spell of Danger began, for the flash's phase and the beep. */
  let dangerSince = null;
  let box = null;
  const listeners = new Set();

  const phone = () => onPda(win) || (win.innerWidth || 1024) < 600;
  const visible = () => doc.visibilityState !== 'hidden';
  const showing = () => !stopped && loaded && (settings.on || previewSince !== null);

  /** The size in use: the member's, else the default for this device. */
  function sizeOf() {
    const base = phone() ? PHONE_SIZE : DESKTOP_SIZE;
    return { width: settings.width ?? base.width, height: settings.height ?? base.height };
  }

  /** Where the box sits, in % of the viewport, kept on screen. Default: top centre. */
  function placeOf() {
    const { width, height } = sizeOf();
    const left = settings.left ?? (100 - width) / 2;
    const top = settings.top ?? (phone() ? 0 : 1);
    return {
      width, height,
      left: Math.min(Math.max(0, left), 100 - width),
      top: Math.min(Math.max(0, top), 100 - height),
    };
  }

  function emit() {
    for (const fn of [...listeners]) {
      try {
        fn();
      } catch { /* a listener's fault stays its own */ }
    }
  }

  async function persist() {
    await store.write(settings).catch(() => false);
  }

  // ------------------------------------------------------------ sources

  /** Torn's chain bar, if the page has one now. */
  function readBar() {
    const bar = readChainBar(doc);
    if (!bar) return false;
    const at = now();
    reading = { source: 'torn', current: bar.current, max: bar.max, timeoutAt: bar.seconds > 0 ? at + bar.seconds * 1000 : null, seenAt: at, asOf: at };
    return true;
  }

  const barRecent = () => reading?.source === 'torn' && now() - reading.seenAt < 5_000;

  async function askSite() {
    if (asking) return;
    asking = true;
    lastAsked = now();
    try {
      const result = await site.sidebar(['chain']);
      if (stopped || barRecent()) return;
      if (result.status === 'no_key' || result.status === 'refused') {
        siteRefused = true;
        return;
      }
      siteRefused = false;
      if (result.status === 'wait') {
        notBefore = now() + result.retryMs;
        return;
      }
      if (result.status !== 'ok') return;
      const chain = result.items.get('chain');
      const at = now();
      reading = chain
        ? { source: 'site', current: chain.current, max: chain.max, timeoutAt: chain.timeoutAt, seenAt: at, asOf: chain.asOf ?? at }
        : { source: 'site', current: 0, max: 0, timeoutAt: null, seenAt: at, asOf: at };
    } finally {
      asking = false;
      draw();
    }
  }

  /** Whether the fallback should ask now (CHW-020, acceptance test 10). */
  const due = () => !stopped && loaded && settings.on && previewSince === null && visible()
    && !barRecent() && hasKey() && now() - lastAsked >= ASK_EVERY_MS && now() >= notBefore;

  // The one timer here that reaches the network, through site.sidebar: only while watch
  // mode is on, the tab is visible and the page has no chain bar.
  function refreshChainWatch() {
    if (stopped) return;
    if (due()) askSite().catch(() => {});
    timers.clearTimeout(askTimer);
    askTimer = timers.setTimeout(refreshChainWatch, ASK_EVERY_MS);
  }

  // ------------------------------------------------------------ what the box shows

  /**
   * The box's content now.
   * @returns {{state: string, time: string, count: string, source: string, preview: boolean}}
   */
  function view() {
    const at = now();
    if (previewSince !== null) {
      const seconds = secondsLeft(PREVIEW_FROM_S * 1000 - (at - previewSince));
      return { state: stateFor(seconds), time: clockText(seconds), count: '123 / 250', source: 'Preview · a made-up timer', preview: true };
    }
    // A bar that went away leaves its last reading counting down until it's stale, while
    // the site is asked; with neither, No data.
    if (!reading && !hasKey()) {
      return { state: 'nodata', time: '–:––', count: '', source: 'No chain bar on this page. Add your script key to use torn-tracker’s timer.', preview: false };
    }
    if ((!reading || reading.source === 'site') && siteRefused) {
      return { state: 'nodata', time: '–:––', count: '', source: 'No chain bar on this page, and torn-tracker refused the script key.', preview: false };
    }
    if (!reading) return { state: 'nodata', time: '–:––', count: '', source: 'Waiting for a timer…', preview: false };
    if (at - reading.seenAt > STALE_AFTER_MS) {
      return { state: 'nodata', time: '–:––', count: '', source: 'No timer for over 90 s.', preview: false };
    }
    const source = reading.source === 'torn'
      ? 'from Torn’s chain bar'
      : `from torn-tracker · up to ${Math.max(0, Math.round((at - reading.asOf) / 1000))} s old`;
    if (reading.current === 0 || reading.timeoutAt === null) return { state: 'nochain', time: '–:––', count: '', source, preview: false };
    const seconds = secondsLeft(reading.timeoutAt - at);
    const count = `${reading.current.toLocaleString('en-US')} / ${reading.max.toLocaleString('en-US')}`;
    return { state: stateFor(seconds), time: seconds ? clockText(seconds) : '0:00', count, source, preview: false };
  }

  /** The background and text colour for a state at this moment, with Danger's flash. */
  function colourOf(state) {
    const c = settings.colours;
    if (state === 'ok') return c.ok;
    if (state === 'warning') return c.warning;
    if (state === 'danger') {
      const phase = Math.floor((now() - dangerSince) / FLASH_HALF_MS) % 2;
      return phase === 0 ? c.danger : c.flash;
    }
    return state === 'nodata' ? NO_DATA : NO_CHAIN;
  }

  // ------------------------------------------------------------ drawing

  function build() {
    const handle = h('div', { class: `${P}-watch-handle`, role: 'button', tabindex: '0', 'aria-label': 'Move the chain watch box (arrow keys move it too)' }, '⠿ Chain watch');
    const close = h('button', { type: 'button', class: `${P}-watch-close`, 'aria-label': 'Turn watch mode off', title: 'Turn watch mode off' }, '✕');
    const node = h('div', { id: BOX_ID, 'data-ttc-own': '', 'data-state': 'nodata', role: 'group', 'aria-label': 'Chain watch' },
      h('div', { class: `${P}-watch-bar` }, handle, close),
      h('div', { class: `${P}-watch-time`, 'aria-hidden': 'true' }, '–:––'),
      h('div', { class: `${P}-watch-state`, role: 'status', 'aria-live': 'polite' }, ''),
      h('div', { class: `${P}-watch-count` }, ''),
      h('div', { class: `${P}-watch-source` }, ''));
    close.addEventListener('click', () => {
      if (previewSince !== null) stopPreview();
      else setOn(false);
    });
    dragBy(handle, node);
    return node;
  }

  /** Dragging by the handle; arrow keys on it move it 2% a press. The spot is saved. */
  function dragBy(handle, node) {
    let start = null;
    handle.addEventListener('pointerdown', (event) => {
      const place = placeOf();
      start = { x: event.clientX, y: event.clientY, left: place.left, top: place.top };
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (!start) return;
      const vw = win.innerWidth || 1;
      const vh = win.innerHeight || 1;
      settings.left = start.left + ((event.clientX - start.x) / vw) * 100;
      settings.top = start.top + ((event.clientY - start.y) / vh) * 100;
      const place = placeOf();
      settings.left = place.left;
      settings.top = place.top;
      position(node);
    });
    const end = () => {
      if (!start) return;
      start = null;
      persist();
      emit();
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    handle.addEventListener('keydown', (event) => {
      const step = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[event.key];
      if (!step) return;
      event.preventDefault();
      const place = placeOf();
      settings.left = place.left + step[0];
      settings.top = place.top + step[1];
      const kept = placeOf();
      settings.left = kept.left;
      settings.top = kept.top;
      position(node);
      persist();
      emit();
    });
  }

  function position(node) {
    const place = placeOf();
    node.style.setProperty('left', `${place.left}vw`);
    node.style.setProperty('top', `${place.top}vh`);
    node.style.setProperty('width', `${place.width}vw`);
    node.style.setProperty('height', `${place.height}vh`);
  }

  function draw() {
    if (!showing()) {
      box?.remove();
      dangerSince = null;
      return;
    }
    if (!box) box = build();
    if (!box.isConnected) (doc.body || doc.documentElement).append(box);
    const v = view();
    if (v.state === 'danger') {
      if (dangerSince === null) {
        dangerSince = now();
        if (settings.sound && !v.preview) beep?.();
      }
    } else {
      dangerSince = null;
    }
    const bg = colourOf(v.state);
    const label = LABELS[v.state];
    box.dataset.state = v.state;
    box.dataset.preview = String(v.preview);
    box.style.setProperty('background-color', bg);
    box.style.setProperty('color', textOn(bg));
    position(box);
    const set = (cls, text) => {
      const node = box.querySelector(`.${P}-watch-${cls}`);
      if (node.textContent !== text) node.textContent = text;
    };
    set('handle', v.preview ? '⠿ Chain watch · Preview' : '⠿ Chain watch');
    set('time', v.time);
    set('state', label);
    set('count', v.count);
    set('source', v.source);
    if (v.preview && previewSince !== null && now() - previewSince >= (PREVIEW_FROM_S - PREVIEW_TO_S) * 1000) stopPreview();
  }

  // ------------------------------------------------------------ control

  function setOn(on) {
    settings.on = on === true;
    if (settings.on) {
      lastAsked = -Infinity;
      readBar();
      refreshChainWatch();
    } else {
      timers.clearTimeout(askTimer);
    }
    draw();
    emit();
    return persist();
  }

  function startPreview() {
    previewSince = now();
    draw();
    emit();
  }

  function stopPreview() {
    if (previewSince === null) return;
    previewSince = null;
    draw();
    emit();
  }

  const onVisible = () => {
    if (visible()) refreshChainWatch();
  };
  doc.addEventListener('visibilitychange', onVisible);
  // The chain bar changes every second: read it as it does (read only).
  const stopWatching = onMutation?.(() => {
    if (showing() && previewSince === null && doc.querySelector(CHAIN_BAR.bar)) {
      readBar();
    }
  }, doc);
  drawTimer = timers.setInterval(() => {
    if (!showing()) return;
    if (previewSince === null) readBar();
    draw();
  }, DRAW_EVERY_MS);

  const ready = Promise.resolve(store.read()).then((saved) => {
    if (stopped) return;
    settings = normalizeWatch(saved);
    loaded = true;
    if (settings.on) {
      readBar();
      refreshChainWatch();
    }
    draw();
    emit();
  }).catch(() => {
    loaded = true;
  });

  return {
    ready,
    /** The box's node, or null when it isn't showing. */
    get box() {
      return box?.isConnected ? box : null;
    },
    /** A copy of the settings as they are now. */
    settings: () => normalizeWatch(settings),
    sizeOf,
    isOn: () => settings.on,
    setOn,
    toggle: () => setOn(!settings.on),
    previewing: () => previewSince !== null,
    preview: () => (previewSince === null ? startPreview() : stopPreview()),
    /**
     * Changes size, colours or the beep: shown at once, saved on this device.
     * @param {object} patch  any of width, height, colours: {...}, sound
     */
    change(patch) {
      const next = { ...settings, ...patch, colours: { ...settings.colours, ...(patch?.colours || {}) } };
      settings = { ...normalizeWatch(next), on: settings.on };
      draw();
      emit();
      return persist();
    },
    /** Size and position back to this device's defaults. */
    resetSize() {
      settings = { ...settings, width: null, height: null, left: null, top: null };
      draw();
      emit();
      return persist();
    },
    resetColours() {
      settings = { ...settings, colours: { ...DEFAULT_COLOURS } };
      draw();
      emit();
      return persist();
    },
    /** "Forget me" cleared the key: back to the defaults, box gone. */
    forgotten() {
      settings = watchDefaults();
      previewSince = null;
      reading = null;
      timers.clearTimeout(askTimer);
      draw();
      emit();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    view,
    draw,
    destroy() {
      stopped = true;
      doc.removeEventListener('visibilitychange', onVisible);
      stopWatching?.();
      timers.clearTimeout(askTimer);
      timers.clearInterval(drawTimer);
      box?.remove();
      listeners.clear();
    },
  };
}

/**
 * A short beep through Web Audio, once (CHW-028). Browsers allow sound only after the
 * member has interacted with the page; if they don't, nothing plays.
 */
export function makeBeep(win = globalThis) {
  let ctx = null;
  return () => {
    try {
      const Ctx = win.AudioContext || win.webkitAudioContext;
      if (!Ctx) return;
      ctx ||= new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch { /* no sound is fine */ }
  };
}
