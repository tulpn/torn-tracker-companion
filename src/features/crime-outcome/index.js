// Your own crime outcomes (CMP-205 capture half; CAPI-010 `crime_outcome`, hq #124).
//
// When you commit a crime, the page's own answer says how it went and what you got. If you
// have switched this kind on, that is shared: the page's own numbers for the crime, the
// outcome, the money and the items. Only your own attempts, only as the page answered
// them; the script makes no request. torn-tracker.com maps the crime to the API's list,
// adds the nerve it costs, keeps your rows for your own view for 30 days, and publishes
// only totals per crime once at least 20 players have reported it.
//
// Facts, not code, from TornTools (GPLv3, src/common/pages/crimes2-page.ts), Crime Morale
// (MIT) and Torn Crimes 2.0 Helper (MIT), which read the same response.

import { isCrimesResponse } from '../crime-helper/selectors.js';
import { attemptOf, outcomeOf } from './read.js';

let unsubscribe = null;

export default {
  id: 'crime-outcome',
  wave: 2,
  title: 'Crimes: your outcomes',
  area: 'crimes',
  guide: 'crime-helpers',
  summary: 'Lets you share your own crime outcomes (switch it on under Sharing).',
  routes: ['page.php?sid=crimes', 'loader.php?sid=crimes'],
  defaults: { enabled: true },
  shares: ['crime_outcome'],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)', 'Crime Morale (MIT)'],

  start(ctx) {
    unsubscribe = ctx.intercept.onJson(isCrimesResponse, ({ url, data, form }) => {
      const attempt = attemptOf(url, form);
      const result = attempt && outcomeOf(data);
      if (!result) return;
      ctx.share('crime_outcome', { ...attempt, ...result });
    }, ctx.win);
  },

  stop() {
    unsubscribe?.();
    unsubscribe = null;
  },
};
