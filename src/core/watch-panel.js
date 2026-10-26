// Settings → Chain watch: watch mode's switch, size, colours, preview and beep (CHW-021,
// CHW-025, CHW-028).
//
// Unlike the rest of the settings page, these act at once and need no Save: the member
// sees the box change as they move a slider. They are kept on this device only
// (`ttc_watch`) and sent nowhere. The controls carry `data-watch`, never `data-act`, so the
// page's own Save and draft leave them alone.

import { COLOUR_KEYS, DEFAULT_COLOURS, SIZE_MAX, SIZE_MIN } from './watch.js';

const P = 'ttc';
export const SECTION_ID = `${P}-watch-section`;

const COLOUR_LABELS = Object.freeze({ ok: 'OK', warning: 'Warning', danger: 'Danger', flash: 'Danger’s flash' });

/**
 * The section's nodes.
 * @param {Function} h        the page's element builder
 * @param {object} watch      core/watch.js's controller
 * @param {object} opts
 * @param {string} opts.guide the guide's base URL
 */
export function watchSection(h, watch, { guide }) {
  const s = watch.settings();
  const size = watch.sizeOf();
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

  const on = h('input', { type: 'checkbox', id: `${P}-watch-on`, 'data-watch': 'on', checked: s.on });
  on.addEventListener('change', () => watch.setOn(on.checked));

  const slider = (key, label) => {
    const input = h('input', {
      type: 'range', id: `${P}-watch-${key}`, 'data-watch': key, min: String(SIZE_MIN), max: String(SIZE_MAX), step: '1', value: size[key],
    });
    const text = h('span', { 'data-watch-label': key }, `${label}: ${size[key]}% of the screen`);
    input.addEventListener('input', () => {
      text.textContent = `${label}: ${input.value}% of the screen`;
      watch.change({ [key]: Number(input.value) });
    });
    return h('label', { class: `${P}-field` }, text, input);
  };

  const colour = (key) => {
    const input = h('input', { type: 'color', id: `${P}-watch-colour-${key}`, 'data-watch': `colour-${key}`, value: s.colours[key] });
    input.addEventListener('input', () => watch.change({ colours: { [key]: input.value } }));
    return h('label', { class: `${P}-swatch` }, input, h('span', null, COLOUR_LABELS[key],
      h('small', null, s.colours[key] === DEFAULT_COLOURS[key] ? ' (default)' : '')));
  };

  const button = (act, text) => {
    const b = h('button', { type: 'button', 'data-watch-act': act }, text);
    b.addEventListener('click', () => {
      if (act === 'preview') watch.preview();
      else if (act === 'reset-size') watch.resetSize();
      else if (act === 'reset-colours') watch.resetColours();
    });
    return b;
  };

  const sound = h('input', { type: 'checkbox', id: `${P}-watch-sound`, 'data-watch': 'sound', checked: s.sound });
  sound.addEventListener('change', () => watch.change({ sound: sound.checked }));

  return [h('div', { id: SECTION_ID },
    h('div', { class: `${P}-card`, 'data-card': 'watch' },
      h('label', { class: `${P}-check` }, on, 'Watch mode'),
      h('div', { class: `${P}-muted ${P}-option` },
        'A large chain timer over the Torn page you’re on, so you can’t miss it from another window. ',
        'It turns orange at 1:00, and red flashing with “HIT NOW” under 0:30. It stays on until you turn it off. ',
        link(`${guide}chain-watch/`, 'Learn more'))),
    h('h4', null, 'Size'),
    h('div', { class: `${P}-card` },
      slider('width', 'Width'),
      slider('height', 'Height'),
      h('div', { class: `${P}-muted` }, 'Drag the box by its top bar to move it. Clicks outside that bar go through to Torn’s page.'),
      h('div', { class: `${P}-row` }, button('reset-size', 'Reset size and position'))),
    h('h4', null, 'Colours'),
    h('div', { class: `${P}-card` },
      h('div', { class: `${P}-swatches` }, ...COLOUR_KEYS.map(colour)),
      h('div', { class: `${P}-muted` }, 'The text turns black or white by itself, whichever reads better. Danger flashes once every 2 seconds; no setting makes it faster.'),
      h('div', { class: `${P}-row` }, button('reset-colours', 'Reset colours'))),
    h('h4', null, 'Preview'),
    h('div', { class: `${P}-card` },
      h('div', null, 'Runs the box on a made-up timer from 1:10 down to 0:20, through OK, Warning and Danger. It reads no real timer and asks nothing.'),
      h('div', { class: `${P}-row` }, button('preview', watch.previewing() ? 'Stop preview' : 'Preview'))),
    h('h4', null, 'Sound'),
    h('div', { class: `${P}-card` },
      h('label', { class: `${P}-check` }, sound, 'Beep once when it turns Danger'),
      h('div', { class: `${P}-muted ${P}-option` }, 'Once each time, never in a loop. Your browser may keep it quiet until you’ve clicked on the page.')),
    h('div', { class: `${P}-muted` }, 'All of this is kept on this device only and sent nowhere.'))];
}

/** Brings the section's controls in line with the settings, without rebuilding them. */
export function syncWatchSection(container, watch) {
  const section = container.querySelector(`#${SECTION_ID}`);
  if (!section) return;
  const s = watch.settings();
  const size = watch.sizeOf();
  const pick = (key) => section.querySelector(`[data-watch="${key}"]`);
  pick('on').checked = s.on;
  pick('sound').checked = s.sound;
  for (const key of ['width', 'height']) {
    pick(key).value = String(size[key]);
    const label = section.querySelector(`[data-watch-label="${key}"]`);
    label.textContent = `${key === 'width' ? 'Width' : 'Height'}: ${size[key]}% of the screen`;
  }
  for (const key of COLOUR_KEYS) {
    const input = pick(`colour-${key}`);
    if (input.value !== s.colours[key]) input.value = s.colours[key];
    const note = input.parentElement.querySelector('small');
    note.textContent = s.colours[key] === DEFAULT_COLOURS[key] ? ' (default)' : '';
  }
  section.querySelector('[data-watch-act="preview"]').textContent = watch.previewing() ? 'Stop preview' : 'Preview';
}
