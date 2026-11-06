// Gym progress (CMP-206, D-073).
//
// On the gym page, two private kinds can be shared, each off until switched on and seen
// only by you: how far you are into the gym you are working towards (`gym_progress`, from
// the page), and each train's gain (`gym_train`: the stat and the new value less the
// previous one, both from the page's own answers). torn-tracker.com uses them only for
// your own gym view and never publishes them. In Torn's welcome box, one line gives the
// site's estimate of the energy still to the next gym, labelled as an estimate (hq #610).
//
// Nothing is trained, switched or clicked: only what the page showed and answered.
//
// Inspiration: TornTools (GPLv3), whose gym progress reads the same button, and
// Auto gym switch by Stephen Lynx (MIT) for the page's gym ids and answers. No code was
// taken.

import { answerShape, lineSpot, listShape, progressText, readActive, readInitial, readProgress, readStatuses, readTrain, whyNoProgress } from './read.js';
import { gymStep } from './selectors.js';
import { settler } from '../../core/dom.js';

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
      doc, win, stats: new Map(), names: new Map(), active: null, sent: new Set(), estimate: null, timer: null,
      unsubscribe: null, stopWatching: null,
    };
    state = s;
    const alive = () => state === s;

    // One line in Torn's welcome box, never on a gym tile (hq #610).
    function label() {
      const progress = readProgress(doc);
      const old = doc.querySelector(`.${MARK}`);
      const estimate = s.estimate;
      const spot = lineSpot(doc);
      if (!progress || !spot || !estimate || estimate.gym_id !== progress.gym_id || estimate.next_gym_energy_estimate === null) {
        old?.remove();
        return;
      }
      const text = progressText({
        name: s.names.get(progress.gym_id) ?? null,
        percent: progress.percent,
        toGo: estimate.next_gym_energy_estimate,
        total: estimate.next_gym_energy_total ?? null,
      });
      const node = old || doc.createElement('div');
      node.className = MARK;
      node.dataset.ttcOwn = '';
      if (node.textContent !== text) node.textContent = text;
      node.title = 'torn-tracker.com’s estimate: the game counts gym experience, not energy';
      if (node.parentElement !== spot.parent || (spot.before && node.nextSibling !== spot.before)) {
        spot.parent.insertBefore(node, spot.before);
      }
    }

    function look() {
      if (!alive()) return;
      const progress = readProgress(doc);
      if (!progress && !s.toldNone) {
        // Once per page: the reader found no gym in progress, and why (hq #515, #576).
        s.toldNone = true;
        ctx.log(`gym_progress: nothing captured (${whyNoProgress(doc)})`);
      }
      if (progress) shareProgress(progress);
      label();
    }

    function shareProgress(progress) {
      const key = `${progress.gym_id}:${progress.percent}`;
      if (s.sent.has(key)) return;
      s.sent.add(key);
      ctx.share('gym_progress', { gym_id: progress.gym_id, percent: progress.percent });
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
        for (const [stat, value] of initial.stats) s.stats.set(stat, value);
        if (initial.active) s.active = initial.active;
        for (const [id, name] of initial.names) s.names.set(id, name);
        label();
        ctx.log(`gym: page info read (${initial.stats.size} stats, active gym ${initial.active ?? 'not found'})`);
      } else if (step === 'train') {
        if (!s.toldShape) {
          // Once per page: the answer's field names, never its values (hq #576).
          s.toldShape = true;
          ctx.log(`gym_train: answer fields: ${answerShape(data) || 'none'}`);
          ctx.log(`gym_train: gymsStatuses entry fields: ${listShape(data?.gymsStatuses) || 'none'}`);
        }
        const statuses = readStatuses(data?.gymsStatuses);
        if (statuses.active) s.active = statuses.active;
        // The train answer's own gym progress, when the page's didn't read (hq #576).
        if (statuses.progress && !readProgress(doc)) shareProgress(statuses.progress);
        const train = readTrain(data);
        if (!train) {
          ctx.log('gym_train: not shared (the answer was not a successful train)');
          return;
        }
        const before = s.stats.get(train.stat);
        s.stats.set(train.stat, train.value);
        // The gain from the answer's message; else the new value less the one before.
        const gained = train.gain ?? (before !== undefined && train.value > before ? train.value - before : null);
        const gymId = s.active || readActive(doc);
        if (gained === null) {
          ctx.log(before === undefined
            ? `gym_train: not shared (the answer's message named no gain, and no ${train.stat} value from before this train)`
            : 'gym_train: not shared (no gain)');
        } else if (!gymId) {
          ctx.log('gym_train: not shared (the active gym is not known)');
        } else {
          ctx.share('gym_train', {
            gym_id: gymId,
            stat: train.stat,
            gained: Math.round(gained * 100) / 100,
            trains: train.trains,
            energy: train.energy,
          });
        }
        refreshEstimate().catch((err) => ctx.log('gym estimate', err));
      }
    }, ctx.win);

    const ours = (r) => ctx.dom.ownChange(r, `.${MARK}`);
    // A page that never goes quiet (a clock, a chat, another script) still gets read (hq #466).
    s.settle = settler(look, SETTLE_MS, { timers: win });
    s.stopWatching = ctx.dom.onMutation((records) => {
      if (records.every(ours)) return;
      s.settle.poke();
    }, doc);
    s.settle.poke();
    refreshEstimate().catch((err) => ctx.log('gym estimate', err));
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.unsubscribe?.();
    s.stopWatching?.();
    s.settle?.cancel();
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
