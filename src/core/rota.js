// The chain watch rota in the companion (CHW-011, CHW-026; the API is CHW-040 to CHW-043).
//
// Members of a faction sign up to watch its chain in 30-minute slots, one of three roles
// each (Lead, Backup 1, Backup 2). Settings → Chain watch shows the next 24 hours, with the
// member's own slots highlighted, free roles as buttons, a sign-up form, and Drop on their
// own slots. The rota is read only when the member asks for it in that section (the
// settings route makes no request on mount, CMP-107 AC4), and again after each change.
// Every sign-up and drop is the member's own click, sent to torn-tracker.com with their
// script key; nothing here touches Torn's page.
//
// When one of the member's slots starts while watch mode is off, a small notice says so,
// with a button to turn it on (CHW-026). It never turns watch mode on by itself. It learns
// the next slot from the sidebar read's `watch` item and from the rota.
//
// Times are TCT (UTC), with the member's local time beside them (CHW-001).

import { el } from './dom.js';
import { WATCH_ROLES } from './site.js';
import { SITE } from '../hosts.js';

const P = 'ttc';
export const SLOT_MS = 30 * 60_000;
export const ROTA_HOURS = 24;
export const MAX_SLOTS = 24;
export const ROLE_NAMES = Object.freeze({ lead: 'Lead', backup_1: 'Backup 1', backup_2: 'Backup 2' });
export const NOTICE_ID = `${P}-watch-notice`;
/** The site's chain board, where a member in Torn PDA drops a slot (CHW-012). */
export const BOARD_URL = `${SITE}/faction/chains/`;

const pad = (n) => String(n).padStart(2, '0');
/** '03:00': a slot start in TCT. */
export const tct = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
/** '05:00': the same moment on the member's own clock. */
export const local = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** The slot a moment falls in. */
export const slotOf = (ms) => Math.floor(ms / SLOT_MS) * SLOT_MS;
/** '30 min', '1 h', '1 h 30 min' */
export const lengthText = (slots) => {
  const h = Math.floor(slots / 2);
  return [h ? `${h} h` : '', slots % 2 ? '30 min' : ''].filter(Boolean).join(' ');
};

/** The sidebar line's words (CHW-011, acceptance test 14). */
export function watchLine(item) {
  if (item?.now) return `Watching now · ${ROLE_NAMES[item.now]}`;
  if (item?.next) return `Next watch ${tct(item.next.slotStart)} TCT · ${ROLE_NAMES[item.next.role]}`;
  return 'Sign up to watch';
}

/**
 * The rota's state and the member's actions on it.
 * @param {object} opts
 * @param {object} opts.site       core/site.js
 * @param {() => number} [opts.now]
 */
export function createRota({ site, now = Date.now }) {
  /** status: idle (not asked yet), loading, ok, no_key, refused, no_faction, wait, failed */
  let state = { status: 'idle', slots: [], gaps: [], skew: 0, from: 0, at: 0 };
  /** The last sign-up or drop's answer, shown in place. */
  let reply = null;
  let busy = false;
  const listeners = new Set();

  function emit() {
    for (const fn of [...listeners]) {
      try {
        fn();
      } catch { /* a listener's fault stays its own */ }
    }
  }

  /** The site's clock now. */
  const siteNow = () => now() + state.skew;

  async function load() {
    if (busy) return;
    busy = true;
    state = { ...state, status: state.status === 'ok' ? 'ok' : 'loading' };
    emit();
    try {
      const from = slotOf(siteNow());
      const answer = await site.chainWatch(from, ROTA_HOURS);
      state = answer.status === 'ok'
        ? { status: 'ok', slots: answer.slots, gaps: answer.gaps, skew: answer.skew, from: slotOf(now() + answer.skew), at: now() }
        : { ...state, status: answer.status, at: now() };
    } catch {
      state = { ...state, status: 'failed' };
    } finally {
      busy = false;
      emit();
    }
  }

  async function act(fn) {
    if (busy) return;
    busy = true;
    reply = { status: 'sending' };
    emit();
    try {
      reply = await fn();
    } catch {
      reply = { status: 'failed' };
    } finally {
      busy = false;
    }
    emit();
    if (reply.status === 'saved' || reply.status === 'dropped' || reply.status === 'clash') await load();
  }

  return {
    get state() {
      return state;
    },
    get reply() {
      return reply;
    },
    busy: () => busy,
    load,
    siteNow,
    /** All or nothing: the clash reply comes back in `reply` (CHW-003). */
    signUp: (start, slots, role) => act(async () => ({ ...(await site.watchSignUp({ start, slots, role })), ask: { start, slots, role } })),
    drop: (start, slots) => act(async () => ({ ...(await site.watchDrop({ start, slots })), ask: { start, slots } })),
    /** The member's own slots from now on, earliest first. */
    mine() {
      const from = slotOf(siteNow());
      return state.slots.filter((s) => s.mine && s.slotStart >= from).sort((a, b) => a.slotStart - b.slotStart);
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    forgotten() {
      state = { status: 'idle', slots: [], gaps: [], skew: 0, from: 0, at: 0 };
      reply = null;
      emit();
    },
  };
}

// ------------------------------------------------------------ the panel

const ROTA_ID = `${P}-rota`;

/** Words for an answer that isn't the rota. */
const TROUBLE = Object.freeze({
  no_key: 'Add your script key under Keys to see and join your faction’s rota.',
  refused: 'torn-tracker.com refused your script key. Check it under Keys.',
  no_faction: 'You’re not in a faction on torn-tracker.com, so there’s no rota to show.',
  wait: 'torn-tracker.com asked to wait a little. Try again in a minute.',
  failed: 'torn-tracker.com didn’t answer. Try again in a moment.',
  pda: 'Torn PDA can’t drop a slot from here yet. Drop it on torn-tracker.com’s chain board.',
});

/** What the last sign-up or drop said, in words; null for nothing to say. */
export function replyText(reply) {
  if (!reply) return null;
  const at = (ms) => `${tct(ms)} TCT`;
  switch (reply.status) {
    case 'sending': return 'Sending…';
    case 'saved': {
      const { start, slots, role } = reply.ask;
      return `Signed up: ${ROLE_NAMES[role]}, ${at(start)} for ${lengthText(slots)}.`;
    }
    case 'dropped': return `Dropped: ${at(reply.ask.start)}${reply.ask.slots > 1 ? ` for ${lengthText(reply.ask.slots)}` : ''}.`;
    case 'clash': {
      const taken = reply.clashes.map((c) => `${ROLE_NAMES[c.role]} at ${tct(c.slotStart)} (${c.name ?? 'someone'})`).join(', ');
      const free = [...reply.free.entries()].sort(([a], [b]) => a - b)
        .map(([slot, roles]) => `${tct(slot)}: ${roles.length ? roles.map((r) => ROLE_NAMES[r]).join(', ') : 'none'}`).join('; ');
      return `Nothing was saved. Already taken: ${taken || 'some of those slots'}.${free ? ` Still free: ${free}.` : ''}`;
    }
    case 'invalid': return `torn-tracker.com didn’t take that: ${reply.detail ?? 'pick a start from now to 7 days ahead, up to 12 hours long.'}`;
    default: return TROUBLE[reply.status] ?? TROUBLE.failed;
  }
}

/**
 * The rota part of Settings → Chain watch.
 * @param {Function} h      the page's element builder
 * @param {object} rota     createRota's controller
 */
export function rotaSection(h, rota) {
  const node = h('div', { id: ROTA_ID });
  drawRota(h, node, rota);
  return node;
}

/** Redraws the rota part in place (after a load, a sign-up or a drop). */
export function syncRota(h, container, rota) {
  const node = container.querySelector(`#${ROTA_ID}`);
  if (node) drawRota(h, node, rota);
}

function drawRota(h, node, rota) {
  const { state } = rota;
  const button = (text, attrs, onClick) => {
    const b = h('button', { type: 'button', ...attrs }, text);
    if (rota.busy()) b.disabled = true;
    b.addEventListener('click', onClick);
    return b;
  };
  const parts = [
    h('div', { class: `${P}-muted`, 'data-rota': 'notice' },
      'Your sign-ups are sent to torn-tracker.com with your script key, and every member of your faction sees them: '
      + 'your name, the slot and the role. They’re deleted 7 days after the slot ends.'),
  ];

  if (state.status === 'idle' || (state.status === 'loading' && !state.slots.length)) {
    parts.push(h('div', { class: `${P}-row` },
      button(state.status === 'loading' ? 'Loading…' : 'Show the next 24 hours', { 'data-rota-act': 'load' }, () => rota.load())));
    return node.replaceChildren(...parts);
  }
  if (state.status !== 'ok' && state.status !== 'loading') {
    parts.push(h('div', { class: `${P}-notice`, role: 'status' }, TROUBLE[state.status] ?? TROUBLE.failed));
    parts.push(h('div', { class: `${P}-row` }, button('Try again', { 'data-rota-act': 'load' }, () => rota.load())));
    return node.replaceChildren(...parts);
  }

  const offset = state.skew;
  const from = state.from;
  const slots = Array.from({ length: ROTA_HOURS * 2 }, (_, i) => from + i * SLOT_MS);
  const held = new Map(state.slots.map((s) => [`${s.slotStart}|${s.role}`, s]));
  const gaps = new Set(state.gaps);
  const mineAt = new Set(state.slots.filter((s) => s.mine).map((s) => s.slotStart));
  const localOf = (ms) => ms - offset;

  // The sign-up form: start, length and role, the reply shown in place (CHW-011).
  const start = h('select', { 'data-rota': 'start', 'aria-label': 'Start' },
    ...slots.map((s) => h('option', { value: String(s) }, `${tct(s)} TCT (${local(localOf(s))} yours)`)));
  const length = h('select', { 'data-rota': 'length', 'aria-label': 'Length' },
    ...Array.from({ length: MAX_SLOTS }, (_, i) => h('option', { value: String(i + 1) }, lengthText(i + 1))));
  const role = h('select', { 'data-rota': 'role', 'aria-label': 'Role' },
    ...WATCH_ROLES.map((r) => h('option', { value: r }, ROLE_NAMES[r])));
  const said = replyText(rota.reply);
  parts.push(h('h4', null, 'Sign up'),
    h('div', { class: `${P}-card` },
      h('div', { class: `${P}-rota-form` },
        h('label', { class: `${P}-field` }, h('span', null, 'Start'), start),
        h('label', { class: `${P}-field` }, h('span', null, 'Length'), length),
        h('label', { class: `${P}-field` }, h('span', null, 'Role'), role)),
      h('div', { class: `${P}-row` },
        button('Sign up', { 'data-rota-act': 'sign-up', class: `${P}-primary` }, () => rota.signUp(Number(start.value), Number(length.value), role.value))),
      said ? h('div', { class: `${P}-notice`, role: 'status', 'data-rota': 'reply' }, said) : null));

  // The grid: the next 24 hours by three roles.
  const cell = (slot, r) => {
    const row = held.get(`${slot}|${r}`);
    if (row?.mine) {
      return h('td', { class: `${P}-rota-mine` }, h('b', null, row.name), ' ',
        button('Drop', { 'data-rota-act': 'drop', 'aria-label': `Drop ${ROLE_NAMES[r]} at ${tct(slot)} TCT` }, () => rota.drop(slot, 1)));
    }
    if (row) return h('td', null, row.name);
    if (mineAt.has(slot)) return h('td', { class: `${P}-muted` }, 'free');
    return h('td', null, button('Take', { 'data-rota-act': 'take', 'aria-label': `Take ${ROLE_NAMES[r]} at ${tct(slot)} TCT` }, () => rota.signUp(slot, 1, r)));
  };
  const rows = slots.map((slot) => h('tr', { class: gaps.has(slot) ? `${P}-rota-gap` : '', 'data-slot': String(slot) },
    h('th', { scope: 'row' }, `${tct(slot)}`, h('small', null, ` ${local(localOf(slot))}`), gaps.has(slot) ? h('small', { class: `${P}-rota-flag` }, ' no Lead') : null),
    ...WATCH_ROLES.map((r) => cell(slot, r))));
  const gapCount = slots.filter((s) => gaps.has(s)).length;
  parts.push(h('h4', null, 'The next 24 hours'),
    h('div', { class: `${P}-muted` }, `Times in TCT, with yours beside them.${gapCount ? ` ${gapCount} slot${gapCount === 1 ? ' has' : 's have'} no Lead.` : ''}`),
    h('div', { class: `${P}-rota-wrap` },
      h('table', { class: `${P}-rota` },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'TCT'), ...WATCH_ROLES.map((r) => h('th', { scope: 'col' }, ROLE_NAMES[r])))),
        h('tbody', null, ...rows))),
    h('div', { class: `${P}-row` },
      button(state.status === 'loading' ? 'Loading…' : 'Refresh', { 'data-rota-act': 'load' }, () => rota.load()),
      h('a', { href: BOARD_URL, target: '_blank', rel: 'noopener noreferrer' }, 'The chain board on torn-tracker.com')));
  return node.replaceChildren(...parts.filter(Boolean));
}

export const ROTA_STYLE = `
  #${P}-panel .${P}-rota-form { display: flex; flex-wrap: wrap; gap: 8px 14px; }
  #${P}-panel .${P}-rota-form .${P}-field { display: flex; flex-direction: column; gap: 4px; }
  #${P}-panel .${P}-rota-wrap { max-height: 420px; overflow: auto; border: 1px solid var(--ttc-line); border-radius: 10px; }
  #${P}-panel table.${P}-rota { width: 100%; border-collapse: collapse; font-size: 13px; }
  #${P}-panel table.${P}-rota th, #${P}-panel table.${P}-rota td { padding: 4px 6px; text-align: left; vertical-align: middle; border-bottom: 1px solid var(--ttc-line); }
  #${P}-panel table.${P}-rota thead th { position: sticky; top: 0; background: var(--ttc-surface); }
  #${P}-panel table.${P}-rota th small { font-weight: 400; opacity: .75; }
  #${P}-panel table.${P}-rota button { min-height: 32px; padding: 2px 10px; }
  #${P}-panel .${P}-rota-mine { background: var(--ttc-accent-soft); }
  #${P}-panel .${P}-rota-gap th { box-shadow: inset 3px 0 0 #f97316; }
  #${P}-panel .${P}-rota-flag { color: #c2410c; font-weight: 700; }
  @media (pointer: coarse) { #${P}-panel table.${P}-rota button { min-height: 44px; } }
`;

// ------------------------------------------------------------ the slot-start notice

/**
 * CHW-026: when one of the member's slots starts and watch mode is off, a small notice
 * with a button to turn it on. It never turns watch mode on by itself.
 * @param {object} opts
 * @param {Document} opts.doc
 * @param {object} opts.watch   core/watch.js's controller
 * @param {object} [opts.timers]
 * @param {() => number} [opts.now]
 */
export function mountSlotNotice({ doc, watch, timers = doc.defaultView || globalThis, now = Date.now }) {
  const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);
  let timer = null;
  /** The slot the timer waits for: {startsAt (local ms), role}. */
  let planned = null;
  /** Slots already announced on this page, so a slot is announced once. */
  const told = new Set();
  let node = null;

  function hide() {
    node?.remove();
    node = null;
  }

  function show(role, startsAt) {
    told.add(startsAt);
    if (watch.isOn()) return;
    hide();
    const on = h('button', { type: 'button', class: `${P}-watch-notice-on` }, 'Turn on watch mode');
    const close = h('button', { type: 'button', class: `${P}-watch-notice-close`, 'aria-label': 'Dismiss' }, '✕');
    on.addEventListener('click', () => {
      watch.setOn(true);
      hide();
    });
    close.addEventListener('click', hide);
    node = h('div', { id: NOTICE_ID, 'data-ttc-own': '', role: 'status' },
      h('span', null, `Your chain watch (${ROLE_NAMES[role]}) starts now`), on, close);
    addStyle(doc);
    (doc.body || doc.documentElement).append(node);
  }

  // A timer that only shows a notice: it asks nothing.
  function slotStarts() {
    timer = null;
    if (!planned) return;
    const { role, startsAt } = planned;
    planned = null;
    if (!told.has(startsAt) && now() - startsAt < 60_000) show(role, startsAt);
  }

  /**
   * The member's next slot, from the sidebar read or the rota.
   * @param {{role: string, startsAt: number}|null} next  startsAt on the local clock
   */
  function plan(next) {
    if (!next || !ROLE_NAMES[next.role] || !Number.isFinite(next.startsAt) || told.has(next.startsAt)) return;
    if (planned && planned.startsAt <= next.startsAt && planned.startsAt > now()) return;
    planned = { role: next.role, startsAt: next.startsAt };
    timers.clearTimeout(timer);
    // Browsers hold timers up to about 24.8 days; a slot is at most 7 days ahead.
    timer = timers.setTimeout(slotStarts, Math.max(0, next.startsAt - now()));
  }

  const stopWatch = watch.onChange(() => {
    if (watch.isOn()) hide();
  });

  return {
    plan,
    /** From the sidebar read's `watch` item (CHW-043). */
    fromSidebar(item) {
      if (item?.next) plan({ role: item.next.role, startsAt: item.next.startsAt });
    },
    /** From the rota: the member's first slot still to come. */
    fromRota(rota) {
      const skew = rota.state.skew;
      const ahead = rota.mine().find((s) => s.slotStart - skew > now());
      if (ahead) plan({ role: ahead.role, startsAt: ahead.slotStart - skew });
    },
    get node() {
      return node;
    },
    destroy() {
      timers.clearTimeout(timer);
      stopWatch();
      hide();
    },
  };
}

const NOTICE_STYLE = `
  #${NOTICE_ID} {
    position: fixed; z-index: 2147481000; left: 50%; bottom: 16px; transform: translateX(-50%); max-width: calc(100vw - 32px);
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px; border-radius: 12px;
    background: #111827; color: #ffffff; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 14px; font-weight: 600;
    box-shadow: 0 8px 28px rgba(0, 0, 0, .35);
  }
  #${NOTICE_ID} button { min-height: 44px; min-width: 44px; border: 0; border-radius: 8px; padding: 0 12px; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 700; }
  #${NOTICE_ID} .${P}-watch-notice-on { background: #16a34a; color: #000000; }
  #${NOTICE_ID} .${P}-watch-notice-close { background: transparent; color: inherit; }
`;

function addStyle(doc) {
  if (doc.getElementById(`${P}-watch-notice-style`)) return;
  const style = el('style', { id: `${P}-watch-notice-style`, ownerDocument: doc });
  style.textContent = NOTICE_STYLE;
  doc.head.appendChild(style);
}
