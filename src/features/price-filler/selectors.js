// Where the sell forms keep their rows and fields (CMP-006: one file to fix when Torn
// changes).
//
// Facts from Torn Bazaar Filler (Ramin Quluzade, Silmaril; MIT, Greasy Fork 473470,
// v1.11.4) and Torn Market Filler (Silmaril; MIT, Greasy Fork 513920, v1.1.4), as of
// 2026-10, and TornTools (GPLv3) for the visible money input. Confirm against the live
// pages before the first release that ships this.

/**
 * One entry per form: how to find its rows, and inside a row the item's image, the
 * price field's group of inputs, the quantity field and the text that says how many the
 * player has.
 */
export const FORMS = Object.freeze({
  bazaarAdd: {
    rows: 'ul.items-cont > li',
    image: 'div.image-wrap img',
    price: 'div.price input',
    quantity: 'div.amount input:not([type=checkbox])',
    owned: 'div.name-wrap',
  },
  bazaarManage: {
    rows: "div[data-testid='sortable-item'], div[class*='row___']",
    image: "div[class*='imgContainer___'] img, img[src*='/items/']",
    price: "div[class*='price___'] .input-money-group input",
    quantity: null,
    owned: null,
  },
  marketAdd: {
    rows: "[class*='itemRowWrapper___'] > [class*='itemRow___']:not([class*='grayedOut___'])",
    image: "img[src*='/items/']",
    infoButton: "[class^='viewInfoButton___'], [class*=' viewInfoButton___']",
    price: "[class^='priceInputWrapper___'] .input-money-group input, [class*=' priceInputWrapper___'] .input-money-group input",
    quantity: "[class^='amountInputWrapper___'] .input-money-group > .input-money, [class*=' amountInputWrapper___'] .input-money-group > .input-money",
    owned: null,
  },
});

/** Which form the player is on, from the location. */
export function formFor(loc) {
  const page = String(loc?.pathname || '').split('/').pop();
  const hash = String(loc?.hash || '').toLowerCase();
  if (page === 'bazaar.php' && hash.startsWith('#/add')) return 'bazaarAdd';
  if (page === 'bazaar.php' && hash.startsWith('#/manage')) return 'bazaarManage';
  if (page === 'page.php' && /[?&]sid=itemmarket(&|$)/i.test(String(loc?.search || ''))
    && hash.startsWith('#/addlisting')) return 'marketAdd';
  return null;
}
