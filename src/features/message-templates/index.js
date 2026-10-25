// Message templates (CMP-307).
//
// A "Messages" button on any player's profile opens your templates, filled in for that
// player: their name, ID, faction and level as the profile shows them, and your own name,
// links and buying price from this feature's settings. A placeholder the page doesn't show
// stays as written and is marked in the preview; nothing is guessed. Copy puts the message
// on the clipboard; you paste it and press Send yourself. One player at a time, never a
// list. Templates are kept only on this device, in the script's settings; nothing is sent
// anywhere, and "Forget me" deletes them.
//
// Where the profile keeps its details is a fact from TornTools (GPLv3, profile page): the
// "basic information" table, one labelled row each. No code was taken.

import { el } from '../../core/dom.js';
import {
  bar as uiBar, button as uiButton, flag as uiFlag, note as uiNote, preview as uiPreview, strip as uiStrip,
} from '../../core/ui.js';
import { HEADING } from '../ff-badges/selectors.js';
import {
  BODY, MAX_TEMPLATES, NAME, SUBJECT,
} from './limits.js';
import {
  DRAFT_KEY, bodyText, composeHref, composeTarget, findCompose, validDraft, writeBody, writeSubject,
} from './compose.js';

const MARK = 'ttc-msg';
/** Our button look, on a link to Torn's own page. */
const UI_BUTTON = 'ttc-ui-button';
export {
  BODY, MAX_TEMPLATES, NAME, SUBJECT,
} from './limits.js';
const SETTLE_MS = 250;

/** The profile's detail rows: a label, and its value beside it. */
export const INFO_ROWS = '.basic-information .info-table > li';
export const INFO_LABEL = '.user-information-section';
export const INFO_VALUE = '.user-info-value';

/** Every placeholder a template may use, and where its value comes from. */
export const PLACEHOLDERS = Object.freeze([
  { key: 'name', from: 'page', help: "the player's name" },
  { key: 'id', from: 'page', help: "the player's ID" },
  { key: 'faction', from: 'page', help: "the player's faction" },
  { key: 'level', from: 'page', help: "the player's level" },
  { key: 'my_name', from: 'settings', help: 'your name' },
  { key: 'my_buylist', from: 'settings', help: 'your buy list link' },
  { key: 'my_calc', from: 'settings', help: 'your price calculator link' },
  { key: 'pct', from: 'settings', help: 'your buying price, % of market value' },
]);

/** The set a new player starts with; edit or delete any of them. */
export const STARTERS = Object.freeze([
  {
    name: 'Trade offer',
    subject: 'Trade offer',
    body: "Hi {name},\n\nI'd like to trade with you. My offer: \n\nLet me know what you think.\n\n{my_name}",
  },
  {
    name: 'Buying your items',
    subject: 'I buy at {pct}% of market value',
    body: 'Hi {name},\n\nI buy at {pct}% of market value. What I buy: {my_buylist}\nCheck your price: {my_calc}\n\nSend a trade whenever suits you.\n\n{my_name}',
  },
  {
    name: 'Recruitment',
    subject: 'Join our faction?',
    body: "Hi {name},\n\nMy faction is recruiting and I think you'd fit in well. Interested? Reply and I'll tell you more.\n\n{my_name}",
  },
  {
    name: 'Faction welcome',
    subject: 'Welcome to the faction',
    body: 'Welcome aboard, {name}!\n\nHave a look at the faction info page, and ask me anything.\n\n{my_name}',
  },
  {
    name: 'War call-up',
    subject: 'War starts soon',
    body: 'Hi {name},\n\nOur war starts soon. Please be online for it and keep your energy up.\n\n{my_name}',
  },
  {
    name: 'Armory return',
    subject: 'Armory item',
    body: "Hi {name},\n\nPlease return the item you borrowed from the faction armory when you're done with it. Thanks!\n\n{my_name}",
  },
  {
    name: 'Job offer',
    subject: 'Job in my company',
    body: 'Hi {name},\n\nI have a job open in my company. Interested? Reply and I\'ll send the details.\n\n{my_name}',
  },
]);

let state = null;

/** What storage holds is checked field by field: at most 20 templates, unique names. */
export function validateTemplates(raw) {
  const list = Array.isArray(raw?.templates) ? raw.templates : [];
  const templates = [];
  for (const t of list) {
    if (!t || typeof t !== 'object' || typeof t.name !== 'string') continue;
    const name = t.name.trim();
    if (!name || name.length > NAME || templates.some((x) => x.name === name)) continue;
    if (typeof t.subject !== 'string' || t.subject.length > SUBJECT) continue;
    if (typeof t.body !== 'string' || t.body.length > BODY) continue;
    templates.push({ name, subject: t.subject, body: t.body });
    if (templates.length === MAX_TEMPLATES) break;
  }
  return { templates };
}

/** The templates with one saved under its name (replacing `was`, if renamed), or removed. */
export function withTemplate(data, was, template) {
  const list = validateTemplates(data).templates.filter((t) => t.name === was || t.name !== template?.name);
  const at = list.findIndex((t) => t.name === was);
  if (at >= 0) list.splice(at, 1, ...(template ? [template] : []));
  else if (template) list.push(template);
  return validateTemplates({ templates: list });
}

/**
 * A template's text with what is known put in. Each part is plain text or a placeholder
 * left as written (`flag`), and `missing` lists those, so the preview can mark them.
 */
export function fill(text, values) {
  const parts = [];
  const missing = [];
  let last = 0;
  for (const match of String(text).matchAll(/\{([a-z_]+)\}/g)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    const value = values[match[1]];
    if (typeof value === 'string' && value !== '') parts.push({ text: value });
    else {
      parts.push({ flag: match[0] });
      if (!missing.includes(match[0])) missing.push(match[0]);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return { parts, missing, text: parts.map((p) => p.text ?? p.flag).join('') };
}

/** The profile's details by label; null for any the page doesn't show plainly. */
export function readProfile(doc, id) {
  const rows = new Map();
  for (const li of doc.querySelectorAll(INFO_ROWS)) {
    const label = li.querySelector(INFO_LABEL)?.textContent.trim().replace(/:$/, '').toLowerCase();
    const value = li.querySelector(INFO_VALUE);
    if (label && value) rows.set(label, value);
  }
  const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim() || null;
  const named = text(rows.get('name'))?.match(/^(.+?)\s*\[(\d+)\]$/);
  const name = named && Number(named[2]) === id ? named[1] : null;
  const faction = text(rows.get('faction')?.querySelector("a[href*='factions.php']"));
  const level = text(rows.get('level'));
  return {
    name,
    id: id ? String(id) : null,
    faction,
    level: level && /^\d+$/.test(level) ? level : null,
  };
}

/** The player's own values, from this feature's settings. */
export function ownValues(settings) {
  const s = settings || {};
  const word = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    my_name: word(s.myName),
    my_buylist: word(s.myBuylist),
    my_calc: word(s.myCalc),
    pct: Number.isFinite(s.pct) ? String(s.pct) : null,
  };
}

/** The player a profile is about. */
function pageSubject(loc) {
  const id = Number(new URLSearchParams(String(loc?.search || '')).get('XID'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default {
  id: 'message-templates',
  wave: 3,
  title: 'Message templates',
  area: 'other',
  guide: 'message-templates',
  summary: 'Your own messages on any profile, filled in with that player\'s name and details, ready to copy or to open in a new message.',
  routes: ['profiles.php', 'messages.php'],
  defaults: {
    enabled: true, myName: '', myBuylist: '', myCalc: '', pct: 90,
  },
  options: {
    myName: { label: 'Your name, for {my_name}', maxLength: NAME },
    myBuylist: { label: 'Your buy list link, for {my_buylist}', maxLength: 200 },
    myCalc: { label: 'Your price calculator link, for {my_calc}', maxLength: 200 },
    pct: { label: 'Your buying price, % of market value, for {pct}', min: 1, max: 200 },
  },
  data: { empty: { templates: STARTERS.map((t) => ({ ...t })) }, validate: validateTemplates },
  shares: [],
  needs: { apiKey: false, scriptKey: false },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null, stopWatching: null, open: false, chosen: null };
    state = s;
    const alive = () => state === s;
    const templates = () => validateTemplates(ctx.data?.()).templates;
    const h = (tag, attrs, ...children) => el(tag, { ...attrs, ownerDocument: doc }, ...children);
    const stop = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    function values(id) {
      return { ...readProfile(doc, id), ...ownValues(ctx.settings) };
    }

    function render(parts) {
      return parts.map((p) => (p.flag ? uiFlag(doc, {}, p.flag) : p.text));
    }

    function why(missing) {
      const page = missing.filter((m) => PLACEHOLDERS.some((p) => `{${p.key}}` === m && p.from === 'page'));
      const own = missing.filter((m) => PLACEHOLDERS.some((p) => `{${p.key}}` === m && p.from === 'settings'));
      const other = missing.filter((m) => !page.includes(m) && !own.includes(m));
      const lines = [];
      if (page.length) lines.push(`Not on this page: ${page.join(', ')}. It stays as written; fill it in yourself.`);
      if (own.length) lines.push(`Not set: ${own.join(', ')}. Set it in the companion's settings, under Everything else → Message templates.`);
      if (other.length) lines.push(`Not a placeholder the companion knows: ${other.join(', ')}.`);
      return lines;
    }

    async function copy(text, button, box) {
      try {
        await win.navigator.clipboard.writeText(text);
        button.textContent = 'Copied';
      } catch {
        // No clipboard (an old WebView, or permission refused): show it to copy by hand.
        const area = h('textarea', { readonly: true, 'aria-label': 'Message to copy' });
        area.value = text;
        box.querySelector(`.${MARK}-manual`)?.remove();
        area.classList.add(`${MARK}-manual`);
        box.append(area);
        area.select();
      }
    }

    /** The open box: pick a template, see it filled in, copy it, or edit it. */
    function box(id) {
      const node = uiStrip(doc, { cls: `${MARK} ${MARK}-box`, tone: 'info' });
      const list = templates();
      if (!list.some((t) => t.name === s.chosen)) s.chosen = list[0]?.name ?? null;

      const pick = h('select', { class: `${MARK}-pick`, 'aria-label': 'Template' },
        ...list.map((t) => h('option', { value: t.name, selected: t.name === s.chosen }, t.name)));
      pick.addEventListener('change', () => {
        s.chosen = pick.value;
        show();
      });
      const copyButton = uiButton(doc, { tone: 'good' }, 'Copy message');
      // A plain link to Torn's own compose page: the player opens it, and the page they
      // open fills itself in from the draft left here. Nothing is sent.
      const write = h('a', { class: `${UI_BUTTON} ${MARK}-write`, href: composeHref(id) }, 'Write message');
      write.addEventListener('click', () => {
        const t = current();
        if (!t) return;
        const known = values(id);
        const draft = { id, subject: fill(t.subject, known).text, body: fill(t.body, known).text, at: Date.now() };
        try {
          win.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch { /* no storage: the compose page opens empty, and Copy still works */ }
      });
      const edit = uiButton(doc, {}, 'Edit');
      const add = uiButton(doc, {}, 'New template');
      const body = h('div', { class: `${MARK}-body` });

      function current() {
        return templates().find((t) => t.name === s.chosen) || null;
      }

      function show() {
        const t = current();
        copyButton.textContent = 'Copy message';
        if (!t) {
          body.replaceChildren(uiNote(doc, {}, 'No templates yet. Press New template to write one.'));
          return;
        }
        const known = values(id);
        const subject = fill(t.subject, known);
        const text = fill(t.body, known);
        const missing = [...new Set([...subject.missing, ...text.missing])];
        body.replaceChildren(
          uiPreview(doc, { cls: `${MARK}-preview` },
            ...(t.subject ? [h('strong', null, ...render(subject.parts))] : []), ...render(text.parts)),
          ...why(missing).map((line) => uiNote(doc, { cls: `${MARK}-missing` }, line)),
        );
      }

      function editor(was) {
        const t = was === null ? { name: '', subject: '', body: '' } : current();
        const name = h('input', { type: 'text', maxlength: String(NAME), placeholder: 'Template name', 'aria-label': 'Template name' });
        name.value = t?.name || '';
        const subject = h('input', { type: 'text', maxlength: String(SUBJECT), placeholder: 'Subject', 'aria-label': 'Subject' });
        subject.value = t?.subject || '';
        const text = h('textarea', { rows: '8', maxlength: String(BODY), placeholder: 'Message', 'aria-label': 'Message' });
        text.value = t?.body || '';
        const save = uiButton(doc, { tone: 'good' }, 'Save template');
        const drop = uiButton(doc, {}, 'Delete');
        const back = uiButton(doc, {}, 'Cancel');
        const say = uiNote(doc, { cls: `${MARK}-say` });
        save.addEventListener('click', async (event) => {
          stop(event);
          const value = { name: name.value.trim().slice(0, NAME), subject: subject.value.slice(0, SUBJECT), body: text.value.slice(0, BODY) };
          if (!value.name) {
            say.textContent = 'Give it a name first.';
            return;
          }
          if (was !== value.name && templates().some((x) => x.name === value.name)) {
            say.textContent = 'A template has that name already.';
            return;
          }
          if (was === null && templates().length >= MAX_TEMPLATES) {
            say.textContent = `You have ${MAX_TEMPLATES} templates, the most there can be. Delete one first.`;
            return;
          }
          // Read back from storage first, so a template saved in another tab is kept.
          await ctx.saveData?.((fresh) => withTemplate(fresh, was, value));
          if (!alive()) return;
          s.chosen = value.name;
          reopen(id);
        });
        drop.addEventListener('click', async (event) => {
          stop(event);
          if (was !== null) await ctx.saveData?.((fresh) => withTemplate(fresh, was, null));
          if (!alive()) return;
          s.chosen = null;
          reopen(id);
        });
        back.addEventListener('click', (event) => {
          stop(event);
          reopen(id);
        });
        body.replaceChildren(name, subject, text,
          uiNote(doc, {}, `You can use ${PLACEHOLDERS.map((p) => `{${p.key}}`).join(' ')}.`),
          uiBar(doc, {}, save, ...(was === null ? [] : [drop]), back), say);
      }

      copyButton.addEventListener('click', (event) => {
        stop(event);
        const t = current();
        if (!t) return;
        copy(fill(t.body, values(id)).text, copyButton, node);
      });
      edit.addEventListener('click', (event) => {
        stop(event);
        if (current()) editor(s.chosen);
      });
      add.addEventListener('click', (event) => {
        stop(event);
        editor(null);
      });

      node.append(h('strong', null, 'Message templates'),
        uiBar(doc, {}, ...(list.length ? [pick, copyButton, write, edit] : []), add), body,
        uiNote(doc, {}, 'Copy it, or open it in a new message. Either way, you check it and send it yourself.'));
      show();
      return node;
    }

    function place(id, heading) {
      doc.querySelector(`.${MARK}-box`)?.remove();
      (heading.closest('.content-title') || heading).after(box(id));
    }

    function reopen(id) {
      const heading = doc.querySelector(HEADING);
      if (heading && s.open) place(id, heading);
    }

    /** The compose page: fill in a draft from a profile, and offer every template. */
    function compose(id) {
      if (doc.querySelector(`.${MARK}-insert`)) return;
      const found = findCompose(doc);
      const anchor = found.anchor || found.subject;
      if (!anchor) return;
      const known = () => ({ id: id ? String(id) : null, ...ownValues(ctx.settings) });
      const say = h('div', { class: `${MARK}-say`, role: 'status' });
      const lines = (...texts) => say.replaceChildren(...texts.map((t) => uiNote(doc, { cls: `${MARK}-line` }, t)));
      const list = templates();
      const pick = h('select', { class: `${MARK}-pick`, 'aria-label': 'Template' },
        ...list.map((t) => h('option', { value: t.name }, t.name)));
      const insert = uiButton(doc, { tone: 'good' }, 'Insert');
      insert.addEventListener('click', (event) => {
        stop(event);
        const t = templates().find((x) => x.name === pick.value);
        const now = findCompose(doc);
        if (!t || !(now.anchor || now.subject)) return;
        if (now.subject && !now.subject.value.trim()) writeSubject(now, fill(t.subject, known()).text);
        const text = fill(t.body, known()).text;
        const before = bodyText(now);
        writeBody(now, before ? `${before}\n\n${text}` : text);
        lines('Inserted. Check it, then press Send yourself.', ...why(fill(`${t.subject}\n${t.body}`, known()).missing));
      });
      const node = uiStrip(doc, { cls: `${MARK} ${MARK}-insert`, tone: 'info' },
        h('strong', null, 'Message templates'),
        uiBar(doc, {}, ...(list.length ? [pick, insert] : [uiNote(doc, {}, 'No templates yet. Write one from any profile.')])),
        say);
      (anchor.closest('form') || anchor).before(node);

      let raw = null;
      try {
        raw = win.sessionStorage.getItem(DRAFT_KEY);
      } catch { /* no storage */ }
      const draft = id ? validDraft(raw, id) : null;
      if (!draft) return;
      try {
        win.sessionStorage.removeItem(DRAFT_KEY);
      } catch { /* no storage */ }
      writeSubject(found, draft.subject);
      writeBody(found, draft.body);
      // The draft was filled in on the profile; what it still lacks stays as written.
      const left = fill(`${draft.subject}\n${draft.body}`, {}).missing;
      lines('Filled in from your template. Check it, then press Send yourself.',
        ...(left.length ? [`Still to fill in: ${left.join(', ')}.`] : []));
    }

    function look() {
      const target = composeTarget(win.location);
      if (target !== null) {
        compose(target);
        return;
      }
      const id = pageSubject(win.location);
      if (!id) return;
      const heading = doc.querySelector(HEADING);
      if (!heading || heading.parentNode?.querySelector(`:scope > .${MARK}-toggle`)) return;
      const toggle = uiButton(doc, { cls: `${MARK} ${MARK}-toggle`, attrs: { 'aria-expanded': String(s.open) } }, 'Messages');
      toggle.addEventListener('click', (event) => {
        stop(event);
        s.open = !s.open;
        toggle.setAttribute('aria-expanded', String(s.open));
        if (s.open) place(id, heading);
        else doc.querySelector(`.${MARK}-box`)?.remove();
      });
      heading.after(toggle);
    }

    const ours = (r) => ctx.dom.ownChange(r, `.${MARK}`);
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (records.every(ours)) return;
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(() => alive() && look(), SETTLE_MS);
    }, doc);
    s.timer = win.setTimeout(() => alive() && look(), SETTLE_MS);
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.stopWatching?.();
    s.win.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
