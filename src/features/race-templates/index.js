// Racing templates (CMP-305).
//
// On the racing page's "Start a custom race" form, save the settings you use as a named
// template, and fill the form from one with a single press. Templates are kept only on
// this device, in the script's settings; nothing is sent anywhere, and "Forget me"
// deletes them. Filling only sets the fields: you check them and press Torn's own
// button. A field Torn's form no longer has is skipped, and the bar says so once.
//
// Facts, not code, from TornTools (GPLv3, racing-page.ts and its track catalogue),
// f2404's torn-userscripts (GPLv3) and br41nslug's torn-brainscripts (MIT): the form's
// field names and where it sits. Those scripts that press Create are not followed.

import { el } from '../../core/dom.js';
import { bar as uiBar, button as uiButton, note as uiNote } from '../../core/ui.js';

const MARK = 'ttc-race';
export const FORM = '#createCustomRace';
/** The form's own field names, in the order the bar fills them. */
export const FIELDS = Object.freeze([
  'title', 'trackID', 'laps', 'minDrivers', 'maxDrivers', 'carsTypeAllowed', 'betAmount', 'waitTime', 'password',
]);
export const MAX_TEMPLATES = 10;
const NAME = 25;
const VALUE = 40;
const SETTLE_MS = 300;

let state = null;

/** What storage holds is checked field by field: at most 10 named templates of known fields. */
export function validateTemplates(raw) {
  const list = Array.isArray(raw?.templates) ? raw.templates : [];
  const templates = [];
  for (const t of list) {
    if (!t || typeof t !== 'object' || typeof t.name !== 'string') continue;
    const name = t.name.trim();
    if (!name || name.length > NAME || templates.some((x) => x.name === name)) continue;
    const fields = {};
    for (const key of FIELDS) {
      const v = t.fields?.[key];
      if (typeof v === 'string' && v.length <= VALUE) fields[key] = v;
    }
    templates.push({ name, fields });
    if (templates.length === MAX_TEMPLATES) break;
  }
  return { templates };
}

/** Sets a field as if the player had, and says so with `input` and `change`. */
export function setValue(field, value) {
  const win = field.ownerDocument.defaultView;
  const proto = field.tagName === 'SELECT' ? win.HTMLSelectElement.prototype : win.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
  field.dispatchEvent(new win.Event('input', { bubbles: true }));
  field.dispatchEvent(new win.Event('change', { bubbles: true }));
}

/** The form's settings as a template's fields. Passwords stay on this device too. */
export function readForm(form) {
  const fields = {};
  for (const key of FIELDS) {
    const field = form.querySelector(`[name="${key}"]`);
    if (field && typeof field.value === 'string' && field.value.length <= VALUE) fields[key] = field.value;
  }
  return fields;
}

/** Fills the form from a template; returns the field names Torn's form no longer has. */
export function fillForm(form, template) {
  const missing = [];
  for (const key of FIELDS) {
    if (!(key in template.fields)) continue;
    const field = form.querySelector(`[name="${key}"]`);
    if (!field) {
      missing.push(key);
      continue;
    }
    if (field.tagName === 'SELECT' && ![...field.options].some((o) => o.value === template.fields[key])) {
      missing.push(key);
      continue;
    }
    setValue(field, template.fields[key]);
  }
  return missing;
}

export default {
  id: 'race-templates',
  wave: 3,
  title: 'Racing templates',
  area: 'other',
  guide: 'racing-templates',
  summary: 'Save custom race settings as templates and fill the race form from one.',
  routes: ['loader.php?sid=racing', 'page.php?sid=racing'],
  defaults: { enabled: true },
  data: { empty: { templates: [] }, validate: validateTemplates },
  shares: [],
  needs: { apiKey: false, scriptKey: false },
  credits: ['TornTools (GPLv3)'],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = { doc, win, timer: null, stopWatching: null, told: new Set() };
    state = s;
    const alive = () => state === s;
    const templates = () => (ctx.data?.() || { templates: [] }).templates;

    function note(bar, text) {
      bar.querySelector(`.${MARK}-note`).textContent = text;
    }

    function options(select) {
      const keep = select.value;
      select.replaceChildren(el('option', { value: '', ownerDocument: doc }, 'Choose a template'),
        ...templates().map((t) => el('option', { value: t.name, ownerDocument: doc }, t.name)));
      select.value = templates().some((t) => t.name === keep) ? keep : '';
    }

    function bar(form) {
      const select = el('select', { class: `${MARK}-pick`, ownerDocument: doc });
      const name = el('input', { type: 'text', class: `${MARK}-name`, maxlength: String(NAME), placeholder: 'Template name', ownerDocument: doc });
      const fill = uiButton(doc, { tone: 'good' }, 'Fill the form');
      const save = uiButton(doc, {}, 'Save these settings');
      const drop = uiButton(doc, {}, 'Delete');
      const node = uiBar(doc, { cls: MARK }, el('strong', { ownerDocument: doc }, 'Templates'), select, fill, drop, name, save,
        uiNote(doc, { cls: `${MARK}-note` }));
      options(select);

      // Our own buttons, pressed by the player; none of them touches Torn's own button.
      const stop = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      fill.addEventListener('click', (event) => {
        stop(event);
        const template = templates().find((t) => t.name === select.value);
        if (!template) return note(node, 'Choose a template first.');
        const missing = fillForm(form, template);
        const fresh = missing.filter((key) => !s.told.has(`${template.name}:${key}`));
        for (const key of fresh) s.told.add(`${template.name}:${key}`);
        return note(node, fresh.length
          ? `Filled. Torn's form no longer has: ${fresh.join(', ')}; skipped.`
          : 'Filled. Check the settings, then press Torn’s button yourself.');
      });
      save.addEventListener('click', async (event) => {
        stop(event);
        const label = name.value.trim();
        if (!label) return note(node, 'Give the template a name.');
        const others = templates().filter((t) => t.name !== label);
        if (others.length >= MAX_TEMPLATES) return note(node, `Ten templates at most; delete one first.`);
        await ctx.saveData?.({ templates: [...others, { name: label, fields: readForm(form) }] });
        if (!alive()) return undefined;
        options(select);
        select.value = label;
        name.value = '';
        return note(node, `Saved “${label}” on this device.`);
      });
      drop.addEventListener('click', async (event) => {
        stop(event);
        const label = select.value;
        if (!label) return note(node, 'Choose a template to delete.');
        await ctx.saveData?.({ templates: templates().filter((t) => t.name !== label) });
        if (!alive()) return undefined;
        options(select);
        return note(node, `Deleted “${label}”.`);
      });
      return node;
    }

    function look() {
      const form = doc.querySelector(FORM);
      if (!form || form.previousElementSibling?.classList?.contains(MARK)) return;
      form.before(bar(form));
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
