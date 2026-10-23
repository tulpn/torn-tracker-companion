// Gym progress (CMP-206, D-073).
//
// On the gym page, two private kinds can be shared, each off until switched on and seen
// only by you: how far you are into the gym you are working towards (`gym_progress`, from
// the page), and each train's gain (`gym_train`: the stat and the new value less the
// previous one, both from the page's own answers). torn-tracker.com uses them only for
// your own gym view and never publishes them. Beside the gym in progress, the site's
// estimate of the energy still to go is shown, labelled as an estimate.
//
// Nothing is trained, switched or clicked: only what the page showed and answered.
//
// Inspiration: TornTools (GPLv3), whose gym progress reads the same button, and
// Auto gym switch by Stephen Lynx (MIT) for the page's gym ids and answers. No code was
// taken.

import { readInitial, readProgress, readTrain } from './read.js';
import { gymStep } from './selectors.js';
import { badge } from '../../core/ui.js';

const MARK = 'ttc-gym';
const SETTLE_MS = 500;

let state = null;

export default {
  id: 'gym-progress',
  wave: 2,
  title: 'Gym progress',
  area: 'gym',
  guide: 'gym-progress',
  summary: 'About how much energy is left to your next gym, from your own progress.',
  routes: ['gym.php'],
  defaults: { enabled: true },
  shares: ['gym_progress', 'gym_train'],
  needs: { apiKey: false, scriptKey: true },
  credits: ['TornTools (GPLv3)', 'Auto gym switch (MIT)'],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const s = {
      doc, win, stats: new Map(), active: null, sent: new Set(), estimate: null, timer: null,
      unsubscribe: null, stopWatching: null,
    };
    state = s;
    const alive = () => state === s;

    function label() {
      const progress = readProgress(doc);
      const old = doc.querySelector(`.${MARK}`);
      const estimate = s.estimate;
      if (!progress || !estimate || estimate.gym_id !== progress.gym_id || estimate.next_gym_energy_estimate === null) {
        old?.remove();
        return;
      }
      const text = `about ${estimate.next_gym_energy_estimate.toLocaleString('en-US')} energy to go (an estimate)`;
      const node = old || badge(doc, { cls: MARK, tone: 'info', block: true });
      if (node.textContent !== text) node.textContent = text;
      node.title = 'torn-tracker.com’s estimate: the game counts gym experience, not energy';
      if (!old) progress.button.append(node);
    }

    function look() {
      if (!alive()) return;
      const progress = readProgress(doc);
      if (progress) {
        const key = `${progress.gym_id}:${progress.percent}`;
        if (!s.sent.has(key)) {
          s.sent.add(key);
          ctx.share('gym_progress', { gym_id: progress.gym_id, percent: progress.percent });
        }
      }
      label();
    }

    async function refreshEstimate() {
      if (!ctx.site?.meGym) return;
      const answer = await ctx.site.meGym();
      if (!alive()) return;
      s.estimate = answer;
      label();
    }

    s.unsubscribe = ctx.intercept.onJson((url) => gymStep(url) !== null, ({ url, data }) => {
      const step = gymStep(url);
      if (step === 'getInitialGymInfo') {
        const initial = readInitial(data);
        s.stats = initial.stats;
        if (initial.active) s.active = initial.active;
      } else if (step === 'train') {
        const train = readTrain(data);
        if (!train) return;
        const before = s.stats.get(train.stat);
        s.stats.set(train.stat, train.value);
        // A gain needs the value before; without it, this train only seeds the next one.
        if (before !== undefined && train.value > before && s.active) {
          ctx.share('gym_train', {
            gym_id: s.active,
            stat: train.stat,
            gained: Math.round((train.value - before) * 100) / 100,
            trains: null,
            energy: null,
          });
        }
        refreshEstimate().catch((err) => ctx.log('gym estimate', err));
      }
    }, ctx.win);

    const ours = (r) => ctx.dom.ownChange(r, `.${MARK}`);
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (records.every(ours)) return;
      win.clearTimeout(s.timer);
      s.timer = win.setTimeout(look, SETTLE_MS);
    }, doc);
    s.timer = win.setTimeout(look, SETTLE_MS);
    refreshEstimate().catch((err) => ctx.log('gym estimate', err));
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.unsubscribe?.();
    s.stopWatching?.();
    s.win.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
