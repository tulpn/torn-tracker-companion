// Every feature in this build, in the order the panel lists them.
//
// Wave 1 lands in WP-CMP-5 (foreign stock, attack loadouts) and
// WP-CMP-6 (fair-fight badges, the war page, the price filler). Each one is a folder
// under this one exporting a single descriptor, which registry.js validates at boot.

import foreignStock from './foreign-stock/index.js';
import attackLoadout from './attack-loadout/index.js';
import ffBadges from './ff-badges/index.js';

export default [ffBadges, foreignStock, attackLoadout];
