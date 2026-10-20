// Where Crimes 2.0 keeps what the crime helper reads (CMP-006: one file to fix when Torn
// changes).
//
// Facts, not code, from Crime Morale by tobytorn (MIT, greasyfork.org/scripts/515557,
// github.com/tobytorn/crime-morale) and the burglary helpers 539034 (NichtGersti, MIT) and
// 592868 (CowBoyCookie, MIT), read 2026-10. The page's own responses go to
// page.php?sid=crimesData&step=…; morale is 100 minus the response's `DB.demMod`.

/** The page's own crimes responses. */
export function isCrimesResponse(url) {
  try {
    const u = new URL(String(url), 'https://www.torn.com');
    return u.pathname === '/page.php' && u.searchParams.get('sid') === 'crimesData';
  } catch {
    return false;
  }
}

/** The header the morale readout goes in. */
export const HEADER = '.crimes-app-header';

/** Burglary's target list: one row per property, recycled as the list scrolls. */
export const BURGLARY_ROW = '.burglary-root .virtual-item';
export const BURGLARY_TITLE = "[class*='crimeOptionSection']";
