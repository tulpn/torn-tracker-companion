// Loadouts where you need them (LDT-032).
//
// On a player's profile, a card shows that player's latest loadout from torn-tracker.com's
// open data: weapons and armour with damage, accuracy and bonuses, how long ago it was
// seen and by how many players. Anyone may see it, so it is asked for without any key.
// On the attack page, for an opponent in your faction's ranked war, their danger flags
// show beside their name (Pro, from the same war view the war page uses).
//
// The script never asks Torn for any of this, and never names who reported a loadout.

import { el } from '../../core/dom.js';
import { ATTACK_ROUTES, pageSubject } from '../../core/players.js';
import { ago } from '../war-page/index.js';
import { badge, strip } from '../../core/ui.js';

const MARK = 'ttc-loadout';
const SLOT_LABELS = {
  primary: 'Primary', secondary: 'Secondary', melee: 'Melee', temporary: 'Temporary',
  helmet: 'Helmet', body: 'Body', gloves: 'Gloves', pants: 'Pants', boots: 'Boots',
};
const FLAG_WORDS = { heavy_hitter: 'Heavy hitter', armoured: 'Armoured', temp_ready: 'Temp ready' };
/** The profile's or attack page's heading the card or flags go beside. */
const HEADING = '.content-title h4, h4';

let state = null;

/** One slot as a line: "Primary: ArmaLite M-15A4 (76.9 dmg, 54.4 acc, Penetrate 25)". */
export function slotLine(name, slot) {
  const parts = [];
  if (slot.damage !== null) parts.push(`${slot.damage} dmg`);
  if (slot.accuracy !== null) parts.push(`${slot.accuracy} acc`);
  for (const b of slot.bonuses) parts.push(`${b.name} ${b.value}`);
  return `${SLOT_LABELS[name] || name}: ${slot.name}${parts.length ? ` (${parts.join(', ')})` : ''}`;
}

export default {
  id: 'loadout-view',
  wave: 1,
  title: 'Loadouts on profiles and attacks',
  area: 'war',
  guide: 'attack-page',
  summary: "A player's latest loadout on their profile, and opponents' flags when you attack.",
  routes: ['profiles.php', ...ATTACK_ROUTES],
  defaults: { enabled: true },
  shares: [],
  needs: { apiKey: false, scriptKey: false },
  credits: [],

  start(ctx) {
    const { doc } = ctx;
    const win = ctx.win || globalThis;
    const now = () => (typeof ctx.now === 'function' ? ctx.now() : Date.now());
    const s = { doc };
    state = s;
    const alive = () => state === s;
    const id = pageSubject(win.location);
    const page = String(win.location?.pathname || '').split('/').pop();
    if (!id || !ctx.site) return;

    const place = (node) => {
      const heading = doc.querySelector(HEADING);
      if (!heading) return false;
      (heading.closest('.content-title') || heading).after(node);
      return true;
    };

    async function profileCard() {
      const loadout = await ctx.site.playerLoadout(id);
      if (!alive() || !loadout?.seen) return;
      const card = strip(doc, { cls: MARK, tone: 'info' });
      if (loadout.hidden) {
        card.append(el('div', { ownerDocument: doc }, 'Loadout hidden at the player’s request.'));
      } else {
        const seen = loadout.seen_at ? `seen ${ago(now() - loadout.seen_at)} ago` : 'seen';
        const by = loadout.reporters ? ` by ${loadout.reporters} player${loadout.reporters === 1 ? '' : 's'}` : '';
        card.append(el('strong', { ownerDocument: doc }, `Latest loadout (${seen}${by}, torn-tracker.com)`));
        for (const [name, slot] of Object.entries(loadout.slots)) {
          card.append(el('div', { ownerDocument: doc }, slotLine(name, slot)));
        }
        if (loadout.flags.length) {
          card.append(el('div', { ownerDocument: doc }, ...loadout.flags.map((f) => badge(doc, { tone: f.flag === 'heavy_hitter' ? 'bad' : 'warn' }, FLAG_WORDS[f.flag]))));
        }
      }
      if (alive()) place(card);
    }

    async function attackFlags() {
      const war = await ctx.site.warLoadouts?.();
      const info = war?.pro ? war.opponents.get(id) : null;
      if (!alive() || !info || (!info.hidden && info.flags.length === 0)) return;
      const text = info.hidden ? 'Loadout hidden' : info.flags.map((f) => FLAG_WORDS[f.flag]).join(' · ');
      const node = badge(doc, { cls: MARK, tone: info.hidden ? 'neutral' : 'bad', block: true }, text);
      node.title = info.flags.map((f) => f.reason || FLAG_WORDS[f.flag]).join('\n');
      place(node);
    }

    const work = page === 'profiles.php' ? profileCard : attackFlags;
    // The heading may render after the script starts; try once it has settled.
    s.timer = win.setTimeout(() => work().catch((err) => ctx.log('loadout view', err)), 300);
    s.win = win;
  },

  stop() {
    const s = state;
    state = null;
    if (!s) return;
    s.win?.clearTimeout(s.timer);
    for (const node of s.doc.querySelectorAll(`.${MARK}`)) node.remove();
  },
};
