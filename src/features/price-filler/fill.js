// Reading a sell form's row and filling its fields (CMP-105). The filling is the whole
// of what this feature does to Torn's page: set a field's value the way typing would,
// and tell the form it changed. It never submits and never presses anything.

import { readInt } from '../../core/dom.js';
import { FORMS } from './selectors.js';

/** The item in a row: from the info button's aria-controls, or the item image. */
export function itemIdOf(row, form) {
  const spec = FORMS[form];
  const controls = spec.infoButton ? row.querySelector(spec.infoButton)?.getAttribute('aria-controls') : null;
  const fromButton = /-(\d+)-/.exec(controls || '');
  if (fromButton) return Number(fromButton[1]);
  const src = row.querySelector(spec.image)?.getAttribute('src') || '';
  const fromImage = /\/items\/(\d+)\//.exec(src) || /\/(\d+)\//.exec(src);
  return fromImage ? Number(fromImage[1]) : null;
}

/** How many the player has, from "x12" in the row's text; null when it does not say. */
export function ownedOf(row, form) {
  const where = FORMS[form].owned;
  const text = (where ? row.querySelector(where) : row)?.textContent || '';
  const m = /(?:^|\s)x\s?(\d[\d,]*)(?:\s|$)/i.exec(text);
  return m ? readInt(m[1]) : null;
}

/** Market value minus the undercut, never below $1. */
export function priceFrom(market, undercut) {
  if (!Number.isInteger(market) || market < 1) return null;
  return Math.max(1, market - Math.max(0, Math.round(undercut || 0)));
}

/**
 * Sets an input as if typed, then says so with `input` and `change`, which is all a
 * React form needs to see the value. The native setter is used because React watches
 * the instance's own `value` property.
 */
export function setField(input, value) {
  const win = input.ownerDocument.defaultView;
  const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, String(value));
  else input.value = String(value);
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
}

/**
 * Fills one row: every input of its price field (Torn keeps a visible and a raw one),
 * and its quantity when the form has one and the row says how many the player owns.
 * @returns {boolean} false when the row has no price field to fill
 */
export function fillRow(row, form, { price, quantity }) {
  const spec = FORMS[form];
  const priceInputs = [...row.querySelectorAll(spec.price)];
  if (priceInputs.length === 0 || !Number.isInteger(price)) return false;
  for (const input of priceInputs) setField(input, price);
  const qty = spec.quantity ? row.querySelector(spec.quantity) : null;
  if (qty && Number.isInteger(quantity) && quantity > 0) setField(qty, quantity);
  return true;
}
