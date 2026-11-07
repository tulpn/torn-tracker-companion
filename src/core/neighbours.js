// Other scripts that already show what a feature of ours would (hq #557 F40).
//
// When one of them has drawn its own figure in a place, ours stays out of that place, so the
// player never sees the same thing twice. They are found only by the marks they put on the
// page; their storage and settings are never read.
//
// Facts, not code: each marker was read from the script's own source.
// - TornTools (GPLv3), features/oc-weights: sets `data-tt-weights` on each `[data-oc-id]`
//   crime card it labels; features/gym-progress: a `p.tt-gym-energy-progress` line in the
//   gym's notification.
// - OC2.0 Helper by Strigwulf (GPLv3, greasyfork 577968): a `.oc-weight-box` in each slot and
//   a `.oc-success-box` in the crime card.
// - Crime Morale by tobytorn (MIT): `#crime-morale-value` in the crimes header.
// - Bustr+ by cowboyup (MIT, greasyfork 586532): a `.bustr-plus-hardness-wrap` score in
//   each jail row.

export const NEIGHBOURS = Object.freeze({
  ocWeights: { by: 'TornTools or OC2.0 Helper', marker: '[data-tt-weights], .oc-weight-box' },
  ocSuccess: { by: 'OC2.0 Helper', marker: '.oc-success-box' },
  crimeMorale: { by: 'Crime Morale', marker: '#crime-morale-value' },
  bustScore: { by: 'Bustr+', marker: '.bustr-plus-hardness-wrap' },
  gymProgress: { by: 'TornTools', marker: '.tt-gym-energy-progress' },
});

/**
 * Whether another script shows `what` in `scope` (the place itself or anything in it).
 * @param {Element|Document|null} scope
 * @param {keyof typeof NEIGHBOURS} what
 */
export function shownByOther(scope, what) {
  const { marker } = NEIGHBOURS[what];
  if (!scope) return false;
  if (typeof scope.matches === 'function' && scope.matches(marker)) return true;
  return Boolean(scope.querySelector?.(marker));
}
